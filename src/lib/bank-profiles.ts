/**
 * Per-currency banking transfer profiles. Determines which fields the
 * external-transfer form collects and how the confirmation email renders them.
 */
export interface BankField {
  key: string;
  label: string;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "tel" | "email";
  maxLength?: number;
  help?: string;
  required?: boolean;
  uppercase?: boolean;
}

export interface BankingProfile {
  /** Human-readable transfer scheme name shown in UI & email */
  scheme: string;
  /** Country / region label */
  region: string;
  /** Approx settlement time copy */
  settlement: string;
  /** Field set collected for a recipient of this currency */
  fields: BankField[];
}

const IBAN: BankField = {
  key: "iban",
  label: "IBAN",
  placeholder: "e.g. DE89 3704 0044 0532 0130 00",
  uppercase: true,
  required: true,
  help: "International Bank Account Number",
};
const BIC: BankField = {
  key: "bic",
  label: "BIC / SWIFT",
  placeholder: "e.g. COBADEFFXXX",
  uppercase: true,
  required: true,
};
const BANK_NAME: BankField = { key: "bank", label: "Bank Name", placeholder: "Recipient's bank", required: true };
const ACCOUNT_NUM = (label = "Account Number", placeholder = "Recipient account"): BankField => ({
  key: "account",
  label,
  placeholder,
  inputMode: "numeric",
  required: true,
});

export const BANK_PROFILES: Record<string, BankingProfile> = {
  USD: {
    scheme: "ACH / Wire Transfer",
    region: "United States",
    settlement: "1–3 business days",
    fields: [
      BANK_NAME,
      { key: "routing", label: "Routing Number (ABA)", placeholder: "9 digits", inputMode: "numeric", maxLength: 9, required: true },
      ACCOUNT_NUM(),
    ],
  },
  EUR: {
    scheme: "SEPA Credit Transfer",
    region: "Eurozone",
    settlement: "Same day – 1 business day",
    fields: [BANK_NAME, IBAN, BIC],
  },
  GBP: {
    scheme: "Faster Payments",
    region: "United Kingdom",
    settlement: "Within minutes",
    fields: [
      BANK_NAME,
      { key: "sort_code", label: "Sort Code", placeholder: "00-00-00", inputMode: "numeric", required: true, help: "6 digits, e.g. 20-00-00" },
      ACCOUNT_NUM("Account Number", "8 digits"),
    ],
  },
  JPY: {
    scheme: "Zengin Domestic Transfer",
    region: "Japan",
    settlement: "Same business day",
    fields: [
      BANK_NAME,
      { key: "branch", label: "Branch Name / Code", placeholder: "e.g. Shibuya 001", required: true },
      { key: "account_type", label: "Account Type", placeholder: "Futsu (Ordinary) / Toza (Current)", required: true },
      ACCOUNT_NUM("Account Number", "7 digits"),
    ],
  },
  CAD: {
    scheme: "EFT (Interac)",
    region: "Canada",
    settlement: "1–2 business days",
    fields: [
      BANK_NAME,
      { key: "institution", label: "Institution Number", placeholder: "3 digits", inputMode: "numeric", maxLength: 3, required: true },
      { key: "transit", label: "Transit Number", placeholder: "5 digits", inputMode: "numeric", maxLength: 5, required: true },
      ACCOUNT_NUM(),
    ],
  },
  AUD: {
    scheme: "Osko / BSB Transfer",
    region: "Australia",
    settlement: "Near-instant",
    fields: [
      BANK_NAME,
      { key: "bsb", label: "BSB", placeholder: "000-000", inputMode: "numeric", required: true, help: "Bank State Branch, 6 digits" },
      ACCOUNT_NUM(),
    ],
  },
  CHF: {
    scheme: "SIC / SEPA Transfer",
    region: "Switzerland",
    settlement: "Same day – 1 business day",
    fields: [BANK_NAME, IBAN, BIC],
  },
  CNY: {
    scheme: "CNAPS / UnionPay Transfer",
    region: "China (Mainland)",
    settlement: "Same business day",
    fields: [
      BANK_NAME,
      { key: "cnaps", label: "CNAPS Code", placeholder: "12 digits", inputMode: "numeric", maxLength: 12, required: true },
      { key: "branch", label: "Branch", placeholder: "Recipient branch", required: true },
      ACCOUNT_NUM("UnionPay / Account No."),
    ],
  },
  INR: {
    scheme: "IMPS / NEFT",
    region: "India",
    settlement: "Near-instant (IMPS) or same day (NEFT)",
    fields: [
      BANK_NAME,
      { key: "ifsc", label: "IFSC Code", placeholder: "e.g. HDFC0001234", uppercase: true, maxLength: 11, required: true },
      ACCOUNT_NUM(),
    ],
  },
  MXN: {
    scheme: "SPEI Transfer",
    region: "Mexico",
    settlement: "Near-instant",
    fields: [
      BANK_NAME,
      { key: "clabe", label: "CLABE", placeholder: "18 digits", inputMode: "numeric", maxLength: 18, required: true, help: "Standardized bank code (18 digits)" },
    ],
  },
  BRL: {
    scheme: "Pix / TED Transfer",
    region: "Brazil",
    settlement: "Instant (Pix)",
    fields: [
      BANK_NAME,
      { key: "pix_key", label: "Pix Key", placeholder: "CPF, email, phone or random key", required: true },
      { key: "account", label: "Account (optional TED)", placeholder: "Agency / Account", required: false },
    ],
  },
  NGN: {
    scheme: "NIBSS Instant Payment (NIP)",
    region: "Nigeria",
    settlement: "Instant",
    fields: [
      BANK_NAME,
      ACCOUNT_NUM("NUBAN Account Number", "10 digits"),
      { key: "bvn", label: "Bank Verification Number (optional)", placeholder: "11 digits", inputMode: "numeric", maxLength: 11, required: false },
    ],
  },
  ZAR: {
    scheme: "EFT Transfer",
    region: "South Africa",
    settlement: "1–2 business days",
    fields: [
      BANK_NAME,
      { key: "branch_code", label: "Branch Code", placeholder: "6 digits", inputMode: "numeric", required: true },
      ACCOUNT_NUM(),
    ],
  },
  AED: {
    scheme: "UAEFTS Transfer",
    region: "United Arab Emirates",
    settlement: "Same business day",
    fields: [BANK_NAME, IBAN, BIC],
  },
};

export const DEFAULT_PROFILE: BankingProfile = BANK_PROFILES.USD;

export function getBankingProfile(code: string): BankingProfile {
  return BANK_PROFILES[code?.toUpperCase()] ?? DEFAULT_PROFILE;
}
