import { Check, XCircle } from "lucide-react";
import { TRACKER_STEPS, trackerState } from "@/lib/transfer-stage";

const NEXT: Record<number, string> = {
  0: "Next: our team checks and approves it, usually within 1 business day.",
  1: "Next: once checks finish, the money starts moving, usually 1–2 business days.",
  2: "Next: the recipient's bank posts the funds, usually within 1 business day.",
};

export const TransferTracker = ({ status, createdAt }: { status?: string | null; createdAt?: string | null }) => {
  const { step, stopped } = trackerState(status);
  if (stopped) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" data-testid="transfer-tracker">
        <XCircle className="h-4 w-4" /> {stopped === "failed" ? "This transfer stopped. No money was moved." : "This transfer was cancelled."}
      </div>
    );
  }
  return (
    <div className="rounded-xl border bg-muted/30 p-3" data-testid="transfer-tracker">
      <ol className="space-y-0">
        {TRACKER_STEPS.map((label, i) => {
          const done = i < step || (i === 3 && step === 3);
          const current = i === step && step < 3;
          return (
            <li key={label} className="relative flex gap-3 pb-3 last:pb-0">
              {i < TRACKER_STEPS.length - 1 && (
                <span className={`absolute left-[9px] top-5 h-[calc(100%-1.25rem)] w-0.5 ${i < step ? "bg-primary" : "bg-border"}`} />
              )}
              <span className={`z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${done ? "border-primary bg-primary text-primary-foreground" : current ? "border-primary bg-background" : "border-border bg-background"}`}>
                {done ? <Check className="h-3 w-3" /> : current ? <span className="h-2 w-2 animate-pulse rounded-full bg-primary" /> : null}
              </span>
              <div className="min-w-0">
                <div className={`text-sm ${done || current ? "font-semibold" : "text-muted-foreground"}`}>{label}</div>
                {i === 0 && createdAt && <div className="text-[11px] text-muted-foreground">{new Date(createdAt).toLocaleString()}</div>}
                {current && NEXT[i] && <div className="text-[11px] text-muted-foreground">{NEXT[i]}</div>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
