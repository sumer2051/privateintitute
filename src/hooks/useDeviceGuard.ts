import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { mapsApi } from "@/lib/maps";
import { DEVICE_BLOCKED_KEY, DEVICE_BLOCKED_EVENT } from "@/components/DeviceBlockedNotice";


const DEVICE_KEY = "boa.device.id";
const GEO_KEY = "boa.device.geo";

/** Best-effort approximate sign-in location; resolves to null when unavailable or denied. */
async function getApproxLocation(): Promise<{ lat: number; lng: number; location_label: string | null } | null> {
  try {
    const cached = sessionStorage.getItem(GEO_KEY);
    if (cached) return JSON.parse(cached);
  } catch (_) { /* ignore */ }
  if (!("geolocation" in navigator)) return null;
  const perm = await (navigator.permissions?.query?.({ name: "geolocation" as PermissionName }).catch(() => null) ?? null);
  if (perm && perm.state === "denied") return null;
  const pos = await new Promise<GeolocationPosition | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );
  });
  if (!pos) return null;
  const lat = Number(pos.coords.latitude.toFixed(3));
  const lng = Number(pos.coords.longitude.toFixed(3));
  let location_label: string | null = null;
  try {
    const { formatted_address } = await mapsApi.reverse(lat, lng);
    location_label = formatted_address ?? null;
  } catch (_) { /* non-fatal */ }
  const result = { lat, lng, location_label };
  try { sessionStorage.setItem(GEO_KEY, JSON.stringify(result)); } catch (_) { /* ignore */ }
  return result;
}

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = (crypto as any).randomUUID ? crypto.randomUUID() : `d_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function detectPlatform(ua: string): string {
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac OS X/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Web";
}

function detectBrowser(ua: string): string {
  if (/Edg\//i.test(ua)) return "Edge";
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return "Chrome";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return "Safari";
  return "Browser";
}

/**
 * Registers this browser as a "device" for the signed-in user, heartbeats it,
 * and force-signs-out if an admin revokes or locks it.
 */
export function useDeviceGuard(userId: string | undefined) {
  const registered = useRef(false);

  useEffect(() => {
    if (!userId) { registered.current = false; return; }

    const deviceId = getOrCreateDeviceId();
    const ua = navigator.userAgent || "";
    const platform = detectPlatform(ua);
    const browser = detectBrowser(ua);
    const label = `${browser} on ${platform}`;

    let cancelled = false;

    const enforce = async () => {
      const { data } = await supabase
        .from("user_devices")
        .select("id,is_blocked,is_revoked")
        .eq("user_id", userId)
        .eq("device_id", deviceId)
        .maybeSingle();
      if (cancelled) return;
      if (data?.is_blocked) {
        try {
          localStorage.setItem(DEVICE_BLOCKED_KEY, "1");
          window.dispatchEvent(new Event(DEVICE_BLOCKED_EVENT));
        } catch (_) { /* ignore */ }
        // Keep the authenticated session alive behind the full-screen notice.
        // This lets the guard observe an administrator unlocking the device and
        // remove the restriction without trapping the browser in signed-out state.
        return true;
      }
      try {
        if (localStorage.getItem(DEVICE_BLOCKED_KEY)) {
          localStorage.removeItem(DEVICE_BLOCKED_KEY);
          window.dispatchEvent(new Event(DEVICE_BLOCKED_EVENT));
        }
      } catch (_) { /* ignore */ }
      if (data?.is_revoked) {
        // A "kick" is a one-time session end: sign out silently and rotate the
        // local device id so the next sign-in registers as a fresh device.
        localStorage.removeItem(DEVICE_KEY);
        await supabase.auth.signOut();
        window.location.href = "/auth";
        return true;
      }

      return false;
    };


    const register = async () => {
      const kicked = await enforce();
      if (kicked || cancelled) return;

      // Upsert (INSERT ... ON CONFLICT would be nicer, but do it in two steps for RLS clarity)
      const { data: existing } = await supabase
        .from("user_devices")
        .select("id")
        .eq("user_id", userId)
        .eq("device_id", deviceId)
        .maybeSingle();

      const geo = await getApproxLocation();
      if (cancelled) return;

      let rowId = existing?.id as string | undefined;
      if (rowId) {
        await supabase
          .from("user_devices")
          .update({ last_seen: new Date().toISOString(), user_agent: ua, platform, label, ...(geo ?? {}) })
          .eq("id", rowId);
      } else {
        const { data: inserted } = await supabase.from("user_devices").insert({
          user_id: userId,
          device_id: deviceId,
          user_agent: ua,
          platform,
          label,
          ...(geo ?? {}),
        }).select("id").maybeSingle();
        rowId = (inserted as any)?.id;
      }

      // Log one sign-in history entry per browser session so admins keep a
      // permanent record of past devices, even after a device row is removed.
      try {
        const flag = `boa.device.logged.${deviceId}`;
        if (!sessionStorage.getItem(flag)) {
          sessionStorage.setItem(flag, "1");
          await supabase.from("device_login_events").insert({
            user_id: userId,
            device_row: rowId ?? null,
            device_id: deviceId,
            event_type: existing?.id ? "sign_in" : "first_seen",
            label,
            user_agent: ua,
            platform,
            ...(geo ?? {}),
          });
        }
      } catch (_) { /* non-fatal */ }

      registered.current = true;
    };


    register();

    // Heartbeat + block/revoke check every 45s while tab open
    const iv = setInterval(() => { enforce().then(kicked => { if (!kicked) register(); }); }, 45000);

    // Re-check when tab regains focus
    const onFocus = () => { enforce(); };
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      clearInterval(iv);
      window.removeEventListener("focus", onFocus);
    };
  }, [userId]);
}
