// Sends branded status-change confirmation emails to the sender and (if set)
// the recipient captured on the original transfer.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { sendEmail, brandedEmail } from "../_shared/gmail.ts";

const STATUS_COPY: Record<string, { label: string; note: string }> = {
  pending: { label: "Pending", note: "Your transfer is awaiting review by our compliance specialists." },
  processing: { label: "Processing", note: "Good news — our team has picked up your transfer and it is now being processed." },
  under_review: { label: "Under Review", note: "Your transfer is currently under review. You may be contacted for additional verification." },
  completed: { label: "Successful", note: "Your transfer has been approved and settled successfully." },
  failed: { label: "Failed", note: "Unfortunately your transfer could not be completed. No further action is required — please contact support if you have questions." },
  cancelled: { label: "Cancelled", note: "Your transfer has been cancelled. If this was unexpected, please reach out to support." },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const { transactionId, status } = body as { transactionId?: string; status?: string };
    if (!transactionId || !status) {
      return new Response(JSON.stringify({ error: "transactionId and status required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const copy = STATUS_COPY[status];
    if (!copy) {
      return new Response(JSON.stringify({ error: "invalid status" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .select("id, user_id, amount, description, category, reference_number, recipient_email, recipient_name, created_at")
      .eq("id", transactionId)
      .maybeSingle();
    if (txErr || !tx) throw new Error(txErr?.message || "Transaction not found");

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", tx.user_id)
      .maybeSingle();

    const amt = Number(tx.amount || 0);
    const amtStr = `$${Math.abs(amt).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const rows = `
      <table style="width:100%;border-collapse:collapse;margin-top:8px">
        <tr><td style="padding:6px 0;color:#6b7280;font-size:12px">Reference</td><td style="padding:6px 0;text-align:right;font-weight:600">${tx.reference_number || tx.id.slice(0,8)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;font-size:12px">Amount</td><td style="padding:6px 0;text-align:right;font-weight:600">${amtStr}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;font-size:12px">Type</td><td style="padding:6px 0;text-align:right">${tx.category || "Transfer"}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;font-size:12px">Date</td><td style="padding:6px 0;text-align:right">${new Date(tx.created_at as string).toLocaleString()}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;font-size:12px">New status</td><td style="padding:6px 0;text-align:right"><span style="background:#0b1e3f;color:#fff;padding:4px 10px;border-radius:999px;font-size:11px;text-transform:uppercase;letter-spacing:.05em">${copy.label}</span></td></tr>
      </table>`;

    const senderName = profile?.full_name || "Valued Customer";
    const senderBody = `
      <p>Hi ${senderName},</p>
      <p>${copy.note}</p>
      ${rows}
      <p style="margin-top:16px">${tx.description || ""}</p>`;

    const recipientBody = `
      <p>Hi${tx.recipient_name ? " " + tx.recipient_name : ""},</p>
      <p>A transfer sent to you from <strong>${senderName}</strong> has an updated status.</p>
      ${rows}
      <p style="margin-top:16px;color:#6b7280;font-size:12px">If you were not expecting this transfer, you can safely ignore this message.</p>`;

    const jobs: Promise<unknown>[] = [];
    if (profile?.email) {
      jobs.push(sendEmail(
        profile.email,
        `Your transfer is now ${copy.label} — ${tx.reference_number || tx.id.slice(0, 8)}`,
        brandedEmail(`Transfer ${copy.label}`, senderBody, "This is an automated notification from BoA private institute."),
      ));
    }
    if (tx.recipient_email) {
      jobs.push(sendEmail(
        tx.recipient_email,
        `Incoming transfer update — ${copy.label}`,
        brandedEmail(`Transfer ${copy.label}`, recipientBody, "This is an automated notification from BoA private institute."),
      ));
    }
    const results = await Promise.allSettled(jobs);
    const failed = results.filter(r => r.status === "rejected").map(r => (r as PromiseRejectedResult).reason?.message || String((r as PromiseRejectedResult).reason));

    return new Response(JSON.stringify({ ok: true, sent: results.length - failed.length, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-transaction-status-update failed", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
