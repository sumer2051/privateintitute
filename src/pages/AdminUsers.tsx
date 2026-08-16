import { useEffect, useMemo, useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ShieldAlert, Users, Search, DollarSign, ShieldCheck, ShieldOff, Wallet, CreditCard, PiggyBank, Monitor, Smartphone, Lock, Unlock, LogOut, MapPin, Palette } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AdminDeviceDetailDialog, type AdminDevice } from "@/components/AdminDeviceDetailDialog";
import { formatIn, formatAbsIn, currencyInfo } from "@/lib/fx";

type Profile = { id: string; email: string; full_name: string | null; phone: string | null; created_at: string; device_limit?: number | null; ui_theme?: string | null; preferred_currency?: string | null };
type Account = { id: string; user_id: string; account_type: string; account_name: string; account_number: string; balance: number; available_balance: number; credit_limit: number | null; is_frozen?: boolean };
type Role = { user_id: string; role: "admin" | "support" | "tx_support" | "user" };
type Tx = { id: string; user_id: string; account_id: string; description: string | null; category: string | null; amount: number; status: string; created_at: string; reference_number: string | null; currency?: string | null };
type Device = AdminDevice;
type PastDevice = { device_id: string; label: string | null; platform: string | null; user_agent: string | null; location_label: string | null; created_at: string };

const TX_STATUSES = ["pending", "processing", "under_review", "reviewed", "completed", "failed", "cancelled"] as const;
const STATUS_LABEL: Record<string,string> = {
  pending: "Pending",
  processing: "Processing",
  under_review: "Under review",
  reviewed: "Reviewed · clearance ongoing",
  completed: "Successful",
  failed: "Failed",
  cancelled: "Cancelled",
};
const STATUS_COLOR: Record<string,string> = {
  pending: "bg-amber-100 text-amber-800",
  processing: "bg-blue-100 text-blue-800",
  under_review: "bg-purple-100 text-purple-800",
  reviewed: "bg-cyan-100 text-cyan-800",
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
  const [userDevices, setUserDevices] = useState<Device[]>([]);
  const [deviceBusy, setDeviceBusy] = useState<string | null>(null);
  const [deviceDetail, setDeviceDetail] = useState<Device | null>(null);
  const [pastDevices, setPastDevices] = useState<PastDevice[]>([]);
  const [limitValue, setLimitValue] = useState("");
  const [limitBusy, setLimitBusy] = useState(false);
  const [txBusy, setTxBusy] = useState<string | null>(null);
  const [depositAccount, setDepositAccount] = useState<Account | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositReason, setDepositReason] = useState("");
  const [depositType, setDepositType] = useState<string>("ACH");
  const [depositSource, setDepositSource] = useState("");
  const [quickDepositOpen, setQuickDepositOpen] = useState(false);
  const [quickDepositUserId, setQuickDepositUserId] = useState<string>("");
  const [quickDepositAccountId, setQuickDepositAccountId] = useState<string>("");
  const [themeBusy, setThemeBusy] = useState(false);

  const setAllTheme = async (theme: "luxe" | "classic" | "chime") => {
    setThemeBusy(true);
    const { data, error } = await supabase.rpc("admin_set_all_ui_theme", { p_theme: theme } as any);
    setThemeBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${theme === "luxe" ? "Premium" : theme === "chime" ? "Chime" : "Classic"} style applied to ${data ?? 0} user(s)`);
    load();
  };

  const setUserTheme = async (userId: string, theme: "luxe" | "classic" | "chime") => {
    setThemeBusy(true);
    const { error } = await supabase.rpc("admin_set_user_ui_theme", { p_user: userId, p_theme: theme } as any);
    setThemeBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Style updated to ${theme === "luxe" ? "Premium" : theme === "chime" ? "Chime" : "Classic"}`);
    setSelected(prev => (prev && prev.id === userId ? { ...prev, ui_theme: theme } : prev));
    load();
  };

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
      supabase.from("profiles").select("id,email,full_name,phone,created_at,device_limit,ui_theme,preferred_currency").order("created_at", { ascending: false }),
      supabase.from("accounts").select("id,user_id,account_type,account_name,account_number,balance,available_balance,credit_limit,is_frozen"),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    setProfiles((p as Profile[]) || []);
    setAccounts((a as Account[]) || []);
    setRoles((r as Role[]) || []);
  };

  useEffect(() => { if (allowed) load(); }, [allowed]);

  useEffect(() => {
    if (!selected) { setUserTx([]); setUserDevices([]); setPastDevices([]); return; }
    setLimitValue(String(selected.device_limit ?? 5));
    (async () => {
      const [{ data: tx }, { data: dv }] = await Promise.all([
        supabase
          .from("transactions")
          .select("id,user_id,account_id,description,category,amount,status,created_at,reference_number,currency")
          .eq("user_id", selected.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("user_devices")
          .select("id,user_id,device_id,label,user_agent,platform,ip,last_seen,first_seen,is_blocked,is_revoked,lat,lng,location_label,can_transfer,can_deposit,view_only,admin_notes")
          .eq("user_id", selected.id)
          .order("last_seen", { ascending: false }),
      ]);
      setUserTx((tx as Tx[]) || []);
      const devices = (dv as Device[]) || [];
      setUserDevices(devices);
      const { data: ev } = await supabase
        .from("device_login_events")
        .select("device_id,label,platform,user_agent,location_label,created_at")
        .eq("user_id", selected.id)
        .order("created_at", { ascending: false })
        .limit(200);
      const known = new Set(devices.map(d => d.device_id));
      const seen = new Set<string>();
      const past: PastDevice[] = [];
      for (const e of ((ev as PastDevice[]) || [])) {
        if (known.has(e.device_id) || seen.has(e.device_id)) continue;
        seen.add(e.device_id);
        past.push(e);
      }
      setPastDevices(past);
    })();
  }, [selected]);

  const reloadDevices = async (uid: string) => {
    const { data } = await supabase
      .from("user_devices")
      .select("id,user_id,device_id,label,user_agent,platform,ip,last_seen,first_seen,is_blocked,is_revoked,lat,lng,location_label,can_transfer,can_deposit,view_only,admin_notes")
      .eq("user_id", uid)
      .order("last_seen", { ascending: false });
    setUserDevices((data as Device[]) || []);
  };

  const kickDevice = async (d: Device) => {
    if (!confirm(`Sign this device out of ${selected?.email}'s account? They will need to sign in again on that device.`)) return;
    setDeviceBusy(d.id);
    const { error } = await supabase.rpc("admin_revoke_device", { p_device: d.id });
    setDeviceBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Device kicked out");
    if (selected) reloadDevices(selected.id);
  };

  const toggleDeviceLock = async (d: Device) => {
    const lock = !d.is_blocked;
    if (lock && !confirm(`Lock this device from ever signing back into ${selected?.email}'s account?`)) return;
    setDeviceBusy(d.id);
    const { error } = await supabase.rpc("admin_set_device_blocked", { p_device: d.id, p_blocked: lock });
    setDeviceBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(lock ? "Device locked" : "Device unlocked");
    if (selected) reloadDevices(selected.id);
  };

  const saveDeviceLimit = async () => {
    if (!selected) return;
    const n = parseInt(limitValue, 10);
    if (!Number.isFinite(n) || n < 1 || n > 50) { toast.error("Device limit must be between 1 and 50"); return; }
    setLimitBusy(true);
    const { error } = await supabase.rpc("admin_set_device_limit", { p_user: selected.id, p_limit: n });
    setLimitBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Device limit set to ${n}`);
    setProfiles(prev => prev.map(p => p.id === selected.id ? { ...p, device_limit: n } : p));
    setSelected(prev => prev ? { ...prev, device_limit: n } : prev);
  };

  const restoreDevice = async (d: Device) => {
    setDeviceBusy(d.id);
    const { error } = await supabase.rpc("admin_restore_device", { p_device: d.id });
    setDeviceBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Device access restored");
    if (selected) reloadDevices(selected.id);
  };


  const [txPending, setTxPending] = useState<{ tx: Tx; status: string } | null>(null);
  const [txNote, setTxNote] = useState("");

  const confirmTxStatus = async () => {
    if (!txPending) return;
    const { tx, status } = txPending;
    await updateTxStatus(tx, status, txNote);
    setTxPending(null);
    setTxNote("");
  };

  const updateTxStatus = async (tx: Tx, status: string, note: string) => {
    const isPendingDeposit = tx.category === "Pending Deposit";


    setTxBusy(tx.id);

    // For pending deposits moving to "completed", use the RPC that credits balance.
    if (isPendingDeposit && status === "completed") {
      const { error } = await supabase.rpc("admin_complete_pending_deposit", { p_tx: tx.id });
      if (error) { setTxBusy(null); toast.error(error.message); return; }
      supabase.functions.invoke("send-transaction-status-update", {
        body: { transactionId: tx.id, status, note: note.trim() || undefined },
      }).catch((e) => console.error("status email failed", e));
      setTxBusy(null);
      toast.success("Deposit completed · balance credited · user notified");
      if (selected) reloadUserTx(selected.id);
      load();
      return;
    }

    const { error } = await supabase.rpc("admin_update_transaction_status", { p_tx: tx.id, p_status: status });
    if (error) { setTxBusy(null); toast.error(error.message); return; }
    supabase.functions.invoke("send-transaction-status-update", {
      body: { transactionId: tx.id, status, note: note.trim() || undefined },
    }).catch((e) => console.error("status email failed", e));
    setTxBusy(null);
    toast.success(`Marked ${STATUS_LABEL[status] || status} · notifications sent`);
    setUserTx(prev => prev.map(t => t.id === tx.id ? { ...t, status } : t));
  };

  const reloadUserTx = async (uid: string) => {
    const { data } = await supabase
      .from("transactions")
      .select("id,user_id,account_id,description,category,amount,status,created_at,reference_number,currency")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(50);
    setUserTx((data as Tx[]) || []);
  };

  const buildDepositReason = (type: string, source: string, reason: string) => {
    const parts: string[] = [];
    if (type) parts.push(`[${type}]`);
    if (source.trim()) parts.push(`From ${source.trim()}`);
    if (reason.trim()) parts.push(`— ${reason.trim()}`);
    return parts.join(" ").slice(0, 240);
  };

  const submitDeposit = async () => {
    if (!depositAccount) return;
    const amt = parseFloat(depositAmount);
    if (!amt || amt <= 0 || Number.isNaN(amt)) { toast.error("Enter a positive amount"); return; }
    if (!depositReason.trim()) { toast.error("Add a reason for the deposit"); return; }
    if (!depositSource.trim()) { toast.error("Enter where the deposit is coming from"); return; }
    setBusy(true);
    const composed = buildDepositReason(depositType, depositSource, depositReason);
    const { data: newTxId, error } = await supabase.rpc("admin_post_pending_deposit", {
      p_account: depositAccount.id,
      p_amount: amt,
      p_reason: composed,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    if (newTxId) {
      supabase.functions.invoke("send-transaction-status-update", {
        body: { transactionId: newTxId, status: "pending", note: `Pending ${depositType} deposit from ${depositSource.trim()}` },
      }).catch((e) => console.error("deposit email failed", e));
    }
    toast.success("Pending deposit posted · user notified by email");
    setDepositAccount(null);
    setDepositAmount("");
    setDepositReason("");
    setDepositSource("");
    setDepositType("ACH");
    if (selected) reloadUserTx(selected.id);
  };

  const completeDeposit = async (tx: Tx) => {
    setTxBusy(tx.id);
    const { error } = await supabase.rpc("admin_complete_pending_deposit", { p_tx: tx.id });
    if (error) { setTxBusy(null); toast.error(error.message); return; }
    supabase.functions.invoke("send-transaction-status-update", {
      body: { transactionId: tx.id, status: "completed" },
    }).catch(() => {});
    setTxBusy(null);
    toast.success("Deposit completed · balance credited");
    if (selected) reloadUserTx(selected.id);
    load();
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
  /** Currency the customer transacts in — staff figures are shown in it. */
  const curOf = (uid?: string | null) =>
    (uid ? profiles.find(p => p.id === uid)?.preferred_currency : null) || "USD";

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

        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <Card><CardContent className="p-3 md:p-4"><p className="text-[10px] md:text-xs uppercase text-muted-foreground">Total users</p><p className="text-lg md:text-2xl font-bold text-secondary">{profiles.length}</p></CardContent></Card>
          <Card><CardContent className="p-3 md:p-4"><p className="text-[10px] md:text-xs uppercase text-muted-foreground">Accounts</p><p className="text-lg md:text-2xl font-bold text-secondary">{accounts.length}</p></CardContent></Card>
          <Card><CardContent className="p-3 md:p-4"><p className="text-[10px] md:text-xs uppercase text-muted-foreground">Deposits held</p><p className="text-lg md:text-2xl font-bold text-emerald-600 truncate">${totalDeposits.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</p></CardContent></Card>
          <Card><CardContent className="p-3 md:p-4"><p className="text-[10px] md:text-xs uppercase text-muted-foreground">Staff</p><p className="text-lg md:text-2xl font-bold text-secondary">{roles.filter(r=>r.role!=="user").length}</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5 text-primary" /> Interface style</CardTitle>
            <CardDescription>
              Switch every customer between the bright Chime-style look, the premium marble look, or the classic look. Changes apply live on all their devices.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <Button disabled={themeBusy} onClick={() => setAllTheme("chime")}>
                Apply Chime style to all users
              </Button>
              <Button variant="secondary" disabled={themeBusy} onClick={() => setAllTheme("luxe")}>
                Apply premium style to all users
              </Button>
              <Button variant="outline" disabled={themeBusy} onClick={() => setAllTheme("classic")}>
                Restore classic style for all users
              </Button>
            </div>
            {selected && (
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-sm">
                  Selected: <span className="font-semibold">{selected.full_name || selected.email}</span>
                  <Badge className="ml-2" variant="secondary">{selected.ui_theme === "luxe" ? "Premium" : selected.ui_theme === "chime" ? "Chime" : "Classic"}</Badge>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={themeBusy} onClick={() => setUserTheme(selected.id, "chime")}>Chime</Button>
                  <Button size="sm" variant="secondary" disabled={themeBusy} onClick={() => setUserTheme(selected.id, "luxe")}>Premium</Button>
                  <Button size="sm" variant="outline" disabled={themeBusy} onClick={() => setUserTheme(selected.id, "classic")}>Classic</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>



        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
              <CardTitle>All users</CardTitle>
              <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => { setQuickDepositOpen(true); setQuickDepositUserId(""); setQuickDepositAccountId(""); setDepositAmount(""); setDepositReason(""); setDepositSource(""); setDepositType("ACH"); }}
                >
                  <DollarSign className="h-4 w-4 mr-1" /> Post deposit
                </Button>
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Search email or name" value={q} onChange={e => setQ(e.target.value)} />
                </div>
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
                        <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2">
                          <Button size="sm" variant="outline" className="w-full md:w-auto" onClick={() => setSelected(p)}>Manage</Button>
                          <Button size="sm" variant={ur.includes("tx_support") ? "ghost" : "outline"} className="w-full md:w-auto" onClick={() => toggleRole(p.id, "tx_support", !ur.includes("tx_support"))}>
                            {ur.includes("tx_support") ? "Remove tx" : "Make tx"}
                          </Button>
                          <Button size="sm" variant={ur.includes("support") ? "ghost" : "outline"} className="w-full md:w-auto" onClick={() => toggleRole(p.id, "support", !ur.includes("support"))}>
                            {ur.includes("support") ? <><ShieldOff className="h-3.5 w-3.5 mr-1"/>Remove support</> : <><ShieldCheck className="h-3.5 w-3.5 mr-1"/>Make support</>}
                          </Button>
                          <Button size="sm" variant={ur.includes("admin") ? "ghost" : "outline"} className={`w-full md:w-auto ${ur.includes("admin") ? "text-destructive" : ""}`} onClick={() => toggleRole(p.id, "admin", !ur.includes("admin"))}>
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
          <DialogContent className="max-w-3xl w-[calc(100vw-1rem)] max-h-[92vh] overflow-y-auto p-4 md:p-6">

            <DialogHeader>
              <DialogTitle className="text-base md:text-lg break-words">{selected?.full_name || selected?.email}</DialogTitle>
              <DialogDescription className="text-xs md:text-sm break-words">
                {selected?.email}{selected?.phone ? ` · ${selected.phone}` : ""}
                {selected ? ` · figures in ${currencyInfo(curOf(selected.id)).flag} ${currencyInfo(curOf(selected.id)).code}` : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {selected && accountsFor(selected.id).map(acc => {
                const Icon = iconFor(acc.account_type);
                const cur = curOf(acc.user_id);
                return (
                  <div key={acc.id} className="border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <Icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-secondary capitalize flex items-center gap-2 flex-wrap">
                          <span className="truncate">{acc.account_name}</span> <span className="text-xs text-muted-foreground">••••{acc.account_number.slice(-4)}</span>
                          {acc.is_frozen && <Badge variant="destructive" className="text-[10px]">Frozen</Badge>}
                        </p>
                        <p className="text-xs text-muted-foreground break-words">
                          {acc.account_type === "credit"
                            ? `Used ${formatIn(cur, Number(acc.balance))} · Available ${formatIn(cur, Number(acc.available_balance))} · Limit ${formatIn(cur, Number(acc.credit_limit || 0))}`
                            : `Balance ${formatIn(cur, Number(acc.balance))}`}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => openAdjust(acc)}>
                        <DollarSign className="h-3.5 w-3.5 mr-1" /> Adjust
                      </Button>
                      {acc.account_type !== "credit" && (
                        <Button size="sm" variant="outline" className="border-emerald-400 text-emerald-700 hover:bg-emerald-50" onClick={() => { setDepositAccount(acc); setDepositAmount(""); setDepositReason(""); }}>
                          Post deposit
                        </Button>
                      )}
                      <Button size="sm" variant={acc.is_frozen ? "default" : "outline"} onClick={() => toggleFreeze(acc, !acc.is_frozen)}>
                        {acc.is_frozen ? "Unfreeze" : "Freeze"}
                      </Button>
                    </div>
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
                      <div className={`text-sm font-semibold whitespace-nowrap ${Number(tx.amount) < 0 ? "text-destructive" : "text-emerald-600"}`}>
                        {Number(tx.amount) < 0 ? "-" : "+"}{formatAbsIn(tx.currency, Number(tx.amount))}
                        <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                          {currencyInfo(tx.currency).flag} {currencyInfo(tx.currency).code}
                        </span>
                      </div>
                      <Select value={tx.status} onValueChange={(v) => { setTxNote(""); setTxPending({ tx, status: v }); }} disabled={txBusy === tx.id}>
                        <SelectTrigger className="h-8 w-full md:w-40 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TX_STATUSES.map(s => (
                            <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        disabled={txBusy === tx.id}
                        onClick={() => { setTxNote(""); setTxPending({ tx, status: tx.status }); }}
                      >
                        Resend
                      </Button>

                      {tx.category === "Pending Deposit" && tx.status !== "completed" && (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          disabled={txBusy === tx.id}
                          onClick={() => completeDeposit(tx)}
                        >
                          Complete deposit
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-secondary flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-primary" /> Signed-in devices
                </h3>
                <span className="text-xs text-muted-foreground">
                  {userDevices.length} of {selected?.device_limit ?? 5} allowed
                </span>
              </div>

              <div className="mb-3 border rounded-lg p-3 flex flex-col sm:flex-row sm:items-end gap-2">
                <div className="flex-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Device limit on this account
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={limitValue}
                    onChange={e => setLimitValue(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Maximum number of devices allowed to stay signed in. Currently using {userDevices.length}.
                  </p>
                </div>
                <Button size="sm" onClick={saveDeviceLimit} disabled={limitBusy}>
                  {limitBusy ? "Saving…" : "Save limit"}
                </Button>
              </div>

              {userDevices.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg">No devices have signed in yet.</p>
              ) : (
                <div className="space-y-2">
                  {userDevices.map(d => {
                    const Icon = /iOS|Android/i.test(d.platform || "") ? Smartphone : Monitor;
                    const lastSeen = new Date(d.last_seen);
                    const mins = Math.round((Date.now() - lastSeen.getTime()) / 60000);
                    const active = mins < 3 && !d.is_revoked && !d.is_blocked;
                    return (
                      <div
                        key={d.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setDeviceDetail(d)}
                        onKeyDown={(e) => { if (e.key === "Enter") setDeviceDetail(d); }}
                        className="border rounded-lg p-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-3 cursor-pointer transition hover:border-primary/60 hover:bg-muted/40"
                      >
                        <Icon className="h-5 w-5 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-secondary text-sm truncate">{d.label || d.platform || "Unknown device"}</span>
                            {active && <Badge className="bg-emerald-500 text-white text-[10px]">Active now</Badge>}
                            {d.is_blocked && <Badge variant="destructive" className="text-[10px]">Locked</Badge>}
                            {d.is_revoked && !d.is_blocked && <Badge variant="outline" className="text-[10px]">Kicked</Badge>}
                            {d.view_only
                              ? <Badge className="bg-amber-500 text-white text-[10px]">View only</Badge>
                              : (
                                <>
                                  {d.can_transfer === false && <Badge variant="outline" className="text-[10px]">No transfers</Badge>}
                                  {d.can_deposit === false && <Badge variant="outline" className="text-[10px]">No deposits</Badge>}
                                </>
                              )}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">{d.user_agent || "—"}</p>
                          <p className="text-[11px] text-muted-foreground">
                            Last seen {lastSeen.toLocaleString()} · First seen {new Date(d.first_seen).toLocaleDateString()}
                          </p>
                          {(d.location_label || (d.lat != null && d.lng != null)) && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${d.lat},${d.lng}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                            >
                              <MapPin className="h-3 w-3" />
                              {d.location_label || `${Number(d.lat).toFixed(2)}, ${Number(d.lng).toFixed(2)}`}
                            </a>
                          )}
                          <p className="text-[11px] text-primary mt-0.5">Tap for full details & capabilities</p>
                        </div>
                        <div className="flex gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>

                          {d.is_revoked && !d.is_blocked ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={deviceBusy === d.id}
                              onClick={() => restoreDevice(d)}
                            >
                              <Unlock className="h-3.5 w-3.5 mr-1" /> Restore
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={deviceBusy === d.id || d.is_blocked}
                              onClick={() => kickDevice(d)}
                            >
                              <LogOut className="h-3.5 w-3.5 mr-1" /> Kick out
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant={d.is_blocked ? "default" : "outline"}
                            className={d.is_blocked ? "" : "border-red-400 text-red-700 hover:bg-red-50"}
                            disabled={deviceBusy === d.id}
                            onClick={() => toggleDeviceLock(d)}
                          >
                            {d.is_blocked ? <><Unlock className="h-3.5 w-3.5 mr-1" /> Unlock</> : <><Lock className="h-3.5 w-3.5 mr-1" /> Lock</>}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {pastDevices.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Past devices ({pastDevices.length})
                  </h4>
                  <div className="space-y-1.5">
                    {pastDevices.map(p => (
                      <div key={p.device_id} className="border border-dashed rounded-lg px-3 py-2 text-[11px]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-secondary truncate">{p.label || p.platform || "Unknown device"}</span>
                          <span className="text-muted-foreground shrink-0">{new Date(p.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-muted-foreground truncate">
                          {[p.location_label, p.user_agent].filter(Boolean).join(" · ") || "No longer signed in"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
            </DialogFooter>

          </DialogContent>
        </Dialog>

        <AdminDeviceDetailDialog
          device={deviceDetail}
          userEmail={selected?.email}
          onClose={() => setDeviceDetail(null)}
          onChanged={() => { if (selected) reloadDevices(selected.id); }}
        />


        <Dialog open={!!adjustAccount} onOpenChange={(o) => !o && setAdjustAccount(null)}>
          <DialogContent className="w-[calc(100vw-1rem)] max-w-md p-4 md:p-6">
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
                {!!parseFloat(adjustAmount) && curOf(adjustAccount?.user_id) !== "USD" && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Customer sees {formatIn(curOf(adjustAccount?.user_id), parseFloat(adjustAmount))}
                  </p>
                )}
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

        <Dialog open={quickDepositOpen} onOpenChange={(o) => !o && setQuickDepositOpen(false)}>
          <DialogContent className="w-[calc(100vw-1rem)] max-w-lg max-h-[92vh] overflow-y-auto p-4 md:p-6">
            <DialogHeader>
              <DialogTitle>Post deposit to any user</DialogTitle>
              <DialogDescription>
                Choose a customer and one of their deposit accounts. It appears as a pending deposit and only credits the balance when you mark it complete.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">User</label>
                <Select value={quickDepositUserId} onValueChange={(v) => { setQuickDepositUserId(v); setQuickDepositAccountId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {profiles.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name || p.email} — {p.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account</label>
                <Select value={quickDepositAccountId} onValueChange={setQuickDepositAccountId} disabled={!quickDepositUserId}>
                  <SelectTrigger><SelectValue placeholder={quickDepositUserId ? "Select account" : "Pick a user first"} /></SelectTrigger>
                  <SelectContent>
                    {accountsFor(quickDepositUserId).filter(a => a.account_type !== "credit").map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.account_name} ••••{a.account_number.slice(-4)} · {formatIn(curOf(a.user_id), Number(a.balance))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deposit type</label>
                  <Select value={depositType} onValueChange={setDepositType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["ACH","Wire","Check","Cash","Internal Transfer","Payroll","Refund","Other"].map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount (USD)</label>
                  <Input type="number" step="0.01" min="0" placeholder="e.g. 1500" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
                  {!!parseFloat(depositAmount) && curOf(quickDepositUserId) !== "USD" && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Customer sees {formatIn(curOf(quickDepositUserId), parseFloat(depositAmount))}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Coming from</label>
                <Input placeholder="e.g. Chase Bank · Payroll · John Smith" value={depositSource} onChange={e => setDepositSource(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reason / description (shown to user)</label>
                <Input placeholder="e.g. Incoming wire — pending compliance review" value={depositReason} onChange={e => setDepositReason(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setQuickDepositOpen(false)} disabled={busy}>Cancel</Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={busy || !quickDepositAccountId}
                onClick={async () => {
                  const amt = parseFloat(depositAmount);
                  if (!amt || amt <= 0 || Number.isNaN(amt)) { toast.error("Enter a positive amount"); return; }
                  if (!depositReason.trim()) { toast.error("Add a reason for the deposit"); return; }
                  if (!depositSource.trim()) { toast.error("Enter where the deposit is coming from"); return; }
                  setBusy(true);
                  const composed = buildDepositReason(depositType, depositSource, depositReason);
                  const { data: newTxId, error } = await supabase.rpc("admin_post_pending_deposit", {
                    p_account: quickDepositAccountId,
                    p_amount: amt,
                    p_reason: composed,
                  });
                  setBusy(false);
                  if (error) { toast.error(error.message); return; }
                  if (newTxId) {
                    supabase.functions.invoke("send-transaction-status-update", {
                      body: { transactionId: newTxId, status: "pending", note: `Pending ${depositType} deposit from ${depositSource.trim()}` },
                    }).catch((e) => console.error("deposit email failed", e));
                  }
                  toast.success("Pending deposit posted · user notified by email");
                  setQuickDepositOpen(false);
                  setDepositAmount(""); setDepositReason(""); setDepositSource(""); setDepositType("ACH");
                  load();
                }}
              >
                {busy ? "Posting..." : "Post pending deposit"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!depositAccount} onOpenChange={(o) => !o && setDepositAccount(null)}>
          <DialogContent className="w-[calc(100vw-1rem)] max-w-lg max-h-[92vh] overflow-y-auto p-4 md:p-6">
            <DialogHeader>
              <DialogTitle>Post pending deposit</DialogTitle>
              <DialogDescription>
                {depositAccount?.account_name} ••••{depositAccount?.account_number.slice(-4)}. The user will see a pending notification and receive an email. Balance is credited only when you mark it complete.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deposit type</label>
                  <Select value={depositType} onValueChange={setDepositType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["ACH","Wire","Check","Cash","Internal Transfer","Payroll","Refund","Other"].map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount (USD)</label>
                  <Input type="number" step="0.01" min="0" placeholder="e.g. 1500" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
                  {!!parseFloat(depositAmount) && curOf(depositAccount?.user_id) !== "USD" && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Customer sees {formatIn(curOf(depositAccount?.user_id), parseFloat(depositAmount))}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Coming from</label>
                <Input placeholder="e.g. Chase Bank · Payroll · John Smith" value={depositSource} onChange={e => setDepositSource(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reason / description (shown to user)</label>
                <Input placeholder="e.g. Incoming wire — pending compliance review" value={depositReason} onChange={e => setDepositReason(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDepositAccount(null)} disabled={busy}>Cancel</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={submitDeposit} disabled={busy}>
                {busy ? "Posting..." : "Post pending deposit"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!txPending} onOpenChange={(v) => { if (!v) { setTxPending(null); setTxNote(""); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Move to “{txPending ? (STATUS_LABEL[txPending.status] || txPending.status) : ""}”</DialogTitle>
              <DialogDescription>Optional note for the customer — included in the email notification.</DialogDescription>
            </DialogHeader>
            <Input placeholder="Optional note to the customer" value={txNote} onChange={e => setTxNote(e.target.value)} />
            <DialogFooter>
              <Button variant="outline" onClick={() => { setTxPending(null); setTxNote(""); }} disabled={!!txBusy}>Cancel</Button>
              <Button onClick={confirmTxStatus} disabled={!!txBusy}>{txBusy ? "Updating..." : "Confirm"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

    </AuthLayout>
  );
}
