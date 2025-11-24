import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Account {
  id: string;
  account_name: string;
  account_number: string;
}

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { fromAccount: string; amount: number; recipientName: string; bankName: string; accountNumber: string }) => void;
}

export const TransferModal = ({ isOpen, onClose, onSubmit }: TransferModalProps) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [fromAccount, setFromAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchAccounts();
    }
  }, [isOpen]);

  const fetchAccounts = async () => {
    const { data } = await supabase.from("accounts").select("id, account_name, account_number").eq("is_active", true);
    if (data) {
      setAccounts(data);
      if (data.length > 0) setFromAccount(data[0].id);
    }
  };

  const handleSubmit = async () => {
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) return;

    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    onSubmit({ fromAccount, amount: amountNum, recipientName, bankName, accountNumber });
    setLoading(false);
    setAmount("");
    setRecipientName("");
    setBankName("");
    setAccountNumber("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-secondary">External Transfer</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="fromAccount">From Account</Label>
            <Select value={fromAccount} onValueChange={setFromAccount}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.account_name} (****{acc.account_number})
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
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="recipientName">Recipient Name</Label>
            <Input
              id="recipientName"
              placeholder="Full name"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="bankName">Bank Name</Label>
            <Input
              id="bankName"
              placeholder="Bank name"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="accountNumber">Account Number</Label>
            <Input
              id="accountNumber"
              placeholder="Account number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Sending..." : "Send Transfer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
