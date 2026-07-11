import { Check, ChevronDown, Globe, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CURRENCIES, useCurrency } from "@/contexts/CurrencyContext";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

interface Props {
  variant?: "default" | "compact";
  className?: string;
}

export const CurrencySelector = ({ variant = "default", className }: Props) => {
  const { currency, setCurrencyCode } = useCurrency();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return CURRENCIES;
    return CURRENCIES.filter(
      (c) =>
        c.code.toLowerCase().includes(s) ||
        c.name.toLowerCase().includes(s),
    );
  }, [q]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size={variant === "compact" ? "sm" : "default"}
          className={cn(
            "gap-1.5 font-semibold border-primary/30 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 hover:from-primary/20 hover:via-accent/20 hover:to-primary/20 hover:border-primary/60 shadow-sm transition-all",
            className,
          )}
          aria-label="Change currency"
        >
          <span className="text-base leading-none">{currency.flag}</span>
          <span className="hidden xs:inline sm:inline">{currency.code}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 overflow-hidden" align="end">
        <div className="relative bg-gradient-to-br from-primary/15 via-accent/10 to-transparent px-4 py-3 border-b">
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
          <div className="relative flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-white shadow-md">
              <Globe className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-2.5 w-2.5" /> Display currency
              </p>
              <p className="text-sm font-bold text-secondary leading-tight">
                {currency.flag} {currency.name}
              </p>
            </div>
          </div>
        </div>
        <div className="p-2 border-b">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search currency…"
            className="h-8 text-sm"
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {filtered.map((c) => {
            const active = c.code === currency.code;
            return (
              <button
                key={c.code}
                onClick={() => {
                  setCurrencyCode(c.code);
                  setOpen(false);
                  setQ("");
                }}
                className={cn(
                  "group flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-all",
                  active
                    ? "bg-gradient-to-r from-primary/15 to-accent/15 text-secondary"
                    : "hover:bg-muted hover:translate-x-0.5",
                )}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className="text-lg leading-none">{c.flag}</span>
                  <span className="font-semibold w-10 text-left">{c.code}</span>
                  <span className="text-muted-foreground truncate">{c.name}</span>
                </span>
                {active ? (
                  <Check className="h-4 w-4 text-primary shrink-0" />
                ) : (
                  <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                    Select
                  </span>
                )}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">No matches</p>
          )}
        </div>
        <div className="border-t bg-muted/40 px-3 py-2 text-[10px] text-muted-foreground">
          Live conversion · Transfers adapt to local scheme automatically.
        </div>
      </PopoverContent>
    </Popover>
  );
};
