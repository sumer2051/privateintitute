import { useEffect, useMemo, useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ShieldAlert, Users, Search, DollarSign, ShieldCheck, ShieldOff, Wallet, CreditCard, PiggyBank } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Profile = { id: string; email: string; full_name: string | null; phone: string | null; created_at: string };
type Account = { id: string; user_id: string; account_type: string; account_name: string; account_number: string; balance: number; available_balance: number; credit_limit: number | null };
type Role = { user_id: string; role: "admin" | "support" | "tx_support" | "user" };
type Tx = { id: string; user_id: string; account_id: string; description: string | null; category: string | null; amount: number; status: string; created_at: string; reference_number: string | null };

const TX_STATUSES = ["pending", "processing", "under_review", "completed", "failed", "cancelled"] as const;
const STATUS_LABEL: Record<string,string> = {
  pending: "Pending",
  processing: "Processing",
  under_review: "Under review",
  completed: "Successful",
  failed: "Failed",
  cancelled: "Cancelled",
};
const STATUS_COLOR: Record<string,string> = {
  pending: "bg-amber-100 text-amber-800",
  processing: "bg-blue-100 text-blue-800",
  under_review: "bg-purple-100 text-purple-800",
  completed: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
  cancelled: "bg-muted text-muted-foreground",
};

export default function AdminUsers() {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Profile | null>(null);
  const [adjustAccount, setAdjustAccount] = useState<Account | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [userTx, setUserTx] = useState<Tx[]>([]);
  const [txBusy, setTxBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      setAllowed(((data as any[]) || []).some(r => r.role === "admin"));
    })();
  }, [navigate]);

  const load = async () => {
    const [{ data: p }, { data: a }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("id,email,full_name,phone,created_at").order("created_at", { ascending: false }),
      supabase.from("accounts").select("id,user_id,account_type,account_name,account_number,balance,available_balance,credit_limit"),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    setProfiles((p as Profile[]) || []);
    setAccounts((a as Account[]) || []);
    setRoles((r as Role[]) || []);
  };

  useEffect(() => { if (allowed) load(); }, [allowed]);

  useEffect(() => {
    if (!selected) { setUserTx([]); return; }
    (async () => {
      const { data } = await supabase
        .from("transactions")
        .select("id,user_id,account_id,description,category,amount,status,created_at,reference_number")
        .eq("user_id", selected.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setUserTx((data as Tx[]) || []);
    })();
  }, [selected]);

  const updateTxStatus = async (tx: Tx, status: string) => {
    setTxBusy(tx.id);
    const { error } = await supabase.rpc("admin_update_transaction_status", { p_tx: tx.id, p_status: status });
    if (error) { setTxBusy(null); toast.error(error.message); return; }
    supabase.functions.invoke("send-transaction-status-update", {
      body: { transactionId: tx.id, status },
    }).catch((e) => console.error("status email failed", e));
    setTxBusy(null);
    toast.success(`Marked ${STATUS_LABEL[status] || status} · notifications sent`);
    setUserTx(prev => prev.map(t => t.id === tx.id ? { ...t, status } : t));
  };

  const toggleFreeze = async (acc: Account, freeze: boolean) => {
    const { error } = await supabase.rpc("admin_set_account_frozen", { p_account: acc.id, p_frozen: freeze, p_reason: null });
    if (error) { toast.error(error.message); return; }
    toast.success(freeze ? "Account frozen" : "Account unfrozen");
    load();
  };



  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return profiles;
    return profiles.filter(p =>
      (p.email || "").toLowerCase().includes(term) ||
      (p.full_name || "").toLowerCase().includes(term)
    );
  }, [profiles, q]);

  const rolesFor = (uid: string) => roles.filter(r => r.user_id === uid).map(r => r.role);
  const accountsFor = (uid: string) => accounts.filter(a => a.user_id === uid);

  const totalDeposits = accounts
    .filter(a => a.account_type !== "credit")
    .reduce((s, a) => s + Number(a.balance || 0), 0);

  const openAdjust = (acc: Account) => {
    setAdjustAccount(acc);
    setAdjustAmount("");
    setAdjustNote("");
  };

  const submitAdjust = async () => {
    if (!adjustAccount) return;
    const delta = parseFloat(adjustAmount);
    if (!delta || Number.isNaN(delta)) { toast.error("Enter a valid amount (use negative to debit)"); return; }
    setBusy(true);
    const { error } = await supabase.rpc("admin_adjust_account_balance", {
      p_account: adjustAccount.id,
      p_delta: delta,
      p_note: adjustNote || "Admin adjustment",
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Balance updated");
    setAdjustAccount(null);
    load();
  };

  const toggleRole = async (uid: string, role: "admin" | "support" | "tx_support", enable: boolean) => {
    const fn = enable ? "admin_grant_role" : "admin_revoke_role";
    const { error } = await supabase.rpc(fn, { p_user: uid, p_role: role });
    if (error) { toast.error(error.message); return; }
    toast.success(`${enable ? "Granted" : "Revoked"} ${role}`);
    load();
  };

  if (allowed === null) {
    return (
      <AuthLayout>
        <div className="flex items-center justify-center py-32">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AuthLayout>
    );
  }
  if (!allowed) {
    return (
      <AuthLayout>
        <Card className="max-w-md mx-auto mt-16">
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-destructive" />Admin only</CardTitle></CardHeader>
          <CardContent><Button onClick={() => navigate("/accounts")}>Back</Button></CardContent>
        </Card>
      </AuthLayout>
    );
  }

  const iconFor = (t: string) => t === "credit" ? CreditCard : t === "savings" ? PiggyBank : Wallet;

  return (
    <AuthLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-secondary flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> User management
          </h1>
          <p className="text-sm text-muted-foreground">View every customer, adjust balances, and manage roles.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Total users</p><p className="text-2xl font-bold text-secondary">{profiles.length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Accounts</p><p className="text-2xl font-bold text-secondary">{accounts.length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Deposits held</p><p className="text-2xl font-bold text-emerald-600">${totalDeposits.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Staff</p><p className="text-2xl font-bold text-secondary">{roles.filter(r=>r.role!=="user").length}</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
              <CardTitle>All users</CardTitle>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search email or name" value={q} onChange={e => setQ(e.target.value)} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No users found.</p>
            ) : (
              <div className="space-y-2">
                {filtered.map(p => {
                  const ur = rolesFor(p.id);
                  const accs = accountsFor(p.id);
                  return (
                    <div key={p.id} className="border rounded-lg p-3 hover:bg-muted/40 transition">
                      <div className="flex flex-col md:flex-row md:items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-secondary truncate">{p.full_name || "—"}</span>
                            <span className="text-xs text-muted-foreground truncate">{p.email}</span>
                            {ur.includes("admin") && <Badge className="bg-primary text-primary-foreground">admin</Badge>}
                            {ur.includes("support") && <Badge variant="outline">support</Badge>}
                            {ur.includes("tx_support") && <Badge variant="outline" className="border-purple-400 text-purple-700">tx support</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Joined {new Date(p.created_at).toLocaleDateString()} · {accs.length} account{accs.length===1?"":"s"}
                          </p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Button size="sm" variant="outline" onClick={() => setSelected(p)}>Manage</Button>
                          <Button size="sm" variant={ur.includes("tx_support") ? "ghost" : "outline"} onClick={() => toggleRole(p.id, "tx_support", !ur.includes("tx_support"))}>
                            {ur.includes("tx_support") ? "Remove tx support" : "Make tx support"}
                          </Button>
                          <Button size="sm" variant={ur.includes("support") ? "ghost" : "outline"} onClick={() => toggleRole(p.id, "support", !ur.includes("support"))}>
                            {ur.includes("support") ? <><ShieldOff className="h-3.5 w-3.5 mr-1"/>Remove support</> : <><ShieldCheck className="h-3.5 w-3.5 mr-1"/>Make support</>}
                          </Button>
                          <Button size="sm" variant={ur.includes("admin") ? "ghost" : "outline"} className={ur.includes("admin") ? "text-destructive" : ""} onClick={() => toggleRole(p.id, "admin", !ur.includes("admin"))}>
                            {ur.includes("admin") ? "Revoke admin" : "Make admin"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">

            <DialogHeader>
              <DialogTitle>{selected?.full_name || selected?.email}</DialogTitle>
              <DialogDescription>{selected?.email}{selected?.phone ? ` · ${selected.phone}` : ""}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {selected && accountsFor(selected.id).map(acc => {
                const Icon = iconFor(acc.account_type);
                return (
                  <div key={acc.id} className="flex items-center gap-3 border rounded-lg p-3">
                    <Icon className="h-5 w-5 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-secondary capitalize">{acc.account_name} <span className="text-xs text-muted-foreground">••••{acc.account_number.slice(-4)}</span></p>
                      <p className="text-xs text-muted-foreground">
                        {acc.account_type === "credit"
                          ? `Used $${Number(acc.balance).toLocaleString()} · Available $${Number(acc.available_balance).toLocaleString()} · Limit $${Number(acc.credit_limit||0).toLocaleString()}`
                          : `Balance $${Number(acc.balance).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => openAdjust(acc)}>
                      <DollarSign className="h-3.5 w-3.5 mr-1" /> Adjust
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-secondary">Recent transactions</h3>
                <span className="text-xs text-muted-foreground">{userTx.length} shown</span>
              </div>
              {userTx.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg">No transactions yet.</p>
              ) : (
                <div className="space-y-2">
                  {userTx.map(tx => (
                    <div key={tx.id} className="border rounded-lg p-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-secondary text-sm truncate">{tx.description || tx.category || "Transaction"}</span>
                          <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_COLOR[tx.status] || "bg-muted"}`}>
                            {STATUS_LABEL[tx.status] || tx.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(tx.created_at).toLocaleString()} {tx.reference_number ? `· ${tx.reference_number}` : ""}
                        </p>
                      </div>
                      <div className={`text-sm font-semibold ${Number(tx.amount) < 0 ? "text-destructive" : "text-emerald-600"}`}>
                        {Number(tx.amount) < 0 ? "-" : "+"}${Math.abs(Number(tx.amount)).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}
                      </div>
                      <Select value={tx.status} onValueChange={(v) => updateTxStatus(tx, v)} disabled={txBusy === tx.id}>
                        <SelectTrigger className="h-8 w-full md:w-40 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TX_STATUSES.map(s => (
                            <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
            </DialogFooter>

          </DialogContent>
        </Dialog>

        <Dialog open={!!adjustAccount} onOpenChange={(o) => !o && setAdjustAccount(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adjust balance</DialogTitle>
              <DialogDescription>
                {adjustAccount?.account_name} ••••{adjustAccount?.account_number.slice(-4)}. Use a negative amount to debit.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount (USD)</label>
                <Input type="number" step="0.01" placeholder="e.g. 250 or -100" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Note</label>
                <Input placeholder="Reason for adjustment" value={adjustNote} onChange={e => setAdjustNote(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAdjustAccount(null)} disabled={busy}>Cancel</Button>
              <Button onClick={submitAdjust} disabled={busy}>{busy ? "Applying..." : "Apply"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AuthLayout>
  );
}
