import { useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CountryMethod } from "@/lib/country-methods";

interface MethodPayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  method: CountryMethod;
  amount: string;
  setAmount: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  recipient: string;
  setRecipient: (v: string) => void;
  fields: Record<string, string>;
  setFields: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  variant: string;
  setVariant: (v: string) => void;
  fromAccount: string;
  setFromAccount: (v: string) => void;
  accounts: { id: string; account_name: string; account_number: string; account_type: string; balance: number }[];
  formatCurrency: (usdAmount: number) => string;
  loading: boolean;
  onSubmit: () => void;
  currencySymbol: string;
  currencyCode: string;
}

// Map tailwind gradient class ("from-blue-600 to-indigo-700") to inline CSS colors
const TW_COLORS: Record<string, string> = {
  "slate-600": "#475569", "slate-700": "#334155", "slate-800": "#1e293b", "slate-900": "#0f172a",
  "red-600": "#dc2626", "red-700": "#b91c1c", "red-800": "#991b1b",
  "rose-600": "#e11d48", "rose-700": "#be123c",
  "orange-500": "#f97316", "orange-600": "#ea580c",
  "amber-400": "#fbbf24", "amber-600": "#d97706", "amber-700": "#b45309",
  "yellow-500": "#eab308", "yellow-700": "#a16207",
  "green-500": "#22c55e", "green-600": "#16a34a", "green-700": "#15803d",
  "emerald-500": "#10b981", "emerald-600": "#059669", "emerald-700": "#047857", "emerald-800": "#065f46",
  "teal-500": "#14b8a6", "teal-600": "#0d9488", "teal-800": "#115e59",
  "cyan-500": "#06b6d4", "cyan-600": "#0891b2",
  "sky-500": "#0ea5e9", "sky-600": "#0284c7",
  "blue-500": "#3b82f6", "blue-600": "#2563eb", "blue-700": "#1d4ed8",
  "indigo-600": "#4f46e5", "indigo-700": "#4338ca",
  "purple-600": "#9333ea",
  "fuchsia-600": "#c026d3",
  "pink-600": "#db2777",
  "navy-700": "#1e3a8a",
};

const parseAccent = (accent: string): { from: string; to: string } => {
  const parts = accent.split(" ");
  const fromKey = parts.find((p) => p.startsWith("from-"))?.replace("from-", "") ?? "slate-700";
  const toKey = parts.find((p) => p.startsWith("to-"))?.replace("to-", "") ?? "slate-900";
  return { from: TW_COLORS[fromKey] ?? "#334155", to: TW_COLORS[toKey] ?? "#0f172a" };
};

export const MethodPayDialog = ({
  open, onOpenChange, method,
  amount, setAmount, note, setNote,
  email, setEmail, recipient, setRecipient,
  fields, setFields, variant, setVariant,
  fromAccount, setFromAccount, accounts, formatCurrency,
  loading, onSubmit, currencySymbol, currencyCode,
}: MethodPayDialogProps) => {
  useEffect(() => {
    if (open && !fromAccount && accounts[0]) setFromAccount(accounts[0].id);
  }, [open, accounts, fromAccount, setFromAccount]);

  const { from, to } = parseAccent(method.accent);
  const selected = accounts.find((a) => a.id === fromAccount);

  const displayAmount = amount && parseFloat(amount) > 0
    ? Number(amount).toLocaleString(undefined, { maximumFractionDigits: 2 })
    : "";

  // Sync special field keys to shared state
  const updateField = (key: string, val: string) => {
    if (key === "email") setEmail(val);
    if (key === "recipient_name") setRecipient(val);
    if (key === "note") setNote(val);
    setFields((prev) => ({ ...prev, [key]: val }));
  };

  const hasEmailField = method.fields.some((f) => f.key === "email");
  const requiredFieldsOk = method.fields.every((f) => {
    if (!f.required) return true;
    if (f.key === "email") return true; // email is always optional
    if (f.key === "recipient_name") return recipient.trim().length > 0;
    if (f.key === "note") return note.trim().length > 0;
    return (fields[f.key] ?? "").trim().length > 0;
  });
  const variantOk = !method.variants || !!variant;
  const canSend = fromAccount && amount && parseFloat(amount) > 0 && requiredFieldsOk && variantOk;

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
          {/* Header */}
          <div
            className="px-4 pt-5 pb-6 text-white relative"
            style={{ background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}
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
              <div className="h-11 w-11 rounded-xl bg-white/15 backdrop-blur-sm border border-white/25 flex items-center justify-center text-xl font-black">
                {method.glyph}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xl font-extrabold tracking-tight truncate">{method.name}</span>
                  <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-white shrink-0">
                    <Check className="h-2.5 w-2.5" style={{ color: from }} strokeWidth={4} />
                  </span>
                </div>
                <p className="text-[12px] text-white/85 truncate">{method.tagline}</p>
              </div>
            </div>

            {selected && (
              <div className="mt-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
                  <span className="text-[12px] font-medium text-white/90">Checking account balance</span>
                </div>
                <span className="text-sm font-bold text-white">{formatCurrency(selected.balance)}</span>
              </div>
            )}
          </div>

          {/* From Account */}
          <div className="px-4 pt-5">
            <label className="text-sm font-semibold text-black block mb-1.5">From Account</label>
            <Select value={fromAccount} onValueChange={setFromAccount}>
              <SelectTrigger
                className="h-12 rounded-xl border border-gray-300 bg-white text-left transition-colors"
                style={{ ["--tw-ring-color" as string]: `${from}33` }}
              >
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

          {/* Amount */}
          <div className="px-4 pt-4">
            <label className="text-sm font-semibold text-black block mb-1.5">
              Amount ({currencyCode})
            </label>
            <div
              className={cn(
                "flex items-center rounded-xl border px-4 py-4 bg-white transition-all",
                amount && parseFloat(amount) > 0 ? "shadow-[0_0_0_3px_rgba(0,0,0,0.06)]" : ""
              )}
              style={{
                borderColor: amount && parseFloat(amount) > 0 ? from : "#d1d5db",
              }}
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
            {selected && amount && parseFloat(amount) > 0 && (
              <div className="mt-1.5 text-[11px] text-gray-500 flex items-center justify-between px-1">
                <span>After this transfer</span>
                <span className={cn(
                  "font-semibold",
                  selected.balance - parseFloat(amount || "0") < 0 ? "text-red-600" : "text-gray-800"
                )}>
                  {formatCurrency(Math.max(0, selected.balance - parseFloat(amount || "0")))}
                </span>
              </div>
            )}
          </div>

          {/* Dynamic method fields */}
          <div className="px-4 pt-4 space-y-4">
            {method.fields.map((f) => {
              const val =
                f.key === "email" ? email :
                f.key === "recipient_name" ? recipient :
                f.key === "note" ? note :
                fields[f.key] ?? "";
              return (
                <div key={f.key}>
                  <label className="text-sm font-semibold text-black block mb-1.5">
                    {f.label}{f.required && f.key !== "email" && <span className="text-red-500"> *</span>}
                  </label>
                  <input
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize={isNameKey(f.key) ? "words" : "off"}
                    autoComplete={autoCompleteFor(f.key)}
                    data-gramm="false"
                    type={f.inputMode === "email" ? "email" : "text"}
                    inputMode={f.inputMode as any}
                    maxLength={f.maxLength}
                    value={val}
                    onChange={(e) => {
                      let v = e.target.value;
                      if (f.uppercase) v = v.toUpperCase();
                      v = formatFieldValue(f.key, v);
                      updateField(f.key, v);
                    }}
                    placeholder={f.placeholder ?? ""}
                    className="w-full h-12 px-3 rounded-xl border border-gray-300 bg-white outline-none text-sm text-black placeholder:text-gray-400 focus:ring-2 transition-all"
                    style={{
                      ["--tw-ring-color" as string]: `${from}33`,
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = from)}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "#d1d5db")}
                  />
                </div>
              );
            })}

            {!hasEmailField && (
              <div>
                <label className="text-sm font-semibold text-black block mb-1.5">Recipient Email</label>
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
                  className="w-full h-12 px-3 rounded-xl border border-gray-300 bg-white outline-none text-sm text-black placeholder:text-gray-400 focus:ring-2 transition-all"
                  style={{ ["--tw-ring-color" as string]: `${from}33` }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = from)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#d1d5db")}
                />
              </div>
            )}

            {method.variants && (
              <div>
                <label className="text-sm font-semibold text-black block mb-1.5">Payment Type</label>
                <Select value={variant} onValueChange={setVariant}>
                  <SelectTrigger className="h-12 rounded-xl border border-gray-300 bg-white">
                    <SelectValue placeholder="Select payment type" />
                  </SelectTrigger>
                  <SelectContent>
                    {method.variants.map((v) => (
                      <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Send button */}
          <div className="px-4 pt-6 pb-6 mt-auto">
            <button
              type="button"
              disabled={!canSend || loading}
              onClick={onSubmit}
              className="w-full h-14 rounded-full text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-40 active:opacity-80 transition-all shadow-lg"
              style={{ background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}
            >
              {loading ? "Sending…" : `Send with ${method.name}`}
            </button>
            <p className="mt-2 text-center text-[11px] text-gray-500">
              Settlement: {method.settlement}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
