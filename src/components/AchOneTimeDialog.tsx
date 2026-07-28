import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Landmark, ArrowDownLeft } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";

interface PendingDeposit {
  id: string;
  amount: number;
  description: string;
  status: string | null;
  created_at: string | null;
}

function parseDepositMeta(description: string) {
  const typeMatch = description.match(/^\[([^\]]+)\]/);
  const sourceMatch = description.match(/From\s+([^\s—]+(?:[^\s—]*\s[^\s—]+)*)/);
  const reasonMatch = description.match(/—\s*(.+)$/);

  return {
    type: typeMatch ? typeMatch[1].trim() : "ACH",
    source: sourceMatch ? sourceMatch[1].trim() : "External bank",
    reason: reasonMatch ? reasonMatch[1].trim() : description,
  };
}

/**
 * Small one-time notice shown for each new incoming ACH/pending deposit.
 * Displays only the amount, source, and type — no long explanation.
 */
export const AchOneTimeDialog = () => {
  const [open, setOpen] = useState(false);
  const [deposit, setDeposit] = useState<PendingDeposit | null>(null);
  const { format } = useCurrency();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const uid = session?.user?.id;
      if (!mounted || !uid) return;

      // Find the most recent pending deposit this user has not yet seen.
      const { data } = await supabase
        .from("transactions")
        .select("id,amount,description,status,created_at")
        .eq("user_id", uid)
        .eq("category", "Pending Deposit")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const tx = data as PendingDeposit | null;
      if (!tx) return;

      const seenKey = `ach_seen_${tx.id}`;
      if (localStorage.getItem(seenKey)) return;

      setDeposit(tx);
      setTimeout(() => mounted && setOpen(true), 600);
    });
    return () => { mounted = false; };
  }, []);

  const dismiss = () => {
    if (deposit) localStorage.setItem(`ach_seen_${deposit.id}`, new Date().toISOString());
    setOpen(false);
  };

  const meta = deposit ? parseDepositMeta(deposit.description) : { type: "", source: "", reason: "" };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="max-w-[340px] p-0 overflow-hidden rounded-2xl border shadow-2xl">
        <div className="bg-gradient-to-br from-emerald-500/10 via-primary/5 to-background p-5 pb-3">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 ring-2 ring-emerald-500/20">
            <ArrowDownLeft className="h-6 w-6 text-emerald-600" />
          </div>
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-center font-display text-lg tracking-tight">
              Incoming {meta.type} Deposit
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground">
              A pending deposit has been posted to your account.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-5 pb-5 pt-1">
          <div className="mb-4 rounded-xl border bg-card/60 p-4 text-center">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Amount</p>
            <p className="font-display text-3xl font-bold text-emerald-600 tracking-tight">
              {deposit ? format(deposit.amount) : "$0.00"}
            </p>
            <div className="mt-3 flex flex-col gap-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">From</span>
                <span className="font-medium text-foreground">{meta.source}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium text-foreground">{meta.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium text-amber-600 capitalize">{deposit?.status || "pending"}</span>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground text-center mb-3 px-2">
            Funds are pending review. You will be notified once they complete.
          </p>

          <Button className="w-full" onClick={dismiss}>
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
