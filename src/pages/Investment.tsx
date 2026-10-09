import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowDownLeft, Check, Copy, ExternalLink, Loader2, RefreshCw, ShieldCheck, Wallet, X } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { useInvestmentWallet, walletNetworks } from "@/hooks/useInvestmentWallet";

export default function Investment() {
  const navigate = useNavigate();
  const { wallet, busy, error, refresh, watchAddress, disconnect } = useInvestmentWallet();
  const [addressInput, setAddressInput] = useState("");
  const [watchChain, setWatchChain] = useState("0x1");
  const [tab, setTab] = useState<"assets" | "activity">("assets");
  const [receive, setReceive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const network = walletNetworks[wallet?.chainId ?? watchChain];
  const copyAddress = async () => {
    if (!wallet) return;
    try { await navigator.clipboard.writeText(wallet.address); setCopied(true); setCopyError(""); }
    catch { setCopyError("Unable to copy. Your address is shown below."); }
  };
  return (
    <AuthLayout currentPage="investment">
      <Seo title="Investment wallet | BoA private institute" description="Business of Associations investment wallet with live blockchain balances." path="/investment" noindex />
      <div className="investment-workspace min-w-0 px-4 py-5 sm:px-8 sm:py-7">
        <div className="mx-auto max-w-lg">
          <div className="flex items-center justify-between gap-3 border-b border-border pb-5">
            <div className="flex items-center gap-3"><div className="investment-asset-icon flex h-10 w-10 items-center justify-center rounded-full"><Wallet className="h-5 w-5" /></div><div><p className="text-xs text-muted-foreground">BoA private institute</p><h2 className="text-lg font-semibold">Investment wallet</h2></div></div>
            <Button variant="ghost" size="icon" className="investment-control" onClick={() => navigate("/accounts")} aria-label="Back to banking" title="Back to banking"><ArrowLeft className="h-5 w-5" /></Button>
          </div>
          <div className="flex items-center justify-between gap-4 py-5">
            <div><p className="text-sm font-medium">{wallet ? "My wallet" : "Wallet overview"}</p><p className="mt-1 text-xs text-muted-foreground">{wallet ? "Live blockchain balance" : "View-only account"}</p></div>
            <label className="flex min-w-0 items-center gap-2 text-sm"><span className="investment-status is-connected shrink-0" /><span className="sr-only">Network</span><select aria-label="Network" value={wallet?.chainId ?? watchChain} className="investment-input max-w-44 text-sm" disabled={busy} onChange={(e) => { setWatchChain(e.target.value); setReceive(false); if (wallet) void watchAddress(wallet.address, e.target.value); }}>{Object.entries(walletNetworks).map(([id, net]) => <option key={id} value={id}>{net.name}</option>)}</select></label>
          </div>
          <section aria-label="Wallet balance" className="py-5 text-center">
            <p className="text-sm text-muted-foreground">Total balance</p>
            <div className="flex min-h-24 items-center justify-center py-4">{busy ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <h1 className="break-all text-4xl font-semibold tabular-nums">{wallet?.balance ?? "—"}<span className="ml-2 text-lg text-muted-foreground">{network?.symbol}</span></h1>}</div>
            {wallet ? <Button variant="ghost" className="investment-control font-mono text-xs" onClick={copyAddress} title="Copy wallet address">{wallet.address.slice(0, 8)}…{wallet.address.slice(-6)}{copied ? <Check className="ml-2 h-3 w-3" /> : <Copy className="ml-2 h-3 w-3" />}</Button> : <p className="text-xs text-muted-foreground">No wallet address selected</p>}
            <div className="mx-auto mt-6 grid max-w-64 grid-cols-3 gap-5">
              <div className="flex flex-col items-center gap-2"><Button size="icon" className="investment-round" disabled={!wallet || busy} onClick={() => setReceive(!receive)} title="Receive" aria-label="Receive"><ArrowDownLeft className="h-5 w-5" /></Button><span className="text-xs">Receive</span></div>
              <div className="flex flex-col items-center gap-2"><Button size="icon" className="investment-round" disabled={!wallet || busy} onClick={() => void refresh()} title="Refresh balance" aria-label="Refresh balance"><RefreshCw className="h-5 w-5" /></Button><span className="text-xs">Refresh</span></div>
              <div className="flex flex-col items-center gap-2"><Button size="icon" className="investment-round" disabled={!wallet || busy} onClick={() => { disconnect(); setReceive(false); setCopied(false); }} title="Change wallet" aria-label="Change wallet"><Wallet className="h-5 w-5" /></Button><span className="text-xs">Wallet</span></div>
            </div>
          </section>
          {!wallet && <form className="space-y-3 border-y border-border py-5" onSubmit={(e) => { e.preventDefault(); void watchAddress(addressInput, watchChain); }}><label htmlFor="wallet-address" className="text-xs text-muted-foreground">Public wallet address</label><input id="wallet-address" className="investment-input w-full font-mono text-sm" value={addressInput} onChange={(e) => setAddressInput(e.target.value)} placeholder="0x…" autoComplete="off" spellCheck={false} maxLength={42} /><Button type="submit" className="investment-connect w-full" disabled={busy || !addressInput.trim()}>{busy ? "Reading blockchain…" : "Open wallet overview"}</Button></form>}
          {receive && wallet && <section className="border-y border-border py-5" aria-label="Receive cryptocurrency"><div className="flex items-center justify-between"><h3 className="font-semibold">Receive {network?.symbol}</h3><Button size="icon" variant="ghost" className="investment-control" aria-label="Close receive" onClick={() => setReceive(false)}><X className="h-4 w-4" /></Button></div><p className="mb-3 text-xs text-muted-foreground">Send only on {network?.name}.</p><p className="break-all font-mono text-sm">{wallet.address}</p><Button variant="outline" className="investment-control mt-3" onClick={copyAddress}><Copy className="mr-2 h-4 w-4" />{copied ? "Copied" : "Copy address"}</Button></section>}
          {(error || copyError) && <p role="alert" className="py-4 text-sm text-destructive">{error || copyError}</p>}
          <div role="tablist" aria-label="Wallet views" className="investment-tabs mt-5 grid grid-cols-2 border-b border-border">{(["assets", "activity"] as const).map((value) => <Button key={value} role="tab" aria-selected={tab === value} className={`investment-tab ${tab === value ? "is-active" : ""}`} variant="ghost" onClick={() => setTab(value)}>{value === "assets" ? "Assets" : "Activity"}</Button>)}</div>
          <section role="tabpanel" className="min-h-36 py-6">
            {tab === "assets" ? wallet ? <div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="investment-asset-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-full"><Wallet className="h-5 w-5" /></div><div><p className="font-medium">{network?.symbol}</p><p className="text-xs text-muted-foreground">{network?.name}</p></div></div><p className="min-w-0 break-all text-right font-mono text-sm">{wallet.balance}</p></div> : <div className="py-5 text-center text-sm text-muted-foreground">No assets to display</div> : <div className="space-y-4 py-4 text-center"><p className="text-sm text-muted-foreground">Transaction history is available on the blockchain explorer.</p>{wallet && network && <a className="investment-link inline-flex items-center gap-2 text-sm" href={`${network.explorer}/address/${wallet.address}`} target="_blank" rel="noopener noreferrer">View activity<ExternalLink className="h-4 w-4" /></a>}</div>}
          </section>
          <div className="flex items-center justify-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" /><span>View-only · Separate from your bank balance</span></div>
        </div>
      </div>
    </AuthLayout>
  );
}
