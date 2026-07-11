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
  const { toast } = useToast();

  useEffect(() => {
    fetchAccounts();
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      const meta: any = u.user_metadata || {};
      const name = meta.full_name || meta.name || meta.first_name || (u.email ? u.email.split("@")[0] : "");
      setDisplayName(name);
      setAvatarUrl(meta.avatar_url || meta.picture || "");
    });
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
      setLoading(false);
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
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4">
        <div className="rounded-xl border bg-card p-3 md:p-4 shadow-sm">
          <p className="text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground">Deposits</p>
          <p className="mt-1 font-display text-base md:text-2xl font-bold text-success truncate">
            {formatCurrency(
              accounts.filter((a) => a.account_type !== "credit").reduce((sum, a) => sum + a.balance, 0)
            )}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-3 md:p-4 shadow-sm">
          <p className="text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground">Credit Used</p>
          <p className="mt-1 font-display text-base md:text-2xl font-bold text-destructive truncate">
            {formatCurrency(
              accounts.filter((a) => a.account_type === "credit").reduce((sum, a) => sum + a.balance, 0)
            )}
          </p>
        </div>
        <div className="col-span-2 md:col-span-1 rounded-xl border bg-gradient-to-br from-primary/10 to-accent/10 p-3 md:p-4 shadow-sm">
          <p className="text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground">Net Worth</p>
          <p className="mt-1 font-display text-lg md:text-2xl font-bold text-secondary truncate">
            {formatCurrency(
              accounts.filter((a) => a.account_type !== "credit").reduce((sum, a) => sum + a.balance, 0) -
                accounts.filter((a) => a.account_type === "credit").reduce((sum, a) => sum + a.balance, 0)
            )}
          </p>
        </div>
      </div>

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
                    {formatCurrency(account.balance)}
                  </p>
                </div>
                {account.account_type !== "credit" && (
                  <div>
                    <p className="text-[11px] md:text-sm text-muted-foreground">Available</p>
                    <p className="text-base md:text-xl font-semibold text-foreground">
                      {formatCurrency(account.available_balance)}
                    </p>
                  </div>
                )}
                <div className="flex gap-2 pt-2 md:pt-4">
                  <Button size="sm" variant="secondary" className="flex-1 h-9 text-xs md:text-sm">
                    <ArrowUpDown className="mr-1 h-4 w-4" />
                    Transfer
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 h-9 text-xs md:text-sm">
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
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Deposits</span>
              <span className="font-semibold text-success">
                {formatCurrency(
                  accounts
                    .filter((a) => a.account_type !== "credit")
                    .reduce((sum, a) => sum + a.balance, 0)
                )}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Credit Balance</span>
              <span className="font-semibold text-destructive">
                {formatCurrency(accounts.filter((a) => a.account_type === "credit").reduce((sum, a) => sum + a.balance, 0))}
              </span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t">
              <span className="font-semibold text-secondary">Net Worth</span>
              <span className="text-lg md:text-xl font-bold text-secondary">
                {formatCurrency(
                  accounts.filter((a) => a.account_type !== "credit").reduce((sum, a) => sum + a.balance, 0) -
                    accounts.filter((a) => a.account_type === "credit").reduce((sum, a) => sum + a.balance, 0)
                )}
              </span>
            </div>
          </div>
        </CardContent>
        </Card>
      </div>
        </>
      )}
    </AuthLayout>

  );
};

export default Accounts;