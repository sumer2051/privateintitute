import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Bank's live coin prices: refreshed server-side every minute, read back from the database. */
export function useCoinRates() {
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const read = useCallback(async () => {
    const { data } = await supabase.from("coin_rates").select("symbol, usd, updated_at");
    if (data?.length) {
      setRates(Object.fromEntries(data.map((r) => [r.symbol, Number(r.usd)])));
      setUpdatedAt(data.map((r) => r.updated_at).sort().slice(-1)[0] ?? null);
      setFailed(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const { error } = await supabase.functions.invoke("refresh-coin-rates");
    await read();
    if (error) setFailed(true);
    setRefreshing(false);
  }, [read]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 60000);
    return () => clearInterval(t);
  }, [refresh]);

  return { rates, updatedAt, failed, refreshing, refresh };
}

/** Coin units held by the signed-in member, keyed by symbol. */
export function useTokenBalances() {
  const [balances, setBalances] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await supabase.from("token_balances").select("symbol, units").eq("user_id", u.user.id);
    setBalances(Object.fromEntries((data ?? []).map((r) => [r.symbol, Number(r.units)])));
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 15000);
    return () => clearInterval(t);
  }, [load]);

  return { balances, reload: load };
}
