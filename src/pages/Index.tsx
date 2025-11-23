import { Header } from "@/components/Header";
import { AccountCard } from "@/components/AccountCard";
import { QuickActions } from "@/components/QuickActions";
import { RecentTransactions } from "@/components/RecentTransactions";

const Index = () => {
  const accounts = [
    { name: "Checking Account", balance: 4582.75, accountNumber: "4582", type: "checking" as const },
    { name: "Savings Account", balance: 12350.2, accountNumber: "7821", type: "savings" as const },
    { name: "Credit Card", balance: 1245.5, accountNumber: "3098", type: "credit" as const },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h2 className="mb-2 text-3xl font-bold text-secondary">Account Overview</h2>
          <p className="text-muted-foreground">View your account balances and recent activity</p>
        </div>

        <div className="space-y-8">
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
            <QuickActions />
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            {accounts.map((account, index) => (
              <div key={account.accountNumber} style={{ animationDelay: `${300 + index * 100}ms` }} className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                <AccountCard {...account} />
              </div>
            ))}
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
            <RecentTransactions />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
