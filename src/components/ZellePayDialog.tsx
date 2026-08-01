import { useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ZellePayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: string;
  setAmount: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  recipient: string;
  setRecipient: (v: string) => void;
  fromAccount: string;
  setFromAccount: (v: string) => void;
  accounts: { id: string; account_name: string; account_number: string; account_type: string; balance: number }[];
  formatCurrency: (usdAmount: number) => string;
  loading: boolean;
  onSubmit: () => void;
  currencySymbol: string;
}

const ZELLE_PURPLE = "#6D1ED4";
const ZELLE_PURPLE_DARK = "#4B0FA6";

export const ZellePayDialog = ({
  open, onOpenChange,
  amount, setAmount, note, setNote,
  email, setEmail, recipient, setRecipient,
  fromAccount, setFromAccount, accounts, formatCurrency,
  loading, onSubmit, currencySymbol,
}: ZellePayDialogProps) => {
  useEffect(() => {
    if (open && !fromAccount && accounts[0]) setFromAccount(accounts[0].id);
  }, [open, accounts, fromAccount, setFromAccount]);

  const selected = accounts.find((a) => a.id === fromAccount);
  const displayAmount = amount && parseFloat(amount) > 0
    ? Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "";
  const canSend = fromAccount && amount && parseFloat(amount) > 0 && recipient.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 gap-0 overflow-hidden border-0 bg-white [&>button]:hidden",
          "ios-safe-sheet !left-0 !top-0 !translate-x-0 !translate-y-0 !m-0 !max-w-none !w-screen !h-[100dvh] !rounded-none",
          "sm:!left-1/2 sm:!top-1/2 sm:!-translate-x-1/2 sm:!-translate-y-1/2",
          "sm:!w-full sm:!h-auto sm:!max-h-[92vh] sm:!max-w-[420px] sm:!rounded-[2rem] sm:shadow-2xl"
        )}
      >
        <div className="flex flex-col h-full sm:h-auto sm:max-h-[92vh] overflow-y-auto bg-white">
          {/* Header */}
          <div
            className="px-4 pt-5 pb-6 text-white relative"
            style={{ background: `linear-gradient(135deg, ${ZELLE_PURPLE} 0%, ${ZELLE_PURPLE_DARK} 100%)` }}
          >
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4 text-white" strokeWidth={2.5} />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-extrabold tracking-tight italic">BUSINESS ZELLE</span>
              <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-white">
                <Check className="h-3 w-3" style={{ color: ZELLE_PURPLE }} strokeWidth={4} />
              </span>
            </div>
            <p className="mt-1 text-sm text-white/85">Send money in minutes to people you trust</p>

            {/* Balance chip */}
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
              <SelectTrigger className="h-12 rounded-xl border border-gray-300 bg-white text-left focus:ring-2 focus:ring-[#6D1ED4]/20 focus:border-[#6D1ED4] hover:border-[#6D1ED4]/60 transition-colors">
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
            <label className="text-sm font-semibold text-black block mb-1.5">Amount</label>
            <div className={cn(
              "flex items-center rounded-xl border px-4 py-4 bg-white transition-all",
              amount && parseFloat(amount) > 0
                ? "border-[#6D1ED4] shadow-[0_0_0_3px_rgba(109,30,212,0.12)]"
                : "border-gray-300"
            )}>
              <span className="text-3xl font-light text-gray-500 mr-2">{currencySymbol}</span>
              <input
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

          {/* Recipient Name */}
          <div className="px-4 pt-4">
            <label className="text-sm font-semibold text-black block mb-1.5">Recipient Name</label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Jane Doe"
              className="w-full h-12 px-3 rounded-xl border border-gray-300 bg-white outline-none text-sm text-black placeholder:text-gray-400 focus:border-[#6D1ED4] focus:ring-2 focus:ring-[#6D1ED4]/20 transition-all"
            />
          </div>

          {/* Recipient Email */}
          <div className="px-4 pt-4">
            <label className="text-sm font-semibold text-black block mb-1.5">Recipient Email or Mobile</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@email.com"
              className="w-full h-12 px-3 rounded-xl border border-gray-300 bg-white outline-none text-sm text-black placeholder:text-gray-400 focus:border-[#6D1ED4] focus:ring-2 focus:ring-[#6D1ED4]/20 transition-all"
            />
            <HandleVerifyRow
              status={lookup.status}
              name={lookup.name}
              hint={lookup.hint}
              accent="#6D1ED4"
              onUseName={setRecipient}
            />
          </div>


          {/* Note */}
          <div className="px-4 pt-4">
            <label className="text-sm font-semibold text-black block mb-1.5">Note</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What's it for?"
              className="w-full h-12 px-3 rounded-xl border border-gray-300 bg-white outline-none text-sm text-black placeholder:text-gray-400 focus:border-[#6D1ED4] focus:ring-2 focus:ring-[#6D1ED4]/20 transition-all"
            />
          </div>

          {/* Send button */}
          <div className="px-4 pt-6 pb-6 mt-auto">
            <button
              type="button"
              disabled={!canSend || loading}
              onClick={onSubmit}
              className="w-full h-14 rounded-full text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-40 active:opacity-80 transition-all shadow-lg"
              style={{ background: `linear-gradient(135deg, ${ZELLE_PURPLE} 0%, ${ZELLE_PURPLE_DARK} 100%)` }}
            >
              {loading ? "Sending…" : "Send with Zelle"}
            </button>
            <p className="mt-2 text-center text-[11px] text-gray-500">
              Only send to people you know and trust
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
