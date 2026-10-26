import type { ColorName } from './colors';

/*
 * Sound + haptics with honest iOS fallbacks.
 * - Audio: iOS Safari only allows Web Audio after a user gesture. We create/resume the
 *   context on the first tap (unlockAudio). Until then, sounds are silently skipped.
 * - Haptics: navigator.vibrate is not available in iOS Safari. Where unsupported we
 *   return false and the UI shows a visual pulse instead.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export function audioUnlocked() {
  return !!ctx && ctx.state === 'running';
}

export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    /* audio unavailable */
  }
}

function tone(freq: number, start: number, dur: number, opts: { type?: OscillatorType; gain?: number; glideTo?: number } = {}) {
  if (!ctx || !master || ctx.state !== 'running') return;
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.glideTo) osc.frequency.exponentialRampToValueAtTime(opts.glideTo, t0 + dur);
  const peak = opts.gain ?? 0.25;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.03, dur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

import { COLOR_ORDER } from './colors';

// a rising pentatonic scale: each colour gets its own cheerful two-note chime
const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0];
export const sounds = {
  detect(color: ColorName) {
    const i = Math.max(0, COLOR_ORDER.indexOf(color));
    const a = SCALE[i];
    const b = SCALE[Math.min(SCALE.length - 1, i + 2)];
    tone(a, 0, 0.35, { gain: 0.22 });
    tone(b, 0.09, 0.5, { gain: 0.18 });
  },
  tap() {
    tone(1200, 0, 0.06, { gain: 0.08, type: 'triangle' });
  },
  snap() {
    tone(880, 0, 0.08, { gain: 0.14, type: 'triangle' });
    tone(1320, 0.04, 0.12, { gain: 0.1 });
  },
  powerUp() {
    tone(110, 0, 1.6, { gain: 0.12, type: 'sawtooth', glideTo: 440 });
    tone(220, 0.2, 1.4, { gain: 0.08, glideTo: 880 });
    tone(880, 1.55, 0.7, { gain: 0.16 });
  },
  beeps() {
    [0, 0.14, 0.28, 0.5].forEach((t, i) => tone([988, 1319, 1175, 1568][i], t, 0.12, { gain: 0.12, type: 'square' }));
  },
  success() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.09, 0.5, { gain: 0.14 }));
  },
  fanfare() {
    const seq: [number, number, number][] = [
      [392, 0, 0.25], [523.25, 0.22, 0.25], [659.25, 0.44, 0.25], [783.99, 0.66, 0.9],
      [659.25, 1.05, 0.2], [783.99, 1.25, 1.4],
    ];
    seq.forEach(([f, t, d]) => {
      tone(f, t, d, { gain: 0.16, type: 'triangle' });
      tone(f / 2, t, d, { gain: 0.08 });
    });
    [523.25, 659.25, 783.99, 1046.5].forEach((f) => tone(f, 1.25, 2.2, { gain: 0.07 }));
  },
};

export function hapticsSupported() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/** Returns true if a real vibration was triggered. */
export function haptic(pattern: number | number[] = 18): boolean {
  try {
    if (hapticsSupported()) return navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
  return false;
}
