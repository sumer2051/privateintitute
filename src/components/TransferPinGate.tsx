import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { KeyRound, ShieldCheck, Loader2 } from "lucide-react";

export type PinGateHandle = { ensure: () => Promise<boolean> };

export const TransferPinGate = forwardRef<PinGateHandle>((_, ref) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"set" | "verify">("verify");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const finish = (ok: boolean) => {
    setOpen(false);
    setPin("");
    setConfirm("");
    setError(null);
    setBusy(false);
    const r = resolver.current;
    resolver.current = null;
    r?.(ok);
  };

  useImperativeHandle(ref, () => ({
    ensure: () =>
      new Promise<boolean>(async (resolve) => {
        // If a previous gate is still open, cancel it.
        if (resolver.current) resolver.current(false);
        resolver.current = resolve;
        const { data, error } = await supabase.rpc("has_transfer_pin");
        if (error) {
          // Fail closed and let the user try to set one.
          setMode("set");
        } else {
          setMode(data ? "verify" : "set");
        }
        setOpen(true);
      }),
  }));

  const submit = async () => {
    setError(null);
    if (mode === "set") {
      if (!/^\d{4,6}$/.test(pin)) return setError("PIN must be 4–6 digits");
      if (pin !== confirm) return setError("PINs do not match");
      setBusy(true);
      const { error } = await supabase.rpc("set_transfer_pin", { _pin: pin });
      setBusy(false);
      if (error) return setError(error.message);
      finish(true);
    } else {
      if (!/^\d{4,6}$/.test(pin)) return setError("Enter your 4–6 digit PIN");
      setBusy(true);
      const { data, error } = await supabase.rpc("verify_transfer_pin", { _pin: pin });
      setBusy(false);
      if (error) return setError(error.message);
      if (!data) return setError("Incorrect PIN");
      finish(true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) finish(false); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "set" ? (
              <><KeyRound className="h-5 w-5 text-primary" /> Create a Transfer PIN</>
            ) : (
              <><ShieldCheck className="h-5 w-5 text-primary" /> Confirm with your PIN</>
            )}
          </DialogTitle>
          <DialogDescription>
            {mode === "set"
              ? "Choose a 4–6 digit PIN. You'll enter it to authorize every transfer."
              : "Enter your Transfer PIN to authorize this transaction."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div>
            <Label>{mode === "set" ? "New PIN" : "PIN"}</Label>
            <Input
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              autoFocus
              className="tracking-[0.5em] text-center text-lg"
            />
          </div>
          {mode === "set" && (
            <div>
              <Label>Confirm PIN</Label>
              <Input
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))}
                className="tracking-[0.5em] text-center text-lg"
              />
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => finish(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {mode === "set" ? "Set PIN & Continue" : "Confirm"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});
TransferPinGate.displayName = "TransferPinGate";
