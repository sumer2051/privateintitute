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
    const { data: addrs } = await admin.from("coin_balances").select("user_id, address, balance").in("user_id", [t.sender_id, t.recipient_id]);
    const p = (id: string) => people?.find((x) => x.id === id);
    const a = (id: string) => addrs?.find((x) => x.user_id === id);
    const sender = p(t.sender_id), recipient = p(t.recipient_id);
    const amt = Number(t.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const when = new Date(t.created_at).toUTCString();
    const row = (k: string, v: string) => `<tr><td style="padding:6px 0;color:#6b7280">${k}</td><td style="padding:6px 0;text-align:right;font-family:monospace;word-break:break-all">${esc(v)}</td></tr>`;
    const details = (extra: string) => `<table style="width:100%;font-size:13px;border-collapse:collapse">${extra}${row("Amount", `${amt} BOA`)}${t.note ? row("Note", t.note) : ""}${row("Date", when)}${row("Transfer ID", t.id)}</table>`;
    const footer = "BoA Coin is an in-app balance between BoA members. It is not a cryptocurrency.";

    const results: Record<string, string> = {};
    if (sender?.email) {
      await sendEmail(sender.email, `You sent ${amt} BOA`, brandedEmail("Coins sent", `<p>You sent <strong>${amt} BOA</strong> to ${esc(recipient?.full_name || recipient?.email || "a member")}.</p>${details(row("To address", a(t.recipient_id)?.address ?? "—"))}<p>Remaining balance: <strong>${Number(a(t.sender_id)?.balance ?? 0).toFixed(2)} BOA</strong></p>`, footer));
      results.sender = "sent";
    }
    if (recipient?.email) {
      await sendEmail(recipient.email, `You received ${amt} BOA`, brandedEmail("Coins received", `<p>You received <strong>${amt} BOA</strong> from ${esc(sender?.full_name || sender?.email || "a member")}.</p>${details(row("From address", a(t.sender_id)?.address ?? "—"))}<p>New balance: <strong>${Number(a(t.recipient_id)?.balance ?? 0).toFixed(2)} BOA</strong></p>`, footer));
      results.recipient = "sent";
    }
    return json({ ok: true, results });
  } catch (e) {
    console.error("notify-coin-transfer failed:", e);
    return json({ error: e instanceof Error ? e.message : "Email failed" }, 500);
  }
});
