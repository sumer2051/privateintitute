import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/AuthLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowUpDown, Download, TrendingUp, Sparkles, Camera, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/contexts/CurrencyContext";
import { CountUp } from "@/components/CountUp";
import { TransferModal } from "@/components/TransferModal";

function useRollingName<T extends HTMLElement>(name: string) {
  const ref = useRef<T>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(!!name);
    if (!ref.current || !name) return;
    const el = ref.current;
    const parent = el.parentElement;
    if (!parent) return;
    const overflow = el.scrollWidth - parent.clientWidth;
    const offset = overflow > 4 ? `${overflow + 16}px` : "8px";
    const duration = overflow > 4
      ? Math.max(6, Math.min(14, overflow / 18))
      : 4;
    el.style.setProperty("--roll-offset", `-${offset}`);
    el.style.setProperty("--roll-duration", `${duration}s`);
  }, [name]);
  return { ref, shouldRoll: ready };
}

interface Account {
  id: string;
  account_name: string;
  account_type: string;
  account_number: string;
  balance: number;
  available_balance: number;
}

const Accounts = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { ref: nameRef, shouldRoll } = useRollingName<HTMLSpanElement>(displayName);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please choose an image.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Too large", description: "Max 5MB.", variant: "destructive" });
      return;
    }
    setUploadingAvatar(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Not signed in");
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${uid}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        upsert: true,
        cacheControl: "3600",
      });
      if (upErr) throw upErr;
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ avatar_url: path })
        .eq("id", uid);
      if (profErr) throw profErr;
      const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60);
      if (signed?.signedUrl) setAvatarUrl(signed.signedUrl);
      toast({ title: "Profile photo updated", description: "Your new photo has been saved." });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    fetchAccounts();
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (!u) return;
      const meta: any = u.user_metadata || {};
      const name = meta.full_name || meta.name || meta.first_name || (u.email ? u.email.split("@")[0] : "");
      setDisplayName(name);
      let url = meta.avatar_url || meta.picture || "";
      const { data: prof } = await supabase
        .from("profiles")
        .select("avatar_url, full_name")
        .eq("id", u.id)
        .maybeSingle();
      if (prof) {
        if ((prof as any).full_name) setDisplayName((prof as any).full_name);
        const path = (prof as any).avatar_url as string | undefined;
        if (path) {
          const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60);
          if (signed?.signedUrl) url = signed.signedUrl;
        }
      }
      setAvatarUrl(url);
    })();
  }, []);

  const initials = displayName
    ? displayName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  const fetchAccounts = async () => {
    const start = Date.now();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 1500 - elapsed);
      setTimeout(() => setLoading(false), remaining);
    }
  };

  const { format } = useCurrency();
  const formatCurrency = (amount: number) => format(amount);

  return (
    <AuthLayout currentPage="accounts">
      {loading ? (
        <div className="space-y-6 animate-pulse">
          <div className="h-10 w-64 rounded bg-muted" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-56 rounded-lg bg-muted" />
            ))}
          </div>
        </div>
      ) : (
        <>

      <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/15 via-accent/10 to-transparent p-4 md:p-6 shadow-sm">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex items-center gap-3 md:gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="group relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary transition-transform hover:scale-105 active:scale-95"
            aria-label="Change profile photo"
          >
            <Avatar className="h-12 w-12 md:h-16 md:w-16 ring-2 ring-primary/40 shadow-md">
              <AvatarImage src={avatarUrl} alt={displayName} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-display text-base md:text-xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              {uploadingAvatar ? (
                <Loader2 className="h-5 w-5 text-white animate-spin" />
              ) : (
                <Camera className="h-4 w-4 md:h-5 md:w-5 text-white" />
              )}
            </span>
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full bg-primary text-white shadow-md ring-2 ring-background">
              <Camera className="h-2.5 w-2.5 md:h-3 md:w-3" />
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] md:text-xs uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> {greeting}
            </p>
            <h2 className="font-display text-lg md:text-4xl font-bold text-secondary leading-tight">
              Welcome back{displayName ? (
                <>, <span className="overflow-hidden align-bottom inline-block max-w-full">
                  <span
                    ref={nameRef}
                    className={`inline-block whitespace-nowrap bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent ${shouldRoll ? "animate-roll" : ""}`}
                  >
                    {displayName}
                  </span>
                </span></>
              ) : ""}
            </h2>
            <p className="hidden md:block text-sm text-muted-foreground italic">"Your wealth, curated with precision."</p>
          </div>
        </div>
      </div>

      {/* Net worth quick strip — always visible on mobile */}
      {(() => {
        const deposits = accounts.filter((a) => a.account_type !== "credit").reduce((s, a) => s + a.balance, 0);
        const credit = accounts.filter((a) => a.account_type === "credit").reduce((s, a) => s + a.balance, 0);
        const net = deposits - credit;
        return (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4">
            <div className="rounded-xl border bg-card p-3 md:p-4 shadow-sm">
              <p className="text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground">Deposits</p>
              <p className="mt-1 font-display text-base md:text-2xl font-bold text-success truncate">
                <CountUp value={deposits} format={formatCurrency} />
              </p>
            </div>
            <div className="rounded-xl border bg-card p-3 md:p-4 shadow-sm">
              <p className="text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground">Credit Used</p>
              <p className="mt-1 font-display text-base md:text-2xl font-bold text-destructive truncate">
                <CountUp value={credit} format={formatCurrency} />
              </p>
            </div>
            <div className="col-span-2 md:col-span-1 rounded-xl border bg-gradient-to-br from-primary/10 to-accent/10 p-3 md:p-4 shadow-sm">
              <p className="text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground">Net Worth</p>
              <p className="mt-1 font-display text-lg md:text-2xl font-bold text-secondary truncate">
                <CountUp value={net} format={formatCurrency} />
              </p>
            </div>
          </div>
        );
      })()}

      <div className="grid gap-4 md:gap-6">
        {accounts
          .slice()
          .sort((a, b) => {
            const order: Record<string, number> = { checking: 1, savings: 2, credit: 3 };
            return (order[a.account_type] || 99) - (order[b.account_type] || 99);
          })
          .map((account) => (
            <Card
              key={account.id}
              className="overflow-hidden rounded-2xl border-0 shadow-lg shadow-primary/10 transition-all hover:-translate-y-0.5 hover:shadow-xl"
            >
              <CardHeader className="relative bg-gradient-to-br from-primary to-primary/85 p-5 md:p-6 text-primary-foreground">
                <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-base md:text-xl font-semibold tracking-tight text-primary-foreground">
                      {account.account_name}
                    </CardTitle>
                    <p className="mt-1 text-xs md:text-sm text-primary-foreground/80">
                      ****{account.account_number}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-[10px] md:text-xs font-semibold uppercase tracking-wider text-primary-foreground backdrop-blur-sm">
                    {account.account_type}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="bg-gradient-to-b from-primary/[0.04] to-transparent p-5 md:p-6">
                <div className="space-y-4 md:space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                    <div>
                      <p className="text-[11px] md:text-xs uppercase tracking-wider text-muted-foreground">
                        Current Balance
                      </p>
                      <p className="mt-0.5 font-display text-3xl md:text-4xl font-bold text-secondary tracking-tight">
                        <CountUp value={account.balance} format={formatCurrency} />
                      </p>
                    </div>
                    {account.account_type !== "credit" && (
                      <div className="text-left sm:text-right">
                        <p className="text-[11px] md:text-xs uppercase tracking-wider text-muted-foreground">
                          Available
                        </p>
                        <p className="mt-0.5 text-lg md:text-xl font-semibold text-foreground">
                          <CountUp value={account.available_balance} format={formatCurrency} />
                        </p>
                      </div>
                    )}
                    {account.account_type === "credit" && (
                      <div className="text-left sm:text-right">
                        <p className="text-[11px] md:text-xs uppercase tracking-wider text-muted-foreground">
                          Available Credit
                        </p>
                        <p className="mt-0.5 text-lg md:text-xl font-semibold text-success">
                          <CountUp value={account.available_balance} format={formatCurrency} />
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3 pt-1">
                    <Button
                      size="sm"
                      className="flex-1 h-10 md:h-11 rounded-xl bg-primary text-primary-foreground text-xs md:text-sm font-semibold shadow-md shadow-primary/20 transition-all hover:scale-[1.02] hover:bg-primary/95 hover:shadow-lg active:scale-[0.98]"
                      onClick={() => setTransferOpen(true)}
                    >
                      <ArrowUpDown className="mr-1.5 h-4 w-4" />
                      Transfer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-10 md:h-11 rounded-xl border-border bg-card text-xs md:text-sm font-semibold transition-all hover:scale-[1.02] hover:bg-accent/5 hover:text-accent active:scale-[0.98]"
                      onClick={() =>
                        toast({
                          title: "Statement ready",
                          description: `${account.account_name} statement download started.`,
                        })
                      }
                    >
                      <Download className="mr-1.5 h-4 w-4" />
                      Statement
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <TrendingUp className="h-5 w-5" />
            Account Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0 md:pt-0">
          {(() => {
            const deposits = accounts.filter((a) => a.account_type !== "credit").reduce((s, a) => s + a.balance, 0);
            const credit = accounts.filter((a) => a.account_type === "credit").reduce((s, a) => s + a.balance, 0);
            const net = deposits - credit;
            return (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Deposits</span>
                  <span className="font-semibold text-success">
                    <CountUp value={deposits} format={formatCurrency} />
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Credit Balance</span>
                  <span className="font-semibold text-destructive">
                    <CountUp value={credit} format={formatCurrency} />
                  </span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t">
                  <span className="font-semibold text-secondary">Net Worth</span>
                  <span className="text-lg md:text-xl font-bold text-secondary">
                    <CountUp value={net} format={formatCurrency} />
                  </span>
                </div>
              </div>
            );
          })()}
        </CardContent>
        </Card>
      </div>
        </>
      )}
      <TransferModal
        isOpen={transferOpen}
        onClose={() => setTransferOpen(false)}
        onSubmit={async ({ fromAccount, amount }) => {
          const from = accounts.find((a) => a.id === fromAccount);
          if (from) {
            await supabase.rpc("adjust_account_balance", { p_account: fromAccount, p_delta: -amount });
            fetchAccounts();
          }
          setTransferOpen(false);
          toast({ title: "Transfer submitted", description: `${formatCurrency(amount)} is pending approval.` });
        }}
      />
    </AuthLayout>

  );
};

export default Accounts;