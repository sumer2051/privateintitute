import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY")!;
const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const LOGO_URL = "https://boaprivatebank.lovable.app/logo.png";
const BRAND = "BoA private institute";

function encodeRaw(msg: string) {
  // base64url for unicode-safe content
  const bytes = new TextEncoder().encode(msg);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildHtmlEmail(opts: {
  to: string;
  subject: string;
  html: string;
}) {
  const boundary = "boa_boundary_" + Math.random().toString(36).slice(2);
  const msg = [
    `To: ${opts.to}`,
    `From: ${BRAND} <support@boaprivateinstitute.com>`,
    `Subject: ${opts.subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    "Content-Transfer-Encoding: 7bit",
    "",
    opts.html,
    `--${boundary}--`,
    "",
  ].join("\r\n");
  return encodeRaw(msg);
}

function renderEmail(opts: {
  userName: string;
  type: string; // "External Transfer" | "Zelle"
  amount: number;
  recipient: string;
  detail: string;
  reference: string;
}) {
  const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(opts.amount);
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f6fb;font-family:Helvetica,Arial,sans-serif;color:#1a2238;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 6px 20px rgba(10,20,50,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#0a1a3f 0%,#142a63 100%);padding:28px 32px;text-align:left;">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="padding-right:14px;vertical-align:middle;">
                <img src="${LOGO_URL}" alt="${BRAND}" width="48" height="48" style="display:block;border-radius:50%;background:#fff;padding:2px;" />
              </td>
              <td style="vertical-align:middle;color:#ffffff;">
                <div style="font-size:18px;font-weight:700;letter-spacing:0.3px;">${BRAND}</div>
                <div style="font-size:11px;letter-spacing:3px;color:#c9b27c;text-transform:uppercase;margin-top:2px;">Wealth · Trust · Legacy</div>
              </td>
            </tr></table>
          </td>
        </tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 8px;font-size:22px;color:#0a1a3f;">Transfer received — pending approval</h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#3a4660;">
            Hi ${opts.userName || "there"}, we've received your ${opts.type} request. Our support team will personally verify and approve the transfer shortly.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6e9f2;border-radius:10px;margin:0 0 22px;">
            <tr><td style="padding:14px 18px;background:#f7f9fc;border-bottom:1px solid #e6e9f2;font-size:12px;letter-spacing:2px;color:#5a6680;text-transform:uppercase;">Transfer Summary</td></tr>
            <tr><td style="padding:18px;">
              <table width="100%" cellpadding="6" cellspacing="0" style="font-size:14px;color:#1a2238;">
                <tr><td style="color:#6a7590;width:42%;">Type</td><td style="font-weight:600;">${opts.type}</td></tr>
                <tr><td style="color:#6a7590;">Amount</td><td style="font-weight:700;font-size:18px;color:#0a1a3f;">${fmt}</td></tr>
                <tr><td style="color:#6a7590;">Recipient</td><td style="font-weight:600;">${opts.recipient}</td></tr>
                <tr><td style="color:#6a7590;">Details</td><td>${opts.detail}</td></tr>
                <tr><td style="color:#6a7590;">Reference</td><td style="font-family:monospace;">${opts.reference}</td></tr>
                <tr><td style="color:#6a7590;">Status</td><td><span style="background:#fff3cd;color:#7a5b00;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;">PENDING APPROVAL</span></td></tr>
              </table>
            </td></tr>
          </table>

          <div style="background:#eef3ff;border-left:4px solid #1a3aa6;padding:14px 18px;border-radius:6px;margin-bottom:22px;">
            <p style="margin:0;font-size:14px;line-height:1.55;color:#1a2238;">
              <strong>What happens next:</strong> A ${BRAND} specialist will reach out within 24 hours to verify and approve this transfer. Funds remain on hold in your account until approval is complete.
            </p>
          </div>

          <p style="margin:0 0 8px;font-size:13px;color:#6a7590;">
            If you did <strong>not</strong> initiate this transfer, contact our support team immediately by replying to this email.
          </p>
          <p style="margin:0;font-size:13px;color:#6a7590;">
            For your security, we will never ask for your password, full card number, or one‑time codes.
          </p>
        </td></tr>

        <tr><td style="background:#0a1a3f;color:#c9c9d4;padding:18px 32px;font-size:11px;text-align:center;">
          © ${new Date().getFullYear()} ${BRAND}. All rights reserved.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: ce } = await supabase.auth.getClaims(token);
    if (ce || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userEmail = claims.claims.email as string;
    const userName =
      ((claims.claims.user_metadata as any)?.full_name as string) || userEmail.split("@")[0];

    const body = await req.json();
    const { type, amount, recipient, detail, reference } = body || {};
    if (!type || !amount || !recipient || !reference) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = renderEmail({
      userName,
      type,
      amount: Number(amount),
      recipient,
      detail: detail || "—",
      reference,
    });
    const raw = buildHtmlEmail({
      to: userEmail,
      subject: `${type} received — pending approval (${reference})`,
      html,
    });

    const res = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
      },
      body: JSON.stringify({ raw }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("gmail send failed", res.status, t);
      return new Response(JSON.stringify({ error: `Gmail ${res.status}: ${t}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
