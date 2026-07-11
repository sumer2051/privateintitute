import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/AuthLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowUpDown, Download, TrendingUp, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/contexts/CurrencyContext";
import { CountUp } from "@/components/CountUp";
import { TransferModal } from "@/components/TransferModal";

interface Account {
  id: string;
  account_name: string;
  account_type: string;
  account_number: string;
  balance: number;
  available_balance: number;
}

const Accounts = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [transferOpen, setTransferOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchAccounts();
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (!u) return;
      const meta: any = u.user_metadata || {};
      const name = meta.full_name || meta.name || meta.first_name || (u.email ? u.email.split("@")[0] : "");
      setDisplayName(name);
      let url = meta.avatar_url || meta.picture || "";
      const { data: prof } = await supabase
        .from("profiles")
        .select("avatar_url, full_name")
        .eq("id", u.id)
        .maybeSingle();
      if (prof) {
        if ((prof as any).full_name) setDisplayName((prof as any).full_name);
        const path = (prof as any).avatar_url as string | undefined;
        if (path) {
          const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60);
          if (signed?.signedUrl) url = signed.signedUrl;
        }
      }
      setAvatarUrl(url);
    })();
  }, []);

  const initials = displayName
    ? displayName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  const fetchAccounts = async () => {
    const start = Date.now();
    try {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 1500 - elapsed);
      setTimeout(() => setLoading(false), remaining);
    }
  };

  const { format } = useCurrency();
  const formatCurrency = (amount: number) => format(amount);

  return (
    <AuthLayout currentPage="accounts">
      {loading ? (
        <div className="space-y-6 animate-pulse">
          <div className="h-10 w-64 rounded bg-muted" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-56 rounded-lg bg-muted" />
            ))}
          </div>
        </div>
      ) : (
        <>

      <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/15 via-accent/10 to-transparent p-4 md:p-6 shadow-sm">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex items-center gap-3 md:gap-4">
          <Avatar className="h-12 w-12 md:h-16 md:w-16 ring-2 ring-primary/40 shadow-md shrink-0">
            <AvatarImage src={avatarUrl} alt={displayName} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-display text-base md:text-xl font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] md:text-xs uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> {greeting}
            </p>
            <h2 className="font-display text-lg md:text-4xl font-bold text-secondary leading-tight truncate">
              Welcome back{displayName ? <>, <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{displayName}</span></> : ""}
            </h2>
            <p className="hidden md:block text-sm text-muted-foreground italic">"Your wealth, curated with precision."</p>
          </div>
        </div>
      </div>

      {/* Net worth quick strip — always visible on mobile */}
      {(() => {
        const deposits = accounts.filter((a) => a.account_type !== "credit").reduce((s, a) => s + a.balance, 0);
        const credit = accounts.filter((a) => a.account_type === "credit").reduce((s, a) => s + a.balance, 0);
        const net = deposits - credit;
        return (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4">
            <div className="rounded-xl border bg-card p-3 md:p-4 shadow-sm">
              <p className="text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground">Deposits</p>
              <p className="mt-1 font-display text-base md:text-2xl font-bold text-success truncate">
                <CountUp value={deposits} format={formatCurrency} />
              </p>
            </div>
            <div className="rounded-xl border bg-card p-3 md:p-4 shadow-sm">
              <p className="text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground">Credit Used</p>
              <p className="mt-1 font-display text-base md:text-2xl font-bold text-destructive truncate">
                <CountUp value={credit} format={formatCurrency} />
              </p>
            </div>
            <div className="col-span-2 md:col-span-1 rounded-xl border bg-gradient-to-br from-primary/10 to-accent/10 p-3 md:p-4 shadow-sm">
              <p className="text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground">Net Worth</p>
              <p className="mt-1 font-display text-lg md:text-2xl font-bold text-secondary truncate">
                <CountUp value={net} format={formatCurrency} />
              </p>
            </div>
          </div>
        );
      })()}

      <div className="grid gap-3 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
        {accounts.map((account) => (
          <Card key={account.id} className="overflow-hidden transition-all hover:shadow-md">
            <CardHeader className="bg-gradient-to-br from-primary/10 to-primary/5 p-4 md:p-6">
              <CardTitle className="flex items-center justify-between gap-2">
                <span className="text-base md:text-lg truncate">{account.account_name}</span>
                <span className="text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground shrink-0">
                  {account.account_type}
                </span>
              </CardTitle>
              <p className="text-xs md:text-sm text-muted-foreground">****{account.account_number}</p>
            </CardHeader>
            <CardContent className="p-4 md:p-6 md:pt-6">
              <div className="space-y-3 md:space-y-4">
                <div>
                  <p className="text-[11px] md:text-sm text-muted-foreground">Current Balance</p>
                  <p className="font-display text-2xl md:text-3xl font-bold text-secondary tracking-tight">
                    <CountUp value={account.balance} format={formatCurrency} />
                  </p>
                </div>
                {account.account_type !== "credit" && (
                  <div>
                    <p className="text-[11px] md:text-sm text-muted-foreground">Available</p>
                    <p className="text-base md:text-xl font-semibold text-foreground">
                      <CountUp value={account.available_balance} format={formatCurrency} />
                    </p>
                  </div>
                )}
                <div className="flex gap-2 pt-2 md:pt-4">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1 h-9 text-xs md:text-sm transition-transform hover:scale-[1.03] hover:shadow-md"
                    onClick={() => setTransferOpen(true)}
                  >
                    <ArrowUpDown className="mr-1 h-4 w-4" />
                    Transfer
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-9 text-xs md:text-sm transition-transform hover:scale-[1.03] hover:shadow-md"
                    onClick={() =>
                      toast({
                        title: "Statement ready",
                        description: `${account.account_name} statement download started.`,
                      })
                    }
                  >
                    <Download className="mr-1 h-4 w-4" />
                    Statement
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <TrendingUp className="h-5 w-5" />
            Account Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0 md:pt-0">
          {(() => {
            const deposits = accounts.filter((a) => a.account_type !== "credit").reduce((s, a) => s + a.balance, 0);
            const credit = accounts.filter((a) => a.account_type === "credit").reduce((s, a) => s + a.balance, 0);
            const net = deposits - credit;
            return (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Deposits</span>
                  <span className="font-semibold text-success">
                    <CountUp value={deposits} format={formatCurrency} />
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Credit Balance</span>
                  <span className="font-semibold text-destructive">
                    <CountUp value={credit} format={formatCurrency} />
                  </span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t">
                  <span className="font-semibold text-secondary">Net Worth</span>
                  <span className="text-lg md:text-xl font-bold text-secondary">
                    <CountUp value={net} format={formatCurrency} />
                  </span>
                </div>
              </div>
            );
          })()}
        </CardContent>
        </Card>
      </div>
        </>
      )}
      <TransferModal
        isOpen={transferOpen}
        onClose={() => setTransferOpen(false)}
        onSubmit={async ({ fromAccount, amount }) => {
          const from = accounts.find((a) => a.id === fromAccount);
          if (from) {
            await supabase.from("accounts").update({ balance: from.balance - amount }).eq("id", fromAccount);
            fetchAccounts();
          }
          setTransferOpen(false);
          toast({ title: "Transfer submitted", description: `${formatCurrency(amount)} is pending approval.` });
        }}
      />
    </AuthLayout>

  );
};

export default Accounts;