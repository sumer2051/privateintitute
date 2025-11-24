import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/AuthLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowRightLeft, Send, Building } from "lucide-react";

interface Account {
  id: string;
  account_name: string;
  account_number: string;
  balance: number;
}

const Transfers = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [fromAccount, setFromAccount] = useState("");
  const [toAccount, setToAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    const { data } = await supabase.from("accounts").select("id, account_name, account_number, balance");
    if (data) setAccounts(data);
  };

  const handleInternalTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromAccount || !toAccount || !amount) return;

    setLoading(true);
    try {
      const transferAmount = parseFloat(amount);
      const fromAcc = accounts.find((a) => a.id === fromAccount);
      const toAcc = accounts.find((a) => a.id === toAccount);

      if (!fromAcc || !toAcc) throw new Error("Invalid accounts");
      if (fromAcc.balance < transferAmount) throw new Error("Insufficient funds");

      // Update balances
      await supabase.from("accounts").update({ balance: fromAcc.balance - transferAmount }).eq("id", fromAccount);
      await supabase.from("accounts").update({ balance: toAcc.balance + transferAmount }).eq("id", toAccount);

      // Create transaction records
      await supabase.from("transactions").insert([
        {
          account_id: fromAccount,
          transaction_type: "debit",
          category: "Transfer Out",
          description: `Transfer to ${toAcc.account_name}`,
          amount: transferAmount,
          balance_after: fromAcc.balance - transferAmount,
        },
        {
          account_id: toAccount,
          transaction_type: "credit",
          category: "Transfer In",
          description: `Transfer from ${fromAcc.account_name}`,
          amount: transferAmount,
          balance_after: toAcc.balance + transferAmount,
        },
      ]);

      toast({
        title: "Transfer Successful",
        description: `Transferred $${transferAmount.toFixed(2)}`,
      });

      setAmount("");
      fetchAccounts();
    } catch (error: any) {
      toast({
        title: "Transfer Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout currentPage="transfers">
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h2 className="text-3xl font-bold text-secondary mb-2">Transfers</h2>
        <p className="text-muted-foreground">Transfer money between accounts or to external recipients</p>
      </div>

      <Tabs defaultValue="internal" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="internal">
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Between Accounts
          </TabsTrigger>
          <TabsTrigger value="external">
            <Building className="mr-2 h-4 w-4" />
            External Transfer
          </TabsTrigger>
          <TabsTrigger value="zelle">
            <Send className="mr-2 h-4 w-4" />
            Zelle
          </TabsTrigger>
        </TabsList>

        <TabsContent value="internal">
          <Card>
            <CardHeader>
              <CardTitle>Transfer Between Your Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInternalTransfer} className="space-y-4">
                <div>
                  <Label htmlFor="from">From Account</Label>
                  <Select value={fromAccount} onValueChange={setFromAccount}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.account_name} - ****{acc.account_number} (${acc.balance.toFixed(2)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="to">To Account</Label>
                  <Select value={toAccount} onValueChange={setToAccount}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.filter((a) => a.id !== fromAccount).map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.account_name} - ****{acc.account_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Processing..." : "Transfer Now"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="external">
          <Card>
            <CardHeader>
              <CardTitle>External Bank Transfer</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">External transfer functionality coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="zelle">
          <Card>
            <CardHeader>
              <CardTitle>Send Money with Zelle</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Zelle transfer functionality coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>
        </Tabs>
      </div>
    </AuthLayout>
  );
};

export default Transfers;