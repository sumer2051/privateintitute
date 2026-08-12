import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { playSound, primeSounds } from "@/lib/sounds";

/**
 * Global sound listener: plays a bank chime when money lands in one of the
 * user's accounts (or a pending deposit completes) and a soft tone when money
 * leaves. Also unlocks the audio pipeline on the first user gesture.
 */
export function BankSoundListener() {
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unlock = () => primeSounds();
    const events: (keyof DocumentEventMap)[] = ["pointerdown", "keydown", "touchstart"];
    events.forEach((e) => document.addEventListener(e, unlock, { once: true, passive: true }));
    return () => events.forEach((e) => document.removeEventListener(e, unlock));
  }, []);

  useEffect(() => {
    let userId: string | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const isIncoming = (row: any) =>
      row?.transaction_type === "credit" || Number(row?.amount) > 0 && row?.transaction_type !== "debit";

    const settled = (status?: string | null) =>
      !status || ["completed", "success", "successful", "posted"].includes(String(status).toLowerCase());

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      userId = user.id;

      channel = supabase
        .channel(`bank-sounds-${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "transactions", filter: `user_id=eq.${userId}` },
          ({ new: row }: any) => {
            const key = `i-${row?.id}-${row?.status}`;
            if (!row || seen.current.has(key)) return;
            seen.current.add(key);
            if (isIncoming(row) && settled(row.status)) playSound("moneyIn");
            else if (row.transaction_type === "debit" && settled(row.status)) playSound("moneyOut");
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "transactions", filter: `user_id=eq.${userId}` },
          ({ new: row, old }: any) => {
            if (!row) return;
            if (old?.status === row.status) return;
            const key = `u-${row.id}-${row.status}`;
            if (seen.current.has(key)) return;
            seen.current.add(key);
            if (!settled(row.status)) return;
            playSound(isIncoming(row) ? "moneyIn" : "moneyOut");
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
