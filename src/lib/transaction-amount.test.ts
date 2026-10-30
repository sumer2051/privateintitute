import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { transactionAmountInput, transactionAmountToUsd } from "./transaction-amount";

describe("transaction currency amount editing", () => {
  it("opens a GBP transfer in pounds, not dollars", () => {
    assert.equal(transactionAmountInput(-100, 0.78), "78.00");
  });
  it("converts the edited GBP amount to ledger dollars", () => {
    assert.equal(transactionAmountToUsd("156", -100, 0.78), 200);
  });
  it("converts an edited EUR amount to ledger dollars", () => {
    assert.equal(transactionAmountToUsd("184", -100, 0.92), 200);
  });
  it("does not change the ledger when only status changes", () => {
    assert.equal(transactionAmountToUsd("0.02", -0.02, 0.78), 0.02);
  });
  it("keeps dollar amounts unchanged by conversion", () => {
    assert.equal(transactionAmountToUsd("125", -100, 1), 125);
  });
  it("rejects invalid amounts", () => {
    for (const input of ["", "0", "-1", "Infinity", "invalid"]) {
      assert.equal(Number.isNaN(transactionAmountToUsd(input, -100, 0.78)), true);
    }
  });
});