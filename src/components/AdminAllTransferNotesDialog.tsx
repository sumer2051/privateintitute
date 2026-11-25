import { useEffect, useState } from "react";
import { MessageSquareWarning, Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { AdminDecisionPanel } from "@/components/AdminDecisionPanel";

type NoteRow = {
  txId: string;
  userId: string;
  member: string;
  note: string;
  at: string;
  amount?: number;
  currency?: string;
  recipient?: string | null;
  status?: string | null;
};

const RISKY = /\b(fee|fees|bitcoin|btc|wallet|on hold|unlock|release|crypto|usdt|0x[a-f0-9]{6,}|bc1[a-z0-9]{6,})\b/i;

/** One place for admins to read transfer notes written by every member, and flag / approve / deny them. */
export function AdminAllTransferNotesDialog() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<string | undefined>();
  const [q, setQ] = useState("");
  const [exempt, setExempt] = useState<Set<string>>(new Set());
  const [flagOpen, setFlagOpen] = useState(false);
  const [members, setMembers] = useState<{ id: string; name: string; email: string | null }[]>([]);
  const [fq, setFq] = useState("");

  const loadExempt = async () => {
    const { data } = await (supabase as any).from("note_review_exemptions").select("user_id");
    setExempt(new Set(((data as any[]) || []).map(r => r.user_id)));
  };
  const loadMembers = async () => {
    const { data } = await supabase.from("profiles").select("id,full_name,email").order("full_name");
    setMembers((data || []).map(p => ({ id: p.id, name: p.full_name || p.email || "member", email: p.email })));
  };
  const toggle = async (id: string) => {
    if (exempt.has(id)) {
      await (supabase as any).from("note_review_exemptions").delete().eq("user_id", id);
    } else {
      const { data: u } = await supabase.auth.getUser();
      await (supabase as any).from("note_review_exemptions").insert({ user_id: id, set_by: u.user?.id });
    }
    await loadExempt();
  };

  const load = async () => {
    setLoading(true);
    const { data: logs } = await supabase
      .from("staff_audit_log")
      .select("target_id,meta,created_at")
      .eq("action", "customer_confirmed_transfer")
      .order("created_at", { ascending: false })
      .limit(300);
    const noted = ((logs as any[]) || []).filter(l => l.target_id && (l.meta?.customer_note || "").trim());
    const ids = Array.from(new Set(noted.map(l => l.target_id as string)));
    const { data: txs } = ids.length
      ? await supabase.from("transactions").select("id,user_id,amount,currency,recipient_name,recipient_email,status").in("id", ids)
      : { data: [] };
    const byId = new Map((txs || []).map(t => [t.id, t]));
    const userIds = Array.from(new Set((txs || []).map(t => t.user_id)));
    const { data: people } = userIds.length
      ? await supabase.from("profiles").select("id,full_name,email").in("id", userIds)
      : { data: [] };
    const who = new Map((people || []).map(p => [p.id, p.full_name || p.email || "member"]));
    setRows(noted.filter(l => byId.has(l.target_id)).map(l => {
      const t = byId.get(l.target_id)!;
      return {
        txId: l.target_id,
        userId: t.user_id,
        member: who.get(t.user_id) || "member",
        note: l.meta.customer_note,
        at: l.created_at,
        amount: t.amount,
        currency: t.currency,
        recipient: t.recipient_name || t.recipient_email,
        status: t.status,
      };
    }));
    setLoading(false);
  };
  useEffect(() => { void load(); void loadExempt(); }, []);
  useEffect(() => { if (flagOpen) { setFq(""); void loadMembers(); void loadExempt(); } }, [flagOpen]);
  useEffect(() => { if (open) { setPicked(undefined); setQ(""); void load(); } }, [open]);

  const needle = q.trim().toLowerCase();
  const reviewRows = rows.filter(r => !exempt.has(r.userId));
  const shown = needle
    ? reviewRows.filter(r => r.member.toLowerCase().includes(needle) || r.note.toLowerCase().includes(needle) || (r.recipient || "").toLowerCase().includes(needle))
    : reviewRows;
  const fneedle = fq.trim().toLowerCase();
  const shownMembers = fneedle ? members.filter(m => m.name.toLowerCase().includes(fneedle) || (m.email || "").toLowerCase().includes(fneedle)) : members;
  const pickedRow = rows.find(r => r.txId === picked);

  return <>
    <Card>
      <CardContent className="p-3 md:p-4 space-y-2">
        <p className="text-[10px] md:text-xs uppercase text-muted-foreground">Transfer notes</p>
        <p className="text-lg md:text-2xl font-bold text-secondary">{loading ? "…" : reviewRows.length}</p>
        <Button size="sm" variant="outline" className="w-full" onClick={() => setOpen(true)}>
          <MessageSquareWarning className="h-4 w-4 mr-1" /> Review
        </Button>
        <Button size="sm" variant="ghost" className="w-full" onClick={() => setFlagOpen(true)}>
          <Flag className="h-4 w-4 mr-1" /> Flag members
        </Button>
      </CardContent>
    </Card>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle>Transfer notes · all members</DialogTitle>
          <DialogDescription>Notes members wrote when confirming transfers. Pick one to flag, approve or deny it.</DialogDescription>
        </DialogHeader>
        <Input placeholder="Search member, note or recipient" value={q} onChange={e => setQ(e.target.value)} />
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : shown.length === 0 ? <p className="text-sm text-muted-foreground">No transfer notes found.</p> :
          <ul className="space-y-2">{shown.map(r => {
            const risky = RISKY.test(r.note);
            return <li key={r.txId + r.at}>
              <button type="button" onClick={() => setPicked(r.txId)} className={`w-full text-left rounded-lg border p-3 min-w-0 ${picked === r.txId ? "border-primary bg-muted" : "border-border"}`}>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold text-secondary">{r.member}</span>
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
        {pickedRow && <AdminDecisionPanel userId={pickedRow.userId} transactionId={pickedRow.txId} onDecided={load} />}
      </DialogContent>
    </Dialog>
    <Dialog open={flagOpen} onOpenChange={setFlagOpen}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle>Flag members for note review</DialogTitle>
          <DialogDescription>Flagged members' transfer notes show in Review. Unflagged members' notes no longer need review.</DialogDescription>
        </DialogHeader>
        <Input placeholder="Search member" value={fq} onChange={e => setFq(e.target.value)} />
        <ul className="space-y-2">{shownMembers.map(m => {
          const flagged = !exempt.has(m.id);
          return <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2 min-w-0">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-secondary truncate">{m.name}</p>
              {m.email && <p className="text-xs text-muted-foreground truncate">{m.email}</p>}
            </div>
            <Button size="sm" variant={flagged ? "destructive" : "outline"} onClick={() => toggle(m.id)}>
              {flagged ? "Flagged · Unflag" : "Unflagged · Flag"}
            </Button>
          </li>;
        })}</ul>
      </DialogContent>
    </Dialog>
  </>;
}
