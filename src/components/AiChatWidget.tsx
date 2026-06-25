import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AiChatWidget = ({ open, onOpenChange }: Props) => {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hi, I'm Ava — your BoA private institute assistant. Ask me anything about your accounts, transfers, or security. If you need a human, I'll schedule a specialist to reach out.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessages((m) => [...m, { role: "assistant", content: "Please sign in to chat with support." }]);
        return;
      }
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-support-chat`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: data.error || "Sorry, I hit an error. Please try again." },
        ]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: data.reply || "(no response)" }]);
      }
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Network error. Please check your connection." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating bubble */}
      <button
        onClick={() => onOpenChange(!open)}
        className={cn(
          "fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-2xl transition-all hover:scale-110",
          "bg-gradient-to-br from-primary via-primary to-accent",
          open && "scale-0 opacity-0 pointer-events-none",
        )}
        aria-label="Open live chat"
      >
        <span className="absolute inset-0 rounded-full bg-primary/40 blur-xl animate-pulse" />
        <MessageCircle className="relative h-6 w-6" />
      </button>

      {/* Chat window */}
      <div
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-[560px] w-[90vw] max-w-sm flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl transition-all duration-300",
          open ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-4",
        )}
      >
        <div className="flex items-center justify-between bg-gradient-to-r from-primary to-accent px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">Ava · Live Support</p>
              <p className="text-[10px] opacity-90">AI-powered · Human escalation available</p>
            </div>
          </div>
          <button onClick={() => onOpenChange(false)} className="rounded-full p-1 hover:bg-white/20">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-muted/30 p-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "flex",
                m.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-card border rounded-bl-sm text-foreground",
                )}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm border bg-card px-3 py-2 text-sm">
                <span className="inline-flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
                </span>
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex gap-2 border-t bg-card p-3"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={loading}
            autoFocus
          />
          <Button type="submit" size="icon" disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </>
  );
};
