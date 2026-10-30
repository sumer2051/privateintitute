import { describe, it, expect } from "bun:test";
import { transactionAmountInput, transactionAmountToUsd } from "./transaction-amount";

describe("transaction currency amount editing", () => {
  it("opens a GBP transfer in pounds, not dollars", () => {
    expect(transactionAmountInput(-100, 0.78)).toBe("78.00");
  });
  it("converts the edited GBP amount to ledger dollars", () => {
    expect(transactionAmountToUsd("156", -100, 0.78)).toBe(200);
  });
  it("converts an edited EUR amount to ledger dollars", () => {
    expect(transactionAmountToUsd("184", -100, 0.92)).toBe(200);
  });
  it("does not change the ledger when only status changes", () => {
    expect(transactionAmountToUsd("0.01", -0.02, 0.78)).toBe(0.02);
  });
  it("keeps dollar amounts unchanged by conversion", () => {
    expect(transactionAmountToUsd("125", -100, 1)).toBe(125);
  });
  it("rejects invalid amounts", () => {
    for (const input of ["", "0", "-1", "Infinity", "invalid"]) {
      expect(Number.isNaN(transactionAmountToUsd(input, -100, 0.78))).toBe(true);
    }
  });
});