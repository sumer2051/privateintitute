import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";

/**
 * Global lightweight toaster: shows a small, brief pop-up when a support agent
 * replies to one of the current user's tickets. Tap it to jump to /support.
 * Each message is only surfaced once per session.
 */
export function TicketReplyToaster() {
  const navigate = useNavigate();
  const location = useLocation();
  const seenRef = useRef<Set<string>>(new Set());
  const locationRef = useRef(location.pathname);
  locationRef.current = location.pathname;

  useEffect(() => {
    let userId: string | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userId = user.id;

      channel = supabase
        .channel(`ticket-reply-toaster-${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "ticket_messages" },
          async (payload) => {
            const row = payload.new as {
              id: string;
              ticket_id: string;
              sender_type: string;
              sender_id: string | null;
            };
            if (!row || seenRef.current.has(row.id)) return;
            if (row.sender_type === "customer") return;
            if (row.sender_id && row.sender_id === userId) return;

            // Confirm ticket belongs to current user
            const { data: t } = await supabase
              .from("support_tickets")
              .select("user_id, ticket_number, subject")
              .eq("id", row.ticket_id)
              .maybeSingle();
            if (!t || t.user_id !== userId) return;

            seenRef.current.add(row.id);

            // Skip toast if already on /support — the page shows it inline.
            if (locationRef.current === "/support") return;

            toast(
              `New reply on ${t.ticket_number}`,
              {
                description: t.subject,
                duration: 4000,
                icon: <MessageSquare className="h-4 w-4 text-primary" />,
                className: "cursor-pointer",
                onAutoClose: () => {},
                action: {
                  label: "View",
                  onClick: () => navigate("/support"),
                },
              }
            );
          }
        )
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [navigate]);

  return null;
}
