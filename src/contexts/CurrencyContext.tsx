import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  flag: string;
  /** Rate from 1 USD to this currency. */
  rate: number;
}

// Static approximate exchange rates (base USD). Update if you wire a live FX API.
export const CURRENCIES: CurrencyInfo[] = [
  { code: "USD", symbol: "$",  name: "US Dollar",       flag: "🇺🇸", rate: 1 },
  { code: "EUR", symbol: "€",  name: "Euro",            flag: "🇪🇺", rate: 0.92 },
  { code: "GBP", symbol: "£",  name: "British Pound",   flag: "🇬🇧", rate: 0.78 },
  { code: "JPY", symbol: "¥",  name: "Japanese Yen",    flag: "🇯🇵", rate: 157 },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", flag: "🇨🇦", rate: 1.36 },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", flag: "🇦🇺", rate: 1.52 },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc",    flag: "🇨🇭", rate: 0.88 },
  { code: "CNY", symbol: "¥",  name: "Chinese Yuan",    flag: "🇨🇳", rate: 7.24 },
  { code: "INR", symbol: "₹",  name: "Indian Rupee",    flag: "🇮🇳", rate: 83.2 },
  { code: "MXN", symbol: "MX$", name: "Mexican Peso",   flag: "🇲🇽", rate: 17.1 },
  { code: "BRL", symbol: "R$", name: "Brazilian Real",  flag: "🇧🇷", rate: 5.05 },
  { code: "NGN", symbol: "₦",  name: "Nigerian Naira",  flag: "🇳🇬", rate: 1550 },
  { code: "ZAR", symbol: "R",  name: "South African Rand", flag: "🇿🇦", rate: 18.5 },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham",     flag: "🇦🇪", rate: 3.67 },
];

interface CurrencyContextValue {
  currency: CurrencyInfo;
  setCurrencyCode: (code: string) => void;
  /** Convert a USD amount into the selected currency. */
  convert: (usd: number) => number;
  /** Convert an amount in the selected currency back to USD. */
  toUsd: (amount: number) => number;
  /** Format a USD amount for display in the selected currency. */
  format: (usd: number) => string;
  /** Format an amount already in the selected currency (no conversion). */
  formatRaw: (amount: number) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);
const STORAGE_KEY = "app.currency";

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [code, setCode] = useState<string>(() => {
    if (typeof window === "undefined") return "USD";
    return localStorage.getItem(STORAGE_KEY) || "USD";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, code);
  }, [code]);

  const value = useMemo<CurrencyContextValue>(() => {
    const currency = CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];
    const convert = (usd: number) => usd * currency.rate;
    const toUsd = (amt: number) => amt / currency.rate;
    const formatRaw = (amount: number) => {
      try {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: currency.code,
          maximumFractionDigits: currency.code === "JPY" ? 0 : 2,
        }).format(amount);
      } catch {
        return `${currency.symbol}${amount.toFixed(2)}`;
      }
    };
    return {
      currency,
      setCurrencyCode: setCode,
      convert,
      toUsd,
      format: (usd: number) => formatRaw(convert(usd)),
      formatRaw,
    };
  }, [code]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};

export const useCurrency = () => {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
};
