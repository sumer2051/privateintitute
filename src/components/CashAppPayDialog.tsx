import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Sparkles, Check, ChevronDown } from "lucide-react";

interface CashAppPayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: string;
  setAmount: (v: string) => void;
  handle: string;
  setHandle: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  recipient: string;
  setRecipient: (v: string) => void;
  balanceLabel: string;
  loading: boolean;
  onSubmit: () => void;
  currencySymbol: string;
}

/**
 * Cash App-styled two-step payment sheet.
 * Step 1: green keypad amount entry (matches screenshot 1).
 * Step 2: white details sheet with "BUSINESS CASH APP" header (matches screenshot 2).
 */
export const CashAppPayDialog = ({
  open,
  onOpenChange,
  amount,
  setAmount,
  handle,
  setHandle,
  note,
  setNote,
  email,
  setEmail,
  recipient,
  setRecipient,
  balanceLabel,
  loading,
  onSubmit,
  currencySymbol,
}: CashAppPayDialogProps) => {
  const [step, setStep] = useState<"amount" | "details">("amount");
  const balanceOptions = [balanceLabel, "Bank ••1234", "Debit card ••4477"];
  const [balanceIdx, setBalanceIdx] = useState(0);
  const currentBalanceLabel = balanceOptions[balanceIdx] ?? balanceLabel;

  useEffect(() => {
    if (open) {
      setStep("amount");
      setBalanceIdx(0);
    }
  }, [open]);

  const displayAmount = amount && parseFloat(amount) > 0
    ? Number(amount).toLocaleString(undefined, { maximumFractionDigits: 2 })
    : "0";

  const pressKey = (k: string) => {
    if (k === "back") {
      setAmount(amount.slice(0, -1));
      return;
    }
    if (k === ".") {
      if (!amount.includes(".")) setAmount((amount || "0") + ".");
      return;
    }
    // digit
    if (amount === "0") setAmount(k);
    else setAmount((amount || "") + k);
  };

  const keys: { label: string; value: string }[][] = [
    [{ label: "1", value: "1" }, { label: "2", value: "2" }, { label: "3", value: "3" }],
    [{ label: "4", value: "4" }, { label: "5", value: "5" }, { label: "6", value: "6" }],
    [{ label: "7", value: "7" }, { label: "8", value: "8" }, { label: "9", value: "9" }],
    [{ label: ".", value: "." }, { label: "0", value: "0" }, { label: "‹", value: "back" }],
  ];

  const canProceed = amount && parseFloat(amount) > 0;
  const canPay = canProceed && handle.trim() && note.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="ios-safe-sheet p-0 gap-0 overflow-hidden border-0 [&>button]:hidden top-0 left-0 right-0 bottom-0 translate-x-0 translate-y-0 w-screen h-[100dvh] max-w-none rounded-none sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:h-auto sm:max-w-[400px] sm:rounded-3xl"
      >
        {step === "amount" ? (
          <div
            className="flex flex-col text-white h-full sm:h-auto"
            style={{ background: "#00D64F", minHeight: "560px" }}
          >
            <div className="flex items-center justify-between px-5 pt-4">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
                className="p-1"
              >
                <X className="h-6 w-6 text-white" strokeWidth={2.5} />
              </button>
              <span className="text-sm font-semibold tracking-wide opacity-95">BUSINESS CASH APP</span>
              <div className="w-6" />
            </div>

            <div className="flex-1 flex items-start justify-start px-6 pt-4">
              <div
                className="font-black leading-none tracking-tight"
                style={{ fontSize: "clamp(64px, 20vw, 112px)" }}
              >
                <span className="align-top" style={{ fontSize: "0.7em" }}>{currencySymbol}</span>
                {displayAmount}
              </div>
            </div>

            <div className="px-3 pb-1">
              {keys.map((row, i) => (
                <div key={i} className="grid grid-cols-3">
                  {row.map((k) => (
                    <button
                      key={k.value}
                      type="button"
                      onClick={() => pressKey(k.value)}
                      className="py-3 text-2xl font-medium text-white/95 active:opacity-60 transition-opacity"
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 px-5 pb-5 pt-1">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="py-3 rounded-full bg-white/15 text-white font-semibold text-base active:bg-white/25"
              >
                Request
              </button>
              <button
                type="button"
                disabled={!canProceed}
                onClick={() => setStep("details")}
                className="py-3 rounded-full bg-white/15 text-white font-semibold text-base disabled:opacity-50 active:bg-white/25"
              >
                Pay
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white text-black flex flex-col h-full sm:h-auto overflow-y-auto">
            {/* Top brand header */}
            <div className="pt-5 pb-3 px-5 flex items-center justify-center gap-2">
              <span
                className="font-black tracking-wide text-xl"
                style={{ color: "#00C244", letterSpacing: "0.02em" }}
              >
                BUSINESS CASH APP
              </span>
              {/* Green starburst verified badge */}
              <span className="relative inline-flex items-center justify-center h-6 w-6">
                <svg viewBox="0 0 24 24" className="absolute inset-0 h-6 w-6" fill="#00C244" aria-hidden>
                  <polygon points="12,1 14,3.2 17,2.2 18,5.1 21,5.6 20.6,8.6 22.9,10.5 21.4,13.1 22.5,16 19.8,17.3 19.5,20.3 16.5,20.2 14.7,22.7 12,21.4 9.3,22.7 7.5,20.2 4.5,20.3 4.2,17.3 1.5,16 2.6,13.1 1.1,10.5 3.4,8.6 3,5.6 6,5.1 7,2.2 10,3.2" />
                </svg>
                <Check className="relative h-3.5 w-3.5 text-white" strokeWidth={4} />
              </span>
            </div>

            {/* Amount row */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-black/10">
              <button
                type="button"
                onClick={() => setStep("amount")}
                aria-label="Back"
                className="p-1"
              >
                <X className="h-6 w-6 text-black" strokeWidth={2.5} />
              </button>
              <div className="text-2xl font-bold text-black">
                {currencySymbol}{displayAmount}
              </div>
              <button
                type="button"
                disabled={!canPay || loading}
                onClick={onSubmit}
                className="px-5 py-1.5 rounded-full font-semibold text-white text-sm disabled:opacity-40"
                style={{ background: canPay ? "#00C244" : "#B0B0B0" }}
              >
                {loading ? "…" : "Pay"}
              </button>
            </div>

            <div className="px-5 py-3 border-t border-black/10 flex items-center gap-6">
              <span className="text-sm font-bold text-black w-10">To</span>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="$Cashtag,"
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-gray-400"
              />
            </div>

            <div className="px-5 py-3 border-t border-black/10 flex items-center gap-6">
              <span className="text-sm font-bold text-black w-10">For</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (required)"
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-gray-400"
              />
              <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "#E6F8EC" }}>
                <Sparkles className="h-4 w-4" style={{ color: "#00C244" }} />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setBalanceIdx((i) => (i + 1) % balanceOptions.length)}
              className="px-5 py-3 border-t border-black/10 flex items-center gap-3 text-left active:bg-black/5"
            >
              <span className="text-sm font-bold text-black">Use</span>
              <div className="h-6 w-6 rounded-md flex items-center justify-center text-white text-xs font-bold" style={{ background: "#00C244" }}>$</div>
              <span className="flex-1 text-sm font-semibold text-black">
                {currentBalanceLabel}
              </span>
              <ChevronDown className="h-4 w-4 text-black/70" />
            </button>

            <div className="px-4 py-4 space-y-4 border-t border-black/10 bg-gray-50/50">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Gmail</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="your.email@gmail.com"
                  className="w-full h-11 px-3 rounded-lg border border-gray-300 bg-white outline-none text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#00C244] focus:ring-2 focus:ring-[#00C244]/20 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recipient name</label>
                <input
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="Full name on account"
                  className="w-full h-11 px-3 rounded-lg border border-gray-300 bg-white outline-none text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#00C244] focus:ring-2 focus:ring-[#00C244]/20 transition-all"
                />
              </div>
            </div>
            <div className="pb-5" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
