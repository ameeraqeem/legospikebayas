import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PybricksHub, errMsg, type HubInfo, type LinkState } from '../lib/pybricks';
import { autoAssign, configLine, loadSettings, normalizeUrl, PORT_LETTERS, saveSettings, type Detected, type PortLetter, type Settings } from '../lib/settings';
import { isColorName } from '../lib/colors';
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
  hubErrors: string[];
  detected: Record<PortLetter, Detected> | null;
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
}

const Ctx = createContext<Store | null>(null);
const DEAD = 0.12;

export function mix(y: number, x: number, speed: number, turnPct: number) {
  const dz = (v: number) => (Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD));
  const yy = dz(y);
  const xx = dz(x);
  const turn = (speed * turnPct) / 100;
  const c = (v: number) => Math.max(-100, Math.min(100, Math.round(v)));
  return { left: c(yy * speed + xx * turn), right: c(yy * speed - xx * turn) };
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
  const [hubErrors, setHubErrors] = useState<string[]>([]);
  const [detected, setDetected] = useState<Record<PortLetter, Detected> | null>(null);
  const [batteryMv, setBatteryMv] = useState<number | null>(null);
  const [batteryLow, setBatteryLow] = useState(false);
  const [color, setColor] = useState<string | null>(null);
  const [distanceMm, setDistanceMm] = useState<number | null>(null);
  const [forcePressed, setForcePressed] = useState(false);
  const [obstacleAt, setObstacleAt] = useState<number | null>(null);
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
    void hubRef.current?.send(configLine(s)).catch(() => undefined);
    void hubRef.current?.send(`O ${sRef.current.obstacleCm * 10}`).catch(() => undefined);
  }, []);

  const onPortsDetected = useCallback(
    (found: Record<PortLetter, Detected>) => {
      setDetected(found);
      if (sRef.current.autoPorts) {
        const a = autoAssign(found);
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
        case 'SPIKECTL':
          if (parts[1] === '4') markReady();
          else setProgram('old');
          break;
        case 'P':
          if (parts[1] === '4') {
            const wasReady = programRef.current === 'ready';
            markReady();
            if (!wasReady) void hubRef.current?.send('Q').catch(() => undefined); // already running: ask for ports
          } else setProgram('old');
          break;
        case 'Q':
          if (parts[1] === 'end') {
            const f = {} as Record<PortLetter, Detected>;
            for (const p of PORT_LETTERS) f[p] = qBuf.current[p] ?? 'none';
            qBuf.current = {};
            onPortsDetected(f);
          } else if (PORT_LETTERS.includes(parts[1] as PortLetter)) {
            qBuf.current[parts[1] as PortLetter] = (['motor', 'color', 'ultra', 'force'] as const).find((k) => k === parts[2]) ?? 'none';
          }
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
    await new Promise((r) => setTimeout(r, 300));
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
    if (programRef.current === 'ready') sendConfig();
  }, [rolesKey, sendConfig]);

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
      const m = mix(stickRef.current.y, stickRef.current.x, sRef.current.speed, sRef.current.turn);
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
    if (url && linkWindowOpen()) opened = openLink(url) === 'window';
    if (isColorName(c)) {
      if (s.sound) sounds.detect(c);
      if (s.haptics) haptic([14, 40, 22]);
    } else if (s.sound) sounds.tap();
    const r: ScanResult = { id: ++scanId.current, color: c, at: Date.now(), url, opened };
    setResult(r);
    setHistory((h) => [r, ...h].slice(0, 30));
  }, [canDrive, scanning]);

  scanRef.current = () => void scan();

  const resultRef = useRef(result);
  resultRef.current = result;
  const openResultLink = useCallback(() => {
    const r = resultRef.current;
    if (!r?.url) return;
    openLink(r.url, true); // runs inside the tap → allowed to open a window
    setResult({ ...r, opened: true });
  }, []);

  const value = useMemo<Store>(
    () => ({
      tab, setTab, settings, update,
      link, linkError, info, program, hubErrors, detected, batteryMv, batteryLow, color, distanceMm, forcePressed, obstacleAt,
      connect, reconnect, disconnect, startProgram, restartProgram, rescanPorts,
      setStick, setAccessory, accessory, motors,
      scanning, scan, result, history, closeResult: () => setResult(null), openResultLink,
    }),
    [tab, setTab, settings, update, link, linkError, info, program, hubErrors, detected, batteryMv, batteryLow, color, distanceMm, forcePressed, obstacleAt, connect, reconnect, disconnect, startProgram, restartProgram, rescanPorts, setStick, setAccessory, accessory, motors, scanning, scan, result, history, openResultLink],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRobot() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRobot outside provider');
  return v;
}
