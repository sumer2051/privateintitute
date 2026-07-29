import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Ticket } from "lucide-react";

type Profile = { id: string; full_name: string | null; email: string | null };
type Staff = { user_id: string; role: string; full_name: string | null; email: string | null };

export function AdminCreateTicketDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
}) {
  const [users, setUsers] = useState<Profile[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [assignedTo, setAssignedTo] = useState<string>("__none");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [category, setCategory] = useState<string>("");
  const [userQuery, setUserQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [{ data: profs }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email").order("full_name", { ascending: true }).limit(500),
        supabase.from("user_roles").select("user_id, role").in("role", ["admin", "support", "tx_support"]),
      ]);
      setUsers((profs as Profile[]) || []);
      const roleMap = new Map<string, string>();
      ((roles as any[]) || []).forEach((r) => {
        // prefer support/tx_support label, fall back to admin
        const prev = roleMap.get(r.user_id);
        if (!prev || prev === "admin") roleMap.set(r.user_id, r.role);
      });
      const staffList: Staff[] = Array.from(roleMap.entries()).map(([uid, role]) => {
        const p = (profs as Profile[] | null)?.find((x) => x.id === uid);
        return { user_id: uid, role, full_name: p?.full_name || null, email: p?.email || null };
      });
      setStaff(staffList);
    })();
  }, [open]);

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return users.slice(0, 50);
    return users
      .filter((u) => (u.full_name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q))
      .slice(0, 50);
  }, [users, userQuery]);

  const reset = () => {
    setUserId(""); setAssignedTo("__none"); setSubject(""); setDescription("");
    setPriority("medium"); setCategory(""); setUserQuery("");
  };

  const submit = async () => {
    if (!userId) return toast.error("Pick a user");
    if (!subject.trim()) return toast.error("Subject required");
    if (!description.trim()) return toast.error("Description required");
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_create_ticket", {
      p_user: userId,
      p_subject: subject.trim(),
      p_description: description.trim(),
      p_priority: priority,
      p_category: category.trim() || null,
      p_assigned_to: assignedTo === "__none" ? null : assignedTo,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Ticket created and sent to user");
    reset();
    onOpenChange(false);
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Ticket className="h-5 w-5 text-primary" /> New ticket for user</DialogTitle>
          <DialogDescription>Create a ticket on behalf of a customer and assign it to a staff member.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Search user</Label>
            <Input value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="Name or email" />
          </div>
          <div>
            <Label>Target user</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger><SelectValue placeholder="Pick a user" /></SelectTrigger>
              <SelectContent className="max-h-64">
                {filteredUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {(u.full_name || "—")} · {u.email}
                  </SelectItem>
                ))}
                {filteredUsers.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No match</div>}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Assign to staff</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Unassigned</SelectItem>
                {staff.map((s) => (
                  <SelectItem key={s.user_id} value={s.user_id}>
                    {(s.full_name || s.email || s.user_id.slice(0, 8))} · {s.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["low", "medium", "high", "urgent"].map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div>
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Short summary" />
          </div>
          <div>
            <Label>Message to user</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} placeholder="What should the user see?" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ticket className="mr-2 h-4 w-4" />}
            Create ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
