import { useState, useEffect } from "react";
import { Bell, Search, User, Moon, Sun } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AccountCard } from "@/components/AccountCard";
import { QuickActions } from "@/components/QuickActions";
import { RecentTransactions } from "@/components/RecentTransactions";
import { SecurityCenter } from "@/components/SecurityCenter";
import { SupportPage } from "@/components/SupportPage";
import { TransferModal } from "@/components/TransferModal";
import { ZelleModal } from "@/components/ZelleModal";
import { DevToolsModal } from "@/components/DevToolsModal";
import { NotificationToast } from "@/components/NotificationToast";

type Page = "overview" | "accounts" | "transfers" | "billpay" | "security" | "support";

const Index = () => {
  const [currentPage, setCurrentPage] = useState<Page>("overview");
  const [darkMode, setDarkMode] = useState(false);
  const [accounts, setAccounts] = useState({
    checking: { balance: 4582.75, number: "4582" },
    savings: { balance: 12350.2, number: "7821" },
    credit: { balance: 1245.5, number: "3098" },
  });

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showZelleModal, setShowZelleModal] = useState(false);
  const [showDevToolsModal, setShowDevToolsModal] = useState(false);

  const [notification, setNotification] = useState({
    show: false,
    title: "",
    message: "",
    type: "success" as "success" | "error" | "warning" | "info",
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  useEffect(() => {
    setTimeout(() => {
      showNotification("Welcome Back", "Your accounts are ready", "success");
    }, 1000);
  }, []);

  const showNotification = (title: string, message: string, type: "success" | "error" | "warning" | "info") => {
    setNotification({ show: true, title, message, type });
  };

  const handleTransfer = (data: any) => {
    const { fromAccount, amount } = data;
    if (fromAccount === "checking") {
      setAccounts(prev => ({ ...prev, checking: { ...prev.checking, balance: prev.checking.balance - amount } }));
    } else {
      setAccounts(prev => ({ ...prev, savings: { ...prev.savings, balance: prev.savings.balance - amount } }));
    }
    setShowTransferModal(false);
    showNotification("External Transfer Sent", `$${amount.toFixed(2)} sent successfully`, "success");
  };

  const handleZelle = (data: any) => {
    const { fromAccount, amount } = data;
    if (fromAccount === "checking") {
      setAccounts(prev => ({ ...prev, checking: { ...prev.checking, balance: prev.checking.balance - amount } }));
    } else {
      setAccounts(prev => ({ ...prev, savings: { ...prev.savings, balance: prev.savings.balance - amount } }));
    }
    setShowZelleModal(false);
    showNotification("Zelle Transfer Sent", `$${amount.toFixed(2)} sent with Zelle`, "success");
  };

  const handleAddFunds = (data: any) => {
    const { account, amount, unlimited } = data;
    
    if (unlimited) {
      setAccounts({
        checking: { balance: 9999999, number: "4582" },
        savings: { balance: 9999999, number: "7821" },
        credit: { balance: 0, number: "3098" },
      });
      showNotification("💰 Unlimited Funds!", "All accounts funded with unlimited money!", "success");
    } else {
      if (account === "checking" || account === "both") {
        setAccounts(prev => ({ ...prev, checking: { ...prev.checking, balance: prev.checking.balance + amount } }));
      }
      if (account === "savings" || account === "both") {
        setAccounts(prev => ({ ...prev, savings: { ...prev.savings, balance: prev.savings.balance + amount } }));
      }
      showNotification("Funds Added", `$${amount.toFixed(2)} added successfully`, "success");
    }
    setShowDevToolsModal(false);
  };

  const navItems = [
    { id: "overview" as Page, label: "Overview" },
    { id: "accounts" as Page, label: "Accounts" },
    { id: "transfers" as Page, label: "Transfers" },
    { id: "billpay" as Page, label: "Bill Pay" },
    { id: "security" as Page, label: "Security" },
    { id: "support" as Page, label: "Support" },
  ];

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card shadow-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 shadow-lg">
              <span className="text-xl font-bold text-primary-foreground">B</span>
            </div>
            <h1 className="text-xl font-bold text-secondary">Bank of America</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search accounts, services..."
                className="w-64 pl-10"
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    const value = (e.target as HTMLInputElement).value;
                    if (value) {
                      showNotification("Search", `Searching for: "${value}"`, "info");
                      setTimeout(() => {
                        showNotification("Search Results", `Found results for "${value}"`, "success");
                      }, 1000);
                      (e.target as HTMLInputElement).value = "";
                    }
                  }
                }}
              />
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setDarkMode(!darkMode);
                showNotification("Theme", `${!darkMode ? "Dark" : "Light"} mode activated`, "info");
              }}
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => showNotification("Notifications", "You have 2 unread notifications", "info")}
            >
              <Bell className="h-5 w-5" />
              <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs" variant="destructive">
                2
              </Badge>
            </Button>

            <Button variant="ghost" size="icon" onClick={() => showNotification("Profile", "Profile settings would open here", "info")}>
              <User className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <nav className="border-t bg-card">
          <div className="container mx-auto flex gap-1 overflow-x-auto px-4">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentPage(item.id);
                  showNotification("Navigation", `Switched to ${item.label}`, "info");
                }}
                className={`whitespace-nowrap border-b-2 px-6 py-3 text-sm font-semibold transition-all ${
                  currentPage === item.id
                    ? "border-primary text-primary"
                    : "border-transparent text-secondary hover:border-primary hover:text-primary"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {currentPage === "overview" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div>
              <h2 className="mb-2 text-3xl font-bold text-secondary">Account Overview</h2>
              <p className="text-muted-foreground">View your account balances and recent activity</p>
            </div>

            <QuickActions 
              onZelleClick={() => setShowZelleModal(true)}
              onTransferClick={() => setShowTransferModal(true)}
              onMobileDepositClick={() => showNotification("Mobile Deposit", "Mobile deposit feature coming soon", "info")}
              onPayBillsClick={() => showNotification("Pay Bills", "Bill payment feature coming soon", "info")}
            />

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <AccountCard 
                name="Checking Account" 
                balance={accounts.checking.balance} 
                accountNumber={accounts.checking.number} 
                type="checking" 
                onTransferClick={() => setShowTransferModal(true)}
                onZelleClick={() => setShowZelleModal(true)}
              />
              <AccountCard 
                name="Savings Account" 
                balance={accounts.savings.balance} 
                accountNumber={accounts.savings.number} 
                type="savings" 
                onTransferClick={() => setShowTransferModal(true)}
                onZelleClick={() => setShowZelleModal(true)}
              />
              <AccountCard 
                name="Credit Card" 
                balance={accounts.credit.balance} 
                accountNumber={accounts.credit.number} 
                type="credit" 
                onPayBillClick={() => showNotification("Pay Bill", "Credit card payment feature coming soon", "info")}
              />
            </div>

            <RecentTransactions />
          </div>
        )}

        {currentPage === "security" && <SecurityCenter onNotify={showNotification} />}
        {currentPage === "support" && <SupportPage onNotify={showNotification} onOpenDevTools={() => setShowDevToolsModal(true)} />}

        {(currentPage === "accounts" || currentPage === "transfers" || currentPage === "billpay") && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h2 className="text-3xl font-bold text-secondary capitalize">{currentPage}</h2>
            <p className="text-muted-foreground">This section is under development</p>
          </div>
        )}
      </main>

      {/* Modals */}
      <TransferModal isOpen={showTransferModal} onClose={() => setShowTransferModal(false)} onSubmit={handleTransfer} />
      <ZelleModal isOpen={showZelleModal} onClose={() => setShowZelleModal(false)} onSubmit={handleZelle} />
      <DevToolsModal isOpen={showDevToolsModal} onClose={() => setShowDevToolsModal(false)} onAddFunds={handleAddFunds} />

      {/* Notification */}
      <NotificationToast
        show={notification.show}
        title={notification.title}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification({ ...notification, show: false })}
      />
    </div>
  );
};

export default Index;
