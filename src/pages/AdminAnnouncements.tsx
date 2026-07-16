import { useEffect, useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Megaphone, ShieldAlert, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Ann = { id: string; title: string; body: string; severity: string; active: boolean; created_at: string };

export default function AdminAnnouncements() {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [items, setItems] = useState<Ann[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState("info");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      setAllowed(((data as any[]) || []).some(r => r.role === "admin"));
    })();
  }, [navigate]);

  const load = async () => {
    const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
    setItems((data as Ann[]) || []);
  };
  useEffect(() => { if (allowed) load(); }, [allowed]);

  const publish = async () => {
    if (!title.trim() || !body.trim()) return toast.error("Title and body required");
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("announcements").insert({ title: title.trim(), body: body.trim(), severity, created_by: user?.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Announcement published to all users");
    setTitle(""); setBody(""); setSeverity("info");
    load();
  };

  const toggle = async (a: Ann) => {
    const { error } = await supabase.from("announcements").update({ active: !a.active }).eq("id", a.id);
    if (error) return toast.error(error.message);
    load();
  };
  const remove = async (a: Ann) => {
    if (!confirm("Delete this announcement?")) return;
    const { error } = await supabase.from("announcements").delete().eq("id", a.id);
    if (error) return toast.error(error.message);
    load();
  };

  if (allowed === null) return <AuthLayout><div className="flex justify-center py-32"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div></AuthLayout>;
  if (!allowed) return (
    <AuthLayout><Card className="max-w-md mx-auto mt-16"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-destructive"/>Admin only</CardTitle></CardHeader><CardContent><Button onClick={() => navigate("/accounts")}>Back</Button></CardContent></Card></AuthLayout>
  );

  return (
    <AuthLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-secondary flex items-center gap-2"><Megaphone className="h-6 w-6 text-primary" /> Broadcast announcements</h1>
          <p className="text-sm text-muted-foreground">Publish an in-app banner visible to every signed-in customer.</p>
        </div>

        <Card>
          <CardHeader><CardTitle>New announcement</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} />
            <Textarea placeholder="Message body" value={body} onChange={e => setBody(e.target.value)} maxLength={800} rows={4} />
            <div className="flex items-center gap-3">
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={publish} disabled={busy}>{busy ? "Publishing..." : "Publish now"}</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>History</CardTitle></CardHeader>
          <CardContent>
            {items.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">No announcements yet.</p> : (
              <div className="space-y-2">
                {items.map(a => (
                  <div key={a.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-secondary">{a.title}</span>
                          <Badge variant="outline" className="uppercase text-[10px]">{a.severity}</Badge>
                          {a.active ? <Badge className="bg-emerald-500 text-white">Live</Badge> : <Badge variant="secondary">Hidden</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{new Date(a.created_at).toLocaleString()}</p>
                        <p className="text-sm mt-2 whitespace-pre-line">{a.body}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => toggle(a)}>{a.active ? "Hide" : "Show"}</Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(a)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AuthLayout>
  );
}
