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
type Role = { user_id: string; role: "admin" | "support" | "user" };

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

  const toggleRole = async (uid: string, role: "admin" | "support", enable: boolean) => {
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
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Joined {new Date(p.created_at).toLocaleDateString()} · {accs.length} account{accs.length===1?"":"s"}
                          </p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Button size="sm" variant="outline" onClick={() => setSelected(p)}>Manage</Button>
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
          <DialogContent className="max-w-2xl">
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
