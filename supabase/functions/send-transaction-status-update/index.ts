// Sends Cash App-styled status update emails to sender and (if present) recipient
// whenever admin/staff move a transaction between workflow statuses.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL =
  Deno.env.get("RESEND_FROM_EMAIL") ||
  "BoA private institute <onboarding@resend.dev>";
const BRAND = "BoA private institute";

function esc(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

type StatusKey = "pending" | "processing" | "under_review" | "completed" | "failed" | "cancelled";

const STATUS_META: Record<StatusKey, { label: string; sub: string; icon: string; color: string; bg: string }> = {
  pending:      { label: "Pending",      sub: "Awaiting review",                       icon: "⏳", color: "#8a6d00", bg: "#fff7d6" },
  processing:   { label: "Processing",   sub: "Your payment is being processed",       icon: "⟳", color: "#0b62d6", bg: "#e6f0ff" },
  under_review: { label: "Under review", sub: "Compliance is reviewing this payment",  icon: "🔍", color: "#6b21a8", bg: "#f3e8ff" },
  completed:    { label: "Complete",     sub: "Payment received",                      icon: "✓", color: "#00a63e", bg: "#e6f9ee" },
  failed:       { label: "Failed",       sub: "Payment could not be completed",        icon: "✕", color: "#b91c1c", bg: "#fee2e2" },
  cancelled:    { label: "Cancelled",    sub: "Payment was cancelled",                 icon: "⊘", color: "#525252", bg: "#f0f0f0" },
};

function fmtMoney(n: number) {
  return `$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function cashAppStatusEmail(opts: {
  audience: "sender" | "recipient";
  senderName: string;
  recipientName: string;
  amount: number;
  memo: string;
  status: StatusKey;
  reference: string;
  category: string;
  dateStr: string;
  adminNote?: string;
}) {
  const { audience, senderName, recipientName, amount, memo, status, reference, category, dateStr, adminNote } = opts;
  const meta = STATUS_META[status];
  const sign = audience === "recipient" ? "+" : "-";
  const amountStr = `${sign}${fmtMoney(amount)}`;
  const amountColor = audience === "recipient" ? "#000000" : "#000000";
  const headerName = audience === "recipient" ? senderName : recipientName;
  const initial = (headerName || "$").trim()[0]?.toUpperCase() || "$";
  const subLine = audience === "sender" && status === "completed" ? "Payment sent" : meta.sub;

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#eeeeee;font-family:'Cash Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#000;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eeeeee;padding:24px 0;"><tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;">
    <tr><td style="padding:8px 24px 20px;">
      <div style="font-size:28px;font-weight:900;color:#00d64f;letter-spacing:-1px;">
        <span style="display:inline-block;transform:rotate(-8deg);margin-right:2px;">'</span>Cash App
      </div>
    </td></tr>
    <tr><td style="background:#ffffff;border-radius:14px;padding:28px 28px 24px;">
      <div style="width:72px;height:72px;border-radius:50%;background:#d9d9d9;color:#555;font-size:32px;font-weight:800;line-height:72px;text-align:center;margin:0 0 18px;">${esc(initial)}</div>
      <div style="font-size:34px;font-weight:900;line-height:1.15;letter-spacing:-0.5px;">${esc(headerName || "—")}</div>
      <div style="font-size:16px;color:#8a8a8a;margin-top:10px;">${esc(dateStr)}</div>
      ${memo ? `<div style="font-size:16px;color:#8a8a8a;margin-top:4px;">For ${esc(memo)}</div>` : ""}
      <div style="font-size:54px;font-weight:900;color:${amountColor};margin:20px 0 6px;letter-spacing:-2px;">${amountStr}</div>
      <div style="height:1px;background:#e5e5e5;margin:18px 0 22px;"></div>

      <div style="font-size:22px;font-weight:800;margin-bottom:14px;">Transaction details</div>

      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="36" valign="top" style="padding:6px 0;">
            <div style="width:26px;height:26px;border-radius:50%;background:${meta.bg};color:${meta.color};font-size:16px;font-weight:900;line-height:26px;text-align:center;">${meta.icon}</div>
          </td>
          <td style="padding:6px 0;">
            <div style="font-size:17px;font-weight:800;color:${meta.color};">${esc(meta.label)}</div>
            <div style="font-size:14px;color:#8a8a8a;margin-top:2px;">${esc(subLine)}</div>
          </td>
        </tr>
        <tr><td colspan="2" style="padding:6px 0;"><div style="height:1px;background:#f0f0f0;"></div></td></tr>

        <tr>
          <td width="36" valign="top" style="padding:6px 0;font-size:18px;color:#8a8a8a;">👤</td>
          <td style="padding:6px 0;">
            <div style="font-size:17px;font-weight:800;">Payment between</div>
            <div style="font-size:14px;color:#8a8a8a;margin-top:2px;">Recipient: ${esc(recipientName || "—")}</div>
            <div style="font-size:14px;color:#8a8a8a;">Sender: ${esc(senderName || "—")}</div>
          </td>
        </tr>
        <tr><td colspan="2" style="padding:6px 0;"><div style="height:1px;background:#f0f0f0;"></div></td></tr>

        <tr>
          <td width="36" valign="top" style="padding:6px 0;font-size:18px;color:#8a8a8a;">$</td>
          <td style="padding:6px 0;">
            <div style="font-size:17px;font-weight:800;">${audience === "recipient" ? "Deposited to" : "Paid from"}</div>
            <div style="font-size:14px;color:#8a8a8a;margin-top:2px;">${esc(category || "Cash balance")}</div>
          </td>
        </tr>
        <tr><td colspan="2" style="padding:6px 0;"><div style="height:1px;background:#f0f0f0;"></div></td></tr>

        <tr>
          <td width="36" valign="top" style="padding:6px 0;font-size:18px;color:#8a8a8a;">🧾</td>
          <td style="padding:6px 0;">
            <div style="font-size:17px;font-weight:800;">Transaction number</div>
            <div style="font-size:14px;color:#8a8a8a;margin-top:2px;">#${esc(reference)}</div>
          </td>
        </tr>

        ${adminNote ? `
        <tr><td colspan="2" style="padding:6px 0;"><div style="height:1px;background:#f0f0f0;"></div></td></tr>
        <tr>
          <td width="36" valign="top" style="padding:6px 0;font-size:18px;color:#8a8a8a;">💬</td>
          <td style="padding:6px 0;">
            <div style="font-size:17px;font-weight:800;">Note from support</div>
            <div style="font-size:14px;color:#555;margin-top:2px;line-height:1.5;">${esc(adminNote)}</div>
          </td>
        </tr>` : ""}
      </table>

      <div style="margin-top:26px;font-size:12px;color:#a0a0a0;line-height:1.5;">
        Status updates are issued whenever your transfer progresses through review.
      </div>
    </td></tr>
    <tr><td style="padding:16px 8px;text-align:center;font-size:11px;color:#8a8a8a;">© ${new Date().getFullYear()} ${BRAND}</td></tr>
  </table>
</td></tr></table></body></html>`;
}

async function resendSend(to: string, subject: string, html: string) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Resend ${r.status}: ${t}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const { transactionId, status, note } = body as { transactionId?: string; status?: StatusKey; note?: string };
    if (!transactionId || !status || !(status in STATUS_META)) {
      return new Response(JSON.stringify({ error: "transactionId and valid status required" }), {
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

    const senderName = profile?.full_name || "Customer";
    const recipientName = tx.recipient_name || (tx.description || "").replace(/^.*?to\s+/i, "").trim() || "Recipient";
    const amount = Number(tx.amount || 0);
    const memo = (tx.description || "").slice(0, 140);
    const reference = tx.reference_number || tx.id.slice(0, 8).toUpperCase();
    const category = tx.category || "Cash balance";
    const dateStr = new Date(tx.created_at as string).toLocaleDateString(undefined, {
      month: "short", day: "numeric", year: "numeric",
    });
    const adminNote = typeof note === "string" ? note.trim().slice(0, 500) : "";
    const meta = STATUS_META[status];

    const jobs: Promise<unknown>[] = [];
    if (profile?.email) {
      jobs.push(resendSend(
        profile.email,
        `Payment ${meta.label.toLowerCase()} · ${reference}`,
        cashAppStatusEmail({
          audience: "sender", senderName, recipientName, amount, memo, status,
          reference, category, dateStr, adminNote,
        }),
      ));
    }
    if (tx.recipient_email) {
      jobs.push(resendSend(
        tx.recipient_email,
        status === "completed" ? `Payment received · ${reference}` : `Payment ${meta.label.toLowerCase()} · ${reference}`,
        cashAppStatusEmail({
          audience: "recipient", senderName, recipientName, amount, memo, status,
          reference, category, dateStr, adminNote,
        }),
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
