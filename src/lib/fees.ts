// Reads a fee out of whatever the customer typed on the transfer form.
// Any field whose label mentions "fee"/"charge", or any free-text value that
// mentions a fee with a number ("Fee 2.50", "incl. charge of £3"), is used.

const NUM = /(-?\d{1,3}(?:[,\d]{0,12})?(?:\.\d{1,2})?)/;

const toNumber = (raw: string): number | null => {
  const cleaned = raw.replace(/[^\d.,-]/g, "").replace(/,(?=\d{3}\b)/g, "").replace(/,/g, ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Pulls the fee amount from form fields plus any note / reference text. */
export const readFeeFromForm = (
  fields: Record<string, string> = {},
  ...extras: (string | undefined | null)[]
): number | null => {
  for (const [key, value] of Object.entries(fields)) {
    if (!value) continue;
    if (/\b(fee|fees|charge|charges|commission)\b/i.test(key)) {
      const direct = toNumber(value);
      if (direct !== null) return direct;
    }
  }
  const texts = [...Object.values(fields), ...extras].filter(Boolean) as string[];
  for (const text of texts) {
    const m = new RegExp(`\\b(?:fee|fees|charge|charges|commission)\\b[^\\d-]{0,20}${NUM.source}`, "i").exec(text);
    if (m) {
      const n = toNumber(m[1]);
      if (n !== null) return n;
    }
    const m2 = new RegExp(`${NUM.source}[^\\d]{0,12}\\b(?:fee|fees|charge|charges|commission)\\b`, "i").exec(text);
    if (m2) {
      const n = toNumber(m2[1]);
      if (n !== null) return n;
    }
  }
  return null;
};

/** Field keys/labels that should not be repeated in the receipt detail rows. */
export const isFeeField = (key: string) => /\b(fee|fees|charge|charges|commission)\b/i.test(key);
