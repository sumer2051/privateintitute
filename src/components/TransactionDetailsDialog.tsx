import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Ban,
  CheckCircle2,
  Clock,
  Loader2,
  Receipt,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { TransactionMapCard } from "@/components/TransactionMapCard";
import { TransferReceipt, type ReceiptData } from "@/components/TransferReceipt";
import { TransferTracker } from "@/components/TransferTracker";
import { COUNTRY_METHODS, SWIFT_FALLBACK, type CountryMethod } from "@/lib/country-methods";
import { currencyInfo, formatIn } from "@/lib/fx";
import { postingVia } from "@/lib/tx-status";

export interface TransactionDetail {
  id: string;
  category: string | null;
  description: string | null;
  amount: number;
  transaction_type: string;
  status: string | null;
  reference_number: string | null;
  recipient_email: string | null;
  recipient_name: string | null;
  currency: string | null;
  created_at: string | null;
}

interface TransactionDetailsDialogProps {
  transaction: TransactionDetail | null;
  transactions: TransactionDetail[];
  onClose: () => void;
  onSelect: (transaction: TransactionDetail) => void;
  onChange: (transaction: TransactionDetail) => void;
}

const ALL_METHODS: CountryMethod[] = [
  ...Object.values(COUNTRY_METHODS).flat(),
  SWIFT_FALLBACK,
];

const findMethod = (categoryOrName?: string | null): CountryMethod | null => {
  if (!categoryOrName) return null;
  const n = categoryOrName.toLowerCase();
  return (
    ALL_METHODS.find((m) => m.name.toLowerCase() === n) ||
    ALL_METHODS.find((m) => m.id.toLowerCase() === n) ||
    ALL_METHODS.find((m) => n.includes(m.name.toLowerCase())) ||
    null
  );
};

const schemeFromTransaction = (description?: string | null): string => {
  const match = /^\s*\[([^\]]+)\]/.exec(description || "");
  return match?.[1]?.trim() || "";
};

const parseDetails = (desc?: string | null): Record<string, string> => {
  if (!desc) return {};
  const cleaned = desc.replace(/^\[[^\]]+\]\s*To\s*[^—]+—\s*/i, "");
  const out: Record<string, string> = {};
  const noteSplit = cleaned.match(/\s+—\s+(.+)$/);
  const detailText = noteSplit ? cleaned.slice(0, noteSplit.index).trim() : cleaned;
  detailText.split(" · ").forEach((pair) => {
    const idx = pair.indexOf(":");
    if (idx > 0) {
      const k = pair.slice(0, idx).trim().toLowerCase().replace(/\s+/g, "_");
      const v = pair.slice(idx + 1).split(" — ")[0].trim();
      if (k && v) out[k] = v;
    }
  });
  if (noteSplit?.[1]?.trim()) out.note = noteSplit[1].trim();
  return out;
};

export const statusMeta = (status: string, isDebit: boolean) => {
  switch (status) {
    case "pending":
      return { Icon: Clock, label: "Pending approval", pillClass: "bg-warning/15 text-warning", iconBg: "bg-warning/15 text-warning", showTypeIcon: false, failed: false };
    case "processing":
      return { Icon: Loader2, label: "Processing", pillClass: "bg-primary/10 text-primary", iconBg: "bg-primary/10 text-primary", showTypeIcon: false, failed: false };
    case "under_review":
      return { Icon: AlertTriangle, label: "Under review", pillClass: "bg-amber-500/15 text-amber-600", iconBg: "bg-amber-500/15 text-amber-600", showTypeIcon: false, failed: false };
    case "compliance_hold":
      return { Icon: AlertTriangle, label: "Compliance hold", pillClass: "bg-orange-500/15 text-orange-600", iconBg: "bg-orange-500/15 text-orange-600", showTypeIcon: false, failed: false };
    case "reviewed":
      return { Icon: Loader2, label: "Reviewed · clearance ongoing", pillClass: "bg-cyan-500/15 text-cyan-600", iconBg: "bg-cyan-500/15 text-cyan-600", showTypeIcon: false, failed: false };
    case "clearing":
      return { Icon: Loader2, label: "Clearing & settlement", pillClass: "bg-indigo-500/15 text-indigo-600", iconBg: "bg-indigo-500/15 text-indigo-600", showTypeIcon: false, failed: false };
    case "posting":
      return { Icon: CheckCircle2, label: "Successful · posting by recipient bank", pillClass: "bg-teal-500/15 text-teal-700", iconBg: "bg-teal-500/15 text-teal-700", showTypeIcon: false, failed: false };
    case "failed":
      return { Icon: XCircle, label: "Failed", pillClass: "bg-destructive/15 text-destructive", iconBg: "bg-destructive/15 text-destructive", showTypeIcon: false, failed: true };
    case "cancelled":
      return { Icon: Ban, label: "Cancelled", pillClass: "bg-muted text-muted-foreground", iconBg: "bg-muted text-muted-foreground", showTypeIcon: false, failed: true };
    case "completed":
    default:
      return {
        Icon: CheckCircle2,
        label: status === "completed" ? "Completed" : status,
        pillClass: "bg-success/10 text-success",
        iconBg: isDebit ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success",
        showTypeIcon: true,
        failed: false,
      };
  }
};

const timeAgo = (iso: string | null) => {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export const TransactionDetailsDialog = ({
  transaction,
  transactions,
  onClose,
  onSelect,
  onChange,
}: TransactionDetailsDialogProps) => {
  const [isStaff, setIsStaff] = useState(false);
  const [custConfirm, setCustConfirm] = useState<{ note: string; at: string } | null>(null);
  const [approveNote, setApproveNote] = useState("");
  const [approving, setApproving] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [returnTo, setReturnTo] = useState<TransactionDetail | null>(null);
  const [senderName, setSenderName] = useState("You");
  const { format, currency } = useCurrency();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: rolesData }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      ]);
      const roles = ((rolesData as any[]) || []).map((r) => r.role);
      setIsStaff(roles.includes("admin") || roles.includes("tx_support"));
      if (profile?.full_name) setSenderName(profile.full_name);
    })();
  }, []);

  useEffect(() => {
    setCustConfirm(null);
    if (!transaction || !isStaff) return;
    let alive = true;
    supabase.from("staff_audit_log").select("meta, created_at").eq("action", "customer_confirmed_transfer")
      .eq("target_id", transaction.id).order("created_at", { ascending: false }).limit(1)
      .then(({ data }) => {
        const row = data?.[0] as any;
        if (alive && row) setCustConfirm({ note: String(row.meta?.customer_note ?? ""), at: row.created_at });
      });
    return () => { alive = false; };
  }, [transaction?.id, isStaff]);

  useEffect(() => { setApproveNote(""); }, [transaction?.id]);

  const fmtTx = (tx: TransactionDetail) => (
    tx.currency ? formatIn(tx.currency, tx.amount) : format(tx.amount)
  );

  const selectedMethod = useMemo(
    () => findMethod(transaction?.category) || findMethod(schemeFromTransaction(transaction?.description)),
    [transaction],
  );

  const related = useMemo(() => {
    const name = (transaction?.recipient_name || "").trim().toLowerCase();
    if (!transaction || !name) return [] as TransactionDetail[];
    return transactions.filter(
      (item) => item.id !== transaction.id && (item.recipient_name || "").trim().toLowerCase() === name,
    );
  }, [transactions, transaction]);

  const approveSelected = async () => {
    if (!transaction) return;
    setApproving(true);
    const { error } = isStaff
      ? await supabase.rpc("admin_update_transaction_status", { p_tx: transaction.id, p_status: "processing" })
      : await supabase.rpc("confirm_my_transfer_with_note", { p_tx: transaction.id, p_note: approveNote.trim() });
    if (error) { setApproving(false); toast.error(error.message); return; }
    const { data: mailData, error: mailErr } = await supabase.functions.invoke("send-transaction-status-update", {
      body: { transactionId: transaction.id, status: "processing", note: approveNote.trim() || undefined },
    });
    setApproving(false);
    onChange({ ...transaction, status: "processing" });
    setApproveNote("");
    if (mailErr || (mailData as any)?.failed?.length) toast.warning("Approved, but the processing email could not be sent");
    else toast.success("Approved · moved to processing and email sent");
  };

  const openReceipt = () => {
    if (!transaction) return;
    const method = selectedMethod || SWIFT_FALLBACK;
    const fields = parseDetails(transaction.description);
    if (transaction.recipient_name && !fields.recipient_name) fields.recipient_name = transaction.recipient_name;
    if (transaction.recipient_email && !fields.email) fields.email = transaction.recipient_email;
    const txCur = currencyInfo(transaction.currency || currency.code);
    setReceipt({
      method,
      amount: (Number(transaction.amount) || 0) * txCur.rate,
      currencyCode: txCur.code,
      currencySymbol: txCur.symbol,
      senderName,
      recipientName: transaction.recipient_name || fields.recipient_name || fields.handle || "Recipient",
      recipientEmail: transaction.recipient_email || fields.email || "",
      fields,
      note: fields.note || fields.memo,
      reference: transaction.reference_number || transaction.id.slice(0, 8).toUpperCase(),
      timestamp: transaction.created_at || new Date().toISOString(),
    });
    setReturnTo(transaction);
    onClose();
  };

  return (
    <>
      <Dialog open={!!transaction} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="left-0 top-0 h-[100dvh] max-h-none w-screen max-w-none translate-x-0 translate-y-0 gap-0 rounded-none border-0 p-0 sm:rounded-none flex flex-col">
          {transaction && (
            <>
              <div className="shrink-0 border-b bg-background px-4 pb-3 pt-4 shadow-sm" data-testid="pinned-receipt">
                <div className="mx-auto w-full max-w-xl space-y-3">
                  <DialogHeader className="pr-8 text-left">
                    <div className="flex items-center gap-3">
                      {selectedMethod ? (
                        <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${selectedMethod.accent} text-lg font-bold text-white shadow-md`}>
                          {selectedMethod.glyph}
                        </div>
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
                          {transaction.transaction_type === "debit" ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}
                        </div>
                      )}
                      <div>
                        <DialogTitle className="text-secondary">{transaction.category || "Transaction"}</DialogTitle>
                        <DialogDescription>
                          Ref {transaction.reference_number || transaction.id.slice(0, 8).toUpperCase()} · {timeAgo(transaction.created_at)}
                        </DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>

                  <div className="rounded-xl border bg-muted/40 p-3">
                    <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Amount</div>
                    <div className={`text-2xl font-bold ${transaction.transaction_type === "debit" ? "text-destructive" : "text-success"}`}>
                      {transaction.transaction_type === "debit" ? "-" : "+"}{fmtTx(transaction)}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      {(() => {
                        const meta = statusMeta((transaction.status || "completed").toLowerCase(), transaction.transaction_type === "debit");
                        return (
                          <Badge variant="outline" className={`gap-1 border-transparent ${meta.pillClass}`}>
                            <meta.Icon className="h-3 w-3" /> {meta.label}
                          </Badge>
                        );
                      })()}
                    </div>
                    {(transaction.recipient_name || transaction.recipient_email) && (
                      <div className="mt-3 space-y-0.5 border-t pt-2 text-xs">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Recipient</div>
                        {transaction.recipient_name && <div className="truncate text-sm font-semibold text-secondary">{transaction.recipient_name}</div>}
                        {transaction.recipient_email && <div className="truncate text-muted-foreground">{transaction.recipient_email}</div>}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">
                <div className="mx-auto w-full max-w-xl space-y-3">
                  {transaction.transaction_type === "debit" && (
                    <TransferTracker status={transaction.status} createdAt={transaction.created_at} />
                  )}

                  {isStaff && custConfirm && (
                    <div className="space-y-1 rounded-xl border border-border bg-muted/40 p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Customer confirmed · {new Date(custConfirm.at).toLocaleString()}
                      </div>
                      <div className="whitespace-pre-wrap break-words text-sm">{custConfirm.note || "No note added"}</div>
                    </div>
                  )}
                  {isStaff && transaction.status === "pending" && (
                    <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-widest text-primary">Approve transaction</div>
                      <Textarea
                        rows={2}
                        value={approveNote}
                        onChange={(event) => setApproveNote(event.target.value)}
                        placeholder="Optional note for the customer"
                        className="text-sm"
                      />
                      <Button className="w-full gap-2" disabled={approving} onClick={approveSelected}>
                        {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Approve · move to processing
                      </Button>
                    </div>
                  )}
                  {!isStaff && transaction.status === "pending" && transaction.transaction_type === "debit" && (
                    <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-widest text-primary">Did you make this transfer?</div>
                      <p className="text-xs text-muted-foreground">Confirm it was you and it will move to processing for our team to review.</p>
                      <Textarea
                        rows={2}
                        value={approveNote}
                        onChange={(event) => setApproveNote(event.target.value)}
                        placeholder="Optional note for our team"
                        maxLength={500}
                        className="text-sm"
                      />
                      <Button className="w-full gap-2" disabled={approving} onClick={approveSelected}>
                        {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Yes, I made this transfer
                      </Button>
                    </div>
                  )}

                  <div className="space-y-1.5 text-sm">
                    <div className="rounded-md border bg-background p-3 text-xs text-muted-foreground">
                      {transaction.description}
                    </div>
                    {["purchase", "payment", "card", "merchant"].includes((transaction.category || "").toLowerCase()) && transaction.description && (
                      <TransactionMapCard query={transaction.description} />
                    )}
                    {transaction.status === "pending" && (
                      <p className="text-xs text-muted-foreground">A specialist will contact you to verify and approve this transfer.</p>
                    )}
                    {transaction.status === "processing" && (
                      <p className="text-xs text-muted-foreground">Your transfer is being processed and should complete shortly.</p>
                    )}
                    {transaction.status === "under_review" && (
                      <p className="text-xs text-muted-foreground">This transfer is under review by our compliance team. We'll update you soon.</p>
                    )}
                    {transaction.status === "compliance_hold" && (
                      <p className="text-xs text-muted-foreground">This transfer is on a temporary compliance hold. Our team is completing the required checks.</p>
                    )}
                    {transaction.status === "reviewed" && (
                      <p className="text-xs text-muted-foreground">Review is complete and clearance is now in progress.</p>
                    )}
                    {transaction.status === "posting" && (
                      <p className="text-xs text-muted-foreground">Payment successful — {postingVia(transaction.description) || "the recipient bank"} is posting the funds to the beneficiary account.</p>
                    )}
                    {transaction.status === "clearing" && (
                      <p className="text-xs text-muted-foreground">Funds are clearing with the beneficiary bank and will settle shortly.</p>
                    )}
                    {transaction.status === "failed" && (
                      <p className="text-xs text-destructive">This transfer failed. No funds were moved. Please contact support if you need help.</p>
                    )}
                    {transaction.status === "cancelled" && (
                      <p className="text-xs text-muted-foreground">This transfer was cancelled.</p>
                    )}
                  </div>

                  {related.length > 0 && (
                    <div className="rounded-xl border bg-muted/30 p-3">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Other transfers to {transaction.recipient_name}
                      </div>
                      <div className="space-y-1">
                        {related.map((item) => {
                          const isDebit = item.transaction_type === "debit";
                          const meta = statusMeta((item.status || "completed").toLowerCase(), isDebit);
                          return (
                            <button
                              key={item.id}
                              onClick={() => onSelect(item)}
                              className="flex w-full items-center justify-between gap-2 rounded-lg bg-background/70 px-2.5 py-2 text-left text-xs transition hover:bg-background"
                            >
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-secondary">{item.category || "Transfer"}</span>
                                <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${meta.pillClass}`}>
                                  {meta.label}
                                </span>
                                <span className="ml-1 text-muted-foreground">· {timeAgo(item.created_at)}</span>
                              </span>
                              <span className={`shrink-0 font-bold ${isDebit ? "text-destructive" : "text-success"}`}>
                                {isDebit ? "-" : "+"}{fmtTx(item)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="shrink-0 border-t bg-background px-4 py-3">
                <div className="mx-auto flex w-full max-w-xl justify-end gap-2">
                  <Button variant="outline" onClick={onClose}>Close</Button>
                  <Button onClick={openReceipt} className="gap-2">
                    <Receipt className="h-4 w-4" /> View receipt
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <TransferReceipt
        open={!!receipt}
        onClose={() => {
          setReceipt(null);
          if (returnTo) {
            onSelect(returnTo);
            setReturnTo(null);
          }
        }}
        receipt={receipt}
      />
    </>
  );
};
