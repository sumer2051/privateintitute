import { useEffect, useState } from "react";
import { Smartphone, Lock, Snowflake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { currencyInfo, formatAbsIn } from "@/lib/fx";

type Member = { id: string; full_name: string | null; email: string; preferred_currency?: string | null; ui_theme?: string | null };
type Acct = { id: string; account_name: string; account_number: string; account_type: string; balance: number; available_balance: number; is_frozen: boolean | null; is_active: boolean | null };
type Tx = { id: string; description: string; amount: number; status: string | null; currency: string; transaction_type: string; created_at: string };
type Notice = { id: string; title: string; body: string };
type Dev = { id: string; label: string | null; platform: string | null; is_blocked: boolean; is_revoked: boolean; view_only: boolean; can_transfer: boolean; last_seen: string };

/** Read-only phone-sized view of what a member sees, built from admin-readable data. Never signs in as the member. */
export function AdminMemberPhonePreview({ member }: { member: Member }) {
  const [open, setOpen] = useState(false);
  const [accts, setAccts] = useState<Acct[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [devices, setDevices] = useState<Dev[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void Promise.all([
      supabase.from("accounts").select("id,account_name,account_number,account_type,balance,available_balance,is_frozen,is_active").eq("user_id", member.id),
      supabase.from("transactions").select("id,description,amount,status,currency,transaction_type,created_at").eq("user_id", member.id).order("created_at", { ascending: false }).limit(15),
      supabase.from("announcements").select("id,title,body,target_user_id").eq("active", true).or(`target_user_id.is.null,target_user_id.eq.${member.id}`).limit(5),
      supabase.from("user_devices").select("id,label,platform,is_blocked,is_revoked,view_only,can_transfer,last_seen").eq("user_id", member.id).order("last_seen", { ascending: false }).limit(5),
    ]).then(([a, t, n, d]) => {
      setAccts((a.data as Acct[]) || []); setTxs((t.data as Tx[]) || []); setNotices((n.data as Notice[]) || []); setDevices((d.data as Dev[]) || []);
      setLoading(false);
    });
  }, [open, member.id]);
  const cur = currencyInfo(member.preferred_currency || "USD");
  const money = (usd: number, code = cur.code) => formatAbsIn(code, Number(usd));
  const issues = [
    ...accts.filter(a => a.is_frozen).map(a => `${a.account_name} is frozen`),
    ...accts.filter(a => a.is_active === false).map(a => `${a.account_name} is inactive`),
    ...devices.filter(d => d.is_blocked || d.is_revoked).map(d => `Device ${d.label || d.platform || ""} is ${d.is_blocked ? "blocked" : "signed out"}`),
    ...devices.filter(d => d.view_only || !d.can_transfer).map(d => `Device ${d.label || d.platform || ""} can't send transfers`),
    ...txs.filter(t => ["pending", "under_review", "compliance_hold"].includes(t.status || "")).map(t => `“${t.description}” is ${t.status?.replace("_", " ")}`),
  ];
  return <>
    <Button size="sm" variant="outline" className="w-full md:w-auto" onClick={() => setOpen(true)}><Smartphone className="mr-1 h-4 w-4" />View as member</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-md max-h-[95dvh] overflow-y-auto p-4">
        <DialogHeader>
          <DialogTitle>Member's phone view</DialogTitle>
          <DialogDescription>Read-only preview of what {member.full_name || member.email} sees. Nothing here can be changed.</DialogDescription>
        </DialogHeader>
        <div className="mx-auto w-full max-w-[360px] rounded-[2.5rem] border-[10px] border-foreground bg-background shadow-xl overflow-hidden">
          <div className="mx-auto mt-2 h-5 w-24 rounded-full bg-foreground" aria-hidden />
          <div className="h-[600px] overflow-y-auto px-4 py-4 space-y-4 text-foreground">
            <p className="text-sm text-muted-foreground">Hello, <span className="font-semibold text-foreground">{member.full_name || member.email}</span></p>
            {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : <>
              {notices.map(n => <div key={n.id} className="rounded-lg bg-muted p-3 text-sm"><p className="font-semibold">{n.title}</p><p className="text-muted-foreground line-clamp-2">{n.body}</p></div>)}
              {accts.length === 0 && <p className="text-sm text-muted-foreground">No accounts.</p>}
              {accts.map(a => <div key={a.id} className="rounded-xl bg-primary p-4 text-primary-foreground">
                <p className="flex items-center gap-1 text-xs opacity-90">{a.account_name} ••{a.account_number.slice(-4)} {a.is_frozen && <Snowflake className="h-3 w-3" />}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{money(Number(a.balance))}</p>
                <p className="text-xs opacity-90">Available {money(Number(a.available_balance))}</p>
              </div>)}
              <div><p className="mb-2 text-sm font-semibold">Recent activity</p>
                {txs.length === 0 && <p className="text-sm text-muted-foreground">No transactions.</p>}
                <ul className="divide-y divide-border">{txs.map(t => { const c = currencyInfo(t.currency || "USD"); return <li key={t.id} className="flex justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0"><span className="block truncate">{t.description}</span><span className="text-xs text-muted-foreground capitalize">{(t.status || "completed").replace("_", " ")} · {new Date(t.created_at).toLocaleDateString()}</span></span>
                  <span className={`shrink-0 tabular-nums ${t.transaction_type === "debit" ? "text-destructive" : "text-success"}`}>{t.transaction_type === "debit" ? "-" : "+"}{money(Number(t.amount), c.code)}</span>
                </li>; })}</ul>
              </div>
            </>}
          </div>
        </div>
        <section className="space-y-1">
          <h4 className="flex items-center gap-1 text-sm font-semibold"><Lock className="h-4 w-4" />Possible issues</h4>
          {loading ? null : issues.length === 0 ? <p className="text-sm text-muted-foreground">Nothing blocking this member.</p> :
            <ul className="list-disc pl-5 text-sm">{issues.map((i, k) => <li key={k}>{i}</li>)}</ul>}
        </section>
      </DialogContent>
    </Dialog>
  </>;
}
