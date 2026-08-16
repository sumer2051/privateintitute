// Sends brand-styled status update emails to sender and (if present) recipient
// whenever admin/staff move a transaction between workflow statuses.
// The email style matches the transfer method used (Cash App, Venmo, PayPal, Zelle, or generic bank).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL =
  Deno.env.get("RESEND_FROM_EMAIL") ||
  "BoA private institute <onboarding@resend.dev>";
const BRAND = "BoA private institute";
const LOGO_URL = "https://boaprivatebank.lovable.app/logo.png";

function esc(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

type StatusKey = "pending" | "processing" | "under_review" | "reviewed" | "completed" | "failed" | "cancelled";

const STATUS_META: Record<StatusKey, { label: string; sub: string; icon: string; color: string; bg: string }> = {
  pending:      { label: "Pending",      sub: "Awaiting review",                       icon: "⏳", color: "#8a6d00", bg: "#fff7d6" },
  processing:   { label: "Processing",   sub: "Your payment is being processed",       icon: "⟳", color: "#0b62d6", bg: "#e6f0ff" },
  under_review: { label: "Under review", sub: "Compliance is reviewing this payment",  icon: "🔍", color: "#6b21a8", bg: "#f3e8ff" },
  reviewed:     { label: "Reviewed — clearance ongoing", sub: "Review complete, clearance in progress", icon: "🛡", color: "#0e7490", bg: "#e0f7fb" },
  completed:    { label: "Complete",     sub: "Payment received",                      icon: "✓", color: "#00a63e", bg: "#e6f9ee" },
  failed:       { label: "Failed",       sub: "Payment could not be completed",        icon: "✕", color: "#b91c1c", bg: "#fee2e2" },
  cancelled:    { label: "Cancelled",    sub: "Payment was cancelled",                 icon: "⊘", color: "#525252", bg: "#f0f0f0" },
};


// Balances/transactions are stored in USD; emails render in the customer's
// preferred currency so a SEPA transfer shows € rather than $.
const CURRENCY_RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.78, JPY: 157, CAD: 1.36, AUD: 1.52, CHF: 0.88,
  CNY: 7.24, INR: 83.2, MXN: 17.1, BRL: 5.05, NGN: 1550, ZAR: 18.5, AED: 3.67,
};
const CURRENCY_LOCALES: Record<string, string> = {
  USD: "en-US", EUR: "de-DE", GBP: "en-GB", JPY: "ja-JP", CAD: "en-CA",
  AUD: "en-AU", CHF: "de-CH", CNY: "zh-CN", INR: "en-IN", MXN: "es-MX",
  BRL: "pt-BR", NGN: "en-NG", ZAR: "en-ZA", AED: "ar-AE",
};

function fmtMoney(n: number, code = "USD") {
  const cur = CURRENCY_RATES[code] ? code : "USD";
  const value = Math.abs(n) * (CURRENCY_RATES[cur] ?? 1);
  try {
    return new Intl.NumberFormat(CURRENCY_LOCALES[cur] || "en-US", {
      style: "currency", currency: cur,
      minimumFractionDigits: cur === "JPY" ? 0 : 2,
      maximumFractionDigits: cur === "JPY" ? 0 : 2,
    }).format(value);
  } catch {
    return `${cur} ${value.toFixed(2)}`;
  }
}

type Ctx = {
  audience: "sender" | "recipient";
  senderName: string;
  recipientName: string;
  amount: number;
  memo: string;
  currencyCode: string;
  status: StatusKey;
  reference: string;
  category: string;
  dateStr: string;
  adminNote?: string;
};

// ---------- Cash App status email ----------
function cashappStatusEmail(c: Ctx) {
  const meta = STATUS_META[c.status];
  const sign = c.audience === "recipient" ? "+" : "-";
  const amountStr = `${sign}${fmtMoney(c.amount, c.currencyCode)}`;
  const headerName = c.audience === "recipient" ? c.senderName : c.recipientName;
  const initial = (headerName || "$").trim()[0]?.toUpperCase() || "$";
  const subLine = c.audience === "sender" && c.status === "completed" ? "Payment sent" : meta.sub;

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
      <div style="font-size:16px;color:#8a8a8a;margin-top:10px;">${esc(c.dateStr)}</div>
      <div style="font-size:54px;font-weight:900;color:#000;margin:20px 0 6px;letter-spacing:-2px;">${amountStr}</div>
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
            <div style="font-size:14px;color:#8a8a8a;margin-top:2px;">Recipient: ${esc(c.recipientName || "—")}</div>
            <div style="font-size:14px;color:#8a8a8a;">Sender: ${esc(c.senderName || "—")}</div>
          </td>
        </tr>
        <tr><td colspan="2" style="padding:6px 0;"><div style="height:1px;background:#f0f0f0;"></div></td></tr>
        <tr>
          <td width="36" valign="top" style="padding:6px 0;font-size:18px;color:#8a8a8a;">$</td>
          <td style="padding:6px 0;">
            <div style="font-size:17px;font-weight:800;">${c.audience === "recipient" ? "Deposited to" : "Paid from"}</div>
            <div style="font-size:14px;color:#8a8a8a;margin-top:2px;">${esc(c.category || "Cash balance")}</div>
          </td>
        </tr>
        <tr><td colspan="2" style="padding:6px 0;"><div style="height:1px;background:#f0f0f0;"></div></td></tr>
        <tr>
          <td width="36" valign="top" style="padding:6px 0;font-size:18px;color:#8a8a8a;">🧾</td>
          <td style="padding:6px 0;">
            <div style="font-size:17px;font-weight:800;">Transaction number</div>
            <div style="font-size:14px;color:#8a8a8a;margin-top:2px;">#${esc(c.reference)}</div>
          </td>
        </tr>
        ${c.adminNote ? `
        <tr><td colspan="2" style="padding:6px 0;"><div style="height:1px;background:#f0f0f0;"></div></td></tr>
        <tr>
          <td width="36" valign="top" style="padding:6px 0;font-size:18px;color:#8a8a8a;">💬</td>
          <td style="padding:6px 0;">
            <div style="font-size:17px;font-weight:800;">Note from support</div>
            <div style="font-size:14px;color:#555;margin-top:2px;line-height:1.5;">${esc(c.adminNote)}</div>
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

// ---------- Venmo status email (matches native "Balance transfer" style) ----------
function venmoStatusEmail(c: Ctx) {
  const meta = STATUS_META[c.status];
  const amountStr = `${c.audience === "recipient" ? "+" : "-"}${fmtMoney(c.amount, c.currencyCode)}`;
  const txId = c.reference.replace(/[^A-Za-z0-9]/g, "").padEnd(19, "0").slice(0, 19);
  const from = `Venmo balance ${esc(c.senderName)}`;
  const destination = `Venmo balance ${esc(c.recipientName)}`;
  const label = (t: string) => `<div style="font-size:12px;font-weight:700;letter-spacing:0.5px;color:#2f3033;text-transform:uppercase;margin-top:22px;">${t}</div>`;
  const value = (t: string) => `<div style="font-size:16px;color:#2f3033;margin-top:4px;line-height:1.4;">${t}</div>`;

  const heading = c.status === "completed"
    ? "Balance transfer Complete"
    : c.status === "failed"
      ? "Balance transfer Failed"
      : c.status === "cancelled"
        ? "Balance transfer Cancelled"
        : c.status === "under_review"
          ? "Balance transfer Under Review"
          : c.status === "reviewed"
            ? "Balance transfer Reviewed — Clearance Ongoing"
          : c.status === "processing"
            ? "Balance transfer Processing"
            : "Balance transfer Pending";

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;color:#2f3033;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;background:#ffffff;"><tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;padding:0 24px;">
    <tr><td style="padding:8px 0 24px;">
      <div style="width:72px;height:72px;border-radius:50%;background:#008cff;text-align:center;line-height:72px;">
        <span style="color:#ffffff;font-size:38px;font-weight:900;font-style:italic;font-family:'Helvetica Neue',Arial,sans-serif;letter-spacing:-1px;">v</span>
      </div>
    </td></tr>
    <tr><td>
      <h1 style="margin:0;font-size:28px;font-weight:400;color:#2f3033;letter-spacing:-0.3px;">${heading}</h1>
      <div style="margin-top:14px;font-size:16px;color:#2f3033;">Updated on ${esc(c.dateStr)}</div>

      <div style="margin-top:22px;display:inline-block;padding:8px 14px;border-radius:999px;background:${meta.bg};color:${meta.color};font-size:13px;font-weight:800;">
        <span style="margin-right:6px;">${meta.icon}</span>${esc(meta.label)} · ${esc(meta.sub)}
      </div>

      ${label("Transfer amount")}
      ${value(esc(amountStr))}

      ${label("From")}
      ${value(from)}

      ${label("Destination")}
      ${value(destination)}

      ${label("Transaction ID")}
      ${value(txId)}

      ${c.adminNote ? `${label("Note from support")}${value(esc(c.adminNote))}` : ""}

      <div style="margin-top:32px;font-size:15px;color:#2f3033;line-height:1.55;">
        Transfers are reviewed which may result in delays or funds being frozen or removed from your Venmo account. <a href="#" style="color:#008cff;text-decoration:none;">Learn more</a>.
      </div>
      <div style="margin-top:16px;font-size:15px;color:#2f3033;line-height:1.55;">
        You can see the status of your transfers by visiting your <a href="#" style="color:#008cff;text-decoration:none;">Account Statement</a>.
      </div>
      <div style="margin-top:16px;font-size:15px;color:#2f3033;line-height:1.55;">
        Important: This transfer was initiated by ${esc(c.senderName)}. If you didn't make this request, please visit our Help Center at <a href="#" style="color:#008cff;text-decoration:none;">help.venmo.com</a> or call <a href="#" style="color:#008cff;text-decoration:none;">(855) 812-4430</a>.
      </div>
      <div style="margin-top:16px;font-size:15px;color:#2f3033;line-height:1.55;">
        For any issues, including the recipient not receiving funds, please visit our Help Center at <a href="#" style="color:#008cff;text-decoration:none;">help.venmo.com</a> or call <a href="#" style="color:#008cff;text-decoration:none;">(855) 812-4430</a>.
      </div>
      <div style="margin-top:28px;font-size:13px;color:#8b9098;line-height:1.55;">
        Venmo is a service of PayPal, Inc., a licensed provider of money transfer services. All money transmission is provided by PayPal, Inc. pursuant to PayPal, Inc.'s <a href="#" style="color:#8b9098;text-decoration:underline;">licenses</a>.
      </div>
      <div style="margin-top:12px;font-size:13px;color:#8b9098;line-height:1.55;">
        PayPal is located at <a href="#" style="color:#8b9098;text-decoration:underline;">2211 North First Street, San Jose, CA 95131</a>.
      </div>
      <div style="margin-top:28px;padding-bottom:24px;">
        <span style="color:#008cff;font-size:32px;font-weight:900;font-style:italic;letter-spacing:-1px;font-family:'Helvetica Neue',Arial,sans-serif;">venmo</span>
      </div>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

// ---------- PayPal status email ----------
function paypalStatusEmail(c: Ctx) {
  const meta = STATUS_META[c.status];
  const amountStr = fmtMoney(c.amount, c.currencyCode);
  const headline = c.audience === "sender"
    ? `Your payment to ${esc(c.recipientName)} is ${esc(meta.label.toLowerCase())}`
    : `Payment from ${esc(c.senderName)} is ${esc(meta.label.toLowerCase())}`;
  const greetingName = c.audience === "sender" ? c.senderName : c.recipientName;
  const paypalLogo = `<span style="font-size:28px;font-weight:900;font-style:italic;letter-spacing:-1.5px;line-height:1;"><span style="color:#003087;">Pay</span><span style="color:#009cde;">Pal</span></span>`;
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f2f2f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#000;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2;padding:24px 0;"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
    <tr><td style="padding:16px 24px;">${paypalLogo}</td></tr>
    <tr><td style="padding:8px 24px 4px;text-align:center;font-size:14px;color:#6c7378;">Hello, ${esc(greetingName)}</td></tr>
    <tr><td style="padding:24px;">
      <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:${meta.bg};color:${meta.color};font-size:12px;font-weight:800;margin-bottom:12px;">
        ${meta.icon} ${esc(meta.label)}
      </div>
      <h1 style="margin:0;font-size:36px;line-height:1.1;font-weight:900;color:#000;letter-spacing:-1px;">${headline}</h1>
    </td></tr>
    <tr><td style="padding:0 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;">
        <tr><td style="padding:28px 28px 8px;">
          <div style="font-size:16px;font-weight:800;color:#000;">Amount</div>
          <div style="font-size:16px;color:#2c2e2f;margin-top:4px;">${amountStr}</div>
        </td></tr>
        <tr><td style="padding:16px 28px 8px;">
          <div style="font-size:16px;font-weight:800;color:#000;">Transaction date</div>
          <div style="font-size:16px;color:#2c2e2f;margin-top:4px;">${esc(c.dateStr)}</div>
        </td></tr>
        <tr><td style="padding:16px 28px 8px;">
          <div style="font-size:16px;font-weight:800;color:#000;">Transaction ID</div>
          <div style="font-size:16px;color:#2c2e2f;margin-top:4px;font-family:monospace;">${esc(c.reference)}</div>
        </td></tr>
        <tr><td style="padding:16px 28px 8px;">
          <div style="font-size:16px;font-weight:800;color:#000;">Status</div>
          <div style="font-size:16px;color:${meta.color};margin-top:4px;font-weight:700;">${esc(meta.label)} — ${esc(meta.sub)}</div>
        </td></tr>
        ${c.adminNote ? `<tr><td style="padding:16px 28px 8px;">
          <div style="font-size:14px;font-weight:800;color:#000;">Note from support</div>
          <div style="font-size:15px;color:#2c2e2f;margin-top:4px;line-height:1.5;">${esc(c.adminNote)}</div>
        </td></tr>` : ""}
        <tr><td style="padding:24px 28px 32px;text-align:center;">
          <a href="https://www.paypal.com" style="display:inline-block;background:#000;color:#fff;text-decoration:none;font-weight:700;font-size:17px;padding:16px 56px;border-radius:999px;">Go to PayPal</a>
        </td></tr>
        <tr><td style="padding:8px 0 28px;text-align:center;">${paypalLogo}</td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:20px 24px;text-align:center;font-size:11px;color:#8a8a8a;line-height:1.5;">
      Ref ${esc(c.reference)} · © ${new Date().getFullYear()} ${BRAND}
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

// ---------- Zelle status email ----------
function zelleStatusEmail(c: Ctx) {
  const meta = STATUS_META[c.status];
  const amountStr = fmtMoney(c.amount, c.currencyCode);
  const senderUpper = esc((c.senderName || "").toUpperCase());
  const recipUpper = esc((c.recipientName || "").toUpperCase());
  const headline = c.audience === "recipient"
    ? `${senderUpper} — payment ${esc(meta.label.toLowerCase())}`
    : `Your payment to ${recipUpper} is ${esc(meta.label.toLowerCase())}`;

  const row = (label: string, value: string) => `
    <tr><td style="padding:14px 0 10px;border-bottom:1px solid #d9d9d9;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:14px;color:#4a4a4a;">${esc(label)}</td>
        <td align="right" style="font-size:15px;font-weight:700;color:#000;">${esc(value)}</td>
      </tr></table>
    </td></tr>`;

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#111;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:0;">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
    <tr><td style="background:#e5e7eb;height:22px;line-height:22px;font-size:0;">&nbsp;</td></tr>
    <tr><td style="background:#1a55c9;padding:28px 22px 40px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:2px;">
        <tr><td style="padding:26px 26px 8px;">
          <span style="display:inline-block;background:#e9eaec;color:#111;font-size:13px;font-weight:700;padding:6px 12px;border-radius:999px;">Zelle<sup style="font-size:9px;">®</sup> payment</span>
          <span style="display:inline-block;margin-left:8px;padding:6px 12px;border-radius:999px;background:${meta.bg};color:${meta.color};font-size:12px;font-weight:800;">${meta.icon} ${esc(meta.label)}</span>
        </td></tr>
        <tr><td style="padding:14px 26px 6px;">
          <h1 style="margin:0;font-size:24px;line-height:1.2;font-weight:800;color:#111;">${headline}</h1>
        </td></tr>
        <tr><td style="padding:14px 26px 4px;font-size:14px;color:#4a4a4a;">Here are the details:</td></tr>
        <tr><td style="padding:6px 26px 8px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${row("Amount", amountStr)}
            ${row("Updated on", c.dateStr)}
            ${row("Transaction number", c.reference)}
            ${row("Status", `${meta.label} — ${meta.sub}`)}
          </table>
        </td></tr>
        ${c.adminNote ? `<tr><td style="padding:12px 26px 0;font-size:14px;color:#3a3a3a;line-height:1.55;">
          <strong>Note from support:</strong> ${esc(c.adminNote)}
        </td></tr>` : ""}
        <tr><td style="padding:16px 26px 28px;">
          <a href="https://www.zellepay.com" style="display:inline-block;background:#1a55c9;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:11px 20px;border-radius:4px;">Go to Zelle®</a>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:18px 24px 6px;font-size:12px;color:#4a4a4a;line-height:1.55;">
      Questions? Visit <a href="#" style="color:#1a55c9;">zellepay.com/support</a> or contact us at 1-800-935-9935
    </td></tr>
    <tr><td style="background:#f2f2f2;padding:12px 24px;font-size:11px;letter-spacing:1.5px;color:#6a6a6a;">ABOUT THIS MESSAGE</td></tr>
    <tr><td style="padding:14px 24px 24px;font-size:11px;color:#8a8a8a;line-height:1.55;">
      Zelle® and the Zelle® related marks are wholly owned by Early Warning Services, LLC and are used herein under license. Reference ${esc(c.reference)}<br/>
      © ${new Date().getFullYear()} ${BRAND}
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

// ---------- Generic bank status email ----------
function bankStatusEmail(c: Ctx, scheme: string) {
  const meta = STATUS_META[c.status];
  const amountStr = fmtMoney(c.amount, c.currencyCode);
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f6fb;font-family:Helvetica,Arial,sans-serif;color:#1a2238;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 6px 20px rgba(10,20,50,0.08);">
    <tr><td style="background:linear-gradient(135deg,#0a1a3f 0%,#142a63 100%);padding:24px 32px;color:#fff;">
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:14px;"><img src="${LOGO_URL}" width="46" height="46" style="border-radius:50%;background:#fff;padding:2px;" alt="${BRAND}"/></td>
        <td><div style="font-size:18px;font-weight:700;">${BRAND}</div>
          <div style="font-size:11px;letter-spacing:3px;color:#c9b27c;text-transform:uppercase;margin-top:2px;">Wealth · Trust · Legacy</div></td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:28px 32px;">
      <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:${meta.bg};color:${meta.color};font-size:12px;font-weight:800;margin-bottom:12px;">
        ${meta.icon} ${esc(meta.label)} — ${esc(meta.sub)}
      </div>
      <h1 style="margin:0 0 6px;font-size:20px;color:#0a1a3f;">${esc(scheme)} status update</h1>
      <p style="margin:0 0 18px;color:#3a4660;font-size:14px;line-height:1.55;">
        ${c.audience === "sender"
          ? `Hi ${esc(c.senderName)}, your <strong>${esc(scheme)}</strong> transfer to <strong>${esc(c.recipientName)}</strong> has been moved to <strong>${esc(meta.label)}</strong>.`
          : `Hi ${esc(c.recipientName)}, the <strong>${esc(scheme)}</strong> transfer from <strong>${esc(c.senderName)}</strong> has been moved to <strong>${esc(meta.label)}</strong>.`}
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6e9f2;border-radius:8px;">
        <tr><td style="padding:14px 18px;background:#f7f9fc;border-bottom:1px solid #e6e9f2;font-size:11px;letter-spacing:2px;color:#5a6680;text-transform:uppercase;">Transfer summary</td></tr>
        <tr><td style="padding:16px 18px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="color:#6a7590;font-size:13px;padding:5px 0;width:42%;">Amount</td><td style="font-weight:800;font-size:20px;color:#0a1a3f;padding:5px 0;">${amountStr}</td></tr>
            <tr><td style="color:#6a7590;font-size:13px;padding:5px 0;">Scheme</td><td style="padding:5px 0;font-weight:600;font-size:13px;">${esc(scheme)}</td></tr>
            <tr><td style="color:#6a7590;font-size:13px;padding:5px 0;">${c.audience === "sender" ? "Recipient" : "Sender"}</td><td style="padding:5px 0;font-weight:600;font-size:13px;">${esc(c.audience === "sender" ? c.recipientName : c.senderName)}</td></tr>
            <tr><td style="color:#6a7590;font-size:13px;padding:5px 0;">Updated on</td><td style="padding:5px 0;font-weight:600;font-size:13px;">${esc(c.dateStr)}</td></tr>
            <tr><td style="color:#6a7590;font-size:13px;padding:5px 0;">Reference</td><td style="padding:5px 0;font-weight:600;font-size:13px;">${esc(c.reference)}</td></tr>
          </table>
        </td></tr>
      </table>
      ${c.adminNote ? `<div style="margin-top:16px;padding:14px 16px;background:#f7f9fc;border-radius:8px;font-size:14px;color:#3a4660;line-height:1.5;"><strong>Note from support:</strong> ${esc(c.adminNote)}</div>` : ""}
    </td></tr>
    <tr><td style="background:#0a1a3f;color:#c9c9d4;padding:16px;text-align:center;font-size:11px;">© ${new Date().getFullYear()} ${BRAND}</td></tr>
  </table>
</td></tr></table></body></html>`;
}

// ---------- Deposit credit email (admin-posted deposits) ----------
function depositEmail(c: Ctx) {
  const meta = STATUS_META[c.status];
  const amountStr = fmtMoney(c.amount, c.currencyCode);
  const credited = c.status === "completed";
  const headline = credited
    ? `Deposit credited — ${amountStr}`
    : `Deposit ${esc(meta.label.toLowerCase())} — ${amountStr}`;
  const explain = credited
    ? `Your account has been credited with <strong>${amountStr}</strong>. Funds are now available in your ${esc(c.category || "account")}.`
    : `A deposit of <strong>${amountStr}</strong> is currently <strong>${esc(meta.label)}</strong>. ${esc(meta.sub)}. You'll be notified again once funds are credited.`;
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f6fb;font-family:Helvetica,Arial,sans-serif;color:#1a2238;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 6px 20px rgba(10,20,50,0.08);">
    <tr><td style="background:linear-gradient(135deg,#0a1a3f 0%,#142a63 100%);padding:24px 32px;color:#fff;">
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:14px;"><img src="${LOGO_URL}" width="46" height="46" style="border-radius:50%;background:#fff;padding:2px;" alt="${BRAND}"/></td>
        <td><div style="font-size:18px;font-weight:700;">${BRAND}</div>
          <div style="font-size:11px;letter-spacing:3px;color:#c9b27c;text-transform:uppercase;margin-top:2px;">Deposit notification</div></td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:28px 32px;">
      <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:${credited ? "#e6f9ee" : meta.bg};color:${credited ? "#00a63e" : meta.color};font-size:12px;font-weight:800;margin-bottom:12px;">
        ${credited ? "✓ CREDITED" : `${meta.icon} ${esc(meta.label.toUpperCase())}`}
      </div>
      <h1 style="margin:0 0 6px;font-size:26px;color:#0a1a3f;letter-spacing:-0.5px;">${headline}</h1>
      <p style="margin:0 0 18px;color:#3a4660;font-size:14px;line-height:1.55;">Hi ${esc(c.senderName)}, ${explain}</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6e9f2;border-radius:8px;">
        <tr><td style="padding:14px 18px;background:#f7f9fc;border-bottom:1px solid #e6e9f2;font-size:11px;letter-spacing:2px;color:#5a6680;text-transform:uppercase;">Deposit details</td></tr>
        <tr><td style="padding:16px 18px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="color:#6a7590;font-size:13px;padding:5px 0;width:42%;">Amount</td><td style="font-weight:800;font-size:22px;color:#00a63e;padding:5px 0;">+${amountStr}</td></tr>
            <tr><td style="color:#6a7590;font-size:13px;padding:5px 0;">Deposited to</td><td style="padding:5px 0;font-weight:600;font-size:13px;">${esc(c.category || "Account")}</td></tr>
            <tr><td style="color:#6a7590;font-size:13px;padding:5px 0;">Status</td><td style="padding:5px 0;font-weight:700;font-size:13px;color:${credited ? "#00a63e" : meta.color};">${esc(meta.label)} — ${credited ? "Funds available" : esc(meta.sub)}</td></tr>
            <tr><td style="color:#6a7590;font-size:13px;padding:5px 0;">Updated on</td><td style="padding:5px 0;font-weight:600;font-size:13px;">${esc(c.dateStr)}</td></tr>
            <tr><td style="color:#6a7590;font-size:13px;padding:5px 0;">Reference</td><td style="padding:5px 0;font-weight:600;font-size:13px;font-family:monospace;">${esc(c.reference)}</td></tr>
          </table>
        </td></tr>
      </table>
      ${c.adminNote ? `<div style="margin-top:16px;padding:14px 16px;background:#f7f9fc;border-radius:8px;font-size:14px;color:#3a4660;line-height:1.5;"><strong>Note from support:</strong> ${esc(c.adminNote)}</div>` : ""}
      <p style="margin:20px 0 0;font-size:12px;color:#6a7590;line-height:1.55;">If you didn't expect this deposit, please contact support immediately.</p>
    </td></tr>
    <tr><td style="background:#0a1a3f;color:#c9c9d4;padding:16px;text-align:center;font-size:11px;">© ${new Date().getFullYear()} ${BRAND}</td></tr>
  </table>
</td></tr></table></body></html>`;
}

function detectScheme(description: string | null, category: string | null): string {
  const cat = (category || "").toLowerCase();
  if (cat.includes("deposit")) return "Deposit";
  const hay = `${description || ""} ${category || ""}`.toLowerCase();
  if (hay.includes("cash app") || hay.includes("cashapp")) return "Cash App";
  if (hay.includes("venmo")) return "Venmo";
  if (hay.includes("paypal")) return "PayPal";
  if (hay.includes("zelle")) return "Zelle";
  const m = /^\[([^\]]+)\]/.exec(description || "");
  if (m) return m[1];
  return "Bank Transfer";
}

function renderEmail(scheme: string, c: Ctx): string {
  const s = scheme.toLowerCase();
  if (s === "deposit" || s.includes("deposit")) return depositEmail(c);
  if (s.includes("cash app") || s === "cashapp") return cashappStatusEmail(c);
  if (s.includes("venmo")) return venmoStatusEmail(c);
  if (s.includes("paypal")) return paypalStatusEmail(c);
  if (s.includes("zelle")) return zelleStatusEmail(c);
  return bankStatusEmail(c, scheme);
}

async function resendSend(to: string, subject: string, html: string, refId?: string) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html,
      // Unique per send so mail clients start a NEW conversation instead of
      // grouping this update under the previous one.
      headers: refId
        ? { "X-Entity-Ref-ID": refId, "X-Notice-Id": refId }
        : undefined,
    }),
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
      .select("id, user_id, amount, currency, description, category, reference_number, recipient_email, recipient_name, created_at")
      .eq("id", transactionId)
      .maybeSingle();
    if (txErr || !tx) throw new Error(txErr?.message || "Transaction not found");

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name, preferred_currency")
      .eq("id", tx.user_id)
      .maybeSingle();

    const senderName =
      (profile?.full_name || "").trim() ||
      (profile?.email ? profile.email.split("@")[0] : "") ||
      "Customer";
    // Strip "[Scheme] " prefix, then the leading "To <name>" segment
    const bare = (tx.description || "").replace(/^\[[^\]]+\]\s*/, "").trim();
    const toMatch = /^to\s+([^—·]+)/i.exec(bare);
    const recipientName =
      (tx.recipient_name || "").trim() ||
      (toMatch ? toMatch[1].trim() : "") ||
      "Recipient";
    const amount = Number(tx.amount || 0);
    // Customer memos are intentionally omitted from status emails; only the
    // support note (adminNote) is shown.
    const memo = "";
    // A transfer keeps the currency selected when it was created. Never use the
    // customer's current preference for a resend because they may have switched
    // currencies since the original transfer.
    const storedCurrency = typeof tx.currency === "string" ? tx.currency.trim().toUpperCase() : "";
    const currencyCode = CURRENCY_RATES[storedCurrency] ? storedCurrency : "USD";


    const reference = tx.reference_number || tx.id.slice(0, 8).toUpperCase();
    const category = tx.category || "Cash balance";
    const dateStr = new Date().toLocaleDateString(undefined, {
      month: "short", day: "numeric", year: "numeric",
    });
    // The request note is the complete support note for this notice. Do not
    // recover or append memo/note text from the original transaction description.
    const adminNote = typeof note === "string" ? note.trim().slice(0, 500) : "";
    const meta = STATUS_META[status];
    const scheme = detectScheme(tx.description, tx.category);

    const baseCtx: Omit<Ctx, "audience"> = {
      senderName, recipientName, amount, memo, currencyCode, status,
      reference, category, dateStr, adminNote,
    };

    // Unique per notice: keeps every status update / resend as its own
    // conversation in the customer's inbox.
    const noticeId = crypto.randomUUID();
    const noticeTag = noticeId.slice(0, 6).toUpperCase();
    const stamp = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

    const jobs: Promise<unknown>[] = [];
    if (profile?.email) {
      const ctx: Ctx = { ...baseCtx, audience: "sender" };
      jobs.push(resendSend(
        profile.email,
        `${scheme} ${meta.label.toLowerCase()} · ${reference} · notice ${noticeTag} (${stamp})`,
        renderEmail(scheme, ctx),
        `${noticeId}-sender`,
      ));
    }
    if (tx.recipient_email) {
      const ctx: Ctx = { ...baseCtx, audience: "recipient" };
      jobs.push(resendSend(
        tx.recipient_email,
        (status === "completed"
          ? `${scheme} received · ${reference}`
          : `${scheme} ${meta.label.toLowerCase()} · ${reference}`) + ` · notice ${noticeTag} (${stamp})`,
        renderEmail(scheme, ctx),
        `${noticeId}-recipient`,
      ));
    }
    const results = await Promise.allSettled(jobs);
    const failed = results.filter(r => r.status === "rejected").map(r => (r as PromiseRejectedResult).reason?.message || String((r as PromiseRejectedResult).reason));

    return new Response(JSON.stringify({ ok: true, sent: results.length - failed.length, failed, scheme }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-transaction-status-update failed", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
