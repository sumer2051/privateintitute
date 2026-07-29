import { useEffect, useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { KeyRound, Mail, Loader2, ShieldAlert } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function AdminResendPin() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [ticketNumber, setTicketNumber] = useState(params.get("ticket") || "");
  const [sending, setSending] = useState(false);
  const [lastSent, setLastSent] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const roles = (data || []).map((r: any) => r.role);
      setAllowed(roles.some((r) => ["admin", "support", "tx_support"].includes(r)));
    })();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = ticketNumber.trim();
    if (!num) { toast.error("Enter a ticket number"); return; }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("resend-ticket-pin", {
        body: { ticket_number: num },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setLastSent(num);
      toast.success("Handoff PIN emailed to admin");
    } catch (err: any) {
      toast.error(err?.message || "Failed to resend PIN");
    } finally {
      setSending(false);
    }
  };

  if (allowed === null) return <AuthLayout><div className="p-6">Loading…</div></AuthLayout>;
  if (!allowed) {
    return (
      <AuthLayout>
        <div className="max-w-md mx-auto p-6">
          <Card>
            <CardContent className="p-6 text-center">
              <ShieldAlert className="w-10 h-10 mx-auto text-red-500 mb-2" />
              <p className="font-semibold">Support staff only</p>
            </CardContent>
          </Card>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="max-w-lg mx-auto p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-navy to-navy/80 text-white shadow-md">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Resend Handoff PIN</h1>
            <p className="text-xs text-muted-foreground">Re-send a ticket's staff handoff PIN to the admin inbox.</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ticket Lookup</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ticket">Ticket number</Label>
                <Input
                  id="ticket"
                  placeholder="TKT-2026-000123"
                  value={ticketNumber}
                  onChange={(e) => setTicketNumber(e.target.value.toUpperCase())}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  The 8-digit PIN will be emailed to the admin address on file.
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={sending}>
                {sending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</>
                ) : (
                  <><Mail className="w-4 h-4 mr-2" /> Resend PIN to Admin</>
                )}
              </Button>
            </form>

            {lastSent && (
              <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
                PIN for <span className="font-semibold">{lastSent}</span> resent successfully.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AuthLayout>
  );
}
