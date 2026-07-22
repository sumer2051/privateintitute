import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ShieldCheck, ArrowRight, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { CountryMethod } from "@/lib/country-methods";

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
  const [showFullReceipt, setShowFullReceipt] = useState(false);

  useEffect(() => {
    if (open) setShowFullReceipt(false);
  }, [open, receipt?.reference]);

  if (!receipt) return null;
  const { method, amount, currencyCode, senderName, recipientName, recipientEmail, fields, note, variant, reference, timestamp } = receipt;
  const style = method.receiptStyle;
  const amountStr = fmt(amount, currencyCode);
  const isCashApp = method.id === "cashapp";
  const isPayPal = method.id === "paypal" || method.id === "paypal_uk" || method.id === "paypal_eu";
  const displayTo = recipientName || fields.handle || fields.recipient_name || fields.email || fields.wallet_id || fields.upi_id || fields.pix_key || fields.payid || recipientEmail || "recipient";

  if (isPayPal && !showFullReceipt) {
    const firstName = (recipientName || displayTo).split(" ")[0];
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-0 bg-white sm:rounded-2xl [&>button]:hidden">
          <div className="relative flex min-h-[620px] flex-col bg-white">
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center text-neutral-700 hover:text-black"
            >
              <X className="h-6 w-6" strokeWidth={2} />
            </button>

            <div className="px-6 pt-24 pb-10 text-center">
              <div className="flex items-center justify-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#00857A]">
                  <Check className="h-4 w-4 text-[#00857A]" strokeWidth={3} />
                </div>
                <h1 className="text-[34px] font-bold tracking-tight text-black">
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
                <div className="mb-6 flex h-[130px] w-[210px] flex-col justify-between rounded-xl bg-gradient-to-br from-[#0070ba] to-[#1546a0] p-4 shadow-lg">
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
                  onClick={() => setShowFullReceipt(true)}
                  className="mt-8 w-full max-w-[360px] rounded-full bg-black py-4 text-[17px] font-semibold text-white hover:bg-neutral-800 transition-colors"
                >
                  Get Yours Today
                </button>
                <button
                  onClick={onClose}
                  className="mt-4 text-[17px] font-bold text-black hover:opacity-70"
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }


  if (isCashApp && !showFullReceipt) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-0 bg-black text-white sm:rounded-2xl [&>button]:hidden">
          <div className="flex min-h-[560px] flex-col px-6 pb-6 pt-5">
            <button
              onClick={onClose}
              aria-label="Close"
              className="mb-6 flex h-9 w-9 items-center justify-center rounded-full text-white/90 hover:bg-white/10"
            >
              <X className="h-6 w-6" strokeWidth={2.5} />
            </button>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#00D64F] animate-in zoom-in-50 duration-300">
              <Check className="h-9 w-9 text-black" strokeWidth={3.5} />
            </div>
            <h1 className="mt-6 text-[34px] font-bold leading-[1.15] tracking-tight">
              You sent {amountStr} to {displayTo}
            </h1>
            <div className="mt-auto space-y-3 pt-8">
              <button
                onClick={() => setShowFullReceipt(true)}
                className="w-full rounded-full bg-[#1f1f1f] py-4 text-[17px] font-semibold text-white hover:bg-[#2a2a2a] transition-colors"
              >
                Receipt
              </button>
              <button
                onClick={onClose}
                className="w-full rounded-full bg-white py-4 text-[17px] font-semibold text-black hover:bg-white/90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
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
              {note && (
                <div className="mt-4 rounded-2xl bg-white/20 px-4 py-3 text-sm backdrop-blur">
                  "{note}"
                </div>
              )}
            </div>
            <div className="p-5 space-y-2 text-sm">
              {Object.entries(fields).filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex justify-between text-muted-foreground">
                  <span className="capitalize">{k.replace(/_/g, " ")}</span>
                  <span className="font-medium text-foreground">{v}</span>
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
                  <span className="font-medium">{v}</span>
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
                  <div className="font-medium">{recipientName}</div>
                  <div className="text-xs text-muted-foreground">{recipientEmail}</div>
                </div>
              </div>
              <div className="rounded border p-3 space-y-1.5">
                {Object.entries(fields).filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                    <span className="font-mono">{v}</span>
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
      </DialogContent>
    </Dialog>
  );
};
