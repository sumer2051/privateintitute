import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Smartphone, Monitor, MapPin, History, ShieldCheck } from "lucide-react";

export type AdminDevice = {
  id: string;
  user_id: string;
  device_id: string;
  label: string | null;
  user_agent: string | null;
  platform: string | null;
  ip?: string | null;
  last_seen: string;
  first_seen: string;
  is_blocked: boolean;
  is_revoked: boolean;
  lat?: number | null;
  lng?: number | null;
  location_label?: string | null;
  can_transfer?: boolean;
  can_deposit?: boolean;
  view_only?: boolean;
  admin_notes?: string | null;
};

type Event = {
  id: string;
  event_type: string;
  label: string | null;
  platform: string | null;
  user_agent: string | null;
  location_label: string | null;
  created_at: string;
  meta: any;
};

const EVENT_LABEL: Record<string, string> = {
  first_seen: "First seen on this device",
  sign_in: "Signed in",
  permissions_changed: "Capabilities changed",
};

export function AdminDeviceDetailDialog({
  device,
  userEmail,
  onClose,
  onChanged,
}: {
  device: AdminDevice | null;
  userEmail?: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [canTransfer, setCanTransfer] = useState(true);
  const [canDeposit, setCanDeposit] = useState(true);
  const [viewOnly, setViewOnly] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    if (!device) return;
    setCanTransfer(device.can_transfer ?? true);
    setCanDeposit(device.can_deposit ?? true);
    setViewOnly(device.view_only ?? false);
    setNotes(device.admin_notes ?? "");
    (async () => {
      const { data } = await supabase
        .from("device_login_events")
        .select("id,event_type,label,platform,user_agent,location_label,created_at,meta")
        .eq("device_id", device.device_id)
        .order("created_at", { ascending: false })
        .limit(50);
      setEvents((data as Event[]) || []);
    })();
  }, [device]);

  const save = async () => {
    if (!device) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_set_device_permissions", {
      p_device: device.id,
      p_can_transfer: viewOnly ? false : canTransfer,
      p_can_deposit: viewOnly ? false : canDeposit,
      p_view_only: viewOnly,
      p_notes: notes || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Device capabilities updated");
    onChanged();
    onClose();
  };

  const Icon = /iOS|Android/i.test(device?.platform || "") ? Smartphone : Monitor;

  return (
    <Dialog open={!!device} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-lg p-4 md:p-6 max-h-[85vh] overflow-y-auto ios-safe-sheet">
        {device && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Icon className="h-4 w-4 text-primary" />
                {device.label || device.platform || "Unknown device"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {userEmail ? `${userEmail} · ` : ""}Device ID {device.device_id.slice(0, 8)}…
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap gap-1.5">
              {device.is_blocked && <Badge variant="destructive" className="text-[10px]">Locked</Badge>}
              {device.is_revoked && !device.is_blocked && <Badge variant="outline" className="text-[10px]">Kicked</Badge>}
              {device.view_only && <Badge className="bg-amber-500 text-white text-[10px]">View only</Badge>}
              {!device.is_blocked && !device.is_revoked && !device.view_only && (
                <Badge className="bg-emerald-500 text-white text-[10px]">Full access</Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] mt-2">
              <Info label="Platform" value={device.platform || "—"} />
              <Info label="IP" value={device.ip || "—"} />
              <Info label="First seen" value={new Date(device.first_seen).toLocaleString()} />
              <Info label="Last seen" value={new Date(device.last_seen).toLocaleString()} />
              <div className="col-span-2">
                <Info label="Browser / user agent" value={device.user_agent || "—"} />
              </div>
              {(device.location_label || (device.lat != null && device.lng != null)) && (
                <div className="col-span-2">
                  <p className="uppercase tracking-wider text-muted-foreground font-semibold">Location</p>
                  <a
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                    href={`https://www.google.com/maps/search/?api=1&query=${device.lat},${device.lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MapPin className="h-3 w-3" />
                    {device.location_label || `${Number(device.lat).toFixed(2)}, ${Number(device.lng).toFixed(2)}`}
                  </a>
                </div>
              )}
            </div>

            <div className="mt-4 border rounded-lg p-3 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" /> What this device can do
              </h4>
              <Toggle
                label="View only"
                hint="Balances and history visible, no money movement"
                checked={viewOnly}
                onChange={setViewOnly}
              />
              <Toggle
                label="Send transfers"
                hint="Zelle, ACH, wires and branded payments"
                checked={viewOnly ? false : canTransfer}
                disabled={viewOnly}
                onChange={setCanTransfer}
              />
              <Toggle
                label="Deposits"
                hint="Mobile / remote deposits from this device"
                checked={viewOnly ? false : canDeposit}
                disabled={viewOnly}
                onChange={setCanDeposit}
              />
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Internal note</label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Why these limits were applied" />
              </div>
            </div>

            <div className="mt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
                <History className="h-3.5 w-3.5 text-primary" /> Device history ({events.length})
              </h4>
              {events.length === 0 ? (
                <p className="text-[11px] text-muted-foreground border rounded-lg py-3 text-center">No recorded history yet.</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {events.map((e) => (
                    <div key={e.id} className="border rounded-md px-2.5 py-1.5 text-[11px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-secondary">{EVENT_LABEL[e.event_type] || e.event_type}</span>
                        <span className="text-muted-foreground shrink-0">{new Date(e.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-muted-foreground truncate">
                        {[e.label, e.location_label].filter(Boolean).join(" · ") || e.platform || ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save capabilities"}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className="text-secondary break-words">{value}</p>
    </div>
  );
}

function Toggle({
  label, hint, checked, onChange, disabled,
}: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-secondary">{label}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
