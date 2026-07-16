import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Search, Moon, Sun, LogOut, Loader2, Megaphone, AlertTriangle, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import logo from "@/assets/logo.png";
import { AiChatWidget } from "@/components/AiChatWidget";
import { NotificationsBell } from "@/components/NotificationsBell";
import { CurrencySelector } from "@/components/CurrencySelector";
import { Shield, ShieldCheck } from "lucide-react";
import { StaffPinDialog } from "@/components/StaffPinDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [staffMode, setStaffMode] = useState<boolean>(() => {
    // Never persist staff mode across reloads — always require the PIN again.
    return false;
  });
  const [pinOpen, setPinOpen] = useState(false);
  const [announcement, setAnnouncement] = useState<{ id: string; title: string; body: string; severity: string } | null>(null);
  const [dismissedAnnouncementId, setDismissedAnnouncementId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem("dismissedAnnouncementId");
  });


  useEffect(() => {
    let mounted = true;
    const loadRoles = async (uid: string | undefined) => {
      if (!uid) { if (mounted) setRoles([]); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      if (mounted) setRoles(((data as any[]) || []).map((r) => r.role));
    };
    supabase.auth.getSession().then(({ data: { session } }) => loadRoles(session?.user?.id));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => loadRoles(session?.user?.id));
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  // Staff mode is session-only and gated by PIN — nothing to persist.


  useEffect(() => {
    const handler = () => setChatOpen(true);
    window.addEventListener("open-ai-chat", handler);
    return () => window.removeEventListener("open-ai-chat", handler);
  }, []);

  useEffect(() => {
    supabase
      .from("announcements")
      .select("id,title,body,severity")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setAnnouncement((data as any) || null));
  }, []);

  const dismissAnnouncement = () => {
    if (!announcement) return;
    window.localStorage.setItem("dismissedAnnouncementId", announcement.id);
    setDismissedAnnouncementId(announcement.id);
  };


  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const handleSignOut = async () => {
    setSignOutDialogOpen(false);
    setSigningOut(true);
    setTimeout(async () => {
      await supabase.auth.signOut();
      navigate("/auth");
    }, 480);
  };

  const isAdmin = roles.includes("admin");
  const isSupport = roles.includes("support");
  const isTxSupport = roles.includes("tx_support");
  const hasStaffAccess = isAdmin || isSupport || isTxSupport;
  const showStaff = hasStaffAccess && staffMode;

  const userNav = [
    { id: "accounts", label: "Accounts", path: "/accounts" },
    { id: "cards", label: "Cards", path: "/cards" },
    { id: "transfers", label: "Transfers", path: "/transfers" },
    { id: "billpay", label: "Bill Pay", path: "/billpay" },
    { id: "overview", label: "Overview", path: "/overview" },
    { id: "support", label: "Support", path: "/support" },
    { id: "settings", label: "Settings", path: "/settings" },
  ];

  const staffNav = [
    ...((isAdmin || isSupport) ? [{ id: "admin-support", label: "Admin · Tickets", path: "/admin/support" }] : []),
    ...((isAdmin || isTxSupport) ? [{ id: "admin-transactions", label: "Admin · Transactions", path: "/admin/transactions" }] : []),
    ...(isAdmin ? [{ id: "admin-users", label: "Admin · Users", path: "/admin/users" }] : []),
    ...(isAdmin ? [{ id: "admin-invitations", label: "Admin · Invites", path: "/admin/invitations" }] : []),
    ...(isAdmin ? [{ id: "admin-announcements", label: "Admin · Broadcast", path: "/admin/announcements" }] : []),
    ...(isAdmin ? [{ id: "admin-audit", label: "Admin · Audit log", path: "/admin/audit" }] : []),
  ];


  // tx_support is restricted: no balances, no transfers, no bill pay, no cards
  const restrictedForTxOnly = isTxSupport && !isAdmin && !isSupport;
  const filteredUserNav = restrictedForTxOnly
    ? userNav.filter((i) => ["settings", "support"].includes(i.id))
    : userNav;

  const navItems = showStaff ? [...filteredUserNav, ...staffNav] : filteredUserNav;

  return (
    <div
      className={`min-h-screen bg-background transition-colors duration-300 ${
        signingOut ? "animate-fade-out-scale" : "animate-in fade-in duration-500"
      }`}
    >
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur shadow-sm">
        <div className="container mx-auto flex h-14 md:h-16 items-center justify-between gap-2 px-3 md:px-4">
          <button onClick={() => navigate("/accounts")} className="group flex min-w-0 items-center gap-2 md:gap-3">
            <span className="relative inline-flex shrink-0">
              <span className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary/40 via-accent/30 to-primary/40 blur-md opacity-70 group-hover:opacity-100 transition-opacity" />
              <img
                src={logo}
                alt="BoA private institute logo"
                width={44}
                height={44}
                className="relative h-9 w-9 md:h-11 md:w-11 rounded-full object-contain ring-2 ring-primary/30 group-hover:ring-primary/60 transition-all animate-logo-glow"
              />
            </span>
            <span className="flex min-w-0 flex-col items-start leading-tight">
              <h1 className="font-display text-sm md:text-xl font-bold text-secondary tracking-tight truncate max-w-[160px] md:max-w-none">
                BoA <span className="text-primary">private</span> institute
              </h1>
              <span
                className="hidden md:inline text-[10px] uppercase tracking-[0.25em] font-semibold bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%] bg-clip-text text-transparent animate-shimmer"
              >
                Wealth · Trust · Legacy
              </span>
            </span>
          </button>

          <div className="flex items-center gap-1 md:gap-3 shrink-0">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" placeholder="Search accounts, services..." className="w-64 pl-10" />
            </div>

            <CurrencySelector variant="compact" />

            <Button variant="ghost" size="icon" className="h-9 w-9 md:h-10 md:w-10" onClick={() => setDarkMode(!darkMode)}>
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            <NotificationsBell />

            {hasStaffAccess && (
              <Button
                variant={staffMode ? "default" : "outline"}
                size="sm"
                className="hidden md:inline-flex h-9 gap-1.5"
                onClick={() => {
                  if (staffMode) { setStaffMode(false); navigate("/accounts"); }
                  else setPinOpen(true);
                }}
                title={staffMode ? "Exit staff mode" : "Enter staff mode"}
              >
                {staffMode ? <ShieldCheck className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                {staffMode ? "Staff on" : "Staff mode"}
              </Button>
            )}
            {hasStaffAccess && (
              <Button
                variant={staffMode ? "default" : "outline"}
                size="icon"
                className="md:hidden h-9 w-9"
                onClick={() => {
                  if (staffMode) { setStaffMode(false); navigate("/accounts"); }
                  else setPinOpen(true);
                }}
                title={staffMode ? "Exit staff mode" : "Enter staff mode"}
              >
                {staffMode ? <ShieldCheck className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
              </Button>
            )}




            <Button variant="ghost" size="icon" className="h-9 w-9 md:h-10 md:w-10" onClick={() => setSignOutDialogOpen(true)} title="Sign Out" disabled={signingOut}>
              {signingOut ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        <nav className="border-t bg-card">
          <div className="container mx-auto flex gap-1 overflow-x-auto px-3 md:px-4 scrollbar-none">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.path) navigate(item.path);
                  if (onPageChange) onPageChange(item.id);
                }}
                className={`whitespace-nowrap border-b-2 px-4 md:px-6 py-2.5 md:py-3 text-xs md:text-sm font-semibold transition-all ${

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

      {announcement && dismissedAnnouncementId !== announcement.id && (
        <div
          className={`border-b px-4 py-2.5 flex items-start gap-3 text-sm ${
            announcement.severity === "critical"
              ? "bg-destructive/10 border-destructive/30 text-destructive"
              : announcement.severity === "warning"
              ? "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
              : "bg-primary/5 border-primary/20 text-secondary"
          }`}
        >
          {announcement.severity === "critical" ? (
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          ) : announcement.severity === "warning" ? (
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          ) : (
            <Megaphone className="h-4 w-4 mt-0.5 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold">{announcement.title}</p>
            <p className="text-xs opacity-90 whitespace-pre-line">{announcement.body}</p>
          </div>
          <button onClick={dismissAnnouncement} className="text-xs uppercase tracking-wider opacity-70 hover:opacity-100">Dismiss</button>
        </div>
      )}

      <main className="container mx-auto px-3 md:px-4 py-4 md:py-8">{children}</main>


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

      <AiChatWidget open={chatOpen} onOpenChange={setChatOpen} />
    </div>
  );
};
