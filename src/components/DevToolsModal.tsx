import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface DevToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddFunds: (data: { account: string; amount: number; unlimited: boolean }) => void;
}

export const DevToolsModal = ({ isOpen, onClose, onAddFunds }: DevToolsModalProps) => {
  const [amount, setAmount] = useState("1000");
  const [account, setAccount] = useState("checking");
  const [unlimited, setUnlimited] = useState(false);
  const [loading, setLoading] = useState(false);

  const quickAmounts = [1000, 5000, 10000, 50000];

  const handleSubmit = async () => {
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) return;

    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    onAddFunds({ account, amount: amountNum, unlimited });
    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-secondary">Developer Tools</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="devAmount">Amount to Add</Label>
            <Input
              id="devAmount"
              type="number"
              className="text-center text-lg font-bold"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={unlimited}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {quickAmounts.map((amt) => (
              <Button
                key={amt}
                variant="outline"
                onClick={() => !unlimited && setAmount(amt.toString())}
                disabled={unlimited}
              >
                ${amt.toLocaleString()}
              </Button>
            ))}
          </div>
          <div className="flex items-center justify-between rounded-lg bg-muted p-3">
            <Label htmlFor="unlimited" className="cursor-pointer">
              Unlimited Funds Mode
            </Label>
            <Switch
              id="unlimited"
              checked={unlimited}
              onCheckedChange={(checked) => {
                setUnlimited(checked);
                if (checked) setAmount("9999999");
                else setAmount("1000");
              }}
            />
          </div>
          <div>
            <Label htmlFor="devAccount">Select Account</Label>
            <Select value={account} onValueChange={setAccount}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="checking">Checking Account (****4582)</SelectItem>
                <SelectItem value="savings">Savings Account (****7821)</SelectItem>
                <SelectItem value="both">All Accounts</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-success hover:bg-success/90">
            {loading ? "Adding..." : "Add Funds"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
