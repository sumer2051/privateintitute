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

// ---------- Cash App template ----------
function cashappTemplate(c: Ctx) {
  const initial = escapeHtml((c.audience === "sender" ? c.recipientName : c.senderName)[0]?.toUpperCase() || "$");
  const verb = c.audience === "sender" ? `You sent` : `${escapeHtml(c.senderName)} sent you`;
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f6f6f6;font-family:'Cash Sans',-apple-system,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;background:#f6f6f6;"><tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;">
    <tr><td style="padding:20px 24px;border-bottom:1px solid #eee;text-align:center;">
      <div style="font-size:26px;font-weight:900;color:#00d64f;letter-spacing:-1px;">$cash</div>
      <div style="font-size:10px;letter-spacing:2px;color:#888;text-transform:uppercase;margin-top:2px;">via ${BRAND}</div>
    </td></tr>
    <tr><td style="padding:28px 32px;">
      ${pendingBanner(c.status)}
      <div style="text-align:center;padding:8px 0 24px;">
        <div style="position:relative;display:inline-block;">
          <div style="width:88px;height:88px;border-radius:50%;background:#00d64f;color:#fff;font-size:44px;font-weight:900;line-height:88px;text-align:center;margin:0 auto;">${initial}</div>
          <img src="${LOGO_URL}" width="28" height="28" style="position:absolute;bottom:-4px;right:-4px;border-radius:50%;background:#fff;padding:2px;border:2px solid #fff;" alt="${BRAND}" />
        </div>
        <div style="margin-top:16px;color:#555;font-size:14px;">${verb}</div>
        <div style="font-size:56px;font-weight:900;color:#00d64f;letter-spacing:-2px;margin:6px 0 4px;">${c.amountStr}</div>
        <div style="color:#333;font-size:15px;font-weight:600;">${c.audience === "sender" ? `to ${escapeHtml(c.recipientName)}` : `from ${escapeHtml(c.senderName)}`}</div>
        ${c.memo ? `<div style="margin-top:14px;display:inline-block;background:#f0f0f0;color:#333;padding:8px 14px;border-radius:999px;font-size:13px;">"${escapeHtml(c.memo)}"</div>` : ""}
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;padding-top:14px;">
        ${rowsHtml([...c.detailRows, ["Reference", c.reference], ["Status", c.status === "pending" ? "Pending review" : "Completed"]])}
      </table>
    </td></tr>
    <tr><td style="background:#fafafa;padding:16px;text-align:center;font-size:11px;color:#999;">© ${new Date().getFullYear()} ${BRAND} · Cash App styled receipt</td></tr>
  </table>
</td></tr></table></body></html>`;
}

// ---------- Zelle template ----------
function zelleTemplate(c: Ctx) {
  const verb = c.audience === "sender" ? "Payment sent" : "You've received money";
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f2fa;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 14px rgba(107,70,193,0.12);position:relative;">
    <tr><td style="background:linear-gradient(135deg,#6b46c1 0%,#4c1d95 100%);padding:24px 32px;position:relative;">
      <img src="${LOGO_URL}" width="180" height="180" style="position:absolute;right:10px;top:10px;opacity:0.08;" alt="" />
      <div style="color:#fff;font-size:22px;font-weight:800;letter-spacing:0.5px;">Zelle®</div>
      <div style="color:#e9d8fd;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;margin-top:2px;">Powered by ${BRAND}</div>
    </td></tr>
    <tr><td style="padding:28px 32px;">
      ${pendingBanner(c.status)}
      <h1 style="margin:0 0 6px;font-size:20px;color:#4c1d95;">${verb}</h1>
      <p style="margin:0 0 20px;color:#4a4a4a;font-size:14px;line-height:1.5;">
        ${c.audience === "sender"
          ? `Hi ${escapeHtml(c.senderName)}, your Zelle® payment to <strong>${escapeHtml(c.recipientName)}</strong> is on its way.`
          : `Hi ${escapeHtml(c.recipientName)}, <strong>${escapeHtml(c.senderName)}</strong> sent you money with Zelle®.`}
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #6b46c1;border-radius:10px;">
        <tr><td style="padding:18px 20px;background:#f5f0ff;border-bottom:1px solid #e0d4f7;">
          <div style="font-size:11px;letter-spacing:2px;color:#6b46c1;text-transform:uppercase;font-weight:700;">Amount</div>
          <div style="font-size:34px;font-weight:800;color:#4c1d95;margin-top:4px;">${c.amountStr}</div>
        </td></tr>
        <tr><td style="padding:18px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${rowsHtml([
              [c.audience === "sender" ? "Recipient" : "Sender", c.audience === "sender" ? c.recipientName : c.senderName],
              ...c.detailRows,
              ...(c.memo ? [["Memo", c.memo] as [string, string]] : []),
              ...(c.settlement ? [["Delivery", c.settlement] as [string, string]] : []),
              ["Reference", c.reference],
              ["Status", c.status === "pending" ? "Pending approval" : "Sent"],
            ], "#6b46c1")}
          </table>
        </td></tr>
      </table>
      <p style="margin:20px 0 0;font-size:12px;color:#777;line-height:1.5;">Zelle® and the Zelle® related marks are wholly owned by Early Warning Services, LLC and are used herein under license. This is an independent portal styled receipt from ${BRAND}.</p>
    </td></tr>
    <tr><td style="background:#4c1d95;color:#e9d8fd;padding:14px;text-align:center;font-size:11px;">© ${new Date().getFullYear()} ${BRAND}</td></tr>
  </table>
</td></tr></table></body></html>`;
}

// ---------- PayPal template ----------
function paypalTemplate(c: Ctx) {
  const verb = c.audience === "sender" ? "You sent a payment" : "You've got money";
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#faf8f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#2c2e2f;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;position:relative;">
    <tr><td style="padding:20px 32px;border-bottom:3px solid #0070ba;position:relative;">
      <img src="${LOGO_URL}" width="220" height="220" style="position:absolute;right:20px;top:20px;opacity:0.06;" alt="" />
      <span style="font-size:26px;font-weight:900;font-style:italic;letter-spacing:-1px;">
        <span style="color:#003087;">Pay</span><span style="color:#0070ba;">Pal</span>
      </span>
      <div style="font-size:10px;letter-spacing:2px;color:#6c7378;text-transform:uppercase;margin-top:2px;">Receipt · ${BRAND}</div>
    </td></tr>
    <tr><td style="padding:28px 32px;">
      ${pendingBanner(c.status)}
      <div style="font-size:13px;color:#6c7378;text-transform:uppercase;letter-spacing:1.5px;">${verb}</div>
      <div style="font-size:38px;font-weight:300;color:#2c2e2f;margin:6px 0 2px;">${c.amountStr}</div>
      <div style="font-size:14px;color:#4a4a4a;">${c.audience === "sender" ? `to ${escapeHtml(c.recipientName)} (${escapeHtml(c.recipientEmail || "recipient")})` : `from ${escapeHtml(c.senderName)}`}</div>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-top:1px solid #e5e7eb;">
        <tr><td style="padding:16px 0 8px;font-size:12px;color:#6c7378;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Transaction details</td></tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fa;padding:16px;border-radius:4px;">
        ${rowsHtml([
          ["Transaction ID", c.reference],
          ["Date", new Date().toLocaleString()],
          ["Payment method", c.scheme],
          ...c.detailRows,
          ...(c.memo ? [["Note", c.memo] as [string, string]] : []),
          ["Status", c.status === "pending" ? "Pending review" : "Completed"],
        ], "#6c7378")}
      </table>
      <p style="margin:24px 0 0;font-size:12px;color:#6c7378;line-height:1.5;">Questions? Reply to this email and our support team will assist. This receipt was generated by ${BRAND} in a PayPal-styled layout.</p>
    </td></tr>
    <tr><td style="background:#003087;color:#c9d3e8;padding:16px;text-align:center;font-size:11px;">© ${new Date().getFullYear()} ${BRAND} · All rights reserved</td></tr>
  </table>
</td></tr></table></body></html>`;
}

// ---------- Venmo ----------
function venmoTemplate(c: Ctx) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Arial,sans-serif;color:#2f3033;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;"><tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:14px;overflow:hidden;position:relative;">
    <tr><td style="background:#3d95ce;padding:20px 24px;position:relative;">
      <img src="${LOGO_URL}" width="160" height="160" style="position:absolute;right:8px;top:8px;opacity:0.1;" alt="" />
      <div style="color:#fff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">venmo</div>
      <div style="color:#d4e9f7;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-top:2px;">via ${BRAND}</div>
    </td></tr>
    <tr><td style="padding:24px 28px;">
      ${pendingBanner(c.status)}
      <div style="font-size:15px;color:#2f3033;">
        <strong>${escapeHtml(c.audience === "sender" ? c.senderName : c.senderName)}</strong> paid <strong>${escapeHtml(c.recipientName)}</strong>
      </div>
      ${c.memo ? `<div style="margin-top:8px;color:#6b6f76;font-size:14px;">${escapeHtml(c.memo)}</div>` : ""}
      <div style="margin-top:16px;font-size:32px;font-weight:800;color:#008cff;">- ${c.amountStr}</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-top:1px solid #eee;padding-top:12px;">
        ${rowsHtml([...c.detailRows, ["Reference", c.reference], ["Status", c.status === "pending" ? "Pending" : "Completed"]])}
      </table>
    </td></tr>
    <tr><td style="background:#f7f8fa;padding:12px;text-align:center;font-size:11px;color:#8b9098;">© ${new Date().getFullYear()} ${BRAND}</td></tr>
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
    const userName = ((claims.claims.user_metadata as any)?.full_name as string) || userEmail.split("@")[0];

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
      const raw = buildHtmlEmail({ to, subject, html });
      const r = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
        },
        body: JSON.stringify({ raw }),
      });
      if (!r.ok) {
        const t = await r.text();
        console.error(`gmail send failed to ${to}`, r.status, t);
        throw new Error(`Gmail ${r.status}: ${t}`);
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
