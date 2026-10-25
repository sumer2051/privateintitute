import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
const fmtCoin = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 8 });
import { useNavigate } from "react-router-dom";
import { ArrowDown, ArrowLeft, ArrowUpRight, Banknote, Check, ChevronRight, Copy, ExternalLink, History, Layers3, Loader2, Plus, RefreshCw, ShieldCheck, Sparkles, Wallet, X } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { useInvestmentWallet, walletNetworks } from "@/hooks/useInvestmentWallet";
import { CoinWallet, type Panel } from "@/components/CoinWallet";
import { CoinSwapFlow } from "@/components/CoinSwapFlow";
import { CoinBuyFlow } from "@/components/CoinBuyFlow";
import { CoinSellFlow } from "@/components/CoinSellFlow";
import { WithdrawNotice } from "@/components/WithdrawNotice";
import { useCoinRates, useTokenBalances } from "@/hooks/useCoinRates";
import { COINS, fmtRate, fmtUnits, fmtUsd, rateOf, type CoinSymbol } from "@/lib/coins";
import { MarketPrices } from "@/components/MarketPrices";

type View = "tokens" | "earn" | "activity";
type Action = "send" | "receive" | "swap" | "buy" | "sell" | "withdraw" | "track" | null;
type Swap = { id: string; from_symbol: string; to_symbol: string; from_units: number; to_units: number; rate: number; created_at: string };
const earnOptions = [
  { asset: "ETH", rate: "3.1%", name: "Liquid staking" },
  { asset: "POL", rate: "4.8%", name: "Network staking" },
  { asset: "USDC", rate: "5.2%", name: "Lending pool" },
];
// Display-only onboarding preference; access is still checked by the server.
const PROFILE_KEY = "boa-investment-profile";
const readProfile = () => { try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || "null") as { name: string } | null; } catch { return null; } };

export default function Investment() {
  const navigate = useNavigate();
  const { wallet, busy, error, watchAddress, disconnect } = useInvestmentWallet();
  const [profile, setProfile] = useState(readProfile);
  const [nameInput, setNameInput] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [addressInput, setAddressInput] = useState("");
  const [watchChain, setWatchChain] = useState("0x1");
  const [view, setView] = useState<View>("tokens");
  const [action, setAction] = useState<Action>(null);
  const [coinPanel, setCoinPanel] = useState<Panel>(null);
  const [swapOpen, setSwapOpen] = useState(false);
  const [coinTick, setCoinTick] = useState(0);
  const [swaps, setSwaps] = useState<Swap[]>([]);
  const { rates, updatedAt, refreshing, refresh } = useCoinRates();
  const { balances: tokenBalances, reload: reloadTokens } = useTokenBalances();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const network = walletNetworks[wallet?.chainId ?? watchChain];
  const [coinBalance, setCoinBalance] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase.from("coin_balances").select("units, balance").eq("user_id", u.user.id).maybeSingle();
      if (alive) setCoinBalance(Number(data?.units ?? data?.balance ?? 0));
    };
    void load();
    const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); };
  }, [coinPanel, coinTick]);

  const loadSwaps = useCallback(async () => {
    const { data } = await supabase.from("coin_swaps").select("id, from_symbol, to_symbol, from_units, to_units, rate, created_at").order("created_at", { ascending: false }).limit(20);
    setSwaps((data ?? []) as Swap[]);
  }, []);

  useEffect(() => { void loadSwaps(); }, [loadSwaps]);

  const doSwap = async (from: CoinSymbol, to: CoinSymbol, amount: number, minOut: number) => {
    const { error } = await supabase.rpc("swap_coins", { p_from: from, p_to: to, p_amount: amount, p_min_out: minOut });
    if (error) return { error: error.message };
    const { data: latest } = await supabase.from("coin_swaps").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle();
    setCoinTick((t) => t + 1);
    void loadSwaps();
    void reloadTokens();
    return { error: null, id: (latest as { id: string } | null)?.id ?? null };
  };

  const signUp = (e: React.FormEvent) => {
    e.preventDefault();
    const p = { name: nameInput.trim().slice(0, 60) };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    setProfile(p);
  };
  const copyAddress = async () => {
    if (!wallet) return;
    try { await navigator.clipboard.writeText(wallet.address); setCopied(true); setCopyError(""); }
    catch { setCopyError("Unable to copy. Your address is shown below."); }
  };
  const chooseNetwork = (chainId: string) => {
    setWatchChain(chainId);
    if (wallet) void watchAddress(wallet.address, chainId);
  };
  const track = async (e: React.FormEvent) => {
    e.preventDefault();
    await watchAddress(addressInput, watchChain);
    setAction(null);
  };

  return (
    <AuthLayout currentPage="investment">
      <Seo title="Investment wallet | BoA private institute" description="Business of Associations investment wallet with live blockchain balances." path="/investment" noindex />
      <div className="investment-workspace coin-palette min-w-0 px-4 py-5 sm:px-8 sm:py-7">
        <div className="mx-auto max-w-2xl">
          {!profile ? (
            <section className="mx-auto mt-10 max-w-md text-center">
              <div className="investment-hero-mark mx-auto"><Wallet className="h-8 w-8" /></div>
              <h1 className="mt-5 text-3xl font-semibold">Create your investment account</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Set up your BoA investment space once. Next time you switch, you'll go straight in.</p>
              <form className="mt-8 space-y-3 text-left" onSubmit={signUp}>
                <label htmlFor="inv-name" className="text-xs text-muted-foreground">Account name</label>
                <input id="inv-name" className="investment-input w-full text-sm" value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="e.g. Main investment" maxLength={60} required />
                <label className="flex items-start gap-2 pt-2 text-xs text-muted-foreground"><input type="checkbox" className="mt-0.5 accent-[hsl(var(--primary))]" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />I understand this space is view-only and separate from my bank balance.</label>
                <Button type="submit" className="investment-primary w-full" disabled={!nameInput.trim() || !agreed}>Sign up</Button>
                <Button type="button" variant="outline" className="investment-secondary w-full" onClick={() => navigate("/accounts")}>Back to banking</Button>
              </form>
            </section>
          ) : (
            <>
              <header className="flex items-center justify-between gap-3">
                <Button variant="ghost" className="investment-account-pill min-w-0" onClick={() => { setAction(null); if (wallet) disconnect(); }}>
                  <span className="investment-logo"><Wallet className="h-4 w-4" /></span><span className="truncate">{wallet ? `${wallet.address.slice(0, 7)}…${wallet.address.slice(-4)}` : profile.name}</span><ChevronRight className="h-4 w-4 shrink-0" />
                </Button>
                <div className="flex gap-2"><Button size="icon" variant="ghost" className="investment-icon-button" onClick={() => setView("activity")} aria-label="Activity"><History className="h-5 w-5" /></Button><Button size="icon" variant="ghost" className="investment-icon-button" onClick={() => navigate("/accounts")} aria-label="Back to banking"><ArrowLeft className="h-5 w-5" /></Button></div>
              </header>

              <section className="mt-5">
                <div className="investment-notice flex items-center gap-3"><span className="investment-notice-icon"><Sparkles className="h-5 w-5" /></span><div className="min-w-0"><p className="text-sm font-semibold">Welcome, {profile.name}</p><p className="text-xs text-muted-foreground">Live balances with no signing or transfer access</p></div></div>
                <div className="mt-5 min-h-24"><p className="text-xs text-muted-foreground">Total balance</p><h1 className="mt-1 break-all text-4xl font-semibold tabular-nums sm:text-5xl">{coinBalance === null ? <Loader2 className="h-9 w-9 animate-spin text-primary" /> : fmtUsd(COINS.reduce((sum, c) => { const units = c.symbol === "BOA" ? coinBalance : (tokenBalances[c.symbol] ?? 0); return sum + units * (rateOf(c.symbol, rates) ?? 0); }, 0))}<span className="ml-2 text-xl text-muted-foreground">USD</span></h1><p className="mt-1 text-xs text-muted-foreground tabular-nums">{coinBalance !== null && `${fmtCoin(coinBalance)} BOA · all coins at live prices`}</p></div>
                <div className="mt-7 grid grid-cols-6 gap-1.5">
                  {[
                    { id: "send" as const, label: "Send", icon: ArrowUpRight },
                    { id: "receive" as const, label: "Receive", icon: ArrowDown },
                    { id: "swap" as const, label: "Swap", icon: RefreshCw },
                    { id: "buy" as const, label: "Buy", icon: Plus },
                    { id: "sell" as const, label: "Sell", icon: Banknote },
                    { id: "withdraw" as const, label: "Withdraw", icon: ExternalLink },
                  ].map(({ id, label, icon: Icon }) => <div key={id} className="flex min-w-0 flex-col items-center gap-2"><Button size="icon" className={`investment-action ${id === "swap" ? "is-featured" : ""}`} onClick={() => { if (id === "swap") { setAction(null); setSwapOpen(true); return; } if (id === "send" || id === "receive") { setAction(null); setCoinPanel(id); setTimeout(() => document.getElementById("boa-coin")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); } else { setAction(id); setCoinPanel(null); setTimeout(() => document.getElementById(`coin-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); } }} aria-label={label}><Icon className="h-6 w-6" /></Button><span className="truncate text-[11px] sm:text-sm">{label}</span></div>)}
                </div>
              </section>

              {action === "buy" && <CoinBuyFlow rates={rates} onClose={() => setAction(null)} onDone={() => { setCoinTick((t) => t + 1); void reloadTokens(); }} />}
              {action === "sell" && <CoinSellFlow rates={rates} balances={{ BOA: coinBalance ?? 0, ...tokenBalances }} onClose={() => setAction(null)} onDone={() => { setCoinTick((t) => t + 1); void reloadTokens(); }} />}
              {action === "withdraw" && <WithdrawNotice balances={{ BOA: coinBalance ?? 0, ...tokenBalances }} onClose={() => setAction(null)} />}
              <CoinWallet panel={coinPanel} onPanelChange={setCoinPanel} refreshKey={coinTick} />
              {swapOpen && <CoinSwapFlow rates={rates} balances={{ BOA: coinBalance ?? 0, ...tokenBalances }} onClose={() => setSwapOpen(false)} onSwap={doSwap} />}


              {action && action !== "buy" && action !== "sell" && <section className="investment-action-sheet mt-6" aria-live="polite">
                <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold capitalize">{action === "track" ? "Add a wallet address" : action}</h2><p className="mt-1 text-xs text-muted-foreground">{action === "track" ? "Paste a public address to show its live balance." : action === "receive" ? `Use this address to receive ${network?.symbol} on ${network?.name}.` : ""}</p></div><Button size="icon" variant="ghost" className="investment-icon-button" onClick={() => setAction(null)} aria-label="Close"><X className="h-4 w-4" /></Button></div>
                {action === "track" ? <form className="mt-4 space-y-3" onSubmit={track}><input className="investment-input w-full font-mono text-sm" value={addressInput} onChange={(e) => setAddressInput(e.target.value)} placeholder="0x…" autoComplete="off" spellCheck={false} maxLength={42} aria-label="Public wallet address" /><Button type="submit" className="investment-primary w-full" disabled={busy || !addressInput.trim()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Show balance"}</Button></form>
                  : action === "receive" && wallet ? <><p className="mt-4 break-all font-mono text-sm">{wallet.address}</p><Button className="investment-primary mt-4" onClick={copyAddress}>{copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}{copied ? "Copied" : "Copy address"}</Button></>
                  : <Button variant="outline" className="investment-secondary mt-4" onClick={() => setAction(null)}>Got it</Button>}
              </section>}

              {(error || copyError) && <p role="alert" className="mt-4 text-sm text-destructive">{error || copyError}</p>}
              <nav className="investment-nav mt-8 grid grid-cols-3" aria-label="Investment views">{([{ id: "tokens", label: "Tokens", icon: Wallet }, { id: "earn", label: "Earn", icon: Layers3 }, { id: "activity", label: "Activity", icon: History }] as const).map(({ id, label, icon: Icon }) => <Button key={id} variant="ghost" className={`investment-nav-item ${view === id ? "is-active" : ""}`} onClick={() => setView(id)}><Icon className="h-4 w-4" />{label}</Button>)}</nav>
              <section className="min-h-64 py-6">
                {view === "tokens" && <><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Your coins</h2><div className="flex items-center gap-2">{updatedAt && <span className="text-xs text-muted-foreground">{refreshing ? "Updating prices…" : `Prices ${new Date(updatedAt).toLocaleTimeString()}`}</span>}<Button size="icon" variant="ghost" className="investment-icon-button" onClick={() => void refresh()} aria-label="Refresh prices"><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /></Button></div></div><ul className="mt-3 space-y-2">{COINS.map((c) => { const units = c.symbol === "BOA" ? (coinBalance ?? 0) : (tokenBalances[c.symbol] ?? 0); const price = rateOf(c.symbol, rates); return <li key={c.symbol} className="investment-token-row flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="investment-token-icon">{c.letter}</span><div><p className="font-semibold">{c.name}</p><p className="text-xs text-muted-foreground">{c.symbol}</p></div></div><div className="text-right"><p className="font-mono text-sm">{fmtUnits(units)}</p><p className="text-xs text-muted-foreground">{price ? fmtUsd(units * price) : "—"}</p></div></li>; })}</ul><Button variant="outline" className="investment-secondary mt-4 w-full" onClick={() => setSwapOpen(true)}><RefreshCw className="mr-2 h-4 w-4" />Swap between coins</Button><MarketPrices /></>}
                {view === "earn" && <><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Earn opportunities</h2><span className="text-xs text-muted-foreground">Indicative rates</span></div><div className="mt-4 grid gap-3 sm:grid-cols-3">{earnOptions.map((item) => <button key={item.asset} className="investment-earn text-left" onClick={() => setAction("buy")}><span className="investment-token-icon">{item.asset[0]}</span><strong className="mt-4 block text-xl">{item.rate} APY</strong><span className="mt-1 block text-xs text-muted-foreground">{item.name} · {item.asset}</span></button>)}</div></>}
                {view === "activity" && <div><h2 className="text-lg font-semibold">Swap history</h2>{swaps.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No swaps yet. Tap Swap to trade BoA Coin for Bitcoin, Ethereum or Tether units.</p> : <ul className="mt-3 divide-y divide-border">{swaps.map((s) => <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm"><div className="min-w-0"><p className="truncate font-medium">{fmtUnits(Number(s.from_units))} {s.from_symbol} → {fmtUnits(Number(s.to_units))} {s.to_symbol}</p><p className="truncate text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()}</p></div><span className="shrink-0 font-mono text-xs text-muted-foreground">1 {s.from_symbol} = {fmtRate(Number(s.rate))} {s.to_symbol}</span></li>)}</ul>}{network && wallet && <a className="investment-link mt-6 inline-flex items-center gap-2 text-sm" href={`${network.explorer}/address/${wallet.address}`} target="_blank" rel="noopener noreferrer">Open blockchain explorer<ExternalLink className="h-4 w-4" /></a>}</div>}
              </section>
            </>
          )}
          <footer className="mt-8 flex items-center justify-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" /><span>View-only · Separate from your bank balance</span></footer>
        </div>
      </div>
    </AuthLayout>
  );
}
