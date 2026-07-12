import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendEmail, brandedEmail } from "../_shared/gmail.ts";

const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "admin@example.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: c } = await supabase.auth.getClaims(auth.replace("Bearer ", ""));
    if (!c?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = c.claims.sub as string;
    const meta = (c.claims.user_metadata as any) || {};

    const b = await req.json();
    const scheduled_at = b.scheduled_at;
    if (!scheduled_at) return json({ error: "scheduled_at required" }, 400);
    const email = String(b.email || c.claims.email || "").slice(0, 200);
    const phone = String(b.phone || "").slice(0, 40);
    const reason = String(b.reason || "").slice(0, 500);
    const timezone = String(b.timezone || "UTC").slice(0, 60);
    const customer_name = String(b.customer_name || meta.full_name || email).slice(0, 120);
    if (!phone || !reason) return json({ error: "phone and reason required" }, 400);

    const { data: call, error } = await supabase
      .from("scheduled_calls")
      .insert({ user_id: userId, customer_name, email, phone, reason, scheduled_at, timezone })
      .select()
      .single();
    if (error) return json({ error: error.message }, 500);

    const when = new Date(scheduled_at).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" });

    try {
      await sendEmail(email, `Your call is scheduled — ${when}`, brandedEmail(
        `Call scheduled`,
        `<p>Hi ${escapeHtml(customer_name)},</p>
         <p>Your call with a BoA private institute specialist is confirmed.</p>
         <table style="width:100%;font-size:13px;margin:12px 0">
           <tr><td style="color:#6b7280;padding:4px 0;width:120px">When</td><td><b>${escapeHtml(when)}</b></td></tr>
           <tr><td style="color:#6b7280;padding:4px 0">Timezone</td><td>${escapeHtml(timezone)}</td></tr>
           <tr><td style="color:#6b7280;padding:4px 0">Phone</td><td>${escapeHtml(phone)}</td></tr>
           <tr><td style="color:#6b7280;padding:4px 0">Reason</td><td>${escapeHtml(reason)}</td></tr>
         </table>
         <p>We'll call you at the number above. A reminder will arrive before the call.</p>`,
        "Need to reschedule? Reply to this email or open the Support page in your account."
      ));
    } catch (e) { console.error("user call email failed", e); }

    try {
      await sendEmail(ADMIN_EMAIL, `New scheduled call — ${when}`, brandedEmail(
        `New scheduled call`,
        `<p><b>${escapeHtml(customer_name)}</b> &lt;${escapeHtml(email)}&gt;</p>
         <p><b>Phone:</b> ${escapeHtml(phone)}<br><b>When:</b> ${escapeHtml(when)} (${escapeHtml(timezone)})<br><b>Reason:</b> ${escapeHtml(reason)}</p>`,
        "Open the admin dashboard to accept, reschedule, or add notes."
      ));
    } catch (e) { console.error("admin call email failed", e); }

    return json({ ok: true, call });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]!));
}
