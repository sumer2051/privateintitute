// Helpers for reading the receiving institution / payment brand captured on the
// transfer form, so the "Successful · posting by <X>" stage can name it.
//
// Rules:
//  - Bank-rail transfers (ACH, SEPA, wires, Faster Payments…) carry a
//    "Bank Name: …" detail — we name the recipient's bank.
//  - Wallet/brand rails (Cash App, PayPal, Venmo, Zelle…) have no bank field —
//    we name the brand from the "[Cash App] To …" prefix.

export const recipientBankFromDescription = (description?: string | null): string => {
  const text = String(description || "");
  const m = /(?:Beneficiary bank|Recipient(?:'s)? bank|Bank name|Bank)\s*:\s*([^·—\n]+)/i.exec(text);
  return (m ? m[1] : "").trim().replace(/\s{2,}/g, " ");
};

/** Brand / scheme tag from a "[Cash App] To …" style description. */
export const schemeFromDescription = (description?: string | null): string => {
  const text = String(description || "");
  const m = /^\s*\[([^\]]+)\]/.exec(text);
  if (m) return m[1].trim();
  if (/^\s*Zelle\b/i.test(text)) return "Zelle";
  return "";
};

/** Who is posting the money: recipient bank for bank rails, brand otherwise. */
export const postingVia = (description?: string | null): string => {
  const bank = recipientBankFromDescription(description);
  if (bank) return bank;
  const scheme = schemeFromDescription(description);
  if (scheme) return scheme;
  return "";
};

export const postingLabel = (description?: string | null): string => {
  const via = postingVia(description);
  return via ? `Successful · posting by ${via}` : "Successful · posting by recipient bank";
};
