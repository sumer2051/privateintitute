import { useEffect, useMemo, useRef, useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { playSound } from "@/lib/sounds";
import { MessageSquare, Send, Plus, ArrowLeft, Paperclip, X, PhoneCall, Headset } from "lucide-react";
import { AttachmentPreview, uploadTicketAttachment, MAX_ATTACHMENT_BYTES, formatBytes } from "@/components/TicketAttachment";
import { Seo } from "@/components/Seo";

type TicketRow = {
  id: string; ticket_number: string; subject: string; description: string;
  status: string; priority: string; created_at: string; updated_at: string;
  customer_name: string; customer_email: string; category: string | null;
};
type MsgRow = {
  id: string; ticket_id?: string; sender_type: string; message: string; created_at: string; sender_id: string | null;
  attachment_path?: string | null; attachment_name?: string | null;
  attachment_type?: string | null; attachment_size?: number | null;
};
type CallRow = { id: string; scheduled_at: string; timezone: string; reason: string; status: string; phone: string };

const VIEWED_KEY = "support_ticket_viewed_v1";
const readViewed = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(VIEWED_KEY) || "{}"); } catch { return {}; }
};
const writeViewed = (v: Record<string, string>) => {
  try { localStorage.setItem(VIEWED_KEY, JSON.stringify(v)); } catch {}
};

const timeLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
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
  const [previews, setPreviews] = useState<Record<string, MsgRow>>({});

  const isNew = (t: TicketRow) => {
    const seenAt = viewed[t.id];
    if (!seenAt) return true;
    return new Date(t.updated_at).getTime() > new Date(seenAt).getTime();
  };

  const load = async () => {
    const [{ data: t }, { data: c }] = await Promise.all([
      supabase.from("support_tickets").select("*").order("updated_at", { ascending: false }),
      supabase.from("scheduled_calls").select("*").order("scheduled_at", { ascending: true }),
    ]);
    const rows = (t as TicketRow[]) || [];
    setTickets(rows);
    setCalls((c as CallRow[]) || []);
    setLoading(false);

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

  // Live: any change to my tickets or their messages refreshes the thread list
  useEffect(() => {
    const ch = supabase
      .channel(`support-live-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_messages" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "scheduled_calls" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const markViewed = (id: string) => {
    setViewed((prev) => {
      const next = { ...prev, [id]: new Date().toISOString() };
      writeViewed(next);
      try { window.dispatchEvent(new Event("support-tickets-viewed")); } catch {}
      return next;
    });
  };

  const openTicket = async (t: TicketRow) => {
    setActive(t);
    setMessages([]);
    const { data } = await supabase.from("ticket_messages")
      .select("*").eq("ticket_id", t.id).order("created_at", { ascending: true });
    setMessages((data as MsgRow[]) || []);
    markViewed(t.id);
  };

  // Live messages inside the open thread
  useEffect(() => {
    if (!active) return;
    const id = active.id;
    const ch = supabase.channel(`ticket-${id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_messages", filter: `ticket_id=eq.${id}` },
        (p) => {
          const row = p.new as MsgRow;
          setMessages((m) => {
            if (m.some((x) => x.id === row.id)) return m;
            if (row.sender_type !== "customer") playSound("message");
            return [...m, row];
          });
          markViewed(id);
        })
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

  const threads = useMemo(
    () => [...tickets].sort((a, b) =>
      new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()),
    [tickets],
  );

  return (
    <AuthLayout currentPage="support">
      <Seo title="Support | BoA private institute" description="Message your support team and see replies live." path="/support" noindex />

      <div className="mx-auto flex max-w-3xl flex-col p-3 md:p-5">
        {active ? (
          <ThreadView
            ticket={active}
            messages={messages}
            reply={reply}
            setReply={setReply}
            onSend={sendReply}
            onBack={() => { setActive(null); load(); }}
          />
        ) : (
          <>
            {/* Minimal header: title + plus */}
            <div className="mb-3 flex items-center justify-between">
              <h1 className="text-xl font-semibold md:text-2xl">Messages</h1>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Schedule a call"
                  onClick={() => setCallOpen(true)}
                >
                  <PhoneCall className="h-5 w-5" />
                </Button>
                <Button
                  size="icon"
                  aria-label="New ticket"
                  className="rounded-full shadow-md"
                  onClick={() => setNewOpen(true)}
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/50" />)}
              </div>
            ) : threads.length === 0 ? (
              <button
                onClick={() => setNewOpen(true)}
                className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-dashed p-10 text-center"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                  <MessageSquare className="h-7 w-7" />
                </span>
                <span className="text-sm font-medium">Start a conversation with support</span>
                <span className="text-xs text-muted-foreground">Tap + to send your first message. We reply 24/7.</span>
              </button>
            ) : (
              <div className="divide-y rounded-2xl border bg-card">
                {threads.map((t) => {
                  const p = previews[t.id];
                  const fresh = isNew(t) && (!p || p.sender_type !== "customer");
                  const fromStaff = p && p.sender_type !== "customer";
                  return (
                    <button
                      key={t.id}
                      onClick={() => openTicket(t)}
                      className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-muted/50"
                    >
                      <span className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${fresh ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
                        <Headset className="h-5 w-5" />
                        {fresh && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-400" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className={`truncate text-sm ${fresh ? "font-bold" : "font-medium"}`}>{t.subject}</span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">{timeLabel(t.updated_at || t.created_at)}</span>
                        </span>
                        <span className={`mt-0.5 block truncate text-xs ${fresh ? "font-semibold text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>
                          {p
                            ? `${fromStaff ? "Support" : "You"}: ${p.message || (p.attachment_name ? `📎 ${p.attachment_name}` : "")}`
                            : t.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {calls.length > 0 && (
              <div className="mt-5 space-y-2">
                <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scheduled calls</p>
                {calls.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5">
                    <PhoneCall className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{new Date(c.scheduled_at).toLocaleString()}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.reason}</p>
                    </div>
                    <span className="shrink-0 text-[11px] capitalize text-muted-foreground">{c.status}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <NewTicketDialog open={newOpen} onOpenChange={setNewOpen} onCreated={load} />
      <ScheduleCallDialog open={callOpen} onOpenChange={setCallOpen} onCreated={load} />
    </AuthLayout>
  );
}

function ThreadView({ ticket, messages, reply, setReply, onSend, onBack }: {
  ticket: TicketRow; messages: MsgRow[]; reply: string;
  setReply: (v: string) => void; onSend: (file: File | null) => void | Promise<void>; onBack: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const pickFile = (f: File | null) => {
    if (f && f.size > MAX_ATTACHMENT_BYTES) { toast.error("File too large (max 10 MB)"); return; }
    setFile(f);
  };

  const handleSend = async () => {
    setSending(true);
    try { await onSend(file); setFile(null); if (fileRef.current) fileRef.current.value = ""; }
    finally { setSending(false); }
  };

  // The original complaint always shows first, replies below it.
  const thread: MsgRow[] = [
    {
      id: `origin-${ticket.id}`,
      sender_type: "customer",
      message: ticket.description,
      created_at: ticket.created_at,
      sender_id: null,
    },
    ...messages.filter((m) => m.message !== ticket.description || m.attachment_path),
  ];

  return (
    <div className="flex flex-col">
      {/* Chat header */}
      <div className="sticky top-0 z-10 -mx-3 mb-2 flex items-center gap-2 border-b bg-background/90 px-3 py-2 backdrop-blur md:-mx-5 md:px-5">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
          <Headset className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{ticket.subject}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {ticket.ticket_number} · {ticket.status.replace("_", " ")}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-2 pb-2">
        {thread.map((m) => {
          const mine = m.sender_type === "customer";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[82%]">
                <div className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                  mine
                    ? "rounded-br-md bg-primary text-primary-foreground"
                    : "rounded-bl-md border bg-card"
                }`}>
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
                <p className={`mt-0.5 text-[10px] text-muted-foreground ${mine ? "text-right" : ""}`}>
                  {mine ? "You" : "Support"} · {timeLabel(m.created_at)}
                </p>
              </div>
            </div>
          );
        })}
        {messages.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Sent. A support specialist will reply here shortly.
          </p>
        )}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div className="sticky bottom-0 -mx-3 border-t bg-background/95 px-3 py-2 backdrop-blur md:-mx-5 md:px-5">
        {file && (
          <div className="mb-2 flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1.5 text-xs">
            <Paperclip className="h-3.5 w-3.5" />
            <span className="flex-1 truncate">{file.name}</span>
            <span className="opacity-60">{formatBytes(file.size)}</span>
            <button onClick={() => pickFile(null)} className="opacity-70 hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileRef} type="file" className="hidden"
            accept="image/*,application/pdf,.doc,.docx,.txt,.csv,.xlsx"
            onChange={(e) => pickFile(e.target.files?.[0] || null)}
          />
          <Button type="button" variant="ghost" size="icon" onClick={() => fileRef.current?.click()} aria-label="Attach file">
            <Paperclip className="h-5 w-5" />
          </Button>
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Message support…"
            rows={1}
            className="min-h-[40px] flex-1 resize-none rounded-2xl"
          />
          <Button onClick={handleSend} size="icon" className="rounded-full" disabled={sending || (!reply.trim() && !file)} aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
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
    if (!subject.trim() || !description.trim()) { toast.error("Subject and message required"); return; }
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

      toast.success("Message sent — support will reply here.");
      setSubject(""); setDescription(""); setPriority("medium"); setFiles([]);
      onOpenChange(false); onCreated();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New message to support</DialogTitle>
          <DialogDescription>We reply right here in the thread, usually within 24 hours.</DialogDescription>
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
          <div><Label>Your message</Label><Textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
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
              <span className="text-[11px] text-muted-foreground">Up to 10 MB each</span>
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
          <Button onClick={submit} disabled={busy}>{busy ? "Sending…" : "Send message"}</Button>
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
