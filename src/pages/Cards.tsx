import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/AuthLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CreditCard,
  Wallet,
  Snowflake,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Globe,
  MapPin,
  Bell,
  Copy,
  Sparkles,
  Plane,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/contexts/CurrencyContext";
import { VerifyCodeDialog } from "@/components/VerifyCodeDialog";

interface Account {
  id: string;
  account_name: string;
  account_type: string;
  account_number: string;
  balance: number;
  available_balance: number;
}

type CardKind = "debit" | "credit";

interface DerivedCard {
  id: string;
  kind: CardKind;
  brand: "Visa" | "Mastercard";
  holder: string;
  fullNumber: string;
  last4: string;
  exp: string;
  cvv: string;
  account: Account;
}

// Deterministic pseudo-random from string (so numbers are stable per account)
const seed = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
};
const digits = (s: string, n: number) => {
  let out = "";
  let x = seed(s);
  while (out.length < n) {
    x = (x * 1664525 + 1013904223) >>> 0;
    out += String(x % 10);
  }
  return out;
};
const groupCard = (n: string) => n.match(/.{1,4}/g)?.join(" ") ?? n;

const Cards = () => {
  const { toast } = useToast();
  const { format } = useCurrency();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [holder, setHolder] = useState("Card Holder");

  // Per-card state
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [frozen, setFrozen] = useState<Record<string, boolean>>({});
  const [intl, setIntl] = useState<Record<string, boolean>>({});
  const [contactless, setContactless] = useState<Record<string, boolean>>({});
  const [online, setOnline] = useState<Record<string, boolean>>({});
  const [notify, setNotify] = useState<Record<string, boolean>>({});
  const [pinDialog, setPinDialog] = useState<DerivedCard | null>(null);
  const [replaceDialog, setReplaceDialog] = useState<DerivedCard | null>(null);
  const [travelDialog, setTravelDialog] = useState<DerivedCard | null>(null);
  const [verifyState, setVerifyState] = useState<{ purpose: string; title: string; description: string; onOk: () => void } | null>(null);

  const guard = (purpose: string, title: string, description: string, onOk: () => void) => {
    setVerifyState({ purpose, title, description, onOk });
  };

  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const meta: any = userRes.user?.user_metadata || {};
      const name =
        meta.full_name ||
        meta.name ||
        (userRes.user?.email ? userRes.user.email.split("@")[0] : "Card Holder");
      setHolder(String(name).toUpperCase());

      const { data } = await supabase
        .from("accounts")
        .select("*")
        .eq("user_id", userRes.user!.id)
        .order("created_at", { ascending: true });
      setAccounts(data || []);
      setLoading(false);
    })();
  }, []);

  const cards: DerivedCard[] = useMemo(() => {
    return accounts
      .filter((a) => a.account_type === "checking" || a.account_type === "credit")
      .map((a) => {
        const kind: CardKind = a.account_type === "credit" ? "credit" : "debit";
        const brand: "Visa" | "Mastercard" =
          seed(a.id) % 2 === 0 ? "Visa" : "Mastercard";
        const num = (brand === "Visa" ? "4" : "5") + digits(a.id + "n", 15);
        const exp = `${((seed(a.id + "m") % 12) + 1)
          .toString()
          .padStart(2, "0")}/${28 + (seed(a.id + "y") % 4)}`;
        return {
          id: a.id,
          kind,
          brand,
          holder,
          fullNumber: num,
          last4: num.slice(-4),
          exp,
          cvv: digits(a.id + "c", 3),
          account: a,
        };
      });
  }, [accounts, holder]);

  const debitCards = cards.filter((c) => c.kind === "debit");
  const creditCards = cards.filter((c) => c.kind === "credit");

  const copy = (label: string, value: string) => {
    navigator.clipboard?.writeText(value);
    toast({ title: "Copied", description: `${label} copied to clipboard` });
  };

  const toggle =
    (set: React.Dispatch<React.SetStateAction<Record<string, boolean>>>, id: string, label: string) =>
    (v: boolean) => {
      set((p) => ({ ...p, [id]: v }));
      toast({ title: label, description: v ? "Enabled" : "Disabled" });
    };

  const renderCard = (c: DerivedCard) => {
    const isRevealed = !!revealed[c.id];
    const isFrozen = !!frozen[c.id];
    const gradient =
      c.kind === "credit"
        ? "from-secondary via-secondary/90 to-primary"
        : "from-primary via-primary/85 to-secondary";

    // Credit-specific numbers
    const creditLimit = 10000;
    const used = c.kind === "credit" ? Math.max(0, c.account.balance) : 0;
    const utilization = c.kind === "credit" ? Math.min(100, (used / creditLimit) * 100) : 0;

    return (
      <Card
        key={c.id}
        className="group relative overflow-hidden rounded-3xl border-border/60 bg-card/70 shadow-[0_18px_50px_-28px_hsl(var(--secondary)/0.55)] backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_28px_70px_-30px_hsl(var(--secondary)/0.6)]"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
        <CardContent className="p-0">
          {/* Physical card */}
          <div className="p-4 pb-2">
            <div
              className={`relative aspect-[1.586/1] rounded-2xl bg-gradient-to-br ${gradient} p-5 text-primary-foreground shadow-2xl overflow-hidden ring-1 ring-inset ring-white/15 transition-transform duration-500 group-hover:scale-[1.015]`}
            >
              {/* metal sheen */}
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_20%,hsl(0_0%_100%/0.18)_38%,transparent_52%)]" />
              <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-accent/25 blur-3xl" />
              <div className="absolute -bottom-14 -left-10 h-36 w-36 rounded-full bg-white/10 blur-3xl" />
              {isFrozen && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 rounded-2xl bg-secondary/80 backdrop-blur-md">
                  <Snowflake className="h-7 w-7 text-sky-300" />
                  <span className="text-sm font-semibold tracking-[0.2em] uppercase">Frozen</span>
                </div>
              )}
              <div className="relative flex h-full flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.32em] opacity-75">
                      BoA private institute
                    </p>
                    <p className="font-display text-base font-semibold tracking-wide">
                      {c.kind === "credit" ? "Platinum Credit" : "Everyday Debit"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" className="h-5 w-5 opacity-80" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M5 8a10 10 0 0 1 0 8M9.5 6a14 14 0 0 1 0 12M14 4.5A18 18 0 0 1 14 19.5" />
                    </svg>
                    <div className="h-8 w-11 rounded-md bg-gradient-to-br from-yellow-100 via-yellow-300 to-yellow-600 shadow-inner ring-1 ring-yellow-700/30" />
                  </div>
                </div>
                <div>
                  <p className="font-mono text-lg tracking-[0.22em] drop-shadow">
                    {isRevealed ? groupCard(c.fullNumber) : `•••• •••• •••• ${c.last4}`}
                  </p>
                  <div className="mt-3 flex items-end justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <p className="opacity-60 text-[9px] uppercase tracking-[0.18em]">Card Holder</p>
                      <p className="truncate font-semibold tracking-wide">{c.holder}</p>
                    </div>
                    <div>
                      <p className="opacity-60 text-[9px] uppercase tracking-[0.18em]">Expires</p>
                      <p className="font-mono">{c.exp}</p>
                    </div>
                    <div>
                      <p className="opacity-60 text-[9px] uppercase tracking-[0.18em]">CVV</p>
                      <p className="font-mono">{isRevealed ? c.cvv : "•••"}</p>
                    </div>
                    <p className="font-display text-lg italic tracking-wider">{c.brand}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Balance / limit strip */}
          <div className="px-4">
            {c.kind === "credit" ? (
              <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 backdrop-blur">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Current balance</span>
                  <span className="font-display text-lg font-bold text-secondary">{format(used)}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Available credit</span>
                  <span className="font-semibold">{format(c.account.available_balance)}</span>
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
                    <span>Utilization</span>
                    <span>{utilization.toFixed(0)}% of {format(creditLimit)}</span>
                  </div>
                  <Progress value={utilization} className="h-1.5" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl border border-border/50 bg-background/70 p-2.5">
                    <p className="text-muted-foreground">Min. payment</p>
                    <p className="font-semibold text-secondary">
                      {format(Math.max(25, used * 0.02))}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-background/70 p-2.5">
                    <p className="text-muted-foreground">Due date</p>
                    <p className="font-semibold text-secondary">
                      {new Date(Date.now() + 14 * 864e5).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 backdrop-blur">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Linked balance</span>
                  <span className="font-display text-lg font-bold text-secondary">{format(c.account.balance)}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Available to spend</span>
                  <span className="font-semibold">{format(c.account.available_balance)}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl border border-border/50 bg-background/70 p-2.5">
                    <p className="text-muted-foreground">Daily ATM limit</p>
                    <p className="font-semibold text-secondary">{format(1000)}</p>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-background/70 p-2.5">
                    <p className="text-muted-foreground">Daily purchase limit</p>
                    <p className="font-semibold text-secondary">{format(5000)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>


          {/* Quick actions */}
          <div className="grid grid-cols-4 gap-2 px-4 py-4">
            <Button
              variant="outline"
              size="sm"
              className="h-auto flex-col gap-1 rounded-xl border-border/60 bg-background/60 py-2.5 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:bg-accent/10"
              onClick={() => {
                if (isRevealed) {
                  setRevealed((p) => ({ ...p, [c.id]: false }));
                } else {
                  guard(
                    `revealing card •••• ${c.last4}`,
                    "Verify to reveal card",
                    `We emailed a 6-digit security code to unmask card •••• ${c.last4}.`,
                    () => setRevealed((p) => ({ ...p, [c.id]: true })),
                  );
                }
              }}
            >
              {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              <span className="mt-1 text-[10px]">{isRevealed ? "Hide" : "Reveal"}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-auto flex-col gap-1 rounded-xl border-border/60 bg-background/60 py-2.5 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:bg-accent/10"
              onClick={() => {
                setFrozen((p) => ({ ...p, [c.id]: !p[c.id] }));
                toast({
                  title: isFrozen ? "Card unfrozen" : "Card frozen",
                  description: isFrozen
                    ? "Transactions are re-enabled."
                    : "All new transactions are blocked.",
                });
              }}
            >
              <Snowflake className={`h-4 w-4 ${isFrozen ? "text-sky-500" : ""}`} />
              <span className="mt-1 text-[10px]">{isFrozen ? "Unfreeze" : "Freeze"}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-auto flex-col gap-1 rounded-xl border-border/60 bg-background/60 py-2.5 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:bg-accent/10"
              onClick={() =>
                guard(
                  `viewing PIN for card •••• ${c.last4}`,
                  "Verify to view PIN",
                  `We emailed a 6-digit code to display the PIN for card •••• ${c.last4}.`,
                  () => setPinDialog(c),
                )
              }
            >
              <KeyRound className="h-4 w-4" />
              <span className="mt-1 text-[10px]">PIN</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-auto flex-col gap-1 rounded-xl border-border/60 bg-background/60 py-2.5 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:bg-accent/10"
              onClick={() =>
                guard(
                  `replacing card •••• ${c.last4}`,
                  "Verify to replace card",
                  `Confirm the 6-digit code we emailed you to order a replacement for card •••• ${c.last4}.`,
                  () => setReplaceDialog(c),
                )
              }
            >
              <RefreshCw className="h-4 w-4" />
              <span className="mt-1 text-[10px]">Replace</span>
            </Button>
          </div>

          {/* Controls */}
          <div className="space-y-3 border-t border-border/60 bg-muted/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Card Controls
            </p>
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-sm">
                <Globe className="h-4 w-4 text-primary" /> International use
              </Label>
              <Switch checked={!!intl[c.id]} onCheckedChange={toggle(setIntl, c.id, "International use")} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-primary" /> Online purchases
              </Label>
              <Switch checked={online[c.id] ?? true} onCheckedChange={toggle(setOnline, c.id, "Online purchases")} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-sm">
                <Wallet className="h-4 w-4 text-primary" /> Contactless / tap
              </Label>
              <Switch
                checked={contactless[c.id] ?? true}
                onCheckedChange={toggle(setContactless, c.id, "Contactless payments")}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-sm">
                <Bell className="h-4 w-4 text-primary" /> Transaction alerts
              </Label>
              <Switch checked={notify[c.id] ?? true} onCheckedChange={toggle(setNotify, c.id, "Transaction alerts")} />
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  guard(
                    `copying card •••• ${c.last4}`,
                    "Verify to copy card number",
                    `Enter the 6-digit code we emailed to copy the full number of card •••• ${c.last4}.`,
                    () => copy("Card number", c.fullNumber),
                  )
                }
              >
                <Copy className="mr-1 h-3.5 w-3.5" /> Copy number
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setTravelDialog(c)}>
                <Plane className="mr-1 h-3.5 w-3.5" /> Travel notice
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => toast({ title: "Statement", description: "Latest statement downloaded (PDF)." })}
              >
                Statement
              </Button>
              {c.kind === "credit" && (
                <Button
                  size="sm"
                  onClick={() =>
                    toast({
                      title: "Payment scheduled",
                      description: `${format(Math.max(25, used * 0.02))} scheduled for ${new Date(
                        Date.now() + 3 * 864e5,
                      ).toLocaleDateString()}`,
                    })
                  }
                >
                  Pay card
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const emptyState = (kind: CardKind) => (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
        <Sparkles className="h-6 w-6 text-primary" />
        <p className="font-semibold">No {kind} cards yet</p>
        <p className="text-sm text-muted-foreground">
          Request a new {kind} card and it will appear here instantly.
        </p>
        <Button
          className="mt-2"
          onClick={() =>
            guard(
              `requesting a new ${kind} card`,
              "Verify to request a new card",
              "For your security, enter the 6-digit code we emailed before we submit your card request.",
              () =>
                toast({
                  title: "Request received",
                  description: `A ${kind} card request has been submitted. Support will follow up shortly.`,
                }),
            )
          }
        >
          Request {kind} card
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <AuthLayout currentPage="cards">
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-secondary via-secondary/95 to-primary p-6 text-primary-foreground shadow-[0_24px_60px_-32px_hsl(var(--secondary)/0.7)]">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/25 blur-3xl" />
          <div className="pointer-events-none absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-accent/70 to-transparent" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] opacity-70">Wallet</p>
              <h2 className="font-display text-3xl font-bold">Cards</h2>
              <p className="mt-1 max-w-md text-sm opacity-80">
                Manage your debit and credit cards — freeze, reveal, set limits, and more.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="gap-1 border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground">
                <MapPin className="h-3 w-3" /> Balances in {useCurrency().currency.code}
              </Badge>
              <Button
                variant="outline"
                className="border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={() =>
                  guard(
                    "requesting a new card",
                    "Verify to request a new card",
                    "For your security, enter the 6-digit code we emailed you before we submit a new card request.",
                    () =>
                      toast({
                        title: "New card requested",
                        description: "A specialist will contact you to complete issuance.",
                      }),
                  )
                }
              >
                + Request new card
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="h-96 rounded-3xl bg-muted animate-pulse" />
            <div className="h-96 rounded-3xl bg-muted animate-pulse" />
          </div>
        ) : (
          <Tabs defaultValue="debit" className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-full bg-muted/60 p-1 backdrop-blur md:w-[420px]">
              <TabsTrigger value="debit" className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Wallet className="mr-2 h-4 w-4" />
                Debit ({debitCards.length})
              </TabsTrigger>
              <TabsTrigger value="credit" className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <CreditCard className="mr-2 h-4 w-4" />
                Credit ({creditCards.length})
              </TabsTrigger>
            </TabsList>


            <TabsContent value="debit" className="mt-4">
              <div className="grid gap-6 md:grid-cols-2">
                {debitCards.length ? debitCards.map(renderCard) : emptyState("debit")}
              </div>
            </TabsContent>
            <TabsContent value="credit" className="mt-4">
              <div className="grid gap-6 md:grid-cols-2">
                {creditCards.length ? creditCards.map(renderCard) : emptyState("credit")}
              </div>
            </TabsContent>
          </Tabs>
        )}

        <Card className="rounded-3xl border-border/60 bg-card/70 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="font-display text-lg text-secondary">Card benefits & security</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3 text-sm">
            <div className="rounded-2xl border border-border/60 bg-muted/25 p-4 transition-all hover:-translate-y-0.5 hover:border-accent/50">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <p className="mt-2 font-semibold">Zero liability</p>
              <p className="text-muted-foreground">You're never liable for unauthorized charges.</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/25 p-4 transition-all hover:-translate-y-0.5 hover:border-accent/50">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <p className="mt-2 font-semibold">Global acceptance</p>
              <p className="text-muted-foreground">Use your card in 200+ countries and currencies.</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/25 p-4 transition-all hover:-translate-y-0.5 hover:border-accent/50">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <p className="mt-2 font-semibold">Real-time alerts</p>
              <p className="text-muted-foreground">Get instant notifications on every transaction.</p>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* PIN dialog */}
      <Dialog open={!!pinDialog} onOpenChange={(o) => !o && setPinDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Card PIN</DialogTitle>
            <DialogDescription>
              For your security, this PIN is shown once. Memorize it and close the window.
            </DialogDescription>
          </DialogHeader>
          {pinDialog && (
            <div className="rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 p-6 text-center">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                •••• {pinDialog.last4}
              </p>
              <p className="mt-2 font-mono text-4xl font-bold tracking-[0.4em] text-secondary">
                {digits(pinDialog.id + "pin", 4)}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() =>
                pinDialog &&
                toast({
                  title: "PIN change requested",
                  description: `Follow the SMS link to set a new PIN for card •••• ${pinDialog.last4}.`,
                })
              }
            >
              Change PIN
            </Button>
            <Button onClick={() => setPinDialog(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Replace dialog */}
      <Dialog open={!!replaceDialog} onOpenChange={(o) => !o && setReplaceDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Replace card</DialogTitle>
            <DialogDescription>
              A new card ending in a fresh 4-digit number will be mailed to your address on file within
              5–7 business days.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current card</span>
              <span className="font-mono">•••• {replaceDialog?.last4}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reason</span>
              <span>Lost or damaged</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fee</span>
              <span className="text-success font-semibold">Waived</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setReplaceDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast({
                  title: "Replacement ordered",
                  description: `Your new card will arrive within 5–7 business days.`,
                });
                setReplaceDialog(null);
              }}
            >
              Order replacement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Travel dialog */}
      <Dialog open={!!travelDialog} onOpenChange={(o) => !o && setTravelDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add travel notice</DialogTitle>
            <DialogDescription>
              Let us know when and where you're traveling so your card keeps working abroad.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/40 p-4 text-sm">
            Card •••• {travelDialog?.last4} · {useCurrency().currency.flag}{" "}
            {useCurrency().currency.name}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setTravelDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast({
                  title: "Travel notice added",
                  description: "Your card is ready for international use.",
                });
                setTravelDialog(null);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <VerifyCodeDialog
        open={!!verifyState}
        onOpenChange={(o) => !o && setVerifyState(null)}
        purpose={verifyState?.purpose || ""}
        title={verifyState?.title}
        description={verifyState?.description}
        onVerified={() => {
          const fn = verifyState?.onOk;
          setVerifyState(null);
          fn?.();
        }}
      />
    </AuthLayout>
  );
};

export default Cards;
