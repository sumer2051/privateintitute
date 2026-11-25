import { useEffect, useState } from "react";
import { MessageSquareWarning } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AdminDecisionPanel } from "@/components/AdminDecisionPanel";

type NoteRow = { txId: string; note: string; at: string; amount?: number; currency?: string; recipient?: string | null; status?: string | null };
const RISKY = /\b(fee|fees|bitcoin|btc|wallet|on hold|unlock|release|crypto|usdt|0x[a-f0-9]{6,}|bc1[a-z0-9]{6,})\b/i;

/** Lets an admin read member transfer notes and flag / approve / deny those transfers. */
export function AdminMemberNotesDialog({ member }: { member: { id: string; full_name?: string | null; email?: string | null } }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<string | undefined>();

  const load = async () => {
    setLoading(true);
    const { data: txs } = await supabase.from("transactions").select("id,amount,currency,recipient_name,recipient_email,status").eq("user_id", member.id).order("created_at", { ascending: false }).limit(200);
    const ids = (txs || []).map(t => t.id);
    let logs: { target_id: string | null; meta: any; created_at: string }[] = [];
    if (ids.length) {
      const { data } = await supabase.from("staff_audit_log").select("target_id,meta,created_at").eq("action", "customer_confirmed_transfer").in("target_id", ids).order("created_at", { ascending: false });
      logs = (data as any) || [];
    }
    const byId = new Map((txs || []).map(t => [t.id, t]));
    setRows(logs.filter(l => l.target_id && (l.meta?.customer_note || "").trim()).map(l => {
      const t = byId.get(l.target_id!);
      return { txId: l.target_id!, note: l.meta.customer_note, at: l.created_at, amount: t?.amount, currency: t?.currency, recipient: t?.recipient_name || t?.recipient_email, status: t?.status };
    }));
    setLoading(false);
  };
  useEffect(() => { if (open) { setPicked(undefined); void load(); } }, [open]);

  return <>
    <Button size="icon" variant="outline" aria-label={`Review transfer notes for ${member.full_name || member.email || "member"}`} title="Review transfer notes" onClick={() => setOpen(true)}>
      <MessageSquareWarning className="h-4 w-4" />
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle>Transfer notes · {member.full_name || member.email}</DialogTitle>
          <DialogDescription>Notes this member wrote when confirming transfers. Pick one to flag, approve or deny it.</DialogDescription>
        </DialogHeader>
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : rows.length === 0 ? <p className="text-sm text-muted-foreground">No transfer notes from this member.</p> :
          <ul className="space-y-2">{rows.map(r => {
            const risky = RISKY.test(r.note);
            return <li key={r.txId + r.at}>
              <button type="button" onClick={() => setPicked(r.txId)} className={`w-full text-left rounded-lg border p-3 min-w-0 ${picked === r.txId ? "border-primary bg-muted" : "border-border"}`}>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {risky && <Badge variant="destructive">Possible fee request</Badge>}
                  <Badge variant="secondary">{r.status || "unknown"}</Badge>
                  {r.amount != null && <span className="font-medium">{Number(r.amount).toLocaleString(undefined, { style: "currency", currency: "USD" })}</span>}
                  {r.recipient && <span className="text-muted-foreground">to {r.recipient}</span>}
                </div>
                <p className="mt-2 text-sm whitespace-pre-wrap break-words">{r.note}</p>
                <p className="mt-1 text-xs text-muted-foreground break-all">{new Date(r.at).toLocaleString()} · {r.txId}</p>
              </button>
            </li>;
          })}</ul>}
        {picked && <AdminDecisionPanel userId={member.id} transactionId={picked} onDecided={load} />}
      </DialogContent>
    </Dialog>
  </>;
}
