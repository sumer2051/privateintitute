import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ArrowRightLeft, Send } from "lucide-react";

interface AccountCardProps {
  name: string;
  balance: number;
  accountNumber: string;
  type: "checking" | "savings" | "credit";
}

export const AccountCard = ({ name, balance, accountNumber, type }: AccountCardProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <Card className="group overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-semibold text-secondary">{name}</h3>
          <div className="text-right">
            <div className="text-2xl font-bold text-foreground">{formatCurrency(balance)}</div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">**** {accountNumber}</p>
      </CardHeader>
      <CardContent className="flex gap-2">
        {type !== "credit" ? (
          <>
            <Button variant="secondary" size="sm" className="flex-1">
              <ArrowRightLeft className="mr-1 h-4 w-4" />
              Transfer
            </Button>
            <Button 
              size="sm" 
              className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Send className="mr-1 h-4 w-4" />
              Zelle
            </Button>
          </>
        ) : (
          <Button variant="default" size="sm" className="flex-1">
            Pay Bill
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
