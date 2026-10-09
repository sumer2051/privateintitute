import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Check, Copy, ExternalLink, Loader2, LogOut, RefreshCw, ShieldCheck, Wallet } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";
import { InvestmentIcon } from "@/components/InvestmentSwitch";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { useInvestmentWallet, walletNetworks } from "@/hooks/useInvestmentWallet";

export default function Investment() {
  const navigate = useNavigate();
  const { wallet, busy, error, available, connect, refresh, watchAddress, disconnect } = useInvestmentWallet();
  const [addressInput, setAddressInput] = useState("");
  const [watchChain, setWatchChain] = useState("0x1");
  const inFrame = (() => { try { return window.self !== window.top; } catch { return true; } })();
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const network = wallet ? walletNetworks[wallet.chainId] : undefined;
  const shortAddress = wallet ? `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}` : "Not connected";
  const copyAddress = async () => {
    if (!wallet) return;
    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setCopyError("");
    } catch { setCopyError("Couldn't copy the address. Please copy it from the wallet details below."); }
  };
  return (
    <AuthLayout currentPage="investment">
      <Seo title="Investment wallet | BoA private institute" description="Private investment workspace with MetaMask wallet connection." path="/investment" noindex />
      <div className="investment-workspace min-w-0 px-4 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
          <div className="flex items-center gap-3">
            <InvestmentIcon className="h-10 w-10 shrink-0" />
            <div><p className="text-xs text-muted-foreground">BoA private institute</p><h2 className="text-xl font-semibold sm:text-2xl">Investment account</h2></div>
          </div>
          <Button variant="ghost" className="investment-control" onClick={() => navigate("/accounts")}><ArrowLeft className="mr-2 h-4 w-4" />Back to banking</Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 py-6">
          <span className="flex items-center gap-2 text-sm"><span className={`investment-status ${wallet ? "is-connected" : ""}`} />{network?.name ?? (wallet ? `Network ${BigInt(wallet.chainId).toString()}` : "MetaMask wallet")}</span>
          {wallet && <div className="flex items-center gap-2"><span className="font-mono text-sm">{shortAddress}</span><Button size="icon" variant="ghost" className="investment-control" aria-label="Copy wallet address" title="Copy wallet address" onClick={copyAddress}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button><Button size="icon" variant="ghost" className="investment-control" aria-label="Disconnect wallet" title="Disconnect wallet" onClick={() => { disconnect(); setCopied(false); }}><LogOut className="h-4 w-4" /></Button></div>}
        </div>
        <section className="border-b border-border pb-8 pt-4 text-center sm:pb-12" aria-label="Wallet balance">
          <p className="text-sm text-muted-foreground">{wallet ? "Wallet balance" : "Your investment wallet"}</p>
          <div className="my-5 flex min-h-20 items-center justify-center">
            {busy ? <Loader2 className="h-10 w-10 animate-spin text-primary" /> : wallet ? <h1 className="break-all text-3xl font-semibold tabular-nums sm:text-4xl">{wallet.balance}<span className="ml-2 text-lg text-muted-foreground">{network?.symbol ?? "Native coin"}</span></h1> : <InvestmentIcon className="h-20 w-20" />}
          </div>
          <p className="mb-6 text-sm text-muted-foreground">{wallet ? "Native asset · live blockchain balance" : "MetaMask"}</p>
          {wallet ? <Button variant="outline" className="investment-control" onClick={() => { setCopied(false); void refresh(); }} disabled={busy}><RefreshCw className="mr-2 h-4 w-4" />Refresh balance</Button> : <Button className="investment-connect" onClick={() => void connect()} disabled={busy}><Wallet className="mr-2 h-4 w-4" />{busy ? "Connecting…" : "Connect MetaMask"}</Button>}
          {!wallet && (
            <form
              className="mx-auto mt-6 max-w-md space-y-3 border-t border-border pt-6 text-left"
              onSubmit={(event) => { event.preventDefault(); void watchAddress(addressInput, watchChain); }}
            >
              <p className="text-center text-sm text-muted-foreground">{available ? "Or view any wallet by its address" : "View your wallet by its address — no app needed"}</p>
              <label className="block text-xs text-muted-foreground" htmlFor="wallet-address">Wallet address</label>
              <input
                id="wallet-address"
                value={addressInput}
                onChange={(event) => setAddressInput(event.target.value)}
                placeholder="0x…"
                autoComplete="off"
                spellCheck={false}
                maxLength={42}
                className="investment-input w-full font-mono text-sm"
              />
              <label className="block text-xs text-muted-foreground" htmlFor="wallet-network">Network</label>
              <select id="wallet-network" value={watchChain} onChange={(event) => setWatchChain(event.target.value)} className="investment-input w-full text-sm">
                {Object.entries(walletNetworks).map(([id, net]) => <option key={id} value={id}>{net.name}</option>)}
              </select>
              <Button type="submit" variant="outline" className="investment-control w-full" disabled={busy || !addressInput.trim()}>Show balance</Button>
              {!available && isMobile && !inFrame && (
                <p className="text-center text-xs text-muted-foreground">Have the MetaMask app? <a href={`https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`} className="investment-link inline-flex items-center gap-1">Open there to connect<ArrowUpRight className="h-3 w-3" /></a></p>
              )}
              {!available && inFrame && (
                <p className="text-center text-xs text-muted-foreground">To connect MetaMask, <a href={window.location.href} target="_blank" rel="noopener noreferrer" className="investment-link inline-flex items-center gap-1">open in a new tab<ArrowUpRight className="h-3 w-3" /></a></p>
              )}
            </form>
          )}
          {wallet && <p className="mt-3 text-xs text-muted-foreground">Balance updates automatically</p>}
          {(error || copyError) && <p role="alert" className="mx-auto mt-4 max-w-md text-sm text-destructive">{error || copyError}</p>}
        </section>
        <section className="py-7" aria-label="Wallet assets">
          <div className="mb-6 flex items-center justify-between"><h3 className="text-base font-semibold">Assets</h3><span className="text-xs text-muted-foreground">{wallet ? (wallet.source === "address" ? "Viewed by address" : "Connected wallet") : "Not connected"}</span></div>
          {wallet ? <div className="flex items-center justify-between gap-4 border-b border-border pb-6"><div className="flex items-center gap-3"><div className="investment-asset-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-full"><Wallet className="h-5 w-5" /></div><div><p className="font-medium">{network?.symbol ?? "Native coin"}</p><p className="text-xs text-muted-foreground">{network?.name ?? "Connected network"}</p></div></div><p className="min-w-0 break-all text-right font-mono text-sm tabular-nums">{wallet.balance}</p></div> : <div className="flex flex-col items-center gap-3 py-7 text-muted-foreground"><Wallet className="h-7 w-7" /><p className="text-sm">No wallet connected</p></div>}
          {wallet && <div className="mt-6"><p className="mb-2 text-xs text-muted-foreground">Wallet address</p><p className="break-all font-mono text-sm">{wallet.address}</p>{network && <a href={`${network.explorer}/address/${wallet.address}`} target="_blank" rel="noopener noreferrer" className="investment-link mt-3 inline-flex items-center gap-2 text-sm">View on explorer<ExternalLink className="h-3 w-3" /></a>}</div>}
        </section>
        <div className="flex items-start gap-2 border-t border-border pt-5 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0" /><p>Read-only connection. No transfers, signatures, or access to your recovery phrase. Wallet assets are separate from bank accounts.</p></div>
      </div>
    </AuthLayout>
  );
}