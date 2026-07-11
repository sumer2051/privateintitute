import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ShieldCheck, ArrowRight, Sparkles } from "lucide-react";
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
  if (!receipt) return null;
  const { method, amount, currencyCode, senderName, recipientName, recipientEmail, fields, note, variant, reference, timestamp } = receipt;
  const style = method.receiptStyle;
  const amountStr = fmt(amount, currencyCode);

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
