import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/AuthLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowUpDown, Download, TrendingUp, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/15 via-accent/10 to-transparent p-6 shadow-sm">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <Avatar className="h-16 w-16 ring-2 ring-primary/40 shadow-md">
            <AvatarImage src={avatarUrl} alt={displayName} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-display text-xl font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> {greeting}
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-secondary leading-tight">
              Welcome back{displayName ? <>, <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{displayName}</span></> : ""}
            </h2>
            <p className="text-sm text-muted-foreground italic">"Your wealth, curated with precision."</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {accounts.map((account) => (
          <Card key={account.id} className="overflow-hidden">
            <CardHeader className="bg-gradient-to-br from-primary/10 to-primary/5">
              <CardTitle className="flex items-center justify-between">
                <span className="text-lg">{account.account_name}</span>
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {account.account_type}
                </span>
              </CardTitle>
              <p className="text-sm text-muted-foreground">****{account.account_number}</p>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Current Balance</p>
                  <p className="text-3xl font-bold text-secondary">{formatCurrency(account.balance)}</p>
                </div>
                {account.account_type !== "credit" && (
                  <div>
                    <p className="text-sm text-muted-foreground">Available Balance</p>
                    <p className="text-xl font-semibold text-foreground">
                      {formatCurrency(account.available_balance)}
                    </p>
                  </div>
                )}
                <div className="flex gap-2 pt-4">
                  <Button size="sm" variant="secondary" className="flex-1">
                    <ArrowUpDown className="mr-1 h-4 w-4" />
                    Transfer
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1">
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Account Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Total Deposits</span>
              <span className="font-semibold text-success">
                {formatCurrency(
                  accounts
                    .filter((a) => a.account_type !== "credit")
                    .reduce((sum, a) => sum + a.balance, 0)
                )}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Credit Balance</span>
              <span className="font-semibold text-destructive">
                {formatCurrency(accounts.filter((a) => a.account_type === "credit").reduce((sum, a) => sum + a.balance, 0))}
              </span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t">
              <span className="font-semibold text-secondary">Net Worth</span>
              <span className="text-xl font-bold text-secondary">
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