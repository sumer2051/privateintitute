import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/AuthLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowRightLeft, Send, Building, Clock, ShieldCheck, Mail } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";

interface Account {
  id: string;
  account_name: string;
  account_number: string;
  balance: number;
}

interface PendingTx {
  id: string;
  account_id: string;
  category: string;
  description: string;
  amount: number;
  status: string | null;
  reference_number: string | null;
  created_at: string | null;
}

const genRef = (prefix: string) =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const Transfers = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [pending, setPending] = useState<PendingTx[]>([]);
  const [selectedTx, setSelectedTx] = useState<PendingTx | null>(null);

  // Internal
  const [fromAccount, setFromAccount] = useState("");
  const [toAccount, setToAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  // External
  const [extFrom, setExtFrom] = useState("");
  const [extAmount, setExtAmount] = useState("");
  const [extRecipient, setExtRecipient] = useState("");
  const [extBank, setExtBank] = useState("");
  const [extRouting, setExtRouting] = useState("");
  const [extAccountNum, setExtAccountNum] = useState("");
  const [extMemo, setExtMemo] = useState("");
  const [extLoading, setExtLoading] = useState(false);

  // Zelle
  const [zFrom, setZFrom] = useState("");
  const [zAmount, setZAmount] = useState("");
  const [zRecipient, setZRecipient] = useState("");
  const [zContact, setZContact] = useState("");
  const [zMemo, setZMemo] = useState("");
  const [zLoading, setZLoading] = useState(false);

  const { toast } = useToast();
  const { format, convert, toUsd, currency } = useCurrency();

  useEffect(() => {
    fetchAccounts();
    fetchPending();
  }, []);

  const fetchAccounts = async () => {
    const { data } = await supabase.from("accounts").select("id, account_name, account_number, balance");
    if (data) setAccounts(data);
  };

  const fetchPending = async () => {
    const { data } = await supabase
      .from("transactions")
      .select("id, account_id, category, description, amount, status, reference_number, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setPending(data as PendingTx[]);
  };

  // Balances are stored in USD; format() converts to the selected currency for display.
  const formatCurrency = (usdAmount: number) => format(usdAmount);

  const handleInternalTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromAccount || !toAccount || !amount) return;
    setLoading(true);
    try {
      const transferAmountDisplay = parseFloat(amount);
      const transferAmount = toUsd(transferAmountDisplay); // store as USD
      const fromAcc = accounts.find((a) => a.id === fromAccount);
      const toAcc = accounts.find((a) => a.id === toAccount);
      if (!fromAcc || !toAcc) throw new Error("Invalid accounts");
      if (fromAcc.balance < transferAmount) throw new Error("Insufficient funds");

      await supabase.from("accounts").update({ balance: fromAcc.balance - transferAmount }).eq("id", fromAccount);
      await supabase.from("accounts").update({ balance: toAcc.balance + transferAmount }).eq("id", toAccount);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      await supabase.from("transactions").insert([
        {
          user_id: user.id,
          account_id: fromAccount,
          transaction_type: "debit",
          category: "Transfer Out",
          description: `Transfer to ${toAcc.account_name}`,
          amount: transferAmount,
          balance_after: fromAcc.balance - transferAmount,
          status: "completed",
          reference_number: genRef("INT"),
        },
        {
          user_id: user.id,
          account_id: toAccount,
          transaction_type: "credit",
          category: "Transfer In",
          description: `Transfer from ${fromAcc.account_name}`,
          amount: transferAmount,
          balance_after: toAcc.balance + transferAmount,
          status: "completed",
          reference_number: genRef("INT"),
        },
      ]);

      toast({ title: "Transfer Successful", description: `Transferred ${formatCurrency(transferAmount)}` });
      setAmount("");
      fetchAccounts();
    } catch (error: any) {
      toast({ title: "Transfer Failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleExternalTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extFrom || !extAmount || !extRecipient || !extBank || !extAccountNum) {
      toast({ title: "Missing details", description: "Please complete all required fields.", variant: "destructive" });
      return;
    }
    const amtDisplay = parseFloat(extAmount);
    const amt = toUsd(amtDisplay);
    const fromAcc = accounts.find((a) => a.id === extFrom);
    if (!fromAcc) return;
    if (fromAcc.balance < amt) {
      toast({ title: "Insufficient funds", variant: "destructive" });
      return;
    }
    setExtLoading(true);
    try {
      const ref = genRef("EXT");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("transactions")
        .insert({
          user_id: user.id,
          account_id: extFrom,
          transaction_type: "debit",
          category: "External Transfer",
          description: `To ${extRecipient} · ${extBank} ****${extAccountNum.slice(-4)}${extMemo ? ` — ${extMemo}` : ""}`,
          amount: amt,
          balance_after: fromAcc.balance,
          status: "pending",
          reference_number: ref,
        })
        .select()
        .single();
      if (error) throw error;
      supabase.functions.invoke("send-transfer-confirmation", {
        body: {
          type: "External Transfer",
          amount: amtDisplay,
          currency: currency.code,
          recipient: extRecipient,
          detail: `${extBank} ····${extAccountNum.slice(-4)}${extMemo ? ` — ${extMemo}` : ""}`,
          reference: ref,
        },
      }).catch((e) => console.error("confirmation email failed", e));
      toast({
        title: "Transfer submitted — Pending approval",
        description: `Ref ${ref}. Confirmation email sent. Support will reach out shortly.`,
      });
      setExtAmount(""); setExtRecipient(""); setExtBank(""); setExtRouting(""); setExtAccountNum(""); setExtMemo("");
      if (data) setSelectedTx(data as PendingTx);
      fetchPending();
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    } finally {
      setExtLoading(false);
    }
  };

  const handleZelleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zFrom || !zAmount || !zRecipient || !zContact) {
      toast({ title: "Missing details", description: "Please complete all required fields.", variant: "destructive" });
      return;
    }
    const amt = parseFloat(zAmount);
    const fromAcc = accounts.find((a) => a.id === zFrom);
    if (!fromAcc) return;
    if (fromAcc.balance < amt) {
      toast({ title: "Insufficient funds", variant: "destructive" });
      return;
    }
    setZLoading(true);
    try {
      const ref = genRef("ZEL");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("transactions")
        .insert({
          user_id: user.id,
          account_id: zFrom,
          transaction_type: "debit",
          category: "Zelle",
          description: `Zelle to ${zRecipient} (${zContact})${zMemo ? ` — ${zMemo}` : ""}`,
          amount: amt,
          balance_after: fromAcc.balance,
          status: "pending",
          reference_number: ref,
        })
        .select()
        .single();
      if (error) throw error;
      supabase.functions.invoke("send-transfer-confirmation", {
        body: {
          type: "Zelle",
          amount: amt,
          recipient: zRecipient,
          detail: `${zContact}${zMemo ? ` — ${zMemo}` : ""}`,
          reference: ref,
        },
      }).catch((e) => console.error("confirmation email failed", e));
      toast({
        title: "Zelle submitted — Pending approval",
        description: `Ref ${ref}. Confirmation email sent. Support will reach out shortly.`,
      });
      setZAmount(""); setZRecipient(""); setZContact(""); setZMemo("");
      if (data) setSelectedTx(data as PendingTx);
      fetchPending();
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    } finally {
      setZLoading(false);
    }
  };

  return (
    <AuthLayout currentPage="transfers">
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div>
          <h2 className="text-3xl font-bold text-secondary mb-2">Transfers</h2>
          <p className="text-muted-foreground">Move money between your accounts, to external banks, or via Zelle</p>
        </div>

        <Tabs defaultValue="internal" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="internal"><ArrowRightLeft className="mr-2 h-4 w-4" />Between Accounts</TabsTrigger>
            <TabsTrigger value="external"><Building className="mr-2 h-4 w-4" />External Transfer</TabsTrigger>
            <TabsTrigger value="zelle"><Send className="mr-2 h-4 w-4" />Zelle</TabsTrigger>
          </TabsList>

          <TabsContent value="internal">
            <Card>
              <CardHeader><CardTitle>Transfer Between Your Accounts</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleInternalTransfer} className="space-y-4">
                  <div>
                    <Label>From Account</Label>
                    <Select value={fromAccount} onValueChange={setFromAccount}>
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {accounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.account_name} - ****{acc.account_number} ({formatCurrency(acc.balance)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>To Account</Label>
                    <Select value={toAccount} onValueChange={setToAccount}>
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {accounts.filter((a) => a.id !== fromAccount).map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>{acc.account_name} - ****{acc.account_number}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Amount</Label>
                    <Input type="number" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Processing..." : "Transfer Now"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="external">
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Building className="h-5 w-5 text-primary" />External Bank Transfer</CardTitle>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-success" />
                  Transfers to outside banks are reviewed by our support team before release.
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleExternalTransfer} className="space-y-4">
                  <div>
                    <Label>From Account</Label>
                    <Select value={extFrom} onValueChange={setExtFrom}>
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {accounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.account_name} - ****{acc.account_number} ({formatCurrency(acc.balance)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Recipient Name</Label>
                      <Input value={extRecipient} onChange={(e) => setExtRecipient(e.target.value)} placeholder="Jane Doe" />
                    </div>
                    <div>
                      <Label>Bank Name</Label>
                      <Input value={extBank} onChange={(e) => setExtBank(e.target.value)} placeholder="Chase Bank" />
                    </div>
                    <div>
                      <Label>Routing Number</Label>
                      <Input value={extRouting} onChange={(e) => setExtRouting(e.target.value)} placeholder="9 digits" inputMode="numeric" />
                    </div>
                    <div>
                      <Label>Account Number</Label>
                      <Input value={extAccountNum} onChange={(e) => setExtAccountNum(e.target.value)} placeholder="Recipient account" inputMode="numeric" />
                    </div>
                    <div>
                      <Label>Amount</Label>
                      <Input type="number" step="0.01" placeholder="0.00" value={extAmount} onChange={(e) => setExtAmount(e.target.value)} />
                    </div>
                    <div>
                      <Label>Memo (optional)</Label>
                      <Input value={extMemo} onChange={(e) => setExtMemo(e.target.value)} placeholder="Invoice #123" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={extLoading}>
                    {extLoading ? "Submitting..." : "Submit Transfer for Approval"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="zelle">
            <Card className="border-accent/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-accent" />Send Money with Zelle</CardTitle>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-success" />
                  Zelle payments are held pending approval by a support specialist.
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleZelleTransfer} className="space-y-4">
                  <div>
                    <Label>From Account</Label>
                    <Select value={zFrom} onValueChange={setZFrom}>
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {accounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.account_name} - ****{acc.account_number} ({formatCurrency(acc.balance)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Recipient Name</Label>
                      <Input value={zRecipient} onChange={(e) => setZRecipient(e.target.value)} placeholder="John Smith" />
                    </div>
                    <div>
                      <Label>Email or Phone</Label>
                      <Input value={zContact} onChange={(e) => setZContact(e.target.value)} placeholder="name@email.com or (555) 555‑5555" />
                    </div>
                    <div>
                      <Label>Amount</Label>
                      <Input type="number" step="0.01" placeholder="0.00" value={zAmount} onChange={(e) => setZAmount(e.target.value)} />
                    </div>
                    <div>
                      <Label>Memo (optional)</Label>
                      <Input value={zMemo} onChange={(e) => setZMemo(e.target.value)} placeholder="Dinner last night" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-accent hover:bg-accent/90" disabled={zLoading}>
                    {zLoading ? "Submitting..." : "Send with Zelle"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-warning" />Pending Transfers</CardTitle>
            <p className="text-sm text-muted-foreground">Tap a transfer to view its approval status.</p>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No pending transfers.</p>
            ) : (
              <div className="space-y-2">
                {pending.map((tx) => (
                  <button
                    key={tx.id}
                    onClick={() => setSelectedTx(tx)}
                    className="w-full flex items-center justify-between rounded-lg border bg-muted/40 p-4 text-left transition hover:bg-muted hover:shadow-sm"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-secondary truncate">{tx.category}</span>
                        <Badge variant="outline" className="border-warning/40 text-warning bg-warning/10">Pending</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Ref {tx.reference_number}</p>
                    </div>
                    <div className="text-right font-bold text-foreground">-{formatCurrency(Number(tx.amount))}</div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedTx} onOpenChange={(o) => !o && setSelectedTx(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              Transfer Pending Approval
            </DialogTitle>
            <DialogDescription>
              Your transfer has been received and is awaiting review by our support team.
            </DialogDescription>
          </DialogHeader>
          {selectedTx && (
            <div className="space-y-3 rounded-lg border bg-muted/40 p-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-medium">{selectedTx.category}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-semibold">{formatCurrency(Number(selectedTx.amount))}</span></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Details</span><span className="text-right">{selectedTx.description}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><span className="font-mono text-xs">{selectedTx.reference_number}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span>
                <Badge variant="outline" className="border-warning/40 text-warning bg-warning/10">Pending Approval</Badge>
              </div>
            </div>
          )}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
            <p className="font-semibold text-secondary flex items-center gap-2"><Mail className="h-4 w-4 text-primary" />Support will reach out</p>
            <p className="text-muted-foreground mt-1">
              A specialist will contact you shortly to confirm and approve this transfer. You'll receive an email
              update once the review is complete — typically within 24 hours.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => { setSelectedTx(null); window.dispatchEvent(new Event("open-ai-chat")); }}
            >
              Chat with Support
            </Button>
            <Button onClick={() => setSelectedTx(null)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AuthLayout>
  );
};

export default Transfers;
