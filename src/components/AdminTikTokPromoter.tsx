import { useState } from "react";
import { Loader2, Sparkles, Megaphone, Lock, ArrowUpRight, Copy } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Draft = {
  text: string;
  account: { handle: string; followers: number; videos_published: number };
  videoCount: number;
  generatedAt: string;
};

export const AdminTikTokPromoter = ({ embedded = false }: { embedded?: boolean }) => {
  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);

  const run = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("tiktok-promoter", {
        body: focus.trim() ? { focus: focus.trim() } : {},
      });
      if (error) {
        const details = typeof error === "object" && error && "context" in error
          ? await (error as { context: Response }).context.text()
          : String(error?.message ?? error);
        let message = details;
        try { message = JSON.parse(details).error ?? details; } catch { /* keep raw text */ }
        toast.error(message || "Claude could not draft promotion.");
        return;
      }
      if (data?.text) setDraft(data as Draft);
      else toast.error(data?.error ?? "Claude did not produce a draft.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Claude could not draft promotion.");
    } finally {
      setBusy(false);
    }
  };

  const copyDraft = async () => {
    if (!draft) return;
    try { await navigator.clipboard.writeText(draft.text); toast.success("Draft copied."); }
    catch { toast.error("Could not copy the draft. Please select and copy the text."); }
  };
  const Container = embedded ? "section" : Card;
  return (
    <Container>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" /> TikTok promoter</span>
          {!embedded && <Button asChild variant="outline" size="sm"><Link to="/admin/tiktok">Open TikTok page<ArrowUpRight className="ml-2 h-4 w-4" /></Link></Button>}
        </CardTitle>
        <CardDescription>
          Claude · Promotion drafts only · No automatic publishing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3">
          <label htmlFor={embedded ? "tiktok-page-focus" : "tiktok-focus"} className="text-sm font-medium">Promotion focus</label>
          <Textarea
            id={embedded ? "tiktok-page-focus" : "tiktok-focus"}
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder="Optional focus, e.g. “first three videos for new members”"
            className="min-h-[60px] flex-1"
            maxLength={400}
          />
          <Button onClick={run} disabled={busy} className="self-start max-w-full whitespace-normal h-auto min-h-10">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Draft promotion with Claude
          </Button>
        </div>

        {draft && (
          <div className="space-y-4 border-t pt-5" aria-live="polite">
            <p className="text-xs text-muted-foreground">
              {draft.account.handle} · {draft.account.followers} followers · {draft.videoCount} video
              {draft.videoCount === 1 ? "" : "s"} read · {new Date(draft.generatedAt).toLocaleString()}
            </p>
            <pre className="whitespace-pre-wrap break-words font-sans text-sm text-foreground">{draft.text}</pre>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void copyDraft()}
              >
                <Copy className="mr-2 h-4 w-4" />Copy draft
              </Button>
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Lock className="h-3 w-3" /> Read-only: this app cannot post or reply on TikTok
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Container>
  );
};
