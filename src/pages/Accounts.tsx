import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/AuthLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Download, TrendingUp, Sparkles, Camera, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/contexts/CurrencyContext";
import { CountUp } from "@/components/CountUp";
import { TransferModal } from "@/components/TransferModal";
import { CurrencySelector } from "@/components/CurrencySelector";

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
    if (h < 12) return "Good Morning";
    if (h < 18) return "Good Afternoon";
    return "Good Evening";
  })();

  const bouncingName = useMemo(() => {
    if (!displayName) return null;
    return displayName.split("").map((char, i) => (
      <span
        key={`${char}-${i}`}
        className="bounce-letter font-display text-xl md:text-4xl font-bold text-secondary"
        style={{ animationDelay: `${i * 0.07}s` }}
      >
        {char === " " ? "\u00A0" : char}
      </span>
    ));
  }, [displayName]);

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
        <div className="space-y-5 animate-pulse">
          <div className="h-10 w-64 rounded bg-muted" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            <div className="h-24 rounded-xl bg-muted" />
            <div className="h-24 rounded-xl bg-muted" />
            <div className="col-span-2 md:col-span-1 h-24 rounded-xl bg-muted" />
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-52 rounded-2xl bg-primary/10" />
            ))}
          </div>
        </div>
      ) : (
        <>

      <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/15 via-accent/10 to-transparent shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex h-28 md:h-36">
          <div className="relative w-1/4 overflow-hidden">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary to-accent">
                <span className="font-display text-3xl md:text-5xl font-bold text-primary-foreground">
                  {initials}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="group absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
              aria-label="Change profile photo"
            >
              {uploadingAvatar ? (
                <Loader2 className="h-6 w-6 text-white animate-spin" />
              ) : (
                <Camera className="h-6 w-6 text-white" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>
          <div className="flex w-3/4 flex-col justify-between p-3 md:p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Sparkles className="h-3 w-3 md:h-4 md:w-4" />
              <span className="text-[10px] md:text-xs uppercase tracking-[0.2em]">
                {greeting}
              </span>
            </div>
            <div className="flex flex-wrap items-end gap-0 leading-none">
              {bouncingName}
            </div>
          </div>
        </div>
      </div>


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
              className="overflow-hidden rounded-2xl border border-primary/15 bg-card/60 backdrop-blur-md shadow-lg shadow-primary/10 transition-all hover:-translate-y-0.5 hover:shadow-xl"
            >
              <CardHeader className="relative bg-primary/25 backdrop-blur-md border-b border-primary/20 p-5 md:p-6 text-primary-foreground">
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
              <CardContent className="bg-primary/5 backdrop-blur-sm p-5 md:p-6">
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

      <Card className="rounded-2xl border border-primary/15 bg-card/60 backdrop-blur-md shadow-sm overflow-hidden">
        <CardHeader className="p-4 md:p-6 bg-primary/10 backdrop-blur-md border-b border-primary/15">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
            Account Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0 md:pt-0">
          {(() => {
            const deposits = accounts.filter((a) => a.account_type !== "credit").reduce((s, a) => s + a.balance, 0);
            const credit = accounts.filter((a) => a.account_type === "credit").reduce((s, a) => s + a.balance, 0);
            const net = deposits - credit;
            return (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                <div className="rounded-xl border border-primary/10 bg-card/70 backdrop-blur-sm p-3 md:p-4 shadow-sm">
                  <p className="text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground">Total Deposits</p>
                  <p className="mt-1 font-display text-base md:text-2xl font-bold text-success truncate">
                    <CountUp value={deposits} format={formatCurrency} />
                  </p>
                </div>
                <div className="rounded-xl border border-primary/10 bg-card/70 backdrop-blur-sm p-3 md:p-4 shadow-sm">
                  <p className="text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground">Credit Used</p>
                  <p className="mt-1 font-display text-base md:text-2xl font-bold text-destructive truncate">
                    <CountUp value={credit} format={formatCurrency} />
                  </p>
                </div>
                <div className="col-span-2 md:col-span-1 rounded-xl border border-primary/10 bg-gradient-to-br from-primary/10 to-accent/10 backdrop-blur-sm p-3 md:p-4 shadow-sm">
                  <p className="text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground">Net Worth</p>
                  <p className="mt-1 font-display text-lg md:text-2xl font-bold text-secondary truncate">
                    <CountUp value={net} format={formatCurrency} />
                  </p>
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