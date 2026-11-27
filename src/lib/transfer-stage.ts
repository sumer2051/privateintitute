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
