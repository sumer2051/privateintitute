import { useCurrency } from "@/contexts/CurrencyContext";
import { cn } from "@/lib/utils";

interface MoneyProps {
  /** Amount in USD (converted to the selected currency). */
  value: number;
  /** Amount is already in the selected currency — skip conversion. */
  raw?: boolean;
  /** Visual scale of the number. */
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZES: Record<NonNullable<MoneyProps["size"]>, { num: string; sym: string; cents: string }> = {
  sm: { num: "text-sm", sym: "text-[9px]", cents: "text-[10px]" },
  md: { num: "text-lg", sym: "text-[10px]", cents: "text-xs" },
  lg: { num: "text-2xl", sym: "text-[11px]", cents: "text-sm" },
  xl: { num: "text-3xl md:text-4xl", sym: "text-xs", cents: "text-base" },
};

/**
 * Renders a currency amount with a raised, muted symbol, tabular figures for
 * the whole units and de-emphasised decimals — e.g. ⁺$ 1,240.⁵⁰
 */
export const Money = ({ value, raw, size = "md", className }: MoneyProps) => {
  const { currency, convert, formatRaw } = useCurrency();
  const amount = raw ? value : convert(value);
  const formatted = formatRaw(amount);

  // Split "$1,234.56" -> symbol / whole / decimals
  const match = formatted.match(/^([^\d\-.,]*)(-?[\d.,\s]*?)(?:([.,])(\d+))?$/);
  const symbol = (match?.[1] || currency.symbol).trim();
  const whole = match?.[2]?.trim() || formatted;
  const sep = match?.[3];
  const cents = match?.[4];
  const s = SIZES[size];
  const negative = amount < 0;

  return (
    <span
      className={cn(
        "inline-flex items-start font-display font-bold leading-none tracking-tight tabular-nums",
        negative && "text-destructive",
        s.num,
        className,
      )}
    >
      <span className={cn("mr-0.5 mt-[0.15em] font-semibold uppercase tracking-[0.08em] opacity-60", s.sym)}>
        {symbol}
      </span>
      <span>{whole}</span>
      {cents && (
        <span className={cn("ml-[1px] mt-[0.12em] font-semibold opacity-55", s.cents)}>
          {sep}
          {cents}
        </span>
      )}
    </span>
  );
};
