import { useEffect, useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ShieldAlert, Ticket, PhoneCall, Send, ArrowLeft, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

type T = {
  id: string; ticket_number: string; subject: string; description: string;
  status: string; priority: string; created_at: string; updated_at: string;
  customer_name: string; customer_email: string; user_id: string; category: string | null;
  ai_summary: string | null;
};
type M = { id: string; sender_type: string; message: string; created_at: string };
type C = { id: string; scheduled_at: string; timezone: string; reason: string; status: string; phone: string; customer_name: string; email: string; agent_notes: string | null };

const priColor: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-700", medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700", urgent: "bg-red-100 text-red-700",
};
const stColor: Record<string, string> = {
  open: "bg-blue-100 text-blue-700", pending: "bg-amber-100 text-amber-700",
  in_progress: "bg-purple-100 text-purple-700", resolved: "bg-emerald-100 text-emerald-700",
  closed: "bg-gray-200 text-gray-700",
};

export default function AdminSupport() {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tickets, setTickets] = useState<T[]>([]);
  const [calls, setCalls] = useState<C[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [active, setActive] = useState<T | null>(null);
  const [msgs, setMsgs] = useState<M[]>([]);
  const [reply, setReply] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
      const roles = (data || []).map((r: any) => r.role);
      setAllowed(roles.includes("admin") || roles.includes("support"));
    })();
  }, [navigate]);

  const load = async () => {
    const [{ data: t }, { data: c }] = await Promise.all([
      supabase.from("support_tickets").select("*").order("created_at", { ascending: false }),
      supabase.from("scheduled_calls").select("*").order("scheduled_at", { ascending: true }),
    ]);
    setTickets((t as T[]) || []);
    setCalls((c as C[]) || []);
  };
  useEffect(() => { if (allowed) load(); }, [allowed]);

  useEffect(() => {
    if (!allowed) return;
    const ch = supabase.channel("admin-support")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "scheduled_calls" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [allowed]);

  const openT = async (t: T) => {
    setActive(t);
    const { data } = await supabase.from("ticket_messages").select("*").eq("ticket_id", t.id).order("created_at");
    setMsgs((data as M[]) || []);
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("support_tickets").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(`Marked ${status.replace("_"," ")}`); if (active?.id === id) setActive({ ...active, status }); }
  };
  const setPriority = async (id: string, priority: string) => {
    await supabase.from("support_tickets").update({ priority }).eq("id", id);
    if (active?.id === id) setActive({ ...active, priority });
  };

  const sendAgentReply = async () => {
    if (!active || !reply.trim()) return;
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from("ticket_messages").insert({
      ticket_id: active.id, sender_type: "agent", sender_id: session?.user.id, message: reply.trim(),
    });
    await supabase.from("support_tickets").update({ status: "in_progress" }).eq("id", active.id);
    setMsgs((m) => [...m, { id: crypto.randomUUID(), sender_type: "agent", message: reply.trim(), created_at: new Date().toISOString() }]);
    setReply("");
  };

  const updateCall = async (id: string, patch: Partial<C>) => {
    const { error } = await supabase.from("scheduled_calls").update(patch).eq("id", id);
    if (error) toast.error(error.message); else toast.success("Updated");
  };

  const filtered = tickets.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return t.ticket_number.toLowerCase().includes(s) || t.subject.toLowerCase().includes(s)
      || t.customer_name.toLowerCase().includes(s) || t.customer_email.toLowerCase().includes(s);
  });

  const stats = {
    open: tickets.filter((t) => ["open","pending","in_progress"].includes(t.status)).length,
    urgent: tickets.filter((t) => t.priority === "urgent" && t.status !== "closed").length,
    resolved: tickets.filter((t) => t.status === "resolved" || t.status === "closed").length,
    callsToday: calls.filter((c) => new Date(c.scheduled_at).toDateString() === new Date().toDateString() && c.status === "scheduled").length,
  };

  if (allowed === null) return <AuthLayout><div className="p-6 text-sm text-muted-foreground">Checking access…</div></AuthLayout>;
  if (!allowed) return (
    <AuthLayout>
      <div className="mx-auto max-w-md p-6 text-center">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-amber-500" />
        <h1 className="text-xl font-bold">Support staff only</h1>
        <p className="text-sm text-muted-foreground mt-2">You need an admin or support role to view this dashboard.</p>
        <Button className="mt-4" onClick={() => navigate("/support")}>Back to Support</Button>
      </div>
    </AuthLayout>
  );

  return (
    <AuthLayout>
      <div className="mx-auto max-w-6xl p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h1 className="text-2xl md:text-3xl font-bold">Admin · Support</h1>
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/invitations")}>
            Manage invitations
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Active tickets" value={stats.open} icon={<Ticket className="h-4 w-4" />} />
          <Stat label="Urgent" value={stats.urgent} tone="red" icon={<TrendingUp className="h-4 w-4" />} />
          <Stat label="Resolved" value={stats.resolved} tone="emerald" />
          <Stat label="Calls today" value={stats.callsToday} tone="blue" icon={<PhoneCall className="h-4 w-4" />} />
        </div>

        {active ? (
          <Card>
            <CardHeader>
              <button onClick={() => { setActive(null); load(); }} className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">{active.ticket_number}</span>
                <Select value={active.priority} onValueChange={(v) => setPriority(active.id, v)}>
                  <SelectTrigger className="h-7 w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>{["low","medium","high","urgent"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={active.status} onValueChange={(v) => setStatus(active.id, v)}>
                  <SelectTrigger className="h-7 w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>{["open","pending","in_progress","resolved","closed"].map(s => <SelectItem key={s} value={s}>{s.replace("_"," ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <CardTitle className="mt-2">{active.subject}</CardTitle>
              <p className="text-xs text-muted-foreground">{active.customer_name} &lt;{active.customer_email}&gt;</p>
              {active.ai_summary && <p className="mt-2 text-xs bg-purple-50 dark:bg-purple-900/20 p-2 rounded"><b>AI summary:</b> {active.ai_summary}</p>}
            </CardHeader>
            <CardContent>
              <div className="max-h-[400px] space-y-3 overflow-y-auto rounded-lg bg-muted/30 p-4">
                {msgs.map((m) => (
                  <div key={m.id} className={`flex ${m.sender_type === "agent" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                      m.sender_type === "agent" ? "bg-emerald-600 text-white rounded-br-sm"
                        : m.sender_type === "customer" ? "bg-card border rounded-bl-sm"
                        : "bg-purple-100 dark:bg-purple-900/40 rounded-bl-sm"
                    }`}>
                      <p className="text-[10px] opacity-80 mb-0.5 uppercase">{m.sender_type} · {new Date(m.created_at).toLocaleString()}</p>
                      {m.message}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply as agent…" rows={2} />
                <Button onClick={sendAgentReply} disabled={!reply.trim()}><Send className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="tickets">
            <TabsList>
              <TabsTrigger value="tickets">Tickets</TabsTrigger>
              <TabsTrigger value="calls">Calls</TabsTrigger>
            </TabsList>
            <TabsContent value="tickets" className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <Input placeholder="Search ticket #, subject, customer…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {["open","pending","in_progress","resolved","closed"].map(s => <SelectItem key={s} value={s}>{s.replace("_"," ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {filtered.length === 0 ? <p className="text-sm text-muted-foreground">No tickets match.</p> : filtered.map((t) => (
                <button key={t.id} onClick={() => openT(t)} className="w-full rounded-lg border bg-card p-3 text-left hover:shadow-md transition">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{t.ticket_number}</span>
                      <Badge className={priColor[t.priority]}>{t.priority}</Badge>
                      <Badge variant="outline" className={stColor[t.status]}>{t.status.replace("_"," ")}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium">{t.subject}</p>
                  <p className="text-xs text-muted-foreground">{t.customer_name} &lt;{t.customer_email}&gt;</p>
                </button>
              ))}
            </TabsContent>
            <TabsContent value="calls" className="mt-4 space-y-3">
              {calls.length === 0 ? <p className="text-sm text-muted-foreground">No calls scheduled.</p> : calls.map((c) => (
                <Card key={c.id}><CardContent className="p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{new Date(c.scheduled_at).toLocaleString()} <span className="text-xs text-muted-foreground">({c.timezone})</span></p>
                      <p className="text-xs text-muted-foreground">{c.customer_name} · {c.email} · {c.phone}</p>
                    </div>
                    <Select value={c.status} onValueChange={(v) => updateCall(c.id, { status: v })}>
                      <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>{["scheduled","completed","missed","rescheduled","cancelled"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <p className="text-sm">{c.reason}</p>
                  <Textarea placeholder="Agent notes (saved on blur)…" defaultValue={c.agent_notes || ""}
                    onBlur={(e) => updateCall(c.id, { agent_notes: e.target.value })} rows={2} />
                </CardContent></Card>
              ))}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AuthLayout>
  );
}

function Stat({ label, value, tone, icon }: { label: string; value: number; tone?: string; icon?: React.ReactNode }) {
  const toneClass = tone === "red" ? "text-red-600" : tone === "emerald" ? "text-emerald-600" : tone === "blue" ? "text-blue-600" : "text-primary";
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <span className={toneClass}>{icon}</span>
      </div>
      <p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
    </CardContent></Card>
  );
}
