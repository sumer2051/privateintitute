import { useEffect, useMemo, useState } from "react";
import { Bell, ArrowDownLeft, ArrowUpRight, Clock, CheckCircle2, Receipt } from "lucide-react";
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

export const NotificationsBell = () => {
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Notif | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [senderName, setSenderName] = useState<string>("You");
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
      .limit(15);
    const rows = (data ?? []) as Notif[];
    setItems(rows);
    const lastRead = Number(localStorage.getItem(READ_KEY) || 0);
    setUnread(rows.filter((r) => new Date(r.created_at || 0).getTime() > lastRead).length);
  };

  useEffect(() => {
    fetchItems();
    const t = setInterval(fetchItems, 20000);
    return () => clearInterval(t);
  }, []);

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
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <Badge className="absolute -right-1 -top-1 h-5 min-w-5 rounded-full p-0 text-xs flex items-center justify-center" variant="destructive">
                {unread}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-96 p-0">
          <div className="flex items-center justify-between border-b p-3">
            <div>
              <div className="font-semibold text-secondary">Notifications</div>
              <div className="text-xs text-muted-foreground">Tap a transfer to view its receipt</div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => { setOpen(false); navigate("/transfers"); }}>
              View transfers
            </Button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No notifications yet.</div>
            ) : items.map((n) => {
              const isDebit = n.transaction_type === "debit";
              const pending = n.status === "pending";
              return (
                <button
                  key={n.id}
                  onClick={() => { setOpen(false); setSelected(n); }}
                  className="flex w-full items-start gap-3 border-b p-3 text-left hover:bg-muted/40 transition"
                >
                  <div className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-full ${pending ? "bg-warning/15 text-warning" : isDebit ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
                    {pending ? <Clock className="h-4 w-4" /> : isDebit ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-secondary">{n.category || "Transaction"}</p>
                      <span className={`text-sm font-bold ${isDebit ? "text-destructive" : "text-success"}`}>
                        {isDebit ? "-" : "+"}{fmt(n.amount)}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{n.description}</p>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      {pending ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 font-semibold text-warning">
                          <Clock className="h-3 w-3" /> Pending approval
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 font-semibold text-success">
                          <CheckCircle2 className="h-3 w-3" /> Completed
                        </span>
                      )}
                      <span>· {timeAgo(n.created_at)}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {/* Notification detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
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
                  {selected.status === "pending" ? (
                    <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning gap-1"><Clock className="h-3 w-3" /> Pending approval</Badge>
                  ) : (
                    <Badge variant="outline" className="border-success/40 bg-success/10 text-success gap-1"><CheckCircle2 className="h-3 w-3" /> {selected.status || "Completed"}</Badge>
                  )}
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
                {selected.status === "pending" && (
                  <p className="text-xs text-muted-foreground">
                    A specialist will contact you to verify and approve this transfer.
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
