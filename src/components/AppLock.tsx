import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Delete, LockKeyhole, ShieldCheck, Loader2 } from "lucide-react";
import logo from "@/assets/logo.png";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * App shell that:
 *   1. Shows a branded splash on first load.
 *   2. Optionally requires a numeric passcode when the app regains focus
 *      after being backgrounded (or on cold start after login).
 *   3. Prompts the user to set a passcode the first time they log in.
 */
const PASSCODE_KEY = "boa.passcode.hash";
const PASSCODE_LEN = 4;

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type Phase = "splash" | "setup" | "confirm" | "locked" | "ready";

const PUBLIC_PATHS = ["/auth", "/.lovable/oauth/consent"];

export const AppLock = ({ children }: { children: React.ReactNode }) => {
  const isPublic =
    typeof window !== "undefined" &&
    PUBLIC_PATHS.some((p) => window.location.pathname.startsWith(p));
  const [phase, setPhase] = useState<Phase>(isPublic ? "ready" : "splash");
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [code, setCode] = useState("");
  const [firstCode, setFirstCode] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const { toast } = useToast();
  const [splashDone, setSplashDone] = useState(false);
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Auth state
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      setAuthChecked(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthChecked(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Splash timing — always show ~1.6s on cold load
  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), 1600);
    return () => clearTimeout(t);
  }, []);

  // Resolve phase once both splash finished AND auth resolved
  useEffect(() => {
    if (!splashDone || !authChecked) return;
    if (phase !== "splash") return;
    const hasPasscode = !!localStorage.getItem(PASSCODE_KEY);
    if (!user) {
      setPhase("ready");
      return;
    }
    if (!hasPasscode) {
      setPhase("setup");
      return;
    }
    setPhase("locked");
  }, [splashDone, authChecked, user, phase]);

  // Re-lock when tab regains focus if a passcode exists AND user is signed in
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && phase === "ready" && user && localStorage.getItem(PASSCODE_KEY)) {
        setCode("");
        setError("");
        setPhase("locked");
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [phase, user]);

  const handleLockedSignOut = async () => {
    setSignOutDialogOpen(false);
    setSigningOut(true);
    setTimeout(async () => {
      localStorage.removeItem(PASSCODE_KEY);
      await supabase.auth.signOut();
      window.location.reload();
    }, 480);
  };

  const rejectWithShake = (msg: string) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
    setCode("");
  };

  const submitCode = async (value: string) => {
    if (phase === "setup") {
      setFirstCode(value);
      setCode("");
      setPhase("confirm");
      return;
    }
    if (phase === "confirm") {
      if (value !== firstCode) {
        rejectWithShake("Codes didn't match. Start over.");
        setFirstCode("");
        setPhase("setup");
        return;
      }
      const hash = await sha256(value);
      localStorage.setItem(PASSCODE_KEY, hash);
      toast({ title: "Passcode set", description: "You'll be asked for this whenever you reopen the app." });
      setPhase("ready");
      setFirstCode("");
      setCode("");
      return;
    }
    if (phase === "locked") {
      const stored = localStorage.getItem(PASSCODE_KEY);
      const hash = await sha256(value);
      if (hash === stored) {
        setPhase("ready");
        setCode("");
        setError("");
      } else {
        rejectWithShake("Incorrect passcode");
      }
    }
  };

  const press = (n: string) => {
    if (code.length >= PASSCODE_LEN) return;
    const next = code + n;
    setCode(next);
    setError("");
    if (next.length === PASSCODE_LEN) {
      setTimeout(() => submitCode(next), 120);
    }
  };
  const backspace = () => setCode((c) => c.slice(0, -1));

  if (phase === "ready") return <>{children}</>;

  if (phase === "splash") {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-gradient-to-br from-secondary via-secondary to-[hsl(222,60%,4%)]">
        <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/25 blur-3xl animate-pulse" />
        <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent/25 blur-3xl animate-pulse" />
        <div className="relative flex flex-col items-center gap-6 text-center">
          <div className="relative">
            <span className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary via-accent to-primary blur-2xl opacity-70 animate-ping" />
            <img
              src={logo}
              alt="BoA private institute"
              className="relative h-28 w-28 rounded-full object-contain ring-4 ring-primary/40 shadow-2xl animate-in zoom-in-50 duration-700"
            />
          </div>
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-white">
              BoA <span className="text-primary">private</span> institute
            </h1>
            <p
              className="mt-2 text-[11px] uppercase tracking-[0.35em] font-semibold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent"
            >
              Wealth · Trust · Legacy
            </p>
          </div>
          <div className="mt-4 h-1 w-40 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-primary to-accent animate-[shimmer_1.4s_ease-in-out_infinite]" />
          </div>
        </div>
      </div>
    );
  }

  // Passcode UI
  const title =
    phase === "setup" ? "Create a passcode" : phase === "confirm" ? "Confirm your passcode" : "Enter passcode";
  const subtitle =
    phase === "setup"
      ? "Protect your account. You'll be asked for this each time you open the app."
      : phase === "confirm"
        ? "Enter the same 4-digit code again."
        : "Welcome back — enter your 4-digit code to continue.";

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-secondary via-secondary to-[hsl(222,60%,4%)] px-6 py-8 text-white">
      <div className="flex flex-col items-center gap-3">
        <img src={logo} alt="BoA private institute" className="h-14 w-14 rounded-full ring-2 ring-primary/40 shadow-lg" />
        <h1 className="font-display text-xl font-bold">
          BoA <span className="text-primary">private</span> institute
        </h1>
      </div>

      <div className="mt-8 flex flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-2 text-sm text-white/70">
          {phase === "locked" ? <LockKeyhole className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4 text-success" />}
          <span>{title}</span>
        </div>
        <p className="max-w-xs text-xs text-white/50">{subtitle}</p>
      </div>

      <div className={`mt-6 flex gap-4 ${shake ? "animate-shake" : ""}`}>
        {Array.from({ length: PASSCODE_LEN }).map((_, i) => (
          <span
            key={i}
            className={`h-4 w-4 rounded-full border transition-all ${
              code.length > i ? "bg-primary border-primary scale-110" : "border-white/30"
            }`}
          />
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-destructive-foreground/90">{error}</p>}

      <div className="mt-8 grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
          <button
            key={n}
            onClick={() => press(n)}
            className="h-16 w-16 rounded-full bg-white/5 text-2xl font-semibold text-white transition hover:bg-white/10 active:scale-95"
          >
            {n}
          </button>
        ))}
        <span className="h-16 w-16" />
        <button
          onClick={() => press("0")}
          className="h-16 w-16 rounded-full bg-white/5 text-2xl font-semibold text-white transition hover:bg-white/10 active:scale-95"
        >
          0
        </button>
        <button
          onClick={backspace}
          aria-label="Backspace"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-white transition hover:bg-white/10 active:scale-95"
        >
          <Delete className="h-5 w-5" />
        </button>
      </div>

      {phase === "locked" && (
        <div className="mt-8 flex flex-col items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-white/70 hover:text-white"
            onClick={async () => {
              const yes = window.confirm(
                "This will sign you out and clear your passcode. You'll need to log in again."
              );
              if (!yes) return;
              localStorage.removeItem(PASSCODE_KEY);
              await supabase.auth.signOut();
              window.location.reload();
            }}
          >
            Forgot passcode? Sign out
          </Button>
        </div>
      )}
    </div>
  );
};
