import { useEffect, useState } from "react";
import { Smartphone, Lock, Snowflake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { viewAsFrameName } from "@/lib/view-as";

type Member = { id: string; full_name: string | null; email: string; preferred_currency?: string | null; ui_theme?: string | null };
type Acct = { id: string; account_name: string; account_number: string; account_type: string; balance: number; available_balance: number; is_frozen: boolean | null; is_active: boolean | null };
type Tx = { id: string; description: string; amount: number; status: string | null; currency: string; transaction_type: string; created_at: string };
type Notice = { id: string; title: string; body: string };
type Dev = { id: string; label: string | null; platform: string | null; is_blocked: boolean; is_revoked: boolean; view_only: boolean; can_transfer: boolean; last_seen: string };

/** Read-only phone-sized view of what a member sees, built from admin-readable data. Never signs in as the member. */
export function AdminMemberPhonePreview({ member }: { member: Member }) {
  const [open, setOpen] = useState(false);
  const [accts, setAccts] = useState<Acct[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [devices, setDevices] = useState<Dev[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void Promise.all([
      supabase.from("accounts").select("id,account_name,account_number,account_type,balance,available_balance,is_frozen,is_active").eq("user_id", member.id),
      supabase.from("transactions").select("id,description,amount,status,currency,transaction_type,created_at").eq("user_id", member.id).order("created_at", { ascending: false }).limit(15),
      supabase.from("announcements").select("id,title,body,target_user_id").eq("active", true).or(`target_user_id.is.null,target_user_id.eq.${member.id}`).limit(5),
      supabase.from("user_devices").select("id,label,platform,is_blocked,is_revoked,view_only,can_transfer,last_seen").eq("user_id", member.id).order("last_seen", { ascending: false }).limit(5),
    ]).then(([a, t, n, d]) => {
      setAccts((a.data as Acct[]) || []); setTxs((t.data as Tx[]) || []); setNotices((n.data as Notice[]) || []); setDevices((d.data as Dev[]) || []);
      setLoading(false);
    });
  }, [open, member.id]);
  const issues = [
    ...accts.filter(a => a.is_frozen).map(a => `${a.account_name} is frozen`),
    ...accts.filter(a => a.is_active === false).map(a => `${a.account_name} is inactive`),
    ...devices.filter(d => d.is_blocked || d.is_revoked).map(d => `Device ${d.label || d.platform || ""} is ${d.is_blocked ? "blocked" : "signed out"}`),
    ...devices.filter(d => d.view_only || !d.can_transfer).map(d => `Device ${d.label || d.platform || ""} can't send transfers`),
    ...txs.filter(t => ["pending", "under_review", "compliance_hold"].includes(t.status || "")).map(t => `“${t.description}” is ${t.status?.replace("_", " ")}`),
  ];
  return <>
    <Button size="sm" variant="outline" className="w-full md:w-auto" onClick={() => setOpen(true)}><Smartphone className="mr-1 h-4 w-4" />View as member</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[460px] max-h-[95dvh] overflow-y-auto p-4">
        <DialogHeader>
          <DialogTitle>Member's phone view</DialogTitle>
          <DialogDescription>The real bank as {member.full_name || member.email} sees it on a phone. You can tap around; nothing can be changed.</DialogDescription>
        </DialogHeader>
        <div className="mx-auto w-[410px] max-w-full rounded-[2.5rem] border-[10px] border-foreground bg-background shadow-xl overflow-hidden">
          {open && <iframe title={`${member.full_name || member.email} phone view`} name={viewAsFrameName({ id: member.id, email: member.email, name: member.full_name || member.email })} src={`${import.meta.env.BASE_URL}`} className="block h-[min(760px,70dvh)] w-full border-0" />}
        </div>
        <section className="space-y-1">
          <h4 className="flex items-center gap-1 text-sm font-semibold"><Lock className="h-4 w-4" />Possible issues</h4>
          {loading ? null : issues.length === 0 ? <p className="text-sm text-muted-foreground">Nothing blocking this member.</p> :
            <ul className="list-disc pl-5 text-sm">{issues.map((i, k) => <li key={k}>{i}</li>)}</ul>}
        </section>
      </DialogContent>
    </Dialog>
  </>;
}
