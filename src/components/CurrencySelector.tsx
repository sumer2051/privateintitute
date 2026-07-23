import { Check, ChevronDown, Globe, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CURRENCIES, useCurrency } from "@/contexts/CurrencyContext";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

interface Props {
  variant?: "default" | "compact";
  className?: string;
}

export const CurrencySelector = ({ variant = "default", className }: Props) => {
  const { currency, setCurrencyCode } = useCurrency();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [celebration, setCelebration] = useState<{ code: string; name: string; flag: string } | null>(null);

  useEffect(() => {
    if (!celebration) return;
    const timer = setTimeout(() => setCelebration(null), 2200);
    return () => clearTimeout(timer);
  }, [celebration]);


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
                  setCelebration({ code: c.code, name: c.name, flag: c.flag });
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

      {celebration && (
        <div className="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center px-4">
          {/* Dim vignette that still lets the app breathe through */}
          <div className="pointer-events-auto absolute inset-0 bg-gradient-to-b from-secondary/40 via-background/50 to-secondary/40 backdrop-blur-[6px] animate-in fade-in duration-300" onClick={() => setCelebration(null)} />

          {/* Spotlight beams */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute left-1/2 top-0 h-[120vh] w-[60vw] -translate-x-1/2 bg-gradient-to-b from-primary/25 via-accent/10 to-transparent blur-3xl opacity-70 animate-in fade-in duration-700" />
            <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-primary/40 to-accent/30 blur-3xl animate-pulse" />
          </div>

          {/* Falling hero card */}
          <div
            className="pointer-events-auto relative w-full max-w-md animate-in fade-in slide-in-from-top-16 duration-700"
            style={{ animationTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
          >
            <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-b from-card via-card to-background shadow-[0_30px_80px_-20px_hsl(var(--primary)/0.45)] ring-1 ring-primary/20">
              {/* Ornate top bar */}
              <div className="relative h-2 bg-gradient-to-r from-primary via-accent to-primary">
                <div className="absolute inset-0 animate-[shimmer_2.5s_linear_infinite] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.6),transparent)] bg-[length:200%_100%]" />
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="absolute right-3 top-4 z-10 h-9 w-9 rounded-full opacity-70 hover:opacity-100"
                onClick={() => setCelebration(null)}
                aria-label="Close welcome overlay"
              >
                <X className="h-5 w-5" />
              </Button>

              <div className="relative px-8 pb-8 pt-10 text-center">
                {/* Corner filigrees */}
                <div className="absolute left-4 top-6 h-6 w-6 rounded-tl-2xl border-l-2 border-t-2 border-primary/40" />
                <div className="absolute right-4 top-6 h-6 w-6 rounded-tr-2xl border-r-2 border-t-2 border-primary/40" />
                <div className="absolute left-4 bottom-4 h-6 w-6 rounded-bl-2xl border-b-2 border-l-2 border-primary/40" />
                <div className="absolute right-4 bottom-4 h-6 w-6 rounded-br-2xl border-b-2 border-r-2 border-primary/40" />

                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.45em] text-primary">
                  BoA Private Institute
                </p>
                <p className="mb-6 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  Welcome to
                </p>

                {/* Hero flag falling into place */}
                <div className="relative mx-auto mb-6 h-40 w-40">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary/30 via-accent/20 to-primary/30 blur-2xl animate-pulse" />
                  <div className="absolute inset-2 rounded-full border-2 border-dashed border-primary/30 animate-[spin_18s_linear_infinite]" />
                  <div
                    className="relative flex h-full w-full items-center justify-center rounded-3xl bg-gradient-to-br from-primary/10 via-accent/5 to-primary/10 shadow-inner ring-1 ring-primary/20 animate-in zoom-in-50 duration-700"
                    style={{ animationTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
                  >
                    <span className="text-8xl drop-shadow-[0_10px_20px_rgba(0,0,0,0.25)]">{celebration.flag}</span>
                  </div>
                </div>

                {/* Code with glow */}
                <div className="relative">
                  <h2 className="font-display text-6xl font-bold tracking-tight text-secondary drop-shadow-sm animate-in fade-in slide-in-from-bottom-3 duration-500">
                    {celebration.code}
                  </h2>
                  <div className="mx-auto mt-2 h-px w-24 bg-gradient-to-r from-transparent via-primary to-transparent" />
                </div>
                <p className="mt-3 text-base font-medium text-muted-foreground animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {celebration.name}
                </p>

                {/* Active effect badges */}
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2 animate-in fade-in slide-in-from-bottom-5 duration-700">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-[11px] font-semibold text-success">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                    Live FX active
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
                    <Sparkles className="h-3 w-3" />
                    Local transfer methods
                  </span>
                </div>

                <p className="mt-5 text-[11px] uppercase tracking-[0.25em] text-muted-foreground/70">
                  Balances & transfers now display in {celebration.code}
                </p>
              </div>

              {/* Bottom ornate bar */}
              <div className="h-1.5 bg-gradient-to-r from-primary via-accent to-primary" />
            </div>
          </div>
        </div>
      )}
    </Popover>
  );
};

