import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DEVICE_KEY = "boa.device.id";

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
        toast.error("This device has been locked by an administrator.");
        await supabase.auth.signOut();
        localStorage.removeItem(DEVICE_KEY);
        window.location.href = "/auth";
        return true;
      }
      if (data?.is_revoked) {
        toast.error("Your session on this device was ended by an administrator.");
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

      if (existing?.id) {
        await supabase
          .from("user_devices")
          .update({ last_seen: new Date().toISOString(), user_agent: ua, platform, label })
          .eq("id", existing.id);
      } else {
        await supabase.from("user_devices").insert({
          user_id: userId,
          device_id: deviceId,
          user_agent: ua,
          platform,
          label,
        });
      }
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
