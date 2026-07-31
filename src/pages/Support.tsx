import { useEffect, useRef, useState } from "react";
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
import { MessageSquare, PhoneCall, Ticket, Send, Sparkles, ArrowLeft, Clock, Paperclip, X, Search, ChevronRight, CornerUpLeft } from "lucide-react";
import { AttachmentPreview, uploadTicketAttachment, MAX_ATTACHMENT_BYTES, formatBytes } from "@/components/TicketAttachment";
import { Seo } from "@/components/Seo";

type TicketRow = {
  id: string; ticket_number: string; subject: string; description: string;
  status: string; priority: string; created_at: string; updated_at: string;
  customer_name: string; customer_email: string; category: string | null;
};
type MsgRow = {
  id: string; sender_type: string; message: string; created_at: string; sender_id: string | null;
  attachment_path?: string | null; attachment_name?: string | null;
  attachment_type?: string | null; attachment_size?: number | null;
};
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

const VIEWED_KEY = "support_ticket_viewed_v1";
const readViewed = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(VIEWED_KEY) || "{}"); } catch { return {}; }
};
const writeViewed = (v: Record<string, string>) => {
  try { localStorage.setItem(VIEWED_KEY, JSON.stringify(v)); } catch {}
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
  const [viewed, setViewed] = useState<Record<string, string>>(() => readViewed());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "new" | "open" | "resolved">("all");
  const [previews, setPreviews] = useState<Record<string, MsgRow>>({});

  const isNew = (t: TicketRow) => {
    const seenAt = viewed[t.id];
    if (!seenAt) return true;
    return new Date(t.updated_at).getTime() > new Date(seenAt).getTime();
  };

  const load = async () => {
    setLoading(true);
    const [{ data: t }, { data: c }] = await Promise.all([
      supabase.from("support_tickets").select("*").order("created_at", { ascending: false }),
      supabase.from("scheduled_calls").select("*").order("scheduled_at", { ascending: true }),
    ]);
    const rows = (t as TicketRow[]) || [];
    setTickets(rows);
    setCalls((c as CallRow[]) || []);
    setLoading(false);

    // Latest message per ticket (for inline previews)
    if (rows.length) {
      const { data: msgs } = await supabase
        .from("ticket_messages")
        .select("id, ticket_id, sender_type, message, created_at, sender_id, attachment_name")
        .in("ticket_id", rows.map((r) => r.id))
        .order("created_at", { ascending: false });
      const map: Record<string, MsgRow> = {};
      for (const m of (msgs as any[]) || []) {
        if (!map[m.ticket_id]) map[m.ticket_id] = m as MsgRow;
      }
      setPreviews(map);
    } else {
      setPreviews({});
    }
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
    // Mark viewed
    setViewed((prev) => {
      const next = { ...prev, [t.id]: new Date().toISOString() };
      writeViewed(next);
      try { window.dispatchEvent(new Event("support-tickets-viewed")); } catch {}
      return next;
    });
  };

  useEffect(() => {
    if (!active) return;
    const ch = supabase.channel(`ticket-${active.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_messages", filter: `ticket_id=eq.${active.id}` },
        (p) => setMessages((m) => [...m, p.new as MsgRow]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [active?.id]);

  const sendReply = async (file: File | null) => {
    if (!active) return;
    if (!reply.trim() && !file) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    let att: Awaited<ReturnType<typeof uploadTicketAttachment>> | null = null;
    if (file) {
      try { att = await uploadTicketAttachment(active.id, file); }
      catch (e) { toast.error((e as Error).message); return; }
    }
    const { error } = await supabase.from("ticket_messages").insert({
      ticket_id: active.id, sender_type: "customer", sender_id: session.user.id,
      message: reply.trim() || (att ? `📎 ${att.attachment_name}` : ""),
      ...(att || {}),
    });
    if (error) { toast.error(error.message); return; }
    if (active.status === "resolved" || active.status === "closed") {
      await supabase.from("support_tickets").update({ status: "open" }).eq("id", active.id);
    }
    setReply("");
  };

  const freshCount = tickets.filter(isNew).length;
  const openCount = tickets.filter((t) => !["resolved", "closed"].includes(t.status)).length;

  const visibleTickets = tickets
    .filter((t) => {
      if (filter === "new" && !isNew(t)) return false;
      if (filter === "open" && ["resolved", "closed"].includes(t.status)) return false;
      if (filter === "resolved" && !["resolved", "closed"].includes(t.status)) return false;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        t.subject.toLowerCase().includes(q) ||
        t.ticket_number.toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q) ||
        (t.category || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const an = isNew(a) ? 1 : 0, bn = isNew(b) ? 1 : 0;
      if (an !== bn) return bn - an;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  const latestFresh = tickets.filter(isNew).sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  )[0];

  return (
    <AuthLayout currentPage="support">
      <div className="mx-auto max-w-6xl p-4 md:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Support Center</h1>
            <p className="text-sm text-muted-foreground">Ask Ava, open a ticket, or schedule a call with a specialist.</p>
          </div>
          <div className="flex flex-wrap gap-2">
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
          <>
            {/* Floating green chat bubble — new message alert / first-time welcome */}
            {!loading && (freshCount > 0 || tickets.length === 0) && (
              <button
                onClick={() => (latestFresh ? openTicket(latestFresh) : setNewOpen(true))}
                className="group relative block w-full text-left"
              >
                <div className="relative animate-[float_3s_ease-in-out_infinite] rounded-2xl rounded-bl-sm border border-emerald-300/70 bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 text-white shadow-lg shadow-emerald-600/25 transition group-hover:shadow-xl dark:border-emerald-700">
                  <span className="absolute -right-1 -top-1 h-3 w-3 animate-ping rounded-full bg-emerald-300" />
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
                      <MessageSquare className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      {latestFresh ? (
                        <>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-50/90">
                            {freshCount > 1 ? `${freshCount} new messages` : "New message"}
                          </p>
                          <p className="truncate text-sm font-semibold">{latestFresh.subject}</p>
                          <p className="mt-0.5 truncate text-xs text-emerald-50/85">
                            {previews[latestFresh.id]?.message || latestFresh.description}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-50/90">Welcome</p>
                          <p className="text-sm font-semibold">No tickets yet — we're here 24/7</p>
                          <p className="mt-0.5 text-xs text-emerald-50/85">Tap to start a conversation with support.</p>
                        </>
                      )}
                    </div>
                    <ChevronRight className="mt-2 h-4 w-4 shrink-0 opacity-80 transition group-hover:translate-x-0.5" />
                  </div>
                </div>
              </button>
            )}

            <Tabs defaultValue="tickets">
              <TabsList>
                <TabsTrigger value="tickets">
                  <Ticket className="mr-1 h-4 w-4" />My Tickets ({tickets.length})
                  {freshCount > 0 && (
                    <span className="ml-1.5 rounded-full bg-emerald-600 px-1.5 text-[10px] font-bold text-white">{freshCount}</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="calls"><PhoneCall className="mr-1 h-4 w-4" />Scheduled Calls ({calls.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="tickets" className="mt-4 space-y-3">
                {tickets.length > 0 && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search tickets by subject, number or category"
                        className="pl-8"
                      />
                    </div>
                    <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                      {([
                        ["all", `All ${tickets.length}`],
                        ["new", `Unread ${freshCount}`],
                        ["open", `Open ${openCount}`],
                        ["resolved", "Resolved"],
                      ] as const).map(([key, label]) => (
                        <button
                          key={key}
                          onClick={() => setFilter(key)}
                          className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                            filter === key
                              ? "border-primary bg-primary text-primary-foreground"
                              : "bg-card text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {loading ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-24 animate-pulse rounded-lg border bg-muted/40" />
                    ))}
                  </div>
                ) : tickets.length === 0 ? (
                  <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
                    <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-40" />
                    No tickets yet. Open one or ask Ava for instant help.
                  </CardContent></Card>
                ) : visibleTickets.length === 0 ? (
                  <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
                    No tickets match this view.
                  </CardContent></Card>
                ) : (
                  <div className="space-y-2">
                    {visibleTickets.map((t) => {
                      const fresh = isNew(t);
                      const p = previews[t.id];
                      const staffReply = p && p.sender_type !== "customer";
                      return (
                        <button key={t.id} onClick={() => openTicket(t)}
                          className={`relative w-full overflow-hidden rounded-xl border p-4 text-left transition hover:shadow-md ${fresh ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30" : "bg-card"}`}>
                          {fresh && <span className="absolute inset-y-0 left-0 w-1 bg-emerald-500" />}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              {fresh && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm animate-pulse">
                                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                                  New
                                </span>
                              )}
                              <span className="font-mono text-xs text-muted-foreground">{t.ticket_number}</span>
                              <Badge className={priorityColor[t.priority]}>{t.priority}</Badge>
                              <Badge variant="outline" className={statusColor[t.status]}>{t.status.replace("_"," ")}</Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">{new Date(t.updated_at || t.created_at).toLocaleString()}</span>
                          </div>
                          <p className={`mt-2 font-medium ${fresh ? "text-emerald-900 dark:text-emerald-100" : ""}`}>{t.subject}</p>
                          {p ? (
                            <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground line-clamp-2">
                              {staffReply
                                ? <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                : <CornerUpLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" />}
                              <span className="line-clamp-2">
                                <span className="font-medium capitalize">{staffReply ? p.sender_type : "You"}:</span>{" "}
                                {p.message || (p.attachment_name ? `📎 ${p.attachment_name}` : "")}
                              </span>
                            </p>
                          ) : (
                            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{t.description}</p>
                          )}
                        </button>
                      );
                    })}
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
          </>
        )}

      </div>

      <NewTicketDialog open={newOpen} onOpenChange={setNewOpen} onCreated={load} />
      <ScheduleCallDialog open={callOpen} onOpenChange={setCallOpen} onCreated={load} />
    </AuthLayout>
  );
}

function TicketDetail({ ticket, messages, reply, setReply, onSend, onBack }: {
  ticket: TicketRow; messages: MsgRow[]; reply: string;
  setReply: (v: string) => void; onSend: (file: File | null) => void | Promise<void>; onBack: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  const pickFile = (f: File | null) => {
    if (f && f.size > MAX_ATTACHMENT_BYTES) {
      toast.error("File too large (max 10 MB)");
      return;
    }
    setFile(f);
  };

  const handleSend = async () => {
    setSending(true);
    try { await onSend(file); setFile(null); if (fileRef.current) fileRef.current.value = ""; }
    finally { setSending(false); }
  };

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
                {m.attachment_path && (
                  <AttachmentPreview
                    path={m.attachment_path}
                    name={m.attachment_name}
                    type={m.attachment_type}
                    size={m.attachment_size}
                  />
                )}
              </div>
            </div>
          ))}
          {messages.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No messages yet.</p>}
        </div>
        {file && (
          <div className="mt-3 flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1.5 text-xs">
            <Paperclip className="h-3.5 w-3.5" />
            <span className="flex-1 truncate">{file.name}</span>
            <span className="opacity-60">{formatBytes(file.size)}</span>
            <button onClick={() => pickFile(null)} className="opacity-70 hover:opacity-100">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <input
            ref={fileRef} type="file" className="hidden"
            accept="image/*,application/pdf,.doc,.docx,.txt,.csv,.xlsx"
            onChange={(e) => pickFile(e.target.files?.[0] || null)}
          />
          <Button type="button" variant="outline" size="icon" onClick={() => fileRef.current?.click()} title="Attach file">
            <Paperclip className="h-4 w-4" />
          </Button>
          <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to support…" rows={2} className="flex-1" />
          <Button onClick={handleSend} disabled={sending || (!reply.trim() && !file)}>
            <Send className="h-4 w-4" />
          </Button>
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
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list).filter((f) => {
      if (f.size > MAX_ATTACHMENT_BYTES) { toast.error(`${f.name}: too large (max 10 MB)`); return false; }
      return true;
    });
    setFiles((prev) => [...prev, ...picked].slice(0, 5));
    if (fileRef.current) fileRef.current.value = "";
  };

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

      // Upload any attachments and post them as follow-up customer messages
      if (files.length) {
        for (const f of files) {
          try {
            const att = await uploadTicketAttachment(data.ticket.id, f);
            await supabase.from("ticket_messages").insert({
              ticket_id: data.ticket.id, sender_type: "customer", sender_id: session.user.id,
              message: `📎 ${att.attachment_name}`, ...att,
            });
          } catch (e) {
            toast.error(`${f.name}: ${(e as Error).message}`);
          }
        }
      }

      toast.success(`Ticket ${data.ticket.ticket_number} created — email sent.`);
      setSubject(""); setDescription(""); setPriority("medium"); setFiles([]);
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
          <div>
            <Label>Attachments (optional)</Label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <input
                ref={fileRef} type="file" multiple className="hidden"
                accept="image/*,application/pdf,.doc,.docx,.txt,.csv,.xlsx"
                onChange={(e) => addFiles(e.target.files)}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Paperclip className="mr-1.5 h-3.5 w-3.5" /> Attach files
              </Button>
              <span className="text-[11px] text-muted-foreground">Screenshots or documents, up to 10 MB each</span>
            </div>
            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1 text-xs">
                    <Paperclip className="h-3.5 w-3.5" />
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="opacity-60">{formatBytes(f.size)}</span>
                    <button type="button" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="opacity-70 hover:opacity-100">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
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
    <>
      <Seo title="Support | BoA private institute" description="Open a support ticket, chat with our assistant and track replies from your dedicated support team." path="/support" noindex />
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
