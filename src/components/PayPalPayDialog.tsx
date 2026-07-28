import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Sparkles, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface PayPalPayDialogProps {
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
  paymentType: string;
  setPaymentType: (v: string) => void;
  loading: boolean;
  onSubmit: () => void;
  currencySymbol: string;
  currencyCode: string;
}

const PAYPAL_BLUE = "#0070BA";

export const PayPalPayDialog = ({
  open,
  onOpenChange,
  amount,
  setAmount,
  note,
  setNote,
  email,
  setEmail,
  recipient,
  setRecipient,
  fromAccount,
  setFromAccount,
  accounts,
  formatCurrency,
  paymentType,
  setPaymentType,
  loading,
  onSubmit,
  currencySymbol,
  currencyCode,
}: PayPalPayDialogProps) => {
  const [selectedAccountName, setSelectedAccountName] = useState("James Robinson");
  const [selectedInitials, setSelectedInitials] = useState("JR");
  const selectedAccount = accounts.find((a) => a.id === fromAccount);
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (!fromAccount) return;
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 500);
    return () => clearTimeout(t);
  }, [fromAccount]);

  useEffect(() => {
    if (open) {
      setPaymentType("");
      if (!fromAccount && accounts[0]) {
        setFromAccount(accounts[0].id);
        const name = accounts[0].account_name || "James Robinson";
        setSelectedAccountName(name);
        setSelectedInitials(getInitials(name));
      } else if (fromAccount) {
        const acc = accounts.find((a) => a.id === fromAccount);
        if (acc) {
          setSelectedAccountName(acc.account_name || "James Robinson");
          setSelectedInitials(getInitials(acc.account_name || "James Robinson"));
        }
      }
    }
  }, [open, accounts, fromAccount, setFromAccount, setPaymentType]);

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleAccountChange = (val: string) => {
    setFromAccount(val);
    const acc = accounts.find((a) => a.id === val);
    if (acc) {
      setSelectedAccountName(acc.account_name || "James Robinson");
      setSelectedInitials(getInitials(acc.account_name || "James Robinson"));
    }
  };

  const displayAmount = amount && parseFloat(amount) > 0
    ? Number(amount).toLocaleString(undefined, { maximumFractionDigits: 2 })
    : "";

  const pressKey = (k: string) => {
    if (k === "back") {
      setAmount(amount.slice(0, -1));
      return;
    }
    if (k === ".") {
      if (!amount.includes(".")) setAmount((amount || "0") + ".");
      return;
    }
    if (amount === "0") setAmount(k);
    else setAmount((amount || "") + k);
  };

  const keys: { label: string; value: string; sub?: string }[][] = [
    [{ label: "1", value: "1" }, { label: "2", value: "2", sub: "ABC" }, { label: "3", value: "3", sub: "DEF" }],
    [{ label: "4", value: "4", sub: "GHI" }, { label: "5", value: "5", sub: "JKL" }, { label: "6", value: "6", sub: "MNO" }],
    [{ label: "7", value: "7", sub: "PQRS" }, { label: "8", value: "8", sub: "TUV" }, { label: "9", value: "9", sub: "WXYZ" }],
    [{ label: ".", value: "." }, { label: "0", value: "0" }, { label: "‹", value: "back" }],
  ];

  const canSend = fromAccount && amount && parseFloat(amount) > 0 && email.trim() && recipient.trim() && paymentType;

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
          {/* Header */}
          <div className="pt-5 pb-3 px-4 flex items-center justify-center gap-2">
            <span className="text-xl font-bold tracking-tight" style={{ color: PAYPAL_BLUE }}>
              Business PayPal
            </span>
            <span className="relative inline-flex items-center justify-center h-6 w-6 rounded-full" style={{ background: PAYPAL_BLUE }}>
              <Check className="h-3.5 w-3.5 text-white" strokeWidth={4} />
            </span>
          </div>

          {/* Account selector */}
          <div className="px-4 pb-2">
            <label className="text-sm font-semibold text-black mb-1.5 block">
              From Account: <span className="font-medium text-gray-500">select account</span>
            </label>
            <Select value={fromAccount} onValueChange={handleAccountChange}>
              <SelectTrigger className="h-14 rounded-xl border border-gray-300 bg-white px-3 py-2 text-left shadow-sm focus:ring-2 focus:ring-[#0070BA]/20 focus:border-[#0070BA] transition-all hover:border-[#0070BA]/60">
                <div className="flex items-center gap-3 w-full">
                  <div className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm ring-2 ring-white" style={{ background: `linear-gradient(135deg, ${PAYPAL_BLUE} 0%, #003087 100%)` }}>
                    {selectedInitials}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col items-start">
                    <span className="text-base font-semibold text-black leading-tight">{selectedAccountName}</span>
                    {selectedAccount && (
                      <span className="text-[11px] text-gray-500 leading-tight">
                        Checking account balance
                      </span>
                    )}
                  </div>
                </div>
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold" style={{ background: PAYPAL_BLUE }}>
                        {getInitials(acc.account_name)}
                      </div>
                      <span>{acc.account_name} — {formatCurrency(acc.balance)}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAccount && (
              <div
                key={selectedAccount.id + selectedAccount.balance}
                className={cn(
                  "mt-2 flex items-center justify-between rounded-lg px-3 py-2 border transition-all",
                  pulse ? "scale-[1.02]" : "scale-100"
                )}
                style={{ background: "linear-gradient(90deg, #EAF3FB 0%, #F5F9FD 100%)", borderColor: "#CBE0F3" }}
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: "#00C244" }} />
                  <span className="text-[12px] font-medium text-gray-700">Available balance</span>
                </div>
                <span className="text-sm font-bold" style={{ color: PAYPAL_BLUE }}>
                  {formatCurrency(selectedAccount.balance)}
                </span>
              </div>
            )}
          </div>

          {/* Amount input */}
          <div className="px-4 py-4">
            <div className={cn(
              "flex items-center justify-between rounded-xl border px-4 py-5 bg-white transition-all",
              amount && parseFloat(amount) > 0 ? "border-[#0070BA] shadow-[0_0_0_3px_rgba(0,112,186,0.12)]" : "border-gray-300"
            )}>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-4xl font-light text-black" style={{ fontSize: "2.5rem" }}>{currencySymbol}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={displayAmount}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9.]/g, "");
                    const parts = v.split(".");
                    const clean = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : v;
                    setAmount(clean);
                  }}
                  placeholder="0"
                  className="flex-1 bg-transparent outline-none text-4xl font-semibold text-black placeholder:text-gray-300 min-w-0"
                  style={{ fontSize: "2.5rem" }}
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-2xl font-light text-gray-400">{currencySymbol}</span>
                <div className="flex items-center gap-1 border border-gray-300 rounded-full px-3 py-1.5 hover:border-[#0070BA] transition-colors">
                  <span className="text-sm font-semibold text-black">{currencyCode}</span>
                  <ChevronDown className="h-4 w-4 text-black" />
                </div>
              </div>
            </div>
            {selectedAccount && amount && parseFloat(amount) > 0 && (
              <div className="mt-2 text-[11px] text-gray-500 flex items-center justify-between px-1">
                <span>After this transfer</span>
                <span className={cn(
                  "font-semibold",
                  selectedAccount.balance - parseFloat(amount || "0") < 0 ? "text-red-600" : "text-gray-800"
                )}>
                  {formatCurrency(Math.max(0, selectedAccount.balance - parseFloat(amount || "0")))}
                </span>
              </div>
            )}
          </div>


          {/* Optional Fields */}
          <div className="px-4 pb-4 space-y-4">
            <h3 className="text-base font-semibold text-black">Optional Fields</h3>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-black block">Recipient name:</label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="e.g. James Robinson"
                className="w-full h-12 px-3 rounded-lg border border-gray-300 bg-white outline-none text-sm text-black placeholder:text-gray-400 focus:border-[#0070BA] focus:ring-2 focus:ring-[#0070BA]/20 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-black block">Recipient email/gmail:</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@email.com"
                  className="w-full h-12 px-3 rounded-lg border border-gray-300 bg-white outline-none text-sm text-black focus:border-[#0070BA] focus:ring-2 focus:ring-[#0070BA]/20 transition-all"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full flex items-center justify-center" style={{ background: "#E6F8EC" }}>
                  <Sparkles className="h-3.5 w-3.5" style={{ color: "#00C244" }} />
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-black block">Note: Note (required)</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder=""
                className="w-full h-12 px-3 rounded-lg border border-gray-300 bg-white outline-none text-sm text-black focus:border-[#0070BA] focus:ring-2 focus:ring-[#0070BA]/20 transition-all"
              />
            </div>
          </div>

          {/* Payment Type */}
          <div className="px-4 pb-4">
            <h3 className="text-base font-semibold text-black mb-2">Payment Type</h3>
            <Select value={paymentType} onValueChange={setPaymentType}>
              <SelectTrigger className="h-12 rounded-xl border border-gray-300 bg-white text-left focus:ring-2 focus:ring-[#0070BA]/20 focus:border-[#0070BA]">
                <SelectValue placeholder="select payment type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ff">Friends &amp; Family</SelectItem>
                <SelectItem value="gs">Goods &amp; Services</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Action buttons */}
          <div className="px-4 pb-5 pt-2 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="py-3.5 rounded-full bg-black text-white font-semibold text-base active:opacity-80 transition-opacity"
            >
              Request
            </button>
            <button
              type="button"
              disabled={!canSend || loading}
              onClick={onSubmit}
              className="py-3.5 rounded-full bg-black text-white font-semibold text-base disabled:opacity-40 active:opacity-80 transition-opacity"
            >
              {loading ? "…" : "Send"}
            </button>
          </div>

          <div className="h-4" />
        </div>
      </DialogContent>
    </Dialog>
  );
};
