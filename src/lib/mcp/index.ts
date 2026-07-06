import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listAccountsTool from "./tools/list-accounts";
import listTransactionsTool from "./tools/list-transactions";
import listPayeesTool from "./tools/list-payees";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "boa-private-institute-mcp",
  title: "BoA private institute",
  version: "0.1.0",
  instructions:
    "Read-only banking tools for the signed-in BoA private institute user. Use `list_accounts` for balances, `list_transactions` for recent activity, and `list_payees` for saved bill-pay recipients.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listAccountsTool, listTransactionsTool, listPayeesTool],
});
