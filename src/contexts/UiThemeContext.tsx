import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UiTheme = "classic" | "luxe";

interface UiThemeContextValue {
  theme: UiTheme;
}

const UiThemeContext = createContext<UiThemeContextValue>({ theme: "luxe" });
const STORAGE_KEY = "app.uiTheme";

const isTheme = (v: unknown): v is UiTheme => v === "classic" || v === "luxe";

export const UiThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<UiTheme>(() => {
    if (typeof window === "undefined") return "luxe";
    const saved = localStorage.getItem(STORAGE_KEY);
    return isTheme(saved) ? saved : "luxe";
  });

  const userId = useRef<string | null>(null);

  // Keep the <html> class in sync so the whole app restyles at once.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme);
    const root = document.documentElement;
    root.classList.toggle("theme-luxe", theme === "luxe");
  }, [theme]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const load = async (uid: string) => {
      if (userId.current === uid && channel) return;
      userId.current = uid;
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }

      const { data } = await supabase
        .from("profiles")
        .select("ui_theme")
        .eq("id", uid)
        .maybeSingle();
      const saved = (data as any)?.ui_theme;
      if (isTheme(saved)) setTheme(saved);

      channel = supabase
        .channel(`profile-ui-theme-${uid}-${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${uid}` },
          (payload) => {
            const next = (payload.new as any)?.ui_theme;
            if (isTheme(next)) setTheme(next);
          },
        )
        .subscribe();
    };

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) load(data.session.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const uid = session?.user?.id ?? null;
      if (uid) load(uid);
      else userId.current = null;
    });

    return () => {
      sub.subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return <UiThemeContext.Provider value={{ theme }}>{children}</UiThemeContext.Provider>;
};

export const useUiTheme = () => useContext(UiThemeContext);
