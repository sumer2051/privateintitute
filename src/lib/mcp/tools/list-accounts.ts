import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function client(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_accounts",
  title: "List accounts",
  description: "Return the signed-in user's bank accounts with balances (account numbers redacted to last 4).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const { data, error } = await client(ctx)
      .from("accounts")
      .select("id,account_type,account_name,account_number,balance,available_balance,credit_limit,is_active")
      .eq("user_id", ctx.getUserId());
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const redacted = (data ?? []).map((a: any) => ({
      ...a,
      account_number: a.account_number ? `••••${String(a.account_number).slice(-4)}` : null,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(redacted, null, 2) }],
      structuredContent: { accounts: redacted },
    };
  },
});
