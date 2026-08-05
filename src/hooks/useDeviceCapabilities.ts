import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const DEVICE_KEY = "boa.device.id";

export type DeviceCapabilities = {
  canTransfer: boolean;
  canDeposit: boolean;
  viewOnly: boolean;
  loaded: boolean;
};

/** Reads the capabilities an administrator set for this specific device. */
export function useDeviceCapabilities(userId?: string): DeviceCapabilities {
  const [caps, setCaps] = useState<DeviceCapabilities>({
    canTransfer: true, canDeposit: true, viewOnly: false, loaded: false,
  });

  useEffect(() => {
    if (!userId) return;
    const deviceId = localStorage.getItem(DEVICE_KEY);
    if (!deviceId) { setCaps(c => ({ ...c, loaded: true })); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_devices")
        .select("can_transfer,can_deposit,view_only")
        .eq("user_id", userId)
        .eq("device_id", deviceId)
        .maybeSingle();
      if (cancelled) return;
      setCaps({
        canTransfer: (data as any)?.view_only ? false : ((data as any)?.can_transfer ?? true),
        canDeposit: (data as any)?.view_only ? false : ((data as any)?.can_deposit ?? true),
        viewOnly: (data as any)?.view_only ?? false,
        loaded: true,
      });
    })();
    return () => { cancelled = true; };
  }, [userId]);

  return caps;
}
