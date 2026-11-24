import { useCallback, useEffect, useState } from "react";
import { Landmark, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function AdminReserveSummary({ refreshKey }: { refreshKey: number }) {
  const [reserve, setReserve] = useState<{ total_allocation: number; available_balance: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: failure } = await supabase.from("admin_reserve").select("total_allocation,available_balance").eq("id", 1).single();
    setError(Boolean(failure));
    setReserve(data);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load, refreshKey]);
  useEffect(() => {
    const refresh = () => { void load(); };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [load]);
  const value = (amount?: number) => error ? "Unavailable" : amount === undefined ? "Loading…" : usd.format(Number(amount));
  return (
    <section aria-labelledby="admin-reserve-heading" className="border-y border-border py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="admin-reserve-heading" className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Landmark className="h-5 w-5 text-primary" /> Reserve
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Internal allocation · USD</span>
          <Button size="icon" variant="ghost" onClick={() => void load()} disabled={loading} aria-label="Refresh reserve" title="Refresh reserve">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`} />
          </Button>
        </div>
      </div>
      <dl aria-live="polite" className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-xs uppercase text-muted-foreground">Total reserve</dt>
          <dd className="mt-1 break-words text-xl font-bold tabular-nums text-foreground">{value(reserve?.total_allocation)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs uppercase text-muted-foreground">Available reserve</dt>
          <dd className="mt-1 break-words text-xl font-bold tabular-nums text-primary">{value(reserve?.available_balance)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs uppercase text-muted-foreground">Allocated to credits</dt>
          <dd className="mt-1 break-words text-xl font-semibold tabular-nums text-foreground">{value(reserve ? Number(reserve.total_allocation) - Number(reserve.available_balance) : undefined)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-sm text-muted-foreground">Internal bookkeeping allocation, not verified cash backing.</p>
      {error && <p role="alert" className="mt-2 text-sm text-destructive">Could not load the reserve. Try refreshing.</p>}
    </section>
  );
}