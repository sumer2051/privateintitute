import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { COINS } from "@/lib/coins";
import { toast } from "sonner";

// Records nothing and moves nothing — only emails the member an honest "not processed" notice.
export function WithdrawNotice({ onClose }: { onClose: () => void }) {
  const [symbol, setSymbol] = useState("BTC");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    setBusy(true);
    const { error } = await supabase.functions.invoke("withdrawal-request-notice", { body: { symbol, amount: amt, address: address.trim(), email: email.trim() } });
    setBusy(false);
    if (error) return toast.error("Could not send the notice email");
    setDone(true);
  };

  return (
    <section id="coin-withdraw" className="investment-action-sheet mt-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">External withdrawal</h2>
          <p className="mt-1 text-xs text-muted-foreground">Not available yet. No coins will be sent — you'll get an email confirming your request was received.</p>
        </div>
        <Button size="icon" variant="ghost" className="investment-icon-button" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></Button>
      </div>
      {done ? (
        <p className="mt-4 text-sm">Request noted. Check your email. Your balance is unchanged.</p>
      ) : (
        <form className="mt-4 space-y-3" onSubmit={submit}>
          <select className="investment-input w-full text-sm" value={symbol} onChange={(e) => setSymbol(e.target.value)} aria-label="Coin">
            {COINS.map((c) => <option key={c.symbol} value={c.symbol}>{c.symbol}</option>)}
          </select>
          <input className="investment-input w-full font-mono text-sm" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="External wallet address" maxLength={120} aria-label="Wallet address" />
          <input className="investment-input w-full text-sm" type="number" step="any" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" aria-label="Amount" />
          <input className="investment-input w-full text-sm" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email for the confirmation" maxLength={120} aria-label="Email" />
          <Button type="submit" className="investment-primary w-full" disabled={busy || address.trim().length < 10 || !amount || !email.trim()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit request"}</Button>
        </form>
      )}
    </section>
  );
}
