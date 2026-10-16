export type CoinSymbol = "BOA" | "BTC" | "ETH" | "USDT" | "BNB" | "SOL" | "XRP" | "USDC" | "DOGE" | "ADA" | "TRX" | "LTC";

export const COINS: { symbol: CoinSymbol; name: string; letter: string }[] = [
  { symbol: "BOA", name: "BoA Coin", letter: "B" },
  { symbol: "BTC", name: "Bitcoin", letter: "B" },
  { symbol: "ETH", name: "Ethereum", letter: "E" },
  { symbol: "USDT", name: "Tether", letter: "T" },
  { symbol: "BNB", name: "BNB", letter: "N" },
  { symbol: "SOL", name: "Solana", letter: "S" },
  { symbol: "XRP", name: "XRP", letter: "X" },
  { symbol: "USDC", name: "USD Coin", letter: "U" },
  { symbol: "DOGE", name: "Dogecoin", letter: "D" },
  { symbol: "ADA", name: "Cardano", letter: "A" },
  { symbol: "TRX", name: "TRON", letter: "T" },
  { symbol: "LTC", name: "Litecoin", letter: "L" },
];

export const coinOf = (symbol: string) => COINS.find((c) => c.symbol === symbol.toUpperCase());

/** BoA Coin is pegged at $1; the rest read the bank's live prices. */
export const rateOf = (symbol: CoinSymbol, rates: Record<string, number> | null): number | null =>
  symbol === "BOA" ? 1 : (rates?.[symbol] ?? null);

export const fmtUnits = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 8 });

export const fmtUsd = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: n < 10 ? 6 : 2 })}`;

export const fmtRate = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 8 : 6 });

/** Same maths the server does: convert at the stored prices, cut to 8 decimals. */
export function quoteSwap(
  from: CoinSymbol,
  to: CoinSymbol,
  amount: number,
  rates: Record<string, number> | null,
) {
  const rf = rateOf(from, rates);
  const rt = rateOf(to, rates);
  if (!rf || !rt || !(amount > 0)) return null;
  const out = Math.floor((amount * rf) / rt * 1e8) / 1e8;
  if (out <= 0) return null;
  return { out, rate: rf / rt, payUsd: amount * rf, getUsd: out * rt };
}

/** 1% slippage guard: the swap fails instead of paying worse than this. */
export const minReceived = (out: number) => Math.floor(out * 0.99 * 1e8) / 1e8;
