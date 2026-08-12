/**
 * Lightweight bank notification sounds, synthesized with the Web Audio API
 * (no asset downloads, works offline). Browsers require a user gesture before
 * audio can play, so `primeSounds()` is wired to the first interaction.
 */

let ctx: AudioContext | null = null;
let primed = false;

const STORAGE_KEY = "boa_sounds_enabled";

export function soundsEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundsEnabled(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    /* ignore */
  }
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Call on first user gesture so later programmatic sounds are allowed. */
export function primeSounds() {
  if (primed) return;
  primed = true;
  const c = getCtx();
  if (!c) return;
  // Silent tick to unlock the audio pipeline.
  const g = c.createGain();
  g.gain.value = 0.0001;
  const o = c.createOscillator();
  o.connect(g);
  g.connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.01);
}

type ToneOptions = {
  freq: number;
  start?: number;
  duration?: number;
  gain?: number;
  type?: OscillatorType;
  sweepTo?: number;
};

function tone(c: AudioContext, o: ToneOptions) {
  const t0 = c.currentTime + (o.start ?? 0);
  const dur = o.duration ?? 0.18;
  const peak = o.gain ?? 0.16;

  const osc = c.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.sweepTo) osc.frequency.exponentialRampToValueAtTime(o.sweepTo, t0 + dur);

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export type BankSound = "moneyIn" | "moneyOut" | "message" | "alert";

export function playSound(name: BankSound) {
  if (!soundsEnabled()) return;
  const c = getCtx();
  if (!c) return;

  switch (name) {
    // Warm rising "cha-ching" style chime for incoming money.
    case "moneyIn":
      tone(c, { freq: 784, duration: 0.16, gain: 0.16, type: "triangle" });
      tone(c, { freq: 1047, start: 0.1, duration: 0.22, gain: 0.16, type: "triangle" });
      tone(c, { freq: 1319, start: 0.2, duration: 0.34, gain: 0.13, type: "sine" });
      break;
    // Soft descending confirmation for money leaving the account.
    case "moneyOut":
      tone(c, { freq: 880, duration: 0.14, gain: 0.13, type: "triangle" });
      tone(c, { freq: 587, start: 0.11, duration: 0.26, gain: 0.12, type: "sine" });
      break;
    // Short double blip for new support/chat messages.
    case "message":
      tone(c, { freq: 1046, duration: 0.09, gain: 0.11, type: "sine" });
      tone(c, { freq: 1568, start: 0.09, duration: 0.14, gain: 0.09, type: "sine" });
      break;
    // Attention tone for alerts and failures.
    case "alert":
      tone(c, { freq: 520, duration: 0.2, gain: 0.14, type: "square", sweepTo: 300 });
      break;
  }

  try {
    if ("vibrate" in navigator) navigator.vibrate?.(name === "moneyIn" ? [12, 40, 18] : 12);
  } catch {
    /* ignore */
  }
}
