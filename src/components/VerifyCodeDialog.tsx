import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, ShieldCheck, RefreshCw } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  purpose: string;
  title?: string;
  description?: string;
  onVerified: () => void;
}

export const VerifyCodeDialog = ({ open, onOpenChange, purpose, title, description, onVerified }: Props) => {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState<string>("");
  const [input, setInput] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [expiresAt, setExpiresAt] = useState<number>(0);

  const send = async () => {
    setSending(true);
    setInput("");
    try {
      const { data, error } = await supabase.functions.invoke("send-verification-code", {
        body: { purpose },
      });
      if (error) throw error;
      if (!data?.code) throw new Error("No code returned");
      setCode(data.code);
      setSentTo(data.sentTo || "");
      setExpiresAt(Date.now() + 10 * 60 * 1000);
      toast({ title: "Code sent", description: `We emailed a 6-digit code to ${data.sentTo}.` });
    } catch (e: any) {
      toast({ title: "Couldn't send code", description: e.message || "Try again.", variant: "destructive" });
      onOpenChange(false);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (open) send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const verify = () => {
    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
      if (Date.now() > expiresAt) {
        toast({ title: "Code expired", description: "Request a new one.", variant: "destructive" });
        return;
      }
      if (input === code) {
        toast({ title: "Verified", description: "Access granted." });
        onOpenChange(false);
        setInput("");
        setCode("");
        onVerified();
      } else {
        toast({ title: "Incorrect code", description: "Please try again.", variant: "destructive" });
      }
    }, 350);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-accent/20 ring-2 ring-primary/30 mb-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">{title || "Verify it's you"}</DialogTitle>
          <DialogDescription className="text-center">
            {description || "Enter the 6-digit code we sent to your email to continue."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
            {sending ? "Sending code…" : sentTo ? <>Sent to <b className="text-foreground">{sentTo}</b></> : "—"}
          </div>
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={input} onChange={setInput} disabled={sending}>
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <button
            onClick={send}
            disabled={sending}
            className="mx-auto flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
          >
            <RefreshCw className="h-3 w-3" /> Resend code
          </button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={verify} disabled={input.length !== 6 || verifying || sending}>
            {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
