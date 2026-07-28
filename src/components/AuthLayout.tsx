import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Search, Moon, Sun, LogOut, Loader2, Megaphone, AlertTriangle, Info, Wallet, CreditCard, ArrowLeftRight, LifeBuoy, Settings as SettingsIcon, ShieldAlert, Users, Mail, Megaphone as MegaphoneIcon, ScrollText, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import logo from "@/assets/logo.png";
import { AiChatWidget } from "@/components/AiChatWidget";
import { NotificationsBell } from "@/components/NotificationsBell";
import { Shield, ShieldCheck } from "lucide-react";
import { StaffPinDialog } from "@/components/StaffPinDialog";
import { AchOneTimeDialog } from "@/components/AchOneTimeDialog";
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
    { id: "accounts", label: "Account", path: "/accounts", Icon: Wallet },
    { id: "cards", label: "Cards", path: "/cards", Icon: CreditCard },
    { id: "transfers", label: "Transfers", path: "/transfers", Icon: ArrowLeftRight },
    { id: "support", label: "Support", path: "/support", Icon: LifeBuoy },
    { id: "settings", label: "Settings", path: "/settings", Icon: SettingsIcon },
  ];

  const staffNav = [
    ...((isAdmin || isSupport) ? [{ id: "admin-support", label: "Tickets", path: "/admin/support", Icon: LifeBuoy }] : []),
    ...((isAdmin || isTxSupport) ? [{ id: "admin-transactions", label: "Transactions", path: "/admin/transactions", Icon: ArrowLeftRight }] : []),
    ...(isAdmin ? [{ id: "admin-users", label: "Users", path: "/admin/users", Icon: Users }] : []),
    ...(isAdmin ? [{ id: "admin-invitations", label: "Invites", path: "/admin/invitations", Icon: Mail }] : []),
    ...(isAdmin ? [{ id: "admin-announcements", label: "Broadcast", path: "/admin/announcements", Icon: MegaphoneIcon }] : []),
    ...(isAdmin ? [{ id: "admin-audit", label: "Audit", path: "/admin/audit", Icon: ScrollText }] : []),
  ];


  // tx_support is restricted: no balances, no transfers, no bill pay, no cards
  const restrictedForTxOnly = isTxSupport && !isAdmin && !isSupport;
  const filteredUserNav = restrictedForTxOnly
    ? userNav.filter((i) => ["support", "settings"].includes(i.id))
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

        <nav className="border-t bg-gradient-to-b from-card/80 to-card/40 backdrop-blur">
          <div className="container mx-auto relative px-2 md:px-4 py-2">
            <button
              type="button"
              aria-label="Show previous navigation items"
              onClick={() => {
                const el = document.getElementById("primary-nav-scroller");
                if (el) el.scrollBy({ left: -(el.clientWidth - 16), behavior: "smooth" });
              }}
              className="absolute left-1 md:left-2 top-1/2 z-10 -translate-y-1/2 flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-full bg-card/95 border shadow-sm text-secondary hover:text-primary transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div
              id="primary-nav-scroller"
              className="flex gap-2 overflow-x-hidden scroll-smooth pl-9 pr-8 md:pl-10 md:pr-8 scrollbar-none snap-x snap-mandatory"
            >
              {navItems.map((item) => {
                const Icon = (item as any).Icon;
                const active = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.path) navigate(item.path);
                      if (onPageChange) onPageChange(item.id);
                    }}
                    className={`group flex shrink-0 snap-start flex-col items-center justify-center gap-1 w-[calc(25%-0.375rem)] md:w-[calc(25%-0.375rem)] min-h-[3.25rem] md:min-h-[3.75rem] rounded-xl border px-2 py-2 text-[10px] md:text-xs font-semibold transition-all ${
                      active
                        ? "bg-primary/15 border-primary/60 text-primary shadow"
                        : "bg-card/50 dark:bg-card/30 backdrop-blur-md border-border/60 text-secondary hover:border-primary/60 hover:text-primary hover:-translate-y-0.5 hover:shadow-md"
                    }`}
                    title={item.label}
                  >
                    {Icon ? <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-secondary group-hover:text-primary"}`} /> : null}
                    <span className="leading-none truncate w-full text-center">{item.label}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              aria-label="Show more navigation items"
              onClick={() => {
                const el = document.getElementById("primary-nav-scroller");
                if (el) el.scrollBy({ left: el.clientWidth - 16, behavior: "smooth" });
              }}
              className="absolute right-1 md:right-2 top-1/2 z-10 -translate-y-1/2 flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-full bg-card/95 border shadow-sm text-secondary hover:text-primary transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
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
      <StaffPinDialog open={pinOpen} onOpenChange={setPinOpen} onVerified={() => setStaffMode(true)} />
      <AchOneTimeDialog />
    </div>
  );
};

