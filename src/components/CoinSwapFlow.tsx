import { useMemo, useState } from "react";
import { ArrowDownUp, Check, ChevronLeft, Delete, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COINS, coinOf, fmtRate, fmtUnits, fmtUsd, minReceived, quoteSwap, type CoinSymbol } from "@/lib/coins";

type Step = "from" | "to" | "amount" | "review" | "done";
type Receipt = { from: CoinSymbol; to: CoinSymbol; paid: number; got: number; rate: number; at: string; id: string | null };

export function CoinSwapFlow({ rates, balances, onClose, onSwap }: {
  rates: Record<string, number> | null;
  balances: Record<string, number>;
  onClose: () => void;
  onSwap: (from: CoinSymbol, to: CoinSymbol, amount: number, minOut: number) => Promise<{ error: string | null; id?: string | null }>;
}) {
  const [step, setStep] = useState<Step>("from");
  const [from, setFrom] = useState<CoinSymbol>("BOA");
  const [to, setTo] = useState<CoinSymbol>("BTC");
  const [amt, setAmt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const n = Number(amt || 0);
  const q = useMemo(() => quoteSwap(from, to, n, rates), [from, to, n, rates]);
  const have = balances[from] ?? 0;
  const amountOk = /^\d+(\.\d{1,8})?$/.test(amt) && n >= 0.00000001 && n <= have && !!q;

  const press = (k: string) => {
    setErr("");
    if (k === "del") return setAmt((a) => a.slice(0, -1));
    if (k === "." && amt.includes(".")) return;
    if (amt.includes(".") && amt.split(".")[1].length >= 8 && k !== ".") return;
    setAmt((a) => (a === "0" && k !== "." ? k : a === "" && k === "." ? "0." : a + k));
  };

  const back = () => {
    setErr("");
    setStep(step === "review" ? "amount" : step === "amount" ? "to" : step === "to" ? "from" : step);
  };

  const confirm = async () => {
    if (!q) return;
    setBusy(true);
    setErr("");
    const res = await onSwap(from, to, n, minReceived(q.out));
    setBusy(false);
    if (res.error) return setErr(res.error);
    setReceipt({ from, to, paid: n, got: q.out, rate: q.rate, at: new Date().toLocaleString(), id: res.id ?? null });
    setStep("done");
  };

  const Header = ({ title, close }: { title: string; close?: boolean }) => (
    <div className="flex items-center justify-between gap-3 pb-4">
      <Button size="icon" variant="ghost" className="investment-icon-button" onClick={close ? onClose : back} aria-label={close ? "Close" : "Back"}>{close ? <X className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}</Button>
      <h2 className="text-base font-semibold">{title}</h2>
      <span className="h-10 w-10" />
    </div>
  );

  const Token = ({ symbol, size = "h-11 w-11" }: { symbol: CoinSymbol; size?: string }) => (
    <span className={`investment-token-icon ${size} shrink-0`}><span className="text-lg font-extrabold leading-none">{coinOf(symbol)?.letter}</span></span>
  );

  const Row = ({ symbol, active, onPick }: { symbol: CoinSymbol; active?: boolean; onPick: () => void }) => {
    const price = quoteSwap(symbol, "BOA", 1, rates);
    const bal = balances[symbol] ?? 0;
    return (
      <button className="mt-1 flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-muted" onClick={onPick} aria-current={active}>
        <Token symbol={symbol} />
        <div className="min-w-0 flex-1"><p className="font-semibold">{symbol}</p><p className="text-xs text-muted-foreground">{coinOf(symbol)?.name}</p></div>
        <p className="text-right font-semibold tabular-nums">{fmtUnits(bal)}<span className="block text-xs font-normal text-muted-foreground">{price ? fmtUsd(bal * (price.payUsd / price.out)) : symbol}</span></p>
      </button>
    );
  };

  return (
    <div className="investment-workspace coin-send fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-modal="true" aria-label="Swap coins">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col overflow-y-auto px-4 pt-4 pb-4">
        {step === "from" && <>
          <Header title="Swap from" close />
          <p className="mb-2 text-sm text-muted-foreground">Choose the coin to give</p>
          {COINS.map((c) => <Row key={c.symbol} symbol={c.symbol} active={c.symbol === from} onPick={() => { setFrom(c.symbol); if (to === c.symbol) setTo(COINS.find((x) => x.symbol !== c.symbol)!.symbol); setStep("to"); }} />)}
        </>}

        {step === "to" && <>
          <Header title="Swap to" />
          <p className="mb-2 text-sm text-muted-foreground">Choose the coin to receive</p>
          {COINS.filter((c) => c.symbol !== from).map((c) => <Row key={c.symbol} symbol={c.symbol} onPick={() => { setTo(c.symbol); setStep("amount"); }} />)}
        </>}

        {step === "amount" && <>
          <Header title="Amount" />
          <p className="border-y border-border py-3 text-sm"><span className="text-muted-foreground">You receive: </span><span className="font-medium">{to}</span></p>
          <div className="flex flex-1 flex-col items-center justify-center py-6">
            <p className={`break-all text-center text-5xl font-semibold tabular-nums ${amt ? "" : "text-muted-foreground"}`}>{amt || "0"}</p>
            <p className="mt-2 text-sm">{from}</p>
            <p className="mt-3 text-sm text-muted-foreground">{q ? `≈ ${fmtUnits(q.out)} ${to}` : "Waiting for live prices"}</p>
          </div>
          <div className="flex items-center gap-3"><Token symbol={from} /><div className="flex-1"><p className="font-semibold tabular-nums">{fmtUnits(have)} {from}</p><p className="text-xs text-muted-foreground">Available</p></div><Button variant="ghost" className="rounded-full bg-muted px-5" onClick={() => setAmt(String(Number(have.toFixed(8))))}>Max</Button></div>
          <div className="mt-3 grid grid-cols-3">{["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"].map((k) => <button key={k} className="h-14 rounded-xl text-2xl font-semibold hover:bg-muted" onClick={() => press(k)} aria-label={k === "del" ? "Delete" : k}>{k === "del" ? <Delete className="mx-auto h-6 w-6" /> : k}</button>)}</div>
          {n > have && <p className="text-center text-sm text-destructive">Not enough {from}</p>}
          <Button className="investment-primary mt-3 h-12 w-full rounded-full" disabled={!amountOk} onClick={() => setStep("review")}>Review</Button>
        </>}

        {step === "review" && q && <>
          <Header title="Review Swap" />
          <p className="text-sm text-muted-foreground">You give</p>
          <div className="mt-2 flex items-center gap-3 rounded-2xl bg-muted p-4"><Token symbol={from} /><div><p className="text-lg font-semibold tabular-nums">{fmtUnits(n)} {from}</p><p className="text-xs text-muted-foreground">{coinOf(from)?.name} · {fmtUsd(q.payUsd)}</p></div></div>
          <p className="mt-5 text-sm text-muted-foreground">You receive</p>
          <div className="mt-2 flex items-center gap-3 rounded-2xl bg-muted p-4"><Token symbol={to} /><div><p className="text-lg font-semibold tabular-nums">{fmtUnits(q.out)} {to}</p><p className="text-xs text-muted-foreground">{coinOf(to)?.name} · {fmtUsd(q.getUsd)}</p></div></div>
          <p className="mt-5 text-sm text-muted-foreground">Details</p>
          <div className="mt-2 space-y-4 rounded-2xl bg-muted p-4">
            <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-sm text-muted-foreground"><ArrowDownUp className="h-4 w-4" />Rate</span><span className="text-right font-medium">1 {from} = {fmtRate(q.rate)} {to}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-sm text-muted-foreground">You get at least</span><span className="font-medium tabular-nums">{fmtUnits(minReceived(q.out))} {to}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-sm text-muted-foreground">Fee</span><span className="font-medium">Free</span></div>
          </div>
          {err && <p role="alert" className="mt-2 text-sm text-destructive">{err}</p>}
          <div className="flex-1" />
          <Button className="investment-primary mt-6 h-12 w-full rounded-full" disabled={busy} onClick={confirm}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Swap"}</Button>
        </>}

        {step === "done" && receipt && <>
          <div className="flex flex-col items-center py-8 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-[hsl(var(--wallet-status))]"><Check className="h-8 w-8" /></span>
            <h2 className="mt-4 text-xl font-semibold">Swap complete</h2>
            <p className="mt-1 text-sm text-muted-foreground">{receipt.at}</p>
          </div>
          <div className="space-y-4 rounded-2xl bg-muted p-4">
            <div className="flex items-center justify-between gap-3"><span className="text-sm text-muted-foreground">You gave</span><span className="font-medium tabular-nums">{fmtUnits(receipt.paid)} {receipt.from}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-sm text-muted-foreground">You received</span><span className="font-medium tabular-nums">{fmtUnits(receipt.got)} {receipt.to}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-sm text-muted-foreground">Rate</span><span className="font-medium">1 {receipt.from} = {fmtRate(receipt.rate)} {receipt.to}</span></div>
            {receipt.id && <div className="flex items-center justify-between gap-3"><span className="text-sm text-muted-foreground">Swap ID</span><span className="break-all text-right font-mono text-xs">{receipt.id}</span></div>}
          </div>
          <div className="flex-1" />
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button className="investment-primary h-12 rounded-full" onClick={onClose}>Done</Button>
            <Button variant="outline" className="investment-secondary h-12 rounded-full" onClick={() => { setAmt(""); setErr(""); setReceipt(null); setStep("from"); }}>Swap again</Button>
          </div>
        </>}
        {err && step !== "review" && <p role="alert" className="mt-2 text-sm text-destructive">{err}</p>}
      </div>
    </div>
  );
}
