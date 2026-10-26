import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PybricksHub, errMsg, type HubInfo, type LinkState } from '../lib/pybricks';
import { autoAssign, configLine, loadSettings, normalizeUrl, PORT_LETTERS, saveSettings, type Detected, type PortLetter, type Settings } from '../lib/settings';
import { isColorName, type ColorName } from '../lib/colors';
import { linkWindowOpen, openLink } from '../lib/linkWindow';
import { haptic, sounds, unlockAudio } from '../lib/feedback';

export type Tab = 'robot' | 'control' | 'settings';
export type ProgramState = 'unknown' | 'checking' | 'starting' | 'ready' | 'missing' | 'stopped' | 'old';

export interface ScanResult {
  id: number;
  color: string; // red|blue|green|yellow|white|none|nosensor|timeout
  at: number;
  url: string | null;
  opened: boolean;
}

interface Store {
  tab: Tab;
  setTab: (t: Tab) => void;
  settings: Settings;
  update: (p: Partial<Settings>) => void;

  link: LinkState;
  linkError: string | null;
  info: HubInfo | null;
  program: ProgramState;
  /** Version reported by the hub program (null until known). */
  hubVersion: number | null;
  hubErrors: string[];
  detected: Record<PortLetter, Detected> | null;
  /** LEGO device ID per port as reported by hub v5+ (e.g. 48 = SPIKE medium motor). */
  deviceIds: Partial<Record<PortLetter, string>>;
  batteryMv: number | null;
  batteryLow: boolean;
  color: string | null;
  distanceMm: number | null;
  forcePressed: boolean;
  obstacleAt: number | null;

  connect: () => Promise<void>;
  reconnect: () => Promise<void>;
  disconnect: () => void;
  startProgram: () => Promise<void>;
  restartProgram: () => Promise<void>;
  rescanPorts: () => void;
  /** Spin one motor briefly so pupils can see which port it is. */
  testMotor: (p: PortLetter) => void;
  motorTest: { port: PortLetter; status: 'run' | 'ok' | 'fail' } | null;

  /** Joysticks: y = left stick (forward +), x = right stick (right +), both −1…1 */
  setStick: (axis: 'x' | 'y', v: number) => void;
  setAccessory: (dir: -1 | 0 | 1) => void;
  accessory: -1 | 0 | 1;
  motors: { left: number; right: number };

  scanning: boolean;
  scan: () => Promise<void>;
  result: ScanResult | null;
  history: ScanResult[];
  closeResult: () => void;
  openResultLink: () => void;
  /** Link shown inside the app. */
  viewer: { id: number; url: string; color: string } | null;
  /** Read the colour under the sensor and remember it as this colour. */
  teachColor: (c: ColorName) => Promise<'ok' | 'nosensor' | 'old' | 'fail'>;
  resetColors: () => void;
  openUrl: (url: string, color: string) => void;
  closeViewer: () => void;
}

const Ctx = createContext<Store | null>(null);

/** Oldest hub program the app can drive, and the one shipped with this app. */
export const MIN_HUB_VERSION = 3;
export const LATEST_HUB_VERSION = 8;
const DEAD = 0.12;

export function mix(y: number, x: number, speed: number, turnPct: number) {
  const dz = (v: number) => (Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD));
  const yy = dz(y);
  const xx = dz(x);
  const turn = (speed * turnPct) / 100;
  const c = (v: number) => Math.max(-100, Math.min(100, Math.round(v)));
  return { left: c(yy * speed + xx * turn), right: c(yy * speed - xx * turn) };
}

/** Car: both sticks are independent — left pushes, right steers (full lock regardless of speed). */
export function mixCar(y: number, x: number, speed: number) {
  const dz = (v: number) => (Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD));
  const c = (v: number) => Math.max(-100, Math.min(100, Math.round(v)));
  const f = c(dz(y) * speed);
  return { left: f, right: f, steer: c(dz(x) * 100) };
}

export function RobotProvider({ children }: { children: ReactNode }) {
  const [tab, setTabState] = useState<Tab>(() => {
    const h = location.hash.replace('#', '') as Tab;
    return ['robot', 'control', 'settings'].includes(h) ? h : 'robot';
  });
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [link, setLink] = useState<LinkState>('idle');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [info, setInfo] = useState<HubInfo | null>(null);
  const [program, setProgram] = useState<ProgramState>('unknown');
  const [hubVersion, setHubVersion] = useState<number | null>(null);
  const [hubErrors, setHubErrors] = useState<string[]>([]);
  const [detected, setDetected] = useState<Record<PortLetter, Detected> | null>(null);
  const [deviceIds, setDeviceIds] = useState<Partial<Record<PortLetter, string>>>({});
  const idBuf = useRef<Partial<Record<PortLetter, string>>>({});
  const [batteryMv, setBatteryMv] = useState<number | null>(null);
  const [batteryLow, setBatteryLow] = useState(false);
  const [color, setColor] = useState<string | null>(null);
  const [distanceMm, setDistanceMm] = useState<number | null>(null);
  const [forcePressed, setForcePressed] = useState(false);
  const [obstacleAt, setObstacleAt] = useState<number | null>(null);
  const [motorTest, setMotorTest] = useState<Store['motorTest']>(null);
  const forceRef = useRef(false);
  const scanRef = useRef<() => void>(() => undefined);
  const [stick, setStickState] = useState({ x: 0, y: 0 });
  const [accessory, setAccessoryState] = useState<-1 | 0 | 1>(0);
  const [motors, setMotors] = useState({ left: 0, right: 0 });
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<ScanResult[]>([]);

  const sRef = useRef(settings);
  sRef.current = settings;
  const programRef = useRef(program);
  programRef.current = program;
  const stickRef = useRef(stick);
  stickRef.current = stick;
  const readyWaiter = useRef<((ok: boolean) => void) | null>(null);
  const scanWaiter = useRef<((c: string) => void) | null>(null);
  const hsvWaiter = useRef<((parts: string[]) => void) | null>(null);
  const verRef = useRef<number | null>(null);
  const qBuf = useRef<Partial<Record<PortLetter, Detected>>>({});
  const scanId = useRef(0);
  const hubRef = useRef<PybricksHub | null>(null);

  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    window.history.replaceState(null, '', `#${t}`);
  }, []);

  const update = useCallback((p: Partial<Settings>) => {
    setSettings((s) => {
      const n = { ...s, ...p };
      saveSettings(n);
      sRef.current = n;
      return n;
    });
  }, []);

  useEffect(() => {
    const u = () => unlockAudio();
    addEventListener('pointerdown', u, { passive: true });
    return () => removeEventListener('pointerdown', u);
  }, []);

  const sendConfig = useCallback((s: Pick<Settings, 'roles' | 'inverts'> = sRef.current) => {
    setHubErrors([]);
    setDistanceMm(null);
    setForcePressed(false);
    if (sRef.current.robotType === 'car') void hubRef.current?.send(`G ${sRef.current.steerDeg}`).catch(() => undefined);
    void hubRef.current?.send(configLine(s)).catch(() => undefined);
    void hubRef.current?.send(`O ${sRef.current.obstacleCm * 10}`).catch(() => undefined);
    // colours taught on this map (hub program v8+)
    if ((verRef.current ?? 0) >= 8) {
      for (const [c, v] of Object.entries(sRef.current.calib)) {
        if (v) void hubRef.current?.send(`T ${c} ${v[0]} ${v[1]} ${v[2]}`).catch(() => undefined);
      }
    }
  }, []);

  const onPortsDetected = useCallback(
    (found: Record<PortLetter, Detected>, ids: Partial<Record<PortLetter, string>>) => {
      setDetected(found);
      if (sRef.current.autoPorts) {
        const a = autoAssign(found, ids, sRef.current.robotType);
        update(a);
        sendConfig(a);
      } else sendConfig();
    },
    [sendConfig, update],
  );

  const markReady = useCallback(() => {
    if (programRef.current !== 'ready') setProgram('ready');
    readyWaiter.current?.(true);
    readyWaiter.current = null;
  }, []);

  const onLine = useCallback(
    (line: string) => {
      const parts = line.split(' ');
      const cmd = parts[0];
      switch (cmd) {
        case 'SPIKECTL': {
          const v = Number(parts[1]);
          setHubVersion(Number.isFinite(v) ? v : 1);
          verRef.current = Number.isFinite(v) ? v : 1;
          if (v >= MIN_HUB_VERSION) markReady();
          else setProgram('old');
          break;
        }
        case 'P': {
          // v1 answered "P EFC" (not a number) — treat as version 1
          const v = /^\d+$/.test(parts[1] ?? '') ? Number(parts[1]) : 1;
          setHubVersion(v);
          verRef.current = v;
          if (v >= MIN_HUB_VERSION) {
            const wasReady = programRef.current === 'ready';
            markReady();
            if (!wasReady) void hubRef.current?.send('Q').catch(() => undefined); // already running: ask for ports
          } else setProgram('old');
          break;
        }
        case 'Q':
          if (parts[1] === 'end') {
            const f = {} as Record<PortLetter, Detected>;
            for (const p of PORT_LETTERS) f[p] = qBuf.current[p] ?? 'none';
            qBuf.current = {};
            const ids = idBuf.current;
            setDeviceIds(ids);
            idBuf.current = {};
            onPortsDetected(f, ids);
          } else if (PORT_LETTERS.includes(parts[1] as PortLetter)) {
            qBuf.current[parts[1] as PortLetter] = (['motor', 'color', 'ultra', 'force'] as const).find((k) => k === parts[2]) ?? 'none';
            if (parts[3] && parts[3] !== '-') idBuf.current[parts[1] as PortLetter] = parts[3];
          }
          break;
        case 'J':
          if (PORT_LETTERS.includes(parts[1] as PortLetter)) setMotorTest({ port: parts[1] as PortLetter, status: parts[2] === 'ok' ? 'ok' : 'fail' });
          break;
        case 'C':
          setColor(parts[1] ?? 'none');
          break;
        case 'U': {
          const mm = Number(parts[1]);
          if (Number.isFinite(mm)) setDistanceMm(mm);
          break;
        }
        case 'F': {
          const pressed = parts[1] === '1';
          setForcePressed(pressed);
          if (pressed && !forceRef.current) {
            const a = sRef.current.forceAction;
            if (a === 'scan') scanRef.current();
            else if (a === 'stop') {
              setStickState({ x: 0, y: 0 });
              setAccessoryState(0);
              void hubRef.current?.stop();
            }
          }
          forceRef.current = pressed;
          break;
        }
        case 'O':
          if (parts[1] === 'stop') {
            setObstacleAt(Date.now());
            if (sRef.current.haptics) haptic([30, 40, 30]);
          }
          break;
        case 'H':
          hsvWaiter.current?.(parts.slice(1));
          hsvWaiter.current = null;
          break;
        case 'K':
          scanWaiter.current?.(parts[1] ?? 'none');
          scanWaiter.current = null;
          break;
        case 'B': {
          const mv = Number(parts[1]);
          if (Number.isFinite(mv)) setBatteryMv(mv);
          break;
        }
        case 'E': {
          const msg = parts.slice(1).join(' ');
          setHubErrors((e) => (e.includes(msg) ? e : [...e, msg]).slice(-8));
          break;
        }
      }
    },
    [markReady, onPortsDetected],
  );
  const onLineRef = useRef(onLine);
  onLineRef.current = onLine;

  const resetControls = () => {
    setStickState({ x: 0, y: 0 });
    setAccessoryState(0);
    setMotors({ left: 0, right: 0 });
  };

  if (!hubRef.current) {
    hubRef.current = new PybricksHub({
      onState: (st, err) => {
        setLink(st);
        setLinkError(err ?? null);
        if (st !== 'connected') {
          resetControls();
          if (programRef.current === 'ready') setProgram('unknown');
        }
      },
      onInfo: setInfo,
      onStatus: ({ running, batteryLow }) => {
        setBatteryLow(batteryLow);
        if (!running && programRef.current === 'ready') {
          setProgram('stopped');
          resetControls();
        }
      },
      onLine: (l) => onLineRef.current(l),
    });
  }

  const waitReady = (ms: number) =>
    new Promise<boolean>((resolve) => {
      const t = setTimeout(() => {
        readyWaiter.current = null;
        resolve(false);
      }, ms);
      readyWaiter.current = (ok) => {
        clearTimeout(t);
        resolve(ok);
      };
    });

  const ensureProgram = useCallback(async () => {
    const hub = hubRef.current!;
    setProgram('checking');
    await new Promise((r) => setTimeout(r, 150));
    void hub.send('P').catch(() => undefined);
    if (await waitReady(1200)) return;
    if (programRef.current === 'old') return;
    setProgram('starting');
    try {
      await hub.startProgram();
    } catch {
      /* BUSY or no program */
    }
    if (await waitReady(6000)) return;
    if ((programRef.current as ProgramState) !== 'old') setProgram('missing');
  }, []);

  const connect = useCallback(async () => {
    setLinkError(null);
    try {
      await hubRef.current!.requestAndConnect();
      await ensureProgram();
    } catch (e) {
      setLinkError(errMsg(e));
      setLink((s) => (s === 'connected' ? s : e instanceof DOMException && e.name === 'NotFoundError' ? 'idle' : 'error'));
    }
  }, [ensureProgram]);

  const reconnect = useCallback(async () => {
    try {
      await hubRef.current!.reconnect();
      await ensureProgram();
    } catch (e) {
      setLinkError(errMsg(e));
    }
  }, [ensureProgram]);

  const prevLink = useRef(link);
  useEffect(() => {
    if (prevLink.current === 'reconnecting' && link === 'connected') void ensureProgram();
    prevLink.current = link;
  }, [link, ensureProgram]);

  const disconnect = useCallback(() => {
    void hubRef.current?.stop();
    setTimeout(() => hubRef.current?.disconnect(), 120);
    setProgram('unknown');
    setDetected(null);
  }, []);

  const startProgram = useCallback(async () => {
    setProgram('starting');
    try {
      await hubRef.current!.startProgram();
    } catch {
      /* reported via timeout */
    }
    if (!(await waitReady(6000)) && programRef.current !== 'old') setProgram('missing');
  }, []);

  const restartProgram = useCallback(async () => {
    setProgram('starting');
    try {
      await hubRef.current!.stopProgram();
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 500));
    await startProgram();
  }, [startProgram]);

  const rescanPorts = useCallback(() => {
    void hubRef.current?.send('Q').catch(() => undefined);
  }, []);

  // Obstacle distance changes → push to hub.
  useEffect(() => {
    if (programRef.current === 'ready') void hubRef.current?.send(`O ${settings.obstacleCm * 10}`).catch(() => undefined);
  }, [settings.obstacleCm]);

  // Manual role edits → push to hub.
  const rolesKey = configLine(settings);
  useEffect(() => {
    // wait until the teacher stops tapping, then send once
    const t = setTimeout(() => {
      if (programRef.current === 'ready') sendConfig();
    }, 400);
    return () => clearTimeout(t);
  }, [rolesKey, sendConfig]);

  const testMotor = useCallback((p: PortLetter) => {
    if (programRef.current !== 'ready') return;
    setMotorTest({ port: p, status: 'run' });
    void hubRef.current?.send(`J ${p}`).catch(() => setMotorTest({ port: p, status: 'fail' }));
  }, []);
  useEffect(() => {
    if (!motorTest || motorTest.status === 'run') return;
    const t = setTimeout(() => setMotorTest(null), 2500);
    return () => clearTimeout(t);
  }, [motorTest]);

  // Robot type changed → re-arrange the ports (when automatic) and send the steering angle.
  const detectedRef = useRef(detected);
  detectedRef.current = detected;
  const deviceIdsRef = useRef(deviceIds);
  deviceIdsRef.current = deviceIds;
  const firstType = useRef(true);
  useEffect(() => {
    if (firstType.current) {
      firstType.current = false;
      return;
    }
    const found = detectedRef.current;
    if (sRef.current.autoPorts && found) update(autoAssign(found, deviceIdsRef.current, settings.robotType));
    else if (programRef.current === 'ready') sendConfig();
  }, [settings.robotType, update, sendConfig]);
  useEffect(() => {
    if (programRef.current === 'ready' && settings.robotType === 'car') void hubRef.current?.send(`G ${settings.steerDeg}`).catch(() => undefined);
  }, [settings.steerDeg, settings.robotType]);

  // ---- driving ----
  const canDrive = link === 'connected' && program === 'ready';
  const setStick = useCallback((axis: 'x' | 'y', v: number) => {
    setStickState((s) => (Math.abs(s[axis] - v) < 0.02 && v !== 0 ? s : { ...s, [axis]: Math.max(-1, Math.min(1, v)) }));
  }, []);
  const setAccessory = useCallback((d: -1 | 0 | 1) => setAccessoryState(d), []);

  const moving = canDrive && (Math.abs(stick.x) >= DEAD || Math.abs(stick.y) >= DEAD);
  useEffect(() => {
    const hub = hubRef.current!;
    if (!moving) {
      setMotors({ left: 0, right: 0 });
      if (canDrive) hub.sendLatest('D', 'D 0 0');
      return;
    }
    const tick = () => {
      const st = sRef.current;
      if (st.robotType === 'car') {
        const c = mixCar(stickRef.current.y, stickRef.current.x, st.speed);
        setMotors((p) => (p.left === c.left && p.right === c.right ? p : { left: c.left, right: c.right }));
        hub.drive(c.left, c.right, c.steer);
        return;
      }
      const m = mix(stickRef.current.y, stickRef.current.x, st.speed, st.turn);
      setMotors((p) => (p.left === m.left && p.right === m.right ? p : m));
      hub.drive(m.left, m.right);
    };
    tick();
    const t = setInterval(tick, 100); // keep-alive: hub stops by itself after 600 ms of silence
    return () => clearInterval(t);
  }, [moving, canDrive, stick.x, stick.y, settings.speed, settings.turn]);

  useEffect(() => {
    const hub = hubRef.current!;
    if (!canDrive) return;
    if (accessory === 0) {
      hub.sendLatest('A', 'A 0');
      return;
    }
    const send = () => hub.sendLatest('A', `A ${accessory * sRef.current.accSpeed}`);
    send();
    const t = setInterval(send, 150);
    return () => clearInterval(t);
  }, [accessory, canDrive]);

  // Safety: stop when the app is hidden.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') resetControls();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // ---- scan ----
  const teachColor = useCallback(async (c: ColorName) => {
    if (programRef.current !== 'ready') return 'fail' as const;
    if ((verRef.current ?? 0) < 8) return 'old' as const;
    const parts = await new Promise<string[] | null>((resolve) => {
      const t = setTimeout(() => {
        hsvWaiter.current = null;
        resolve(null);
      }, 3000);
      hsvWaiter.current = (p) => {
        clearTimeout(t);
        resolve(p);
      };
      void hubRef.current!.send('H').catch(() => resolve(null));
    });
    if (!parts) return 'fail' as const;
    if (parts[0] === 'nosensor') return 'nosensor' as const;
    const [h, sat, val] = parts.map(Number);
    if (![h, sat, val].every(Number.isFinite)) return 'fail' as const;
    const v: [number, number, number] = [h, sat, val];
    update({ calib: { ...sRef.current.calib, [c]: v } });
    void hubRef.current!.send(`T ${c} ${h} ${sat} ${val}`).catch(() => undefined);
    return 'ok' as const;
  }, [update]);
  const resetColors = useCallback(() => {
    update({ calib: {} });
    if (programRef.current === 'ready' && (verRef.current ?? 0) >= 8) void hubRef.current?.send('T reset').catch(() => undefined);
  }, [update]);

  const [viewer, setViewer] = useState<Store['viewer']>(null);
  const viewerId = useRef(0);
  /** Opens a link the way the teacher chose. Inside the app needs no tap; a window does. */
  const openUrl = useCallback((url: string, color: string, fromTap = true) => {
    if (sRef.current.linkMode === 'app') {
      setViewer({ id: ++viewerId.current, url, color });
      return true;
    }
    return openLink(url, fromTap) === 'window';
  }, []);
  const closeViewer = useCallback(() => setViewer(null), []);

  const scan = useCallback(async () => {
    if (!canDrive || scanning) return;
    setScanning(true);
    const s = sRef.current;
    const c = await new Promise<string>((resolve) => {
      const t = setTimeout(() => {
        scanWaiter.current = null;
        resolve('timeout');
      }, 2500);
      scanWaiter.current = (v) => {
        clearTimeout(t);
        resolve(v);
      };
      void hubRef.current!.send('K').catch(() => undefined);
    });
    setScanning(false);
    const url = isColorName(c) ? normalizeUrl(s.links[c]) : null;
    let opened = false;
    if (url && s.linkMode === 'app') opened = openUrl(url, c, false);
    else if (url && linkWindowOpen()) opened = openLink(url) === 'window';
    if (isColorName(c)) {
      if (s.sound) sounds.detect(c);
      if (s.haptics) haptic([14, 40, 22]);
    } else if (s.sound) sounds.tap();
    const r: ScanResult = { id: ++scanId.current, color: c, at: Date.now(), url, opened };
    if (!(opened && s.linkMode === 'app')) setResult(r); // in-app link already shows the colour
    setHistory((h) => [r, ...h].slice(0, 30));
  }, [canDrive, scanning, openUrl]);

  scanRef.current = () => void scan();

  const resultRef = useRef(result);
  resultRef.current = result;
  const openResultLink = useCallback(() => {
    const r = resultRef.current;
    if (!r?.url) return;
    openUrl(r.url, r.color, true); // runs inside the tap → allowed to open a window
    if (sRef.current.linkMode === 'app') setResult(null);
    else setResult({ ...r, opened: true });
  }, [openUrl]);

  const value = useMemo<Store>(
    () => ({
      tab, setTab, settings, update,
      link, linkError, info, program, hubVersion, hubErrors, detected, deviceIds, batteryMv, batteryLow, color, distanceMm, forcePressed, obstacleAt,
      connect, reconnect, disconnect, startProgram, restartProgram, rescanPorts,
      setStick, setAccessory, accessory, motors, testMotor, motorTest,
      scanning, scan, result, history, closeResult: () => setResult(null), openResultLink,
      viewer, openUrl, closeViewer, teachColor, resetColors,
    }),
    [tab, setTab, settings, update, link, linkError, info, program, hubVersion, hubErrors, detected, deviceIds, batteryMv, batteryLow, color, distanceMm, forcePressed, obstacleAt, connect, reconnect, disconnect, startProgram, restartProgram, rescanPorts, setStick, setAccessory, accessory, motors, testMotor, motorTest, scanning, scan, result, history, openResultLink, viewer, openUrl, closeViewer, teachColor, resetColors],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRobot() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRobot outside provider');
  return v;
}
