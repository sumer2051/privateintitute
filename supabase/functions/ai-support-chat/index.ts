import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY")!;
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "admin@example.com";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

const SYSTEM_PROMPT = `You are "Ava", a friendly live support agent for BoA private institute, a private banking portal.
You help users with: account questions, transfers, Zelle, bill pay, security, login issues, and general banking guidance.
- Keep replies short, warm, and professional.
- NEVER ask for passwords, full card numbers, SSN, or one-time codes.
- If the user asks for human help, says you can't solve it, expresses frustration, or describes a complex issue (fraud, dispute, account locked, large transfer issue, legal), call the notify_admin tool to schedule a follow-up from a human specialist, then tell the user a specialist will reach out within 24 hours.
- Always call notify_admin BEFORE telling the user help is on the way.`;

function buildRawEmail(to: string, subject: string, body: string): string {
  const msg = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=\"UTF-8\"",
    "",
    body,
  ].join("\r\n");
  // base64url
  return btoa(msg).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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

  const raw = buildRawEmail(ADMIN_EMAIL, subject, body);
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
    const userEmail = (claimsData.claims.email as string) || "unknown@user";
    const userName = ((claimsData.claims.user_metadata as any)?.full_name as string) || userEmail;

    const { messages } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tools = [
      {
        type: "function",
        function: {
          name: "notify_admin",
          description: "Email a human specialist to follow up with the user. Use when user asks for human help or has a complex issue.",
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
    ];

    const convo = [
      { role: "system", content: `${SYSTEM_PROMPT}\n\nUser context: name=${userName}, email=${userEmail}` },
      ...messages,
    ];

    // Up to 3 tool-call rounds
    for (let i = 0; i < 3; i++) {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
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
            try {
              args = JSON.parse(tc.function.arguments || "{}");
            } catch {}
            try {
              await sendAdminEmail(args.summary || "User requested help.", userEmail, userName, args.urgency || "normal");
              convo.push({
                role: "tool",
                tool_call_id: tc.id,
                content: JSON.stringify({ ok: true, message: "Admin notified by email." }),
              });
            } catch (e) {
              convo.push({
                role: "tool",
                tool_call_id: tc.id,
                content: JSON.stringify({ ok: false, error: (e as Error).message }),
              });
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
