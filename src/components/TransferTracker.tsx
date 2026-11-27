import { Check, XCircle } from "lucide-react";
import { ADMIN_STEPS, adminStepIndex } from "@/lib/transfer-stage";

export const TransferTracker = ({ status, createdAt }: { status?: string | null; createdAt?: string | null }) => {
  const s = String(status || "completed").toLowerCase();
  if (s === "failed" || s === "cancelled") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive" data-testid="transfer-tracker">
        <XCircle className="h-3.5 w-3.5" /> {s === "failed" ? "This transfer stopped. No money was moved." : "This transfer was cancelled."}
      </div>
    );
  }
  const idx = adminStepIndex(s);
  const done = idx === ADMIN_STEPS.length - 1;
  return (
    <div className="rounded-lg border bg-muted/30 px-2.5 py-2" data-testid="transfer-tracker">
      <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>Transfer progress</span>
        {createdAt && <span className="normal-case tracking-normal">Sent {new Date(createdAt).toLocaleDateString()}</span>}
      </div>
      <ol className="grid grid-cols-4 gap-x-1 gap-y-1.5">
        {ADMIN_STEPS.map((st, i) => {
          const passed = i < idx || (done && i === idx);
          const current = i === idx && !done;
          return (
            <li key={st.key} className="flex items-center gap-1 min-w-0">
              <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${passed ? "border-primary bg-primary text-primary-foreground" : current ? "border-primary bg-background" : "border-border bg-background"}`}>
                {passed ? <Check className="h-2.5 w-2.5" /> : current ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> : null}
              </span>
              <span className={`truncate text-[10px] leading-tight ${current ? "font-semibold text-primary" : passed ? "font-medium" : "text-muted-foreground"}`}>{st.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
