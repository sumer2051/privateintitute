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

    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${COINS.map((c) => c.id).join(",")}&vs_currencies=usd`,
      { headers: { accept: "application/json" } },
    );
    if (!r.ok) return json({ error: "Prices are unavailable right now" }, 502);
    const d = (await r.json()) as Record<string, { usd?: number } | undefined>;

    const rows = COINS.map((c) => ({ symbol: c.symbol, usd: Number(d?.[c.id]?.usd), updated_at: new Date().toISOString() }))
      .filter((x) => Number.isFinite(x.usd) && x.usd > 0);
    if (rows.length === 0) return json({ error: "Prices are unavailable right now" }, 502);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error } = await admin.from("coin_rates").upsert(rows, { onConflict: "symbol" });
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, rates: rows.map((x) => ({ symbol: x.symbol, usd: x.usd })) });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
