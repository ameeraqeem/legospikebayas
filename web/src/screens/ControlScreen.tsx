import { AnimatePresence, motion } from 'motion/react';
import { ArrowBigDown, ArrowBigUp, BatteryMedium, Bluetooth, Hand, Rabbit, Radar, ScanLine, Turtle } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Button, Card } from '../components/ui';
import { Joystick } from '../components/Joystick';
import { batteryPct } from '../components/common';
import { Mascot } from '../components/Mascot';
import { COLORS, colorLabel, isColorName } from '../lib/colors';
import { PORT_LETTERS } from '../lib/settings';
import { useRobot } from '../state/robot';

function HoldButton({ label, onDown, onUp, disabled, children }: { label: string; onDown: () => void; onUp: () => void; disabled?: boolean; children: ReactNode }) {
  const press = (e: React.PointerEvent, on: boolean) => ((e.currentTarget as HTMLElement).dataset.pressed = on ? 'true' : 'false');
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onPointerDown={(e) => {
        if (disabled) return;
        e.preventDefault();
        try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
        press(e, true);
        onDown();
      }}
      onPointerUp={(e) => { press(e, false); onUp(); }}
      onPointerCancel={(e) => { press(e, false); onUp(); }}
      onLostPointerCapture={(e) => { press(e, false); onUp(); }}
      onContextMenu={(e) => e.preventDefault()}
      className="k-btn flex h-12 flex-1 touch-none items-center justify-center gap-1.5 rounded-full bg-k-purple px-4 text-[16px] font-semibold text-white"
    >
      {children}
    </button>
  );
}

/** Small equal-width status tile used in the top row. */
function Tile({ label, children, tone = '' }: { label: string; children: ReactNode; tone?: string }) {
  return (
    <div className={`k-card flex min-w-0 flex-col items-center justify-center gap-1 rounded-[20px] px-2 py-2.5 text-center short:rounded-[16px] short:px-1 short:py-1.5 ${tone}`}>
      <span className="text-[12px] font-medium opacity-75 short:hidden">{label}</span>
      <div className="flex max-w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-center text-[16px] font-bold leading-tight short:gap-x-1 short:text-[13px]">{children}</div>
    </div>
  );
}

export function ControlScreen() {
  const r = useRobot();
  const s = r.settings;
  const ready = r.link === 'connected' && r.program === 'ready';
  const has = (role: string) => PORT_LETTERS.some((p) => s.roles[p] === role);
  const hasAccessory = has('X');
  const hasSensor = has('C');
  const hasUltra = has('U');
  const hasForce = has('F');

  // Keyboard on Mac/iPad: W/S or ↑/↓ drive, A/D or ←/→ turn, Space = IMBAS
  useEffect(() => {
    const keys = new Set<string>();
    const apply = () => {
      r.setStick('y', (keys.has('ArrowUp') || keys.has('w') ? 1 : 0) - (keys.has('ArrowDown') || keys.has('s') ? 1 : 0));
      r.setStick('x', (keys.has('ArrowRight') || keys.has('d') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0));
    };
    const norm = (e: KeyboardEvent) => (e.key.length === 1 ? e.key.toLowerCase() : e.key);
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || !ready) return;
      const k = norm(e);
      if (k === ' ') {
        e.preventDefault();
        void r.scan();
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(k)) {
        e.preventDefault();
        keys.add(k);
        apply();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (keys.delete(norm(e))) apply();
    };
    addEventListener('keydown', down);
    addEventListener('keyup', up);
    return () => {
      removeEventListener('keydown', down);
      removeEventListener('keyup', up);
    };
  }, [r, ready]);

  // obstacle banner for 1.6 s
  const [, tick] = useState(0);
  useEffect(() => {
    if (!r.obstacleAt) return;
    const t = setTimeout(() => tick((n) => n + 1), 1700);
    return () => clearTimeout(t);
  }, [r.obstacleAt]);
  const showObstacle = !!r.obstacleAt && Date.now() - r.obstacleAt < 1600;

  const cm = r.distanceMm === null || r.distanceMm >= 2000 ? null : Math.round(r.distanceMm / 10);
  const near = s.obstacleCm > 0 && cm !== null && cm < s.obstacleCm;
  const live = r.color && isColorName(r.color) ? r.color : null;
  const bat = r.batteryMv ? batteryPct(r.batteryMv) : null;
  const tileCount = 2 + (hasUltra ? 1 : 0) + (hasForce ? 1 : 0);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 landscape:max-w-4xl short:gap-2">
      {!ready && (
        <Card className="flex w-full items-center gap-3 p-3 pr-4">
          <Mascot mood="sleep" size={52} />
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-semibold">Robot belum sedia</div>
            <p className="text-[14px] text-ink-2">{r.link === 'connected' ? 'Program robot sedang disediakan…' : 'Sambung dahulu di tab Robot.'}</p>
          </div>
          <Button size="sm" tone="blue" onClick={() => r.setTab('robot')} icon={<Bluetooth size={18} />}>Sambung</Button>
        </Card>
      )}

      <div className="grid w-full items-center gap-4 portrait:grid-cols-2 landscape:grid-cols-[1fr_minmax(0,24rem)_1fr]">
        {/* LEFT stick */}
        <div className="flex justify-center portrait:order-2">
          <Joystick axis="y" color="var(--green)" label="Depan · Belakang" disabled={!ready} onChange={(v) => r.setStick('y', v)} />
        </div>

        {/* CENTRE column */}
        <div className="flex w-full flex-col items-center gap-3.5 short:gap-2 portrait:order-1 portrait:col-span-2">
          <div className={`grid w-full gap-2 ${tileCount === 4 ? 'grid-cols-2' : tileCount === 3 ? 'grid-cols-3 short:grid-cols-2' : 'grid-cols-2'}`}>
            <Tile label="Warna">
              <span className="h-4 w-4 shrink-0 rounded-full border-[2.5px] border-ink" style={{ background: live ? COLORS[live].hex : 'var(--fill)' }} />
              <span>{hasSensor ? colorLabel(r.color) : 'Tiada'}</span>
            </Tile>
            {hasUltra && (
              <Tile label="Jarak" tone={near ? 'bg-k-red text-white' : ''}>
                <Radar size={16} className="shrink-0" />
                <span className="tabular">{r.distanceMm === null ? '—' : cm === null ? 'Jauh' : `${cm} cm`}</span>
              </Tile>
            )}
            {hasForce && (
              <Tile label="Tekan" tone={r.forcePressed ? 'bg-k-red text-white' : ''}>
                <Hand size={16} className="shrink-0" />
                {r.forcePressed ? 'Ya' : 'Tidak'}
              </Tile>
            )}
            <Tile label="Bateri" tone={bat !== null && bat < 15 ? 'bg-k-red text-white' : ''}>
              <BatteryMedium size={16} className="shrink-0" />
              <span className="tabular">{bat === null ? '—' : `${bat}%`}</span>
            </Tile>
          </div>

          <div className="flex w-full flex-col items-center gap-3.5 short:flex-row short:justify-center short:gap-4">
          <button
            type="button"
            onClick={() => void r.scan()}
            disabled={!ready || !hasSensor || r.scanning}
            aria-label="Imbas warna"
            className="k-btn grid h-[128px] w-[128px] shrink-0 place-items-center rounded-full bg-k-yellow text-ink short:h-[96px] short:w-[96px]"
          >
            <motion.span animate={r.scanning ? { rotate: 360 } : { rotate: 0 }} transition={r.scanning ? { repeat: Infinity, duration: 1, ease: 'linear' } : {}}>
              <ScanLine size={42} strokeWidth={2.6} />
            </motion.span>
            <span className="-mt-3 text-[20px] font-bold tracking-[0.04em]">{r.scanning ? '…' : 'IMBAS'}</span>
          </button>

          {hasAccessory && (
            <div className="flex w-full flex-col items-center gap-1.5 short:w-40">
              <span className="text-[13px] font-semibold text-ink-2">Lengan (motor ke-3)</span>
              <div className="flex w-full gap-2.5 short:flex-col short:gap-2">
                <HoldButton label="Lengan naik" disabled={!ready} onDown={() => r.setAccessory(1)} onUp={() => r.setAccessory(0)}>
                  <ArrowBigUp size={22} strokeWidth={2.4} /> Naik
                </HoldButton>
                <HoldButton label="Lengan turun" disabled={!ready} onDown={() => r.setAccessory(-1)} onUp={() => r.setAccessory(0)}>
                  <ArrowBigDown size={22} strokeWidth={2.4} /> Turun
                </HoldButton>
              </div>
            </div>
          )}
          </div>

          <Card className="w-full px-4 py-2.5 short:py-1">
            <div className="flex items-center gap-3">
              <Turtle size={26} className="shrink-0 text-k-green" aria-hidden />
              <input aria-label="Kelajuan" type="range" min={10} max={100} step={5} value={s.speed} onChange={(e) => r.update({ speed: Number(e.target.value) })} className="h-8 w-full" />
              <Rabbit size={26} className="shrink-0 text-k-orange" aria-hidden />
              <span className="tabular w-12 text-right text-[18px] font-bold">{s.speed}%</span>
            </div>
          </Card>
        </div>

        {/* RIGHT stick */}
        <div className="flex justify-center portrait:order-3">
          <Joystick axis="x" color="var(--blue)" label="Kiri · Kanan" disabled={!ready} onChange={(v) => r.setStick('x', v)} />
        </div>
      </div>

      <AnimatePresence>
        {showObstacle && (
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            className="k-card fixed left-1/2 top-[max(env(safe-area-inset-top),14px)] z-40 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap bg-k-red px-4 py-2 text-[17px] font-bold text-white"
            role="alert"
          >
            ✋ Halangan! Robot berhenti
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
