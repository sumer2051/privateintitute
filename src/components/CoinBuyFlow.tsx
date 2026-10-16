import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { COINS, fmtUnits, fmtUsd, rateOf, type CoinSymbol } from "@/lib/coins";

type Account = { id: string; account_name: string; account_number: string; account_type: string; available_balance: number };

export function CoinBuyFlow({ rates, onClose, onDone }: { rates: Record<string, number>; onClose: () => void; onDone: () => void }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [acct, setAcct] = useState("");
  const [sym, setSym] = useState<CoinSymbol>("BTC");
  const [usd, setUsd] = useState("");
  const [step, setStep] = useState<"form" | "review" | "done">("form");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [got, setGot] = useState(0);
  const [mailNote, setMailNote] = useState("");

  useEffect(() => {
    void supabase.from("accounts").select("id, account_name, account_number, account_type, available_balance").eq("is_active", true).eq("is_frozen", false).then(({ data }) => {
      const list = (data ?? []) as Account[];
      setAccounts(list);
      if (list[0]) setAcct(list[0].id);
    });
  }, []);

  const price = rateOf(sym, rates);
  const amount = Number(usd);
  const quote = price && amount > 0 ? Math.trunc((amount / price) * 1e8) / 1e8 : 0;
  const account = accounts.find((a) => a.id === acct);
  const valid = !!account && amount >= 1 && amount <= 100000 && /^\d+(\.\d{1,2})?$/.test(usd) && quote > 0 && amount <= Number(account.available_balance);

  const confirm = async () => {
    setBusy(true); setErr("");
    const { data, error } = await supabase.rpc("buy_coins", { p_account: acct, p_symbol: sym, p_usd: amount, p_min_out: Math.trunc(quote * 0.98 * 1e8) / 1e8 });
    if (error) { setBusy(false); setErr(error.message); return; }
    setGot(Number(data));
    const { data: latest } = await supabase.from("coin_transfers").select("id").eq("kind", "buy").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (latest?.id) {
      const { error: mErr } = await supabase.functions.invoke("notify-coin-transfer", { body: { transfer_id: latest.id } });
      setMailNote(mErr ? "Coins added, but the email receipt could not be sent." : "A purchase receipt was emailed to you.");
    }
    setBusy(false); setStep("done"); onDone();
  };

  return (
    <section className="investment-action-sheet mt-6" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="text-lg font-semibold">Buy coins</h2><p className="mt-1 text-xs text-muted-foreground">Pay from your bank account at the live price. No fee.</p></div>
        <Button size="icon" variant="ghost" className="investment-icon-button" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></Button>
      </div>

      {step === "form" && <div className="mt-4 space-y-3">
        <label className="block text-xs text-muted-foreground">Coin
          <select className="investment-input mt-1 w-full" value={sym} onChange={(e) => setSym(e.target.value as CoinSymbol)}>
            {COINS.map((c) => <option key={c.symbol} value={c.symbol}>{c.name} ({c.symbol})</option>)}
          </select>
        </label>
        <label className="block text-xs text-muted-foreground">Pay from
          <select className="investment-input mt-1 w-full" value={acct} onChange={(e) => setAcct(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.account_name} ••{a.account_number.slice(-4)} · {fmtUsd(Number(a.available_balance))} available</option>)}
          </select>
        </label>
        <label className="block text-xs text-muted-foreground">Amount (USD)
          <input className="investment-input mt-1 w-full tabular-nums" inputMode="decimal" placeholder="0.00" value={usd} onChange={(e) => setUsd(e.target.value.replace(/[^0-9.]/g, ""))} />
        </label>
        <p className="text-sm">{price ? <>You get ≈ <strong className="font-mono">{fmtUnits(quote)} {sym}</strong> <span className="text-xs text-muted-foreground">· 1 {sym} = {fmtUsd(price)}</span></> : "Loading price…"}</p>
        {account && amount > Number(account.available_balance) && <p className="text-xs text-destructive">Not enough available in this account.</p>}
        <Button className="investment-primary w-full" disabled={!valid} onClick={() => setStep("review")}>Review purchase</Button>
      </div>}

      {step === "review" && account && <div className="mt-4 space-y-2 text-sm">
        {[["You pay", fmtUsd(amount)], ["From", `${account.account_name} ••${account.account_number.slice(-4)}`], ["You get", `${fmtUnits(quote)} ${sym}`], ["Price", `1 ${sym} = ${fmtUsd(price ?? 0)}`], ["Fee", "Free"]].map(([k, v]) => <div key={k} className="flex justify-between gap-3"><span className="text-muted-foreground">{k}</span><span className="text-right font-medium">{v}</span></div>)}
        {err && <p role="alert" className="text-xs text-destructive">{err}</p>}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button variant="outline" className="investment-secondary" onClick={() => setStep("form")} disabled={busy}>Back</Button>
          <Button className="investment-primary" onClick={() => void confirm()} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm buy"}</Button>
        </div>
      </div>}

      {step === "done" && <div className="mt-4 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
        <p className="mt-2 text-lg font-semibold">+{fmtUnits(got)} {sym}</p>
        <p className="text-xs text-muted-foreground">Paid {fmtUsd(amount)} from {account?.account_name}. {mailNote}</p>
        <Button className="investment-primary mt-4 w-full" onClick={onClose}>Done</Button>
      </div>}
    </section>
  );
}
