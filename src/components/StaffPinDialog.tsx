import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ShieldCheck, KeyRound } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onVerified: () => void;
}

export function StaffPinDialog({ open, onOpenChange, onVerified }: Props) {
  const [mode, setMode] = useState<"verify" | "set" | "loading">("loading");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) { setPin(""); setConfirmPin(""); return; }
    setMode("loading");
    supabase.rpc("has_staff_pin").then(({ data }) => {
      setMode(data ? "verify" : "set");
    });
  }, [open]);

  const submit = async () => {
    if (mode === "set") {
      if (!/^[0-9]{4,8}$/.test(pin)) return toast.error("PIN must be 4–8 digits");
      if (pin !== confirmPin) return toast.error("PINs do not match");
      setBusy(true);
      const { error } = await supabase.rpc("set_staff_pin", { _pin: pin });
      setBusy(false);
      if (error) return toast.error(error.message);
      toast.success("Staff PIN saved. Enter it again to activate staff mode.");
      setMode("verify");
      setPin(""); setConfirmPin("");
      return;
    }
    if (!/^[0-9]{4,8}$/.test(pin)) return toast.error("Enter your staff PIN");
    setBusy(true);
    const { data, error } = await supabase.rpc("verify_staff_pin", { _pin: pin });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (!data) return toast.error("Incorrect PIN");
    onOpenChange(false);
    onVerified();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "set" ? <KeyRound className="h-5 w-5 text-primary" /> : <ShieldCheck className="h-5 w-5 text-primary" />}
            {mode === "set" ? "Create staff PIN" : "Staff verification"}
          </DialogTitle>
          <DialogDescription>
            {mode === "set"
              ? "Set a 4–8 digit PIN. You'll enter it each time you switch into staff mode."
              : "Enter your staff PIN to activate the admin controls."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input inputMode="numeric" autoComplete="off" maxLength={8} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" className="text-center tracking-widest text-lg" />
          {mode === "set" && (
            <Input inputMode="numeric" autoComplete="off" maxLength={8} value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ""))} placeholder="Confirm PIN" className="text-center tracking-widest text-lg" />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || mode === "loading"}>
            {mode === "set" ? "Save PIN" : "Verify"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
