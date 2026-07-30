import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin } from "lucide-react";
import { mapsApi } from "@/lib/maps";

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

/** Address field with Google Places autocomplete suggestions. */
export const AddressAutocomplete = ({ id, value, onChange, placeholder }: Props) => {
  const [suggestions, setSuggestions] = useState<{ placeId: string; text: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const sessionToken = useRef(Math.random().toString(36).slice(2));
  const skipNext = useRef(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    if (!value || value.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const { suggestions } = await mapsApi.autocomplete(value.trim(), sessionToken.current);
        if (!cancelled) {
          setSuggestions(suggestions ?? []);
          setOpen((suggestions ?? []).length > 0);
        }
      } catch (_) {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pick = (text: string) => {
    skipNext.current = true;
    onChange(text);
    setOpen(false);
    setSuggestions([]);
    sessionToken.current = Math.random().toString(36).slice(2);
  };

  return (
    <div ref={wrapRef} className="relative">
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          {suggestions.map((s) => (
            <button
              key={s.placeId}
              type="button"
              onClick={() => pick(s.text)}
              className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted"
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="line-clamp-2">{s.text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
