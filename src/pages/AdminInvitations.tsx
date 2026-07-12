import { useEffect, useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ShieldAlert, MailPlus, Copy, XCircle, ArrowLeft, KeyRound } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Inv = {
  id: string;
  email: string;
  token: string;
  role: string;
  status: string;
  note: string | null;
  expires_at: string;
  used_at: string | null;
  created_at: string;
};

export default function AdminInvitations() {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Inv[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"user" | "support" | "admin">("user");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
      setAllowed(((data as any[]) || []).some(r => r.role === "admin"));
    })();
  }, [navigate]);

  const load = async () => {
    const { data } = await supabase
      .from("invitations")
      .select("*")
      .order("created_at", { ascending: false });
    setRows((data as Inv[]) || []);
  };

  useEffect(() => { if (allowed) load(); }, [allowed]);

  const send = async () => {
    if (!email.trim()) { toast.error("Enter an email"); return; }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-invitation", {
        body: { email: email.trim(), role, note: note.trim() || null, origin: window.location.origin },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const emailed = (data as any)?.email_sent;
      toast.success(emailed ? "Invitation sent" : "Invitation created (email failed — copy link manually)");
      setEmail(""); setNote("");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to send invite");
    } finally {
      setSending(false);
    }
  };

  const copyLink = (inv: Inv) => {
    const link = `${window.location.origin}/auth?invite=${inv.token}&email=${encodeURIComponent(inv.email)}`;
    navigator.clipboard.writeText(link);
    toast.success("Invite link copied");
  };

  const revoke = async (inv: Inv) => {
    const { error } = await supabase
      .from("invitations")
      .update({ status: "revoked" })
      .eq("id", inv.id);
    if (error) return toast.error(error.message);
    toast.success("Invitation revoked");
    load();
  };

  if (allowed === null) {
    return (
      <AuthLayout>
        <div className="flex items-center justify-center py-32">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AuthLayout>
    );
  }
  if (!allowed) {
    return (
      <AuthLayout>
        <Card className="max-w-md mx-auto mt-16">
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-destructive" />Admin only</CardTitle></CardHeader>
          <CardContent><Button onClick={() => navigate("/accounts")}>Back</Button></CardContent>
        </Card>
      </AuthLayout>
    );
  }

  const statusColor: Record<string, string> = {
    pending: "bg-blue-100 text-blue-700",
    used: "bg-emerald-100 text-emerald-700",
    revoked: "bg-gray-200 text-gray-700",
    expired: "bg-amber-100 text-amber-700",
  };

  return (
    <AuthLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-secondary flex items-center gap-2">
              <KeyRound className="h-6 w-6 text-primary" /> Invitations
            </h1>
            <p className="text-sm text-muted-foreground">Signup is invite-only. Manage who can join the portal.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/support")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Support
          </Button>
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><MailPlus className="h-5 w-5 text-primary" />Invite a new user</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</label>
                <Input type="email" placeholder="client@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</label>
                <Select value={role} onValueChange={(v) => setRole(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="support">Support</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Personal note (optional)</label>
              <Textarea rows={2} placeholder="Welcome message shown in the invite email" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <Button onClick={send} disabled={sending} className="bg-gradient-to-r from-primary to-accent">
              {sending ? "Sending..." : "Send invitation"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>All invitations</CardTitle></CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No invitations yet.</p>
            ) : (
              <div className="space-y-2">
                {rows.map((inv) => {
                  const expired = new Date(inv.expires_at) < new Date();
                  const effective = inv.status === "pending" && expired ? "expired" : inv.status;
                  return (
                    <div key={inv.id} className="flex flex-col md:flex-row md:items-center gap-3 border rounded-lg p-3 hover:bg-muted/40 transition">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-secondary truncate">{inv.email}</span>
                          <Badge className={statusColor[effective] || ""}>{effective}</Badge>
                          <Badge variant="outline" className="capitalize">{inv.role}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Sent {new Date(inv.created_at).toLocaleDateString()} · Expires {new Date(inv.expires_at).toLocaleDateString()}
                          {inv.used_at ? ` · Accepted ${new Date(inv.used_at).toLocaleDateString()}` : ""}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => copyLink(inv)}>
                          <Copy className="h-3.5 w-3.5 mr-1" /> Copy link
                        </Button>
                        {inv.status === "pending" && (
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => revoke(inv)}>
                            <XCircle className="h-3.5 w-3.5 mr-1" /> Revoke
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AuthLayout>
  );
}
