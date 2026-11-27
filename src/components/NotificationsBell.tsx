import { useEffect, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LuxeIcon } from "@/components/LuxeIcon";
import { useUiTheme } from "@/contexts/UiThemeContext";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { useCurrency } from "@/contexts/CurrencyContext";
import { formatIn } from "@/lib/fx";
import {
  statusMeta,
  TransactionDetailsDialog,
  type TransactionDetail,
} from "@/components/TransactionDetailsDialog";

const READ_KEY = "boa.notifs.lastReadAt";

export const NotificationsBell = () => {
  const { theme: uiTheme } = useUiTheme();
  const [items, setItems] = useState<TransactionDetail[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<TransactionDetail | null>(null);
  const [limit, setLimit] = useState(40);
  const [hasMore, setHasMore] = useState(false);
  const limitRef = useRef(40);
  const listRef = useRef<HTMLDivElement | null>(null);
  const scrollPosRef = useRef(0);
  const restoringRef = useRef(false);
  const holdPosRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const { format } = useCurrency();

  const fetchItems = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: accts } = await supabase.from("accounts").select("id").eq("user_id", user.id);
    const ids = (accts ?? []).map((a) => a.id);
    if (!ids.length) return;
    const { data } = await supabase
      .from("transactions")
      .select("id, category, description, amount, transaction_type, status, reference_number, recipient_email, recipient_name, currency, created_at")
      .in("account_id", ids)
      .order("created_at", { ascending: false })
      .limit(limitRef.current);
    const rows = (data ?? []) as TransactionDetail[];
    setItems(rows);
    setHasMore(rows.length >= limitRef.current);
    const lastRead = Number(localStorage.getItem(READ_KEY) || 0);
    setUnread(rows.filter((r) => new Date(r.created_at || 0).getTime() > lastRead).length);
  };

  useEffect(() => {
    limitRef.current = limit;
    fetchItems();
    const timer = setInterval(fetchItems, 20000);
    return () => clearInterval(timer);
  }, [limit]);

  // Every time the list re-opens, put it back where the user left off.
  useEffect(() => {
    if (!open) return;
    const target = scrollPosRef.current;
    if (target <= 0) return;
    restoringRef.current = true;
    let frames = 0;
    let raf = 0;
    const tick = () => {
      const el = listRef.current;
      if (el) el.scrollTop = target;
      frames += 1;
      if (frames < 12) raf = requestAnimationFrame(tick);
      else restoringRef.current = false;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); restoringRef.current = false; };
  }, [open, items.length]);

  // A transaction opened from the list resets the list's scroll position, so the
  // position is held when it opens and put back when it closes.
  useEffect(() => {
    if (selected) return;
    const target = holdPosRef.current;
    holdPosRef.current = null;
    if (target == null || target <= 0) return;
    let frame = 0;
    let raf = 0;
    const tick = () => {
      const el = listRef.current;
      if (!el) return;
      el.scrollTop = target;
      if (++frame < 90) raf = requestAnimationFrame(tick);
      else restoringRef.current = false;
    };
    restoringRef.current = true;
    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      restoringRef.current = false;
    };
  }, [selected]);

  const markAllRead = () => {
    localStorage.setItem(READ_KEY, String(Date.now()));
    setUnread(0);
  };

  const fmtTx = (transaction: TransactionDetail) => (
    transaction.currency ? formatIn(transaction.currency, transaction.amount) : format(transaction.amount)
  );

  const timeAgo = (iso: string | null) => {
    if (!iso) return "";
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const updateTransaction = (updated: TransactionDetail) => {
    setItems((previous) => previous.map((item) => item.id === updated.id ? updated : item));
    setSelected(updated);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (value) markAllRead(); }}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`relative ${uiTheme === "luxe" && unread > 0 ? "luxe-bell-alert" : ""}`}
            aria-label="Notifications"
          >
            {uiTheme === "luxe" ? <LuxeIcon name="bell" className="h-6 w-6" /> : <Bell className="h-5 w-5" />}
            {unread > 0 && (
              <Badge className="luxe-bell-badge absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full p-0 text-xs" variant="destructive">
                {unread}
              </Badge>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent
          aria-label="Notifications"
          className="left-0 top-0 flex h-[100dvh] max-h-none w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0 sm:rounded-none"
        >
          <div className="shrink-0 border-b bg-background px-4 pb-3 pt-4 shadow-sm">
            <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-2 pr-9">
              <div className="min-w-0">
                <DialogTitle className="font-semibold text-secondary">Notifications</DialogTitle>
                <DialogDescription className="truncate text-xs text-muted-foreground">
                  Tap a transfer to view its receipt
                </DialogDescription>
              </div>
              <Button size="sm" variant="ghost" className="shrink-0" onClick={() => { setOpen(false); navigate("/transfers"); }}>
                View transfers
              </Button>
            </div>
          </div>
          <div
            ref={(element) => { listRef.current = element; }}
            onScroll={(event) => {
              if (restoringRef.current || holdPosRef.current !== null) return;
              scrollPosRef.current = (event.target as HTMLDivElement).scrollTop;
            }}
            className="flex-1 overflow-y-auto overscroll-contain px-4"
          >
            <div className="mx-auto w-full max-w-xl">
              {items.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No notifications yet.</div>
              ) : items.map((transaction) => {
                const isDebit = transaction.transaction_type === "debit";
                const status = (transaction.status || "completed").toLowerCase();
                const meta = statusMeta(status, isDebit);
                return (
                  <button
                    key={transaction.id}
                    onMouseDown={() => {
                      holdPosRef.current = listRef.current?.scrollTop ?? scrollPosRef.current;
                    }}
                    onClick={() => setSelected(transaction)}
                    className="flex w-full items-start gap-3 border-b p-3 text-left transition hover:bg-muted/40"
                  >
                    <div className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-full ${meta.iconBg}`}>
                      {meta.showTypeIcon ? (isDebit ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />) : <meta.Icon className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-secondary">{transaction.category || "Transaction"}</p>
                        <span className={`text-sm font-bold ${meta.failed ? "text-muted-foreground line-through" : isDebit ? "text-destructive" : "text-success"}`}>
                          {isDebit ? "-" : "+"}{fmtTx(transaction)}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{transaction.description}</p>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${meta.pillClass}`}>
                          <meta.Icon className="h-3 w-3" /> {meta.label}
                        </span>
                        <span>· {timeAgo(transaction.created_at)}</span>
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
                    onClick={() => setLimit((current) => current + 40)}
                  >
                    Show older activity
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <TransactionDetailsDialog
        transaction={selected}
        transactions={items}
        onClose={() => setSelected(null)}
        onSelect={setSelected}
        onChange={updateTransaction}
      />
    </>
  );
};
