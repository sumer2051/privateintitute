import { useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Check, Coins, Copy, Loader2, Plus } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CoinSendFlow } from "@/components/CoinSendFlow";

type Activity = { id: string; amount: number; symbol?: string; note: string | null; kind: string; created_at: string; direction: string; counterparty: string };
export type Panel = "send" | "receive" | "issue" | null;

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });

export function CoinWallet({ panel: extPanel, onPanelChange }: { panel?: Panel; onPanelChange?: (p: Panel) => void } = {}) {
  const { toast } = useToast();
  const [balance, setBalance] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [copied, setCopied] = useState(false);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [ownPanel, setOwnPanel] = useState<Panel>(null);
  const panel = extPanel !== undefined ? extPanel : ownPanel;
  const setPanel = (p: Panel) => { setOwnPanel(p); onPanelChange?.(p); };
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setEmail(u.user.email ?? "");
    const { data: addr } = await supabase.rpc("my_coin_address");
    if (addr) setAddress(addr as string);
    const [{ data: b }, { data: a }] = await Promise.all([
      supabase.from("coin_balances").select("units").eq("user_id", u.user.id).maybeSingle(),
      supabase.rpc("coin_activity_all"),
    ]);
    setBalance(Number(b?.units ?? 0));
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
    if (!/^\d+(\.\d{1,8})?$/.test(amount.trim()) || !Number.isFinite(n) || n < 0.00000001) return setErr("Enter an amount with up to 8 decimals");
    setBusy(true);
    const res = panel === "issue"
      ? await supabase.rpc("admin_issue_coins", { p_amount: n })
      : await supabase.rpc("send_coins", { p_recipient_email: to.trim(), p_amount: n, p_note: note.trim() || null });
    setBusy(false);
    if (res.error) return setErr(res.error.message);
    if (panel === "send") {
      const { data: latest } = await supabase.rpc("coin_activity_all");
      const t = (latest as Activity[] | null)?.find((x) => x.direction === "out" && x.kind === "transfer");
      if (t) supabase.functions.invoke("notify-coin-transfer", { body: { transfer_id: t.id } }).then(({ error }) => { if (error) toast({ title: "Coins sent, but the email didn't go out", variant: "destructive" }); });
    }
    toast({ title: panel === "issue" ? "Coins added" : "Coins sent", description: panel === "send" ? `${fmt(n)} BOA · email receipts on the way` : `${fmt(n)} BOA` });
    setTo(""); setAmount(""); setNote(""); setPanel(null);
    void load();
  };

  return (
    <section id="boa-coin" className="investment-notice mt-6 block" aria-label="BoA Coin">
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

      {panel === "receive" && (
        <div className="mt-4 flex flex-col items-center gap-3 text-center">
          <div className="rounded-xl border border-border bg-background p-3">{address ? <QRCodeSVG value={address} size={168} fgColor="hsl(0 0% 10%)" bgColor="transparent" /> : <Loader2 className="h-6 w-6 animate-spin" />}</div>
          <p className="text-xs text-muted-foreground">Your BoA Coin address</p>
          <p className="break-all font-mono text-sm">{address}</p>
          <Button variant="outline" className="investment-secondary" disabled={!address} onClick={async () => { try { await navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* address is visible */ } }}>{copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}{copied ? "Copied" : "Copy address"}</Button>
          <p className="text-xs text-muted-foreground">Members can also send to {email}</p>
        </div>
      )}
      {panel === "send" && (
        <CoinSendFlow
          balances={{ ...tokens, BOA: balance ?? 0 }}
          fromName={email}
          recents={[...new Set(activity.filter((a) => a.direction === "out").map((a) => a.counterparty))].slice(0, 5)}
          onClose={() => setPanel(null)}
          onSend={async (sym, rcpt, n, nt) => {
            const res = await supabase.rpc("send_tokens", { p_symbol: sym, p_recipient: rcpt, p_amount: n, p_note: nt || null });
            if (res.error) return res.error.message;
            const { data: latest } = await supabase.rpc("coin_activity_all");
            const t = (latest as Activity[] | null)?.find((x) => x.direction === "out" && x.kind === "transfer");
            if (t) supabase.functions.invoke("notify-coin-transfer", { body: { transfer_id: t.id } }).then(({ error }) => { if (error) toast({ title: "Coins sent, but the email didn't go out", variant: "destructive" }); });
            toast({ title: "Coins sent", description: `${fmt(n)} ${sym} · email receipts on the way` });
            setPanel(null); void load(); void reloadTokens();
            return null;
          }}
        />
      )}
      {panel === "issue" && (
        <form className="mt-4 space-y-2" onSubmit={submit}>
          <input className="investment-input w-full text-sm" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (up to 8 decimals, e.g. 0.00012500)" />
          <Button type="submit" className="investment-primary w-full" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add coins"}</Button>
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
              <span className={`shrink-0 font-mono ${a.direction === "out" ? "text-destructive" : "text-[hsl(var(--wallet-status))]"}`}>{a.direction === "out" ? "-" : "+"}{fmt(Number(a.amount))} {a.symbol ?? "BOA"}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
