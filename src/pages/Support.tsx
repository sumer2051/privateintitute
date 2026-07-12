import { useEffect, useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { MessageSquare, PhoneCall, Ticket, Send, Sparkles, ArrowLeft, Clock } from "lucide-react";

type TicketRow = {
  id: string; ticket_number: string; subject: string; description: string;
  status: string; priority: string; created_at: string; updated_at: string;
  customer_name: string; customer_email: string; category: string | null;
};
type MsgRow = { id: string; sender_type: string; message: string; created_at: string; sender_id: string | null };
type CallRow = { id: string; scheduled_at: string; timezone: string; reason: string; status: string; phone: string };

const priorityColor: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};
const statusColor: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  pending: "bg-amber-100 text-amber-700",
  in_progress: "bg-purple-100 text-purple-700",
  resolved: "bg-emerald-100 text-emerald-700",
  closed: "bg-gray-200 text-gray-700",
};

export default function Support() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<TicketRow | null>(null);
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [reply, setReply] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: t }, { data: c }] = await Promise.all([
      supabase.from("support_tickets").select("*").order("created_at", { ascending: false }),
      supabase.from("scheduled_calls").select("*").order("scheduled_at", { ascending: true }),
    ]);
    setTickets((t as TicketRow[]) || []);
    setCalls((c as CallRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const ch = supabase
      .channel("support-ui")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "scheduled_calls" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const openTicket = async (t: TicketRow) => {
    setActive(t);
    const { data } = await supabase.from("ticket_messages")
      .select("*").eq("ticket_id", t.id).order("created_at", { ascending: true });
    setMessages((data as MsgRow[]) || []);
  };

  useEffect(() => {
    if (!active) return;
    const ch = supabase.channel(`ticket-${active.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_messages", filter: `ticket_id=eq.${active.id}` },
        (p) => setMessages((m) => [...m, p.new as MsgRow]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [active?.id]);

  const sendReply = async () => {
    if (!active || !reply.trim()) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { error } = await supabase.from("ticket_messages").insert({
      ticket_id: active.id, sender_type: "customer", sender_id: session.user.id, message: reply.trim(),
    });
    if (error) { toast.error(error.message); return; }
    if (active.status === "resolved" || active.status === "closed") {
      await supabase.from("support_tickets").update({ status: "open" }).eq("id", active.id);
    }
    setReply("");
  };

  return (
    <AuthLayout currentPage="support">
      <div className="mx-auto max-w-6xl p-4 md:p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Support Center</h1>
            <p className="text-sm text-muted-foreground">Ask Ava, open a ticket, or schedule a call with a specialist.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.dispatchEvent(new Event("open-ai-chat"))}>
              <Sparkles className="mr-2 h-4 w-4" /> Ask Ava
            </Button>
            <Button variant="outline" onClick={() => setCallOpen(true)}>
              <PhoneCall className="mr-2 h-4 w-4" /> Schedule Call
            </Button>
            <Button onClick={() => setNewOpen(true)}>
              <Ticket className="mr-2 h-4 w-4" /> New Ticket
            </Button>
          </div>
        </div>

        {active ? (
          <TicketDetail
            ticket={active}
            messages={messages}
            reply={reply}
            setReply={setReply}
            onSend={sendReply}
            onBack={() => { setActive(null); load(); }}
          />
        ) : (
          <Tabs defaultValue="tickets">
            <TabsList>
              <TabsTrigger value="tickets"><Ticket className="mr-1 h-4 w-4" />My Tickets ({tickets.length})</TabsTrigger>
              <TabsTrigger value="calls"><PhoneCall className="mr-1 h-4 w-4" />Scheduled Calls ({calls.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="tickets" className="mt-4">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : tickets.length === 0 ? (
                <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
                  <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  No tickets yet. Open one or ask Ava for instant help.
                </CardContent></Card>
              ) : (
                <div className="space-y-2">
                  {tickets.map((t) => (
                    <button key={t.id} onClick={() => openTicket(t)}
                      className="w-full rounded-lg border bg-card p-4 text-left transition hover:shadow-md">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{t.ticket_number}</span>
                          <Badge className={priorityColor[t.priority]}>{t.priority}</Badge>
                          <Badge variant="outline" className={statusColor[t.status]}>{t.status.replace("_"," ")}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</span>
                      </div>
                      <p className="mt-2 font-medium">{t.subject}</p>
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{t.description}</p>
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="calls" className="mt-4">
              {calls.length === 0 ? (
                <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
                  <Clock className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  No scheduled calls.
                </CardContent></Card>
              ) : (
                <div className="space-y-2">
                  {calls.map((c) => (
                    <div key={c.id} className="rounded-lg border bg-card p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">{new Date(c.scheduled_at).toLocaleString()} <span className="text-xs text-muted-foreground">({c.timezone})</span></p>
                        <Badge className={statusColor[c.status] || "bg-gray-100"}>{c.status}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{c.reason}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Callback: {c.phone}</p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      <NewTicketDialog open={newOpen} onOpenChange={setNewOpen} onCreated={load} />
      <ScheduleCallDialog open={callOpen} onOpenChange={setCallOpen} onCreated={load} />
    </AuthLayout>
  );
}

function TicketDetail({ ticket, messages, reply, setReply, onSend, onBack }: {
  ticket: TicketRow; messages: MsgRow[]; reply: string;
  setReply: (v: string) => void; onSend: () => void; onBack: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <button onClick={onBack} className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to tickets
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-muted-foreground">{ticket.ticket_number}</span>
          <Badge className={priorityColor[ticket.priority]}>{ticket.priority}</Badge>
          <Badge variant="outline" className={statusColor[ticket.status]}>{ticket.status.replace("_"," ")}</Badge>
        </div>
        <CardTitle className="mt-2">{ticket.subject}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-lg bg-muted/30 p-4">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender_type === "customer" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                m.sender_type === "customer" ? "bg-primary text-primary-foreground rounded-br-sm"
                  : m.sender_type === "agent" ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100 rounded-bl-sm"
                  : m.sender_type === "ai" ? "bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-100 rounded-bl-sm"
                  : "bg-card border rounded-bl-sm"
              }`}>
                <p className="text-[10px] opacity-70 mb-0.5 uppercase">{m.sender_type} · {new Date(m.created_at).toLocaleString()}</p>
                {m.message}
              </div>
            </div>
          ))}
          {messages.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No messages yet.</p>}
        </div>
        <div className="mt-4 flex gap-2">
          <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to support…" rows={2} />
          <Button onClick={onSend} disabled={!reply.trim()}><Send className="h-4 w-4" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NewTicketDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("account");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!subject.trim() || !description.trim()) { toast.error("Subject and description required"); return; }
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-support-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ subject, description, priority, category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success(`Ticket ${data.ticket.ticket_number} created — email sent.`);
      setSubject(""); setDescription(""); setPriority("medium");
      onOpenChange(false); onCreated();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open a support ticket</DialogTitle>
          <DialogDescription>A specialist will follow up within 24 hours. You'll receive a confirmation email.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Short summary" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="account">Account</SelectItem>
                  <SelectItem value="transfers">Transfers</SelectItem>
                  <SelectItem value="cards">Cards</SelectItem>
                  <SelectItem value="security">Security</SelectItem>
                  <SelectItem value="fraud">Fraud</SelectItem>
                  <SelectItem value="billing">Billing</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Describe the issue</Label><Textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Creating…" : "Create ticket"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleCallDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [tz, setTz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!date || !time || !phone.trim() || !reason.trim()) { toast.error("Fill all fields"); return; }
    setBusy(true);
    try {
      const iso = new Date(`${date}T${time}`).toISOString();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/schedule-support-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ scheduled_at: iso, timezone: tz, phone, reason, email: session.user.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success("Call scheduled — confirmation email sent.");
      setPhone(""); setReason(""); setDate("");
      onOpenChange(false); onCreated();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const today = new Date().toISOString().split("T")[0];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule a call</DialogTitle>
          <DialogDescription>Pick a time — a specialist will call you at the number below.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Date</Label><Input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><Label>Time</Label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
          </div>
          <div><Label>Timezone</Label><Input value={tz} onChange={(e) => setTz(e.target.value)} /></div>
          <div><Label>Phone number</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" /></div>
          <div><Label>Reason for call</Label><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Scheduling…" : "Confirm call"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
