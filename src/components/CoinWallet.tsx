import { useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Coins, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Activity = { id: string; amount: number; note: string | null; kind: string; created_at: string; direction: string; counterparty: string };
type Panel = "send" | "receive" | "issue" | null;

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function CoinWallet() {
  const { toast } = useToast();
  const [balance, setBalance] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [activity, setActivity] = useState<Activity[]>([]);
  const [panel, setPanel] = useState<Panel>(null);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setEmail(u.user.email ?? "");
    const [{ data: b }, { data: a }] = await Promise.all([
      supabase.from("coin_balances").select("balance").eq("user_id", u.user.id).maybeSingle(),
      supabase.rpc("coin_activity"),
    ]);
    setBalance(Number(b?.balance ?? 0));
    setActivity((a as Activity[]) ?? []);
  }, []);

  useEffect(() => {
    void load();
    const ch = supabase.channel("coin-transfers").on("postgres_changes", { event: "INSERT", schema: "public", table: "coin_transfers" }, () => void load()).subscribe();
    const t = setInterval(load, 15000);
    return () => { clearInterval(t); void supabase.removeChannel(ch); };
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return setErr("Enter a valid amount");
    setBusy(true);
    const res = panel === "issue"
      ? await supabase.rpc("admin_issue_coins", { p_amount: n })
      : await supabase.rpc("send_coins", { p_recipient_email: to.trim(), p_amount: n, p_note: note.trim() || null });
    setBusy(false);
    if (res.error) return setErr(res.error.message);
    toast({ title: panel === "issue" ? "Coins added" : "Coins sent", description: `${fmt(n)} BoA Coin` });
    setTo(""); setAmount(""); setNote(""); setPanel(null);
    void load();
  };

  return (
    <section className="investment-notice mt-6 block" aria-label="BoA Coin">
      <div className="flex items-center gap-3">
        <span className="investment-notice-icon"><Coins className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">BoA Coin balance</p>
          <p className="text-2xl font-semibold tabular-nums">{balance === null ? "…" : fmt(balance)} <span className="text-sm text-muted-foreground">BOA</span></p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Button className="investment-primary" onClick={() => setPanel(panel === "send" ? null : "send")}><ArrowUpRight className="mr-1 h-4 w-4" />Send</Button>
        <Button variant="outline" className="investment-secondary" onClick={() => setPanel(panel === "receive" ? null : "receive")}><ArrowDownLeft className="mr-1 h-4 w-4" />Receive</Button>
        <Button variant="outline" className="investment-secondary" onClick={() => setPanel(panel === "issue" ? null : "issue")}><Plus className="mr-1 h-4 w-4" />Add</Button>
      </div>

      {panel === "receive" && <p className="mt-4 text-sm">Members send coins to your email: <strong className="break-all">{email}</strong></p>}
      {(panel === "send" || panel === "issue") && (
        <form className="mt-4 space-y-2" onSubmit={submit}>
          {panel === "send" && <input className="investment-input w-full text-sm" type="email" required value={to} onChange={(e) => setTo(e.target.value)} placeholder="Recipient's email" maxLength={255} />}
          <input className="investment-input w-full text-sm" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" />
          {panel === "send" && <input className="investment-input w-full text-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" maxLength={140} />}
          <Button type="submit" className="investment-primary w-full" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : panel === "issue" ? "Add coins" : "Send coins"}</Button>
        </form>
      )}
      {err && <p role="alert" className="mt-2 text-sm text-destructive">{err}</p>}

      <h3 className="mt-5 text-sm font-semibold">Coin activity</h3>
      {activity.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">No coin activity yet.</p> : (
        <ul className="mt-2 divide-y divide-border">
          {activity.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{a.direction === "out" ? `To ${a.counterparty}` : `From ${a.counterparty}`}</p>
                <p className="truncate text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}{a.note ? ` · ${a.note}` : ""}</p>
              </div>
              <span className={`shrink-0 font-mono ${a.direction === "out" ? "text-destructive" : "text-[hsl(var(--wallet-status))]"}`}>{a.direction === "out" ? "-" : "+"}{fmt(Number(a.amount))}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
