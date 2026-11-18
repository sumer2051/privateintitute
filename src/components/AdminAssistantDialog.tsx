import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftRight, ScrollText, ShieldCheck, Users, LifeBuoy, Mail, Megaphone, KeyRound, Sparkles } from "lucide-react";
import { AdminAssistantLookup } from "@/components/AdminAssistantLookup";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function AdminAssistantDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState("menu");
  useEffect(() => { if (open) setTab("menu"); }, [open]);
  const go = (path: string) => { onOpenChange(false); navigate(path); };

  return <Dialog open={open} onOpenChange={value => { if (value) setTab("menu"); onOpenChange(value); }}>
    <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl max-h-[90dvh] overflow-y-auto p-4 sm:p-6 [&>*]:min-w-0">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 pr-6"><ShieldCheck className="h-5 w-5 shrink-0 text-primary" />Admin center</DialogTitle>
        <DialogDescription>Admin tools and Claude reviews. Financial changes require your manual confirmation.</DialogDescription>
      </DialogHeader>
      <Tabs value={tab} onValueChange={setTab} className="min-w-0">
        <TabsList className="w-full"><TabsTrigger value="menu" className="flex-1">Admin functions</TabsTrigger><TabsTrigger value="ai" className="flex-1"><Sparkles className="mr-2 h-4 w-4" />Claude AI</TabsTrigger></TabsList>
        <TabsContent value="menu" className="space-y-2 pt-3">
          {[
            { path: "/admin/users", label: "Users · credit / debit, roles, devices and themes", Icon: Users },
            { path: "/admin/transactions", label: "Transactions · review and process", Icon: ArrowLeftRight },
            { path: "/admin/support", label: "Support tickets", Icon: LifeBuoy },
            { path: "/admin/invitations", label: "Invitations", Icon: Mail },
            { path: "/admin/announcements", label: "Announcements", Icon: Megaphone },
            { path: "/admin/audit", label: "Audit log", Icon: ScrollText },
            { path: "/admin/resend-pin", label: "Resend PIN", Icon: KeyRound },
          ].map(({ path, label, Icon }) => <Button key={path} variant="outline" className="w-full h-auto min-h-11 justify-start whitespace-normal text-left" onClick={() => go(path)}><Icon className="mr-3 h-4 w-4 shrink-0" />{label}</Button>)}
          <Button variant="secondary" className="w-full justify-start" onClick={() => setTab("ai")}><Sparkles className="mr-3 h-4 w-4" />Claude AI assistant</Button>
        </TabsContent>
        <TabsContent value="ai" className="pt-3"><AdminAssistantLookup onNavigate={() => onOpenChange(false)} /></TabsContent>
      </Tabs>
    </DialogContent>
  </Dialog>;
}