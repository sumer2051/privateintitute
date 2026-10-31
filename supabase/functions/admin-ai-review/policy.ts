export const REVIEW_MODEL = "anthropic/claude-sonnet-5";

export function canReview(userId: string | undefined, roleResult: unknown, roleError: unknown) {
  return Boolean(userId) && !roleError && roleResult === true;
}

type Account = { account_type: string; balance: number; available_balance: number; is_frozen: boolean | null };
type Transaction = { amount: number; transaction_type: string; status: string; category: string | null; created_at: string };

export function reviewContext(accounts: Account[], transactions: Transaction[]) {
  return {
    ledger_currency: "USD",
    scope: "Current accounts and at most 50 latest transactions; not a full statement or proof of external settlement.",
    accounts: accounts.map((a, i) => ({ label: `Account ${i + 1}`, type: a.account_type, balance_usd: a.balance, available_usd: a.available_balance, frozen: a.is_frozen })),
    transactions: transactions.map((t, i) => ({ label: `Transaction ${i + 1}`, amount_usd: t.amount, direction: t.transaction_type, status: t.status, category: t.category, date: t.created_at })),
  };
}