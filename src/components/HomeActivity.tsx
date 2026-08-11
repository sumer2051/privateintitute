import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  CreditCard,
  Receipt,
  Search,
} from "lucide-react";
import { Money } from "@/components/Money";
import { useCurrency } from "@/contexts/CurrencyContext";

interface Tx {
  id: string;
  account_id: string;
  transaction_type: string;
  category: string;
  description: string;
  amount: number;
  balance_after: number;
  status: string | null;
  reference_number: string | null;
  created_at: string;
  recipient_name: string | null;
  recipient_email: string | null;
}

const PAGE = 12;

const statusTone = (status?: string | null) => {
  const s = (status || "completed").toLowerCase();
  if (s.includes("fail") || s.includes("cancel")) return "bg-destructive/10 text-destructive border-destructive/20";
  if (s.includes("pending") || s.includes("processing") || s.includes("review"))
    return "bg-accent/10 text-accent border-accent/20";
  return "bg-success/10 text-success border-success/20";
};

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Today";
  if (same(d, yest)) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
};

export const HomeActivity = ({ accountNames }: { accountNames: Record<string, string> }) => {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(PAGE);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Tx | null>(null);
  const { format } = useCurrency();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);
      setTxs((data as any) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return txs;
    return txs.filter(
      (t) =>
        t.description?.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q) ||
        t.recipient_name?.toLowerCase().includes(q) ||
        t.reference_number?.toLowerCase().includes(q),
    );
  }, [txs, query]);

  const visible = filtered.slice(0, limit);

  const groups = useMemo(() => {
    const map: { label: string; items: Tx[] }[] = [];
    visible.forEach((t) => {
      const label = dayLabel(t.created_at);
      const last = map[map.length - 1];
      if (last && last.label === label) last.items.push(t);
      else map.push({ label, items: [t] });
    });
    return map;
  }, [visible]);

  const iconFor = (t: Tx) => {
    const credit = t.amount > 0;
    if (t.category?.toLowerCase().includes("card")) return <CreditCard className="h-4 w-4" />;
    return credit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />;
  };

  return (
    <Card className="rounded-2xl border border-primary/15 bg-card/60 backdrop-blur-md shadow-sm overflow-hidden">
      <CardHeader className="p-4 md:p-6 bg-primary/10 backdrop-blur-md border-b border-primary/15">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Receipt className="h-5 w-5 text-primary" />
            Recent Activity
          </CardTitle>
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search activity"
              className="h-9 rounded-xl bg-card/80 pl-9 text-sm"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-2 p-4 md:p-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No activity to show yet.
          </div>
        ) : (
          <>
            {groups.map((g) => (
              <div key={g.label}>
                <div className="sticky top-0 z-10 border-y border-border/60 bg-muted/60 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-sm md:px-6">
                  {g.label}
                </div>
                <ul className="divide-y divide-border/60">
                  {g.items.map((t) => {
                    const credit = t.amount > 0;
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(t)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-primary/5 active:bg-primary/10 md:px-6"
                        >
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                              credit ? "bg-success/10 text-success" : "bg-primary/10 text-primary"
                            }`}
                          >
                            {iconFor(t)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-secondary">
                              {t.recipient_name || t.description}
                            </span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                              <span className="truncate">
                                {accountNames[t.account_id] || t.category}
                              </span>
                              {t.status && t.status.toLowerCase() !== "completed" && (
                                <Badge
                                  variant="outline"
                                  className={`h-4 rounded-full px-1.5 text-[9px] font-semibold uppercase tracking-wide ${statusTone(t.status)}`}
                                >
                                  <Clock className="mr-0.5 h-2.5 w-2.5" />
                                  {t.status}
                                </Badge>
                              )}
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <Money
                              value={Math.abs(t.amount)}
                              size="sm"
                              className={credit ? "text-success" : "text-foreground"}
                            />
                            <span className="mt-0.5 block text-[10px] text-muted-foreground">
                              {new Date(t.created_at).toLocaleTimeString(undefined, {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {filtered.length > limit && (
              <div className="p-4 md:p-6">
                <Button
                  variant="outline"
                  className="h-10 w-full rounded-xl text-xs font-semibold"
                  onClick={() => setLimit((l) => l + PAGE)}
                >
                  Show more activity
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">Transaction details</DialogTitle>
            <DialogDescription className="text-xs">
              {selected ? new Date(selected.created_at).toLocaleString() : ""}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 text-center">
                <Money
                  value={Math.abs(selected.amount)}
                  size="xl"
                  className={selected.amount > 0 ? "text-success" : "text-secondary"}
                />
                <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                  {selected.amount > 0 ? "Credit" : "Debit"} · {selected.status || "completed"}
                </p>
              </div>
              {[
                ["Description", selected.description],
                ["Recipient", selected.recipient_name || "—"],
                ["Account", accountNames[selected.account_id] || "—"],
                ["Category", selected.category],
                ["Type", selected.transaction_type],
                ["Reference", selected.reference_number || "—"],
                ["Balance after", format(selected.balance_after)],
              ].map(([k, v]) => (
                <div key={k as string} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="max-w-[60%] break-words text-right font-medium text-secondary">
                    {v as string}
                  </span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
