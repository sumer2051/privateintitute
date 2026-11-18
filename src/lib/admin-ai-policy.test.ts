import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { canReview, reviewContext, reviewPrompt } from "../../supabase/functions/admin-ai-review/policy";
import { mergeReviewHeaders } from "../../supabase/functions/admin-ai-review/run-id";

describe("admin assistant access", () => {
  it("keeps approval instructions advisory without executing financial changes", () => {
    const prompt = reviewPrompt("question", "Approve this transaction");
    assert.ok(prompt.includes("Never claim to perform any action"));
    assert.ok(prompt.includes("manual controls"));
    assert.ok(prompt.includes("Approve this transaction"));
  });
  it("includes a selected older transaction separately without exposing its ID", () => {
    const context = reviewContext([], [], { id: "private-id", amount: -75, transaction_type: "debit", status: "pending", category: "Transfer", created_at: "2025-01-01" } as never);
    assert.equal(context.selected_transaction?.amount_usd, -75);
    assert.equal(context.selected_transaction?.status, "pending");
    assert.equal(JSON.stringify(context).includes("private-id"), false);
  });
  it("returns one CORS origin when gateway headers use lowercase names", () => {
    const headers = mergeReviewHeaders({ "Access-Control-Allow-Origin": "*" }, new Headers({ "access-control-allow-origin": "*", "x-lovable-aig-run-id": "server-run" }));
    assert.equal(headers.get("access-control-allow-origin"), "*");
    assert.equal(headers.get("x-lovable-aig-run-id"), "server-run");
  });
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