import { useState } from "react";
import { Check, ChevronLeft, Coins, Delete, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { COINS, coinOf, type CoinSymbol } from "@/lib/coins";

type Step = "token" | "address" | "email" | "amount" | "review" | "done";
const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });

// Records nothing and moves nothing — only emails the member an honest "not processed" notice.
export function WithdrawNotice({ balances, onClose }: { balances: Record<string, number>; onClose: () => void }) {
  const [step, setStep] = useState<Step>("token");
  const [sym, setSym] = useState<CoinSymbol>("BOA");
  const balance = balances[sym] ?? 0;
  const coinName = coinOf(sym)?.name ?? sym;
  const [q, setQ] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [amt, setAmt] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const n = Number(amt || 0);
  const amountOk = /^\d+(\.\d{1,8})?$/.test(amt) && n >= 0.00000001;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const press = (k: string) => {
    setErr("");
    if (k === "del") return setAmt((a) => a.slice(0, -1));
    if (k === "." && amt.includes(".")) return;
    if (amt.includes(".") && amt.split(".")[1].length >= 8 && k !== ".") return;
    setAmt((a) => (a === "0" && k !== "." ? k : a === "" && k === "." ? "0." : a + k));
  };
  const order: Step[] = ["token", "address", "email", "amount", "review"];
  const back = () => { setErr(""); setStep(order[Math.max(0, order.indexOf(step) - 1)]); };
  const paste = async () => { try { setAddress((await navigator.clipboard.readText()).trim()); } catch { setErr("Paste isn't allowed here. Type the address instead."); } };
  const submit = async () => {
    setBusy(true); setErr("");
    const { error } = await supabase.functions.invoke("withdrawal-request-notice", {
      body: { symbol: sym, amount: n, address: address.trim(), email: email.trim() },
    });
    setBusy(false);
    if (error) return setErr("Could not send the notice email. Try again.");
    setStep("done");
  };

  if (step === "done") {
    return (
      <div className="coin-send-receipt fixed inset-0 z-50 flex flex-col" role="dialog" aria-modal="true" aria-label="Withdrawal request receipt">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center px-4 pt-4 pb-6">
          <div className="flex-1" />
          <div className="coin-receipt-check"><Check className="h-11 w-11" strokeWidth={3} /></div>
          <h2 className="mt-8 text-center text-[26px] font-bold leading-tight">Request received</h2>
          <p className="coin-receipt-usd mt-5 text-center text-[40px] font-semibold leading-none tabular-nums">{fmt(n)} {sym}</p>
          <p className="mt-6 max-w-[300px] text-center text-[17px] leading-6 text-receipt-muted">External withdrawals aren't available yet — no coins have left your account. Check your email for the confirmation.</p>
          <div className="flex-1" />
          <Button className="coin-receipt-done h-14 w-full text-lg" onClick={onClose}>Done</Button>
        </div>
      </div>
    );
  }

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
    <div className="investment-workspace coin-send fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-modal="true" aria-label="External withdrawal">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col overflow-y-auto px-4 pt-4 pb-4">
        {step === "token" && <>
          <Header title="Select token" close />
          <label className="investment-input flex items-center gap-2"><Search className="h-4 w-4 text-muted-foreground" /><input className="w-full bg-transparent text-sm outline-none" placeholder="Search for tokens" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          {list.length ? <ul className="mt-4 space-y-1">{list.map((c) => (
            <li key={c.symbol}><button className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-muted" onClick={() => { setSym(c.symbol); setAmt(""); setStep("address"); }}>
              <Token s={c.symbol} /><div className="min-w-0 flex-1"><p className="font-semibold">{c.symbol}</p><p className="text-xs text-muted-foreground">{c.name}</p></div>
              <p className="text-right font-semibold tabular-nums">{fmt(balances[c.symbol] ?? 0)}<span className="block text-xs font-normal text-muted-foreground">{c.symbol}</span></p>
            </button></li>))}</ul>
          : <p className="mt-6 text-center text-sm text-muted-foreground">No tokens found</p>}
        </>}

        {step === "address" && <>
          <Header title="Withdraw to" />
          <div className="rounded-2xl border border-border p-4">
            <textarea className="w-full resize-none bg-transparent font-mono text-sm outline-none" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="External wallet address" maxLength={120} spellCheck={false} autoComplete="off" />
            <div className="mt-2 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm"><Coins className="h-4 w-4 text-[hsl(var(--coin-send-token))]" />{coinName}</span>
              <Button className="investment-primary rounded-full px-5" onClick={paste}>Paste</Button>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">External withdrawals aren't available yet. No coins will be sent — you'll get an email confirming your request was received.</p>
          <div className="flex-1" />
          <Button className="investment-primary mt-6 h-12 w-full rounded-full" disabled={address.trim().length < 10} onClick={() => setStep("email")}>Continue</Button>
        </>}

        {step === "email" && <>
          <Header title="Your email" />
          <p className="pb-3 text-sm text-muted-foreground">We'll send the confirmation to this email address.</p>
          <input className="investment-input w-full text-sm" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com" maxLength={120} aria-label="Email" autoComplete="email" />
          <div className="flex-1" />
          <Button className="investment-primary mt-6 h-12 w-full rounded-full" disabled={!emailOk} onClick={() => setStep("amount")}>Continue</Button>
        </>}

        {step === "amount" && <>
          <Header title="Amount" />
          <p className="border-y border-border py-3 text-sm"><span className="text-muted-foreground">To: </span><span className="break-all font-medium">{address}</span></p>
          <div className="flex flex-1 flex-col items-center justify-center py-6">
            <p className={`break-all text-center text-5xl font-semibold tabular-nums ${amt ? "" : "text-muted-foreground"}`}>{amt || "0"}</p>
            <p className="mt-2 text-sm">{sym}</p>
          </div>
          <div className="flex items-center gap-3"><Token /><div className="flex-1"><p className="font-semibold tabular-nums">{fmt(balance)} {sym}</p><p className="text-xs text-muted-foreground">Available</p></div><Button variant="ghost" className="rounded-full bg-muted px-5" onClick={() => setAmt(String(Number(balance.toFixed(8))))}>Max</Button></div>
          <div className="mt-3 grid grid-cols-3">{["1","2","3","4","5","6","7","8","9",".","0","del"].map((k) => <button key={k} className="h-14 rounded-xl text-2xl font-semibold hover:bg-muted" onClick={() => press(k)} aria-label={k === "del" ? "Delete" : k}>{k === "del" ? <Delete className="mx-auto h-6 w-6" /> : k}</button>)}</div>
          {n > balance && <p className="text-center text-sm text-destructive">Not enough {sym}</p>}
          <Button className="investment-primary mt-3 h-12 w-full rounded-full" disabled={!amountOk || n > balance} onClick={() => setStep("review")}>Review</Button>
        </>}

        {step === "review" && <>
          <Header title="Review withdrawal" />
          <p className="text-sm text-muted-foreground">Amount</p>
          <div className="mt-2 flex items-center gap-3 rounded-2xl bg-muted p-4"><Token /><div><p className="text-lg font-semibold tabular-nums">{fmt(n)} {sym}</p><p className="text-xs text-muted-foreground">{coinName}</p></div></div>
          <p className="mt-5 text-sm text-muted-foreground">Details</p>
          <div className="mt-2 space-y-4 rounded-2xl bg-muted p-4">
            <div><p className="text-xs text-muted-foreground">To</p><p className="break-all font-medium">{address}</p></div>
            <div><p className="text-xs text-muted-foreground">Email</p><p className="break-all font-medium">{email}</p></div>
            <div><p className="text-xs text-muted-foreground">Status</p><p className="font-medium">Not processed — no coins sent</p></div>
          </div>
          {err && <p role="alert" className="mt-2 text-sm text-destructive">{err}</p>}
          <div className="flex-1" />
          <Button className="investment-primary mt-6 h-12 w-full rounded-full" disabled={busy} onClick={submit}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit request"}</Button>
        </>}
        {err && step !== "review" && <p role="alert" className="mt-2 text-sm text-destructive">{err}</p>}
      </div>
    </div>
  );
}
