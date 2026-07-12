import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Search, User, Moon, Sun, LogOut, Loader2 } from "lucide-react";
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
import { CurrencySelector } from "@/components/CurrencySelector";
import { supabase } from "@/integrations/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Page = "overview" | "accounts" | "transfers" | "billpay" | "security" | "support";

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>("overview");
  const [darkMode, setDarkMode] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);

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
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      fetchAccounts();
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const fetchAccounts = async () => {
    const { data } = await supabase.from("accounts").select("*").order("created_at");
    if (data) {
      setAccounts(data);
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    setSignOutDialogOpen(false);
    setSigningOut(true);
    setTimeout(async () => {
      await supabase.auth.signOut();
      navigate("/auth");
    }, 480);
  };

  const showNotification = (title: string, message: string, type: "success" | "error" | "warning" | "info") => {
    setNotification({ show: true, title, message, type });
  };

  const handleTransfer = async (data: any) => {
    const { fromAccount, amount } = data;
    const fromAcc = accounts.find(a => a.id === fromAccount);
    if (!fromAcc) return;

    await supabase.rpc("adjust_account_balance", { p_account: fromAccount, p_delta: -amount });
    setShowTransferModal(false);
    showNotification("External Transfer Sent", `$${amount.toFixed(2)} sent successfully`, "success");
    fetchAccounts();
  };

  const handleZelle = async (data: any) => {
    const { fromAccount, amount } = data;
    const fromAcc = accounts.find(a => a.id === fromAccount);
    if (!fromAcc) return;

    await supabase.from("accounts").update({ balance: fromAcc.balance - amount }).eq("id", fromAccount);
    setShowZelleModal(false);
    showNotification("Zelle Transfer Sent", `$${amount.toFixed(2)} sent with Zelle`, "success");
    fetchAccounts();
  };

  const handleAddFunds = async (data: any) => {
    const { account, amount } = data;
    
    if (account === "both") {
      const checking = accounts.find(a => a.account_type === "checking");
      const savings = accounts.find(a => a.account_type === "savings");
      if (checking) await supabase.from("accounts").update({ balance: checking.balance + amount }).eq("id", checking.id);
      if (savings) await supabase.from("accounts").update({ balance: savings.balance + amount }).eq("id", savings.id);
    } else {
      const acc = accounts.find(a => a.id === account);
      if (acc) await supabase.from("accounts").update({ balance: acc.balance + amount }).eq("id", acc.id);
    }
    
    showNotification("Funds Added", `$${amount.toFixed(2)} added successfully`, "success");
    setShowDevToolsModal(false);
    fetchAccounts();
  };

  const navItems = [
    { id: "overview" as Page, label: "Overview" },
    { id: "accounts" as Page, label: "Accounts" },
    { id: "transfers" as Page, label: "Transfers" },
    { id: "billpay" as Page, label: "Bill Pay" },
    { id: "security" as Page, label: "Security" },
    { id: "support" as Page, label: "Support" },
  ];

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div
      className={`min-h-screen bg-background transition-colors duration-300 ${
        signingOut ? "animate-fade-out-scale" : "animate-in fade-in duration-500"
      }`}
    >
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card shadow-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 shadow-lg">
              <span className="text-xl font-bold text-primary-foreground">B</span>
            </div>
            <h1 className="text-xl font-bold text-secondary">BoA private institute</h1>
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

            <CurrencySelector variant="compact" />

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

            <Button variant="ghost" size="icon" onClick={() => setSignOutDialogOpen(true)} title="Sign Out" disabled={signingOut}>
              {signingOut ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
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
              {accounts.map((account) => (
                <AccountCard
                  key={account.id}
                  name={account.account_name}
                  balance={account.balance}
                  accountNumber={account.account_number}
                  type={account.account_type}
                  onTransferClick={() => setShowTransferModal(true)}
                  onZelleClick={() => setShowZelleModal(true)}
                  onPayBillClick={() => showNotification("Pay Bill", "Credit card payment feature coming soon", "info")}
                />
              ))}
            </div>

            <RecentTransactions />
          </div>
        )}

        {currentPage === "security" && <SecurityCenter onNotify={showNotification} />}
        {currentPage === "support" && <SupportPage onNotify={showNotification} onOpenDevTools={() => setShowDevToolsModal(true)} />}

        {(currentPage === "accounts" || currentPage === "transfers" || currentPage === "billpay") && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h2 className="text-3xl font-bold text-secondary capitalize">{currentPage}</h2>
            <p className="text-muted-foreground">
              Navigate to the dedicated {currentPage} page for full functionality
            </p>
            <Button onClick={() => navigate(`/${currentPage}`)}>
              Go to {currentPage.charAt(0).toUpperCase() + currentPage.slice(1)}
            </Button>
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

      <Dialog open={signOutDialogOpen} onOpenChange={setSignOutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign out?</DialogTitle>
            <DialogDescription>
              Are you sure you want to sign out? You will need to log in again to access your accounts.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignOutDialogOpen(false)} disabled={signingOut}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleSignOut} disabled={signingOut}>
              {signingOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sign Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {signingOut && (
        <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <p className="text-sm font-medium text-secondary">Signing you out...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
