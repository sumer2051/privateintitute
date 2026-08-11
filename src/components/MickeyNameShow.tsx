import { useEffect, useMemo, useRef, useState } from "react";

type Pose = "bow" | "throw" | "salute";

const SKIN = "hsl(28 60% 88%)";
const INK = "hsl(0 0% 10%)";
const GLOVE = "hsl(0 0% 100%)";
const SHORTS = "hsl(0 72% 46%)";
const SHOE = "hsl(45 95% 55%)";

/** Full-body Mickey: ears, head, torso, red shorts, gloved hands, yellow shoes. */
const Mickey = ({ pose }: { pose: Pose }) => (
  <span
    className="relative inline-block align-bottom"
    style={{
      width: "1.35em",
      height: "2em",
      transformOrigin: "bottom center",
      transition: "transform 500ms cubic-bezier(0.34,1.56,0.64,1)",
      transform:
        pose === "bow"
          ? "rotate(-16deg) translateY(1px)"
          : pose === "salute"
          ? "translateY(-2px) scale(1.06)"
          : "none",
    }}
    aria-hidden="true"
  >
    <svg viewBox="0 0 100 150" className="h-full w-full drop-shadow-sm">
      {/* legs + shoes */}
      <path d="M40 108 L36 130" stroke={INK} strokeWidth="9" strokeLinecap="round" />
      <path d="M60 108 L64 130" stroke={INK} strokeWidth="9" strokeLinecap="round" />
      <ellipse cx="31" cy="135" rx="13" ry="8" fill={SHOE} stroke={INK} strokeWidth="2" />
      <ellipse cx="69" cy="135" rx="13" ry="8" fill={SHOE} stroke={INK} strokeWidth="2" />
      {/* shorts */}
      <path d="M32 88 Q50 82 68 88 L70 110 Q50 104 30 110 Z" fill={SHORTS} stroke={INK} strokeWidth="2" />
      <circle cx="40" cy="97" r="3.2" fill={GLOVE} />
      <circle cx="60" cy="97" r="3.2" fill={GLOVE} />
      {/* torso */}
      <path d="M36 62 Q50 56 64 62 L68 90 Q50 84 32 90 Z" fill={INK} />
      {/* arms */}
      {pose === "salute" ? (
        <>
          <path d="M64 68 Q80 60 78 44" stroke={INK} strokeWidth="7" fill="none" strokeLinecap="round" />
          <circle cx="78" cy="40" r="8" fill={GLOVE} stroke={INK} strokeWidth="2" />
          <path d="M36 68 Q24 78 26 92" stroke={INK} strokeWidth="7" fill="none" strokeLinecap="round" />
          <circle cx="26" cy="96" r="7.5" fill={GLOVE} stroke={INK} strokeWidth="2" />
        </>
      ) : pose === "throw" ? (
        <>
          <path d="M64 68 Q84 66 90 78" stroke={INK} strokeWidth="7" fill="none" strokeLinecap="round" />
          <circle cx="92" cy="82" r="7.5" fill={GLOVE} stroke={INK} strokeWidth="2" />
          <path d="M36 68 Q22 74 24 88" stroke={INK} strokeWidth="7" fill="none" strokeLinecap="round" />
          <circle cx="24" cy="92" r="7.5" fill={GLOVE} stroke={INK} strokeWidth="2" />
        </>
      ) : (
        <>
          {/* bow: one hand held in front */}
          <path d="M64 68 Q60 82 50 86" stroke={INK} strokeWidth="7" fill="none" strokeLinecap="round" />
          <circle cx="46" cy="88" r="8" fill={GLOVE} stroke={INK} strokeWidth="2" />
          <path d="M36 68 Q22 74 22 86" stroke={INK} strokeWidth="7" fill="none" strokeLinecap="round" />
          <circle cx="22" cy="90" r="7" fill={GLOVE} stroke={INK} strokeWidth="2" />
        </>
      )}
      {/* ears */}
      <circle cx="24" cy="14" r="12" fill={INK} />
      <circle cx="76" cy="14" r="12" fill={INK} />
      {/* head */}
      <circle cx="50" cy="36" r="23" fill={INK} />
      <ellipse cx="50" cy="44" rx="15" ry="11" fill={SKIN} />
      {/* eyes */}
      <ellipse cx="43" cy="30" rx="3.6" ry="5.6" fill={GLOVE} />
      <ellipse cx="57" cy="30" rx="3.6" ry="5.6" fill={GLOVE} />
      <ellipse cx="43" cy="31" rx="1.8" ry="3.2" fill={INK} />
      <ellipse cx="57" cy="31" rx="1.8" ry="3.2" fill={INK} />
      {/* nose */}
      <ellipse cx="50" cy="40" rx="4.6" ry="3.8" fill={INK} />
      {pose === "salute" ? (
        <>
          <path d="M40 46 Q50 58 60 46 Z" fill={INK} />
          <path d="M42 47 Q50 52 58 47 Z" fill={GLOVE} />
        </>
      ) : (
        <path d="M41 46 Q50 54 59 46" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      )}
    </svg>
  </span>
);

const LittleMouse = () => (
  <svg viewBox="0 0 100 130" className="h-full w-full" aria-hidden="true">
    <path d="M42 92 L38 112" stroke={INK} strokeWidth="8" strokeLinecap="round" />
    <path d="M58 92 L62 112" stroke={INK} strokeWidth="8" strokeLinecap="round" />
    <ellipse cx="34" cy="116" rx="11" ry="7" fill={SHOE} stroke={INK} strokeWidth="2" />
    <ellipse cx="66" cy="116" rx="11" ry="7" fill={SHOE} stroke={INK} strokeWidth="2" />
    <path d="M34 74 Q50 68 66 74 L68 94 Q50 88 32 94 Z" fill={SHORTS} stroke={INK} strokeWidth="2" />
    <path d="M36 52 Q50 46 64 52 L68 76 Q50 70 32 76 Z" fill={INK} />
    <path d="M64 58 Q80 56 84 66" stroke={INK} strokeWidth="6" fill="none" strokeLinecap="round" />
    <circle cx="86" cy="70" r="6.5" fill={GLOVE} stroke={INK} strokeWidth="2" />
    <path d="M36 58 Q22 62 22 74" stroke={INK} strokeWidth="6" fill="none" strokeLinecap="round" />
    <circle cx="22" cy="78" r="6.5" fill={GLOVE} stroke={INK} strokeWidth="2" />
    <circle cx="26" cy="14" r="11" fill={INK} />
    <circle cx="74" cy="14" r="11" fill={INK} />
    <circle cx="50" cy="30" r="19" fill={INK} />
    <ellipse cx="50" cy="37" rx="12" ry="9" fill={SKIN} />
    <ellipse cx="44" cy="25" rx="3" ry="4.6" fill={GLOVE} />
    <ellipse cx="56" cy="25" rx="3" ry="4.6" fill={GLOVE} />
    <ellipse cx="50" cy="34" rx="4" ry="3.2" fill={INK} />
  </svg>
);

/**
 * Mickey-only cameo: no letter animation, the name stays exactly as rendered.
 * Mickey walks in, bows, throws the little mouse across, salutes, and leaves.
 */
export const MickeyCameo = ({ className = "", heightClass = "h-8" }: { className?: string; heightClass?: string }) => {
  const [phase, setPhase] = useState<"idle" | "bow" | "throw" | "salute">("idle");
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
    const run = () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
      setPhase("bow");
      later(() => setPhase("throw"), BOW_MS);
      later(() => setPhase("salute"), BOW_MS + THROW_MS);
      later(() => setPhase("idle"), BOW_MS + THROW_MS + SALUTE_MS);
    };
    const onDemand = () => run();
    window.addEventListener(MICKEY_SHOW_EVENT, onDemand);
    const interval = window.setInterval(run, CYCLE_MS);
    return () => {
      window.removeEventListener(MICKEY_SHOW_EVENT, onDemand);
      window.clearInterval(interval);
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
  }, []);

  return (
    <span
      className={`pointer-events-none relative inline-flex items-end ${heightClass} ${className}`}
      style={{
        width: phase === "idle" ? 0 : undefined,
        opacity: phase === "idle" ? 0 : 1,
        transition: "opacity 300ms ease",
      }}
      aria-hidden="true"
    >
      {phase !== "idle" && (
        <span className={`${heightClass} inline-flex items-end text-secondary`}>
          <Mickey pose={phase} />
        </span>
      )}
      {phase === "throw" && (
        <span
          className={`absolute bottom-0 left-full ${heightClass} aspect-[100/130] text-secondary`}
          style={{ animation: `mouse-dash ${THROW_MS}ms linear forwards` }}
        >
          <LittleMouse />
        </span>
      )}
    </span>
  );
};


const LETTER_MS = 260;
const BOW_MS = 2600;
const THROW_MS = 5200;
const SALUTE_MS = 3000;
const CYCLE_MS = 30000;

export const MICKEY_SHOW_EVENT = "boa:mickey-show";
/** Pending flag so a trigger fired before mount (login/passcode) still plays. */
const PENDING_KEY = "boa:mickey-pending";
export const consumeMickeyPending = () => {
  if (typeof sessionStorage === "undefined") return false;
  const p = sessionStorage.getItem(PENDING_KEY);
  if (p) sessionStorage.removeItem(PENDING_KEY);
  return !!p;
};
/** Replay the Mickey name reveal everywhere it is mounted (e.g. after a passcode unlock). */
export const triggerMickeyShow = () => {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PENDING_KEY, "1");
  } catch {}
  window.dispatchEvent(new Event(MICKEY_SHOW_EVENT));
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

type Segment = { text: string; className?: string };

/**
 * Bank name in the header: letters dissolve tiny from the last one back to the
 * first, the first letter becomes a bowing Mickey, he throws a little mouse that
 * flies across re-revealing every letter, then Mickey smiles + salutes and
 * turns back into the letter.
 */
export const MickeyBankName = ({
  segments,
  className = "",
  sizeClass = "text-sm md:text-xl",
}: {
  segments: Segment[];
  className?: string;
  sizeClass?: string;
}) => {
  const chars = useMemo(
    () =>
      segments.flatMap((s) =>
        s.text.split("").map((c) => ({ c, className: s.className ?? "" })),
      ),
    [segments],
  );

  const [hidden, setHidden] = useState(0); // hidden count from the end
  const [phase, setPhase] = useState<"idle" | "vanish" | "bow" | "throw" | "salute">("idle");
  const timers = useRef<number[]>([]);
  const runRef = useRef<() => void>(() => {});

  useEffect(() => {
    const n = chars.length;
    if (!n) return;
    const clear = () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
    const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

    const run = () => {
      clear();
      setPhase("vanish");
      // dissolve from the last letter back towards the first (keep letter 0)
      for (let i = 1; i <= n - 1; i++) later(() => setHidden(i), i * LETTER_MS);
      const vanishEnd = (n - 1) * LETTER_MS;

      later(() => setPhase("bow"), vanishEnd);
      later(() => setPhase("throw"), vanishEnd + BOW_MS);

      // the little mouse flies forward, revealing letters as it passes
      const step = THROW_MS / Math.max(1, n - 1);
      for (let i = 1; i <= n - 1; i++) {
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
    // login / passcode may have triggered before this mounted
    if (consumeMickeyPending()) later(run, 300);
    const interval = window.setInterval(run, CYCLE_MS);

    return () => {
      window.removeEventListener(MICKEY_SHOW_EVENT, onDemand);
      window.clearInterval(interval);
      clear();
    };
  }, [chars]);

  const showMickey = phase === "bow" || phase === "throw" || phase === "salute";

  return (
    <span className={`relative inline-flex flex-nowrap items-end leading-none ${className}`}>
      {chars.map((ch, i) => {
        const isHidden = i >= chars.length - hidden;
        if (i === 0 && showMickey) {
          return (
            <span key="mickey-slot" className={`inline-block ${sizeClass}`}>
              <Mickey pose={phase === "salute" ? "salute" : phase === "bow" ? "bow" : "throw"} />
            </span>
          );
        }
        return (
          <span
            key={`${ch.c}-${i}`}
            className={`font-display font-bold ${ch.className || "text-secondary"} ${sizeClass}`}
            style={{
              display: "inline-block",
              opacity: isHidden ? 0 : 1,
              transform: isHidden ? "scale(0.05)" : "scale(1)",
              filter: isHidden ? "blur(2px)" : "none",
              transformOrigin: "bottom center",
              transition: "opacity 420ms ease, transform 420ms ease, filter 420ms ease",
            }}
          >
            {ch.c === " " ? "\u00A0" : ch.c}
          </span>
        );
      })}

      {phase === "throw" && (
        <span
          className={`pointer-events-none absolute bottom-0 left-[1.1em] h-[1.4em] aspect-[100/130] ${sizeClass}`}
          style={{
            ["--fly-x" as string]: `${Math.max(4, chars.length * 0.5)}em`,
            animation: `mouse-fly ${THROW_MS}ms linear forwards`,
          }}
        >
          <LittleMouse />
        </span>
      )}
    </span>
  );
};
