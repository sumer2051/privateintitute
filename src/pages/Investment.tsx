import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDown, ArrowLeft, ArrowUpRight, Check, ChevronRight, Copy, ExternalLink, History, Layers3, Loader2, Plus, RefreshCw, Search, ShieldCheck, Sparkles, Wallet, X } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { useInvestmentWallet, walletNetworks } from "@/hooks/useInvestmentWallet";

type View = "tokens" | "earn" | "activity";
type Action = "send" | "receive" | "swap" | "buy" | null;
const earnOptions = [
  { asset: "ETH", rate: "3.1%", name: "Liquid staking" },
  { asset: "POL", rate: "4.8%", name: "Network staking" },
  { asset: "USDC", rate: "5.2%", name: "Lending pool" },
];

export default function Investment() {
  const navigate = useNavigate();
  const { wallet, busy, error, refresh, watchAddress, disconnect } = useInvestmentWallet();
  const [addressInput, setAddressInput] = useState("");
  const [watchChain, setWatchChain] = useState("0x1");
  const [view, setView] = useState<View>("tokens");
  const [action, setAction] = useState<Action>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const network = walletNetworks[wallet?.chainId ?? watchChain];
  const copyAddress = async () => {
    if (!wallet) return;
    try { await navigator.clipboard.writeText(wallet.address); setCopied(true); setCopyError(""); }
    catch { setCopyError("Unable to copy. Your address is shown below."); }
  };
  const chooseNetwork = (chainId: string) => {
    setWatchChain(chainId);
    setAction(null);
    if (wallet) void watchAddress(wallet.address, chainId);
  };
  return (
    <AuthLayout currentPage="investment">
      <Seo title="Investment wallet | BoA private institute" description="Business of Associations investment wallet with live blockchain balances." path="/investment" noindex />
      <div className="investment-workspace min-w-0 px-4 py-5 sm:px-8 sm:py-7">
        <div className="mx-auto max-w-2xl">
          <header className="flex items-center justify-between gap-3">
            <Button variant="ghost" className="investment-account-pill min-w-0" onClick={() => { setAction(null); if (wallet) disconnect(); }}>
              <span className="investment-logo"><Wallet className="h-4 w-4" /></span><span className="truncate">{wallet ? `${wallet.address.slice(0, 7)}…${wallet.address.slice(-4)}` : "Investment wallet"}</span><ChevronRight className="h-4 w-4 shrink-0" />
            </Button>
            <div className="flex gap-2"><Button size="icon" variant="ghost" className="investment-icon-button" onClick={() => setView("activity")} aria-label="Activity"><History className="h-5 w-5" /></Button><Button size="icon" variant="ghost" className="investment-icon-button" onClick={() => navigate("/accounts")} aria-label="Back to banking"><ArrowLeft className="h-5 w-5" /></Button></div>
          </header>

          {!wallet ? (
            <section className="investment-onboard mx-auto mt-16 max-w-md text-center">
              <div className="investment-hero-mark mx-auto"><Layers3 className="h-8 w-8" /></div>
              <h1 className="mt-5 text-3xl font-semibold">Open your DeFi view</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Enter a public wallet address to see its live balance, tokens and blockchain activity.</p>
              <form className="mt-8 space-y-3 text-left" onSubmit={(event) => { event.preventDefault(); void watchAddress(addressInput, watchChain); }}>
                <label htmlFor="wallet-address" className="text-xs text-muted-foreground">Public wallet address</label>
                <input id="wallet-address" className="investment-input w-full font-mono text-sm" value={addressInput} onChange={(event) => setAddressInput(event.target.value)} placeholder="0x…" autoComplete="off" spellCheck={false} maxLength={42} />
                <label htmlFor="wallet-network" className="text-xs text-muted-foreground">Network</label>
                <select id="wallet-network" value={watchChain} onChange={(event) => setWatchChain(event.target.value)} className="investment-input w-full text-sm">{Object.entries(walletNetworks).map(([id, item]) => <option value={id} key={id}>{item.name}</option>)}</select>
                <Button type="submit" className="investment-primary w-full" disabled={busy || !addressInput.trim()}>{busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Reading blockchain…</> : "View wallet"}</Button>
              </form>
            </section>
          ) : (
            <>
              <section className="mt-5">
                <div className="investment-notice flex items-center gap-3"><span className="investment-notice-icon"><Sparkles className="h-5 w-5" /></span><div className="min-w-0"><p className="text-sm font-semibold">Explore DeFi safely</p><p className="text-xs text-muted-foreground">Live balances with no signing or transfer access</p></div></div>
                <label className="mt-5 inline-flex items-center gap-2"><span className="investment-status is-connected" /><span className="sr-only">Network</span><select aria-label="Network" value={wallet.chainId} onChange={(event) => chooseNetwork(event.target.value)} className="investment-network" disabled={busy}>{Object.entries(walletNetworks).map(([id, item]) => <option value={id} key={id}>{item.name}</option>)}</select></label>
                <div className="mt-5 min-h-24">{busy ? <Loader2 className="h-9 w-9 animate-spin text-primary" /> : <><p className="text-xs text-muted-foreground">Total native balance</p><h1 className="mt-1 break-all text-4xl font-semibold tabular-nums sm:text-5xl">{wallet.balance}<span className="ml-2 text-xl text-muted-foreground">{network?.symbol}</span></h1></>}</div>
                <div className="mt-7 grid grid-cols-4 gap-3">
                  {[
                    { id: "send" as const, label: "Send", icon: ArrowUpRight },
                    { id: "receive" as const, label: "Receive", icon: ArrowDown },
                    { id: "swap" as const, label: "Swap", icon: RefreshCw },
                    { id: "buy" as const, label: "Buy", icon: Plus },
                  ].map(({ id, label, icon: Icon }) => <div key={id} className="flex min-w-0 flex-col items-center gap-2"><Button size="icon" className={`investment-action ${id === "swap" ? "is-featured" : ""}`} onClick={() => setAction(id)} aria-label={label}><Icon className="h-6 w-6" /></Button><span className="text-xs sm:text-sm">{label}</span></div>)}
                </div>
              </section>

              {action && <section className="investment-action-sheet mt-6" aria-live="polite"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold capitalize">{action}</h2><p className="mt-1 text-xs text-muted-foreground">{action === "receive" ? `Use this address to receive ${network?.symbol} on ${network?.name}.` : "This wallet is view-only. Connect through a trusted wallet app to approve this action."}</p></div><Button size="icon" variant="ghost" className="investment-icon-button" onClick={() => setAction(null)} aria-label="Close"><X className="h-4 w-4" /></Button></div>{action === "receive" ? <><p className="mt-4 break-all font-mono text-sm">{wallet.address}</p><Button className="investment-primary mt-4" onClick={copyAddress}>{copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}{copied ? "Copied" : "Copy address"}</Button></> : <Button variant="outline" className="investment-secondary mt-4" onClick={() => setAction(null)}>Got it</Button>}</section>}

              {(error || copyError) && <p role="alert" className="mt-4 text-sm text-destructive">{error || copyError}</p>}
              <nav className="investment-nav mt-8 grid grid-cols-3" aria-label="Investment views">{([{ id: "tokens", label: "Tokens", icon: Wallet }, { id: "earn", label: "Earn", icon: Layers3 }, { id: "activity", label: "Activity", icon: History }] as const).map(({ id, label, icon: Icon }) => <Button key={id} variant="ghost" className={`investment-nav-item ${view === id ? "is-active" : ""}`} onClick={() => setView(id)}><Icon className="h-4 w-4" />{label}</Button>)}</nav>
              <section className="min-h-64 py-6">
                {view === "tokens" && <><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Tokens</h2><Button size="icon" variant="ghost" className="investment-icon-button" aria-label="Search tokens"><Search className="h-4 w-4" /></Button></div><div className="investment-token-row mt-3 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="investment-token-icon">{network?.symbol?.slice(0, 1)}</span><div><p className="font-semibold">{network?.symbol}</p><p className="text-xs text-muted-foreground">{network?.name}</p></div></div><div className="text-right"><p className="font-mono text-sm">{wallet.balance}</p><p className="text-xs text-muted-foreground">Live on-chain</p></div></div></>}
                {view === "earn" && <><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Earn opportunities</h2><span className="text-xs text-muted-foreground">Indicative rates</span></div><div className="mt-4 grid gap-3 sm:grid-cols-3">{earnOptions.map((item) => <button key={item.asset} className="investment-earn text-left" onClick={() => setAction("buy")}><span className="investment-token-icon">{item.asset[0]}</span><strong className="mt-4 block text-xl">{item.rate} APY</strong><span className="mt-1 block text-xs text-muted-foreground">{item.name} · {item.asset}</span></button>)}</div></>}
                {view === "activity" && <div className="py-8 text-center"><History className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">Review this wallet’s verified activity on the explorer.</p>{network && <a className="investment-link mt-4 inline-flex items-center gap-2 text-sm" href={`${network.explorer}/address/${wallet.address}`} target="_blank" rel="noopener noreferrer">Open blockchain explorer<ExternalLink className="h-4 w-4" /></a>}</div>}
              </section>
            </>
          )}
          {error && !wallet && <p role="alert" className="mx-auto mt-4 max-w-md text-sm text-destructive">{error}</p>}
          <footer className="mt-8 flex items-center justify-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" /><span>View-only · Separate from your bank balance</span></footer>
        </div>
      </div>
    </AuthLayout>
  );
}
