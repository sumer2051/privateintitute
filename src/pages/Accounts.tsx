import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/AuthLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Download, TrendingUp } from "lucide-react";
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
  const { toast } = useToast();

  useEffect(() => {
    fetchAccounts();
  }, []);

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

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
      <div>
        <h2 className="text-3xl font-bold text-secondary mb-2">My Accounts</h2>
        <p className="text-muted-foreground">Manage and view all your accounts</p>
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