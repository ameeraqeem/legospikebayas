import { COLOR_ORDER, type ColorName } from './colors';

export type Appearance = 'system' | 'light' | 'dark';
export type PortLetter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export const PORT_LETTERS: PortLetter[] = ['A', 'B', 'C', 'D', 'E', 'F'];

export interface ColorLink {
  url: string;
  enabled: boolean;
}

export interface Settings {
  appearance: Appearance;
  /** Drive power, 10–100 %. */
  speed: number;
  /** Spin speed as a share of drive speed, 20–100 %. */
  turn: number;
  leftPort: PortLetter;
  rightPort: PortLetter;
  invertLeft: boolean;
  invertRight: boolean;
  colorPort: PortLetter;
  links: Record<ColorName, ColorLink>;
  /** Ignore the same colour opening its link again within this many seconds. */
  linkCooldownSec: number;
  stopOnColor: boolean;
  sound: boolean;
  haptics: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  appearance: 'system',
  speed: 50,
  turn: 60,
  leftPort: 'E',
  rightPort: 'F',
  invertLeft: true,
  invertRight: false,
  colorPort: 'C',
  links: {
    red: { url: '', enabled: true },
    blue: { url: '', enabled: true },
    green: { url: '', enabled: true },
    yellow: { url: '', enabled: true },
  },
  linkCooldownSec: 3,
  stopOnColor: false,
  sound: true,
  haptics: true,
};

const KEY = 'spike-robot.settings.v1';

const num = (v: unknown, lo: number, hi: number, d: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d;
const port = (v: unknown, d: PortLetter): PortLetter => (PORT_LETTERS.includes(v as PortLetter) ? (v as PortLetter) : d);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);

export function loadSettings(): Settings {
  const d = DEFAULT_SETTINGS;
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Settings>;
    const links = {} as Record<ColorName, ColorLink>;
    for (const c of COLOR_ORDER) {
      const l = p.links?.[c];
      links[c] = { url: typeof l?.url === 'string' ? l.url : '', enabled: bool(l?.enabled, true) };
    }
    return {
      appearance: p.appearance === 'light' || p.appearance === 'dark' ? p.appearance : 'system',
      speed: num(p.speed, 10, 100, d.speed),
      turn: num(p.turn, 20, 100, d.turn),
      leftPort: port(p.leftPort, d.leftPort),
      rightPort: port(p.rightPort, d.rightPort),
      invertLeft: bool(p.invertLeft, d.invertLeft),
      invertRight: bool(p.invertRight, d.invertRight),
      colorPort: port(p.colorPort, d.colorPort),
      links,
      linkCooldownSec: num(p.linkCooldownSec, 0, 60, d.linkCooldownSec),
      stopOnColor: bool(p.stopOnColor, d.stopOnColor),
      sound: bool(p.sound, d.sound),
      haptics: bool(p.haptics, d.haptics),
    };
  } catch {
    return structuredClone(d);
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode */
  }
}

/** Accepts "youtube.com/…" and adds https://. Returns null if not a valid http(s) URL. */
export function normalizeUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null;
    return u.toString();
  } catch {
    return null;
  }
}
