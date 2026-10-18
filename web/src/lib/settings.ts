import { COLOR_ORDER, type ColorName } from './colors';

export type PortLetter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export const PORT_LETTERS: PortLetter[] = ['A', 'B', 'C', 'D', 'E', 'F'];

/** L roda kiri · R roda kanan · X aksesori · C sensor warna · U sensor jarak · F sensor tekan · N tiada */
export type Role = 'L' | 'R' | 'X' | 'C' | 'U' | 'F' | 'N';
export type Detected = 'motor' | 'color' | 'ultra' | 'force' | 'none';
export type ForceAction = 'scan' | 'stop' | 'none';

export interface Settings {
  /** Maximum drive power, 10–100 %. */
  speed: number;
  /** Turning power as a share of speed, 20–100 %. */
  turn: number;
  /** Accessory motor power, 10–100 %. */
  accSpeed: number;
  roles: Record<PortLetter, Role>;
  inverts: Record<PortLetter, boolean>;
  /** Assign roles automatically from what the hub detects. */
  autoPorts: boolean;
  /** Stop before an obstacle closer than this (cm). 0 = off. */
  obstacleCm: number;
  /** What pressing the force sensor does. */
  forceAction: ForceAction;
  links: Record<ColorName, string>;
  sound: boolean;
  haptics: boolean;
}

const noRoles = (): Record<PortLetter, Role> => ({ A: 'N', B: 'N', C: 'N', D: 'N', E: 'N', F: 'N' });
const noInv = (): Record<PortLetter, boolean> => ({ A: false, B: false, C: false, D: false, E: false, F: false });

export const DEFAULT_SETTINGS: Settings = {
  speed: 50,
  turn: 60,
  accSpeed: 60,
  roles: { ...noRoles(), E: 'L', F: 'R', C: 'C' },
  inverts: { ...noInv(), E: true },
  autoPorts: true,
  obstacleCm: 15,
  forceAction: 'scan',
  links: { red: '', orange: '', yellow: '', green: '', azure: '', blue: '', violet: '', magenta: '', white: '', black: '' },
  sound: true,
  haptics: true,
};

/** First motor → left wheel (mirrored, so inverted), second → right, others → accessory; first colour sensor → sensor. */
export function autoAssign(found: Record<PortLetter, Detected>) {
  const roles = noRoles();
  const inverts = noInv();
  let motors = 0;
  let sensor = false;
  let ultra = false;
  let force = false;
  for (const p of PORT_LETTERS) {
    if (found[p] === 'motor') {
      roles[p] = motors === 0 ? 'L' : motors === 1 ? 'R' : 'X';
      if (motors === 0) inverts[p] = true;
      motors++;
    } else if (found[p] === 'color' && !sensor) {
      roles[p] = 'C';
      sensor = true;
    } else if (found[p] === 'ultra' && !ultra) {
      roles[p] = 'U';
      ultra = true;
    } else if (found[p] === 'force' && !force) {
      roles[p] = 'F';
      force = true;
    }
  }
  return { roles, inverts };
}

export function configLine(s: Pick<Settings, 'roles' | 'inverts'>) {
  return `M ${PORT_LETTERS.map((p) => s.roles[p]).join('')} ${PORT_LETTERS.map((p) => (s.inverts[p] ? '1' : '0')).join('')}`;
}

const KEY = 'spike-robot.settings.v2';
const num = (v: unknown, lo: number, hi: number, d: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d;
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);

export function loadSettings(): Settings {
  const d = DEFAULT_SETTINGS;
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Settings>;
    const roles = { ...d.roles };
    const inverts = { ...d.inverts };
    for (const port of PORT_LETTERS) {
      const r = p.roles?.[port];
      if (r && 'LRXCUFN'.includes(r)) roles[port] = r;
      inverts[port] = bool(p.inverts?.[port], inverts[port]);
    }
    const links = { ...d.links };
    for (const c of COLOR_ORDER) if (typeof p.links?.[c] === 'string') links[c] = p.links[c];
    return {
      speed: num(p.speed, 10, 100, d.speed),
      turn: num(p.turn, 20, 100, d.turn),
      accSpeed: num(p.accSpeed, 10, 100, d.accSpeed),
      roles,
      inverts,
      autoPorts: bool(p.autoPorts, d.autoPorts),
      obstacleCm: num(p.obstacleCm, 0, 50, d.obstacleCm),
      forceAction: p.forceAction === 'stop' || p.forceAction === 'none' ? p.forceAction : 'scan',
      links,
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
