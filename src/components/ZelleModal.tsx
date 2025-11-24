import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";

interface Account {
  id: string;
  account_name: string;
  account_number: string;
}

interface ZelleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { fromAccount: string; amount: number; contact?: string }) => void;
}

const contacts = [
  { id: "john", name: "John Smith", phone: "(555) 123-4567" },
  { id: "sarah", name: "Sarah Johnson", phone: "(555) 987-6543" },
];

export const ZelleModal = ({ isOpen, onClose, onSubmit }: ZelleModalProps) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [fromAccount, setFromAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedContact, setSelectedContact] = useState("");
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
    await new Promise(resolve => setTimeout(resolve, 1500));
    onSubmit({ fromAccount, amount: amountNum, contact: selectedContact });
    setLoading(false);
    setAmount("");
    setSelectedContact("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-secondary">Send Money with Zelle</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            {contacts.map((contact) => (
              <Card
                key={contact.id}
                className={`cursor-pointer p-3 transition-colors ${
                  selectedContact === contact.id ? "border-accent bg-accent/10" : "hover:bg-muted"
                }`}
                onClick={() => setSelectedContact(contact.id)}
              >
                <div className="font-semibold text-secondary">{contact.name}</div>
                <div className="text-sm text-muted-foreground">{contact.phone}</div>
              </Card>
            ))}
          </div>
          <div>
            <Label htmlFor="zelleFromAccount">From Account</Label>
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
            <Label htmlFor="zelleAmount">Amount</Label>
            <Input
              id="zelleAmount"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-accent hover:bg-accent/90">
            {loading ? "Sending..." : "Send with Zelle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
