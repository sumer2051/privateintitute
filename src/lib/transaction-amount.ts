/** Edit USD-backed transactions in their displayed currency without rounding unchanged values. */
export const transactionAmountInput = (usd: number, rate: number): string =>
  (Math.abs(usd) * rate).toFixed(2);

export const transactionAmountToUsd = (input: string, originalUsd: number, rate: number): number => {
  const value = Number(input);
  if (!input.trim() || !Number.isFinite(value) || value <= 0 || !Number.isFinite(rate) || rate <= 0) return NaN;
  if (value === Number(transactionAmountInput(originalUsd, rate))) return Math.abs(originalUsd);
  return Math.round((value / rate) * 100) / 100;
};