import { useEffect, useState } from "react";
import { Bell, ArrowDownLeft, ArrowUpRight, Clock, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";

interface Notif {
  id: string;
  category: string | null;
  description: string | null;
  amount: number;
  transaction_type: string;
  status: string | null;
  reference_number: string | null;
  created_at: string | null;
}

const READ_KEY = "boa.notifs.lastReadAt";

export const NotificationsBell = () => {
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const fetchItems = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: accts } = await supabase.from("accounts").select("id").eq("user_id", user.id);
    const ids = (accts ?? []).map((a) => a.id);
    if (!ids.length) return;
    const { data } = await supabase
      .from("transactions")
      .select("id, category, description, amount, transaction_type, status, reference_number, created_at")
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

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const timeAgo = (iso: string | null) => {
    if (!iso) return "";
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
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
            <div className="text-xs text-muted-foreground">Recent activity & transfers</div>
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
              <div key={n.id} className="flex items-start gap-3 border-b p-3 hover:bg-muted/40 transition">
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
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};
