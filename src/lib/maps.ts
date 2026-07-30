import { supabase } from "@/integrations/supabase/client";

type MapsResponse<T> = T & { error?: string };

async function callMaps<T>(payload: Record<string, unknown>): Promise<MapsResponse<T>> {
  const { data, error } = await supabase.functions.invoke("maps", { body: payload });
  if (error) {
    let details = error.message;
    try {
      const ctx = (error as any).context;
      if (ctx?.text) details = await ctx.text();
    } catch (_) { /* ignore */ }
    throw new Error(details);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as MapsResponse<T>;
}

export type MapsPlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  nationalPhoneNumber?: string;
  googleMapsUri?: string;
  currentOpeningHours?: { openNow?: boolean };
};

export const mapsApi = {
  nearby: (lat: number, lng: number, query: string, radius = 8000) =>
    callMaps<{ places: MapsPlace[] }>({ action: "nearby", lat, lng, query, radius }),
  geocode: (address: string) =>
    callMaps<{ location: { lat: number; lng: number } | null; formatted_address: string | null }>({
      action: "geocode",
      address,
    }),
  reverse: (lat: number, lng: number) =>
    callMaps<{ formatted_address: string | null }>({ action: "reverse", lat, lng }),
  autocomplete: (input: string, sessionToken?: string) =>
    callMaps<{ suggestions: { placeId: string; text: string }[] }>({ action: "autocomplete", input, sessionToken }),
  placeDetails: (placeId: string) => callMaps<{ place: MapsPlace }>({ action: "placeDetails", placeId }),
  findPlace: (query: string, lat?: number, lng?: number) =>
    callMaps<{ place: MapsPlace | null }>({ action: "findPlace", query, lat, lng }),
};
