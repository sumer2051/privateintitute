import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

function client(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_payees",
  title: "List bill-pay payees",
  description: "Return the signed-in user's saved bill-pay payees (account numbers redacted).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const { data, error } = await client(ctx)
      .from("payees")
      .select("id,payee_name,payee_type,account_number,is_active")
      .eq("user_id", ctx.getUserId());
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const redacted = (data ?? []).map((p: any) => ({
      ...p,
      account_number: p.account_number ? `••••${String(p.account_number).slice(-4)}` : null,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(redacted, null, 2) }],
      structuredContent: { payees: redacted },
    };
  },
});
