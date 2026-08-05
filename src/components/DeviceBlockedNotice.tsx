import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";

export const DEVICE_BLOCKED_KEY = "boa.device.blocked";
export const DEVICE_BLOCKED_EVENT = "boa:device-blocked";

/**
 * Full-screen security notice shown when an administrator has locked this device.
 * Persists across the forced sign-out until the lock is lifted.
 */
export const DeviceBlockedNotice = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sync = () => {
      try {
        setOpen(localStorage.getItem(DEVICE_BLOCKED_KEY) === "1");
      } catch (_) { /* ignore */ }
    };
    sync();
    window.addEventListener(DEVICE_BLOCKED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(DEVICE_BLOCKED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-background/95 backdrop-blur-md px-6">
      <div className="max-w-md w-full text-center space-y-6 rounded-3xl border border-destructive/30 bg-card p-8 shadow-2xl ios-safe-sheet">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="h-10 w-10 text-destructive" />
        </div>
        <h1 className="font-serif text-3xl font-bold leading-tight text-foreground">
          Device Restricted
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          For your privacy and security, we have restricted this device from
          accessing your account. Our security team is currently reviewing your
          account and will get back to you with feedback.
        </p>
        <p className="text-sm text-muted-foreground">
          If you need immediate assistance, please contact our support team.
        </p>
      </div>
    </div>
  );
};
