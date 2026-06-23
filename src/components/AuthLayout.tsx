import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Search, Moon, Sun, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AuthLayoutProps {
  children: React.ReactNode;
  currentPage?: string;
  onPageChange?: (page: string) => void;
}

export const AuthLayout = ({ children, currentPage, onPageChange }: AuthLayoutProps) => {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const navItems = [
    { id: "overview", label: "Overview", path: "/" },
    { id: "accounts", label: "Accounts", path: "/accounts" },
    { id: "transfers", label: "Transfers", path: "/transfers" },
    { id: "billpay", label: "Bill Pay", path: "/billpay" },
    { id: "security", label: "Security", path: "/" },
    { id: "settings", label: "Settings", path: "/settings" },
  ];

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
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
              <Input type="search" placeholder="Search accounts, services..." className="w-64 pl-10" />
            </div>

            <Button variant="ghost" size="icon" onClick={() => setDarkMode(!darkMode)}>
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs" variant="destructive">
                2
              </Badge>
            </Button>

            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign Out">
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
    </div>
  );
};