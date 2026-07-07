import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Search, Moon, Sun, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import logo from "@/assets/logo.png";
import { AiChatWidget } from "@/components/AiChatWidget";
import { NotificationsBell } from "@/components/NotificationsBell";
import { CurrencySelector } from "@/components/CurrencySelector";

interface AuthLayoutProps {
  children: React.ReactNode;
  currentPage?: string;
  onPageChange?: (page: string) => void;
}

export const AuthLayout = ({ children, currentPage, onPageChange }: AuthLayoutProps) => {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );
  const [signingOut, setSigningOut] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const handler = () => setChatOpen(true);
    window.addEventListener("open-ai-chat", handler);
    return () => window.removeEventListener("open-ai-chat", handler);
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const handleSignOut = async () => {
    setSigningOut(true);
    setTimeout(async () => {
      await supabase.auth.signOut();
      navigate("/auth");
    }, 480);
  };

  const navItems = [
    { id: "accounts", label: "Accounts", path: "/accounts" },
    { id: "cards", label: "Cards", path: "/cards" },
    { id: "transfers", label: "Transfers", path: "/transfers" },
    { id: "billpay", label: "Bill Pay", path: "/billpay" },
    { id: "overview", label: "Overview", path: "/overview" },
    { id: "settings", label: "Settings", path: "/settings" },
  ];

  return (
    <div
      className={`min-h-screen bg-background transition-colors duration-300 ${
        signingOut ? "animate-fade-out-scale" : "animate-in fade-in duration-500"
      }`}
    >
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur shadow-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <button onClick={() => navigate("/accounts")} className="group flex items-center gap-3">
            <span className="relative inline-flex">
              <span className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary/40 via-accent/30 to-primary/40 blur-md opacity-70 group-hover:opacity-100 transition-opacity" />
              <img
                src={logo}
                alt="BoA private institute logo"
                width={44}
                height={44}
                className="relative h-11 w-11 rounded-full object-contain ring-2 ring-primary/30 group-hover:ring-primary/60 transition-all animate-logo-glow"
              />
            </span>
            <span className="flex flex-col items-start leading-tight">
              <h1 className="font-display text-xl font-bold text-secondary tracking-tight">
                BoA <span className="text-primary">private</span> institute
              </h1>
              <span
                className="text-[10px] uppercase tracking-[0.25em] font-semibold bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%] bg-clip-text text-transparent animate-shimmer"
              >
                Wealth · Trust · Legacy
              </span>
            </span>
          </button>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" placeholder="Search accounts, services..." className="w-64 pl-10" />
            </div>

            <CurrencySelector variant="compact" />

            <Button variant="ghost" size="icon" onClick={() => setDarkMode(!darkMode)}>
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            <NotificationsBell />


            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign Out" disabled={signingOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <nav className="border-t bg-card">
          <div className="container mx-auto flex gap-1 overflow-x-auto px-4">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.path) navigate(item.path);
                  if (onPageChange) onPageChange(item.id);
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

      <main className="container mx-auto px-4 py-8">{children}</main>

      <AiChatWidget open={chatOpen} onOpenChange={setChatOpen} />
    </div>
  );
};
