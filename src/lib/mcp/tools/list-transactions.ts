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
  name: "list_transactions",
  title: "List recent transactions",
  description: "Return the signed-in user's most recent transactions across all accounts.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).default(20).describe("How many transactions to return (max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = client(ctx);
    const accounts = await sb.from("accounts").select("id").eq("user_id", ctx.getUserId());
    if (accounts.error) return { content: [{ type: "text", text: accounts.error.message }], isError: true };
    const ids = (accounts.data ?? []).map((a: any) => a.id);
    if (!ids.length) {
      return { content: [{ type: "text", text: "No accounts found." }], structuredContent: { transactions: [] } };
    }
    const { data, error } = await sb
      .from("transactions")
      .select("id,account_id,transaction_type,amount,balance_after,description,category,status,created_at")
      .in("account_id", ids)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { transactions: data ?? [] },
    };
  },
});
