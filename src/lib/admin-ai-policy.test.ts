import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { canReview, reviewContext } from "../../supabase/functions/admin-ai-review/policy";

describe("admin assistant access", () => {
  it("only permits an authenticated administrator with a successful role check", () => {
    assert.equal(canReview("admin-id", true, null), true);
    assert.equal(canReview(undefined, true, null), false);
    assert.equal(canReview("member-id", false, null), false);
    assert.equal(canReview("admin-id", true, new Error("Role check failed")), false);
  });
  it("shares ledger activity without names, email, account numbers, or free-text descriptions", () => {
    const input = { account_type: "checking", balance: 100, available_balance: 80, is_frozen: false, account_number: "123456", email: "private@example.com" };
    const context = reviewContext([input], [{ amount: -20, transaction_type: "debit", status: "pending", category: "Transfer", created_at: "2026-10-31", description: "Sensitive payee" } as never]);
    assert.equal(context.ledger_currency, "USD");
    assert.equal(context.accounts[0].balance_usd, 100);
    assert.equal(context.transactions[0].amount_usd, -20);
    assert.equal(JSON.stringify(context).includes("private@example.com"), false);
    assert.equal(JSON.stringify(context).includes("123456"), false);
    assert.equal(JSON.stringify(context).includes("Sensitive payee"), false);
  });
});