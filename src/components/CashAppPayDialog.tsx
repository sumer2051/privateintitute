import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Sparkles, ChevronDown, Check } from "lucide-react";

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
        className="p-0 gap-0 overflow-hidden border-0 max-w-md sm:rounded-2xl [&>button]:hidden"
      >
        {step === "amount" ? (
          <div
            className="flex flex-col text-white"
            style={{ background: "#00D64F", minHeight: "640px" }}
          >
            <div className="flex items-center justify-between px-5 pt-5">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
                className="p-1"
              >
                <X className="h-6 w-6 text-white" strokeWidth={2.5} />
              </button>
              <span className="text-sm font-semibold tracking-wide opacity-95">Cash App</span>
              <div className="w-6" />
            </div>

            <div className="flex-1 flex items-start justify-start px-6 pt-6">
              <div
                className="font-black leading-none tracking-tight"
                style={{ fontSize: "clamp(72px, 22vw, 128px)" }}
              >
                <span className="align-top" style={{ fontSize: "0.72em" }}>{currencySymbol}</span>
                {displayAmount}
              </div>
            </div>

            <div className="px-4 pb-2">
              {keys.map((row, i) => (
                <div key={i} className="grid grid-cols-3">
                  {row.map((k) => (
                    <button
                      key={k.value}
                      type="button"
                      onClick={() => pressKey(k.value)}
                      className="py-4 text-3xl font-medium text-white/95 active:opacity-60 transition-opacity"
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 px-5 pb-6 pt-2">
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
          <div className="bg-white text-black flex flex-col" style={{ minHeight: "640px" }}>
            <div className="pt-6 pb-4 px-5 text-center">
              <div className="flex items-center justify-center gap-2">
                <span
                  className="font-black tracking-wide text-2xl"
                  style={{ color: "#00C244", letterSpacing: "0.02em" }}
                >
                  BUSINESS CASH APP
                </span>
                <Check className="h-6 w-6" style={{ color: "#2196F3" }} strokeWidth={3} />
              </div>
            </div>

            <div className="flex items-center justify-between px-5 py-4 border-b border-black/10">
              <button
                type="button"
                onClick={() => setStep("amount")}
                aria-label="Back"
                className="p-1"
              >
                <X className="h-7 w-7 text-black" strokeWidth={2.5} />
              </button>
              <div className="text-2xl font-bold text-black">
                {currencySymbol}{displayAmount}
              </div>
              <button
                type="button"
                disabled={!canPay || loading}
                onClick={onSubmit}
                className="px-6 py-2 rounded-full font-semibold text-white text-base disabled:opacity-40"
                style={{ background: canPay ? "#00C244" : "#B0B0B0" }}
              >
                {loading ? "…" : "Pay"}
              </button>
            </div>

            <div className="px-5 py-4 border-b border-black/10 flex items-center gap-6">
              <span className="text-base font-bold text-black w-12">To</span>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="$Cashtag,"
                className="flex-1 bg-transparent outline-none text-base placeholder:text-gray-400"
              />
            </div>

            <div className="px-5 py-4 border-b border-black/10 flex items-center gap-6">
              <span className="text-base font-bold text-black w-12">For</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (required)"
                className="flex-1 bg-transparent outline-none text-base placeholder:text-gray-400"
              />
              <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "#E6F8EC" }}>
                <Sparkles className="h-4 w-4" style={{ color: "#00C244" }} />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setBalanceIdx((i) => (i + 1) % balanceOptions.length)}
              className="px-5 py-4 border-b border-black/10 flex items-center gap-3 text-left active:bg-black/5"
            >
              <span className="text-base font-bold text-black">Use</span>
              <div className="h-7 w-7 rounded-md flex items-center justify-center text-white text-sm font-bold" style={{ background: "#00C244" }}>$</div>
              <span className="flex-1 text-base font-semibold text-black">
                {currentBalanceLabel}
              </span>
            </button>

            <div className="px-5 py-5 space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-base font-bold text-black w-32">Gmail. -</span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder=""
                  type="email"
                  className="flex-1 h-11 px-3 rounded-md border border-black/40 bg-white outline-none text-sm focus:border-black"
                />
              </div>
              <div className="flex items-center gap-4">
                <span className="text-base font-bold text-black w-32">Recipient name</span>
                <input
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder=""
                  className="flex-1 h-11 px-3 rounded-md border border-black/40 bg-white outline-none text-sm focus:border-black"
                />
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
