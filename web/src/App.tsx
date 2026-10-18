import { AnimatePresence, motion } from 'motion/react';
import { Bluetooth, ExternalLink, Gamepad2, Palette, Settings as Gear, X } from 'lucide-react';
import { RobotProvider, useRobot, type Tab } from './state/robot';
import { RobotScreen } from './screens/RobotScreen';
import { ControlScreen } from './screens/ControlScreen';
import { ColorsScreen } from './screens/ColorsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { LinkPill } from './components/common';
import { COLORS } from './lib/colors';
import { openLink } from './lib/linkWindow';

const TABS: { id: Tab; label: string; title: string; icon: typeof Bluetooth }[] = [
  { id: 'robot', label: 'Robot', title: 'Sambung Robot', icon: Bluetooth },
  { id: 'control', label: 'Kawalan', title: 'Kawalan', icon: Gamepad2 },
  { id: 'colors', label: 'Warna', title: 'Warna & Pautan', icon: Palette },
  { id: 'settings', label: 'Tetapan', title: 'Tetapan', icon: Gear },
];
const NAME_MS: Record<string, string> = { red: 'Merah', blue: 'Biru', green: 'Hijau', yellow: 'Kuning' };

function PendingLink() {
  const { pendingLink, dismissPending } = useRobot();
  return (
    <AnimatePresence>
      {pendingLink && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          className="safe-x fixed inset-x-0 top-[max(env(safe-area-inset-top),12px)] z-50 mx-auto max-w-xl"
        >
          <div className="glass flex items-center gap-3 rounded-[20px] p-3 shadow-[var(--shadow-float)]">
            <span className="h-9 w-9 shrink-0 rounded-full" style={{ background: COLORS[pendingLink.color].hex }} />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold">{NAME_MS[pendingLink.color]} dikesan</div>
              <div className="truncate text-[12px] text-ink-2">{pendingLink.url}</div>
            </div>
            <button
              onClick={() => {
                openLink(pendingLink.url, true);
                dismissPending();
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-[14px] font-semibold text-white"
            >
              <ExternalLink size={16} /> Buka
            </button>
            <button onClick={dismissPending} aria-label="Tutup" className="grid h-9 w-9 place-items-center rounded-full text-ink-2">
              <X size={18} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Shell() {
  const r = useRobot();
  const current = TABS.find((t) => t.id === r.tab)!;
  return (
    <div className="flex min-h-full flex-col">
      <header className="safe-top safe-x sticky top-0 z-30 bg-bg/75 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between">
          <h1 className="text-[28px] font-bold tracking-[-0.03em]">{current.title}</h1>
          {r.tab !== 'robot' && <LinkPill state={r.link} />}
        </div>
      </header>

      <main className="safe-x mx-auto w-full max-w-2xl flex-1 pb-[calc(96px+env(safe-area-inset-bottom))] pt-3">
        <motion.div key={r.tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
          {r.tab === 'robot' && <RobotScreen />}
          {r.tab === 'control' && <ControlScreen />}
          {r.tab === 'colors' && <ColorsScreen />}
          {r.tab === 'settings' && <SettingsScreen />}
        </motion.div>
      </main>

      <nav className="glass fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)]" aria-label="Navigasi">
        <div className="mx-auto flex h-[60px] max-w-2xl">
          {TABS.map((t) => {
            const on = t.id === r.tab;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => r.setTab(t.id)}
                aria-current={on ? 'page' : undefined}
                className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${on ? 'text-accent' : 'text-ink-2'}`}
              >
                <Icon size={24} strokeWidth={on ? 2.3 : 1.9} />
                {t.label}
                {t.id === 'robot' && r.link === 'connected' && <span className="absolute right-[calc(50%-18px)] top-2 h-2 w-2 rounded-full bg-sys-green ring-2 ring-bg" />}
              </button>
            );
          })}
        </div>
      </nav>
      <PendingLink />
    </div>
  );
}

export default function App() {
  return (
    <RobotProvider>
      <Shell />
    </RobotProvider>
  );
}
