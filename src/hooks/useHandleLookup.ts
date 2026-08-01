import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LookupStatus = "idle" | "invalid" | "checking" | "found" | "unverified";

const titleize = (raw: string) =>
  raw
    .replace(/[._\-+]+/g, " ")
    .replace(/\d+/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.trim());
const isPhone = (v: string) => /^\+?[\d\s()-]{10,16}$/.test(v.trim());

/** Validates a cashtag / @handle / email and resolves the recipient's name. */
export const validateIdentifier = (
  method: "cashapp" | "venmo" | "paypal" | "zelle",
  value: string
): { valid: boolean; hint: string; key: string } => {
  const v = (value || "").trim();
  if (!v) return { valid: false, hint: "", key: "" };

  if (method === "cashapp") {
    const ok = /^\$[A-Za-z][A-Za-z0-9_]{1,19}$/.test(v);
    return { valid: ok, hint: ok ? "" : "Cashtag must start with $ (e.g. $johnsmith)", key: v.toLowerCase() };
  }
  if (method === "venmo") {
    const ok = /^@?[A-Za-z][A-Za-z0-9_.-]{2,29}$/.test(v);
    return { valid: ok, hint: ok ? "" : "Username must be 3–30 letters, numbers or _ . -", key: v.replace(/^@/, "").toLowerCase() };
  }
  // paypal / zelle: email or phone
  const ok = isEmail(v) || (method === "zelle" && isPhone(v));
  return {
    valid: ok,
    hint: ok ? "" : method === "zelle" ? "Enter a valid email or US mobile number" : "Enter a valid email address",
    key: v.toLowerCase(),
  };
};

/**
 * Looks the identifier up against the user's saved contacts, payees and past
 * transfers. Falls back to deriving a display name from the handle itself.
 */
export const useHandleLookup = (
  method: "cashapp" | "venmo" | "paypal" | "zelle",
  value: string,
  onResolved?: (name: string) => void
) => {
  const [status, setStatus] = useState<LookupStatus>("idle");
  const [name, setName] = useState("");
  const [hint, setHint] = useState("");
  const resolvedRef = useRef<string>("");

  useEffect(() => {
    const { valid, hint: h, key } = validateIdentifier(method, value);
    setHint(h);
    if (!value?.trim()) {
      setStatus("idle");
      setName("");
      return;
    }
    if (!valid) {
      setStatus("invalid");
      setName("");
      return;
    }

    let cancelled = false;
    setStatus("checking");
    const timer = setTimeout(async () => {
      let found = "";
      try {
        const [contacts, payees, txs] = await Promise.all([
          supabase.from("zelle_contacts").select("contact_name, contact_email, contact_phone").limit(200),
          supabase.from("payees").select("payee_name, account_number").limit(200),
          supabase
            .from("transactions")
            .select("recipient_name, description")
            .not("recipient_name", "is", null)
            .order("created_at", { ascending: false })
            .limit(200),
        ]);

        const match = (contacts.data ?? []).find(
          (c) =>
            (c.contact_email ?? "").toLowerCase() === key ||
            (c.contact_phone ?? "").replace(/\D/g, "") === key.replace(/\D/g, "")
        );
        if (match) found = match.contact_name;

        if (!found) {
          const p = (payees.data ?? []).find((x) => (x.account_number ?? "").toLowerCase() === key);
          if (p) found = p.payee_name;
        }
        if (!found) {
          const t = (txs.data ?? []).find((x) => (x.description ?? "").toLowerCase().includes(key));
          if (t?.recipient_name) found = t.recipient_name;
        }
      } catch {
        /* ignore — fall through to derived name */
      }

      if (cancelled) return;
      if (found) {
        setName(found);
        setStatus("found");
      } else {
        const local = key.includes("@") ? key.split("@")[0] : key.replace(/^[$@]/, "");
        const derived = titleize(local);
        setName(derived);
        setStatus(derived ? "unverified" : "invalid");
      }
      const finalName = found || titleize(key.includes("@") ? key.split("@")[0] : key.replace(/^[$@]/, ""));
      if (finalName && resolvedRef.current !== finalName) {
        resolvedRef.current = finalName;
        onResolved?.(finalName);
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, value]);

  return { status, name, hint };
};
