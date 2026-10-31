import { useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { ClipboardCheck, FileText, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function AdminAiReview({ userId }: { userId: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [reviewedAt, setReviewedAt] = useState("");
  const review = async (mode: "summary" | "review") => {
    setBusy(true); setError(""); setResult("");
    try {
      const { data, error: failure } = await supabase.functions.invoke("admin-ai-review", { body: { userId, mode } });
      if (failure) {
        let message = failure.message;
        if (failure instanceof FunctionsHttpError) {
          const raw = await failure.context.text();
          try { message = JSON.parse(raw).error || message; } catch { /* Do not expose raw server pages. */ }
        }
        throw new Error(message);
      }
      if (!data?.text) throw new Error("Claude returned no review.");
      setResult(data.text); setReviewedAt(data.reviewedAt);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to complete the review."); }
    finally { setBusy(false); }
  };
  return <section className="border-y py-4 space-y-3" aria-label="Claude admin assistant">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" />Claude account review</h3>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={() => review("summary")}><FileText className="h-4 w-4 mr-2" />Summarize</Button>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => review("review")}><ClipboardCheck className="h-4 w-4 mr-2" />Flag for review</Button>
      </div>
    </div>
    <p className="text-xs text-muted-foreground">Read-only · Lovable AI credits · Review required, not a fraud determination</p>
    <p className="text-xs text-muted-foreground">Selected account figures and up to 50 recent transactions are shared with Claude. Names, contact details and account numbers are excluded.</p>
    {busy && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Reviewing account activity…</p>}
    {error && <p role="alert" className="text-sm text-destructive break-words">{error}</p>}
    {result && <><div className="text-sm leading-relaxed whitespace-pre-wrap break-words" aria-live="polite">{result}</div><p className="text-xs text-muted-foreground">Reviewed {new Date(reviewedAt).toLocaleString()} · Ledger amounts in USD</p></>}
  </section>;
}