import { useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface VenmoPayDialogProps {
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
  handle: string;
  setHandle: (v: string) => void;
  fromAccount: string;
  setFromAccount: (v: string) => void;
  accounts: { id: string; account_name: string; account_number: string; account_type: string; balance: number }[];
  formatCurrency: (usdAmount: number) => string;
  loading: boolean;
  onSubmit: () => void;
  currencySymbol: string;
}

const VENMO_BLUE = "#3D95CE";

export const VenmoPayDialog = ({
  open, onOpenChange,
  amount, setAmount, note, setNote,
  email, setEmail, recipient, setRecipient,
  handle, setHandle,
  fromAccount, setFromAccount, accounts, formatCurrency,
  loading, onSubmit, currencySymbol,
}: VenmoPayDialogProps) => {
  useEffect(() => {
    if (open && !fromAccount && accounts[0]) setFromAccount(accounts[0].id);
  }, [open, accounts, fromAccount, setFromAccount]);

  const displayAmount = amount && parseFloat(amount) > 0
    ? Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "";

  const canSend = fromAccount && amount && parseFloat(amount) > 0 && email.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 gap-0 overflow-hidden border-0 bg-white [&>button]:hidden",
          "!left-0 !top-0 !translate-x-0 !translate-y-0 !m-0 !max-w-none !w-screen !h-[100dvh] !rounded-none",
          "sm:!left-1/2 sm:!top-1/2 sm:!-translate-x-1/2 sm:!-translate-y-1/2",
          "sm:!w-full sm:!h-auto sm:!max-h-[92vh] sm:!max-w-[420px] sm:!rounded-[2rem] sm:shadow-2xl"
        )}
      >
        <div className="flex flex-col h-full sm:h-auto sm:max-h-[92vh] overflow-y-auto bg-white">
          {/* Header title */}
          <div className="pt-5 pb-3 px-4 flex items-center justify-center gap-2">
            <span className="text-2xl font-extrabold tracking-tight italic" style={{ color: VENMO_BLUE, fontFamily: "system-ui" }}>
              VENMO
            </span>
            <span className="relative inline-flex items-center justify-center h-6 w-6 rounded-full" style={{ background: VENMO_BLUE }}>
              <Check className="h-3.5 w-3.5 text-white" strokeWidth={4} />
            </span>
          </div>

          {/* Handle row with back + Pay */}
          <div className="px-3 pb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-10 w-8 flex items-center justify-center text-black"
              aria-label="Back"
            >
              <ChevronLeft className="h-7 w-7" strokeWidth={2.5} />
            </button>
            <div className="flex-1 flex items-center gap-2 rounded-full border border-gray-300 px-3 h-11 bg-white">
              <span className="h-6 w-6 rounded-md flex items-center justify-center text-white text-sm font-black italic" style={{ background: VENMO_BLUE }}>
                v
              </span>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="add username/Handle"
                className="flex-1 bg-transparent outline-none text-[15px] text-black placeholder:text-gray-400"
              />
            </div>
            <button
              type="button"
              disabled={!canSend || loading}
              onClick={onSubmit}
              className="h-11 w-16 rounded-xl text-white font-bold text-sm flex flex-col items-center justify-center gap-0.5 disabled:opacity-50 active:opacity-80"
              style={{ background: VENMO_BLUE }}
            >
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
              <span className="text-xs leading-none">{loading ? "…" : "PAY"}</span>
            </button>
          </div>

          {/* Amount card */}
          <div className="mx-4 rounded-2xl border border-gray-200 p-4">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <div className="h-6 w-6 rounded-full border-2 border-black relative overflow-hidden">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-black" />
                  <div className="absolute inset-x-0 top-1/2 h-px bg-black" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] text-black mb-1">Amount</div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-medium text-black">{currencySymbol}</span>
                  <div className="flex-1 border border-black rounded-md px-2 py-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={displayAmount}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9.]/g, "");
                        const parts = v.split(".");
                        setAmount(parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : v);
                      }}
                      placeholder="$0.00"
                      className="w-full bg-transparent outline-none text-2xl font-medium text-black placeholder:text-gray-400"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200">
              <label className="text-[15px] text-black block mb-1">Recipient Name (optional)</label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder=""
                className="w-full h-9 px-2 rounded-md border border-gray-200 bg-white outline-none text-sm text-black focus:border-[#3D95CE]"
              />
            </div>
          </div>

          {/* From Account */}
          <div className="px-4 pt-5">
            <label className="text-lg font-bold text-black block mb-2">From Account</label>
            <Select value={fromAccount} onValueChange={setFromAccount}>
              <SelectTrigger className="h-14 rounded-2xl border border-gray-200 bg-white px-4 text-left focus:ring-2 focus:ring-[#3D95CE]/20 focus:border-[#3D95CE] hover:border-[#3D95CE]/60 transition-colors">
                <SelectValue placeholder="select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.account_name} — {formatCurrency(acc.balance)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(() => {
              const sel = accounts.find((a) => a.id === fromAccount);
              if (!sel) return null;
              return (
                <div
                  key={sel.id + sel.balance}
                  className="mt-2 flex items-center justify-between rounded-xl px-3 py-2 border animate-in fade-in slide-in-from-top-1 duration-300"
                  style={{ background: "linear-gradient(90deg, #EAF4FB 0%, #F5FAFD 100%)", borderColor: "#CDE4F2" }}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: VENMO_BLUE }} />
                    <span className="text-[12px] font-medium text-gray-700">Checking account balance</span>
                  </div>
                  <span className="text-sm font-bold" style={{ color: VENMO_BLUE }}>
                    {formatCurrency(sel.balance)}
                  </span>
                </div>
              );
            })()}
          </div>


          {/* Recipient Gmail */}
          <div className="px-4 pt-5">
            <label className="text-lg font-bold text-black block mb-2">Recipient Gmail</label>
            <div className="rounded-2xl border-2 border-black px-4 h-14 flex items-center">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter gmail..."
                className="w-full bg-transparent outline-none text-base text-black placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Note */}
          <div className="px-4 pt-5 pb-6">
            <label className="text-lg font-bold text-black block mb-2">Note</label>
            <div className="rounded-2xl border-2 border-black px-4 h-14 flex items-center">
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Enter note..."
                className="w-full bg-transparent outline-none text-base text-black placeholder:text-gray-400"
              />
            </div>
          </div>

          <div className="h-4" />
        </div>
      </DialogContent>
    </Dialog>
  );
};
