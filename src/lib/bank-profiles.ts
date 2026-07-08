/**
 * Per-currency banking transfer profiles. Determines which fields the
 * external-transfer form collects and how the confirmation email renders them.
 * Each currency may expose multiple schemes (e.g. USD → ACH, Domestic Wire,
 * International Wire) so the user can pick the transfer style that fits.
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
  /** Stable id, unique per currency. */
  id: string;
  /** Human-readable transfer scheme name shown in UI & email */
  scheme: string;
  /** Short marketing-style tagline for the scheme selector */
  tagline?: string;
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
const SWIFT_CODE: BankField = {
  key: "swift",
  label: "SWIFT / BIC Code",
  placeholder: "8 or 11 chars",
  uppercase: true,
  maxLength: 11,
  required: true,
};
const BANK_NAME: BankField = { key: "bank", label: "Bank Name", placeholder: "Recipient's bank", required: true };
const BANK_ADDRESS: BankField = { key: "bank_address", label: "Bank Address", placeholder: "Street, City, Country", required: true };
const CORRESPONDENT: BankField = { key: "correspondent", label: "Correspondent Bank (optional)", placeholder: "Intermediary bank", required: false };
const ACCOUNT_NUM = (label = "Account Number", placeholder = "Recipient account"): BankField => ({
  key: "account",
  label,
  placeholder,
  inputMode: "numeric",
  required: true,
});

/** Grouped per-currency scheme list. First entry is the default. */
export const BANK_SCHEMES: Record<string, BankingProfile[]> = {
  USD: [
    {
      id: "ach",
      scheme: "ACH Transfer",
      tagline: "Low-cost domestic transfer",
      region: "United States",
      settlement: "1–3 business days",
      fields: [
        BANK_NAME,
        { key: "routing", label: "Routing Number (ABA)", placeholder: "9 digits", inputMode: "numeric", maxLength: 9, required: true },
        ACCOUNT_NUM(),
      ],
    },
    {
      id: "domestic_wire",
      scheme: "Domestic Wire",
      tagline: "Same-day US wire",
      region: "United States",
      settlement: "Same business day",
      fields: [
        BANK_NAME,
        { key: "routing", label: "Wire Routing Number", placeholder: "9 digits", inputMode: "numeric", maxLength: 9, required: true },
        ACCOUNT_NUM(),
        BANK_ADDRESS,
      ],
    },
    {
      id: "international_wire",
      scheme: "International Wire (SWIFT)",
      tagline: "Cross-border USD wire",
      region: "Worldwide",
      settlement: "1–5 business days",
      fields: [BANK_NAME, SWIFT_CODE, ACCOUNT_NUM("Account / IBAN"), BANK_ADDRESS, CORRESPONDENT],
    },
    {
      id: "fedwire_now",
      scheme: "FedNow Instant Payment",
      tagline: "24/7 instant settlement",
      region: "United States",
      settlement: "Seconds",
      fields: [
        BANK_NAME,
        { key: "routing", label: "Routing Number", placeholder: "9 digits", inputMode: "numeric", maxLength: 9, required: true },
        ACCOUNT_NUM(),
      ],
    },
  ],
  EUR: [
    {
      id: "sepa",
      scheme: "SEPA Credit Transfer",
      tagline: "Standard Euro payment",
      region: "Eurozone (SEPA)",
      settlement: "Same day – 1 business day",
      fields: [BANK_NAME, IBAN, BIC],
    },
    {
      id: "sepa_instant",
      scheme: "SEPA Instant Credit",
      tagline: "Within 10 seconds",
      region: "Eurozone",
      settlement: "Seconds (24/7)",
      fields: [BANK_NAME, IBAN, BIC],
    },
    {
      id: "target2",
      scheme: "TARGET2 High-Value",
      tagline: "Large-value RTGS",
      region: "Eurozone",
      settlement: "Same business day",
      fields: [BANK_NAME, IBAN, BIC, BANK_ADDRESS],
    },
    {
      id: "swift_eur",
      scheme: "SWIFT International (EUR)",
      tagline: "Cross-border wire",
      region: "Worldwide",
      settlement: "1–3 business days",
      fields: [BANK_NAME, SWIFT_CODE, IBAN, BANK_ADDRESS, CORRESPONDENT],
    },
  ],
  GBP: [
    {
      id: "faster_payments",
      scheme: "Faster Payments",
      tagline: "Instant UK transfer",
      region: "United Kingdom",
      settlement: "Within minutes",
      fields: [
        BANK_NAME,
        { key: "sort_code", label: "Sort Code", placeholder: "00-00-00", inputMode: "numeric", required: true, help: "6 digits, e.g. 20-00-00" },
        ACCOUNT_NUM("Account Number", "8 digits"),
      ],
    },
    {
      id: "chaps",
      scheme: "CHAPS High-Value",
      tagline: "Same-day large payments",
      region: "United Kingdom",
      settlement: "Same business day",
      fields: [
        BANK_NAME,
        { key: "sort_code", label: "Sort Code", placeholder: "00-00-00", inputMode: "numeric", required: true },
        ACCOUNT_NUM("Account Number", "8 digits"),
        { key: "reference", label: "Payment Reference", placeholder: "e.g. Property purchase", required: true },
      ],
    },
    {
      id: "bacs",
      scheme: "BACS Direct Credit",
      tagline: "Batch UK payroll-style",
      region: "United Kingdom",
      settlement: "3 business days",
      fields: [
        BANK_NAME,
        { key: "sort_code", label: "Sort Code", placeholder: "00-00-00", inputMode: "numeric", required: true },
        ACCOUNT_NUM("Account Number", "8 digits"),
      ],
    },
    {
      id: "swift_gbp",
      scheme: "SWIFT International (GBP)",
      tagline: "Send GBP abroad",
      region: "Worldwide",
      settlement: "1–3 business days",
      fields: [BANK_NAME, SWIFT_CODE, IBAN, BANK_ADDRESS],
    },
  ],
  JPY: [
    {
      id: "zengin",
      scheme: "Zengin Domestic Transfer",
      tagline: "Standard Japanese transfer",
      region: "Japan",
      settlement: "Same business day",
      fields: [
        BANK_NAME,
        { key: "branch", label: "Branch Name / Code", placeholder: "e.g. Shibuya 001", required: true },
        { key: "account_type", label: "Account Type", placeholder: "Futsu (Ordinary) / Toza (Current)", required: true },
        ACCOUNT_NUM("Account Number", "7 digits"),
      ],
    },
    {
      id: "furikomi_express",
      scheme: "Furikomi Express",
      tagline: "Priority same-day",
      region: "Japan",
      settlement: "Within 2 hours",
      fields: [
        BANK_NAME,
        { key: "branch", label: "Branch Code", placeholder: "3 digits", inputMode: "numeric", maxLength: 3, required: true },
        ACCOUNT_NUM("Account Number", "7 digits"),
      ],
    },
    {
      id: "swift_jpy",
      scheme: "SWIFT International (JPY)",
      tagline: "Cross-border wire",
      region: "Worldwide",
      settlement: "1–3 business days",
      fields: [BANK_NAME, SWIFT_CODE, ACCOUNT_NUM(), BANK_ADDRESS],
    },
  ],
  CAD: [
    {
      id: "eft",
      scheme: "EFT (Interac)",
      tagline: "Standard Canadian EFT",
      region: "Canada",
      settlement: "1–2 business days",
      fields: [
        BANK_NAME,
        { key: "institution", label: "Institution Number", placeholder: "3 digits", inputMode: "numeric", maxLength: 3, required: true },
        { key: "transit", label: "Transit Number", placeholder: "5 digits", inputMode: "numeric", maxLength: 5, required: true },
        ACCOUNT_NUM(),
      ],
    },
    {
      id: "interac_etransfer",
      scheme: "Interac e-Transfer",
      tagline: "Email-based instant send",
      region: "Canada",
      settlement: "Within 30 minutes",
      fields: [
        BANK_NAME,
        { key: "email", label: "Recipient Email", placeholder: "name@email.com", inputMode: "email", required: true },
        { key: "security_q", label: "Security Question", placeholder: "e.g. Our favourite city?", required: true },
        { key: "security_a", label: "Security Answer", placeholder: "Answer", required: true },
      ],
    },
    {
      id: "swift_cad",
      scheme: "SWIFT International (CAD)",
      tagline: "Cross-border wire",
      region: "Worldwide",
      settlement: "1–3 business days",
      fields: [BANK_NAME, SWIFT_CODE, ACCOUNT_NUM(), BANK_ADDRESS],
    },
  ],
  AUD: [
    {
      id: "osko",
      scheme: "Osko / PayID",
      tagline: "Near-instant Australian transfer",
      region: "Australia",
      settlement: "Near-instant",
      fields: [
        BANK_NAME,
        { key: "payid", label: "PayID (phone / email / ABN)", placeholder: "name@email.com or +61…", required: true },
      ],
    },
    {
      id: "bsb",
      scheme: "BSB Transfer",
      tagline: "Standard BSB + Account",
      region: "Australia",
      settlement: "1 business day",
      fields: [
        BANK_NAME,
        { key: "bsb", label: "BSB", placeholder: "000-000", inputMode: "numeric", required: true, help: "Bank State Branch, 6 digits" },
        ACCOUNT_NUM(),
      ],
    },
    {
      id: "swift_aud",
      scheme: "SWIFT International (AUD)",
      tagline: "Cross-border wire",
      region: "Worldwide",
      settlement: "1–3 business days",
      fields: [BANK_NAME, SWIFT_CODE, ACCOUNT_NUM(), BANK_ADDRESS],
    },
  ],
  CHF: [
    {
      id: "sic",
      scheme: "SIC Domestic Transfer",
      tagline: "Swiss real-time gross settlement",
      region: "Switzerland",
      settlement: "Same business day",
      fields: [BANK_NAME, IBAN, BIC],
    },
    {
      id: "sepa_chf",
      scheme: "SEPA (CHF)",
      tagline: "Euro-area friendly",
      region: "Switzerland / Eurozone",
      settlement: "Same day – 1 business day",
      fields: [BANK_NAME, IBAN, BIC],
    },
    {
      id: "swift_chf",
      scheme: "SWIFT International (CHF)",
      tagline: "Cross-border wire",
      region: "Worldwide",
      settlement: "1–3 business days",
      fields: [BANK_NAME, SWIFT_CODE, IBAN, BANK_ADDRESS],
    },
  ],
  CNY: [
    {
      id: "cnaps",
      scheme: "CNAPS Domestic Transfer",
      tagline: "Standard mainland transfer",
      region: "China (Mainland)",
      settlement: "Same business day",
      fields: [
        BANK_NAME,
        { key: "cnaps", label: "CNAPS Code", placeholder: "12 digits", inputMode: "numeric", maxLength: 12, required: true },
        { key: "branch", label: "Branch", placeholder: "Recipient branch", required: true },
        ACCOUNT_NUM("UnionPay / Account No."),
      ],
    },
    {
      id: "unionpay",
      scheme: "UnionPay Instant",
      tagline: "Card-to-card instant",
      region: "China",
      settlement: "Near-instant",
      fields: [
        BANK_NAME,
        ACCOUNT_NUM("UnionPay Card Number", "16–19 digits"),
      ],
    },
    {
      id: "swift_cny",
      scheme: "SWIFT International (CNY)",
      tagline: "Cross-border wire",
      region: "Worldwide",
      settlement: "1–3 business days",
      fields: [BANK_NAME, SWIFT_CODE, ACCOUNT_NUM(), BANK_ADDRESS],
    },
  ],
  INR: [
    {
      id: "imps",
      scheme: "IMPS Instant Transfer",
      tagline: "24/7 instant transfer",
      region: "India",
      settlement: "Within seconds",
      fields: [
        BANK_NAME,
        { key: "ifsc", label: "IFSC Code", placeholder: "e.g. HDFC0001234", uppercase: true, maxLength: 11, required: true },
        ACCOUNT_NUM(),
      ],
    },
    {
      id: "neft",
      scheme: "NEFT Batch Transfer",
      tagline: "Standard batch transfer",
      region: "India",
      settlement: "Same business day",
      fields: [
        BANK_NAME,
        { key: "ifsc", label: "IFSC Code", placeholder: "e.g. HDFC0001234", uppercase: true, maxLength: 11, required: true },
        ACCOUNT_NUM(),
      ],
    },
    {
      id: "rtgs",
      scheme: "RTGS High-Value",
      tagline: "Large-value real-time",
      region: "India",
      settlement: "Within 30 minutes",
      fields: [
        BANK_NAME,
        { key: "ifsc", label: "IFSC Code", placeholder: "e.g. HDFC0001234", uppercase: true, maxLength: 11, required: true },
        ACCOUNT_NUM(),
      ],
    },
    {
      id: "upi",
      scheme: "UPI Payment",
      tagline: "Send to UPI ID / VPA",
      region: "India",
      settlement: "Instant",
      fields: [
        { key: "upi_id", label: "UPI ID / VPA", placeholder: "name@bank", required: true },
      ],
    },
  ],
  MXN: [
    {
      id: "spei",
      scheme: "SPEI Transfer",
      tagline: "Instant Mexican transfer",
      region: "Mexico",
      settlement: "Near-instant",
      fields: [
        BANK_NAME,
        { key: "clabe", label: "CLABE", placeholder: "18 digits", inputMode: "numeric", maxLength: 18, required: true, help: "Standardized bank code (18 digits)" },
      ],
    },
    {
      id: "spei_debit_card",
      scheme: "SPEI via Debit Card",
      tagline: "Send to card number",
      region: "Mexico",
      settlement: "Near-instant",
      fields: [
        BANK_NAME,
        { key: "card", label: "Debit Card Number", placeholder: "16 digits", inputMode: "numeric", maxLength: 16, required: true },
      ],
    },
    {
      id: "swift_mxn",
      scheme: "SWIFT International (MXN)",
      tagline: "Cross-border wire",
      region: "Worldwide",
      settlement: "1–3 business days",
      fields: [BANK_NAME, SWIFT_CODE, { key: "clabe", label: "CLABE", inputMode: "numeric", maxLength: 18, required: true }],
    },
  ],
  BRL: [
    {
      id: "pix",
      scheme: "Pix Instant",
      tagline: "24/7 instant payment",
      region: "Brazil",
      settlement: "Seconds",
      fields: [
        BANK_NAME,
        { key: "pix_key", label: "Pix Key", placeholder: "CPF, email, phone or random key", required: true },
      ],
    },
    {
      id: "ted",
      scheme: "TED Same-Day",
      tagline: "Same-day electronic transfer",
      region: "Brazil",
      settlement: "Same business day",
      fields: [
        BANK_NAME,
        { key: "agency", label: "Agency", placeholder: "4 digits", inputMode: "numeric", required: true },
        ACCOUNT_NUM(),
        { key: "cpf", label: "Recipient CPF/CNPJ", placeholder: "000.000.000-00", required: true },
      ],
    },
    {
      id: "doc",
      scheme: "DOC Transfer",
      tagline: "Next-day transfer",
      region: "Brazil",
      settlement: "Next business day",
      fields: [
        BANK_NAME,
        { key: "agency", label: "Agency", placeholder: "4 digits", inputMode: "numeric", required: true },
        ACCOUNT_NUM(),
      ],
    },
  ],
  NGN: [
    {
      id: "nip",
      scheme: "NIBSS Instant (NIP)",
      tagline: "Instant Naira transfer",
      region: "Nigeria",
      settlement: "Instant",
      fields: [
        BANK_NAME,
        ACCOUNT_NUM("NUBAN Account Number", "10 digits"),
        { key: "bvn", label: "Bank Verification Number (optional)", placeholder: "11 digits", inputMode: "numeric", maxLength: 11, required: false },
      ],
    },
    {
      id: "neft_ng",
      scheme: "NEFT Nigeria",
      tagline: "Batch clearing",
      region: "Nigeria",
      settlement: "Same business day",
      fields: [
        BANK_NAME,
        ACCOUNT_NUM("NUBAN Account Number", "10 digits"),
      ],
    },
    {
      id: "rtgs_ng",
      scheme: "RTGS High-Value",
      tagline: "Large-value real-time",
      region: "Nigeria",
      settlement: "Same business day",
      fields: [
        BANK_NAME,
        ACCOUNT_NUM("NUBAN Account Number", "10 digits"),
        { key: "reference", label: "Payment Purpose", placeholder: "e.g. Contract settlement", required: true },
      ],
    },
  ],
  ZAR: [
    {
      id: "eft_za",
      scheme: "EFT Transfer",
      tagline: "Standard South African EFT",
      region: "South Africa",
      settlement: "1–2 business days",
      fields: [
        BANK_NAME,
        { key: "branch_code", label: "Branch Code", placeholder: "6 digits", inputMode: "numeric", required: true },
        ACCOUNT_NUM(),
      ],
    },
    {
      id: "payshap",
      scheme: "PayShap Instant",
      tagline: "Real-time low-value",
      region: "South Africa",
      settlement: "Seconds",
      fields: [
        BANK_NAME,
        { key: "shap_id", label: "ShapID (phone)", placeholder: "+27…", required: true },
      ],
    },
    {
      id: "rtc_za",
      scheme: "RTC Real-Time Clearing",
      tagline: "Near-instant EFT",
      region: "South Africa",
      settlement: "Within 60 seconds",
      fields: [
        BANK_NAME,
        { key: "branch_code", label: "Branch Code", placeholder: "6 digits", inputMode: "numeric", required: true },
        ACCOUNT_NUM(),
      ],
    },
  ],
  AED: [
    {
      id: "uaefts",
      scheme: "UAEFTS Transfer",
      tagline: "Standard UAE transfer",
      region: "United Arab Emirates",
      settlement: "Same business day",
      fields: [BANK_NAME, IBAN, BIC],
    },
    {
      id: "aani",
      scheme: "Aani Instant Payment",
      tagline: "24/7 instant UAE",
      region: "United Arab Emirates",
      settlement: "Seconds",
      fields: [
        BANK_NAME,
        { key: "alias", label: "Aani Alias (phone / email)", placeholder: "+971…", required: true },
      ],
    },
    {
      id: "swift_aed",
      scheme: "SWIFT International (AED)",
      tagline: "Cross-border wire",
      region: "Worldwide",
      settlement: "1–3 business days",
      fields: [BANK_NAME, SWIFT_CODE, IBAN, BANK_ADDRESS],
    },
  ],
};

export const DEFAULT_PROFILE: BankingProfile = BANK_SCHEMES.USD[0];

/** Legacy single-profile map kept for backwards compatibility. */
export const BANK_PROFILES: Record<string, BankingProfile> = Object.fromEntries(
  Object.entries(BANK_SCHEMES).map(([k, v]) => [k, v[0]])
);

export function getBankingProfile(code: string, schemeId?: string): BankingProfile {
  const list = BANK_SCHEMES[code?.toUpperCase()] ?? BANK_SCHEMES.USD;
  if (schemeId) {
    const match = list.find((p) => p.id === schemeId);
    if (match) return match;
  }
  return list[0];
}

export function getBankingSchemes(code: string): BankingProfile[] {
  return BANK_SCHEMES[code?.toUpperCase()] ?? BANK_SCHEMES.USD;
}
