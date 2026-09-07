import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ShieldCheck, ArrowRight, Sparkles, X, Clock, Briefcase } from "lucide-react";
import type { CountryMethod } from "@/lib/country-methods";
import { readFeeFromForm, isFeeField } from "@/lib/fees";

/**
 * Keeps a receipt at its full, generous design size but shrinks it
 * proportionally when it would be taller than the screen — so it always
 * fits on one screen with no scrolling.
 */
const FitBox = ({ children }: { children: ReactNode }) => {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  const measure = useCallback(() => {
    const box = boxRef.current;
    const inner = innerRef.current;
    if (!box || !inner) return;
    const availH = box.clientHeight;
    const contentH = inner.scrollHeight;
    if (!availH || !contentH) return;
    const next = Math.min(1, availH / contentH);
    setScale((prev) => (Math.abs(prev - next) > 0.005 ? next : prev));
  }, []);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(() => measure());
    if (boxRef.current) ro.observe(boxRef.current);
    if (innerRef.current) ro.observe(innerRef.current);
    return () => ro.disconnect();
  }, [measure]);

  useEffect(() => {
    const t = setTimeout(measure, 120);
    window.addEventListener("resize", measure);
    return () => { clearTimeout(t); window.removeEventListener("resize", measure); };
  }, [measure]);

  return (
    <div ref={boxRef} className="flex h-full w-full min-w-0 items-start justify-center overflow-hidden">
      <div
        ref={innerRef}
        style={{ transform: `scale(${scale})`, transformOrigin: "top center", width: "100%" }}
        className="min-w-0"
      >
        {children}
      </div>
    </div>
  );
};


export interface ReceiptData {
  method: CountryMethod;
  amount: number;
  currencyCode: string;
  currencySymbol: string;
  senderName: string;
  recipientName: string;
  recipientEmail: string;
  fields: Record<string, string>;
  note?: string;
  variant?: string;
  reference: string;
  timestamp: string;
  /** "Checking Account · ****1234" style label for the funding account. */
  fromLabel?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  receipt: ReceiptData | null;
}

const fmt = (n: number, code: string) => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code, maximumFractionDigits: code === "JPY" ? 0 : 2 }).format(n);
  } catch { return `${n.toFixed(2)} ${code}`; }
};

export const TransferReceipt = ({ open, onClose, receipt }: Props) => {
  if (!receipt) return null;
  const { method, amount, currencyCode, senderName, recipientName, recipientEmail, fields, note, variant, reference, timestamp, fromLabel } = receipt;
  const style = method.receiptStyle;
  const amountStr = fmt(amount, currencyCode);
  const isCashApp = method.id === "cashapp";
  const isPayPal = method.id === "paypal" || method.id === "paypal_uk" || method.id === "paypal_eu";
  const isZelle = method.id === "zelle";
  const displayTo = recipientName || fields.handle || fields.recipient_name || fields.email || fields.wallet_id || fields.upi_id || fields.pix_key || fields.payid || recipientEmail || "recipient";
  const fittedReceiptShell = "ios-safe-sheet top-0 left-0 right-0 bottom-0 translate-x-0 translate-y-0 h-[100dvh] w-screen max-w-none rounded-none p-0 overflow-hidden sm:top-1/2 sm:left-1/2 sm:right-auto sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:h-auto sm:max-h-[calc(100dvh-1rem)] sm:w-full sm:max-w-[380px] sm:rounded-2xl";


  if (isZelle) {
    const nameUpper = (recipientName || fields.recipient_name || displayTo).toUpperCase();
    const firstName = nameUpper.split(" ")[0];
    const initials = nameUpper.split(" ").map(s => s[0]).filter(Boolean).slice(0, 2).join("");
    const contact = fields.email || fields.phone || recipientEmail || "";
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent data-brand-skin className={`${fittedReceiptShell} border-0 bg-[#f4f5f7] [&>button]:hidden`}>
          <div className="flex h-full min-w-0 flex-col overflow-x-hidden overflow-y-auto overscroll-contain sm:min-h-[min(640px,calc(100dvh-1rem))]">
            <div className="flex items-center justify-between bg-[#2a5c99] px-4 py-3 text-white">
              <div className="flex flex-col gap-1">
                <span className="block h-0.5 w-5 bg-white" />
                <span className="block h-0.5 w-5 bg-white" />
                <span className="block h-0.5 w-5 bg-white" />
              </div>
              <div className="text-[15px] font-semibold tracking-wide">PAYMENT SENT</div>
              <div className="w-5" />
            </div>

            <div className="flex min-h-0 flex-1 flex-col items-center px-5 pb-5 pt-5 text-center sm:px-6 sm:pb-6 sm:pt-8">
              <h1 className="text-[32px] font-normal text-neutral-900">Sent {amountStr}</h1>

              <div className="relative mb-3 mt-4 sm:mb-4 sm:mt-6">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-neutral-300 text-[36px] font-medium text-neutral-800 sm:h-[130px] sm:w-[130px] sm:text-[42px]">
                  {initials || "•"}
                </div>
                <div className="absolute -bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow">
                  <span className="text-[18px] font-black italic text-[#6d1ed4]" style={{ fontFamily: "Georgia, serif" }}>z</span>
                </div>
              </div>

              <div className="text-[26px] font-normal leading-tight text-neutral-900">to {nameUpper}</div>
              <div className="mt-1 text-[15px] italic text-neutral-500">Enrolled as {nameUpper}</div>
              {contact && <div className="mt-2 text-[19px] text-neutral-900 break-all">{contact}</div>}

              <p className="mt-6 max-w-[300px] text-[15px] italic leading-snug text-neutral-600">
                The money will be available in {firstName}'s account shortly, typically in minutes.
              </p>

              <div className="mt-auto w-full pt-5 sm:pt-10">
                <div className="text-center text-[13px] text-neutral-500">
                  Confirmation: {reference}
                </div>
                <button
                  onClick={onClose}
                  className="mt-4 w-full rounded-md bg-[#2a5c99] py-4 text-[16px] font-semibold tracking-wider text-white hover:bg-[#234f83] transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (isPayPal) {
    const firstName = (recipientName || displayTo).split(" ")[0];
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent data-brand-skin className={`${fittedReceiptShell} border-0 bg-white [&>button]:hidden`}>
          <div className="relative flex h-full min-w-0 flex-col overflow-x-hidden overflow-y-auto overscroll-contain bg-white sm:min-h-[min(620px,calc(100dvh-1rem))]">
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center text-neutral-700 hover:text-black"
            >
              <X className="h-6 w-6" strokeWidth={2} />
            </button>

            <div className="px-5 pb-6 pt-14 text-center sm:px-6 sm:pb-10 sm:pt-20">
              <div className="flex items-center justify-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#00857A]">
                  <Check className="h-4 w-4 text-[#00857A]" strokeWidth={3} />
                </div>
                <h1 className="break-words text-[28px] font-bold tracking-tight text-black sm:text-[34px]">
                  {amountStr} <span className="font-semibold">sent</span>
                </h1>
              </div>
              <p className="mt-3 text-[17px] text-neutral-800">
                We'll let {firstName} know.
              </p>
            </div>

            <div className="relative flex-1 bg-[#f2efe9]">
              <div className="absolute -top-16 left-1/2 h-32 w-[140%] -translate-x-1/2 rounded-[100%] bg-white" />
              <div className="absolute left-4 top-16 h-3 w-3 rounded-full bg-black/5" />
              <div className="absolute right-6 top-10 h-2 w-2 rounded-full bg-black/5" />
              <div className="absolute left-10 bottom-24 h-16 w-16 rounded-full bg-black/[0.04]" />
              <div className="absolute right-6 bottom-32 h-14 w-14 rounded-full bg-black/[0.04]" />

              <div className="relative flex flex-col items-center px-6 pt-6 pb-8">
                <div className="mb-4 flex h-[104px] w-[180px] flex-col justify-between rounded-xl bg-gradient-to-br from-[#0070ba] to-[#1546a0] p-4 shadow-lg sm:mb-6 sm:h-[130px] sm:w-[210px]">
                  <div className="text-[28px] font-extrabold italic tracking-tight text-[#5ec0ff]" style={{ fontFamily: "Georgia, serif" }}>
                    PayPal
                  </div>
                  <div className="flex items-end justify-end gap-1">
                    <span className="mr-1 text-[9px] font-semibold uppercase tracking-wider text-white/90">debit</span>
                    <div className="relative h-6 w-10">
                      <div className="absolute left-0 h-6 w-6 rounded-full bg-[#eb001b]" />
                      <div className="absolute right-0 h-6 w-6 rounded-full bg-[#f79e1b] mix-blend-multiply" />
                    </div>
                  </div>
                </div>

                <p className="max-w-[300px] text-center text-[17px] leading-snug text-black">
                  Did you know you could get a debit card and use your PayPal balance at stores and ATMs?
                </p>

                <button
                  onClick={onClose}
                  className="mt-8 w-full max-w-[360px] rounded-full bg-black py-4 text-[17px] font-semibold text-white hover:bg-neutral-800 transition-colors"
                >
                  Done
                </button>
                <button
                  onClick={onClose}
                  className="mt-4 text-[17px] font-bold text-black hover:opacity-70"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }


  if (isCashApp) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent data-brand-skin
          className={`${fittedReceiptShell} gap-0 border-0 bg-black text-white [&>button]:hidden sm:min-h-[min(640px,calc(100dvh-1rem))] sm:rounded-3xl`}
        >
          <div className="flex h-full min-w-0 flex-col overflow-x-hidden overflow-y-auto overscroll-contain px-5 pb-5 pt-4 sm:min-h-[min(640px,calc(100dvh-1rem))]">
            <button
              onClick={onClose}
              aria-label="Close"
              className="mb-4 flex h-9 w-9 items-center justify-center rounded-full text-white/90 hover:bg-white/10"
            >
              <X className="h-6 w-6" strokeWidth={2.5} />
            </button>

            <div className="flex-1 flex flex-col">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#00D64F] animate-in zoom-in-50 duration-300">
                <Check className="h-9 w-9 text-black" strokeWidth={3.5} />
              </div>
              <h1 className="mt-6 break-words text-[32px] sm:text-[34px] font-bold leading-[1.15] tracking-tight">
                You sent {amountStr} to {displayTo}
              </h1>
            </div>

            <div className="mt-auto space-y-3 pt-6">
              <button
                onClick={onClose}
                className="w-full rounded-full bg-[#00D64F] py-4 text-[17px] font-semibold text-black hover:bg-[#00c244] transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const isVenmo = method.id === "venmo";
  if (isVenmo) {
    const fee = readFeeFromForm(fields, note, reference);
    const feeStr = fee !== null ? fmt(fee, currencyCode) : null;
    const totalStr = fee !== null ? fmt(amount + fee, currencyCode) : null;
    const findField = (re: RegExp) =>
      Object.entries(fields).find(([k, v]) => v && re.test(k))?.[1] || "";
    const vName = recipientName || fields.recipient_name || displayTo;
    const vHandle = findField(/handle|username|tag/i) || fields.handle || "";
    const handleLine = vHandle ? (vHandle.startsWith("@") ? vHandle : `@${vHandle}`) : `@${vName.replace(/\s+/g, "-")}`;
    
    const initials = vName.split(" ").map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
    const bankName = findField(/\bbank\b|bank name/i) || fields.bank || "";
    const VRow = ({ label, children }: { label: string; children: ReactNode }) => (
      <div className="mt-3">
        <div className="text-[13px] text-neutral-900">{label}</div>
        <div className="mt-0.5 break-words text-[16px] font-semibold leading-snug text-neutral-900">{children}</div>
      </div>
    );
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent data-brand-skin className={`${fittedReceiptShell} border-0 bg-white [&>button]:hidden`}>
          <FitBox>
          <div className="flex min-w-0 flex-col overflow-x-hidden overflow-y-hidden bg-white">
            {/* Header */}
            <div className="relative flex items-center justify-center border-b border-neutral-100 px-4 py-2.5">
              <button onClick={onClose} aria-label="Back" className="absolute left-3 flex h-8 w-8 items-center justify-center text-neutral-700 hover:text-black">
                <ArrowRight className="h-5 w-5 rotate-180" strokeWidth={2} />
              </button>
              <div className="text-[15px] font-medium text-neutral-900">Payment details</div>
            </div>

            {/* Recipient + amount */}
            <div className="flex flex-col items-center px-4 pt-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-300 text-[20px] font-semibold text-neutral-700">
                {initials || "•"}
              </div>
              <h1 className="mt-2 break-words text-[22px] font-bold leading-tight text-neutral-900">{vName}</h1>
              <div className="mt-1.5 text-[26px] font-bold text-[#d02a2e]">
                - {amountStr.replace(/^[−-]\s*/, "")}
              </div>
              {feeStr && (
                <div className="mt-0.5 text-[13px] text-neutral-600">
                  Fee {feeStr} · Total {totalStr}
                </div>
              )}
            </div>

            {/* Social activity */}
            <div className="px-4 pt-3">
              <div className="text-[15px] text-neutral-900">Social activity</div>

              <div className="mt-1.5 flex items-center gap-5 text-neutral-400">
                <span className="flex items-center gap-1.5 text-[15px]">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-neutral-400"><path d="M12 21s-8-5.5-8-11a4.5 4.5 0 0 1 8-3 4.5 4.5 0 0 1 8 3c0 5.5-8 11-8 11z" /></svg>
                  0
                </span>
                <span className="flex items-center gap-1.5 text-[15px]">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-neutral-400"><path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z" /></svg>
                  0
                </span>
              </div>
              <div className="mt-3 h-px bg-neutral-200" />
            </div>

            {/* Details */}
            <div className="px-4 pb-4">
              <VRow label="Status">Complete</VRow>
              <VRow label="Payment method">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-9 shrink-0 items-center justify-center rounded-sm bg-[#1173b1] text-[12px] font-bold text-white">
                    {method.glyph}
                  </span>
                  <span className="min-w-0">
                    {bankName && <div className="break-words uppercase">{bankName}</div>}
                    <div>{fromLabel || senderName}</div>
                  </span>
                </div>
              </VRow>
              <VRow label="Transaction details">
                <div className="flex items-center gap-3">
                  <span className="text-[13px] font-normal text-neutral-800">
                    {new Date(timestamp).toLocaleString("en-US", { month: "long", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="flex items-center gap-1 text-[13px] font-semibold text-[#008cff]">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-[#008cff]"><path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3H9z" /></svg>
                    Private
                  </span>
                </div>
              </VRow>
              <VRow label="Paid to">{handleLine}</VRow>
              <VRow label="Transaction ID">
                <span className="font-mono text-[13px] font-normal text-neutral-800">{reference}</span>
              </VRow>
            </div>
          </div>
          </FitBox>
        </DialogContent>
      </Dialog>
    );
  }

  const isOsko = /payid|osko/i.test(method.id) || /payid|osko/i.test(method.name);
  if (isOsko) {
    const fee = readFeeFromForm(fields, note, reference);
    const feeStr = fee !== null ? fmt(fee, currencyCode) : null;
    const totalStr = fee !== null ? fmt(amount + fee, currencyCode) : null;
    const idBits = Object.entries(fields)
      .filter(([k, v]) => v && !isFeeField(k) && !/recipient name|^note|_note|\breference\b|^recipient email$|^email$/i.test(k))
      .map(([, v]) => v)
      .join(" ");
    const ref = fields["Reference"] || fields.reference || "";
    const ORow = ({ label, children }: { label: string; children: ReactNode }) => (
      <div className="mt-2.5">
        <div className="text-[13px] font-bold text-neutral-900">{label}</div>
        <div className="text-[13px] text-neutral-800 break-words">{children}</div>
      </div>
    );
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent data-brand-skin className={`${fittedReceiptShell} border-0 bg-white [&>button]:hidden`}>
          <FitBox>
          <div className="flex min-w-0 flex-col overflow-x-hidden overflow-y-hidden bg-white">
            <div className="flex items-center justify-between border-b border-neutral-200 bg-[#f6f6f6] px-4 py-2.5">
              <button onClick={onClose} aria-label="Close"><X className="h-4 w-4 text-neutral-900" strokeWidth={2.5} /></button>
              <div className="text-[15px] font-bold text-neutral-900">Receipt</div>
              <span className="text-[13px] text-neutral-500">Share</span>
            </div>

            <div className="px-4 pb-4 pt-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3aab3a]">
                <Check className="h-5 w-5 text-white" strokeWidth={3.5} />
              </div>
              <h1 className="mt-2.5 break-words text-[19px] font-bold leading-tight text-neutral-900">
                Paid {amountStr}
                <br />to {recipientName || displayTo}
              </h1>
              {idBits && <div className="break-all text-[13px] text-neutral-800">{idBits}</div>}
              <div className="mt-1.5 break-all text-[13px] text-neutral-500">Receipt no: {reference}</div>

              <div className="my-3 h-px bg-neutral-200" />

              <ORow label="From">
                {senderName}
                {fromLabel && <div className="text-neutral-500">({fromLabel})</div>}
              </ORow>
              {ref && <ORow label="Reference">{ref}</ORow>}
              {feeStr && (
                <ORow label="Fee">
                  {feeStr}
                  {totalStr && <span className="text-neutral-500"> · Total {totalStr}</span>}
                </ORow>
              )}
              <ORow label="Transaction Date">
                {new Date(timestamp).toLocaleString("en-AU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} (Syd/Melb time)
              </ORow>

              <p className="mt-3 text-[13px] text-neutral-800">This payment should be received instantly.</p>
              <div className="mt-2 flex items-center gap-2 text-[13px] text-neutral-500">
                Sent through
                <span className="flex items-center gap-1 text-[14px] font-bold text-neutral-900">
                  Osko
                  <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-neutral-900">
                    <span className="h-1.5 w-1.5 rounded-full bg-neutral-900" />
                  </span>
                </span>
              </div>

              <button
                onClick={onClose}
                className="mt-4 w-full rounded-full bg-[#f5c518] py-2.5 text-[15px] font-bold text-neutral-900 hover:bg-[#e5b716] transition-colors"
              >
                Done
              </button>
            </div>
          </div>
          </FitBox>
        </DialogContent>
      </Dialog>
    );
  }

  const isWire = /wire|swift|uaefts/i.test(method.id) || /wire|swift/i.test(method.name);
  if (isWire) {
    const fee = readFeeFromForm(fields, note, reference);
    const feeStr = fee !== null ? fmt(fee, currencyCode) : null;
    const memo =
      fields["Reference"] || fields["Payment Reference"] || fields.reference || note || "";
    const WRow = ({ label, children }: { label: string; children: ReactNode }) => (
      <div className="border-b border-neutral-200 px-4 py-2">
        <div className="text-[12px] font-bold text-neutral-900">{label}</div>
        <div className="break-words text-[13px] text-neutral-600">{children}</div>
      </div>
    );
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent data-brand-skin className={`${fittedReceiptShell} border-0 bg-white [&>button]:hidden sm:rounded-md`}>
          <FitBox>
          <div className="flex min-w-0 flex-col overflow-x-hidden overflow-y-hidden border-2 border-[#00875a] bg-white">
            <div className="bg-[#00875a] py-2 text-center text-[16px] font-bold text-white">
              Wire Scheduled
            </div>
            <div className="border-b border-neutral-200 px-5 py-3 text-center">
              <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-[#00875a]">
                <Check className="h-4 w-4 text-white" strokeWidth={3.5} />
              </div>
              <h1 className="mt-2 text-[15px] font-bold text-neutral-900">Wire successfully scheduled!</h1>
              <p className="mt-1 text-[13px] leading-snug text-neutral-500">
                We're processing your {amountStr} wire transfer now.
              </p>
            </div>
            <WRow label="Reference #">{reference}</WRow>
            <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-2">
              <div className="min-w-0">
                <div className="text-[12px] font-bold text-neutral-900">Amount</div>
                <div className="break-all text-[13px] text-neutral-600">{amountStr}</div>
              </div>
              {feeStr && (
                <div className="min-w-0 break-words text-right text-[12px] font-bold text-neutral-900">+ {feeStr} Service Fee</div>
              )}
            </div>
            <WRow label="Send To">{recipientName || displayTo}</WRow>
            <WRow label="Send From">{fromLabel || senderName}</WRow>
            <WRow label="Frequency">One Time</WRow>
            <WRow label="Send By">
              {new Date(timestamp).toDateString() === new Date().toDateString()
                ? "Today"
                : new Date(timestamp).toLocaleDateString()}
            </WRow>
            {memo && <WRow label="Memo">{memo}</WRow>}
            <p className="px-4 py-2.5 text-[9px] font-semibold leading-snug text-neutral-700">
              I certify that I am authorized to initiate this transaction and authorize the bank to
              process this transaction in reliance on the above instructions I provided. I understand
              this transaction is subject to the above fee, must comply with applicable laws and
              regulations, and is subject to my account and Digital Banking Terms and Conditions.
            </p>
            <div className="px-3 pb-3">
              <button
                onClick={onClose}
                className="w-full bg-[#e8740c] py-2.5 text-[15px] font-bold text-white hover:bg-[#d16a0a] transition-colors"
              >
                Done
              </button>
            </div>
          </div>
          </FitBox>
        </DialogContent>
      </Dialog>
    );
  }

  if (style === "confirmation") {
    const fee = readFeeFromForm(fields, note, reference);
    const feeStr = fee !== null ? fmt(fee, currencyCode) : null;
    const totalStr = fee !== null ? fmt(amount + fee, currencyCode) : null;
    const accountBits = Object.entries(fields)
      .filter(([k, v]) => v && !isFeeField(k) && !/recipient name|^note|_note|\breference\b|^recipient email$|^email$/i.test(k))
      .map(([, v]) => v);
    const toLine = accountBits.slice(1).join(" ");
    const bankLine = accountBits[0] || "";

    const Row = ({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) => (
      <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-2.5 last:border-b-0">
        <div className="text-[13px] text-neutral-800">{label}</div>
        <div className={`min-w-0 max-w-[68%] break-words text-right text-[13px] leading-tight ${strong ? "font-semibold text-neutral-900" : "text-neutral-900"}`}>{value}</div>
      </div>
    );

    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent data-brand-skin className={`${fittedReceiptShell} border-0 bg-white [&>button]:hidden`}>
          <FitBox>
          <div className="flex min-w-0 flex-col overflow-x-hidden overflow-y-hidden bg-white">
            <div className="border-b border-neutral-200 py-2.5 text-center text-[15px] font-bold text-neutral-900">
              {method.id === "ach" ? "Confirm" : "Confirmation"}
            </div>

            {method.id === "ach" ? (
              <div className="px-5 py-3">
                {[
                  { icon: <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />, filled: true, title: "Transfer submitted", sub: "Today" },
                  { icon: <Clock className="h-3.5 w-3.5 text-[#2b7a72]" strokeWidth={2.5} />, filled: false, title: "Processing", sub: "After fee is confirmed" },
                  { icon: <Briefcase className="h-3.5 w-3.5 text-[#2b7a72]" strokeWidth={2.5} />, filled: false, title: "Money will be delivered", sub: "" },
                ].map((s, i, arr) => (
                  <div key={s.title} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-full ${s.filled ? "bg-[#2b7a72]" : "bg-neutral-100"}`}>
                        {s.icon}
                      </div>
                      {i < arr.length - 1 && <div className="my-1 w-px flex-1 border-l border-dashed border-neutral-300" />}
                    </div>
                    <div className={i < arr.length - 1 ? "pb-2.5" : ""}>
                      <div className="text-[12px] text-neutral-500">{s.title}</div>
                      {s.sub && <div className="text-[13px] text-neutral-900">{s.sub}</div>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-3.5 text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#2b7a72]">
                  <Check className="h-6 w-6 text-white" strokeWidth={3} />
                </div>
                <h1 className="mt-2 text-[24px] font-normal leading-tight text-neutral-900">Thank you</h1>
                <p className="mx-auto mt-1.5 max-w-[310px] text-[12px] leading-snug text-neutral-800">
                  Your instruction has been sent and will be credited to the payees account
                  {method.settlement ? ` ${method.settlement.toLowerCase()}` : " immediately"}, subject to our standard checks. This cannot be recalled.
                </p>
              </div>
            )}

            <div className="border-t border-neutral-200">
              {method.id === "ach" && <Row label="Confirmation #" value={<span className="font-mono text-[12px]">{reference}</span>} />}

              <Row
                label="From"
                value={
                  <>
                    <div className="uppercase">{fromLabel || "BANK A/C"}</div>
                    <div className="text-neutral-700">{senderName}</div>
                  </>
                }
              />
              <Row
                label="To"
                value={
                  <>
                    <div>{recipientName || displayTo}</div>
                    {toLine && <div className="text-neutral-700">{toLine}</div>}
                    {bankLine && <div className="text-[11px] text-neutral-500">{bankLine}</div>}
                  </>
                }
              />
              <div className="flex items-center gap-2 border-b border-neutral-200 px-5 py-2.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2b7a72]">
                  <Check className="h-3 w-3 text-white" strokeWidth={4} />
                </span>
                <span className="text-[13px] text-neutral-800">Payee details matched</span>
              </div>
              <Row label="Amount" value={<span className="font-semibold">{amountStr}</span>} />
              {feeStr && <Row label="Fee" value={feeStr} />}
              {totalStr && <Row label="Total" value={<span className="font-semibold">{totalStr}</span>} strong />}
              
              <Row label="Payment type" value={method.name} />
              {method.id !== "ach" && <Row label="Confirmation" value={<span className="font-mono text-[11px]">{reference}</span>} />}
              <Row
                label="Date"
                value={
                  new Date(timestamp).toDateString() === new Date().toDateString()
                    ? "Today"
                    : new Date(timestamp).toLocaleDateString()
                }
              />
            </div>

            <div className="border-t border-neutral-200 p-3">
              <button
                onClick={onClose}
                className="w-full border border-neutral-400 bg-white py-2.5 text-[14px] text-neutral-900 hover:bg-neutral-50 transition-colors"
              >
                Make another transfer
              </button>
            </div>
          </div>
          </FitBox>
        </DialogContent>
      </Dialog>
    );
  }


  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={fittedReceiptShell}>
        <div className="h-full min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain">
        {style === "casual" && (
          <div className="bg-white">
            <div className={`bg-gradient-to-br ${method.accent} p-6 text-white`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest opacity-90">
                  <Sparkles className="h-3.5 w-3.5" /> {method.name}
                </div>
                <Badge className="bg-white/25 hover:bg-white/25 text-white border-0 text-[10px]">Sent</Badge>
              </div>
              <div className="mt-6 flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-white/25 flex items-center justify-center font-bold text-lg backdrop-blur">
                  {senderName?.[0]?.toUpperCase() ?? "•"}
                </div>
                <ArrowRight className="h-5 w-5 opacity-70" />
                <div className="h-12 w-12 rounded-full bg-white/25 flex items-center justify-center font-bold text-lg backdrop-blur">
                  {recipientName?.[0]?.toUpperCase() ?? "•"}
                </div>
              </div>
              <div className="mt-4">
                <div className="text-4xl font-bold">{amountStr}</div>
                <div className="text-sm opacity-90 mt-1">to <span className="font-semibold">{recipientName || fields.handle}</span></div>
              </div>
            </div>
            <div className="p-5 space-y-2 text-sm">
              {Object.entries(fields).filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex justify-between text-muted-foreground">
                  <span className="capitalize">{k.replace(/_/g, " ")}</span>
                   <span className="min-w-0 max-w-[65%] break-words text-right font-medium text-foreground">{v}</span>
                </div>
              ))}
              <div className="flex justify-between text-muted-foreground pt-2 border-t"><span>Reference</span><span className="font-mono text-xs">{reference}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Sent</span><span>{new Date(timestamp).toLocaleString()}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Receipt to</span><span className="text-foreground">{recipientEmail}</span></div>
            </div>
          </div>
        )}

        {style === "minimal" && (
          <div className="bg-background">
            <div className="p-6 text-center border-b">
              <div className={`mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br ${method.accent} text-white flex items-center justify-center text-2xl font-bold shadow-lg`}>
                {method.glyph}
              </div>
              <div className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">{method.name}</div>
              <div className="mt-2 text-3xl font-bold text-secondary">{amountStr}</div>
              <div className="mt-1 text-sm text-muted-foreground">to {recipientName || fields.handle || recipientEmail}</div>
              <Badge variant="outline" className="mt-3 border-success/40 text-success bg-success/10 gap-1">
                <Check className="h-3 w-3" /> {method.settlement}
              </Badge>
            </div>
            <div className="p-5 space-y-2 text-sm">
              {Object.entries(fields).filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                   <span className="min-w-0 max-w-[65%] break-words text-right font-medium">{v}</span>
                </div>
              ))}
              {note && <div className="flex justify-between"><span className="text-muted-foreground">Note</span><span className="font-medium text-right">{note}</span></div>}
              <div className="flex justify-between pt-2 border-t"><span className="text-muted-foreground">Reference</span><span className="font-mono text-xs">{reference}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Sent</span><span>{new Date(timestamp).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Receipt to</span><span>{recipientEmail}</span></div>
            </div>
          </div>
        )}

        {style === "formal" && (
          <div className="bg-background">
            <DialogHeader className="p-6 pb-3 border-b">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded bg-gradient-to-br ${method.accent} text-white flex items-center justify-center font-bold`}>{method.glyph}</div>
                <div>
                  <DialogTitle className="text-secondary">{method.name} — Payment Advice</DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Reference {reference}</p>
                </div>
              </div>
            </DialogHeader>
            <div className="p-6 space-y-4 text-sm">
              <div className="rounded border bg-muted/40 p-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Amount</div>
                <div className="text-2xl font-bold text-secondary">{amountStr}</div>
                {variant && <div className="text-xs text-muted-foreground mt-1">Payment type: {variant === "gs" ? "Goods & Services" : "Friends & Family"}</div>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Originator</div>
                  <div className="font-medium">{senderName}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Beneficiary</div>
                   <div className="break-words font-medium">{recipientName}</div>
                   <div className="break-all text-xs text-muted-foreground">{recipientEmail}</div>
                </div>
              </div>
              <div className="rounded border p-3 space-y-1.5">
                {Object.entries(fields).filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                     <span className="min-w-0 max-w-[65%] break-all text-right font-mono">{v}</span>
                  </div>
                ))}
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Settlement</span><span>{method.settlement}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Value date</span><span>{new Date(timestamp).toLocaleDateString()}</span></div>
              </div>
              <div className="flex items-start gap-2 rounded border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>This payment is subject to compliance review. A copy of this advice has been sent to the beneficiary at {recipientEmail}.</span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="p-4 pt-2 border-t">
          <Button variant="secondary" onClick={() => window.print()}>Print</Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
