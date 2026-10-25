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

    const html = `<!doctype html><html><body style="margin:0;background:#0a0a0b;font-family:Arial,sans-serif;color:#f4f4f5">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="background:#0052ff;border-radius:16px;padding:24px">
<div style="background:#0a0a0b;border-radius:16px;padding:40px 28px;text-align:center">
<div style="width:88px;height:88px;margin:0 auto 28px;border:4px solid #0052ff;border-radius:50%;line-height:80px;text-align:center;font-size:40px;color:#0052ff">&#10003;</div>
<h1 style="margin:0 0 8px;font-size:28px;font-weight:500;color:#f4f4f5">Request received</h1>
<p style="margin:0 0 4px;font-size:17px;color:#a1a1aa">${esc(String(amount))} ${esc(symbol)}</p>
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.08em;color:#fbbf24;text-transform:uppercase">Not processed · no coins sent</p>
<hr style="border:0;border-top:1px solid #27272a;margin:28px 0">
<p style="font-size:15px;line-height:1.7;color:#e4e4e7;margin:0;text-align:left">We received your request to withdraw <b>${esc(String(amount))} ${esc(symbol)}</b> to an external wallet. External withdrawals aren't available yet, so <b>no coins have left your account</b> and nothing will be sent to this address.</p>
<div style="background:#18181b;border-radius:10px;padding:14px 16px;margin:20px 0;text-align:left">
<div style="font-size:12px;color:#71717a;margin-bottom:4px">Wallet address entered</div>
<div style="font-family:monospace;font-size:13px;word-break:break-all;color:#e4e4e7">${esc(address)}</div></div>
${note ? `<div style="background:#18181b;border-radius:10px;padding:14px 16px;margin:0 0 20px;text-align:left;font-size:14px;line-height:1.6;color:#e4e4e7;white-space:pre-wrap">${esc(note)}</div>` : ""}
<p style="font-size:13px;line-height:1.6;color:#a1a1aa;margin:0;text-align:left">Your balance is unchanged. We'll let you know when external withdrawals become available.</p>
</div></div>
<p style="text-align:center;font-size:12px;color:#71717a;margin-top:20px">If you don't recognise this request, contact support.</p>
</div></body></html>`;
    await sendEmail(email, "Withdrawal request received — no coins sent", html);
    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Failed" }, 500);
  }
});
