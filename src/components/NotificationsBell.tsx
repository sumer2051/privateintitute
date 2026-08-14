import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, ArrowDownLeft, ArrowUpRight, Clock, CheckCircle2, Receipt, XCircle, AlertTriangle, Loader2, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { useCurrency } from "@/contexts/CurrencyContext";
import { TransactionMapCard } from "@/components/TransactionMapCard";
import { COUNTRY_METHODS, SWIFT_FALLBACK, type CountryMethod } from "@/lib/country-methods";
import { TransferReceipt, type ReceiptData } from "@/components/TransferReceipt";

interface Notif {
  id: string;
  category: string | null;
  description: string | null;
  amount: number;
  transaction_type: string;
  status: string | null;
  reference_number: string | null;
  recipient_email: string | null;
  recipient_name: string | null;
  created_at: string | null;
}

const READ_KEY = "boa.notifs.lastReadAt";

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

const parseDetails = (desc?: string | null): Record<string, string> => {
  if (!desc) return {};
  // Strip leading "[Method] To Name — "
  const cleaned = desc.replace(/^\[[^\]]+\]\s*To\s*[^—]+—\s*/i, "");
  const out: Record<string, string> = {};
  cleaned.split(" · ").forEach((pair) => {
    const idx = pair.indexOf(":");
    if (idx > 0) {
      const k = pair.slice(0, idx).trim().toLowerCase().replace(/\s+/g, "_");
      const v = pair.slice(idx + 1).trim();
      if (k && v) out[k] = v;
    }
  });
  return out;
};

const statusMeta = (status: string, isDebit: boolean) => {
  switch (status) {
    case "pending":
      return { Icon: Clock, label: "Pending approval", pillClass: "bg-warning/15 text-warning", iconBg: "bg-warning/15 text-warning", showTypeIcon: false, failed: false };
    case "processing":
      return { Icon: Loader2, label: "Processing", pillClass: "bg-primary/10 text-primary", iconBg: "bg-primary/10 text-primary", showTypeIcon: false, failed: false };
    case "under_review":
      return { Icon: AlertTriangle, label: "Under review", pillClass: "bg-amber-500/15 text-amber-600", iconBg: "bg-amber-500/15 text-amber-600", showTypeIcon: false, failed: false };
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

export const NotificationsBell = () => {
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Notif | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [senderName, setSenderName] = useState<string>("You");
  const [limit, setLimit] = useState(40);
  const [hasMore, setHasMore] = useState(false);
  const limitRef = useRef(40);
  const navigate = useNavigate();
  const { format, currency } = useCurrency();

  const fetchItems = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    if (prof?.full_name) setSenderName(prof.full_name);
    const { data: accts } = await supabase.from("accounts").select("id").eq("user_id", user.id);
    const ids = (accts ?? []).map((a) => a.id);
    if (!ids.length) return;
    const { data } = await supabase
      .from("transactions")
      .select("id, category, description, amount, transaction_type, status, reference_number, recipient_email, recipient_name, created_at")
      .in("account_id", ids)
      .order("created_at", { ascending: false })
      .limit(limitRef.current);
    const rows = (data ?? []) as Notif[];
    setItems(rows);
    setHasMore(rows.length >= limitRef.current);
    const lastRead = Number(localStorage.getItem(READ_KEY) || 0);
    setUnread(rows.filter((r) => new Date(r.created_at || 0).getTime() > lastRead).length);
  };

  useEffect(() => {
    limitRef.current = limit;
    fetchItems();
    const t = setInterval(fetchItems, 20000);
    return () => clearInterval(t);
  }, [limit]);

  const markAllRead = () => {
    localStorage.setItem(READ_KEY, String(Date.now()));
    setUnread(0);
  };

  const fmt = (n: number) => format(n);

  const timeAgo = (iso: string | null) => {
    if (!iso) return "";
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const selectedMethod = useMemo(() => findMethod(selected?.category), [selected]);

  const openReceipt = () => {
    if (!selected) return;
    const method = selectedMethod || SWIFT_FALLBACK;
    const fields = parseDetails(selected.description);
    if (selected.recipient_name && !fields.recipient_name) fields.recipient_name = selected.recipient_name;
    if (selected.recipient_email && !fields.email) fields.email = selected.recipient_email;
    setReceipt({
      method,
      amount: selected.amount,
      currencyCode: currency.code,
      currencySymbol: currency.symbol,
      senderName,
      recipientName: selected.recipient_name || fields.recipient_name || fields.handle || "Recipient",
      recipientEmail: selected.recipient_email || fields.email || "",
      fields,
      note: fields.note || fields.memo,
      reference: selected.reference_number || selected.id.slice(0, 8).toUpperCase(),
      timestamp: selected.created_at || new Date().toISOString(),
    });
    setSelected(null);
  };

  return (
    <>
      <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) markAllRead(); }}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
            {uiTheme === "luxe" ? <LuxeIcon name="bell" className="h-6 w-6" /> : <Bell className="h-5 w-5" />}

            {unread > 0 && (
              <Badge className="absolute -right-1 -top-1 h-5 min-w-5 rounded-full p-0 text-xs flex items-center justify-center" variant="destructive">
                {unread}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={8}
          collisionPadding={8}
          className="w-[calc(100vw-1rem)] sm:w-96 max-w-[26rem] p-0 overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2 border-b p-3">
            <div className="min-w-0">
              <div className="font-semibold text-secondary">Notifications</div>
              <div className="text-xs text-muted-foreground truncate">Tap a transfer to view its receipt</div>
            </div>
            <Button size="sm" variant="ghost" className="shrink-0" onClick={() => { setOpen(false); navigate("/transfers"); }}>
              View transfers
            </Button>
          </div>
          <div className="max-h-[min(70vh,26rem)] overflow-y-auto overscroll-contain">
            {items.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No notifications yet.</div>
            ) : items.map((n) => {
              const isDebit = n.transaction_type === "debit";
              const status = (n.status || "completed").toLowerCase();
              const meta = statusMeta(status, isDebit);
              return (
                <button
                  key={n.id}
                  onClick={() => { setOpen(false); setSelected(n); }}
                  className="flex w-full items-start gap-3 border-b p-3 text-left hover:bg-muted/40 transition"
                >
                  <div className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-full ${meta.iconBg}`}>
                    {meta.showTypeIcon ? (isDebit ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />) : <meta.Icon className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-secondary">{n.category || "Transaction"}</p>
                      <span className={`text-sm font-bold ${meta.failed ? "text-muted-foreground line-through" : isDebit ? "text-destructive" : "text-success"}`}>
                        {isDebit ? "-" : "+"}{fmt(n.amount)}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{n.description}</p>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${meta.pillClass}`}>
                        <meta.Icon className="h-3 w-3" /> {meta.label}
                      </span>
                      <span>· {timeAgo(n.created_at)}</span>
                    </div>
                  </div>
                </button>
              );
            })}
            {hasMore && (
              <div className="p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => setLimit((l) => l + 40)}
                >
                  Show older activity
                </Button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Notification detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-md max-h-[90dvh] overflow-y-auto overscroll-contain p-4 sm:p-6">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  {selectedMethod ? (
                    <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${selectedMethod.accent} text-white flex items-center justify-center font-bold text-lg shadow-md`}>
                      {selectedMethod.glyph}
                    </div>
                  ) : (
                    <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center">
                      {selected.transaction_type === "debit" ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}
                    </div>
                  )}
                  <div>
                    <DialogTitle className="text-secondary">{selected.category || "Transaction"}</DialogTitle>
                    <DialogDescription>
                      Ref {selected.reference_number || selected.id.slice(0, 8).toUpperCase()} · {timeAgo(selected.created_at)}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="rounded-xl border bg-muted/40 p-4">
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Amount</div>
                <div className={`text-3xl font-bold ${selected.transaction_type === "debit" ? "text-destructive" : "text-success"}`}>
                  {selected.transaction_type === "debit" ? "-" : "+"}{fmt(selected.amount)}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  {(() => {
                    const m = statusMeta((selected.status || "completed").toLowerCase(), selected.transaction_type === "debit");
                    return (
                      <Badge variant="outline" className={`gap-1 border-transparent ${m.pillClass}`}>
                        <m.Icon className="h-3 w-3" /> {m.label}
                      </Badge>
                    );
                  })()}
                </div>
              </div>

              <div className="space-y-1.5 text-sm">
                {selected.recipient_name && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Recipient</span><span className="font-medium">{selected.recipient_name}</span></div>
                )}
                {selected.recipient_email && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-medium">{selected.recipient_email}</span></div>
                )}
                <div className="rounded-md border bg-background p-3 text-xs text-muted-foreground">
                  {selected.description}
                </div>
                {["purchase", "payment", "card", "merchant"].includes((selected.category || "").toLowerCase()) && selected.description && (
                  <TransactionMapCard query={selected.description} />
                )}
                {selected.status === "pending" && (
                  <p className="text-xs text-muted-foreground">
                    A specialist will contact you to verify and approve this transfer.
                  </p>
                )}
                {selected.status === "processing" && (
                  <p className="text-xs text-muted-foreground">
                    Your transfer is being processed and should complete shortly.
                  </p>
                )}
                {selected.status === "under_review" && (
                  <p className="text-xs text-muted-foreground">
                    This transfer is under review by our compliance team. We'll update you soon.
                  </p>
                )}
                {selected.status === "failed" && (
                  <p className="text-xs text-destructive">
                    This transfer failed. No funds were moved. Please contact support if you need help.
                  </p>
                )}
                {selected.status === "cancelled" && (
                  <p className="text-xs text-muted-foreground">
                    This transfer was cancelled.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
                <Button onClick={openReceipt} className="gap-2">
                  <Receipt className="h-4 w-4" /> View receipt
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <TransferReceipt open={!!receipt} onClose={() => setReceipt(null)} receipt={receipt} />
    </>
  );
};
