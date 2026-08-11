import { useEffect, useMemo, useRef, useState } from "react";

type Pose = "bow" | "throw" | "salute";

const Mickey = ({ pose }: { pose: Pose }) => (
  <span
    className="relative inline-block align-bottom"
    style={{
      width: "1.5em",
      height: "1.5em",
      transformOrigin: "bottom center",
      transition: "transform 500ms cubic-bezier(0.34,1.56,0.64,1)",
      transform:
        pose === "bow"
          ? "rotate(-18deg) translateY(2px)"
          : pose === "salute"
          ? "rotate(0deg) translateY(-2px) scale(1.06)"
          : "rotate(0deg)",
    }}
    aria-hidden="true"
  >
    <svg viewBox="0 0 100 100" className="h-full w-full drop-shadow-sm">
      {/* ears */}
      <circle cx="22" cy="24" r="17" fill="currentColor" />
      <circle cx="78" cy="24" r="17" fill="currentColor" />
      {/* head */}
      <circle cx="50" cy="56" r="30" fill="currentColor" />
      {/* face */}
      <ellipse cx="50" cy="66" rx="20" ry="15" fill="hsl(28 60% 88%)" />
      {/* eyes */}
      <ellipse cx="42" cy="48" rx="4.5" ry="7" fill="hsl(0 0% 100%)" />
      <ellipse cx="58" cy="48" rx="4.5" ry="7" fill="hsl(0 0% 100%)" />
      <ellipse cx="42" cy="49" rx="2.2" ry="4" fill="hsl(0 0% 8%)" />
      <ellipse cx="58" cy="49" rx="2.2" ry="4" fill="hsl(0 0% 8%)" />
      {/* nose */}
      <ellipse cx="50" cy="60" rx="6" ry="5" fill="hsl(0 0% 8%)" />
      {pose === "salute" ? (
        <>
          {/* big smile with teeth */}
          <path d="M36 68 Q50 84 64 68 Z" fill="hsl(0 0% 12%)" />
          <path d="M38.5 69 Q50 76 61.5 69 Z" fill="hsl(0 0% 100%)" />
          {/* saluting hand */}
          <circle cx="74" cy="34" r="8" fill="hsl(0 0% 100%)" stroke="hsl(0 0% 12%)" strokeWidth="2" />
        </>
      ) : (
        <>
          {/* gentle smile */}
          <path d="M38 68 Q50 78 62 68" fill="none" stroke="hsl(0 0% 12%)" strokeWidth="3" strokeLinecap="round" />
          {/* one hand in front (bow / greeting) */}
          <circle cx="50" cy="86" r="9" fill="hsl(0 0% 100%)" stroke="hsl(0 0% 12%)" strokeWidth="2" />
        </>
      )}
    </svg>
  </span>
);

const LittleMouse = () => (
  <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
    <circle cx="24" cy="26" r="16" fill="currentColor" />
    <circle cx="76" cy="26" r="16" fill="currentColor" />
    <circle cx="50" cy="58" r="28" fill="currentColor" />
    <ellipse cx="50" cy="66" rx="18" ry="13" fill="hsl(28 60% 88%)" />
    <ellipse cx="50" cy="60" rx="5.5" ry="4.5" fill="hsl(0 0% 8%)" />
    <ellipse cx="42" cy="49" rx="3.5" ry="5.5" fill="hsl(0 0% 100%)" />
    <ellipse cx="58" cy="49" rx="3.5" ry="5.5" fill="hsl(0 0% 100%)" />
  </svg>
);

const LETTER_MS = 90;
const BOW_MS = 1300;
const THROW_MS = 2200;
const SALUTE_MS = 1500;
const CYCLE_MS = 30000;

export const MICKEY_SHOW_EVENT = "boa:mickey-show";
/** Replay the Mickey name reveal everywhere it is mounted (e.g. after a passcode unlock). */
export const triggerMickeyShow = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(MICKEY_SHOW_EVENT));
};

export const MickeyNameShow = ({
  name,
  className = "",
  sizeClass = "text-xl md:text-4xl",
}: {
  name: string;
  className?: string;
  sizeClass?: string;
}) => {
  const letters = useMemo(() => name.split(""), [name]);
  const [hidden, setHidden] = useState<number>(0); // count hidden from the end
  const [phase, setPhase] = useState<"idle" | "vanish" | "bow" | "throw" | "salute">("idle");
  const timers = useRef<number[]>([]);
  const runRef = useRef<() => void>(() => {});

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  useEffect(() => {
    if (!letters.length) return;
    const run = () => {
      clearTimers();
      const n = letters.length;
      setPhase("vanish");
      // vanish gradually from the last letter back to the first
      for (let i = 1; i <= n; i++) later(() => setHidden(i), i * LETTER_MS);
      const vanishEnd = n * LETTER_MS;

      later(() => setPhase("bow"), vanishEnd);
      later(() => setPhase("throw"), vanishEnd + BOW_MS);

      // the little mouse runs forward, revealing the name as it goes
      const step = THROW_MS / Math.max(1, n - 1);
      for (let i = 1; i < n; i++) {
        later(() => setHidden(n - 1 - i), vanishEnd + BOW_MS + i * step);
      }

      later(() => setPhase("salute"), vanishEnd + BOW_MS + THROW_MS);
      later(() => {
        setPhase("idle");
        setHidden(0);
      }, vanishEnd + BOW_MS + THROW_MS + SALUTE_MS);
    };
    runRef.current = run;

    const onDemand = () => runRef.current();
    window.addEventListener(MICKEY_SHOW_EVENT, onDemand);
    const interval = window.setInterval(run, CYCLE_MS);
    return () => {
      window.removeEventListener(MICKEY_SHOW_EVENT, onDemand);
      window.clearInterval(interval);
      clearTimers();
    };
  }, [letters]);

  const showMickey = phase === "bow" || phase === "throw" || phase === "salute";

  return (
    <div className={`relative flex flex-nowrap items-end gap-0 leading-none ${className}`}>
      {letters.map((char, i) => {
        const isFirst = i === 0;
        const isHidden = i >= letters.length - hidden;
        if (isFirst && showMickey) {
          return (
            <span key="mickey-slot" className={`inline-block text-secondary ${sizeClass}`}>
              <Mickey pose={phase === "salute" ? "salute" : phase === "bow" ? "bow" : "throw"} />
            </span>
          );
        }
        return (
          <span
            key={`${char}-${i}`}
            className={`bounce-letter font-display font-bold text-secondary ${sizeClass}`}
            style={{
              animationDelay: `${i * 0.07}s`,
              opacity: isHidden ? 0 : 1,
              filter: isHidden ? "blur(4px)" : "none",
              transform: isHidden ? "translateY(6px) scale(0.9)" : undefined,
              transition: "opacity 260ms ease, filter 260ms ease, transform 260ms ease",
            }}
          >
            {char === " " ? "\u00A0" : char}
          </span>
        );
      })}

      {phase === "throw" && (
        <span
          className={`pointer-events-none absolute bottom-0 left-0 h-[1em] w-[1em] text-secondary ${sizeClass}`}
          style={{ animation: `mouse-dash ${THROW_MS}ms linear forwards` }}
        >
          <LittleMouse />
        </span>
      )}

    </div>
  );
};

export default MickeyNameShow;
