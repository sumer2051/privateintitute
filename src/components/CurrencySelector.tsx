import { Check, ChevronDown, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CURRENCIES, useCurrency } from "@/contexts/CurrencyContext";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface Props {
  variant?: "default" | "compact";
  className?: string;
}

export const CurrencySelector = ({ variant = "default", className }: Props) => {
  const { currency, setCurrencyCode } = useCurrency();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size={variant === "compact" ? "sm" : "default"}
          className={cn("gap-2 font-semibold", className)}
          aria-label="Change currency"
        >
          <Globe className="h-4 w-4 opacity-70" />
          <span className="hidden sm:inline">{currency.flag}</span>
          <span>{currency.code}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1" align="end">
        <div className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Display currency
        </div>
        <div className="max-h-80 overflow-y-auto">
          {CURRENCIES.map((c) => {
            const active = c.code === currency.code;
            return (
              <button
                key={c.code}
                onClick={() => {
                  setCurrencyCode(c.code);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted",
                  active && "bg-muted"
                )}
              >
                <span className="flex items-center gap-2.5">
                  <span className="text-base leading-none">{c.flag}</span>
                  <span className="font-semibold">{c.code}</span>
                  <span className="text-muted-foreground">{c.name}</span>
                </span>
                {active && <Check className="h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </div>
        <div className="border-t px-3 py-2 text-[10px] text-muted-foreground">
          Rates are indicative. Balances stored in USD; display converts live.
        </div>
      </PopoverContent>
    </Popover>
  );
};
