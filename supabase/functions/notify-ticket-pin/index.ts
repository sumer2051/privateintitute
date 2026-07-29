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

    const { ticket_id } = await req.json();
    if (!ticket_id) return json({ error: "ticket_id required" }, 400);

    // Roles check
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", staffId);
    const roleSet = new Set((roles || []).map((r: any) => r.role));
    if (!roleSet.has("admin") && !roleSet.has("support") && !roleSet.has("tx_support")) {
      return json({ error: "Support staff only" }, 403);
    }

    // Claim the ticket (generates PIN if not set) via RPC
    const { data: claim, error: claimErr } = await supabase
      .rpc("staff_claim_ticket", { p_ticket: ticket_id })
      .single();
    if (claimErr) return json({ error: claimErr.message }, 500);

    const { pin, newly_generated } = claim as { pin: string; newly_generated: boolean };

    // Get ticket detail for email context
    const { data: ticket } = await supabase
      .from("support_tickets")
      .select("ticket_number, subject, customer_name, customer_email, priority, status")
      .eq("id", ticket_id)
      .single();

    let emailed = false;
    let emailError: string | null = null;
    if (ticket) {
      try {
        console.log("[notify-ticket-pin] sending to", ADMIN_EMAIL, "ticket", ticket.ticket_number, "newly_generated=", newly_generated);
        await sendEmail(
          ADMIN_EMAIL,
          `[Handoff PIN] Ticket ${ticket.ticket_number} — ${newly_generated ? "new claim" : "re-sent"}`,
          brandedEmail(
            `Staff handoff PIN`,
            `<p>${newly_generated ? "A support staff member has claimed a ticket." : "PIN re-sent for an already-claimed ticket."} Share the PIN below with the customer through a verified channel.</p>
             <div style="background:#0b1e3f;color:#fff;text-align:center;padding:18px;border-radius:10px;margin:16px 0">
               <div style="font-size:12px;opacity:.75;letter-spacing:1px">HANDOFF PIN</div>
               <div style="font-size:34px;font-weight:800;letter-spacing:8px;margin-top:4px">${pin}</div>
             </div>
             <table style="width:100%;border-collapse:collapse;font-size:13px">
               <tr><td style="padding:6px 0;color:#6b7280;width:130px">Ticket #</td><td style="font-weight:600">${ticket.ticket_number}</td></tr>
               <tr><td style="padding:6px 0;color:#6b7280">Subject</td><td>${escapeHtml(ticket.subject)}</td></tr>
               <tr><td style="padding:6px 0;color:#6b7280">Customer</td><td>${escapeHtml(ticket.customer_name)} &lt;${escapeHtml(ticket.customer_email)}&gt;</td></tr>
               <tr><td style="padding:6px 0;color:#6b7280">Priority</td><td>${ticket.priority}</td></tr>
               <tr><td style="padding:6px 0;color:#6b7280">Claimed by</td><td>${escapeHtml(staffEmail)}</td></tr>
             </table>`,
            `Share this PIN with the customer only through a verified channel.`,
          ),
        );
        emailed = true;
      } catch (e) {
        emailError = (e as Error).message;
        console.error("[notify-ticket-pin] email failed:", emailError);
      }
    }

    return json({ ok: true, pin, newly_generated, emailed, emailError });
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
