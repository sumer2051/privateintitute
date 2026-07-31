import { useCallback, useEffect, useState } from "react";

const KEY = "ios.shell.enabled";
const EVENT = "ios-shell-toggle";

export function isIosShellEnabled() {
  try {
    // Default OFF: the device shell only appears once the user turns it on.
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}


/** Shared toggle for the iPhone 17 Pro Max device shell (status bar + home indicator). */
export function useIosShell() {
  const [enabled, setEnabled] = useState(isIosShellEnabled);

  useEffect(() => {
    const sync = () => setEnabled(isIosShellEnabled());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setIosShell = useCallback((next: boolean) => {
    try {
      localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    setEnabled(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { enabled, setIosShell };
}
