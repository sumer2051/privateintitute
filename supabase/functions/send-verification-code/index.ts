import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendEmail } from "../_shared/gmail.ts";

const BRAND = "BoA private institute";
const LOGO_URL = "https://boaprivatebank.lovable.app/logo.png";

function tpl(code: string, purpose: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f6fb;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px;">
    <div style="background:linear-gradient(135deg,#7a1c1c 0%,#4b1370 100%);border-radius:16px 16px 0 0;padding:24px;text-align:center;color:#fff;">
      <img src="${LOGO_URL}" alt="${BRAND}" width="52" height="52" style="border-radius:50%;background:#fff;padding:4px;"/>
      <h2 style="margin:10px 0 0;font-weight:700;letter-spacing:.5px;">${BRAND}</h2>
      <p style="margin:2px 0 0;opacity:.85;font-size:12px;letter-spacing:.2em;text-transform:uppercase;">Security Verification</p>
    </div>
    <div style="background:#fff;border-radius:0 0 16px 16px;padding:28px 24px;box-shadow:0 4px 24px rgba(15,23,42,.08);">
      <p style="margin:0 0 6px;font-size:14px;color:#475569;">Your one-time verification code for <b>${purpose}</b>:</p>
      <div style="margin:18px 0;padding:18px 12px;text-align:center;background:linear-gradient(135deg,#fef2f2,#f5f3ff);border:1px dashed #b91c1c;border-radius:12px;">
        <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:38px;font-weight:800;letter-spacing:.6em;color:#7a1c1c;">${code}</div>
      </div>
      <p style="margin:0;font-size:13px;color:#475569;">This code expires in <b>10 minutes</b>. If you did not request this, please ignore this email and consider changing your password.</p>
      <hr style="margin:22px 0;border:none;border-top:1px solid #e2e8f0;"/>
      <p style="margin:0;font-size:11px;color:#94a3b8;">${BRAND} · Never share this code with anyone. Our staff will never ask for it.</p>
    </div>
  </div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return new Response(JSON.stringify({ error: "No user email" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { purpose } = await req.json().catch(() => ({ purpose: "account verification" }));
    const code = String(Math.floor(100000 + Math.random() * 900000));

    try {
      await sendEmail(
        user.email,
        `${BRAND} security code: ${code}`,
        tpl(code, String(purpose || "account verification")),
      );
    } catch (err) {
      console.error("resend send failed", (err as Error).message);
      return new Response(JSON.stringify({ error: (err as Error).message }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // Return code so client can verify locally (mock-bank UX).
    return new Response(JSON.stringify({ ok: true, code, sentTo: user.email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
