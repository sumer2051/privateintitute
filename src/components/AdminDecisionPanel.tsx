import { useCallback, useEffect, useState } from "react";
import { Check, Flag, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Decision = { id: string; transaction_id: string; decision: string; note: string | null; status_before: string | null; status_after: string | null; created_at: string };
const label: Record<string, string> = { flag: "Flagged", approve: "Approved", deny: "Denied" };

/** Flag / approve / deny a transaction and show the member's decision history. */
export function AdminDecisionPanel({ userId, transactionId, onDecided }: { userId: string; transactionId?: string; onDecided?: () => void }) {
  const [history, setHistory] = useState<Decision[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data } = await supabase.from("admin_review_decisions").select("id,transaction_id,decision,note,status_before,status_after,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
    setHistory((data as Decision[]) || []);
  }, [userId]);
  useEffect(() => { void load(); }, [load]);
  const decide = async (decision: "flag" | "approve" | "deny") => {
    if (!transactionId) return;
    if (decision !== "flag" && !window.confirm(`${decision === "approve" ? "Approve" : "Deny"} this transaction?`)) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_decide_transaction", { p_tx: transactionId, p_decision: decision, p_note: note });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${label[decision]} — saved on the member's record`);
    setNote(""); void load(); onDecided?.();
  };
  return <section className="space-y-3 rounded-lg border border-border p-3 min-w-0" aria-label="Review decisions">
    {transactionId && <>
      <h4 className="text-sm font-semibold">Decide on selected transaction</h4>
      <Input placeholder="Note (optional)" maxLength={200} value={note} onChange={e => setNote(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => decide("flag")}><Flag className="mr-1 h-4 w-4" />Flag</Button>
        <Button size="sm" disabled={busy} onClick={() => decide("approve")}><Check className="mr-1 h-4 w-4" />Approve</Button>
        <Button size="sm" variant="destructive" disabled={busy} onClick={() => decide("deny")}><X className="mr-1 h-4 w-4" />Deny</Button>
      </div>
    </>}
    <h4 className="text-sm font-semibold">Review history</h4>
    {history.length === 0 ? <p className="text-sm text-muted-foreground">No decisions yet.</p> :
      <ul className="space-y-2">{history.map(h => <li key={h.id} className="text-sm break-words">
        <Badge variant={h.decision === "deny" ? "destructive" : h.decision === "approve" ? "default" : "secondary"}>{label[h.decision] || h.decision}</Badge>
        <span className="ml-2 text-muted-foreground">{h.status_before} → {h.status_after} · {new Date(h.created_at).toLocaleString()}</span>
        <span className="block text-xs text-muted-foreground break-all">Transaction {h.transaction_id}{h.note ? ` · ${h.note}` : ""}</span>
      </li>)}</ul>}
  </section>;
}
