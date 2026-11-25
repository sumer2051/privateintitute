import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, HandCoins, ShieldAlert, X } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";
import { AdminReserveSummary } from "@/components/AdminReserveSummary";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Account = { id: string; user_id: string; account_name: string; account_number: string; account_type: string; balance: number };
type Profile = { id: string; email: string | null; full_name: string | null };
type Req = { id: string; account_id: string; user_id: string; amount: number; note: string | null; status: string; created_at: string; reviewed_at: string | null };
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default function AdminAllocation() {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [requests, setRequests] = useState<Req[]>([]);
  const [search, setSearch] = useState("");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => { (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/auth"); return; }
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    setAllowed((data || []).some(r => r.role === "admin"));
  })(); }, [navigate]);

  const load = useCallback(async () => {
    const [a, p, r] = await Promise.all([
      supabase.from("accounts").select("id,user_id,account_name,account_number,account_type,balance").neq("account_type", "credit").eq("is_active", true),
      supabase.from("profiles").select("id,email,full_name"),
      supabase.from("allocation_requests").select("id,account_id,user_id,amount,note,status,created_at,reviewed_at").order("created_at", { ascending: false }).limit(200),
    ]);
    setAccounts((a.data as Account[]) || []);
    const map: Record<string, Profile> = {}; ((p.data as Profile[]) || []).forEach(x => { map[x.id] = x; }); setProfiles(map);
    setRequests((r.data as Req[]) || []);
    setRefreshKey(k => k + 1);
  }, []);
  useEffect(() => { if (allowed) void load(); }, [allowed, load]);

  const member = (id: string) => profiles[id]?.full_name || profiles[id]?.email || "Member";
  const accountLabel = (a?: Account) => a ? `${member(a.user_id)} · ${a.account_name} ••${a.account_number.slice(-4)}` : "Account";
  const options = useMemo(() => {
    const t = search.trim().toLowerCase();
    return accounts.filter(a => !t || accountLabel(a).toLowerCase().includes(t) || (profiles[a.user_id]?.email || "").toLowerCase().includes(t)).slice(0, 100);
  }, [accounts, profiles, search]);
  const pending = requests.filter(r => r.status === "pending");
  const pendingTotal = pending.reduce((s, r) => s + Number(r.amount), 0);
  const approvedTotal = requests.filter(r => r.status === "approved").reduce((s, r) => s + Number(r.amount), 0);

  const submit = async () => {
    const value = Number(amount);
    if (!accountId || !(value > 0)) { toast.error("Choose an account and enter an amount"); return; }
    setBusy("new");
    const { error } = await supabase.rpc("admin_request_allocation", { p_account: accountId, p_amount: Math.round(value * 100) / 100, p_note: note });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Request added — waiting for approval");
    setAmount(""); setNote(""); void load();
  };
  const review = async (id: string, approve: boolean) => {
    setBusy(id);
    const { error } = await supabase.rpc("admin_review_allocation", { p_request: id, p_approve: approve });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(approve ? "Approved — funds sent from reserve" : "Request rejected");
    void load();
  };

  if (allowed === null) return <AuthLayout><div className="flex justify-center py-32"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div></AuthLayout>;
  if (!allowed) return <AuthLayout><Card className="max-w-md mx-auto mt-16"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-destructive" />Admin only</CardTitle></CardHeader><CardContent><Button onClick={() => navigate("/accounts")}>Back</Button></CardContent></Card></AuthLayout>;

  const statusVariant = (s: string) => s === "approved" ? "default" : s === "rejected" ? "destructive" : "secondary";
  return <AuthLayout>
    <div className="max-w-5xl mx-auto space-y-6 min-w-0">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-secondary flex items-center gap-2"><HandCoins className="h-6 w-6 text-primary" />Internal allocation</h1>
        <p className="text-sm text-muted-foreground">Request funds for a member, then approve to send them from the internal reserve.</p>
      </div>
      <AdminReserveSummary refreshKey={refreshKey} />
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div><dt className="text-xs uppercase text-muted-foreground">Waiting for approval</dt><dd className="text-xl font-bold tabular-nums">{pending.length} · {usd.format(pendingTotal)}</dd></div>
        <div><dt className="text-xs uppercase text-muted-foreground">Sent (last 200)</dt><dd className="text-xl font-bold tabular-nums">{usd.format(approvedTotal)}</dd></div>
        <div><dt className="text-xs uppercase text-muted-foreground">Rejected</dt><dd className="text-xl font-bold tabular-nums">{requests.filter(r => r.status === "rejected").length}</dd></div>
      </dl>
      <Card>
        <CardHeader><CardTitle>New allocation</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2"><Label htmlFor="alloc-search">Find member</Label><Input id="alloc-search" placeholder="Name or email" value={search} onChange={e => setSearch(e.target.value)} /></div>
          <div className="space-y-2 md:col-span-2"><Label>Account</Label>
            <Select value={accountId} onValueChange={setAccountId}><SelectTrigger aria-label="Account"><SelectValue placeholder="Choose account" /></SelectTrigger>
              <SelectContent>{options.map(a => <SelectItem key={a.id} value={a.id}>{accountLabel(a)} · {usd.format(Number(a.balance))}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="alloc-amount">Amount (USD)</Label><Input id="alloc-amount" type="number" min="0.01" step="0.01" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="alloc-note">Note shown on the transaction</Label><Input id="alloc-note" maxLength={140} placeholder="Internal allocation" value={note} onChange={e => setNote(e.target.value)} /></div>
          <Button className="md:col-span-2" onClick={submit} disabled={busy === "new"}>Submit for approval</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Requests</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {requests.length === 0 && <p className="text-sm text-muted-foreground">No requests yet.</p>}
          {requests.map(r => <div key={r.id} className="flex flex-col sm:flex-row sm:items-center gap-3 border-b border-border pb-3 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="font-semibold tabular-nums">{usd.format(Number(r.amount))} <Badge variant={statusVariant(r.status)} className="ml-2 capitalize">{r.status}</Badge></p>
              <p className="text-sm text-muted-foreground break-words">{accountLabel(accounts.find(a => a.id === r.account_id)) === "Account" ? member(r.user_id) : accountLabel(accounts.find(a => a.id === r.account_id))}{r.note ? ` · ${r.note}` : ""}</p>
              <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
            </div>
            {r.status === "pending" && <div className="flex gap-2">
              <Button size="sm" onClick={() => review(r.id, true)} disabled={busy === r.id}><Check className="mr-1 h-4 w-4" />Approve</Button>
              <Button size="sm" variant="outline" onClick={() => review(r.id, false)} disabled={busy === r.id}><X className="mr-1 h-4 w-4" />Reject</Button>
            </div>}
          </div>)}
        </CardContent>
      </Card>
    </div>
  </AuthLayout>;
}
