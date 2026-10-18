import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PybricksHub, errMsg, type HubInfo, type LinkState } from '../lib/pybricks';
import { loadSettings, saveSettings, normalizeUrl, type Settings } from '../lib/settings';
import { isColorName, type ColorName } from '../lib/colors';
import { openLink } from '../lib/linkWindow';
import { haptic, sounds, unlockAudio } from '../lib/feedback';

export type Tab = 'robot' | 'control' | 'colors' | 'settings';
export type ProgramState = 'unknown' | 'checking' | 'starting' | 'ready' | 'missing' | 'stopped';
export type Dir = 'up' | 'down' | 'left' | 'right';

export interface ScanEntry {
  id: number;
  color: string;
  at: number;
  link: 'opened' | 'blocked' | 'cooldown' | 'none' | 'disabled';
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
  batteryMv: number | null;
  batteryLow: boolean;
  color: string | null;
  scans: ScanEntry[];
  pendingLink: { color: ColorName; url: string } | null;
  dismissPending: () => void;
  watchdogAt: number | null;

  connect: () => Promise<void>;
  reconnect: () => Promise<void>;
  disconnect: () => void;
  startProgram: () => Promise<void>;
  restartProgram: () => Promise<void>;

  held: Set<Dir>;
  press: (d: Dir) => void;
  release: (d: Dir) => void;
  releaseAll: () => void;
  motors: { left: number; right: number };
}

const Ctx = createContext<Store | null>(null);

export function mix(held: Set<Dir>, speed: number, turnPct: number) {
  const y = (held.has('up') ? 1 : 0) - (held.has('down') ? 1 : 0);
  const x = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
  const turn = (speed * turnPct) / 100;
  let l = 0;
  let r = 0;
  if (y === 0) {
    l = x * turn; // spin on the spot
    r = -x * turn;
  } else {
    l = y * speed + x * turn * 0.5; // gentle arc
    r = y * speed - x * turn * 0.5;
  }
  const c = (v: number) => Math.max(-100, Math.min(100, Math.round(v)));
  return { left: c(l), right: c(r) };
}

export function RobotProvider({ children }: { children: ReactNode }) {
  const [tab, setTabState] = useState<Tab>(() => {
    const h = location.hash.replace('#', '') as Tab;
    return ['robot', 'control', 'colors', 'settings'].includes(h) ? h : 'robot';
  });
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [link, setLink] = useState<LinkState>('idle');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [info, setInfo] = useState<HubInfo | null>(null);
  const [program, setProgram] = useState<ProgramState>('unknown');
  const [hubErrors, setHubErrors] = useState<string[]>([]);
  const [batteryMv, setBatteryMv] = useState<number | null>(null);
  const [batteryLow, setBatteryLow] = useState(false);
  const [color, setColor] = useState<string | null>(null);
  const [scans, setScans] = useState<ScanEntry[]>([]);
  const [pendingLink, setPendingLink] = useState<Store['pendingLink']>(null);
  const [held, setHeld] = useState<Set<Dir>>(new Set());
  const [motors, setMotors] = useState({ left: 0, right: 0 });
  const [watchdogAt, setWatchdogAt] = useState<number | null>(null);

  const sRef = useRef(settings);
  sRef.current = settings;
  const programRef = useRef(program);
  programRef.current = program;
  const heldRef = useRef(held);
  heldRef.current = held;
  const lastOpen = useRef<Record<string, number>>({});
  const scanId = useRef(0);
  const readyWaiter = useRef<((ok: boolean) => void) | null>(null);
  const hubRef = useRef<PybricksHub | null>(null);

  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    history.replaceState(null, '', `#${t}`);
  }, []);

  const update = useCallback((p: Partial<Settings>) => {
    setSettings((s) => {
      const n = { ...s, ...p };
      saveSettings(n);
      return n;
    });
  }, []);

  // appearance
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = settings.appearance === 'dark' || (settings.appearance === 'system' && mq.matches) ? 'dark' : 'light';
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [settings.appearance]);

  useEffect(() => {
    const u = () => unlockAudio();
    addEventListener('pointerdown', u, { passive: true });
    return () => removeEventListener('pointerdown', u);
  }, []);

  const sendConfig = useCallback(() => {
    const s = sRef.current;
    setHubErrors([]);
    void hubRef.current?.send(`M ${s.leftPort} ${s.rightPort} ${s.invertLeft ? 1 : 0} ${s.invertRight ? 1 : 0} ${s.colorPort}`).catch(() => undefined);
  }, []);

  const markReady = useCallback(() => {
    if (programRef.current !== 'ready') {
      setProgram('ready');
      sendConfig();
    }
    readyWaiter.current?.(true);
    readyWaiter.current = null;
  }, [sendConfig]);

  const handleColor = useCallback((name: string) => {
    setColor(name);
    if (!isColorName(name)) return;
    const s = sRef.current;
    if (s.sound) sounds.detect(name);
    if (s.haptics) haptic([14, 40, 22]);
    if (s.stopOnColor) {
      setHeld(new Set());
      void hubRef.current?.stop();
    }
    const cfg = s.links[name];
    const url = normalizeUrl(cfg.url);
    let result: ScanEntry['link'] = 'none';
    if (!cfg.enabled) result = 'disabled';
    else if (url) {
      const now = Date.now();
      if (now - (lastOpen.current[name] ?? 0) < s.linkCooldownSec * 1000) result = 'cooldown';
      else {
        lastOpen.current[name] = now;
        result = openLink(url) === 'window' ? 'opened' : 'blocked';
        if (result === 'blocked') setPendingLink({ color: name, url });
        else setPendingLink(null);
      }
    }
    setScans((l) => [{ id: ++scanId.current, color: name, at: Date.now(), link: result }, ...l].slice(0, 30));
  }, []);

  const onLine = useCallback(
    (line: string) => {
      const [cmd, ...rest] = line.split(' ');
      switch (cmd) {
        case 'SPIKECTL':
          markReady();
          break;
        case 'P':
          markReady();
          break;
        case 'C':
          handleColor(rest[0] ?? 'none');
          break;
        case 'B': {
          const mv = Number(rest[0]);
          if (Number.isFinite(mv)) setBatteryMv(mv);
          break;
        }
        case 'E':
          setHubErrors((e) => (e.includes(rest.join(' ')) ? e : [...e, rest.join(' ')]).slice(-6));
          break;
        case 'W':
          setWatchdogAt(Date.now());
          break;
      }
    },
    [handleColor, markReady],
  );

  if (!hubRef.current) {
    hubRef.current = new PybricksHub({
      onState: (st, err) => {
        setLink(st);
        setLinkError(err ?? null);
        if (st !== 'connected') {
          setHeld(new Set());
          setMotors({ left: 0, right: 0 });
          if (programRef.current === 'ready') setProgram('unknown');
        }
      },
      onInfo: setInfo,
      onStatus: ({ running, batteryLow }) => {
        setBatteryLow(batteryLow);
        if (!running && programRef.current === 'ready') {
          setProgram('stopped');
          setHeld(new Set());
        }
      },
      onLine: (l) => onLineRef.current(l),
    });
  }
  const onLineRef = useRef(onLine);
  onLineRef.current = onLine;

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

  /** After connecting: is our program running? If not, start it. */
  const ensureProgram = useCallback(async () => {
    const hub = hubRef.current!;
    setProgram('checking');
    await new Promise((r) => setTimeout(r, 300));
    void hub.send('P').catch(() => undefined);
    if (await waitReady(1200)) return;
    setProgram('starting');
    try {
      await hub.startProgram();
    } catch {
      /* BUSY (another program) or no program stored */
    }
    if (await waitReady(4000)) return;
    setProgram('missing');
  }, []);

  const connect = useCallback(async () => {
    setLinkError(null);
    try {
      await hubRef.current!.requestAndConnect();
      await ensureProgram();
    } catch (e) {
      const m = errMsg(e);
      setLinkError(m);
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

  // After an automatic reconnect, re-check the program.
  const prevLink = useRef(link);
  useEffect(() => {
    if (prevLink.current === 'reconnecting' && link === 'connected') void ensureProgram();
    prevLink.current = link;
  }, [link, ensureProgram]);

  const disconnect = useCallback(() => {
    void hubRef.current?.stop();
    setTimeout(() => hubRef.current?.disconnect(), 120);
    setProgram('unknown');
  }, []);

  const startProgram = useCallback(async () => {
    setProgram('starting');
    try {
      await hubRef.current!.startProgram();
    } catch {
      /* reported via timeout below */
    }
    if (!(await waitReady(4000))) setProgram('missing');
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

  // Ports changed in settings → push to hub.
  useEffect(() => {
    if (programRef.current === 'ready') sendConfig();
  }, [settings.leftPort, settings.rightPort, settings.invertLeft, settings.invertRight, settings.colorPort, sendConfig]);

  // ---- driving ----
  const press = useCallback((d: Dir) => setHeld((h) => (h.has(d) ? h : new Set(h).add(d))), []);
  const release = useCallback((d: Dir) => setHeld((h) => {
    if (!h.has(d)) return h;
    const n = new Set(h);
    n.delete(d);
    return n;
  }), []);
  const releaseAll = useCallback(() => setHeld((h) => (h.size ? new Set() : h)), []);

  const canDrive = link === 'connected' && program === 'ready';

  useEffect(() => {
    const hub = hubRef.current!;
    if (!canDrive || held.size === 0) {
      setMotors({ left: 0, right: 0 });
      if (canDrive) void hub.stop();
      return;
    }
    const tick = () => {
      const m = mix(heldRef.current, sRef.current.speed, sRef.current.turn);
      setMotors(m);
      hub.drive(m.left, m.right);
    };
    tick();
    const t = setInterval(tick, 150); // keep-alive: hub stops by itself after 600 ms of silence
    return () => clearInterval(t);
  }, [held, canDrive, settings.speed, settings.turn]);

  // Safety: stop when the app is hidden (screen locked, app switched).
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') setHeld(new Set());
    };
    document.addEventListener('visibilitychange', onVis);
    addEventListener('blur', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      removeEventListener('blur', onVis);
    };
  }, []);

  const value = useMemo<Store>(
    () => ({
      tab, setTab, settings, update,
      link, linkError, info, program, hubErrors, batteryMv, batteryLow, color, scans,
      pendingLink, dismissPending: () => setPendingLink(null), watchdogAt,
      connect, reconnect, disconnect, startProgram, restartProgram,
      held, press, release, releaseAll, motors,
    }),
    [tab, setTab, settings, update, link, linkError, info, program, hubErrors, batteryMv, batteryLow, color, scans, pendingLink, watchdogAt, connect, reconnect, disconnect, startProgram, restartProgram, held, press, release, releaseAll, motors],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRobot() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRobot outside provider');
  return v;
}
