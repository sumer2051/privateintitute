import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/AuthLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

interface Payee {
  id: string;
  payee_name: string;
  account_number: string;
  payee_type: string;
}

const BillPay = () => {
  const [payees, setPayees] = useState<Payee[]>([]);
  const [newPayeeName, setNewPayeeName] = useState("");
  const [newPayeeAccount, setNewPayeeAccount] = useState("");
  const [newPayeeType, setNewPayeeType] = useState("utility");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPayees();
  }, []);

  const fetchPayees = async () => {
    const { data } = await supabase.from("payees").select("*").eq("is_active", true);
    if (data) setPayees(data);
  };

  const addPayee = async () => {
    if (!newPayeeName) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("payees").insert({
      user_id: user.id,
      payee_name: newPayeeName,
      account_number: newPayeeAccount,
      payee_type: newPayeeType,
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Payee Added",
        description: `${newPayeeName} has been added to your payees`,
      });
      setNewPayeeName("");
      setNewPayeeAccount("");
      setOpen(false);
      fetchPayees();
    }
  };

  const deletePayee = async (id: string) => {
    const { error } = await supabase.from("payees").update({ is_active: false }).eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Payee Removed",
        description: "Payee has been removed",
      });
      fetchPayees();
    }
  };

  return (
    <AuthLayout currentPage="billpay">
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-secondary mb-2">Bill Pay</h2>
          <p className="text-muted-foreground">Manage your payees and scheduled payments</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Payee
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Payee</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Payee Name</Label>
                <Input value={newPayeeName} onChange={(e) => setNewPayeeName(e.target.value)} placeholder="Electric Company" />
              </div>
              <div>
                <Label>Account Number</Label>
                <Input value={newPayeeAccount} onChange={(e) => setNewPayeeAccount(e.target.value)} placeholder="123456789" />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={newPayeeType} onValueChange={setNewPayeeType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="utility">Utility</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="loan">Loan</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={addPayee} className="w-full">
                Add Payee
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {payees.map((payee) => (
          <Card key={payee.id}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">{payee.payee_name}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => deletePayee(payee.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Account:</span>
                  <span className="font-medium">{payee.account_number || "N/A"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-medium capitalize">{payee.payee_type}</span>
                </div>
                <Button className="w-full mt-4" variant="secondary">
                  Pay Now
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {payees.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No payees added yet</p>
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Payee
            </Button>
          </CardContent>
        </Card>
        )}
      </div>
    </AuthLayout>
  );
};

export default BillPay;