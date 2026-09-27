export interface SpendableAccount {
  account_type: string;
  balance: number;
  available_balance?: number | null;
  credit_limit?: number | null;
}

/**
 * Money a customer can actually spend from an account.
 * Credit cards spend against their remaining credit line, not their stored
 * balance (which is the amount owed).
 */
export const spendableOf = (a?: SpendableAccount | null): number =>
  !a
    ? 0
    : a.account_type === "credit"
      ? (a.available_balance ?? Math.max((a.credit_limit ?? 0) - a.balance, 0))
      : a.balance;

/** Signed balance delta for a debit: a credit card charge raises the amount owed. */
export const debitDelta = (a: SpendableAccount, amt: number): number =>
  a.account_type === "credit" ? amt : -amt;
