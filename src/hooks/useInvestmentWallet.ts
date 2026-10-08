import { useCallback, useEffect, useRef, useState } from "react";
import { formatEther, getAddress, type Eip1193Provider } from "ethers";
import { supabase } from "@/integrations/supabase/client";

type WalletProvider = Eip1193Provider & {
  isMetaMask?: boolean;
  providers?: WalletProvider[];
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};
type Wallet = { address: string; chainId: string; balance: string };
export const walletNetworks: Record<string, { name: string; symbol: string; explorer: string }> = {
  "0x1": { name: "Ethereum", symbol: "ETH", explorer: "https://etherscan.io" },
  "0x89": { name: "Polygon", symbol: "POL", explorer: "https://polygonscan.com" },
  "0xa4b1": { name: "Arbitrum One", symbol: "ETH", explorer: "https://arbiscan.io" },
  "0xa": { name: "Optimism", symbol: "ETH", explorer: "https://optimistic.etherscan.io" },
  "0x2105": { name: "Base", symbol: "ETH", explorer: "https://basescan.org" },
  "0x38": { name: "BNB Smart Chain", symbol: "BNB", explorer: "https://bscscan.com" },
  "0xaa36a7": { name: "Sepolia · test network", symbol: "ETH", explorer: "https://sepolia.etherscan.io" },
};

function messageFor(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
  if (code === 4001) return "Connection declined in MetaMask. You can try again.";
  if (code === -32002) return "Open MetaMask to finish the pending connection request.";
  if (code === 4100) return "Unlock MetaMask and approve access to your account.";
  return "Couldn't read your wallet. Check MetaMask and try again.";
}

export function useInvestmentWallet() {
  const [provider, setProvider] = useState<WalletProvider | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  const connected = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const discover = (event: Event) => {
      const detail = (event as CustomEvent<{ info: { rdns: string }; provider: WalletProvider }>).detail;
      if (detail?.info?.rdns === "io.metamask") setProvider(detail.provider);
    };
    window.addEventListener("eip6963:announceProvider", discover);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    const injected = (window as Window & { ethereum?: WalletProvider }).ethereum;
    const metaMask = injected?.providers?.find((item) => item.isMetaMask) ?? (injected?.isMetaMask ? injected : null);
    if (metaMask) setProvider((current) => current ?? metaMask);
    return () => {
      mounted.current = false;
      sequence.current += 1;
      window.removeEventListener("eip6963:announceProvider", discover);
    };
  }, []);

  const readWallet = useCallback(async (requestAccess = false) => {
    if (!provider) { setError("MetaMask wasn't detected. Install or open MetaMask, then reload this page."); return; }
    const attempt = ++sequence.current;
    const isCurrent = () => mounted.current && attempt === sequence.current;
    setBusy(true);
    setError("");
    // Never leave another account or network's balance visible during refresh.
    setWallet(null);
    try {
      if (requestAccess) {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("Authentication required");
        const { data, error: roleError } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
        if (roleError || data !== true) { if (isCurrent()) setError("Investment accounts are available to administrators only."); return; }
        if (!isCurrent()) return;
      }
      const accounts: unknown = await provider.request({ method: requestAccess ? "eth_requestAccounts" : "eth_accounts" });
      if (!Array.isArray(accounts) || typeof accounts[0] !== "string") {
        connected.current = false;
        return;
      }
      const address = getAddress(accounts[0]);
      const chain: unknown = await provider.request({ method: "eth_chainId" });
      if (typeof chain !== "string" || !/^0x[0-9a-f]+$/i.test(chain)) throw new Error("Invalid network");
      const amount: unknown = await provider.request({ method: "eth_getBalance", params: [address, "latest"] });
      if (typeof amount !== "string" || !/^0x[0-9a-f]+$/i.test(amount)) throw new Error("Invalid balance");
      if (isCurrent()) {
        connected.current = true;
        setWallet({ address, chainId: `0x${BigInt(chain).toString(16)}`, balance: formatEther(BigInt(amount)) });
      }
    } catch (failure) {
      if (isCurrent()) setError(messageFor(failure));
    } finally {
      if (isCurrent()) setBusy(false);
    }
  }, [provider]);

  const disconnect = useCallback(() => {
    sequence.current += 1;
    connected.current = false;
    setWallet(null);
    setError("");
    setBusy(false);
  }, []);

  useEffect(() => {
    if (!provider) return;
    const changed = () => { if (connected.current) void readWallet(); };
    const disconnected = () => disconnect();
    provider.on?.("accountsChanged", changed);
    provider.on?.("chainChanged", changed);
    provider.on?.("disconnect", disconnected);
    return () => {
      provider.removeListener?.("accountsChanged", changed);
      provider.removeListener?.("chainChanged", changed);
      provider.removeListener?.("disconnect", disconnected);
    };
  }, [provider, readWallet, disconnect]);

  // Live balance: quietly re-read the chain every 12s while connected and the tab is visible.
  const address = wallet?.address;
  const chainId = wallet?.chainId;
  useEffect(() => {
    if (!provider || !address || !chainId) return;
    let stopped = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const amount: unknown = await provider.request({ method: "eth_getBalance", params: [address, "latest"] });
        if (stopped || typeof amount !== "string" || !/^0x[0-9a-f]+$/i.test(amount)) return;
        const balance = formatEther(BigInt(amount));
        setWallet((current) => current && current.address === address && current.chainId === chainId && current.balance !== balance ? { ...current, balance } : current);
      } catch { /* next tick retries */ }
    };
    const timer = window.setInterval(tick, 12000);
    document.addEventListener("visibilitychange", tick);
    return () => { stopped = true; window.clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [provider, address, chainId]);

  return { wallet, busy, error, available: Boolean(provider), connect: () => readWallet(true), refresh: () => readWallet(), disconnect };
}