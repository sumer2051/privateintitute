import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftRight, Loader2, ScrollText, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminAiReview } from "@/components/AdminAiReview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Member = { id: string; full_name: string | null; email: string };

export function AdminAssistantDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError("");
    supabase.from("profiles").select("id,full_name,email").order("created_at", { ascending: false }).then(({ data, error: failure }) => {
      if (!active) return;
      setLoading(false);
      if (failure) { setError(failure.message); return; }
      setMembers(data || []);
    });
    return () => { active = false; };
  }, [open]);

  const go = (path: string) => { onOpenChange(false); navigate(path); };
  const filtered = members.filter(member => `${member.full_name || ""} ${member.email}`.toLowerCase().includes(search.toLowerCase()));
  const selected = members.find(member => member.id === selectedId);

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl max-h-[90dvh] overflow-y-auto p-4 sm:p-6 [&>*]:min-w-0">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 pr-6"><ShieldCheck className="h-5 w-5 shrink-0 text-primary" />Claude admin assistant</DialogTitle>
        <DialogDescription>Read-only account reviews. Credits, debits and transaction decisions require your manual action.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <label htmlFor="assistant-member-search" className="text-sm font-medium">Member</label>
        <Input id="assistant-member-search" placeholder="Search name or email" value={search} onChange={event => setSearch(event.target.value)} />
        {loading ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading members…</p> : <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger aria-label="Choose member" className="w-full [&>span]:truncate"><SelectValue placeholder="Choose member" /></SelectTrigger>
          <SelectContent>{filtered.map(member => <SelectItem key={member.id} value={member.id}>{member.full_name || member.email} {member.full_name ? `· ${member.email}` : ""}</SelectItem>)}</SelectContent>
        </Select>}
        {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
        {!loading && !error && filtered.length === 0 && <p className="text-sm text-muted-foreground">No members found.</p>}
      </div>
      {selected && <AdminAiReview key={selected.id} userId={selected.id} />}
      <div className="space-y-3 border-t pt-4">
        <h3 className="text-sm font-semibold">Manual admin controls</h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => go("/admin/users")}><Users className="mr-2 h-4 w-4" />Credit / debit users</Button>
          <Button variant="outline" onClick={() => go("/admin/transactions")}><ArrowLeftRight className="mr-2 h-4 w-4" />Process transactions</Button>
          <Button variant="ghost" onClick={() => go("/admin/audit")}><ScrollText className="mr-2 h-4 w-4" />Audit log</Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}