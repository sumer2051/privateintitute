import { useEffect, useMemo, useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, ScrollText, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Log = { id: string; actor_id: string; action: string; target_type: string | null; target_id: string | null; details: any; created_at: string };
type Profile = { id: string; email: string; full_name: string | null };

export default function AdminAuditLog() {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      setAllowed(((data as any[]) || []).some(r => r.role === "admin"));
    })();
  }, [navigate]);

  useEffect(() => {
    if (!allowed) return;
    (async () => {
      const { data } = await supabase.from("staff_audit_log").select("*").order("created_at", { ascending: false }).limit(500);
      const list = (data as Log[]) || [];
      setLogs(list);
      const ids = Array.from(new Set(list.map(l => l.actor_id).filter(Boolean)));
      if (ids.length) {
        const { data: p } = await supabase.from("profiles").select("id,email,full_name").in("id", ids);
        const map: Record<string, Profile> = {};
        ((p as Profile[]) || []).forEach(pr => { map[pr.id] = pr; });
        setProfiles(map);
      }
    })();
  }, [allowed]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return logs;
    return logs.filter(l => {
      const actor = profiles[l.actor_id];
      return l.action.toLowerCase().includes(term) ||
        (l.target_type || "").toLowerCase().includes(term) ||
        (actor?.email || "").toLowerCase().includes(term) ||
        JSON.stringify(l.details || {}).toLowerCase().includes(term);
    });
  }, [logs, q, profiles]);

  if (allowed === null) return <AuthLayout><div className="flex justify-center py-32"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div></AuthLayout>;
  if (!allowed) return (
    <AuthLayout><Card className="max-w-md mx-auto mt-16"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-destructive"/>Admin only</CardTitle></CardHeader><CardContent><Button onClick={() => navigate("/accounts")}>Back</Button></CardContent></Card></AuthLayout>
  );

  return (
    <AuthLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-secondary flex items-center gap-2"><ScrollText className="h-6 w-6 text-primary" /> Staff audit log</h1>
          <p className="text-sm text-muted-foreground">Every privileged action recorded server-side. Read-only.</p>
        </div>
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
              <CardTitle>Recent activity</CardTitle>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search action, actor, target" value={q} onChange={e => setQ(e.target.value)} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">No audit entries.</p> : (
              <div className="space-y-2">
                {filtered.map(l => {
                  const actor = profiles[l.actor_id];
                  return (
                    <div key={l.id} className="border rounded-lg p-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{l.action}</Badge>
                        {l.target_type && <span className="text-xs text-muted-foreground">on {l.target_type}</span>}
                        <span className="ml-auto text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm mt-1"><span className="font-medium text-secondary">{actor?.full_name || actor?.email || l.actor_id.slice(0, 8)}</span></p>
                      {l.details && Object.keys(l.details).length > 0 && (
                        <pre className="text-[11px] bg-muted rounded p-2 mt-2 overflow-x-auto">{JSON.stringify(l.details, null, 2)}</pre>
                      )}
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
