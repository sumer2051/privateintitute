import { useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Copy, ExternalLink, Loader2, MessageCircle, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export function TikTokCommentReplies({ profileUrl }: { profileUrl?: string }) {
  const [comment, setComment] = useState("");
  const [context, setContext] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [source, setSource] = useState("");

  const draft = async () => {
    const text = comment.trim();
    if (!text || text.length > 2000 || context.trim().length > 600) { setError("Enter a comment of up to 2,000 characters."); return; }
    setBusy(true); setError(""); setCopied(false);
    try {
      const { data, error: requestError } = await supabase.functions.invoke("tiktok-promoter", { body: { mode: "reply", comment: text, context: context.trim() } });
      if (requestError) {
        const details = requestError instanceof FunctionsHttpError ? await requestError.context.text() : requestError.message;
        let message = details;
        try { message = JSON.parse(details).error || details; } catch { /* keep response */ }
        throw new Error(message);
      }
      if (typeof data?.text !== "string" || !data.text.trim()) throw new Error("Claude did not return a reply.");
      setReply(data.text.trim()); setSource(text);
    } catch (e) { setError(e instanceof Error ? e.message : "Reply could not be drafted."); }
    finally { setBusy(false); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(reply); setCopied(true); toast.success("Reply copied — nothing posted."); }
    catch { toast.error("Could not copy. Select and copy the reply text."); }
  };
  const stale = Boolean(source && source !== comment.trim());
  return <section className="space-y-6 pt-6 min-w-0" aria-label="TikTok comment replies">
    <div className="space-y-2"><h2 className="flex items-center gap-2 text-xl font-semibold"><MessageCircle className="h-5 w-5 text-primary" />Comment replies</h2><Badge variant="secondary">Manual comments · Draft only</Badge><p className="text-sm text-muted-foreground">Live comment access is unavailable. Paste a comment from TikTok; review the draft and post it there yourself. Remove private account details first.</p></div>
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <div className="space-y-2"><Label htmlFor="tiktok-real-comment">Comment from TikTok</Label><Textarea id="tiktok-real-comment" value={comment} onChange={e => { setComment(e.target.value); setCopied(false); }} disabled={busy} maxLength={2000} placeholder="Paste the actual viewer comment" className="min-h-36" /><p className="text-xs text-muted-foreground">{comment.length.toLocaleString()} / 2,000</p></div>
        <div className="space-y-2"><Label htmlFor="tiktok-comment-context">Video context (optional)</Label><Textarea id="tiktok-comment-context" value={context} onChange={e => { setContext(e.target.value); setReply(""); setSource(""); }} disabled={busy} maxLength={600} placeholder="What was the video about?" /></div>
        <div className="flex flex-wrap gap-2"><Button onClick={() => void draft()} disabled={busy || !comment.trim()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}{busy ? "Drafting…" : "Draft reply with Claude"}</Button><Button variant="ghost" size="icon" aria-label="Clear comment and reply" title="Clear comment and reply" disabled={busy || (!comment && !reply)} onClick={() => { setComment(""); setContext(""); setReply(""); setSource(""); setError(""); setCopied(false); }}><Trash2 className="h-4 w-4" /></Button></div>
        {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
      </div>
      <div className="space-y-4 border-t pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0">
        <div className="flex flex-wrap items-center justify-between gap-2"><Label htmlFor="tiktok-comment-reply">Your reply</Label>{copied && <Badge variant="outline">Copied · Not posted</Badge>}</div>
        <Textarea id="tiktok-comment-reply" value={reply} onChange={e => { setReply(e.target.value); setCopied(false); }} disabled={busy} maxLength={4000} placeholder="Reply draft" className="min-h-48" />
        <p className="text-xs text-muted-foreground">{reply.length} characters · Editable draft · Not saved between visits</p>
        {stale && <p role="status" className="text-sm text-destructive">Comment changed. Generate a new reply before copying.</p>}
        <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!reply.trim() || busy || stale} onClick={() => void copy()}><Copy className="mr-2 h-4 w-4" />Copy reply</Button>{profileUrl && <Button asChild variant="outline"><a href={profileUrl} target="_blank" rel="noopener noreferrer">Open TikTok<ExternalLink className="ml-2 h-4 w-4" /></a></Button>}</div>
      </div>
    </div>
  </section>;
}