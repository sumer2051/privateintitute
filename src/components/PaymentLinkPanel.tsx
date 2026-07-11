import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link2, Loader2, Mail, CheckCircle2, Copy, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CURRENCIES, useCurrency } from "@/contexts/CurrencyContext";
import { supabase } from "@/integrations/supabase/client";

type Payload = {
  id: string;
  receiverEmail: string;
  receiverName: string;
  amount: number;
  currency: string;
  senderName: string;
  createdAt: string;
};

const encodeToken = (p: Payload) =>
  btoa(unescape(encodeURIComponent(JSON.stringify(p))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export const PaymentLinkPanel = () => {
  const { toast } = useToast();
  const { currency, formatRaw } = useCurrency();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [country, setCountry] = useState(currency.code);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ payload: Payload; link: string } | null>(null);

  const send = async () => {
    if (!email || !name || !amount) {
      toast({ title: "Missing information", description: "Fill in every field.", variant: "destructive" });
      return;
    }
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    setLoading(true);
    // Realistic 2s send simulation
    await new Promise((r) => setTimeout(r, 2000));

    const { data: userData } = await supabase.auth.getUser();
    const senderName =
      (userData.user?.user_metadata as any)?.full_name || userData.user?.email || "A friend";

    const payload: Payload = {
      id: crypto.randomUUID(),
      receiverEmail: email,
      receiverName: name,
      amount: amt,
      currency: country,
      senderName,
      createdAt: new Date().toISOString(),
    };
    const token = encodeToken(payload);
    const link = `${window.location.origin}/claim?token=${token}`;

    setLoading(false);
    setPreview({ payload, link });
    toast({ title: "Payment link sent", description: `Email delivered to ${email}.` });
  };

  const copyLink = async () => {
    if (!preview) return;
    await navigator.clipboard.writeText(preview.link);
    toast({ title: "Link copied" });
  };

  const chosen = CURRENCIES.find((c) => c.code === country) || currency;
  const displayAmount = amount ? formatRaw(parseFloat(amount) || 0).replace(currency.code, chosen.code) : "";

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Send Payment Link
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Send someone a secure link they can use to claim funds — no account details needed upfront.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pl-email">Receiver Email</Label>
              <Input
                id="pl-email"
                type="email"
                placeholder="jane@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pl-name">Receiver Full Name</Label>
              <Input
                id="pl-name"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pl-amount">Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                  {chosen.symbol}
                </span>
                <Input
                  id="pl-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pl-country">Country / Currency</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger id="pl-country">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.flag} {c.name} ({c.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={send}
            disabled={loading}
            className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending secure link…
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send Link
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              Payment link sent
            </DialogTitle>
            <p className="text-xs uppercase tracking-widest text-muted-foreground pt-2">
              Preview of Receiver's Email
            </p>
          </DialogHeader>

          {preview && (
            <div className="mx-6 mb-6 mt-3 rounded-xl border bg-card shadow-inner overflow-hidden">
              {/* Simulated email header */}
              <div className="bg-gradient-to-r from-primary via-primary to-accent px-5 py-4 text-primary-foreground">
                <p className="text-[10px] uppercase tracking-[0.25em] opacity-80">Secure Transfer Notification</p>
                <p className="font-display text-lg font-bold">You've received money</p>
              </div>
              <div className="px-5 py-6 space-y-4">
                <p className="text-sm text-muted-foreground">Hi {preview.payload.receiverName},</p>
                <p className="text-sm">
                  You have been sent{" "}
                  <span className="font-bold text-secondary">
                    {formatRaw(preview.payload.amount).replace(currency.code, preview.payload.currency)}
                  </span>{" "}
                  by <span className="font-semibold text-secondary">{preview.payload.senderName}</span>.
                </p>
                <div className="rounded-lg border bg-muted/30 p-4 text-center">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Amount</p>
                  <p className="text-3xl font-bold text-primary mt-1">
                    {formatRaw(preview.payload.amount).replace(currency.code, preview.payload.currency)}
                  </p>
                </div>
                <a
                  href={preview.link}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-5 py-3 font-semibold text-primary-foreground shadow-lg hover:opacity-90 transition"
                >
                  Claim Funds
                  <ExternalLink className="h-4 w-4" />
                </a>
                <p className="text-[11px] text-muted-foreground text-center">
                  This link is confidential. If you didn't expect this, please ignore this email.
                </p>
              </div>
              <div className="border-t bg-muted/20 px-5 py-3 flex items-center justify-between gap-2">
                <span className="truncate text-[11px] text-muted-foreground">{preview.link}</span>
                <Button size="sm" variant="ghost" onClick={copyLink}>
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
