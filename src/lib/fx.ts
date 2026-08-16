import { CURRENCIES } from "@/contexts/CurrencyContext";

/**
 * Admin-side helpers: balances/transactions are stored in USD, but staff should
 * see each customer's figures in the currency that customer transacts in.
 */
export const currencyInfo = (code?: string | null) => {
  const normalized = (code || "USD").trim().toUpperCase();
  return CURRENCIES.find((c) => c.code === normalized) || CURRENCIES[0];
};

/** Convert a USD amount into `code` and format it with that currency's locale. */
export const formatIn = (code: string | null | undefined, usd: number) => {
  const cur = currencyInfo(code);
  const value = (Number(usd) || 0) * cur.rate;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cur.code,
      minimumFractionDigits: cur.code === "JPY" ? 0 : 2,
      maximumFractionDigits: cur.code === "JPY" ? 0 : 2,
    }).format(value);
  } catch {
    return `${cur.symbol}${value.toFixed(2)}`;
  }
};

/** Same as formatIn but keeps the sign out of the number (caller adds +/-). */
export const formatAbsIn = (code: string | null | undefined, usd: number) =>
  formatIn(code, Math.abs(Number(usd) || 0));
