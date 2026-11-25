import { useState } from "react";
import { Loader2, Sparkles, Megaphone, Lock } from "lucide-react";
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

export const AdminTikTokPromoter = () => {
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
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" /> TikTok promoter
        </CardTitle>
        <CardDescription>
          Claude reads the connected TikTok account and drafts promotion for the bank. Nothing is posted
          automatically — copy the text and publish it yourself. TikTok does not give this app access to
          viewer comments, so reply templates are drafts, not live replies.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Textarea
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder="Optional focus, e.g. “first three videos for new members”"
            className="min-h-[60px] flex-1"
            maxLength={400}
          />
          <Button onClick={run} disabled={busy} className="shrink-0">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Draft promotion with Claude
          </Button>
        </div>

        {draft && (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">
              {draft.account.handle} · {draft.account.followers} followers · {draft.videoCount} video
              {draft.videoCount === 1 ? "" : "s"} read · {new Date(draft.generatedAt).toLocaleString()}
            </p>
            <pre className="whitespace-pre-wrap break-words font-sans text-sm text-foreground">{draft.text}</pre>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => { navigator.clipboard.writeText(draft.text); toast.success("Copied — paste it into TikTok."); }}
              >
                Copy draft
              </Button>
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Lock className="h-3 w-3" /> Read-only: this app cannot post or reply on TikTok
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
