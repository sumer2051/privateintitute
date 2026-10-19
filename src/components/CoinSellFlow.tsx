import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { COINS, fmtUnits, fmtUsd, rateOf, type CoinSymbol } from "@/lib/coins";

type Account = { id: string; account_name: string; account_number: string; account_type: string };

export function CoinSellFlow({ rates, balances, onClose, onDone }: { rates: Record<string, number>; balances: Record<string, number>; onClose: () => void; onDone: () => void }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [acct, setAcct] = useState("");
  const [sym, setSym] = useState<CoinSymbol>((COINS.find((c) => (balances[c.symbol] ?? 0) > 0)?.symbol ?? "BOA") as CoinSymbol);
  const [units, setUnits] = useState("");
  const [step, setStep] = useState<"form" | "review" | "done">("form");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [got, setGot] = useState(0);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data: u }) => supabase.from("accounts").select("id, account_name, account_number, account_type, is_active, is_frozen").eq("user_id", u.user?.id ?? "").neq("account_type", "credit").order("account_type").then(({ data }) => {
      const list = ((data ?? []) as (Account & { is_active?: boolean | null; is_frozen?: boolean })[]).filter((a) => a.is_active !== false && !a.is_frozen);
      setAccounts(list);
      const first = list.find((a) => a.account_type === "checking") ?? list[0];
      if (first) setAcct(first.id);
    }));
  }, []);

  const have = balances[sym] ?? 0;
  const price = rateOf(sym, rates);
  const amount = Number(units);
  const usd = price && amount > 0 ? Math.trunc(amount * price * 100) / 100 : 0;
  const account = accounts.find((a) => a.id === acct);
  const valid = !!account && amount > 0 && amount <= have && /^\d+(\.\d{1,8})?$/.test(units) && usd >= 0.01;

  const confirm = async () => {
    setBusy(true); setErr("");
    const { data, error } = await supabase.rpc("sell_coins", { p_account: acct, p_symbol: sym, p_units: amount, p_min_usd: Math.trunc(usd * 0.98 * 100) / 100 });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setGot(Number(data)); setStep("done"); onDone();
  };

  return (
    <section id="coin-sell" className="investment-action-sheet mt-6 scroll-mt-24" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="text-lg font-semibold">Sell coins</h2><p className="mt-1 text-xs text-muted-foreground">Get dollars in your bank account at the live price. No fee.</p></div>
        <Button size="icon" variant="ghost" className="investment-icon-button" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></Button>
      </div>
      {step === "form" && <div className="mt-4 space-y-3">
        <label className="block text-xs text-muted-foreground">Coin
          <select className="investment-input mt-1 w-full" value={sym} onChange={(e) => { setSym(e.target.value as CoinSymbol); setUnits(""); }}>
            {COINS.map((c) => <option key={c.symbol} value={c.symbol}>{c.name} · {fmtUnits(balances[c.symbol] ?? 0)} {c.symbol}</option>)}
          </select>
        </label>
        <label className="block text-xs text-muted-foreground">Amount ({sym})
          <div className="mt-1 flex gap-2"><input className="investment-input w-full tabular-nums" inputMode="decimal" placeholder="0.00" value={units} onChange={(e) => setUnits(e.target.value.replace(/[^0-9.]/g, ""))} /><Button type="button" variant="outline" className="investment-secondary" onClick={() => setUnits(String(Math.trunc(have * 1e8) / 1e8))}>Max</Button></div>
        </label>
        <label className="block text-xs text-muted-foreground">Deposit to
          <select className="investment-input mt-1 w-full" value={acct} onChange={(e) => setAcct(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.account_name} ••{a.account_number.slice(-4)}</option>)}
          </select>
        </label>
        <p className="text-sm">{price ? <>You get ≈ <strong>{fmtUsd(usd)}</strong> <span className="text-xs text-muted-foreground">· 1 {sym} = {fmtUsd(price)}</span></> : "Loading price…"}</p>
        {amount > have && <p className="text-xs text-destructive">You only have {fmtUnits(have)} {sym}.</p>}
        {err && <p role="alert" className="text-xs text-destructive">{err}</p>}
        <Button className="investment-primary w-full" disabled={!valid} onClick={() => setStep("review")}>Review sale</Button>
      </div>}
      {step === "review" && account && <div className="mt-4 space-y-2 text-sm">
        {[["You sell", `${fmtUnits(amount)} ${sym}`], ["You get", fmtUsd(usd)], ["Deposit to", `${account.account_name} ••${account.account_number.slice(-4)}`], ["Price", `1 ${sym} = ${fmtUsd(price ?? 0)}`], ["Fee", "Free"]].map(([k, v]) => <div key={k} className="flex justify-between gap-3"><span className="text-muted-foreground">{k}</span><span className="text-right font-medium">{v}</span></div>)}
        {err && <p role="alert" className="text-xs text-destructive">{err}</p>}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button variant="outline" className="investment-secondary" onClick={() => setStep("form")} disabled={busy}>Back</Button>
          <Button className="investment-primary" onClick={() => void confirm()} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm sell"}</Button>
        </div>
      </div>}
      {step === "done" && <div className="mt-4 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
        <p className="mt-2 text-lg font-semibold">+{fmtUsd(got)}</p>
        <p className="text-xs text-muted-foreground">Sold {fmtUnits(amount)} {sym} into {account?.account_name}.</p>
        <Button className="investment-primary mt-4 w-full" onClick={onClose}>Done</Button>
      </div>}
    </section>
  );
}
