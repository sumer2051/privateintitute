import { useEffect, useMemo, useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ShieldAlert, ListChecks, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Tx = {
  id: string;
  user_id: string;
  account_id: string;
  description: string | null;
  category: string | null;
  amount: number;
  status: string;
  created_at: string;
  reference_number: string | null;
};
type Profile = { id: string; email: string; full_name: string | null };

const TX_STATUSES = ["pending", "processing", "under_review", "completed", "failed", "cancelled"] as const;
const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  under_review: "Under review",
  completed: "Successful",
  failed: "Failed",
  cancelled: "Cancelled",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  processing: "bg-blue-100 text-blue-800",
  under_review: "bg-purple-100 text-purple-800",
  completed: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
  cancelled: "bg-muted text-muted-foreground",
};

export default function AdminTransactions() {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const roles = ((data as any[]) || []).map(r => r.role);
      setAllowed(roles.includes("admin") || roles.includes("tx_support"));
    })();
  }, [navigate]);

  const load = async () => {
    const { data: t } = await supabase
      .from("transactions")
      .select("id,user_id,account_id,description,category,amount,status,created_at,reference_number")
      .order("created_at", { ascending: false })
      .limit(500);
    const list = (t as Tx[]) || [];
    setTxs(list);
    const uids = Array.from(new Set(list.map(x => x.user_id)));
    if (uids.length) {
      const { data: p } = await supabase.from("profiles").select("id,email,full_name").in("id", uids);
      const map: Record<string, Profile> = {};
      ((p as Profile[]) || []).forEach(pr => { map[pr.id] = pr; });
      setProfiles(map);
    }
  };

  useEffect(() => { if (allowed) load(); }, [allowed]);

  const update = async (tx: Tx, status: string) => {
    setBusy(tx.id);
    const { error } = await supabase.rpc("admin_update_transaction_status", { p_tx: tx.id, p_status: status });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${STATUS_LABEL[status]}`);
    setTxs(prev => prev.map(t => t.id === tx.id ? { ...t, status } : t));
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return txs.filter(tx => {
      if (filterStatus !== "all" && tx.status !== filterStatus) return false;
      if (!term) return true;
      const p = profiles[tx.user_id];
      return (
        (tx.description || "").toLowerCase().includes(term) ||
        (tx.reference_number || "").toLowerCase().includes(term) ||
        (p?.email || "").toLowerCase().includes(term) ||
        (p?.full_name || "").toLowerCase().includes(term)
      );
    });
  }, [txs, q, filterStatus, profiles]);

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
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-destructive" />Staff only</CardTitle></CardHeader>
          <CardContent><Button onClick={() => navigate("/accounts")}>Back</Button></CardContent>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-secondary flex items-center gap-2">
            <ListChecks className="h-6 w-6 text-primary" /> Transaction status
          </h1>
          <p className="text-sm text-muted-foreground">Move customer transactions through the review workflow.</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
              <CardTitle>All transactions</CardTitle>
              <div className="flex gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Search customer, description, ref" value={q} onChange={e => setQ(e.target.value)} />
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {TX_STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No transactions match.</p>
            ) : (
              <div className="space-y-2">
                {filtered.map(tx => {
                  const p = profiles[tx.user_id];
                  return (
                    <div key={tx.id} className="border rounded-lg p-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-secondary text-sm truncate">{tx.description || tx.category || "Transaction"}</span>
                          <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_COLOR[tx.status] || "bg-muted"}`}>
                            {STATUS_LABEL[tx.status] || tx.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {p?.full_name || p?.email || "Customer"} · {new Date(tx.created_at).toLocaleString()}
                          {tx.reference_number ? ` · ${tx.reference_number}` : ""}
                        </p>
                      </div>
                      <Select value={tx.status} onValueChange={(v) => update(tx, v)} disabled={busy === tx.id}>
                        <SelectTrigger className="h-8 w-full md:w-44 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TX_STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AuthLayout>
  );
}
