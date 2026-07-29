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
    const staffId = c.claims.sub as string;
    const staffEmail = (c.claims.email as string) || "";

    const { ticket_id, ticket_number } = await req.json();
    if (!ticket_id && !ticket_number) return json({ error: "ticket_id or ticket_number required" }, 400);

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", staffId);
    const roleSet = new Set((roles || []).map((r: any) => r.role));
    if (!roleSet.has("admin") && !roleSet.has("support") && !roleSet.has("tx_support")) {
      return json({ error: "Support staff only" }, 403);
    }

    let query = supabase
      .from("support_tickets")
      .select("id, ticket_number, subject, customer_name, customer_email, priority, status, staff_reply_pin");
    query = ticket_id ? query.eq("id", ticket_id) : query.eq("ticket_number", ticket_number);
    const { data: ticket, error: tErr } = await query.maybeSingle();
    if (tErr || !ticket) return json({ error: "Ticket not found" }, 404);

    let pin = ticket.staff_reply_pin as string | null;
    if (!pin || pin.length !== 8) {
      const { data: claim, error: claimErr } = await supabase
        .rpc("staff_claim_ticket", { p_ticket: ticket.id })
        .single();
      if (claimErr) return json({ error: claimErr.message }, 500);
      pin = (claim as any).pin as string;
    }

    await sendEmail(
      ADMIN_EMAIL,
      `[Handoff PIN Resend] Ticket ${ticket.ticket_number}`,
      brandedEmail(
        `Handoff PIN (resent)`,
        `<p>A staff member requested a resend of the handoff PIN for this ticket.</p>
         <div style="background:#0b1e3f;color:#fff;text-align:center;padding:18px;border-radius:10px;margin:16px 0">
           <div style="font-size:12px;opacity:.75;letter-spacing:1px">HANDOFF PIN</div>
           <div style="font-size:34px;font-weight:800;letter-spacing:8px;margin-top:4px">${pin}</div>
         </div>
         <table style="width:100%;border-collapse:collapse;font-size:13px">
           <tr><td style="padding:6px 0;color:#6b7280;width:130px">Ticket #</td><td style="font-weight:600">${ticket.ticket_number}</td></tr>
           <tr><td style="padding:6px 0;color:#6b7280">Subject</td><td>${escapeHtml(ticket.subject)}</td></tr>
           <tr><td style="padding:6px 0;color:#6b7280">Customer</td><td>${escapeHtml(ticket.customer_name)} &lt;${escapeHtml(ticket.customer_email)}&gt;</td></tr>
           <tr><td style="padding:6px 0;color:#6b7280">Priority</td><td>${ticket.priority}</td></tr>
           <tr><td style="padding:6px 0;color:#6b7280">Requested by</td><td>${escapeHtml(staffEmail)}</td></tr>
         </table>`,
        `Only share this PIN with the customer through a verified channel.`,
      ),
    );

    try {
      await supabase.rpc("log_staff_action", {
        _action: "ticket.pin_resend",
        _target_type: "support_ticket",
        _target_id: ticket.id,
        _meta: { ticket_number: ticket.ticket_number },
      });
    } catch (_) { /* non-fatal */ }

    return json({ ok: true, ticket_number: ticket.ticket_number });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
