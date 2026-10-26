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
  email: z.string().email().max(120),
  note: z.string().max(500).optional(),
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
    const { symbol, amount, address, email, note } = parsed.data;

    const amt = `${amount.toFixed(8)} ${esc(symbol)}`;
    const html = `<!doctype html><html><body style="margin:0;background:#000000;font-family:Helvetica,Arial,sans-serif;color:#ffffff">
<div style="max-width:560px;margin:0 auto;padding:24px 12px">
<div style="background:#0052ff;border-radius:28px;padding:64px 14px 14px">
<div style="background:#000000;border-radius:24px;padding:48px 28px 56px;text-align:center">
<div style="width:92px;height:92px;margin:0 auto 36px;border:3px solid #0052ff;border-radius:50%;line-height:92px;text-align:center;font-size:44px;color:#0052ff">&#10003;</div>
<h1 style="margin:0 0 14px;font-size:30px;font-weight:400;color:#ffffff">Withdrawal request</h1>
<p style="margin:0;font-size:17px;color:#a1a1aa">${amt}</p>
<hr style="border:0;border-top:1px solid #2a2f3a;margin:32px 12px">
<p style="font-size:16px;line-height:1.75;color:#ffffff;margin:0">You requested to withdraw ${amt} to <b style="word-break:break-all">${esc(address)}</b>. This request has not been processed, no coins have been sent, and your ${esc(symbol)} balance is unchanged.</p>
${note ? `<p style="font-size:15px;line-height:1.6;color:#a1a1aa;margin:20px 0 0;white-space:pre-wrap">${esc(note)}</p>` : ""}
</div></div>
<p style="text-align:left;font-size:13px;letter-spacing:.02em;color:#71717a;margin:24px 8px 0">If you don't recognise this request, contact support.</p>
</div></body></html>`;
    await sendEmail(email, `Withdrawal request ${amount.toFixed(8)} ${symbol}`, html);
    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Failed" }, 500);
  }
});
