// Real statement + balance-change figures for the home page.
//
// Rules:
//  - Every number comes from the member's own saved transactions. Nothing is
//    typed in, so a balance can never show a gain the member did not have.
//  - Failed and cancelled payments are not counted: no money moved.
//  - Amounts are in USD, the currency the ledger is stored in.

export interface StatementTx {
  id: string;
  account_id: string;
  transaction_type: string;
  created_at: string;
  description: string | null;
  recipient_name: string | null;
  reference_number: string | null;
  category: string | null;
  amount: number;
  balance_after: number;
  status: string | null;
}

export interface StatementAccount {
  account_name: string;
  account_number: string;
  account_type: string;
  balance: number;
}

/** A payment counts only if it did not fail or get cancelled. */
export const isCounted = (status?: string | null): boolean => {
  const s = (status || "").toLowerCase();
  return !s.includes("fail") && !s.includes("cancel");
};

/**
 * Whether money came in or went out.
 *
 * The stored `amount` sign cannot be trusted here: in this ledger most debits
 * are saved as positive numbers, so `amount > 0` is not the same as "money in".
 * The payment's own recorded type decides the direction, and the size is always
 * the magnitude of the amount.
 */
export const signedAmount = (t: Pick<StatementTx, "transaction_type" | "amount">): number => {
  const size = Math.abs(Number(t.amount) || 0);
  return (t.transaction_type || "").toLowerCase() === "debit" ? -size : size;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Money actually moved in the last `days` days for one account.
 * Positive means the balance grew, negative means it shrank.
 */
export const netChange = (
  txs: StatementTx[],
  days = 30,
  now: Date = new Date(),
): number => {
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
  let total = 0;
  for (const t of txs) {
    if (!isCounted(t.status)) continue;
    const at = new Date(t.created_at).getTime();
    if (Number.isNaN(at) || at < cutoff) continue;
    total += signedAmount(t);
  }
  return round2(total);
};

/** Money in and money out over the whole statement window. */
export const statementTotals = (txs: StatementTx[]) => {
  let moneyIn = 0;
  let moneyOut = 0;
  for (const t of txs) {
    if (!isCounted(t.status)) continue;
    const a = signedAmount(t);
    if (a >= 0) moneyIn += a;
    else moneyOut += -a;
  }
  return { moneyIn: round2(moneyIn), moneyOut: round2(moneyOut) };
};

const maskNumber = (n: string) => `••••${String(n || "").slice(-4)}`;

const rowDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 10);
};

const rowTime = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(11, 16);
};

/** Plain-text statement for one account, oldest payment first. */
export const buildStatement = (
  account: StatementAccount,
  txs: StatementTx[],
  holder: string,
  now: Date = new Date(),
): string => {
  const rows = txs
    .filter((t) => isCounted(t.status))
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const { moneyIn, moneyOut } = statementTotals(txs);
  const lines: string[] = [
    "BoA private institute",
    "Account Statement",
    "",
    `Account holder: ${holder || "—"}`,
    `Account: ${account.account_name} (${account.account_type})`,
    `Account number: ${maskNumber(account.account_number)}`,
    `Generated: ${now.toLocaleString()}`,
    "",
    "Transactions",
    "".padEnd(78, "-"),
    `${"Date".padEnd(12)}${"Time".padEnd(7)}${"Description".padEnd(28)}${"Amount".padStart(12)}${"Balance".padStart(15)}`,
    "".padEnd(78, "-"),
  ];

  if (rows.length === 0) {
    lines.push("No transactions to show for this account.");
  } else {
    for (const t of rows) {
      const desc = String(t.recipient_name || t.description || t.category || "Payment").slice(0, 26);
      const signed = signedAmount(t);
      const amount = `${signed >= 0 ? "+" : "-"}${Math.abs(signed).toFixed(2)}`;
      lines.push(
        `${rowDate(t.created_at).padEnd(12)}${rowTime(t.created_at).padEnd(7)}${desc.padEnd(28)}${amount.padStart(12)}${Number(t.balance_after).toFixed(2).padStart(15)}`,
      );
    }
  }

  lines.push("".padEnd(78, "-"));
  lines.push(`Money in:   ${moneyIn.toFixed(2)}`);
  lines.push(`Money out:  ${moneyOut.toFixed(2)}`);
  lines.push(`Closing balance: ${Number(account.balance).toFixed(2)}`);
  lines.push("");
  lines.push("For a signed statement, contact support.");

  return lines.join("\n");
};

/** File name for a downloaded statement, safe for any OS. */
export const statementFileName = (account: StatementAccount, now: Date = new Date()): string => {
  const safe = String(account.account_name || "account")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "account";
  return `boa-statement-${safe}-${now.toISOString().slice(0, 10)}.txt`;
};
