import { useState } from "react";
import { ChevronLeft, ChevronRight, Coins, Delete, Loader2, Search, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COINS, coinOf, type CoinSymbol } from "@/lib/coins";

type Step = "token" | "to" | "amount" | "review";
const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });

export function CoinSendFlow({ balances, fromName, recents, onClose, onSend }: {
  balances: Record<string, number>;
  fromName: string;
  recents: string[];
  onClose: () => void;
  onSend: (symbol: CoinSymbol, to: string, amount: number, note: string) => Promise<string | null>;
}) {
  const [step, setStep] = useState<Step>("token");
  const [sym, setSym] = useState<CoinSymbol>("BOA");
  const balance = balances[sym] ?? 0;
  const coinName = coinOf(sym)?.name ?? sym;
  const [q, setQ] = useState("");
  const [to, setTo] = useState("");
  const [amt, setAmt] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const n = Number(amt || 0);
  const amountOk = /^\d+(\.\d{1,8})?$/.test(amt) && n >= 0.00000001 && n <= balance;

  const press = (k: string) => {
    setErr("");
    if (k === "del") return setAmt((a) => a.slice(0, -1));
    if (k === "." && amt.includes(".")) return;
    if (amt.includes(".") && amt.split(".")[1].length >= 8 && k !== ".") return;
    setAmt((a) => (a === "0" && k !== "." ? k : a === "" && k === "." ? "0." : a + k));
  };
  const back = () => { setErr(""); setStep(step === "review" ? "amount" : step === "amount" ? "to" : "token"); };
  const paste = async () => { try { setTo((await navigator.clipboard.readText()).trim()); } catch { setErr("Paste isn't allowed here. Type the address instead."); } };
  const send = async () => {
    setBusy(true); setErr("");
    const e = await onSend(sym, to.trim(), n, note.trim());
    setBusy(false);
    if (e) setErr(e);
  };

  const Header = ({ title, close }: { title: string; close?: boolean }) => (
    <div className="flex items-center justify-between gap-3 pb-4">
      <Button size="icon" variant="ghost" className="investment-icon-button" onClick={close ? onClose : back} aria-label={close ? "Close" : "Back"}>{close ? <X className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}</Button>
      <h2 className="text-base font-semibold">{title}</h2>
      <span className="h-10 w-10" />
    </div>
  );
  const Token = ({ size = "h-11 w-11", s = sym }: { size?: string; s?: CoinSymbol }) => <span className={`investment-token-icon ${size} shrink-0`}><span className="text-lg font-extrabold leading-none">{coinOf(s)?.letter}</span></span>;
  const query = q.trim().toLowerCase();
  const list = COINS.filter((c) => c.symbol === "BOA" || (balances[c.symbol] ?? 0) > 0).filter((c) => !query || c.name.toLowerCase().includes(query) || c.symbol.toLowerCase().includes(query));

  return (
    <div className="investment-workspace coin-send fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-modal="true" aria-label="Send coins">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col overflow-y-auto px-4 pt-4 pb-4">
        {step === "token" && <>
          <Header title="Select token" close />
          <label className="investment-input flex items-center gap-2"><Search className="h-4 w-4 text-muted-foreground" /><input className="w-full bg-transparent text-sm outline-none" placeholder="Search for tokens" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          {list.length ? <ul className="mt-4 space-y-1">{list.map((c) => (
            <li key={c.symbol}><button className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-muted" onClick={() => { setSym(c.symbol); setAmt(""); setStep("to"); }}>
              <Token s={c.symbol} /><div className="min-w-0 flex-1"><p className="font-semibold">{c.symbol}</p><p className="text-xs text-muted-foreground">{c.name}</p></div>
              <p className="text-right font-semibold tabular-nums">{fmt(balances[c.symbol] ?? 0)}<span className="block text-xs font-normal text-muted-foreground">{c.symbol}</span></p>
            </button></li>))}</ul>
          : <p className="mt-6 text-center text-sm text-muted-foreground">No tokens found</p>}
        </>}

        {step === "to" && <>
          <Header title="Send to" />
          <div className="rounded-2xl border border-border p-4">
            <textarea className="w-full resize-none bg-transparent font-mono text-sm outline-none" rows={2} value={to} onChange={(e) => setTo(e.target.value)} placeholder="Address (boa1…) or email" maxLength={255} spellCheck={false} autoComplete="off" />
            <div className="mt-2 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm"><Coins className="h-4 w-4 text-[hsl(var(--coin-send-token))]" />BoA Coin</span>
              <Button className="investment-primary rounded-full px-5" onClick={paste}>Paste</Button>
            </div>
          </div>
          {recents.length > 0 && <>
            <p className="mt-6 flex items-center gap-1 font-semibold">Recent recipients<ChevronRight className="h-4 w-4 text-muted-foreground" /></p>
            <ul className="mt-2">{recents.map((r) => <li key={r}><button className="flex w-full items-center gap-3 rounded-xl py-3 text-left hover:bg-muted" onClick={() => setTo(r)}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-[hsl(var(--coin-send-token))]"><ShieldCheck className="h-5 w-5" /></span><span className="min-w-0 truncate text-sm">{r}</span></button></li>)}</ul>
          </>}
          <div className="flex-1" />
          <Button className="investment-primary mt-6 h-12 w-full rounded-full" disabled={to.trim().length < 3} onClick={() => setStep("amount")}>Continue</Button>
        </>}

        {step === "amount" && <>
          <Header title="Amount" />
          <p className="border-y border-border py-3 text-sm"><span className="text-muted-foreground">To: </span><span className="break-all font-medium">{to}</span></p>
          <div className="flex flex-1 flex-col items-center justify-center py-6">
            <p className={`break-all text-center text-5xl font-semibold tabular-nums ${amt ? "" : "text-muted-foreground"}`}>{amt || "0"}</p>
            <p className="mt-2 text-sm">{sym}</p>
          </div>
          <div className="flex items-center gap-3"><Token /><div className="flex-1"><p className="font-semibold tabular-nums">{fmt(balance)} {sym}</p><p className="text-xs text-muted-foreground">Available</p></div><Button variant="ghost" className="rounded-full bg-muted px-5" onClick={() => setAmt(String(Number(balance.toFixed(8))))}>Max</Button></div>
          <div className="mt-3 grid grid-cols-3">{["1","2","3","4","5","6","7","8","9",".","0","del"].map((k) => <button key={k} className="h-14 rounded-xl text-2xl font-semibold hover:bg-muted" onClick={() => press(k)} aria-label={k === "del" ? "Delete" : k}>{k === "del" ? <Delete className="mx-auto h-6 w-6" /> : k}</button>)}</div>
          {n > balance && <p className="text-center text-sm text-destructive">Not enough {sym}</p>}
          <Button className="investment-primary mt-3 h-12 w-full rounded-full" disabled={!amountOk} onClick={() => setStep("review")}>Review</Button>
        </>}

        {step === "review" && <>
          <Header title="Review Send" />
          <p className="text-sm text-muted-foreground">Amount</p>
          <div className="mt-2 flex items-center gap-3 rounded-2xl bg-muted p-4"><Token /><div><p className="text-lg font-semibold tabular-nums">{fmt(n)} {sym}</p><p className="text-xs text-muted-foreground">{coinName}</p></div></div>
          <p className="mt-5 text-sm text-muted-foreground">Details</p>
          <div className="mt-2 space-y-4 rounded-2xl bg-muted p-4">
            <div><p className="text-xs text-muted-foreground">From</p><p className="font-medium">{fromName}</p></div>
            <div><p className="text-xs text-muted-foreground">To</p><p className="break-all font-medium">{to}</p></div>
            <div><p className="text-xs text-muted-foreground">Network</p><p className="flex items-center gap-1.5 font-medium"><Coins className="h-4 w-4 text-[hsl(var(--coin-send-token))]" />BoA Coin</p></div>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">Network fee</p>
          <div className="mt-2 flex items-center justify-between rounded-2xl bg-muted p-4"><span className="flex items-center gap-2 font-medium"><Token size="h-8 w-8" />{sym}</span><span className="text-right font-semibold">Free<span className="block text-xs font-normal text-muted-foreground">0.00 {sym}</span></span></div>
          <input className="investment-input mt-4 w-full text-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" maxLength={140} />
          {err && <p role="alert" className="mt-2 text-sm text-destructive">{err}</p>}
          <div className="flex-1" />
          <Button className="investment-primary mt-6 h-12 w-full rounded-full" disabled={busy} onClick={send}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}</Button>
        </>}
        {err && step !== "review" && <p role="alert" className="mt-2 text-sm text-destructive">{err}</p>}
      </div>
    </div>
  );
}
