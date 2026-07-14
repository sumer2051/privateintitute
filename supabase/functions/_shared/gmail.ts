// Email sender — now backed by Resend (replaces prior Gmail connector).
// Exports kept as `sendEmail` / `brandedEmail` for backwards compatibility
// with existing callers across the edge functions.

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const DEFAULT_FROM =
  Deno.env.get("RESEND_FROM_EMAIL") ||
  "BoA private institute <onboarding@resend.dev>";

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  from?: string,
) {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: from || DEFAULT_FROM,
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Resend send failed ${res.status}: ${t}`);
  }
  return await res.json();
}

export function brandedEmail(title: string, body: string, footerNote?: string) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f5f6f8;font-family:Inter,Arial,sans-serif;color:#111827">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <div style="background:#0b1e3f;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;display:flex;align-items:center;gap:12px">
      <div style="width:36px;height:36px;background:linear-gradient(135deg,#d4af37,#f5e6a8);border-radius:8px;display:inline-block;text-align:center;line-height:36px;font-weight:700;color:#0b1e3f">B</div>
      <div>
        <div style="font-size:16px;font-weight:700">BoA private institute</div>
        <div style="font-size:11px;opacity:.75">Customer Support</div>
      </div>
    </div>
    <div style="background:#fff;padding:28px 24px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px">
      <h1 style="margin:0 0 12px;font-size:20px;color:#0b1e3f">${title}</h1>
      <div style="font-size:14px;line-height:1.6;color:#374151">${body}</div>
      ${footerNote ? `<p style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280">${footerNote}</p>` : ""}
    </div>
    <p style="text-align:center;font-size:11px;color:#9ca3af;margin-top:16px">
      &copy; ${new Date().getFullYear()} BoA private institute. Secure banking &amp; support.
    </p>
  </div></body></html>`;
}
