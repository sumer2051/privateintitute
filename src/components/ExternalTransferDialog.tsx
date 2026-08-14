import { useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, ShieldCheck, Building } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BankingProfile } from "@/lib/bank-profiles";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: BankingProfile;
  currencyCode: string;
  currencySymbol: string;
  amount: string;
  setAmount: (v: string) => void;
  recipient: string;
  setRecipient: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  memo: string;
  setMemo: (v: string) => void;
  fields: Record<string, string>;
  setFields: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  fromAccount: string;
  setFromAccount: (v: string) => void;
  accounts: { id: string; account_name: string; account_number: string; account_type: string; balance: number }[];
  formatCurrency: (usd: number) => string;
  loading: boolean;
  onSubmit: () => void;
}

const isNameKey = (key: string) => /name/.test(key) && !/bank|business|user|tag/.test(key);
const group = (v: string, size: number) =>
  v.replace(/\s+/g, "").replace(new RegExp(`(.{${size}})`, "g"), "$1 ").trim();

const formatFieldValue = (key: string, raw: string) => {
  const k = key.toLowerCase();
  if (/iban/.test(k)) return group(raw.toUpperCase().replace(/[^A-Z0-9]/g, ""), 4);
  if (/bic|swift/.test(k)) return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11);
  if (/sort_?code/.test(k)) return group(raw.replace(/\D/g, "").slice(0, 6), 2).replace(/ /g, "-");
  if (/account|routing|clabe|bsb|transit/.test(k) && !/name/.test(k)) {
    if (/ifsc/.test(k)) return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
    return raw.replace(/\D/g, "");
  }
  if (/ifsc|upi/.test(k)) return raw.toUpperCase().replace(/\s+/g, "");
  if (isNameKey(k)) {
    return raw
      .replace(/[^\p{L}\p{M}'.\- ]/gu, "")
      .replace(/\s{2,}/g, " ")
      .replace(/(^|[\s'\-])(\p{L})/gu, (_m, p, c) => p + c.toLocaleUpperCase());
  }
  return raw;
};

const FIELD_CLASS =
  "w-full h-12 px-3 rounded-xl border border-gray-300 bg-white outline-none text-sm text-black placeholder:text-gray-400 focus:border-[#012169] focus:ring-2 focus:ring-[#012169]/20 transition-all";

export const ExternalTransferDialog = ({
  open, onOpenChange, profile, currencyCode, currencySymbol,
  amount, setAmount, recipient, setRecipient, email, setEmail, memo, setMemo,
  fields, setFields, fromAccount, setFromAccount, accounts, formatCurrency, loading, onSubmit,
}: Props) => {
  useEffect(() => {
    if (open && !fromAccount && accounts[0]) {
      const checking = accounts.find((a) => a.account_type === "checking");
      setFromAccount(checking?.id || accounts[0].id);
    }
  }, [open, accounts, fromAccount, setFromAccount]);

  const selected = accounts.find((a) => a.id === fromAccount);
  const displayAmount = amount && parseFloat(amount) > 0
    ? Number(amount).toLocaleString(undefined, { maximumFractionDigits: 2 })
    : "";

  const requiredOk = profile.fields.every(
    (f) => f.required === false || (fields[f.key] ?? "").trim().length > 0
  );
  const canSend = !!fromAccount && !!amount && parseFloat(amount) > 0 && recipient.trim().length > 0 && requiredOk;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 gap-0 overflow-hidden border-0 bg-white [&>button]:hidden",
          "ios-safe-sheet !left-0 !top-0 !translate-x-0 !translate-y-0 !m-0 !max-w-none !w-screen !h-[100dvh] !rounded-none",
          "sm:!left-1/2 sm:!top-1/2 sm:!-translate-x-1/2 sm:!-translate-y-1/2",
          "sm:!w-full sm:!h-auto sm:!max-h-[92vh] sm:!max-w-[440px] sm:!rounded-[2rem] sm:shadow-2xl"
        )}
      >
        <div className="flex flex-col h-full sm:h-auto sm:max-h-[92vh] overflow-y-auto bg-white">
          <div
            className="px-4 pt-5 pb-6 text-white relative"
            style={{ background: "linear-gradient(135deg, #012169 0%, #0b2f8a 60%, #c8102e 160%)" }}
          >
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4 text-white" strokeWidth={2.5} />
            </button>
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-white/15 backdrop-blur-sm border border-white/25 flex items-center justify-center">
                <Building className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-xl font-extrabold tracking-tight truncate">{profile.scheme}</div>
                <p className="text-[12px] text-white/85 truncate">
                  {profile.region} · {profile.settlement}
                </p>
              </div>
            </div>

            {selected && (
              <div className="mt-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
                  <span className="text-[12px] font-medium text-white/90">{selected.account_name}</span>
                </div>
                <span className="text-sm font-bold text-white">{formatCurrency(selected.balance)}</span>
              </div>
            )}
          </div>

          <div className="px-4 pt-5">
            <label className="text-sm font-semibold text-black block mb-1.5">From Account</label>
            <Select value={fromAccount} onValueChange={setFromAccount}>
              <SelectTrigger className="h-12 rounded-xl border border-gray-300 bg-white text-left">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.account_name} — {formatCurrency(acc.balance)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="px-4 pt-4">
            <label className="text-sm font-semibold text-black block mb-1.5">Amount ({currencyCode})</label>
            <div
              className="flex items-center rounded-xl border px-4 py-4 bg-white transition-all"
              style={{ borderColor: amount && parseFloat(amount) > 0 ? "#012169" : "#d1d5db" }}
            >
              <span className="text-3xl font-light text-gray-500 mr-2">{currencySymbol}</span>
              <input
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                data-gramm="false"
                type="text"
                inputMode="decimal"
                value={displayAmount}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9.]/g, "");
                  const parts = v.split(".");
                  setAmount(parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : v);
                }}
                placeholder="0.00"
                className="flex-1 min-w-0 bg-transparent outline-none text-3xl font-semibold text-black placeholder:text-gray-300"
              />
            </div>
          </div>

          <div className="px-4 pt-4 space-y-4">
            <div>
              <label className="text-sm font-semibold text-black block mb-1.5">
                Recipient Name<span className="text-red-500"> *</span>
              </label>
              <input
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="words"
                autoComplete="name"
                data-gramm="false"
                value={recipient}
                onChange={(e) => setRecipient(formatFieldValue("recipient_name", e.target.value))}
                placeholder="Jane Doe"
                className={FIELD_CLASS}
              />
            </div>

            {profile.fields.map((f) => (
              <div key={f.key}>
                <label className="text-sm font-semibold text-black block mb-1.5">
                  {f.label}
                  {f.required === false ? (
                    <span className="ml-1 text-xs font-normal text-gray-500">(optional)</span>
                  ) : (
                    <span className="text-red-500"> *</span>
                  )}
                </label>
                <input
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize={isNameKey(f.key) ? "words" : "off"}
                  data-gramm="false"
                  inputMode={f.inputMode}
                  maxLength={f.maxLength}
                  value={fields[f.key] ?? ""}
                  onChange={(e) => {
                    let v = e.target.value;
                    if (f.uppercase) v = v.toUpperCase();
                    v = formatFieldValue(f.key, v);
                    setFields((prev) => ({ ...prev, [f.key]: v }));
                  }}
                  placeholder={f.placeholder}
                  className={FIELD_CLASS}
                />
                {f.help && <p className="mt-1 text-[11px] text-gray-500">{f.help}</p>}
              </div>
            ))}

            <div>
              <label className="text-sm font-semibold text-black block mb-1.5">
                Recipient Email <span className="text-xs font-normal text-gray-500">(optional)</span>
              </label>
              <input
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                data-gramm="false"
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@email.com"
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-black block mb-1.5">
                Memo <span className="text-xs font-normal text-gray-500">(optional)</span>
              </label>
              <input
                spellCheck={false}
                autoCorrect="off"
                data-gramm="false"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Invoice #123"
                className={FIELD_CLASS}
              />
            </div>
          </div>

          <div className="px-4 pt-6 pb-6 mt-auto">
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] text-gray-600">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <p>Transfers to outside banks are reviewed by a support specialist before release.</p>
            </div>
            <button
              type="button"
              disabled={!canSend || loading}
              onClick={onSubmit}
              className="w-full h-14 rounded-full text-white font-bold text-base flex items-center justify-center disabled:opacity-40 active:opacity-80 transition-all shadow-lg"
              style={{ background: "linear-gradient(135deg, #012169 0%, #0b2f8a 100%)" }}
            >
              {loading ? "Submitting…" : `Submit ${profile.scheme}`}
            </button>
            <p className="mt-2 text-center text-[11px] text-gray-500">Settlement: {profile.settlement}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
