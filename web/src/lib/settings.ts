import { COLOR_ORDER, type ColorName } from './colors';

export type PortLetter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export const PORT_LETTERS: PortLetter[] = ['A', 'B', 'C', 'D', 'E', 'F'];

/** L roda/kaki kiri · R roda/kaki kanan · S stereng · X aksesori/tangan · C sensor warna · U sensor jarak · F sensor tekan · N tiada */
export type Role = 'L' | 'R' | 'S' | 'X' | 'C' | 'U' | 'F' | 'N';
export const MOTOR_ROLES: Role[] = ['L', 'R', 'S', 'X'];
/** tank = 2 roda (kiri/kanan) · car = motor tolak + motor stereng · humanoid = 2 kaki + tangan */
export type RobotType = 'tank' | 'car' | 'humanoid';

export const ROBOT_TYPES: { id: RobotType; emoji: string; name: string; hint: string }[] = [
  { id: 'tank', emoji: '🚙', name: 'Kereta 2 roda', hint: 'Motor kiri + motor kanan' },
  { id: 'car', emoji: '🏎️', name: 'Kereta stereng', hint: 'Motor tolak + motor stereng' },
  { id: 'humanoid', emoji: '🤖', name: 'Humanoid', hint: '2 motor kaki + motor tangan' },
];

/** What each role is called for this kind of robot. */
export function roleName(role: Role, type: RobotType): string {
  const names: Record<RobotType, Partial<Record<Role, string>>> = {
    tank: { L: 'Roda kiri', R: 'Roda kanan', X: 'Lengan' },
    car: { L: 'Motor tolak', R: 'Motor tolak 2', S: 'Stereng', X: 'Lengan' },
    humanoid: { L: 'Kaki kiri', R: 'Kaki kanan', X: 'Tangan' },
  };
  const common: Record<Role, string> = { L: 'Kiri', R: 'Kanan', S: 'Stereng', X: 'Aksesori', C: 'Sensor warna', U: 'Sensor jarak', F: 'Sensor tekan', N: 'Tiada' };
  return names[type][role] ?? common[role];
}

/** Motor roles offered for this kind of robot. */
export function motorRolesFor(type: RobotType): Role[] {
  return type === 'car' ? ['L', 'S', 'X'] : ['L', 'R', 'X'];
}

/** Rough motor size from the LEGO device ID: 1 small, 2 medium, 3 large. */
export function motorSize(id: string | undefined): number {
  const n = Number(id);
  if (n === 65) return 1; // SPIKE small angular
  if (n === 48 || n === 75 || n === 38) return 2; // SPIKE medium angular, Technic medium, BOOST
  if (n === 49 || n === 46 || n === 47 || n === 76) return 3; // SPIKE large, Technic L/XL
  return 2;
}
export type Detected = 'motor' | 'color' | 'ultra' | 'force' | 'none';
export type ForceAction = 'scan' | 'stop' | 'none';

export interface Settings {
  /** Maximum drive power, 10–100 %. */
  speed: number;
  /** Turning power as a share of speed, 20–100 %. */
  turn: number;
  /** Accessory motor power, 10–100 %. */
  accSpeed: number;
  /** What kind of robot this is — decides how the sticks drive the motors. */
  robotType: RobotType;
  /** Car: maximum steering angle in degrees. */
  steerDeg: number;
  roles: Record<PortLetter, Role>;
  inverts: Record<PortLetter, boolean>;
  /** Assign roles automatically from what the hub detects. */
  autoPorts: boolean;
  /** Stop before an obstacle closer than this (cm). 0 = off. */
  obstacleCm: number;
  /** What pressing the force sensor does. */
  forceAction: ForceAction;
  /** Where colour links open: inside the app (robot stays connected) or another window. */
  linkMode: 'app' | 'window';
  /** Close the in-app link when a video ends or a form is sent. */
  autoClose: boolean;
  links: Record<ColorName, string>;
  /** Colours taught on the real map: hue (0-359), saturation and value (0-100). */
  calib: Partial<Record<ColorName, [number, number, number]>>;
  sound: boolean;
  haptics: boolean;
}

const noRoles = (): Record<PortLetter, Role> => ({ A: 'N', B: 'N', C: 'N', D: 'N', E: 'N', F: 'N' });
const noInv = (): Record<PortLetter, boolean> => ({ A: false, B: false, C: false, D: false, E: false, F: false });

export const DEFAULT_SETTINGS: Settings = {
  speed: 50,
  turn: 60,
  accSpeed: 60,
  robotType: 'tank',
  steerDeg: 35,
  roles: { ...noRoles(), E: 'L', F: 'R', C: 'C' },
  inverts: { ...noInv(), E: true },
  autoPorts: true,
  obstacleCm: 15,
  forceAction: 'scan',
  linkMode: 'app',
  autoClose: true,
  links: { red: '', orange: '', yellow: '', green: '', azure: '', blue: '', violet: '', magenta: '', white: '', black: '' },
  calib: {},
  sound: true,
  haptics: true,
};

/**
 * Give every detected device a job.
 * Motors: a pair of motors of the same size are the wheels/legs (the odd one out is the arm),
 * otherwise port order. Car: the bigger motor pushes, the smaller one steers.
 */
export function autoAssign(found: Record<PortLetter, Detected>, ids: Partial<Record<PortLetter, string>> = {}, type: RobotType = 'tank') {
  const roles = noRoles();
  const inverts = noInv();
  const motors = PORT_LETTERS.filter((p) => found[p] === 'motor');

  if (type === 'car') {
    let drive = motors[0];
    let steer = motors[1];
    if (drive && steer && motorSize(ids[steer]) > motorSize(ids[drive])) [drive, steer] = [steer, drive];
    for (const p of motors) roles[p] = p === drive ? 'L' : p === steer ? 'S' : 'X';
  } else {
    // find two motors of the same size while another size exists (e.g. 2 small legs + 1 large arm)
    let pair = motors.slice(0, 2);
    if (motors.length >= 3) {
      const bySize = new Map<number, PortLetter[]>();
      for (const p of motors) bySize.set(motorSize(ids[p]), [...(bySize.get(motorSize(ids[p])) ?? []), p]);
      const twos = [...bySize.entries()].filter(([, ps]) => ps.length === 2);
      if (twos.length === 1 && bySize.size > 1) pair = twos[0][1];
      else if (type === 'humanoid') {
        const smallest = [...bySize.entries()].sort((a, b) => a[0] - b[0])[0][1];
        if (smallest.length >= 2) pair = smallest.slice(0, 2);
      }
    }
    for (const p of motors) roles[p] = p === pair[0] ? 'L' : p === pair[1] ? 'R' : 'X';
    if (pair[0]) inverts[pair[0]] = true; // left side is mirrored
  }

  let sensor = false;
  let ultra = false;
  let force = false;
  for (const p of PORT_LETTERS) {
    if (found[p] === 'color' && !sensor) {
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
      if (r && 'LRSXCUFN'.includes(r)) roles[port] = r;
      inverts[port] = bool(p.inverts?.[port], inverts[port]);
    }
    const links = { ...d.links };
    for (const c of COLOR_ORDER) if (typeof p.links?.[c] === 'string') links[c] = p.links[c];
    return {
      speed: num(p.speed, 10, 100, d.speed),
      turn: num(p.turn, 20, 100, d.turn),
      accSpeed: num(p.accSpeed, 10, 100, d.accSpeed),
      robotType: p.robotType === 'car' || p.robotType === 'humanoid' ? p.robotType : 'tank',
      steerDeg: num(p.steerDeg, 10, 90, d.steerDeg),
      roles,
      inverts,
      autoPorts: bool(p.autoPorts, d.autoPorts),
      obstacleCm: num(p.obstacleCm, 0, 50, d.obstacleCm),
      forceAction: p.forceAction === 'stop' || p.forceAction === 'none' ? p.forceAction : 'scan',
      linkMode: p.linkMode === 'window' ? 'window' : 'app',
      autoClose: bool(p.autoClose, d.autoClose),
      links,
      calib: readCalib(p.calib),
      sound: bool(p.sound, d.sound),
      haptics: bool(p.haptics, d.haptics),
    };
  } catch {
    return structuredClone(d);
  }
}

function readCalib(v: unknown): Settings['calib'] {
  const out: Settings['calib'] = {};
  if (!v || typeof v !== 'object') return out;
  for (const c of COLOR_ORDER) {
    const x = (v as Record<string, unknown>)[c];
    if (Array.isArray(x) && x.length === 3 && x.every((n) => typeof n === 'number' && Number.isFinite(n))) {
      out[c] = [Math.round(x[0]) % 360, Math.round(x[1]), Math.round(x[2])];
    }
  }
  return out;
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
