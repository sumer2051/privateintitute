import { Check, Loader2, AlertCircle } from "lucide-react";
import type { LookupStatus } from "@/hooks/useHandleLookup";

interface Props {
  status: LookupStatus;
  name: string;
  hint: string;
  accent: string;
  onUseName?: (name: string) => void;
}

/** Inline "verifying / found recipient" row shown under a handle field. */
export const HandleVerifyRow = ({ status, name, hint, accent, onUseName }: Props) => {
  if (status === "idle") return null;

  if (status === "checking") {
    return (
      <div className="flex items-center gap-2 text-[12px] text-gray-500 pt-1.5">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Looking up recipient…
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="flex items-center gap-2 text-[12px] font-medium text-red-600 pt-1.5">
        <AlertCircle className="h-3.5 w-3.5" />
        {hint || "This account could not be verified"}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onUseName?.(name)}
      className="mt-2 w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left border active:opacity-80"
      style={{ borderColor: `${accent}40`, background: `${accent}12` }}
    >
      <span
        className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
        style={{ background: accent }}
      >
        {status === "found" ? <Check className="h-4 w-4" strokeWidth={3} /> : name.charAt(0).toUpperCase()}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-bold text-black truncate">{name}</span>
        <span className="block text-[11px] text-gray-500">
          {status === "found" ? "Verified recipient" : "Name from account — tap to confirm"}
        </span>
      </span>
    </button>
  );
};
