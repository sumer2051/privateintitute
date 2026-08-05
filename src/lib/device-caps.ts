import { supabase } from "@/integrations/supabase/client";

const DEVICE_KEY = "boa.device.id";

/** Returns true when an administrator allows money movement from this device. */
export async function deviceCanTransfer(userId: string): Promise<boolean> {
  const deviceId = localStorage.getItem(DEVICE_KEY);
  if (!deviceId) return true;
  const { data } = await supabase
    .from("user_devices")
    .select("can_transfer,view_only")
    .eq("user_id", userId)
    .eq("device_id", deviceId)
    .maybeSingle();
  if (!data) return true;
  return !(data as any).view_only && ((data as any).can_transfer ?? true);
}
