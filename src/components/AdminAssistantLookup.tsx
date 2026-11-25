import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftRight, Loader2, Search, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminAiReview } from "@/components/AdminAiReview";
import { AdminDecisionPanel } from "@/components/AdminDecisionPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatAbsIn, currencyInfo } from "@/lib/fx";
import { isTransactionId, lookupPattern, uniqueLookupRows } from "@/lib/admin-lookup";

type Member = { id: string; full_name: string | null; email: string };
type Transaction = { id: string; user_id: string; amount: number; currency: string; status: string | null; description: string; reference_number: string | null };
const columns = "id,user_id,amount,currency,status,description,reference_number";

export function AdminAssistantLookup({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selected, setSelected] = useState<Member | null>(null);
  const [transactionId, setTransactionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);
  useEffect(() => () => { request.current += 1; }, []);
  const go = (path: string) => { onNavigate?.(); navigate(path); };

  const lookup = async () => {
    if (query.trim().length < 2) { setError("Enter at least two characters."); return; }
    const current = ++request.current;
    setBusy(true); setError(""); setSelected(null); setTransactionId(""); setMembers([]); setTransactions([]); setSearched(false);
    try {
      const pattern = lookupPattern(query);
      const [byName, byEmail, byRef, byRecipient, byRecipientEmail, byId] = await Promise.all([
        supabase.from("profiles").select("id,full_name,email").ilike("full_name", pattern).limit(20),
        supabase.from("profiles").select("id,full_name,email").ilike("email", pattern).limit(20),
        supabase.from("transactions").select(columns).ilike("reference_number", pattern).limit(20),
        supabase.from("transactions").select(columns).ilike("recipient_name", pattern).limit(20),
        supabase.from("transactions").select(columns).ilike("recipient_email", pattern).limit(20),
        isTransactionId(query) ? supabase.from("transactions").select(columns).eq("id", query.trim()).limit(1) : Promise.resolve({ data: [], error: null }),
      ]);
      const failure = [byName, byEmail, byRef, byRecipient, byRecipientEmail, byId].find(result => result.error)?.error;
      if (failure) throw failure;
      let foundMembers = uniqueLookupRows([byName.data || [], byEmail.data || []]);
      const memberTx = foundMembers.length ? await supabase.from("transactions").select(columns).in("user_id", foundMembers.map(member => member.id)).order("created_at", { ascending: false }).limit(30) : { data: [], error: null };
      if (memberTx.error) throw memberTx.error;
      const foundTx = uniqueLookupRows([byId.data || [], byRef.data || [], byRecipient.data || [], byRecipientEmail.data || [], memberTx.data || []]);
      const missing = Array.from(new Set(foundTx.map(tx => tx.user_id))).filter(id => !foundMembers.some(member => member.id === id));
      if (missing.length) {
        const owners = await supabase.from("profiles").select("id,full_name,email").in("id", missing);
        if (owners.error) throw owners.error;
        foundMembers = uniqueLookupRows([foundMembers, owners.data || []]);
      }
      if (current !== request.current) return;
      setMembers(foundMembers); setTransactions(foundTx); setSearched(true);
    } catch { if (current === request.current) setError("Unable to search records. Please try again."); }
    finally { if (current === request.current) setBusy(false); }
  };

  return <section className="space-y-4 min-w-0" aria-label="Admin AI lookup">
    <h3 className="text-sm font-semibold">Find a member or transaction</h3>
    <form className="flex gap-2" onSubmit={event => { event.preventDefault(); void lookup(); }}>
      <Input aria-label="Name, email or transaction ID" placeholder="Name, email, transaction ID or reference" value={query} onChange={event => setQuery(event.target.value)} className="min-w-0" />
      <Button type="submit" size="icon" disabled={busy} aria-label="Search admin records" title="Search admin records" className="shrink-0">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</Button>
    </form>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {searched && members.length === 0 && transactions.length === 0 && <p className="text-sm text-muted-foreground">No matching records.</p>}
    {members.length > 0 && <div className="space-y-2"><h4 className="text-xs font-semibold text-muted-foreground">Members</h4>{members.map(member => <Button key={member.id} variant={selected?.id === member.id && !transactionId ? "secondary" : "outline"} className="w-full h-auto min-h-10 justify-start text-left whitespace-normal" onClick={() => { setSelected(member); setTransactionId(""); }}><Users className="mr-2 h-4 w-4 shrink-0" /><span className="min-w-0 break-words">{member.full_name || "Member"}<span className="block text-xs text-muted-foreground break-all">{member.email}</span></span></Button>)}</div>}
    {transactions.length > 0 && <div className="space-y-2"><h4 className="text-xs font-semibold text-muted-foreground">Matching transactions · up to 30 recent per member search</h4><div className="max-h-64 overflow-y-auto space-y-2">{transactions.map(tx => <Button key={tx.id} variant={transactionId === tx.id ? "secondary" : "outline"} className="w-full h-auto !rounded-lg justify-start text-left whitespace-normal" onClick={() => { setSelected(members.find(member => member.id === tx.user_id) || null); setTransactionId(tx.id); }}><ArrowLeftRight className="mr-2 h-4 w-4 shrink-0" /><span className="min-w-0 break-words"><span className="line-clamp-2">{tx.description || "Transaction"}</span><span className="block">{Number(tx.amount) < 0 ? "−" : "+"}{formatAbsIn(currencyInfo(tx.currency).code, tx.amount)} · {tx.status || "Unknown"}</span><span className="block text-xs text-muted-foreground break-all">ID: {tx.id}{tx.reference_number ? ` · ${tx.reference_number}` : ""}</span></span></Button>)}</div></div>}
    {selected && <><p className="text-sm font-medium break-words">Selected: {selected.full_name || selected.email}</p><AdminAiReview key={`${selected.id}-${transactionId}`} userId={selected.id} transactionId={transactionId || undefined} /><AdminDecisionPanel key={`d-${selected.id}-${transactionId}`} userId={selected.id} transactionId={transactionId || undefined} /><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => go(`/admin/users?member=${encodeURIComponent(selected.id)}`)}><Users className="mr-2 h-4 w-4" />Manage member</Button><Button variant="outline" onClick={() => go(`/admin/transactions?${transactionId ? `transaction=${encodeURIComponent(transactionId)}` : `member=${encodeURIComponent(selected.id)}`}`)}><ArrowLeftRight className="mr-2 h-4 w-4" />Review / process manually</Button></div></>}
  </section>;
}