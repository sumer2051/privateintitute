import { useEffect, useState } from "react";

const COINS = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  { id: "tether", symbol: "USDT", name: "Tether" },
  { id: "binancecoin", symbol: "BNB", name: "BNB" },
  { id: "solana", symbol: "SOL", name: "Solana" },
  { id: "ripple", symbol: "XRP", name: "XRP" },
  { id: "usd-coin", symbol: "USDC", name: "USD Coin" },
];
type Prices = Record<string, { usd: number; usd_24h_change: number }>;

export function MarketPrices() {
  const [prices, setPrices] = useState<Prices | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${COINS.map((c) => c.id).join(",")}&vs_currencies=usd&include_24hr_change=true`);
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (alive) { setPrices(d); setFailed(false); }
      } catch { if (alive) setFailed(true); }
    };
    void load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Markets</h2><span className="text-xs text-muted-foreground">Live prices · USD</span></div>
      {failed && !prices && <p className="mt-3 text-sm text-muted-foreground">Prices are unavailable right now. Try again shortly.</p>}
      <ul className="mt-3 space-y-2">
        {COINS.map((c) => {
          const p = prices?.[c.id];
          const ch = p?.usd_24h_change ?? 0;
          return (
            <li key={c.id} className="investment-token-row flex items-center justify-between gap-3">
              <div className="flex items-center gap-3"><span className="investment-token-icon">{c.symbol[0]}</span><div><p className="font-semibold">{c.name}</p><p className="text-xs text-muted-foreground">{c.symbol}</p></div></div>
              <div className="text-right">
                <p className="font-mono text-sm">{p ? `$${p.usd.toLocaleString(undefined, { maximumFractionDigits: p.usd < 10 ? 4 : 2 })}` : "…"}</p>
                <p className={`text-xs ${ch < 0 ? "text-destructive" : "text-[hsl(var(--wallet-status))]"}`}>{p ? `${ch >= 0 ? "+" : ""}${ch.toFixed(2)}%` : ""}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
