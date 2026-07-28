import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Landmark, ShieldCheck, Clock, CheckCircle2, FileText } from "lucide-react";

/**
 * One-time ACH welcome notice. Shows exactly once per user (keyed by user id
 * in localStorage) after they sign in. It explains how incoming ACH deposits
 * are handled and never shows again after dismissal.
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
      <DialogContent className="max-w-md sm:max-w-lg p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background p-6 pb-4">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 ring-4 ring-primary/10 shadow-sm">
            <Landmark className="h-8 w-8 text-primary" />
          </div>
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-center font-display text-2xl tracking-tight">
              Incoming ACH Deposits
            </DialogTitle>
            <DialogDescription className="text-center text-sm leading-relaxed">
              A quick notice about how ACH deposits are credited to your BoA private institute account.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-2 space-y-3 text-sm">
          <div className="flex gap-3 rounded-lg border p-4 bg-card/50">
            <Clock className="h-5 w-5 shrink-0 text-primary mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">Funds are subject to a standard hold</p>
              <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                Incoming ACH credits — including payroll, direct deposits, and transfers from external banks — are first posted as <strong>Pending</strong>. Funds are released to your available balance after our verification process, typically within <strong>1–3 business days</strong>.
              </p>
            </div>
          </div>

          <div className="flex gap-3 rounded-lg border p-4 bg-card/50">
            <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">Reviewed for your security</p>
              <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                Every deposit is screened for compliance before completion. You will be notified by email and in-app notification once the hold is released or if additional documentation is needed.
              </p>
            </div>
          </div>

          <div className="flex gap-3 rounded-lg border p-4 bg-card/50">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-primary mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">Deposit notifications are automatic</p>
              <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                You will receive updates at each stage: pending, processing, under review, and completed. Completed deposits are credited to your available balance immediately.
              </p>
            </div>
          </div>

          <div className="flex gap-3 rounded-lg border p-4 bg-muted/40">
            <FileText className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-semibold text-foreground text-xs">Regulatory notice</p>
              <p className="text-muted-foreground text-[11px] mt-1 leading-relaxed">
                ACH transactions are processed through the Automated Clearing House network and may be delayed or returned by the originating financial institution. BoA private institute reserves the right to extend the hold period if additional review is required.
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 pt-2">
          <p className="text-[11px] text-muted-foreground text-center mb-4">
            This notice is shown once. You can always review your deposit history in the Accounts screen.
          </p>
          <DialogFooter>
            <Button className="w-full" onClick={dismiss}>
              Acknowledge — don't show again
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
