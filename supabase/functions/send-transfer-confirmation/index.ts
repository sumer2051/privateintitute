import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL =
  Deno.env.get("RESEND_FROM_EMAIL") ||
  "BoA private institute <onboarding@resend.dev>";
const LOGO_URL = "https://boaprivatebank.lovable.app/logo.png";
const BRAND = "BoA private institute";

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const CURRENCY_LOCALES: Record<string, string> = {
  USD: "en-US", EUR: "de-DE", GBP: "en-GB", JPY: "ja-JP", CAD: "en-CA",
  AUD: "en-AU", CHF: "de-CH", CNY: "zh-CN", INR: "en-IN", MXN: "es-MX",
  BRL: "pt-BR", NGN: "en-NG", ZAR: "en-ZA", AED: "ar-AE",
};

function fmtMoney(amount: number, code: string) {
  const locale = CURRENCY_LOCALES[code] || "en-US";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency", currency: code,
      maximumFractionDigits: code === "JPY" ? 0 : 2,
    }).format(amount);
  } catch { return `${code} ${amount.toFixed(2)}`; }
}

type Ctx = {
  scheme: string;
  amountStr: string;
  senderName: string;
  recipientName: string;
  recipientEmail: string;
  detailRows: [string, string][];
  memo?: string;
  reference: string;
  settlement?: string;
  audience: "sender" | "recipient";
  status: "pending" | "completed";
};

const pendingBanner = (status: string) =>
  status === "pending"
    ? `<div style="background:#fff3cd;color:#7a5b00;border:1px solid #f2d98d;padding:12px 16px;border-radius:8px;margin:0 0 18px;font-size:13px;line-height:1.5;font-weight:600;">⏳ Pending: Our support team will contact you shortly to assist with completing this transfer.</div>`
    : "";

const rowsHtml = (rows: [string, string][], labelColor = "#6a7590") =>
  rows.map(([k, v]) =>
    `<tr><td style="color:${labelColor};padding:5px 0;width:42%;font-size:13px;">${escapeHtml(k)}</td><td style="padding:5px 0;font-weight:600;font-size:13px;">${escapeHtml(v)}</td></tr>`
  ).join("");

// ---------- Cash App template (matches in-app + status-update style) ----------
function cashappTemplate(c: Ctx) {
  const headerName = c.audience === "recipient" ? c.senderName : c.recipientName;
  const initial = escapeHtml((headerName || "$").trim()[0]?.toUpperCase() || "$");
  const sign = c.audience === "recipient" ? "+" : "-";
  const amountStr = `${sign}${c.amountStr.replace(/^-/, "")}`;
  const statusMeta = c.status === "completed"
    ? { label: "Complete", sub: "Payment received", icon: "✓", color: "#00a63e", bg: "#e6f9ee" }
    : { label: "Pending", sub: "Awaiting review", icon: "⏳", color: "#8a6d00", bg: "#fff7d6" };
  const dateStr = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const category = c.detailRows.find(([k]) => /account|from|deposited/i.test(k))?.[1] || "Cash balance";

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#eeeeee;font-family:'Cash Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#000;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eeeeee;padding:24px 0;"><tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;">
    <tr><td style="padding:8px 24px 20px;">
      <div style="font-size:28px;font-weight:900;color:#00d64f;letter-spacing:-1px;">
        <span style="display:inline-block;transform:rotate(-8deg);margin-right:2px;">'</span>Cash App
      </div>
    </td></tr>
    <tr><td style="background:#ffffff;border-radius:14px;padding:28px 28px 24px;">
      <div style="width:72px;height:72px;border-radius:50%;background:#d9d9d9;color:#555;font-size:32px;font-weight:800;line-height:72px;text-align:center;margin:0 0 18px;">${initial}</div>
      <div style="font-size:34px;font-weight:900;line-height:1.15;letter-spacing:-0.5px;">${escapeHtml(headerName || "—")}</div>
      <div style="font-size:16px;color:#8a8a8a;margin-top:10px;">${dateStr}</div>
      ${c.memo ? `<div style="font-size:16px;color:#8a8a8a;margin-top:4px;">For ${escapeHtml(c.memo)}</div>` : ""}
      <div style="font-size:54px;font-weight:900;color:#000;margin:20px 0 6px;letter-spacing:-2px;">${amountStr}</div>
      <div style="height:1px;background:#e5e5e5;margin:18px 0 22px;"></div>

      <div style="font-size:22px;font-weight:800;margin-bottom:14px;">Transaction details</div>

      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="36" valign="top" style="padding:6px 0;">
            <div style="width:26px;height:26px;border-radius:50%;background:${statusMeta.bg};color:${statusMeta.color};font-size:16px;font-weight:900;line-height:26px;text-align:center;">${statusMeta.icon}</div>
          </td>
          <td style="padding:6px 0;">
            <div style="font-size:17px;font-weight:800;color:${statusMeta.color};">${statusMeta.label}</div>
            <div style="font-size:14px;color:#8a8a8a;margin-top:2px;">${statusMeta.sub}</div>
          </td>
        </tr>
        <tr><td colspan="2" style="padding:6px 0;"><div style="height:1px;background:#f0f0f0;"></div></td></tr>

        <tr>
          <td width="36" valign="top" style="padding:6px 0;font-size:18px;color:#8a8a8a;">👤</td>
          <td style="padding:6px 0;">
            <div style="font-size:17px;font-weight:800;">Payment between</div>
            <div style="font-size:14px;color:#8a8a8a;margin-top:2px;">Recipient: ${escapeHtml(c.recipientName || "—")}</div>
            <div style="font-size:14px;color:#8a8a8a;">Sender: ${escapeHtml(c.senderName || "—")}</div>
          </td>
        </tr>
        <tr><td colspan="2" style="padding:6px 0;"><div style="height:1px;background:#f0f0f0;"></div></td></tr>

        <tr>
          <td width="36" valign="top" style="padding:6px 0;font-size:18px;color:#8a8a8a;">$</td>
          <td style="padding:6px 0;">
            <div style="font-size:17px;font-weight:800;">${c.audience === "recipient" ? "Deposited to" : "Paid from"}</div>
            <div style="font-size:14px;color:#8a8a8a;margin-top:2px;">${escapeHtml(category)}</div>
          </td>
        </tr>
        <tr><td colspan="2" style="padding:6px 0;"><div style="height:1px;background:#f0f0f0;"></div></td></tr>

        <tr>
          <td width="36" valign="top" style="padding:6px 0;font-size:18px;color:#8a8a8a;">🧾</td>
          <td style="padding:6px 0;">
            <div style="font-size:17px;font-weight:800;">Transaction number</div>
            <div style="font-size:14px;color:#8a8a8a;margin-top:2px;">#${escapeHtml(c.reference)}</div>
          </td>
        </tr>
      </table>
    </td></tr>
    <tr><td style="padding:16px 8px;text-align:center;font-size:11px;color:#8a8a8a;">© ${new Date().getFullYear()} ${BRAND}</td></tr>
  </table>
</td></tr></table></body></html>`;
}

// ---------- Zelle template (matches screenshot) ----------
function zelleTemplate(c: Ctx) {
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  const senderUpper = escapeHtml((c.senderName || "").toUpperCase());
  const recipUpper = escapeHtml((c.recipientName || "").toUpperCase());
  const headline = c.audience === "recipient"
    ? `${senderUpper} sent you money`
    : `You sent ${recipUpper} money`;
  const subHeadline = c.audience === "recipient"
    ? `${escapeHtml(c.senderName)} is registered with a Zelle® member bank that supports payments in real time, so your money will usually be available in a few moments.`
    : `Your Zelle® payment to ${escapeHtml(c.recipientName)} has been submitted.`;

  const row = (label: string, value: string) => `
    <tr><td style="padding:14px 0 10px;border-bottom:1px solid #d9d9d9;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:14px;color:#4a4a4a;">${escapeHtml(label)}</td>
        <td align="right" style="font-size:15px;font-weight:700;color:#000;">${escapeHtml(value)}</td>
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
        </td></tr>
        <tr><td style="padding:14px 26px 6px;">
          <h1 style="margin:0;font-size:26px;line-height:1.2;font-weight:800;color:#111;">${headline}</h1>
        </td></tr>
        <tr><td style="padding:14px 26px 4px;font-size:14px;color:#4a4a4a;">Here are the details:</td></tr>
        <tr><td style="padding:6px 26px 8px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${row("Amount", c.amountStr)}
            ${row("Sent on", dateStr)}
            ${row("Transaction number", c.reference)}
            ${row("Memo", c.memo || "N/A")}
          </table>
        </td></tr>
        <tr><td style="padding:18px 26px 6px;font-size:13px;color:#3a3a3a;line-height:1.55;">
          ${subHeadline}
        </td></tr>
        ${c.memo ? `<tr><td style="padding:10px 26px 0;font-size:20px;font-weight:700;color:#111;">Note : ${escapeHtml(c.memo)}</td></tr>` : ""}
        <tr><td style="padding:16px 26px 28px;">
          <a href="https://www.zellepay.com" style="display:inline-block;background:#1a55c9;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:11px 20px;border-radius:4px;">Go to Zelle®</a>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:18px 24px 6px;font-size:12px;color:#4a4a4a;line-height:1.55;">
      Questions? Visit <a href="#" style="color:#1a55c9;">zellepay.com/support</a> or contact us at 1-800-935-9935
    </td></tr>
    <tr><td style="padding:6px 24px 18px;font-size:12px;color:#4a4a4a;line-height:1.55;">
      See how to help keep your money safe using Zelle® <a href="#" style="color:#1a55c9;">zellepay.com/use-zelle-safely</a>
    </td></tr>
    <tr><td style="padding:6px 24px 22px;font-size:12px;color:#4a4a4a;line-height:1.55;">
      Securely access your accounts in the ${BRAND} app.
    </td></tr>
    <tr><td style="background:#f2f2f2;padding:12px 24px;font-size:11px;letter-spacing:1.5px;color:#6a6a6a;">ABOUT THIS MESSAGE</td></tr>
    <tr><td style="padding:14px 24px 24px;font-size:11px;color:#8a8a8a;line-height:1.55;">
      Zelle® and the Zelle® related marks are wholly owned by Early Warning Services, LLC and are used herein under license. Reference ${escapeHtml(c.reference)} · Status ${c.status === "pending" ? "Pending" : "Sent"}<br/>
      © ${new Date().getFullYear()} ${BRAND}
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

// ---------- PayPal template ----------
function paypalTemplate(c: Ctx) {
  const headline = c.audience === "sender"
    ? `You sent ${escapeHtml(c.recipientName)} ${c.amountStr}`
    : `${escapeHtml(c.senderName)} sent you ${c.amountStr}`;
  const greetingName = c.audience === "sender" ? c.senderName : c.recipientName;
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const paypalLogo = `<span style="font-size:28px;font-weight:900;font-style:italic;letter-spacing:-1.5px;line-height:1;"><span style="color:#003087;">Pay</span><span style="color:#009cde;">Pal</span></span>`;
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f2f2f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#000;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2;padding:24px 0;"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
    <tr><td style="padding:16px 24px;">${paypalLogo}</td></tr>
    <tr><td style="padding:8px 24px 4px;text-align:center;font-size:14px;color:#6c7378;">Hello, ${escapeHtml(greetingName)}</td></tr>
    <tr><td style="padding:24px;">
      ${pendingBanner(c.status)}
      <h1 style="margin:0;font-size:44px;line-height:1.05;font-weight:900;color:#000;letter-spacing:-1px;text-align:left;">
        ${headline}
      </h1>
    </td></tr>
    <tr><td style="padding:0 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;">
        <tr><td style="padding:28px 28px 8px;">
          <div style="font-size:16px;font-weight:800;color:#000;">Amount</div>
          <div style="font-size:16px;color:#2c2e2f;margin-top:4px;">${c.amountStr}</div>
        </td></tr>
        <tr><td style="padding:16px 28px 8px;">
          <div style="font-size:16px;font-weight:800;color:#000;">Transaction date</div>
          <div style="font-size:16px;color:#2c2e2f;margin-top:4px;">${dateStr}</div>
        </td></tr>
        <tr><td style="padding:16px 28px 8px;">
          <div style="font-size:16px;font-weight:800;color:#000;">Transaction ID</div>
          <div style="font-size:16px;color:#2c2e2f;margin-top:4px;font-family:monospace;">${escapeHtml(c.reference)}</div>
        </td></tr>
        ${c.memo ? `<tr><td style="padding:16px 28px 8px;">
          <div style="font-size:18px;color:#000;border-bottom:1px solid #d0d0d0;padding-bottom:6px;">Note : ${escapeHtml(c.memo)}</div>
        </td></tr>` : ""}
        <tr><td style="padding:24px 28px 32px;text-align:center;">
          <a href="https://www.paypal.com" style="display:inline-block;background:#000;color:#fff;text-decoration:none;font-weight:700;font-size:17px;padding:16px 56px;border-radius:999px;">Go to PayPal</a>
        </td></tr>
        <tr><td style="padding:8px 0 28px;text-align:center;">${paypalLogo}</td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:20px 24px;text-align:center;font-size:11px;color:#8a8a8a;line-height:1.5;">
      Status: ${c.status === "pending" ? "Pending review" : "Completed"} · Ref ${escapeHtml(c.reference)}<br/>
      © ${new Date().getFullYear()} ${BRAND}
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

// ---------- Venmo (matches native Venmo "Balance transfer sent" email) ----------
function venmoTemplate(c: Ctx) {
  const initiatedOn = new Date().toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short",
  });
  const txId = c.reference.replace(/[^A-Za-z0-9]/g, "").padEnd(19, "0").slice(0, 19);
  const from = `Venmo balance ${escapeHtml(c.senderName)}`;
  const destination = `Venmo balance ${escapeHtml(c.recipientName)}`;
  const label = (t: string) => `<div style="font-size:12px;font-weight:700;letter-spacing:0.5px;color:#2f3033;text-transform:uppercase;margin-top:22px;">${t}</div>`;
  const value = (t: string) => `<div style="font-size:16px;color:#2f3033;margin-top:4px;line-height:1.4;">${t}</div>`;
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;color:#2f3033;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;background:#ffffff;"><tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;padding:0 24px;">
    <tr><td style="padding:8px 0 24px;">
      <div style="width:72px;height:72px;border-radius:50%;background:#008cff;text-align:center;line-height:72px;">
        <span style="color:#ffffff;font-size:38px;font-weight:900;font-style:italic;font-family:'Helvetica Neue',Arial,sans-serif;letter-spacing:-1px;">v</span>
      </div>
    </td></tr>
    <tr><td>
      ${pendingBanner(c.status)}
      <h1 style="margin:0;font-size:28px;font-weight:400;color:#2f3033;letter-spacing:-0.3px;">Balance transfer Sent</h1>
      <div style="margin-top:14px;font-size:16px;color:#2f3033;">Initiated on ${escapeHtml(initiatedOn)}</div>

      ${label("Transfer amount")}
      ${value(escapeHtml(c.amountStr))}

      ${label("From")}
      ${value(from)}

      ${label("Destination")}
      ${value(destination)}

      ${label("Transaction ID")}
      ${value(txId)}

      <div style="margin-top:32px;font-size:15px;color:#2f3033;line-height:1.55;">
        Transfers are reviewed which may result in delays or funds being frozen or removed from your Venmo account. <a href="#" style="color:#008cff;text-decoration:none;">Learn more</a>.
      </div>
      <div style="margin-top:16px;font-size:15px;color:#2f3033;line-height:1.55;">
        You can see the status of your transfers by visiting your <a href="#" style="color:#008cff;text-decoration:none;">Account Statement</a>.
      </div>
      <div style="margin-top:16px;font-size:15px;color:#2f3033;line-height:1.55;">
        Important: This transfer was initiated by ${escapeHtml(c.senderName)}. If you didn't make this request, please visit our Help Center at <a href="#" style="color:#008cff;text-decoration:none;">help.venmo.com</a> or call <a href="#" style="color:#008cff;text-decoration:none;">(855) 812-4430</a>.
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


// ---------- Generic bank / SWIFT / SEPA / Wire ----------
function bankTemplate(c: Ctx) {
  const heading = c.audience === "sender"
    ? `${escapeHtml(c.scheme)} — Payment advice`
    : `Incoming ${escapeHtml(c.scheme)} — pending`;
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
      ${pendingBanner(c.status)}
      <h1 style="margin:0 0 6px;font-size:20px;color:#0a1a3f;">${heading}</h1>
      <p style="margin:0 0 18px;color:#3a4660;font-size:14px;line-height:1.55;">
        ${c.audience === "sender"
          ? `Hi ${escapeHtml(c.senderName)}, we've received your <strong>${escapeHtml(c.scheme)}</strong> request to <strong>${escapeHtml(c.recipientName)}</strong>.`
          : `Hi ${escapeHtml(c.recipientName)}, <strong>${escapeHtml(c.senderName)}</strong> initiated a <strong>${escapeHtml(c.scheme)}</strong> transfer to you.`}
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6e9f2;border-radius:8px;">
        <tr><td style="padding:14px 18px;background:#f7f9fc;border-bottom:1px solid #e6e9f2;font-size:11px;letter-spacing:2px;color:#5a6680;text-transform:uppercase;">Transfer summary</td></tr>
        <tr><td style="padding:16px 18px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="color:#6a7590;font-size:13px;padding:5px 0;width:42%;">Amount</td><td style="font-weight:800;font-size:20px;color:#0a1a3f;padding:5px 0;">${c.amountStr}</td></tr>
            ${rowsHtml([
              ["Scheme", c.scheme],
              [c.audience === "sender" ? "Recipient" : "Sender", c.audience === "sender" ? c.recipientName : c.senderName],
              ...c.detailRows,
              ...(c.memo ? [["Memo", c.memo] as [string, string]] : []),
              ...(c.settlement ? [["Settlement", c.settlement] as [string, string]] : []),
              ["Reference", c.reference],
            ])}
          </table>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="background:#0a1a3f;color:#c9c9d4;padding:16px;text-align:center;font-size:11px;">© ${new Date().getFullYear()} ${BRAND}</td></tr>
  </table>
</td></tr></table></body></html>`;
}

function pickTemplate(scheme: string): (c: Ctx) => string {
  const s = scheme.toLowerCase();
  if (s.includes("cash app") || s === "cashapp") return cashappTemplate;
  if (s.includes("zelle")) return zelleTemplate;
  if (s.includes("paypal")) return paypalTemplate;
  if (s.includes("venmo")) return venmoTemplate;
  return bankTemplate;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: ce } = await supabase.auth.getClaims(token);
    if (ce || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userEmail = claims.claims.email as string;
    const userId = claims.claims.sub as string;
    // Authoritative sender display name comes from the user's profile record.
    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle();
    const userName =
      (senderProfile?.full_name || "").trim() ||
      ((claims.claims.user_metadata as any)?.full_name as string || "").trim() ||
      userEmail.split("@")[0];

    const body = await req.json();
    const { type, amount, currency, recipient, detail, details, scheme, settlement, memo, reference, recipientEmail, status } = body || {};
    if (!type || !amount || !recipient || !reference) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const code = (typeof currency === "string" ? currency : "USD").toUpperCase();
    const amountStr = fmtMoney(Number(amount), code);
    const detailEntries: [string, string][] = details && typeof details === "object"
      ? Object.entries(details as Record<string, string>).filter(([, v]) => v)
      : detail ? [["Details", String(detail)]] : [];

    const effectiveScheme = typeof scheme === "string" && scheme ? scheme : type;
    const render = pickTemplate(effectiveScheme);
    const effectiveStatus: "pending" | "completed" = status === "completed" ? "completed" : "pending";

    async function sendOne(to: string, subject: string, html: string) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
      });
      if (!r.ok) {
        const t = await r.text();
        console.error(`resend send failed to ${to}`, r.status, t);
        throw new Error(`Resend ${r.status}: ${t}`);
      }
    }

    // Sender
    const senderCtx: Ctx = {
      scheme: effectiveScheme, amountStr,
      senderName: userName, recipientName: recipient,
      recipientEmail: recipientEmail || "", detailRows: detailEntries,
      memo, reference, settlement, audience: "sender", status: effectiveStatus,
    };
    await sendOne(
      userEmail,
      `${effectiveScheme} ${effectiveStatus === "pending" ? "— pending approval" : "sent"} (${reference})`,
      render(senderCtx),
    );

    // Recipient (optional)
    let recipientSent = false;
    if (typeof recipientEmail === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail) && recipientEmail.toLowerCase() !== userEmail.toLowerCase()) {
      try {
        const recipientCtx: Ctx = { ...senderCtx, audience: "recipient" };
        await sendOne(
          recipientEmail,
          `Incoming ${effectiveScheme} ${effectiveStatus === "pending" ? "— pending" : "received"} (${reference})`,
          render(recipientCtx),
        );
        recipientSent = true;
      } catch (e) {
        console.error("recipient email send failed", (e as Error).message);
      }
    }

    return new Response(JSON.stringify({ ok: true, recipientSent, template: render.name }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
