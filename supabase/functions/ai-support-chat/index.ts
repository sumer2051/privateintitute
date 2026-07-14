import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendEmail } from "../_shared/gmail.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "admin@example.com";

const SYSTEM_PROMPT = `You are "Ava", the senior AI banking concierge for BoA private institute — a private banking portal.

Personality: warm, sharp, concise, proactive. Sound like a top-tier private banker, not a chatbot. Use the user's name when it fits naturally.

Capabilities — you have LIVE READ access to the signed-in user's banking data via the structured "user_context" block provided at the start of the conversation. You can:
- Answer balance questions (checking, savings, credit) with exact figures.
- Explain recent transactions, spending categories, and trends.
- Walk users through transfers, Zelle, bill pay, scheduled payments, security settings, and login issues step-by-step.
- Spot anomalies (large debits, low balance, near credit limit) and proactively flag them.
- Do financial math (available balance after a planned transfer, % of credit used, monthly spend by category).
- Give clear, friendly explanations of banking concepts.

Hard rules:
- NEVER ask for passwords, full card numbers, SSN, CVV, or one-time codes. If a user shares one, tell them not to and ignore it.
- NEVER invent data. If something isn't in user_context, say you don't see it and offer to escalate.
- Currency: format as USD with two decimals (e.g. $4,582.75).
- Keep replies tight — 1-4 short paragraphs or a small bullet list. No walls of text.
- Use markdown sparingly (bold for figures, lists for steps).

Escalation: If the user (a) explicitly asks for a human, (b) reports fraud / unauthorized activity / a locked account / a legal matter / a dispute, or (c) you cannot resolve it after one attempt — call **create_support_ticket** (preferred) to open a tracked ticket with a reference number and email confirmation, then tell the user their ticket number and that a specialist will respond within 24 hours. Use notify_admin only for quick heads-ups that do not need tracking.`;

function buildRawEmail(to: string, subject: string, body: string): string {
  const msg = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=\"UTF-8\"",
    "",
    body,
  ].join("\r\n");
  return btoa(msg).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function gmailSend(to: string, subject: string, body: string) {
  const raw = buildRawEmail(to, subject, body);
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
    throw new Error(`Gmail send failed ${res.status}: ${t}`);
  }
  return await res.json();
}

async function sendAdminEmail(summary: string, userEmail: string, userName: string, urgency: string) {
  const subject = `[BoA Support — ${urgency.toUpperCase()}] Follow-up needed for ${userName || userEmail}`;
  const body = `A user has requested human support via the AI assistant.

User: ${userName || "(no name)"}
Email: ${userEmail}
Urgency: ${urgency}

--- Conversation summary ---
${summary}

Please reach out within 24 hours.`;
  return await gmailSend(ADMIN_EMAIL, subject, body);
}

async function sendUserConfirmationEmail(summary: string, userEmail: string, userName: string) {
  const subject = "We've received your support request — BoA private institute";
  const body = `Hi ${userName || "there"},

Thanks for reaching out to BoA private institute support. Our AI assistant has escalated your request to a human specialist on our team.

--- Summary of your request ---
${summary}

What happens next:
• A specialist will personally review your request.
• You'll hear back from us within 24 hours at this email address (${userEmail}).
• If your matter is urgent, you can also call our 24/7 support line listed in the Support section of your account.

For your security, we will never ask you for your password, full card number, or one-time codes by email.

Warm regards,
The BoA private institute Support Team`;
  return await gmailSend(userEmail, subject, body);
}

async function loadUserContext(supabase: any, userId: string) {
  const [profileRes, accountsRes, payeesRes, zelleRes, schedRes] = await Promise.all([
    supabase.from("profiles").select("full_name,email,phone,created_at").eq("id", userId).maybeSingle(),
    supabase.from("accounts").select("id,account_type,account_name,account_number,balance,available_balance,credit_limit,is_active").eq("user_id", userId),
    supabase.from("payees").select("id,payee_name,payee_type,account_number,is_active").eq("user_id", userId),
    supabase.from("zelle_contacts").select("id,contact_name,contact_email,contact_phone").eq("user_id", userId),
    supabase.from("scheduled_payments").select("id,account_id,payee_id,amount,frequency,next_payment_date,is_active").eq("user_id", userId),
  ]);

  const accounts = accountsRes.data ?? [];
  const accountIds = accounts.map((a: any) => a.id);
  let transactions: any[] = [];
  if (accountIds.length) {
    const txRes = await supabase
      .from("transactions")
      .select("id,account_id,transaction_type,amount,balance_after,description,category,status,created_at")
      .in("account_id", accountIds)
      .order("created_at", { ascending: false })
      .limit(40);
    transactions = txRes.data ?? [];
  }

  // Redact account numbers to last 4
  const redact = (n: string | null | undefined) => (n ? `••••${String(n).slice(-4)}` : null);
  const accountsRedacted = accounts.map((a: any) => ({ ...a, account_number: redact(a.account_number) }));
  const payeesRedacted = (payeesRes.data ?? []).map((p: any) => ({ ...p, account_number: redact(p.account_number) }));

  return {
    profile: profileRes.data ?? null,
    accounts: accountsRedacted,
    transactions,
    payees: payeesRedacted,
    zelle_contacts: zelleRes.data ?? [],
    scheduled_payments: schedRes.data ?? [],
    generated_at: new Date().toISOString(),
  };
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
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;
    const userEmail = (claimsData.claims.email as string) || "unknown@user";
    const userName =
      ((claimsData.claims.user_metadata as any)?.full_name as string) || userEmail;

    const { messages } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load fresh banking context for this user (RLS-scoped via auth header)
    let userContext: any = null;
    try {
      userContext = await loadUserContext(supabase, userId);
    } catch (e) {
      console.error("loadUserContext failed", (e as Error).message);
    }

    const tools = [
      {
        type: "function",
        function: {
          name: "notify_admin",
          description: "Email a human specialist to follow up with the user. Use when user asks for human help, reports fraud/dispute/locked account, or has a complex issue you cannot solve.",
          parameters: {
            type: "object",
            properties: {
              summary: { type: "string", description: "Concise summary of the user's issue and what they need." },
              urgency: { type: "string", enum: ["low", "normal", "high"], description: "Urgency level." },
            },
            required: ["summary", "urgency"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "create_support_ticket",
          description: "Create a formal, tracked support ticket. Prefer this over notify_admin when the user wants a reference number, or the issue needs follow-up (fraud, disputes, account access, unresolved questions).",
          parameters: {
            type: "object",
            properties: {
              subject: { type: "string", description: "Short subject line." },
              description: { type: "string", description: "Full description of the issue in the user's own words." },
              summary: { type: "string", description: "One-line AI summary." },
              priority: { type: "string", enum: ["low","medium","high","urgent"] },
              category: { type: "string", description: "account, transfers, cards, security, fraud, billing, or other" },
            },
            required: ["subject", "description", "priority"],
          },
        },
      },
    ];

    const contextBlock = userContext
      ? `\n\nuser_context (live, RLS-scoped to this signed-in user):\n${JSON.stringify(userContext, null, 2)}`
      : `\n\nuser_context: (unavailable — tell the user you can't read their data right now and offer to escalate)`;

    const convo: any[] = [
      {
        role: "system",
        content: `${SYSTEM_PROMPT}\n\nSigned-in user: name="${userName}", email="${userEmail}".${contextBlock}`,
      },
      ...messages,
    ];

    for (let i = 0; i < 3; i++) {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: convo,
          tools,
        }),
      });

      if (!aiRes.ok) {
        const errText = await aiRes.text();
        if (aiRes.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit reached. Please try again shortly." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (aiRes.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in workspace settings." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: `AI error: ${errText}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await aiRes.json();
      const choice = data.choices?.[0];
      const msg = choice?.message;
      if (!msg) {
        return new Response(JSON.stringify({ error: "No response from AI" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const toolCalls = msg.tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        convo.push(msg);
        for (const tc of toolCalls) {
          if (tc.function?.name === "notify_admin") {
            let args: any = {};
            try { args = JSON.parse(tc.function.arguments || "{}"); } catch {}
            try {
              const summaryText = args.summary || "User requested help.";
              await sendAdminEmail(summaryText, userEmail, userName, args.urgency || "normal");
              let userEmailed = false;
              try {
                await sendUserConfirmationEmail(summaryText, userEmail, userName);
                userEmailed = true;
              } catch (e) {
                console.error("user confirmation email failed", (e as Error).message);
              }
              convo.push({
                role: "tool",
                tool_call_id: tc.id,
                content: JSON.stringify({
                  ok: true,
                  message: `Admin notified.${userEmailed ? " Confirmation email sent to user." : ""}`,
                }),
              });
            } catch (e) {
              convo.push({
                role: "tool",
                tool_call_id: tc.id,
                content: JSON.stringify({ ok: false, error: (e as Error).message }),
              });
            }
          } else if (tc.function?.name === "create_support_ticket") {
            let args: any = {};
            try { args = JSON.parse(tc.function.arguments || "{}"); } catch {}
            try {
              const { data: ticket, error: tErr } = await supabase
                .from("support_tickets")
                .insert({
                  user_id: userId,
                  customer_name: userName,
                  customer_email: userEmail,
                  subject: String(args.subject || "Support request").slice(0, 200),
                  description: String(args.description || "").slice(0, 5000),
                  ai_summary: args.summary ? String(args.summary).slice(0, 2000) : null,
                  priority: ["low","medium","high","urgent"].includes(args.priority) ? args.priority : "medium",
                  category: args.category ? String(args.category).slice(0, 80) : null,
                  source: "ai",
                })
                .select()
                .single();
              if (tErr) throw new Error(tErr.message);
              await supabase.from("ticket_messages").insert({
                ticket_id: ticket.id,
                sender_type: "customer",
                sender_id: userId,
                message: String(args.description || ""),
              });
              try {
                await sendUserConfirmationEmail(
                  `Ticket ${ticket.ticket_number}\n\n${args.summary || args.description}`,
                  userEmail, userName
                );
                await sendAdminEmail(
                  `Ticket ${ticket.ticket_number} — ${args.subject}\n\n${args.description}`,
                  userEmail, userName, args.priority === "urgent" ? "high" : "normal"
                );
              } catch (e) { console.error("ticket emails failed", (e as Error).message); }
              convo.push({
                role: "tool",
                tool_call_id: tc.id,
                content: JSON.stringify({ ok: true, ticket_number: ticket.ticket_number, message: `Ticket ${ticket.ticket_number} created. Tell the user this exact number.` }),
              });
            } catch (e) {
              convo.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ ok: false, error: (e as Error).message }) });
            }
          } else {
            convo.push({
              role: "tool",
              tool_call_id: tc.id,
              content: JSON.stringify({ ok: false, error: "Unknown tool" }),
            });
          }
        }
        continue;
      }

      return new Response(
        JSON.stringify({ reply: msg.content || "" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ reply: "Sorry, something went wrong. Please try again." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
