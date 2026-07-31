import { useCallback, useEffect, useRef, useState } from "react";
import { useIosShell } from "@/hooks/useIosShell";


import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const CARRIER_KEY = "ios.shell.carrier";
const TIME_KEY = "ios.shell.time";      // "HH:MM" custom, or "" = live device time
const BATT_KEY = "ios.shell.battery";   // 0-100
const CHARGE_KEY = "ios.shell.charging";

function read(key: string, fallback: string) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

function formatTime(d: Date) {
  let h = d.getHours() % 12;
  if (h === 0) h = 12;
  return `${h}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Triple-tap detector */
function useTripleTap(onTriple: () => void) {
  const taps = useRef<number[]>([]);
  return useCallback(() => {
    const now = Date.now();
    taps.current = [...taps.current, now].filter((t) => now - t < 700);
    if (taps.current.length >= 3) {
      taps.current = [];
      onTriple();
    }
  }, [onTriple]);
}

const SignalBars = () => (
  <svg width="22" height="15" viewBox="0 0 18 12" fill="none" aria-hidden="true">

    {[0, 1, 2, 3].map((i) => (
      <rect
        key={i}
        x={i * 4.5}
        y={9 - i * 2.6}
        width="3"
        height={3 + i * 2.6}
        rx="1"
        fill="currentColor"
      />
    ))}
  </svg>
);

const WifiIcon = () => (
  <svg width="20" height="15" viewBox="0 0 16 12" fill="currentColor" aria-hidden="true">
    <path d="M8 10.6 6.1 8.5a2.8 2.8 0 0 1 3.8 0L8 10.6Z" />
    <path d="M8 5.6c-1.4 0-2.7.5-3.7 1.5l-1.2-1.3A7 7 0 0 1 8 3.8a7 7 0 0 1 4.9 2l-1.2 1.3A5.2 5.2 0 0 0 8 5.6Z" />
    <path d="M8 1.6c-2.4 0-4.7.9-6.4 2.6L.4 2.9A11 11 0 0 1 8 0c2.9 0 5.6 1.1 7.6 2.9l-1.2 1.3A9.2 9.2 0 0 0 8 1.6Z" />
  </svg>
);

const Battery = ({ level, charging }: { level: number; charging: boolean }) => {
  const pct = Math.max(0, Math.min(100, level));
  const low = pct <= 20 && !charging;
  return (
    <span className="flex items-center gap-1">
      <span className="relative inline-block h-[15px] w-[30px] rounded-[5px] border border-current/60 p-[2px]">
        <span
          className={`block h-full rounded-[2px] ${
            charging ? "bg-[#34C759]" : low ? "bg-[#FF3B30]" : "bg-current"
          }`}
          style={{ width: `${Math.max(pct, 4)}%` }}
        />
        <span className="absolute -right-[3px] top-1/2 h-[4px] w-[2px] -translate-y-1/2 rounded-r-[1px] bg-current/60" />
      </span>
      {charging && (
        <svg width="8" height="11" viewBox="0 0 8 11" fill="#34C759" aria-hidden="true">
          <path d="M4.6 0 0 6h2.8L2.4 11 8 4.6H4.8L4.6 0Z" />
        </svg>
      )}
    </span>
  );
};

/**
 * iPhone 17 Pro Max style shell: Dynamic Island status bar on top,
 * home indicator on the bottom. Triple-tap the clock or the battery to edit them.
 */
export const DeviceFrame = () => {
  // Rendered outside the Router, so read the path from the browser directly.
  const { enabled: shellEnabled } = useIosShell();
  const [pathname, setPathname] = useState(() => window.location.pathname);
  useEffect(() => {

    const sync = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", sync);
    const iv = setInterval(sync, 500);
    return () => {
      window.removeEventListener("popstate", sync);
      clearInterval(iv);
    };
  }, []);
  // Transfers gets its own opaque chrome so busy sheet/page backgrounds
  // never bleed through the Dynamic Island or status bar.
  const solid = pathname.startsWith("/transfers");
  const [carrier, setCarrier] = useState(() => read(CARRIER_KEY, "AT&T"));


  const [customTime, setCustomTime] = useState(() => read(TIME_KEY, ""));
  const [battery, setBattery] = useState(() => Number(read(BATT_KEY, "100")) || 100);
  const [charging, setCharging] = useState(() => read(CHARGE_KEY, "0") === "1");
  const [now, setNow] = useState(() => new Date());

  const [timeOpen, setTimeOpen] = useState(false);
  const [battOpen, setBattOpen] = useState(false);
  const [draftTime, setDraftTime] = useState("");
  const [draftCarrier, setDraftCarrier] = useState(carrier);
  const [draftBatt, setDraftBatt] = useState(String(battery));

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(iv);
  }, []);

  // Reserve space for the bars across every page (only while the shell is on).
  useEffect(() => {
    const root = document.documentElement;
    if (!shellEnabled) {
      root.classList.remove("ios-shell");
      root.style.removeProperty("--ios-status-h");
      root.style.removeProperty("--ios-home-h");
      return;
    }
    root.style.setProperty("--ios-status-h", "54px");
    root.style.setProperty("--ios-home-h", "20px");
    root.classList.add("ios-shell");
    return () => {
      root.classList.remove("ios-shell");
      root.style.removeProperty("--ios-status-h");
      root.style.removeProperty("--ios-home-h");
    };
  }, [shellEnabled]);


  const displayTime = customTime || formatTime(now);

  const openTime = useTripleTap(() => {
    setDraftTime(customTime);
    setDraftCarrier(carrier);
    setTimeOpen(true);
  });
  const openBatt = useTripleTap(() => {
    setDraftBatt(String(battery));
    setBattOpen(true);
  });

  const saveTime = () => {
    const v = draftTime.trim();
    setCustomTime(v);
    setCarrier(draftCarrier.trim() || "AT&T");
    try {
      localStorage.setItem(TIME_KEY, v);
      localStorage.setItem(CARRIER_KEY, draftCarrier.trim() || "AT&T");
    } catch { /* ignore */ }
    setTimeOpen(false);
  };

  const saveBatt = () => {
    const v = Math.max(0, Math.min(100, Number(draftBatt) || 0));
    setBattery(v);
    try {
      localStorage.setItem(BATT_KEY, String(v));
      localStorage.setItem(CHARGE_KEY, charging ? "1" : "0");
    } catch { /* ignore */ }
    setBattOpen(false);
  };

  return (
    <>
      {/* iPhone 17 Pro Max status bar — space is reserved, so it never covers page content */}
      <div
        className={`ios-device-chrome fixed inset-x-0 top-0 z-[10050] h-[var(--ios-status-h,54px)] select-none text-foreground ${
          solid ? "ios-chrome-solid" : ""
        }`}
      >
        <div className="relative mx-auto flex h-full max-w-[520px] items-end justify-between px-8 pb-[9px] text-[17px] font-semibold tracking-tight">

          <button
            type="button"
            onClick={openTime}
            aria-label="Status bar clock (triple-tap to edit)"
            className="z-10 flex w-[92px] items-center gap-1.5 text-left tabular-nums"
          >
            <span className="text-[17px] leading-none">{displayTime}</span>
            <span className="text-[11px] font-semibold leading-none opacity-70">{carrier}</span>
          </button>

          {/* Dynamic Island */}
          <div className="pointer-events-none absolute left-1/2 top-[11px] h-[36px] w-[125px] -translate-x-1/2 rounded-full bg-black shadow-[0_1px_4px_rgba(0,0,0,0.35)]">
            <span className="absolute right-[13px] top-1/2 h-[9px] w-[9px] -translate-y-1/2 rounded-full bg-[#101820] ring-1 ring-white/10" />
          </div>

          <button
            type="button"
            onClick={openBatt}
            aria-label="Battery status (triple-tap to edit)"
            className="z-10 flex items-center justify-end gap-[5px]"
          >
            <SignalBars />
            <WifiIcon />
            <Battery level={battery} charging={charging} />
          </button>
        </div>
      </div>

      {/* Home indicator */}
      <div
        className={`ios-device-chrome fixed inset-x-0 bottom-0 z-[10050] flex h-[var(--ios-home-h,20px)] items-center justify-center ${
          solid ? "ios-chrome-solid" : ""
        }`}
      >
        <span className="h-[5px] w-[140px] rounded-full bg-foreground/70" />
      </div>


      <Dialog open={timeOpen} onOpenChange={setTimeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Status bar</DialogTitle>
            <DialogDescription>Leave the time empty to follow this device's clock.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ios-time">Time (e.g. 9:41)</Label>
              <Input
                id="ios-time"
                value={draftTime}
                placeholder="Device time"
                onChange={(e) => setDraftTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ios-carrier">Carrier</Label>
              <Input id="ios-carrier" value={draftCarrier} onChange={(e) => setDraftCarrier(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDraftTime(""); }}>Use device time</Button>
            <Button onClick={saveTime}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={battOpen} onOpenChange={setBattOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Battery</DialogTitle>
            <DialogDescription>Set the level shown in the status bar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ios-batt">Level (%)</Label>
              <Input
                id="ios-batt"
                type="number"
                min={0}
                max={100}
                value={draftBatt}
                onChange={(e) => setDraftBatt(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={charging}
                onChange={(e) => setCharging(e.target.checked)}
                className="h-4 w-4 accent-[#34C759]"
              />
              Charging
            </label>
          </div>
          <DialogFooter>
            <Button onClick={saveBatt}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
