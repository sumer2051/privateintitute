/**
 * Country-specific transfer methods driven by the top currency switcher.
 * Each entry maps a currency code to the local transfer methods available in
 * that country (in addition to the generic external / Zelle flows).
 *
 * `receiptStyle` controls the visual tone of the receipt shown after send:
 *   - "casual"  → social-payment vibe (Venmo/Cash App/GCash/Kakao/WeChat)
 *   - "formal"  → bank-wire compliance style (Wire/SWIFT/CHAPS/PayPal G&S)
 *   - "minimal" → clean, functional (Zelle/SEPA/UPI/PIX/Interac/PayID/Alipay)
 */
import type { BankField } from "./bank-profiles";

export type ReceiptStyle = "casual" | "formal" | "minimal";

export interface CountryMethod {
  id: string;
  name: string;
  tagline: string;
  settlement: string;
  /** Emoji glyph used as a visual "logo" — no trademarked assets. */
  glyph: string;
  /** Tailwind gradient classes for the method's brand accent. */
  accent: string; // e.g. "from-purple-600 to-indigo-600"
  receiptStyle: ReceiptStyle;
  fields: BankField[];
  /** Payment sub-type (e.g. PayPal Friends & Family vs Goods & Services). */
  variants?: { value: string; label: string }[];
}

const EMAIL: BankField = { key: "email", label: "Recipient Email", placeholder: "name@email.com", inputMode: "email", required: true };
const PHONE_OR_EMAIL: BankField = { key: "handle", label: "Phone or Email", placeholder: "+1 555-555-5555 or name@email.com", required: true };
const HANDLE: BankField = { key: "handle", label: "@Username / Handle", placeholder: "@yourfriend", required: true };
const NOTE: BankField = { key: "note", label: "Note (emoji welcome ✨)", placeholder: "Pizza night 🍕", required: false };
const ROUTING: BankField = { key: "routing", label: "Routing Number (ABA)", placeholder: "9 digits", inputMode: "numeric", maxLength: 9, required: true };
const ACCOUNT: BankField = { key: "account", label: "Account Number", placeholder: "Recipient account", inputMode: "numeric", required: true };
const BANK: BankField = { key: "bank", label: "Bank Name", placeholder: "Recipient bank", required: true };
const IBAN: BankField = { key: "iban", label: "IBAN", placeholder: "DE89 3704 0044 0532 0130 00", uppercase: true, required: true };
const BIC: BankField = { key: "bic", label: "BIC / SWIFT", placeholder: "COBADEFFXXX", uppercase: true, required: true };
const SWIFT: BankField = { key: "swift", label: "SWIFT / BIC Code", placeholder: "8 or 11 chars", uppercase: true, maxLength: 11, required: true };
const IFSC: BankField = { key: "ifsc", label: "IFSC Code", placeholder: "HDFC0001234", uppercase: true, maxLength: 11, required: true };
const SORT_CODE: BankField = { key: "sort_code", label: "Sort Code", placeholder: "00-00-00", inputMode: "numeric", required: true };

export const COUNTRY_METHODS: Record<string, CountryMethod[]> = {
  USD: [
    { id: "zelle",  name: "Zelle",   tagline: "Bank-to-bank in minutes", settlement: "Minutes", glyph: "Z",  accent: "from-purple-600 to-fuchsia-600", receiptStyle: "minimal", fields: [PHONE_OR_EMAIL, { key: "recipient_name", label: "Recipient Name", required: true, placeholder: "Jane Doe" }] },
    { id: "venmo",  name: "Venmo",   tagline: "Pay friends with a note", settlement: "Instant", glyph: "V",  accent: "from-sky-500 to-blue-600", receiptStyle: "casual", fields: [HANDLE, NOTE] },
    { id: "cashapp",name: "Cash App",tagline: "Send by $Cashtag",         settlement: "Instant", glyph: "$",  accent: "from-green-500 to-emerald-600", receiptStyle: "casual", fields: [{ key: "handle", label: "$Cashtag", placeholder: "$yourfriend", required: true }, NOTE] },
    { id: "paypal", name: "PayPal",  tagline: "Friends or Goods & Services", settlement: "Minutes", glyph: "P", accent: "from-blue-600 to-indigo-700", receiptStyle: "formal", fields: [EMAIL], variants: [{ value: "ff", label: "Friends & Family" }, { value: "gs", label: "Goods & Services" }] },
    { id: "ach",    name: "ACH Transfer", tagline: "Standard US bank transfer", settlement: "1–3 business days", glyph: "A", accent: "from-slate-600 to-slate-800", receiptStyle: "minimal", fields: [BANK, ROUTING, ACCOUNT] },
    { id: "wire",   name: "Domestic Wire", tagline: "Same-day US wire",        settlement: "Same business day", glyph: "W", accent: "from-navy-700 to-slate-900", receiptStyle: "formal", fields: [BANK, ROUTING, ACCOUNT, { key: "bank_address", label: "Bank Address", required: true, placeholder: "Street, City, State" }] },
  ],
  CAD: [
    { id: "interac", name: "Interac e-Transfer", tagline: "Email-based instant send", settlement: "Within 30 minutes", glyph: "i", accent: "from-yellow-500 to-orange-500", receiptStyle: "minimal", fields: [{ key: "recipient_name", label: "Recipient Name", required: true, placeholder: "Jane Doe" }, EMAIL, { key: "security_q", label: "Security Question", required: true, placeholder: "Our favourite city?" }, { key: "security_a", label: "Security Answer", required: true, placeholder: "Answer" }] },
    { id: "wire_ca", name: "Wire Transfer",     tagline: "Same-day Canadian wire",   settlement: "Same business day",  glyph: "W", accent: "from-red-600 to-red-800", receiptStyle: "formal", fields: [BANK, { key: "institution", label: "Institution Number", placeholder: "3 digits", inputMode: "numeric", maxLength: 3, required: true }, { key: "transit", label: "Transit Number", placeholder: "5 digits", inputMode: "numeric", maxLength: 5, required: true }, ACCOUNT] },
  ],
  GBP: [
    { id: "faster_payments", name: "Faster Payments", tagline: "Instant UK transfer",   settlement: "Within minutes",   glyph: "F", accent: "from-rose-600 to-red-700", receiptStyle: "minimal", fields: [BANK, SORT_CODE, { ...ACCOUNT, label: "Account Number", placeholder: "8 digits" }] },
    { id: "paypal_uk",       name: "PayPal",          tagline: "Friends or Goods & Services", settlement: "Minutes", glyph: "P", accent: "from-blue-600 to-indigo-700", receiptStyle: "formal", fields: [EMAIL], variants: [{ value: "ff", label: "Friends & Family" }, { value: "gs", label: "Goods & Services" }] },
    { id: "chaps",           name: "CHAPS",           tagline: "Same-day large-value",  settlement: "Same business day", glyph: "C", accent: "from-slate-700 to-slate-900", receiptStyle: "formal", fields: [BANK, SORT_CODE, ACCOUNT, { key: "reference", label: "Payment Reference", required: true, placeholder: "e.g. Property purchase" }] },
    { id: "bacs",            name: "BACS",            tagline: "Batch UK payroll-style", settlement: "3 business days", glyph: "B", accent: "from-emerald-700 to-teal-800", receiptStyle: "minimal", fields: [BANK, SORT_CODE, { ...ACCOUNT, placeholder: "8 digits" }] },
  ],
  EUR: [
    { id: "sepa",         name: "SEPA Credit Transfer", tagline: "Standard Euro payment", settlement: "Same day – 1 business day", glyph: "S", accent: "from-blue-500 to-cyan-600", receiptStyle: "minimal", fields: [BANK, IBAN, BIC] },
    { id: "sepa_instant", name: "SEPA Instant",         tagline: "Within 10 seconds",     settlement: "Seconds (24/7)",           glyph: "⚡", accent: "from-amber-400 to-orange-500", receiptStyle: "minimal", fields: [BANK, IBAN, BIC] },
    { id: "paypal_eu",    name: "PayPal",               tagline: "Friends or Goods & Services", settlement: "Minutes",           glyph: "P", accent: "from-blue-600 to-indigo-700", receiptStyle: "formal", fields: [EMAIL], variants: [{ value: "ff", label: "Friends & Family" }, { value: "gs", label: "Goods & Services" }] },
  ],
  INR: [
    { id: "upi",  name: "UPI",  tagline: "Pay any UPI ID instantly", settlement: "Instant",             glyph: "U", accent: "from-orange-500 to-pink-600", receiptStyle: "minimal", fields: [{ key: "upi_id", label: "UPI ID / VPA", placeholder: "name@bank", required: true }] },
    { id: "imps", name: "IMPS", tagline: "24/7 instant transfer",   settlement: "Within seconds",       glyph: "I", accent: "from-green-500 to-emerald-700", receiptStyle: "minimal", fields: [BANK, ACCOUNT, IFSC] },
    { id: "neft", name: "NEFT", tagline: "Standard batch transfer", settlement: "Same business day",    glyph: "N", accent: "from-sky-600 to-blue-700",     receiptStyle: "minimal", fields: [BANK, ACCOUNT, IFSC] },
    { id: "rtgs", name: "RTGS", tagline: "High-value real-time",    settlement: "Within 30 minutes",    glyph: "R", accent: "from-slate-700 to-slate-900",  receiptStyle: "formal",  fields: [BANK, ACCOUNT, IFSC] },
  ],
  CNY: [
    { id: "alipay",  name: "Alipay-style",  tagline: "Wallet-to-wallet",  settlement: "Instant", glyph: "支", accent: "from-blue-500 to-cyan-500",  receiptStyle: "minimal", fields: [{ key: "wallet_id", label: "Alipay ID (phone/email)", required: true, placeholder: "+86 138…" }] },
    { id: "wechat",  name: "WeChat Pay-style", tagline: "Chat + pay",     settlement: "Instant", glyph: "微", accent: "from-green-500 to-emerald-600", receiptStyle: "casual", fields: [{ key: "wallet_id", label: "WeChat ID / Phone", required: true, placeholder: "@weid or +86…" }, NOTE] },
  ],
  BRL: [
    { id: "pix", name: "PIX",  tagline: "24/7 instant payment",  settlement: "Seconds",        glyph: "P", accent: "from-teal-500 to-emerald-600", receiptStyle: "minimal", fields: [{ key: "pix_key", label: "PIX Key", required: true, placeholder: "CPF, email, phone or random key" }] },
    { id: "ted", name: "TED",  tagline: "Same-day wire",         settlement: "Same business day", glyph: "T", accent: "from-slate-700 to-slate-900", receiptStyle: "formal", fields: [BANK, { key: "agency", label: "Agency", placeholder: "4 digits", inputMode: "numeric", required: true }, ACCOUNT, { key: "cpf", label: "Recipient CPF/CNPJ", required: true, placeholder: "000.000.000-00" }] },
    { id: "doc", name: "DOC",  tagline: "Next-day wire",         settlement: "Next business day", glyph: "D", accent: "from-slate-600 to-slate-800", receiptStyle: "formal", fields: [BANK, { key: "agency", label: "Agency", placeholder: "4 digits", inputMode: "numeric", required: true }, ACCOUNT] },
  ],
  NGN: [
    { id: "mpesa_ng", name: "Mobile Money", tagline: "M-Pesa-style wallet", settlement: "Instant", glyph: "M", accent: "from-green-600 to-emerald-700", receiptStyle: "minimal", fields: [{ key: "phone", label: "Mobile Wallet Number", required: true, placeholder: "+234…", inputMode: "tel" }] },
    { id: "nip_ng",   name: "Bank Transfer (NIP)", tagline: "Instant NUBAN transfer", settlement: "Instant", glyph: "N", accent: "from-emerald-700 to-teal-800", receiptStyle: "minimal", fields: [BANK, { ...ACCOUNT, label: "NUBAN Account Number", placeholder: "10 digits" }] },
  ],
  ZAR: [
    { id: "mpesa_ke", name: "Mobile Money", tagline: "M-Pesa-style wallet",  settlement: "Instant", glyph: "M", accent: "from-green-600 to-emerald-700", receiptStyle: "minimal", fields: [{ key: "phone", label: "Mobile Wallet Number", required: true, placeholder: "+27…", inputMode: "tel" }] },
    { id: "eft_za",   name: "Bank Transfer (EFT)", tagline: "Standard South African EFT", settlement: "1–2 business days", glyph: "E", accent: "from-amber-600 to-yellow-700", receiptStyle: "minimal", fields: [BANK, { key: "branch_code", label: "Branch Code", inputMode: "numeric", required: true, placeholder: "6 digits" }, ACCOUNT] },
  ],
  AUD: [
    { id: "payid", name: "PayID / Osko", tagline: "Near-instant Australian transfer", settlement: "Near-instant",  glyph: "P", accent: "from-emerald-500 to-teal-600", receiptStyle: "minimal", fields: [{ key: "payid", label: "PayID (phone / email / ABN)", required: true, placeholder: "name@email.com or +61…" }] },
    { id: "wire_au", name: "Wire Transfer", tagline: "Bank wire (BSB + Account)",  settlement: "1 business day", glyph: "W", accent: "from-slate-700 to-slate-900", receiptStyle: "formal", fields: [BANK, { key: "bsb", label: "BSB", inputMode: "numeric", required: true, placeholder: "000-000" }, ACCOUNT] },
  ],
  JPY: [
    { id: "zengin", name: "Zengin Bank Transfer", tagline: "Standard Japanese transfer", settlement: "Same business day", glyph: "銀", accent: "from-red-600 to-rose-700", receiptStyle: "minimal", fields: [BANK, { key: "branch", label: "Branch Name / Code", required: true, placeholder: "e.g. Shibuya 001" }, { key: "account_type", label: "Account Type", required: true, placeholder: "Futsu / Toza" }, { ...ACCOUNT, placeholder: "7 digits" }] },
    { id: "paypay", name: "PayPay-style", tagline: "QR / phone wallet",   settlement: "Instant", glyph: "P", accent: "from-red-500 to-orange-500", receiptStyle: "casual", fields: [{ key: "phone", label: "PayPay Phone", required: true, placeholder: "+81…", inputMode: "tel" }, NOTE] },
  ],
  // South Korea uses KRW which we don't ship — expose under JPY-like fallback? Keep separate under a synthetic KRW key would break switcher.
  // Mexico
  MXN: [
    { id: "spei",    name: "SPEI",  tagline: "Instant Mexican transfer", settlement: "Near-instant",     glyph: "S", accent: "from-emerald-600 to-green-700", receiptStyle: "minimal", fields: [BANK, { key: "clabe", label: "CLABE", inputMode: "numeric", maxLength: 18, required: true, placeholder: "18 digits" }] },
    { id: "wire_mx", name: "Wire",  tagline: "International bank wire",  settlement: "1–3 business days", glyph: "W", accent: "from-slate-700 to-slate-900",  receiptStyle: "formal",  fields: [BANK, SWIFT, { key: "clabe", label: "CLABE", inputMode: "numeric", maxLength: 18, required: true }] },
  ],
  CHF: [
    { id: "sic_chf", name: "SIC Transfer", tagline: "Swiss RTGS", settlement: "Same business day", glyph: "S", accent: "from-red-600 to-rose-700", receiptStyle: "minimal", fields: [BANK, IBAN, BIC] },
    { id: "swift_chf", name: "SWIFT Wire", tagline: "Cross-border wire", settlement: "1–3 business days", glyph: "W", accent: "from-slate-700 to-slate-900", receiptStyle: "formal", fields: [BANK, SWIFT, IBAN, { key: "bank_address", label: "Bank Address", required: true }] },
  ],
  AED: [
    { id: "aani",     name: "Aani Instant", tagline: "24/7 instant UAE", settlement: "Seconds", glyph: "A", accent: "from-emerald-600 to-green-700", receiptStyle: "minimal", fields: [BANK, { key: "alias", label: "Aani Alias (phone / email)", required: true, placeholder: "+971…" }] },
    { id: "uaefts",   name: "UAEFTS Wire", tagline: "Standard UAE wire", settlement: "Same business day", glyph: "U", accent: "from-slate-700 to-slate-900", receiptStyle: "formal", fields: [BANK, IBAN, BIC] },
  ],
};

/** SWIFT cross-border wire used whenever no local methods exist for a currency. */
export const SWIFT_FALLBACK: CountryMethod = {
  id: "swift_wire",
  name: "SWIFT International Wire",
  tagline: "Cross-border wire with FX conversion",
  settlement: "1–5 business days",
  glyph: "✈",
  accent: "from-slate-700 to-slate-900",
  receiptStyle: "formal",
  fields: [BANK, SWIFT, { key: "account", label: "IBAN or Account Number", required: true, placeholder: "Recipient account" }, { key: "bank_address", label: "Bank Address", required: true, placeholder: "Street, City, Country" }],
};

const withNote = (m: CountryMethod): CountryMethod =>
  m.fields.some((f) => f.key === "note")
    ? m
    : { ...m, fields: [...m.fields, NOTE] };

export function getCountryMethods(code: string): CountryMethod[] {
  const list = COUNTRY_METHODS[code?.toUpperCase()];
  const base = list && list.length ? [...list, SWIFT_FALLBACK] : [SWIFT_FALLBACK];
  return base.map(withNote);
}

