import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  buildStatement,
  isCounted,
  netChange,
  signedAmount,
  statementFileName,
  statementTotals,
  type StatementTx,
} from "./statement";

const BASE: StatementTx = {
  id: "t1",
  account_id: "a1",
  transaction_type: "credit",
  created_at: "2026-11-20T10:00:00.000Z",
  description: "Salary",
  recipient_name: null,
  reference_number: null,
  category: "income",
  amount: 500,
  balance_after: 1500,
  status: "completed",
};

const tx = (over: Partial<StatementTx>): StatementTx => Object.assign({}, BASE, over);

const account = {
  account_name: "Everyday Checking",
  account_number: "4821",
  account_type: "checking",
  balance: 1300,
};

describe("isCounted", () => {
  it("ignores failed and cancelled payments", () => {
    assert.equal(isCounted("failed"), false);
    assert.equal(isCounted("Cancelled"), false);
    assert.equal(isCounted("completed"), true);
    assert.equal(isCounted(null), true);
  });
});

describe("signedAmount", () => {
  it("treats a debit stored as a positive number as money out", () => {
    assert.equal(signedAmount({ transaction_type: "debit", amount: 553.91 }), -553.91);
  });

  it("treats a credit stored as a negative number as money in", () => {
    assert.equal(signedAmount({ transaction_type: "credit", amount: -134.89 }), 134.89);
  });
});

describe("netChange", () => {
  const now = new Date("2026-11-27T12:00:00.000Z");

  it("adds only money moved inside the window", () => {
    const txs = [
      tx({ created_at: "2026-11-20T10:00:00.000Z", transaction_type: "credit", amount: 500 }),
      tx({ id: "t2", created_at: "2026-11-22T10:00:00.000Z", transaction_type: "debit", amount: 200 }),
      tx({ id: "t3", created_at: "2026-01-05T10:00:00.000Z", transaction_type: "debit", amount: 900 }),
    ];
    assert.equal(netChange(txs, 30, now), 300);
  });

  it("leaves out failed and cancelled payments", () => {
    const txs = [
      tx({ transaction_type: "credit", amount: 500 }),
      tx({ id: "t2", transaction_type: "debit", amount: 1000, status: "failed" }),
      tx({ id: "t3", transaction_type: "debit", amount: 50, status: "cancelled" }),
    ];
    assert.equal(netChange(txs, 30, now), 500);
  });

  it("is zero with nothing to add up", () => {
    assert.equal(netChange([], 30, now), 0);
  });
});

describe("statementTotals", () => {
  it("splits money in from money out by the recorded type", () => {
    const txs = [
      tx({ transaction_type: "credit", amount: 500 }),
      tx({ id: "t2", transaction_type: "debit", amount: 200 }),
      tx({ id: "t3", transaction_type: "debit", amount: 100 }),
    ];
    assert.deepEqual(statementTotals(txs), { moneyIn: 500, moneyOut: 300 });
  });
});

describe("buildStatement", () => {
  const now = new Date("2026-11-27T12:00:00.000Z");

  it("lists the member's own payments with amounts and balances", () => {
    const txs = [
      tx({ id: "t2", created_at: "2026-11-22T09:30:00.000Z", recipient_name: "Rent", transaction_type: "debit", amount: 200, balance_after: 1300 }),
      tx({ id: "t1", created_at: "2026-11-20T10:00:00.000Z", description: "Salary", transaction_type: "credit", amount: 500, balance_after: 1500 }),
    ];
    const text = buildStatement(account, txs, "Ada Doe", now);
    assert.match(text, /Ada Doe/);
    assert.match(text, /••••4821/);
    assert.match(text, /Salary/);
    assert.match(text, /Rent/);
    assert.match(text, /\+500\.00/);
    assert.match(text, /-200\.00/);
    assert.match(text, /Money in:   500\.00/);
    assert.match(text, /Money out:  200\.00/);
    assert.match(text, /Closing balance: 1300\.00/);
    // oldest payment first
    assert.ok(text.indexOf("Salary") < text.indexOf("Rent"));
  });

  it("says so plainly when there is nothing to list", () => {
    const text = buildStatement(account, [tx({ status: "failed" })], "Ada Doe", now);
    assert.match(text, /No transactions to show for this account\./);
    assert.match(text, /Money in:   0\.00/);
  });
});

describe("statementFileName", () => {
  it("keeps the account name out of the file name", () => {
    const name = statementFileName(
      { account_name: "Everyday Checking!", account_number: "4821", account_type: "checking", balance: 0 },
      new Date("2026-11-27T12:00:00.000Z"),
    );
    assert.equal(name, "boa-statement-everyday-checking-2026-11-27.txt");
  });
});
