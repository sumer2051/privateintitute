import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: { id: string; account_name: string; account_number: string; account_type: string; balance: number }[];
  fromAccount: string;
  setFromAccount: (v: string) => void;
  toAccount: string;
  setToAccount: (v: string) => void;
  amount: string;
  setAmount: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
  formatCurrency: (usd: number) => string;
  currencyCode: string;
  currencySymbol: string;
  loading: boolean;
  onSubmit: () => void;
}

const FIELD_CLASS =
  "w-full h-12 px-3 rounded-xl border border-gray-300 bg-white outline-none text-sm text-black placeholder:text-gray-400 focus:border-[#012169] focus:ring-2 focus:ring-[#012169]/20 transition-all";

export const InternalTransferDialog = ({
  open, onOpenChange, accounts, fromAccount, setFromAccount, toAccount, setToAccount,
  amount, setAmount, note, setNote, formatCurrency, currencyCode, currencySymbol, loading, onSubmit,
}: Props) => {
  const from = accounts.find((a) => a.id === fromAccount);
  const displayAmount = amount && parseFloat(amount) > 0
    ? Number(amount).toLocaleString(undefined, { maximumFractionDigits: 2 })
    : "";
  const canSend = !!fromAccount && !!toAccount && fromAccount !== toAccount && !!amount && parseFloat(amount) > 0;

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
            style={{ background: "linear-gradient(135deg, #012169 0%, #17418f 100%)" }}
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
                <ArrowRightLeft className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-xl font-extrabold tracking-tight">Between My Accounts</div>
                <p className="text-[12px] text-white/85">Instant · no fees</p>
              </div>
            </div>
            {from && (
              <div className="mt-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-2 flex items-center justify-between">
                <span className="text-[12px] font-medium text-white/90">{from.account_name}</span>
                <span className="text-sm font-bold text-white">{formatCurrency(from.balance)}</span>
              </div>
            )}
          </div>

          <div className="px-4 pt-5 space-y-4">
            <div>
              <label className="text-sm font-semibold text-black block mb-1.5">From</label>
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
            <div>
              <label className="text-sm font-semibold text-black block mb-1.5">To</label>
              <Select value={toAccount} onValueChange={setToAccount}>
                <SelectTrigger className="h-12 rounded-xl border border-gray-300 bg-white text-left">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.filter((a) => a.id !== fromAccount).map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.account_name} — ****{acc.account_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
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

            <div>
              <label className="text-sm font-semibold text-black block mb-1.5">
                Memo <span className="text-xs font-normal text-gray-500">(optional)</span>
              </label>
              <input
                spellCheck={false}
                autoCorrect="off"
                data-gramm="false"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Savings top-up"
                className={FIELD_CLASS}
              />
            </div>
          </div>

          <div className="px-4 pt-6 pb-6 mt-auto">
            <button
              type="button"
              disabled={!canSend || loading}
              onClick={onSubmit}
              className="w-full h-14 rounded-full text-white font-bold text-base flex items-center justify-center disabled:opacity-40 active:opacity-80 transition-all shadow-lg"
              style={{ background: "linear-gradient(135deg, #012169 0%, #17418f 100%)" }}
            >
              {loading ? "Processing…" : "Transfer Now"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
