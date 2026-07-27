import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Landmark, ShieldCheck, Clock } from "lucide-react";

/**
 * One-time ACH welcome notice. Shows exactly once per user (keyed by user id
 * in localStorage) after they sign in. Never shows again after dismissal.
 */
export const AchOneTimeDialog = () => {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id;
      if (!mounted || !uid) return;
      setUserId(uid);
      const key = `ach_notice_seen_${uid}`;
      if (!localStorage.getItem(key)) {
        // Small delay so it doesn't fight the page load animation.
        setTimeout(() => mounted && setOpen(true), 700);
      }
    });
    return () => { mounted = false; };
  }, []);

  const dismiss = () => {
    if (userId) localStorage.setItem(`ach_notice_seen_${userId}`, new Date().toISOString());
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 ring-4 ring-primary/5">
            <Landmark className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-center font-display text-2xl">Welcome to BoA private institute</DialogTitle>
          <DialogDescription className="text-center">
            A quick note on how deposits and ACH transfers work on your account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex gap-3 rounded-lg border p-3">
            <Clock className="h-5 w-5 shrink-0 text-primary mt-0.5" />
            <div>
              <p className="font-semibold text-secondary">ACH deposits are held pending review</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Incoming ACH credits (payroll, external transfers, wires) appear immediately as <em>Pending</em>. Funds
                are released to your available balance after our compliance team completes verification, typically
                within 1–3 business days.
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-lg border p-3">
            <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
            <div>
              <p className="font-semibold text-secondary">You'll be notified at every step</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Each status change — pending, processing, under review, or successful — is sent to your email and
                appears in your in‑app notifications with the source, amount, and reference number.
              </p>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground text-center pt-1">
            This message is shown only once. You can always find deposit history in your Accounts screen.
          </p>
        </div>

        <DialogFooter>
          <Button className="w-full" onClick={dismiss}>Got it — don't show again</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
