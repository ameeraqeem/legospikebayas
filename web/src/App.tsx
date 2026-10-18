import { motion } from 'motion/react';
import { Bluetooth, Gamepad2, Settings as Gear } from 'lucide-react';
import { RobotProvider, useRobot, type Tab } from './state/robot';
import { RobotScreen } from './screens/RobotScreen';
import { ControlScreen } from './screens/ControlScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ScanResultSheet } from './components/ScanResult';
import { Mascot } from './components/Mascot';

const TABS: { id: Tab; label: string; title: string; icon: typeof Bluetooth; tone: string }[] = [
  { id: 'robot', label: 'Robot', title: 'Robot Saya', icon: Bluetooth, tone: 'bg-k-blue' },
  { id: 'control', label: 'Pandu', title: 'Pandu Robot', icon: Gamepad2, tone: 'bg-k-green' },
  { id: 'settings', label: 'Tetapan', title: 'Tetapan', icon: Gear, tone: 'bg-k-purple' },
];

function Shell() {
  const r = useRobot();
  const current = TABS.find((t) => t.id === r.tab)!;
  const ready = r.link === 'connected' && r.program === 'ready';
  return (
    <div className="flex min-h-full flex-col">
      <header className={`safe-top safe-x sticky top-0 z-30 bg-[#dff3ff]/90 backdrop-blur-md ${r.tab === 'control' ? 'short:hidden' : ''}`}>
        <div className="mx-auto grid h-16 max-w-3xl grid-cols-[48px_1fr_48px] items-center">
          <span />
          <h1 className="text-center text-[28px] font-bold tracking-[0.005em] [text-shadow:0_2px_0_#fff]">{current.title}</h1>
          <button
            onClick={() => r.setTab('robot')}
            aria-label={ready ? 'Robot sedia' : 'Robot belum bersambung'}
            title={ready ? 'Sedia' : 'Belum bersambung'}
            className={`relative grid h-11 w-11 place-items-center justify-self-end rounded-full border-[3px] border-ink ${ready ? 'bg-k-green' : 'bg-white'}`}
          >
            <Mascot mood={ready ? 'happy' : 'sleep'} size={30} />
            <span className={`absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-[2.5px] border-white ${ready ? 'bg-k-green' : r.link === 'connected' ? 'bg-k-orange' : 'bg-ink-3'}`} />
          </button>
        </div>
      </header>

      <main className="safe-x mx-auto w-full max-w-3xl flex-1 pb-[calc(104px+env(safe-area-inset-bottom))] pt-2 short:pb-[calc(66px+env(safe-area-inset-bottom))]">
        <motion.div key={r.tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}>
          {r.tab === 'robot' && <RobotScreen />}
          {r.tab === 'control' && <ControlScreen />}
          {r.tab === 'settings' && <SettingsScreen />}
        </motion.div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t-[3px] border-ink bg-white pb-[env(safe-area-inset-bottom)]" aria-label="Navigasi">
        <div className="mx-auto flex h-[72px] max-w-md items-center justify-around px-2 short:h-[54px]">
          {TABS.map((t) => {
            const on = t.id === r.tab;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => r.setTab(t.id)}
                aria-label={t.label}
                aria-current={on ? 'page' : undefined}
                className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[13px] font-semibold"
              >
                <span className={`grid h-10 w-14 place-items-center rounded-[14px] border-[3px] transition ${on ? `border-ink text-white ${t.tone} shadow-[0_3px_0_var(--ink)]` : 'border-transparent text-ink-2'}`}>
                  <Icon size={22} strokeWidth={2.5} />
                </span>
                <span className={`short:hidden ${on ? 'text-ink' : 'text-ink-2'}`}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
      <ScanResultSheet />
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
