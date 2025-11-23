import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const transactions = [
  {
    id: 1,
    name: "Zelle Transfer - Sarah",
    description: "Money sent to Sarah Johnson",
    time: "Today, 09:45 AM",
    amount: -85.32,
  },
  {
    id: 2,
    name: "External Transfer",
    description: "Transfer to Chase Bank",
    time: "Yesterday, 02:30 PM",
    amount: -500.0,
  },
  {
    id: 3,
    name: "Mobile Deposit",
    description: "Check deposit",
    time: "2 days ago, 10:15 AM",
    amount: 1250.0,
  },
  {
    id: 4,
    name: "Bill Payment",
    description: "Electric Company",
    time: "3 days ago, 08:20 AM",
    amount: -145.67,
  },
];

export const RecentTransactions = () => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Math.abs(amount));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-2xl font-bold text-secondary">Recent Transactions</CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" placeholder="Search transactions..." className="w-full pl-10 sm:w-64" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="flex items-center justify-between rounded-lg bg-muted p-4 transition-colors hover:bg-muted/70"
            >
              <div className="flex-1">
                <h4 className="font-semibold text-secondary">{transaction.name}</h4>
                <p className="text-sm text-muted-foreground">{transaction.description}</p>
                <p className="text-xs text-muted-foreground">{transaction.time}</p>
              </div>
              <div
                className={`text-lg font-bold ${
                  transaction.amount > 0 ? "text-success" : "text-foreground"
                }`}
              >
                {transaction.amount > 0 ? "+" : "-"}
                {formatCurrency(transaction.amount)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
