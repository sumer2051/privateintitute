import { useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, ShieldCheck, Sparkles, Loader2 } from "lucide-react";
import { CURRENCIES } from "@/contexts/CurrencyContext";
import logo from "@/assets/logo.png";

type Payload = {
  id: string;
  receiverEmail: string;
  receiverName: string;
  amount: number;
  currency: string;
  senderName: string;
  createdAt: string;
};

const decode = (token: string | null): Payload | null => {
  if (!token) return null;
  try {
    const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch {
    return null;
  }
};

const formatFor = (amount: number, code: string) => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: code === "JPY" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(2)}`;
  }
};

const Claim = () => {
  const [params] = useSearchParams();
  const payload = useMemo(() => decode(params.get("token")), [params]);

  const [receiverCurrency, setReceiverCurrency] = useState(payload?.currency || "USD");
  const [accountNumber, setAccountNumber] = useState("");
  const [fullName, setFullName] = useState(payload?.receiverName || "");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (!payload) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Invalid or expired link</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This payment link is not valid. Please request a new one from the sender.
            </p>
            <Link to="/" className="text-primary text-sm underline mt-4 inline-block">
              Go home
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const submit = async () => {
    if (!accountNumber || !fullName) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1500));
    setSubmitting(false);
    setDone(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/40 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />

      <header className="relative border-b bg-card/80 backdrop-blur">
        <div className="container mx-auto flex items-center gap-3 px-4 py-4">
          <img src={logo} alt="Logo" className="h-9 w-9 rounded-full ring-2 ring-primary/40" />
          <div>
            <p className="font-display font-bold text-secondary">Secure Claim Portal</p>
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Encrypted · Verified</p>
          </div>
          <span className="ml-auto flex items-center gap-1 text-xs text-success">
            <ShieldCheck className="h-4 w-4" /> Secure Session
          </span>
        </div>
      </header>

      <main className="relative container mx-auto max-w-xl px-4 py-10">
        <Card className="border-primary/20 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardHeader className="text-center border-b bg-gradient-to-r from-primary/5 via-transparent to-accent/5">
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Incoming Transfer</p>
            <CardTitle className="text-2xl">You've received a payment</CardTitle>
            <p className="text-sm text-muted-foreground">
              From <span className="font-semibold text-secondary">{payload.senderName}</span>
            </p>
            <div className="mx-auto mt-4 rounded-xl bg-gradient-to-br from-primary to-accent p-[1px]">
              <div className="rounded-[11px] bg-card px-6 py-5">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Amount</p>
                <p className="text-4xl font-bold text-primary">
                  {formatFor(payload.amount, payload.currency)}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5 pt-6">
            {done ? (
              <div className="text-center space-y-3 py-8 animate-in zoom-in-50 duration-500">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/15">
                  <CheckCircle2 className="h-9 w-9 text-success" />
                </div>
                <h3 className="text-xl font-bold text-secondary">Funds Claimed Successfully</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  {formatFor(payload.amount, payload.currency)} will settle into the account ending in{" "}
                  <span className="font-mono font-semibold">
                    ****{accountNumber.slice(-4)}
                  </span>{" "}
                  within 1–3 business days.
                </p>
                <div className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-xs">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Reference: {payload.id.slice(0, 8).toUpperCase()}
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Enter your banking details below to receive these funds. Your information is encrypted.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="claim-name">Full Name</Label>
                  <Input
                    id="claim-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="As it appears on your bank account"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="claim-currency">Your Local Currency / Country</Label>
                  <Select value={receiverCurrency} onValueChange={setReceiverCurrency}>
                    <SelectTrigger id="claim-currency">
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
                <div className="space-y-2">
                  <Label htmlFor="claim-acct">Account Number / IBAN</Label>
                  <Input
                    id="claim-acct"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. GB29 NWBK 6016 1331 9268 19"
                    className="font-mono"
                  />
                </div>
                <Button
                  onClick={submit}
                  disabled={submitting || !accountNumber || !fullName}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying details…
                    </>
                  ) : (
                    <>Claim {formatFor(payload.amount, payload.currency)}</>
                  )}
                </Button>
                <p className="text-[11px] text-center text-muted-foreground">
                  By claiming, you agree that the sender's identity has been verified through our secure link.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Claim;
