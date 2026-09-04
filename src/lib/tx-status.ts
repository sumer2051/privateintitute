// Helpers for reading the recipient bank captured on the transfer form so the
// "Successful · posting by <bank>" stage can name the receiving institution.

export const recipientBankFromDescription = (description?: string | null): string => {
  const text = String(description || "");
  const m = /(?:Beneficiary bank|Recipient(?:'s)? bank|Bank name|Bank)\s*:\s*([^·—\n]+)/i.exec(text);
  return (m ? m[1] : "").trim().replace(/\s{2,}/g, " ");
};

export const postingLabel = (description?: string | null): string => {
  const bank = recipientBankFromDescription(description);
  return bank ? `Successful · posting by ${bank}` : "Successful · posting by recipient bank";
};
