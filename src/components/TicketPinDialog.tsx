import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

interface Props {
  open: boolean;
  ticketId: string | null;
  ticketNumber?: string;
  onOpenChange: (v: boolean) => void;
  onVerified: () => void;
}

export function TicketPinDialog({ open, ticketId, ticketNumber, onOpenChange, onVerified }: Props) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!open) setPin(""); }, [open]);

  const submit = async () => {
    if (!ticketId) return;
    if (!/^[0-9]{8}$/.test(pin)) return toast.error("Enter the 8-digit ticket PIN");
    setBusy(true);
    const { data, error } = await supabase.rpc("verify_ticket_pin", { p_ticket: ticketId, p_pin: pin });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (!data) return toast.error("Incorrect PIN for this ticket");
    onOpenChange(false);
    onVerified();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Ticket handoff PIN
          </DialogTitle>
          <DialogDescription>
            {ticketNumber ? <>Enter the 8-digit staff handoff PIN emailed to the admin for <b>{ticketNumber}</b>.</> : "Enter the 8-digit staff handoff PIN emailed to the admin for this ticket."}
          </DialogDescription>
        </DialogHeader>
        <Input
          inputMode="numeric"
          autoComplete="off"
          maxLength={8}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          placeholder="••••••••"
          className="text-center tracking-[0.5em] text-lg"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || pin.length !== 8}>Verify</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
