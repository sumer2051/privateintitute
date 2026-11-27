// Maps a raw transaction status to the member-facing 4-step tracker.
export const TRACKER_STEPS = ["Request received", "Being checked", "Moving", "Done"] as const;

export type TrackerState = { step: number; stopped: null | "failed" | "cancelled" };

export const trackerState = (status?: string | null): TrackerState => {
  const s = String(status || "completed").toLowerCase();
  if (s === "failed" || s === "cancelled") return { step: -1, stopped: s };
  if (s === "pending") return { step: 0, stopped: null };
  if (["processing", "under_review", "compliance_hold"].includes(s)) return { step: 1, stopped: null };
  if (["reviewed", "clearing"].includes(s)) return { step: 2, stopped: null };
  return { step: 3, stopped: null };
};

// The same moving steps admins use when they change a transfer's status.
export const ADMIN_STEPS = [
  { key: "pending", label: "Pending" },
  { key: "processing", label: "Processing" },
  { key: "under_review", label: "Under review" },
  { key: "compliance_hold", label: "Compliance hold" },
  { key: "reviewed", label: "Reviewed" },
  { key: "clearing", label: "Clearing" },
  { key: "posting", label: "Posting" },
  { key: "completed", label: "Completed" },
] as const;

/** Index of the admin step for a status; -1 when failed/cancelled. */
export const adminStepIndex = (status?: string | null): number => {
  const s = String(status || "completed").toLowerCase();
  return ADMIN_STEPS.findIndex((x) => x.key === s);
};
