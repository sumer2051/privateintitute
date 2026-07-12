import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendEmail, brandedEmail } from "../_shared/gmail.ts";

const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "admin@example.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: c } = await supabase.auth.getClaims(auth.replace("Bearer ", ""));
    if (!c?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = c.claims.sub as string;
    const userEmail = (c.claims.email as string) || "";
    const meta = (c.claims.user_metadata as any) || {};

    const body = await req.json();
    const subject = String(body.subject || "").slice(0, 200).trim();
    const description = String(body.description || "").slice(0, 5000).trim();
    const priority = ["low","medium","high","urgent"].includes(body.priority) ? body.priority : "medium";
    const category = body.category ? String(body.category).slice(0, 80) : null;
    const customerName = String(body.customer_name || meta.full_name || userEmail).slice(0, 120);
    const customerEmail = String(body.customer_email || userEmail).slice(0, 200);
    const aiSummary = body.ai_summary ? String(body.ai_summary).slice(0, 2000) : null;
    const source = body.source === "ai" ? "ai" : "user";

    if (!subject || !description) return json({ error: "subject and description required" }, 400);

    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .insert({
        user_id: userId,
        customer_name: customerName,
        customer_email: customerEmail,
        subject, description, category, priority,
        ai_summary: aiSummary, source,
      })
      .select()
      .single();
    if (error) return json({ error: error.message }, 500);

    await supabase.from("ticket_messages").insert({
      ticket_id: ticket.id,
      sender_type: source === "ai" ? "ai" : "customer",
      sender_id: userId,
      message: description,
    });

    // Emails (best-effort)
    const priorityColor: Record<string,string> = {
      low: "#059669", medium: "#0b1e3f", high: "#d97706", urgent: "#dc2626"
    };
    try {
      await sendEmail(
        customerEmail,
        `We received your request — ${ticket.ticket_number}`,
        brandedEmail(
          `Ticket ${ticket.ticket_number} received`,
          `<p>Hi ${escapeHtml(customerName)},</p>
           <p>Thanks for contacting BoA private institute support. Your request has been logged and a specialist will respond within 24 hours.</p>
           <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px">
             <tr><td style="padding:6px 0;color:#6b7280;width:120px">Ticket #</td><td style="font-weight:600">${ticket.ticket_number}</td></tr>
             <tr><td style="padding:6px 0;color:#6b7280">Subject</td><td>${escapeHtml(subject)}</td></tr>
             <tr><td style="padding:6px 0;color:#6b7280">Priority</td><td><span style="background:${priorityColor[priority]};color:#fff;padding:2px 10px;border-radius:12px;font-size:11px;text-transform:uppercase">${priority}</span></td></tr>
           </table>
           <p style="background:#f9fafb;padding:12px;border-radius:8px;font-size:13px">${escapeHtml(description).replace(/\n/g,"<br>")}</p>`,
          `Reference this ticket number in any reply. For your security we will never ask for passwords or one-time codes by email.`
        )
      );
    } catch (e) { console.error("user email failed", e); }

    try {
      await sendEmail(
        ADMIN_EMAIL,
        `[${priority.toUpperCase()}] New ticket ${ticket.ticket_number} — ${subject}`,
        brandedEmail(
          `New support ticket`,
          `<p><b>${ticket.ticket_number}</b> · <span style="color:${priorityColor[priority]}">${priority.toUpperCase()}</span></p>
           <p><b>From:</b> ${escapeHtml(customerName)} &lt;${escapeHtml(customerEmail)}&gt;</p>
           <p><b>Subject:</b> ${escapeHtml(subject)}</p>
           <p style="background:#f9fafb;padding:12px;border-radius:8px">${escapeHtml(description).replace(/\n/g,"<br>")}</p>
           ${aiSummary ? `<p><b>AI summary:</b> ${escapeHtml(aiSummary)}</p>` : ""}`,
          `Open the admin dashboard to reply.`
        )
      );
    } catch (e) { console.error("admin email failed", e); }

    return json({ ok: true, ticket });
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
  return s.replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]!));
}
