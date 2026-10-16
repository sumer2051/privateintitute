import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { brandedEmail, sendEmail } from "../_shared/gmail.ts";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u.user) return json({ error: "Not signed in" }, 401);
    const { transfer_id } = await req.json();
    if (typeof transfer_id !== "string" || !/^[0-9a-f-]{36}$/i.test(transfer_id)) return json({ error: "Invalid transfer" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: t } = await admin.from("coin_transfers").select("*").eq("id", transfer_id).maybeSingle();
    if (!t || t.sender_id !== u.user.id || t.kind !== "transfer") return json({ error: "Transfer not found" }, 404);

    const { data: people } = await admin.from("profiles").select("id, full_name, email").in("id", [t.sender_id, t.recipient_id]);
    const { data: addrs } = await admin.from("coin_balances").select("user_id, address, units").in("user_id", [t.sender_id, t.recipient_id]);
    const p = (id: string) => people?.find((x) => x.id === id);
    const a = (id: string) => addrs?.find((x) => x.user_id === id);
    const sender = p(t.sender_id), recipient = p(t.recipient_id);
    const sym = String(t.symbol ?? "BOA");
    const tb = sym === "BOA" ? null : (await admin.from("token_balances").select("user_id, units").eq("symbol", sym).in("user_id", [t.sender_id, t.recipient_id])).data;
    const balOf = (id: string, fallback: number) => tb ? Number(tb.find((x) => x.user_id === id)?.units ?? 0) : fallback;
    const amt = Number(t.units ?? t.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 8 });
    const when = new Date(t.created_at).toUTCString();
    const row = (k: string, v: string) => `<tr><td style="padding:6px 0;color:#6b7280">${k}</td><td style="padding:6px 0;text-align:right;font-family:monospace;word-break:break-all">${esc(v)}</td></tr>`;
    const details = (extra: string) => `<table style="width:100%;font-size:13px;border-collapse:collapse">${extra}${row("Amount", `${amt} ${sym}`)}${t.note ? row("Note", t.note) : ""}${row("Date", when)}${row("Transfer ID", t.id)}</table>`;
    const footer = "BoA Coin is a digital balance held and settled by BoA private institute between member accounts. If you did not authorise this transfer, contact support immediately.";

    const card = (label: string, sign: string, color: string, who: string, partyLabel: string, partyAddr: string, balLabel: string, bal: number) => `
      <p style="margin:0 0 18px">Hello,</p>
      <p style="margin:0 0 20px">${label}</p>
      <div style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        <div style="background:#f9fafb;padding:20px;text-align:center;border-bottom:1px solid #e5e7eb">
          <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280">Amount</div>
          <div style="font-size:30px;font-weight:700;color:${color};margin-top:4px">${sign}${amt} ${sym}</div>
          <div style="display:inline-block;margin-top:8px;padding:3px 10px;border-radius:999px;background:#dcfce7;color:#166534;font-size:11px;font-weight:600">COMPLETED</div>
        </div>
        <div style="padding:8px 20px 14px">${details(row(partyLabel, who) + row(`${partyLabel} address`, partyAddr))}
          <div style="border-top:1px solid #e5e7eb;margin-top:8px;padding-top:10px;display:flex;justify-content:space-between;font-size:13px"><span style="color:#6b7280">${balLabel}</span><strong>${bal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 8 })} ${sym}</strong></div>
        </div>
      </div>`;
    const results: Record<string, string> = {};
    const sName = sender?.full_name || sender?.email || "BoA member";
    const rName = recipient?.full_name || recipient?.email || "BoA member";
    if (sender?.email) {
      await sendEmail(sender.email, `Transfer confirmation: ${amt} ${sym} sent`, brandedEmail("Transfer confirmation", card(`Your transfer to <strong>${esc(rName)}</strong> has been completed.`, "-", "#b91c1c", rName, "Recipient", a(t.recipient_id)?.address ?? "—", "Available balance", balOf(t.sender_id, Number(a(t.sender_id)?.units ?? 0))), footer));
      results.sender = "sent";
    }
    if (recipient?.email) {
      await sendEmail(recipient.email, `Funds received: ${amt} ${sym}`, brandedEmail("Funds received", card(`You have received a transfer from <strong>${esc(sName)}</strong>.`, "+", "#15803d", sName, "Sender", a(t.sender_id)?.address ?? "—", "Available balance", balOf(t.recipient_id, Number(a(t.recipient_id)?.units ?? 0))), footer));
      results.recipient = "sent";
    }
    return json({ ok: true, results });
  } catch (e) {
    console.error("notify-coin-transfer failed:", e);
    return json({ error: e instanceof Error ? e.message : "Email failed" }, 500);
  }
});
