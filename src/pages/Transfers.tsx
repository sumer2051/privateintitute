import { useState, useEffect, useRef } from "react";
import { TransferPinGate, type PinGateHandle } from "@/components/TransferPinGate";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/AuthLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowRightLeft, Send, Building, Clock, ShieldCheck, Mail, Globe2, Sparkles } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { getBankingProfile, getBankingSchemes } from "@/lib/bank-profiles";
import { getCountryMethods, type CountryMethod } from "@/lib/country-methods";
import { TransferReceipt, type ReceiptData } from "@/components/TransferReceipt";

interface Account {
  id: string;
  account_name: string;
  account_number: string;
  balance: number;
}

interface PendingTx {
  id: string;
  account_id: string;
  category: string;
  description: string;
  amount: number;
  status: string | null;
  reference_number: string | null;
  created_at: string | null;
}

const genRef = (prefix: string) =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const Transfers = () => {
  const pinRef = useRef<PinGateHandle>(null);
  const requirePin = async () => (await pinRef.current?.ensure()) === true;
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [pending, setPending] = useState<PendingTx[]>([]);
  const [selectedTx, setSelectedTx] = useState<PendingTx | null>(null);

  // Internal
  const [fromAccount, setFromAccount] = useState("");
  const [toAccount, setToAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [intNote, setIntNote] = useState("");
  const [loading, setLoading] = useState(false);

  // External — dynamic per-currency banking profile
  const [extFrom, setExtFrom] = useState("");
  const [extAmount, setExtAmount] = useState("");
  const [extRecipient, setExtRecipient] = useState("");
  const [extEmail, setExtEmail] = useState("");
  const [extFields, setExtFields] = useState<Record<string, string>>({});
  const [extMemo, setExtMemo] = useState("");
  const [extLoading, setExtLoading] = useState(false);
  const [schemeId, setSchemeId] = useState<string>("");

  // Zelle
  const [zFrom, setZFrom] = useState("");
  const [zAmount, setZAmount] = useState("");
  const [zRecipient, setZRecipient] = useState("");
  const [zContact, setZContact] = useState("");
  const [zMemo, setZMemo] = useState("");
  const [zLoading, setZLoading] = useState(false);


  // Country-driven Send Money (per top currency switcher)
  const [smFrom, setSmFrom] = useState("");
  const [smMethodId, setSmMethodId] = useState<string>("");
  const [smAmount, setSmAmount] = useState("");
  const [smRecipient, setSmRecipient] = useState("");
  const [smEmail, setSmEmail] = useState("");
  const [smFields, setSmFields] = useState<Record<string, string>>({});
  const [smNote, setSmNote] = useState("");
  const [smVariant, setSmVariant] = useState<string>("");
  const [smLoading, setSmLoading] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const { toast } = useToast();
  const { format, convert, toUsd, currency } = useCurrency();

  useEffect(() => {
    fetchAccounts();
    fetchPending();
  }, []);

  const fetchAccounts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("accounts").select("id, account_name, account_number, balance").eq("user_id", user.id);
    if (data) setAccounts(data);
  };

  const fetchPending = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("transactions")
      .select("id, account_id, category, description, amount, status, reference_number, created_at")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setPending(data as PendingTx[]);
  };


  // Balances are stored in USD; format() converts to the selected currency for display.
  const formatCurrency = (usdAmount: number) => format(usdAmount);

  const handleInternalTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromAccount || !toAccount || !amount) return;
    if (!(await requirePin())) return;
    setLoading(true);
    try {
      const transferAmountDisplay = parseFloat(amount);
      const transferAmount = toUsd(transferAmountDisplay); // store as USD
      const fromAcc = accounts.find((a) => a.id === fromAccount);
      const toAcc = accounts.find((a) => a.id === toAccount);
      if (!fromAcc || !toAcc) throw new Error("Invalid accounts");
      if (fromAcc.balance < transferAmount) throw new Error("Insufficient funds");

      await supabase.rpc("adjust_account_balance", { p_account: fromAccount, p_delta: -transferAmount });
      await supabase.rpc("adjust_account_balance", { p_account: toAccount, p_delta: transferAmount });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      await supabase.from("transactions").insert([
        {
          user_id: user.id,
          account_id: fromAccount,
          transaction_type: "debit",
          category: "Transfer Out",
          description: `Transfer to ${toAcc.account_name}${intNote ? ` — ${intNote}` : ""}`,
          amount: transferAmount,
          balance_after: fromAcc.balance - transferAmount,
          status: "completed",
          reference_number: genRef("INT"),
        },
        {
          user_id: user.id,
          account_id: toAccount,
          transaction_type: "credit",
          category: "Transfer In",
          description: `Transfer from ${fromAcc.account_name}${intNote ? ` — ${intNote}` : ""}`,
          amount: transferAmount,
          balance_after: toAcc.balance + transferAmount,
          status: "completed",
          reference_number: genRef("INT"),
        },
      ]);

      toast({ title: "Transfer Successful", description: `Transferred ${formatCurrency(transferAmount)}` });
      setAmount("");
      setIntNote("");
      fetchAccounts();
    } catch (error: any) {
      toast({ title: "Transfer Failed", description: error.message, variant: "destructive" });

    } finally {
      setLoading(false);
    }
  };

  const schemes = getBankingSchemes(currency.code);
  const profile = getBankingProfile(currency.code, schemeId);

  // Reset scheme + collected fields whenever the currency changes so we always
  // start from the default profile for that country.
  useEffect(() => {
    setSchemeId(schemes[0]?.id ?? "");
    setExtFields({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency.code]);

  const handleExternalTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing = profile.fields
      .filter((f) => f.required !== false && !(extFields[f.key] ?? "").trim())
      .map((f) => f.label);
    if (!extFrom || !extAmount || !extRecipient || missing.length) {
      toast({
        title: "Missing details",
        description: missing.length
          ? `Please complete: ${missing.join(", ")}`
          : "Please complete all required fields.",
        variant: "destructive",
      });
      return;
    }
    const amtDisplay = parseFloat(extAmount);
    const amt = toUsd(amtDisplay);
    const fromAcc = accounts.find((a) => a.id === extFrom);
    if (!fromAcc) return;
    if (fromAcc.balance < amt) {
      toast({ title: "Insufficient funds", variant: "destructive" });
      return;
    }
    if (!(await requirePin())) return;
    setExtLoading(true);
    try {
      const ref = genRef("EXT");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      // Build a human-readable summary of the profile-specific fields for the
      // transaction description and email body.
      const detailPairs = profile.fields
        .map((f) => [f.label, (extFields[f.key] ?? "").trim()] as const)
        .filter(([, v]) => v.length > 0);
      const detailString = detailPairs.map(([k, v]) => `${k}: ${v}`).join(" · ");
      const details = Object.fromEntries(detailPairs);

      const newBal = fromAcc.balance - amt;
      await supabase.rpc("adjust_account_balance", { p_account: extFrom, p_delta: -amt });
      const { data, error } = await supabase
        .from("transactions")
        .insert({
          user_id: user.id,
          account_id: extFrom,
          transaction_type: "debit",
          category: "External Transfer",
          description: `[${profile.scheme}] To ${extRecipient} — ${detailString}${extMemo ? ` — ${extMemo}` : ""}`,
          amount: amt,
          balance_after: newBal,
          status: "pending",
          reference_number: ref,
          recipient_email: extEmail || null,
          recipient_name: extRecipient || null,
        })
        .select()
        .single();
      if (error) throw error;
      supabase.functions.invoke("send-transfer-confirmation", {
        body: {
          type: "External Transfer",
          amount: amtDisplay,
          currency: currency.code,
          recipient: extRecipient,
          recipientEmail: extEmail || undefined,
          scheme: profile.scheme,
          region: profile.region,
          settlement: profile.settlement,
          details,
          memo: extMemo || undefined,
          reference: ref,
          status: "pending",
        },
      }).catch((e) => console.error("confirmation email failed", e));
      toast({
        title: `${profile.scheme} submitted — Pending approval`,
        description: extEmail
          ? `Ref ${ref}. Receipts emailed to you and ${extEmail}.`
          : `Ref ${ref}. Confirmation email sent. Support will reach out shortly.`,
      });
      setExtAmount(""); setExtRecipient(""); setExtEmail(""); setExtFields({}); setExtMemo("");

      if (data) setSelectedTx(data as PendingTx);
      fetchAccounts();
      fetchPending();
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    } finally {
      setExtLoading(false);
    }
  };

  // ---- Country-driven Send Money (driven by top currency switcher) ----
  const methods = getCountryMethods(currency.code);
  const smMethod: CountryMethod = methods.find((m) => m.id === smMethodId) ?? methods[0];

  useEffect(() => {
    setSmMethodId(methods[0]?.id ?? "");
    setSmFields({});
    setSmVariant("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency.code]);

  const handleSendMoney = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing = smMethod.fields
      .filter((f) => f.required !== false && !(smFields[f.key] ?? "").trim())
      .map((f) => f.label);
    if (!smFrom || !smAmount || missing.length) {
      toast({
        title: "Missing details",
        description: missing.length ? `Please complete: ${missing.join(", ")}` : "Please complete all required fields.",
        variant: "destructive",
      });
      return;
    }
    const amtDisplay = parseFloat(smAmount);
    if (!(amtDisplay > 0)) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    const amt = toUsd(amtDisplay);
    const fromAcc = accounts.find((a) => a.id === smFrom);
    if (!fromAcc) return;
    if (fromAcc.balance < amt) {
      toast({ title: "Insufficient funds", variant: "destructive" });
      return;
    }
    if (!(await requirePin())) return;
    setSmLoading(true);
    try {
      const ref = genRef(smMethod.id.toUpperCase().slice(0, 4));
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const detailPairs = smMethod.fields
        .map((f) => [f.label, (smFields[f.key] ?? "").trim()] as const)
        .filter(([, v]) => v.length > 0);
      const detailString = detailPairs.map(([k, v]) => `${k}: ${v}`).join(" · ");
      const details = Object.fromEntries(detailPairs);
      const displayName = smRecipient || smFields.handle || smFields.upi_id || smFields.pix_key || smEmail || "recipient";

      const newBal = fromAcc.balance - amt;
      await supabase.rpc("adjust_account_balance", { p_account: smFrom, p_delta: -amt });
      const { data, error } = await supabase
        .from("transactions")
        .insert({
          user_id: user.id,
          account_id: smFrom,
          transaction_type: "debit",
          category: smMethod.name,
          description: `[${smMethod.name}] To ${displayName} — ${detailString}${smNote ? ` — ${smNote}` : ""}${smVariant ? ` (${smVariant === "gs" ? "Goods & Services" : "Friends & Family"})` : ""}`,
          amount: amt,
          balance_after: newBal,
          status: "pending",
          reference_number: ref,
          recipient_email: smEmail || null,
          recipient_name: smRecipient || null,
        })
        .select()
        .single();
      if (error) throw error;


      supabase.functions.invoke("send-transfer-confirmation", {
        body: {
          type: smMethod.name,
          amount: amtDisplay,
          currency: currency.code,
          recipient: displayName,
          recipientEmail: smEmail,
          scheme: smMethod.name,
          region: currency.name,
          settlement: smMethod.settlement,
          details,
          memo: smNote || undefined,
          reference: ref,
          status: "pending",
        },
      }).catch((e) => console.error("confirmation email failed", e));

      const { data: profileRow } = await supabase.auth.getUser();
      const senderName = (profileRow?.user?.user_metadata?.full_name as string) || (profileRow?.user?.email ?? "You");

      setReceipt({
        method: smMethod,
        amount: amtDisplay,
        currencyCode: currency.code,
        currencySymbol: currency.symbol,
        senderName,
        recipientName: displayName,
        recipientEmail: smEmail,
        fields: details,
        note: smNote || undefined,
        variant: smVariant || undefined,
        reference: ref,
        timestamp: new Date().toISOString(),
      });

      toast({
        title: `${smMethod.name} sent — Pending approval`,
        description: smEmail ? `Ref ${ref}. Receipts emailed to you and ${smEmail}.` : `Ref ${ref}. Receipt emailed to you.`,
      });
      setSmAmount(""); setSmRecipient(""); setSmEmail(""); setSmFields({}); setSmNote(""); setSmVariant("");
      fetchAccounts();
      fetchPending();
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    } finally {
      setSmLoading(false);
    }
  };

  const handleZelleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zFrom || !zAmount || !zRecipient || !zContact) {
      toast({ title: "Missing details", description: "Please complete all required fields.", variant: "destructive" });
      return;
    }
    const amtDisplay = parseFloat(zAmount);
    const amt = toUsd(amtDisplay);
    const fromAcc = accounts.find((a) => a.id === zFrom);
    if (!fromAcc) return;
    if (fromAcc.balance < amt) {
      toast({ title: "Insufficient funds", variant: "destructive" });
      return;
    }
    if (!(await requirePin())) return;
    setZLoading(true);
    try {
      const ref = genRef("ZEL");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const newBal = fromAcc.balance - amt;
      await supabase.rpc("adjust_account_balance", { p_account: zFrom, p_delta: -amt });
      const { data, error } = await supabase
        .from("transactions")
        .insert({
          user_id: user.id,
          account_id: zFrom,
          transaction_type: "debit",
          category: "Zelle",
          description: `Zelle to ${zRecipient} (${zContact})${zMemo ? ` — ${zMemo}` : ""}`,
          amount: amt,
          balance_after: newBal,
          status: "pending",
          reference_number: ref,
          recipient_email: zContact.includes("@") ? zContact : null,
          recipient_name: zRecipient || null,
        })
        .select()
        .single();
      if (error) throw error;
      supabase.functions.invoke("send-transfer-confirmation", {
        body: {
          type: "Zelle",
          amount: amtDisplay,
          currency: currency.code,
          recipient: zRecipient,
          recipientEmail: zContact.includes("@") ? zContact : undefined,
          detail: `${zContact}${zMemo ? ` — ${zMemo}` : ""}`,
          memo: zMemo || undefined,
          reference: ref,
          status: "pending",
        },
      }).catch((e) => console.error("confirmation email failed", e));
      toast({
        title: "Zelle submitted — Pending approval",
        description: `Ref ${ref}. Confirmation email sent. Support will reach out shortly.`,
      });

      setZAmount(""); setZRecipient(""); setZContact(""); setZMemo("");
      if (data) setSelectedTx(data as PendingTx);
      fetchAccounts();
      fetchPending();
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    } finally {
      setZLoading(false);
    }
  };

  return (
    <AuthLayout currentPage="transfers">
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div>
          <h2 className="text-3xl font-bold text-secondary mb-2">Transfers</h2>
          <p className="text-muted-foreground">Move money between your accounts, to external banks, or via Zelle</p>
        </div>

        <Tabs defaultValue="send" className="w-full">
          <TabsList className="flex w-full overflow-x-auto gap-2 rounded-xl bg-muted/50 p-2 sm:grid sm:grid-cols-4 sm:overflow-visible scrollbar-none">
            <TabsTrigger value="send" className="shrink-0 gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span className="sm:hidden">Send</span>
              <span className="hidden sm:inline">Send Money</span>
            </TabsTrigger>
            <TabsTrigger value="internal" className="shrink-0 gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary">
              <ArrowRightLeft className="h-4 w-4 shrink-0" />
              <span className="sm:hidden">Between</span>
              <span className="hidden sm:inline">Between Accounts</span>
            </TabsTrigger>
            <TabsTrigger value="external" className="shrink-0 gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary">
              <Building className="h-4 w-4 shrink-0" />
              <span className="sm:hidden">External</span>
              <span className="hidden sm:inline">External</span>
            </TabsTrigger>
            <TabsTrigger value="zelle" className="shrink-0 gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary">
              <Send className="h-4 w-4 shrink-0" />
              <span className="sm:hidden">Zelle</span>
              <span className="hidden sm:inline">Zelle</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="send">
            <Card className="border-primary/20">
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Send Money
                  </CardTitle>
                  <span className="inline-flex items-center gap-1.5 rounded-full border bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    <Globe2 className="h-3.5 w-3.5" />
                    {currency.code} · {currency.name}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Methods below match the country selected in the top currency switcher.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Choose a method</Label>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {methods.map((m) => {
                      const active = m.id === smMethod.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => { setSmMethodId(m.id); setSmFields({}); setSmVariant(""); }}
                          className={`text-left rounded-xl border p-3 transition-all active:scale-[0.98] ${
                            active
                              ? "border-primary ring-2 ring-primary/40 bg-primary/5 shadow-sm"
                              : "border-border hover:border-primary/40 hover:bg-muted/50"
                          }`}
                        >
                          <div className="grid grid-cols-[auto_1fr_auto] items-start gap-3">
                            <div className={`h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br ${m.accent} text-white text-lg font-bold flex items-center justify-center shadow-sm`}>
                              {m.glyph}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-secondary leading-tight">{m.name}</div>
                              <p className="text-xs text-muted-foreground truncate">{m.tagline}</p>
                            </div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap pt-0.5 min-w-fit">{m.settlement}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <form onSubmit={handleSendMoney} className="space-y-4">
                  <div>
                    <Label>From Account</Label>
                    <Select value={smFrom} onValueChange={setSmFrom}>
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {accounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.account_name} - ****{acc.account_number} ({formatCurrency(acc.balance)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Amount ({currency.code})</Label>
                      <Input type="number" step="0.01" placeholder="0.00" value={smAmount} onChange={(e) => setSmAmount(e.target.value)} />
                    </div>
                    <div>
                      <Label>Recipient Name</Label>
                      <Input value={smRecipient} onChange={(e) => setSmRecipient(e.target.value)} placeholder="Jane Doe" />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Recipient Email <span className="text-xs text-muted-foreground">(optional)</span></Label>
                      <Input type="email" value={smEmail} onChange={(e) => setSmEmail(e.target.value)} placeholder="name@email.com" />
                      <p className="mt-1 text-[11px] text-muted-foreground">If provided, the recipient will receive a matching receipt with pending status.</p>
                    </div>

                    {smMethod.variants && (
                      <div className="sm:col-span-2">
                        <Label>Payment Type</Label>
                        <Select value={smVariant} onValueChange={setSmVariant}>
                          <SelectTrigger><SelectValue placeholder="Select payment type" /></SelectTrigger>
                          <SelectContent>
                            {smMethod.variants.map((v) => (
                              <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {smMethod.fields.map((f) => (
                      <div key={f.key} className={f.help || f.key === "note" ? "sm:col-span-2" : ""}>
                        <Label>
                          {f.label}
                          {f.required === false && <span className="ml-1 text-xs text-muted-foreground">(optional)</span>}
                        </Label>
                        <Input
                          value={f.key === "note" ? smNote : (smFields[f.key] ?? "")}
                          onChange={(e) => {
                            const v = f.uppercase ? e.target.value.toUpperCase() : e.target.value;
                            if (f.key === "note") setSmNote(v);
                            else setSmFields((prev) => ({ ...prev, [f.key]: v }));
                          }}
                          placeholder={f.placeholder}
                          inputMode={f.inputMode}
                          maxLength={f.maxLength}
                        />
                        {f.help && <p className="mt-1 text-[11px] text-muted-foreground">{f.help}</p>}
                      </div>
                    ))}
                  </div>

                  <Button type="submit" className="w-full" disabled={smLoading}>
                    {smLoading ? "Sending..." : `Send with ${smMethod.name}`}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>


          <TabsContent value="internal">
            <Card>
              <CardHeader><CardTitle>Transfer Between Your Accounts</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleInternalTransfer} className="space-y-4">
                  <div>
                    <Label>From Account</Label>
                    <Select value={fromAccount} onValueChange={setFromAccount}>
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {accounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.account_name} - ****{acc.account_number} ({formatCurrency(acc.balance)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>To Account</Label>
                    <Select value={toAccount} onValueChange={setToAccount}>
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {accounts.filter((a) => a.id !== fromAccount).map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>{acc.account_name} - ****{acc.account_number}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Amount</Label>
                    <Input type="number" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </div>
                  <div>
                    <Label>Note <span className="text-xs text-muted-foreground">(optional)</span></Label>
                    <Input value={intNote} onChange={(e) => setIntNote(e.target.value)} placeholder="e.g. Savings top-up" />
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Processing..." : "Transfer Now"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="external">
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Building className="h-5 w-5 text-primary" />External Bank Transfer</CardTitle>
                <div className="flex items-start gap-2 rounded-lg border border-success/20 bg-success/5 p-3 text-xs text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <p>Transfers to outside banks are reviewed by our support team before release.</p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs">
                  <Globe2 className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium">{currency.code} · {profile.scheme}</span>
                  <span className="text-muted-foreground">· {profile.region}</span>
                  <Badge variant="secondary" className="ml-auto">{profile.settlement}</Badge>
                </div>

                <div className="mt-3 space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Transfer style for {currency.code}
                  </Label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {schemes.map((s) => {
                      const active = s.id === profile.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => { setSchemeId(s.id); setExtFields({}); }}
                          className={`text-left rounded-xl border px-3 py-3 transition-all active:scale-[0.98] ${
                            active
                              ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                              : "border-border bg-card hover:border-primary/40 hover:bg-muted/50"
                          }`}
                        >
                          <div className="grid grid-cols-[1fr_auto] items-start gap-2">
                            <span className="font-semibold text-sm text-secondary leading-tight">{s.scheme}</span>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap pt-0.5">{s.settlement}</span>
                          </div>
                          {s.tagline && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">{s.tagline}</p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Switch currency in the top-right to see transfer styles for another country.
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleExternalTransfer} className="space-y-4">
                  <div>
                    <Label>From Account</Label>
                    <Select value={extFrom} onValueChange={setExtFrom}>
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {accounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.account_name} - ****{acc.account_number} ({formatCurrency(acc.balance)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Recipient Name</Label>
                      <Input value={extRecipient} onChange={(e) => setExtRecipient(e.target.value)} placeholder="Jane Doe" />
                    </div>
                    <div>
                      <Label>Amount ({currency.code})</Label>
                      <Input type="number" step="0.01" placeholder="0.00" value={extAmount} onChange={(e) => setExtAmount(e.target.value)} />
                    </div>
                    {profile.fields.map((f) => (
                      <div key={f.key} className={f.help ? "sm:col-span-2" : ""}>
                        <Label>
                          {f.label}
                          {f.required === false && <span className="ml-1 text-xs text-muted-foreground">(optional)</span>}
                        </Label>
                        <Input
                          value={extFields[f.key] ?? ""}
                          onChange={(e) => {
                            const v = f.uppercase ? e.target.value.toUpperCase() : e.target.value;
                            setExtFields((prev) => ({ ...prev, [f.key]: v }));
                          }}
                          placeholder={f.placeholder}
                          inputMode={f.inputMode}
                          maxLength={f.maxLength}
                        />
                        {f.help && <p className="mt-1 text-[11px] text-muted-foreground">{f.help}</p>}
                      </div>
                    ))}
                    <div className="sm:col-span-2">
                      <Label>Recipient Email <span className="text-xs text-muted-foreground">(optional)</span></Label>
                      <Input type="email" value={extEmail} onChange={(e) => setExtEmail(e.target.value)} placeholder="name@email.com" />
                      <p className="mt-1 text-[11px] text-muted-foreground">If provided, a matching pending receipt will be emailed to the recipient.</p>
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Note / Memo <span className="text-xs text-muted-foreground">(optional)</span></Label>
                      <Input value={extMemo} onChange={(e) => setExtMemo(e.target.value)} placeholder="Invoice #123" />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={extLoading}>
                    {extLoading ? "Submitting..." : `Submit ${profile.scheme} for Approval`}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>


          <TabsContent value="zelle">
            <Card className="border-accent/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-accent" />Send Money with Zelle</CardTitle>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-success" />
                  Zelle payments are held pending approval by a support specialist.
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleZelleTransfer} className="space-y-4">
                  <div>
                    <Label>From Account</Label>
                    <Select value={zFrom} onValueChange={setZFrom}>
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {accounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.account_name} - ****{acc.account_number} ({formatCurrency(acc.balance)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Recipient Name</Label>
                      <Input value={zRecipient} onChange={(e) => setZRecipient(e.target.value)} placeholder="John Smith" />
                    </div>
                    <div>
                      <Label>Email or Phone</Label>
                      <Input value={zContact} onChange={(e) => setZContact(e.target.value)} placeholder="name@email.com or (555) 555‑5555" />
                    </div>
                    <div>
                      <Label>Amount</Label>
                      <Input type="number" step="0.01" placeholder="0.00" value={zAmount} onChange={(e) => setZAmount(e.target.value)} />
                    </div>
                    <div>
                      <Label>Memo (optional)</Label>
                      <Input value={zMemo} onChange={(e) => setZMemo(e.target.value)} placeholder="Dinner last night" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-accent hover:bg-accent/90" disabled={zLoading}>
                    {zLoading ? "Submitting..." : "Send with Zelle"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-warning" />Pending Transfers</CardTitle>
            <p className="text-sm text-muted-foreground">Tap a transfer to view its approval status.</p>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No pending transfers.</p>
            ) : (
              <div className="space-y-2">
                {pending.map((tx) => (
                  <button
                    key={tx.id}
                    onClick={() => setSelectedTx(tx)}
                    className="w-full flex items-center justify-between rounded-lg border bg-muted/40 p-4 text-left transition hover:bg-muted hover:shadow-sm"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-secondary truncate">{tx.category}</span>
                        <Badge variant="outline" className="border-warning/40 text-warning bg-warning/10">Pending</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Ref {tx.reference_number}</p>
                    </div>
                    <div className="text-right font-bold text-foreground">-{formatCurrency(Number(tx.amount))}</div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedTx} onOpenChange={(o) => !o && setSelectedTx(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              Transfer Pending Approval
            </DialogTitle>
            <DialogDescription>
              Your transfer has been received and is awaiting review by our support team.
            </DialogDescription>
          </DialogHeader>
          {selectedTx && (
            <div className="space-y-3 rounded-lg border bg-muted/40 p-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-medium">{selectedTx.category}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-semibold">{formatCurrency(Number(selectedTx.amount))}</span></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Details</span><span className="text-right">{selectedTx.description}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><span className="font-mono text-xs">{selectedTx.reference_number}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span>
                <Badge variant="outline" className="border-warning/40 text-warning bg-warning/10">Pending Approval</Badge>
              </div>
            </div>
          )}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
            <p className="font-semibold text-secondary flex items-center gap-2"><Mail className="h-4 w-4 text-primary" />Support will reach out</p>
            <p className="text-muted-foreground mt-1">
              A specialist will contact you shortly to confirm and approve this transfer. You'll receive an email
              update once the review is complete — typically within 24 hours.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => { setSelectedTx(null); window.dispatchEvent(new Event("open-ai-chat")); }}
            >
              Chat with Support
            </Button>
            <Button onClick={() => setSelectedTx(null)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TransferReceipt open={!!receipt} onClose={() => setReceipt(null)} receipt={receipt} />
      <TransferPinGate ref={pinRef} />
    </AuthLayout>
  );
};

export default Transfers;
