import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { sendEmail } from "../_shared/gmail.ts";

// Honest notice only: no coins move, no approval, no transaction ID.
// Always sent to the signed-in member's own account email.
const Body = z.object({
  symbol: z.string().min(2).max(10).regex(/^[A-Z]+$/),
  amount: z.number().positive().max(1e12),
  address: z.string().min(10).max(120).regex(/^[A-Za-z0-9:]+$/),
});

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return json({ error: "Sign in required" }, 401);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { symbol, amount, address } = parsed.data;

    const html = `<!doctype html><html><body style="margin:0;background:#f5f6f8;font-family:Arial,sans-serif;color:#111827">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:28px 24px">
<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.06em;color:#b45309;text-transform:uppercase">Not processed · no coins sent</p>
<h1 style="margin:0 0 12px;font-size:20px">Withdrawal request received</h1>
<p style="font-size:14px;line-height:1.6;color:#374151">We received your request to withdraw <b>${esc(String(amount))} ${esc(symbol)}</b> to an external wallet. External withdrawals aren't available yet, so <b>no coins have left your account</b> and nothing will be sent to this address.</p>
<div style="background:#f3f4f6;border-radius:8px;padding:12px 14px;font-size:13px;margin:16px 0">
<div style="color:#6b7280">Wallet address entered</div><div style="font-family:monospace;word-break:break-all">${esc(address)}</div></div>
<p style="font-size:13px;color:#6b7280;margin:0">Your balance is unchanged. We'll let you know when external withdrawals become available.</p>
</div></div></body></html>`;
    await sendEmail(user.email, "Withdrawal request received — no coins sent", html);
    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Failed" }, 500);
  }
});
