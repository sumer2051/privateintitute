// Google Maps Platform proxy — all calls routed through the Lovable connector gateway.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function gateway(path: string, init: RequestInit & { fieldMask?: string } = {}) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY!,
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.fieldMask) headers["X-Goog-FieldMask"] = init.fieldMask;

  const res = await fetch(`${GATEWAY_URL}${path}`, { ...init, headers });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Maps gateway failed [${res.status}] ${path}: ${text}`);
    if (res.status === 403) {
      let reason = "";
      try {
        reason = (JSON.parse(text)?.error?.details ?? []).find((d: any) => d?.reason)?.reason ?? "";
      } catch (_) { /* ignore */ }
      if (reason === "API_KEY_HTTP_REFERRER_BLOCKED") {
        throw new Error(
          'Google Maps server key is referrer-restricted. In Google Cloud Console, set the server key\'s application restrictions to "None" or "IP addresses".',
        );
      }
      if (reason === "API_KEY_SERVICE_BLOCKED") {
        throw new Error(
          "Google Maps server key does not allow this API. In Google Cloud Console, add this Maps API to the server key's allowed-APIs list.",
        );
      }
      throw new Error("Google Maps request was denied (403). Check the server key's restrictions in Google Cloud Console.");
    }
    throw new Error(`[${res.status}]: ${text}`);
  }
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
      return json({ error: "Google Maps connector credentials are missing." }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");

    // ---- Nearby branches / ATMs -------------------------------------------
    if (action === "nearby") {
      const lat = Number(body.lat);
      const lng = Number(body.lng);
      const radius = Math.min(Math.max(Number(body.radius) || 8000, 500), 50000);
      const query = String(body.query ?? "bank").slice(0, 120);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return json({ error: "lat/lng required" }, 400);

      const data = await gateway("/places/v1/places:searchText", {
        method: "POST",
        fieldMask:
          "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.currentOpeningHours.openNow,places.nationalPhoneNumber,places.googleMapsUri",
        body: JSON.stringify({
          textQuery: query,
          maxResultCount: 20,
          locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius } },
        }),
      });
      return json({ places: data.places ?? [] });
    }

    // ---- Geocode a free-text address ---------------------------------------
    if (action === "geocode") {
      const address = String(body.address ?? "").trim().slice(0, 300);
      if (!address) return json({ error: "address required" }, 400);
      const data = await gateway(`/maps/api/geocode/json?address=${encodeURIComponent(address)}`);
      const first = data?.results?.[0];
      return json({
        status: data?.status,
        location: first?.geometry?.location ?? null,
        formatted_address: first?.formatted_address ?? null,
      });
    }

    // ---- Reverse geocode lat/lng -------------------------------------------
    if (action === "reverse") {
      const lat = Number(body.lat);
      const lng = Number(body.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return json({ error: "lat/lng required" }, 400);
      const data = await gateway(`/maps/api/geocode/json?latlng=${lat},${lng}`);
      return json({
        status: data?.status,
        formatted_address: data?.results?.[0]?.formatted_address ?? null,
      });
    }

    // ---- Address autocomplete ----------------------------------------------
    if (action === "autocomplete") {
      const input = String(body.input ?? "").trim().slice(0, 200);
      if (input.length < 3) return json({ suggestions: [] });
      const data = await gateway("/places/v1/places:autocomplete", {
        method: "POST",
        body: JSON.stringify({ input, ...(body.sessionToken ? { sessionToken: String(body.sessionToken).slice(0, 64) } : {}) }),
      });
      const suggestions = (data?.suggestions ?? [])
        .filter((s: any) => s?.placePrediction)
        .map((s: any) => ({
          placeId: s.placePrediction.placeId,
          text: s.placePrediction.text?.text ?? "",
        }));
      return json({ suggestions });
    }

    // ---- Place details (used after picking a suggestion) --------------------
    if (action === "placeDetails") {
      const placeId = String(body.placeId ?? "").replace(/[^A-Za-z0-9_\-]/g, "").slice(0, 200);
      if (!placeId) return json({ error: "placeId required" }, 400);
      const data = await gateway(`/places/v1/places/${placeId}`, {
        fieldMask: "id,displayName,formattedAddress,location,googleMapsUri",
      });
      return json({ place: data });
    }

    // ---- Best-effort merchant/place lookup for a transaction ---------------
    if (action === "findPlace") {
      const query = String(body.query ?? "").trim().slice(0, 200);
      if (!query) return json({ place: null });
      const payload: Record<string, unknown> = { textQuery: query, maxResultCount: 1 };
      if (Number.isFinite(Number(body.lat)) && Number.isFinite(Number(body.lng))) {
        payload.locationBias = {
          circle: { center: { latitude: Number(body.lat), longitude: Number(body.lng) }, radius: 50000 },
        };
      }
      const data = await gateway("/places/v1/places:searchText", {
        method: "POST",
        fieldMask: "places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri",
        body: JSON.stringify(payload),
      });
      return json({ place: data?.places?.[0] ?? null });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("maps function error:", message);
    return json({ error: message }, 500);
  }
});
