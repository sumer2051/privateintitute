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
    if (t && t.kind === "buy" && t.recipient_id === u.user.id) {
      const { data: me } = await admin.from("profiles").select("full_name, email").eq("id", u.user.id).maybeSingle();
      if (!me?.email) return json({ ok: true, results: {} });
      const sym = String(t.symbol ?? "BOA");
      const units = Number(t.units ?? t.amount);
      const amt = units.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 8 });
      const paid = /\$([0-9.]+)/.exec(String(t.note ?? ""))?.[1] ?? "";
      const from = /from (.+)$/.exec(String(t.note ?? ""))?.[1] ?? "Bank account";
      const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
      const priceStr = paid && units ? `$${(Number(paid) / units).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";
      const txid = String(t.id).replace(/-/g, "").slice(0, 8).toUpperCase();
      const date = new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric", timeZone: "UTC" });
      const line = (pre: string, val: string, post = "") => `<div style="font-size:16px;line-height:26px;color:#111">${pre}<strong>${esc(val)}</strong>${post}</div>`;
      const link = "color:#111;text-decoration:underline";
      const site = "https://privateintitute.lovable.app";
      const html = `<!doctype html><html><body style="margin:0;padding:0;background:#ffffff">
<div style="background:#f2f2f7;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif">
<div style="max-width:520px;margin:0 auto">
<div style="background:#ffffff;border-radius:22px;padding:36px 28px">
<h1 style="margin:0 0 26px;font-size:34px;line-height:40px;font-weight:400;color:#111">You bought ${esc(sym)}</h1>
<p style="margin:0 0 22px;font-size:16px;line-height:26px;color:#111">A total of ${esc(units.toFixed(8))} ${esc(sym)} was added to your account balance.</p>
<p style="margin:0 0 22px;font-size:16px;line-height:26px;color:#111">Here are the details:</p>
<div style="background:#f2f2f7;border-radius:18px;padding:24px 28px;margin:0 0 26px">
<div style="font-size:16px;line-height:26px;color:#111">Paid <strong>${esc(paid ? usd(Number(paid)) : "—")}</strong> with <strong>${esc(from.toLowerCase())}</strong></div>
${line("Transaction ID: ", txid)}${line("Date: ", date)}${line(`${esc(sym)} price: `, priceStr)}${line("Fees: ", "$0.00")}
</div>
<p style="margin:26px 0 22px;font-size:16px;line-height:26px;color:#111">Transactions may not be cancelled once initiated. All purchases are final and non-refundable. If you have any questions or concerns please visit our <a href="${site}/support" style="${link}">FAQ</a>, <a href="${site}/support" style="${link}">support center</a> or <a href="${site}/support" style="${link}">call us</a>.</p>
<p style="margin:0;font-size:16px;line-height:26px;color:#111">This transaction, along with all others you make, can be viewed in the Activity tab of your investment account.</p>
</div>
<p style="margin:18px 4px 0;font-size:12px;line-height:18px;color:#6b7280">If you did not make this purchase, contact support immediately.</p>
</div></div></body></html>`;
      await sendEmail(me.email, `You bought ${sym}`, html);
      return json({ ok: true, results: { buyer: "sent" } });
    }
    if (!t || t.sender_id !== u.user.id || t.kind !== "transfer") return json({ error: "Transfer not found" }, 404);

    const { data: people } = await admin.from("profiles").select("id, full_name, email").in("id", [t.sender_id, t.recipient_id]);
    const { data: addrs } = await admin.from("coin_balances").select("user_id, address, units").in("user_id", [t.sender_id, t.recipient_id]);
    const p = (id: string) => people?.find((x) => x.id === id);
    const sym = String(t.symbol ?? "BOA");
    const ca = sym === "BOA" ? null : (await admin.from("coin_addresses").select("user_id, address").eq("symbol", sym).in("user_id", [t.sender_id, t.recipient_id])).data;
    const a = (id: string) => { const b = addrs?.find((x) => x.user_id === id); return ca ? { units: b?.units ?? 0, address: ca.find((x) => x.user_id === id)?.address ?? "—" } : b; };
    const sender = p(t.sender_id), recipient = p(t.recipient_id);
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
      const units = Number(t.units ?? t.amount);
      const site = "https://privateintitute.lovable.app";
      let usdVal = "";
      try {
        const { data: rate } = await admin.from("coin_rates").select("usd").eq("symbol", sym).maybeSingle();
        const price = Number(rate?.usd ?? (sym === "BOA" ? 1 : 0));
        if (price > 0) usdVal = ` ($${(units * price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD)`;
      } catch { /* rate lookup optional */ }
      const amtShort = `${units.toFixed(8)} ${sym}`;
      const html = `<!doctype html><html><body style="margin:0;padding:0;background:#0a0a0a">
<div style="background:#0a0a0a;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif">
<div style="max-width:520px;margin:0 auto">
<div style="background:#0052ff;border-radius:22px;padding:64px 14px 14px">
<div style="background:#000000;border-radius:18px;padding:48px 28px 36px;text-align:center">
<div style="width:88px;height:88px;margin:0 auto 28px;border:3px solid #0052ff;border-radius:999px;line-height:82px;font-size:44px;color:#0052ff">&#10003;</div>
<div style="font-size:30px;line-height:38px;font-weight:400;color:#ffffff">You just received</div>
<div style="margin:8px 0 30px;font-size:17px;line-height:24px;color:#9ca3af">${esc(amtShort)}${esc(usdVal)}</div>
<div style="border-top:1px solid #1f2937;margin:0 0 26px"></div>
<p style="margin:0 0 22px;font-size:16px;line-height:26px;color:#e5e7eb">You just received ${esc(amtShort)}${esc(usdVal)} from <strong style="color:#ffffff">${esc(sName)}</strong>. The amount has been added to your ${esc(sym)} balance and is available right away.</p>
${t.note ? `<p style="margin:0 0 22px;font-size:15px;line-height:24px;color:#9ca3af">Note: ${esc(t.note)}</p>` : ""}
<a href="${site}/investment" style="display:block;background:#0052ff;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:14px 0;border-radius:999px">View your balance</a>
</div>
</div>
<p style="margin:18px 4px 0;font-size:12px;line-height:18px;color:#6b7280">If you don't recognise this transfer, contact support.</p>
</div></div></body></html>`;
      await sendEmail(recipient.email, `You just received ${amtShort}`, html);
      results.recipient = "sent";
    }
    return json({ ok: true, results });
  } catch (e) {
    console.error("notify-coin-transfer failed:", e);
    return json({ error: e instanceof Error ? e.message : "Email failed" }, 500);
  }
});
