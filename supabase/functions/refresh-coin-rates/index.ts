import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const COINS = [
  { id: "bitcoin", symbol: "BTC" },
  { id: "ethereum", symbol: "ETH" },
  { id: "tether", symbol: "USDT" },
  { id: "binancecoin", symbol: "BNB" },
  { id: "solana", symbol: "SOL" },
  { id: "ripple", symbol: "XRP" },
  { id: "usd-coin", symbol: "USDC" },
  { id: "dogecoin", symbol: "DOGE" },
  { id: "cardano", symbol: "ADA" },
  { id: "tron", symbol: "TRX" },
  { id: "litecoin", symbol: "LTC" },
];

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const user = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await user.auth.getUser();
    if (!u.user) return json({ error: "Not signed in" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Skip the outside call when every price was refreshed in the last 45s (avoids rate limits).
    const { data: stored } = await admin.from("coin_rates").select("symbol, usd, updated_at");
    const cutoff = Date.now() - 45_000;
    if (stored && COINS.every((c) => stored.some((s) => s.symbol === c.symbol && new Date(s.updated_at).getTime() > cutoff))) {
      return json({ ok: true, cached: true });
    }

    const prices: Record<string, number> = {};
    try {
      const r = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${COINS.map((c) => c.id).join(",")}&vs_currencies=usd`,
        { headers: { accept: "application/json" } },
      );
      if (r.ok) {
        const d = (await r.json()) as Record<string, { usd?: number } | undefined>;
        for (const c of COINS) { const v = Number(d?.[c.id]?.usd); if (Number.isFinite(v) && v > 0) prices[c.symbol] = v; }
      } else await r.body?.cancel();
    } catch { /* fall through to backup source */ }

    if (COINS.some((c) => !prices[c.symbol])) {
      try {
        const r = await fetch("https://api.coinbase.com/v2/exchange-rates?currency=USD", { headers: { accept: "application/json" } });
        if (r.ok) {
          const d = (await r.json()) as { data?: { rates?: Record<string, string> } };
          for (const c of COINS) {
            const per = Number(d?.data?.rates?.[c.symbol]);
            if (!prices[c.symbol] && Number.isFinite(per) && per > 0) prices[c.symbol] = 1 / per;
          }
        } else await r.body?.cancel();
      } catch { /* both sources down */ }
    }

    const now = new Date().toISOString();
    const rows = Object.entries(prices).map(([symbol, usd]) => ({ symbol, usd, updated_at: now }));
    if (rows.length === 0) return json({ ok: false, stale: true, message: "Live prices are temporarily unavailable; showing last known prices." });

    const { error } = await admin.from("coin_rates").upsert(rows, { onConflict: "symbol" });
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, rates: rows.map((x) => ({ symbol: x.symbol, usd: x.usd })) });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
