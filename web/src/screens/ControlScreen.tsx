import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bluetooth, Gauge, Octagon } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { Button, Card } from '../components/ui';
import { batteryPct, LinkPill } from '../components/common';
import { COLORS } from '../lib/colors';
import { useRobot, type Dir } from '../state/robot';

const KEYMAP: Record<string, Dir> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
};

const SWATCH: Record<string, string> = { red: COLORS.red.hex, blue: COLORS.blue.hex, green: COLORS.green.hex, yellow: COLORS.yellow.hex, white: '#ffffff', none: 'transparent' };
const NAME_MS: Record<string, string> = { red: 'Merah', blue: 'Biru', green: 'Hijau', yellow: 'Kuning', white: 'Putih', none: 'Tiada' };

function PadButton({ dir, label, children, className, disabled }: { dir: Dir; label: string; children: ReactNode; className: string; disabled: boolean }) {
  const { press, release, held } = useRobot();
  const on = held.has(dir);
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      disabled={disabled}
      onPointerDown={(e) => {
        if (disabled) return;
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        press(dir);
      }}
      onPointerUp={() => release(dir)}
      onPointerCancel={() => release(dir)}
      onLostPointerCapture={() => release(dir)}
      onContextMenu={(e) => e.preventDefault()}
      className={`grid touch-none select-none place-items-center rounded-[28px] transition-[transform,background-color,box-shadow] duration-100 [-webkit-touch-callout:none] disabled:opacity-35 ${
        on ? 'scale-[0.94] bg-accent text-white shadow-[0_0_0_6px_color-mix(in_srgb,var(--accent)_22%,transparent)]' : 'bg-bg-elevated text-ink shadow-[var(--shadow-card)] ring-[0.5px] ring-hairline'
      } ${className}`}
    >
      {children}
    </button>
  );
}

function MotorBar({ label, value }: { label: string; value: number }) {
  const pct = Math.abs(value);
  return (
    <div className="flex-1">
      <div className="mb-1.5 flex justify-between text-[12px] text-ink-2">
        <span>{label}</span>
        <span className="tabular">{value > 0 ? '+' : ''}{value}%</span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-fill">
        <span className="absolute inset-y-0 left-1/2 w-px bg-hairline" />
        <span
          className={`absolute inset-y-0 rounded-full transition-all duration-150 ${value >= 0 ? 'left-1/2 bg-sys-green' : 'right-1/2 bg-sys-orange'}`}
          style={{ width: `${pct / 2}%` }}
        />
      </div>
    </div>
  );
}

export function ControlScreen() {
  const r = useRobot();
  const s = r.settings;
  const ready = r.link === 'connected' && r.program === 'ready';

  // Keyboard (Mac / iPad keyboard): arrows or WASD, Space = stop.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === ' ') {
        e.preventDefault();
        r.releaseAll();
        return;
      }
      const d = KEYMAP[e.key];
      if (d && ready) {
        e.preventDefault();
        r.press(d);
      }
    };
    const up = (e: KeyboardEvent) => {
      const d = KEYMAP[e.key];
      if (d) r.release(d);
    };
    addEventListener('keydown', down);
    addEventListener('keyup', up);
    return () => {
      removeEventListener('keydown', down);
      removeEventListener('keyup', up);
    };
  }, [r, ready]);

  const presets = [
    { v: 30, l: 'Perlahan' },
    { v: 60, l: 'Sederhana' },
    { v: 100, l: 'Laju' },
  ];
  const pad = 'clamp(76px, 24vw, 112px)';

  return (
    <div className="flex flex-col gap-6">
      {!ready && (
        <Card className="flex items-center gap-3 p-4">
          <Bluetooth size={22} className="shrink-0 text-ink-2" />
          <div className="min-w-0 flex-1">
            <LinkPill state={r.link} />
            <p className="text-[13px] text-ink-2">
              {r.link !== 'connected' ? 'Sambung robot dahulu untuk mengawal.' : 'Program kawalan belum sedia.'}
            </p>
          </div>
          <Button variant="secondary" onClick={() => r.setTab('robot')}>Sambung</Button>
        </Card>
      )}

      {/* status strip */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2.5">
          <span
            className="h-8 w-8 rounded-full ring-[0.5px] ring-hairline transition-colors duration-300"
            style={{ background: r.color && SWATCH[r.color] !== 'transparent' ? SWATCH[r.color] : 'var(--fill)', boxShadow: r.color && r.color in COLORS ? `0 0 18px ${COLORS[r.color as keyof typeof COLORS].glow}` : undefined }}
          />
          <div>
            <div className="text-[12px] text-ink-2">Warna dikesan</div>
            <div className="text-[17px] font-semibold tracking-[-0.01em]">{r.color ? NAME_MS[r.color] ?? r.color : '—'}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[12px] text-ink-2">Bateri</div>
          <div className="tabular text-[17px] font-semibold">{r.batteryMv ? `${batteryPct(r.batteryMv)}%` : '—'}</div>
        </div>
      </div>

      {/* D-pad */}
      <div className="flex justify-center py-2">
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(3, ${pad})`, gridTemplateRows: `repeat(3, ${pad})` }}>
          <span />
          <PadButton dir="up" label="Ke depan" disabled={!ready} className="">
            <ArrowUp size={40} strokeWidth={2.4} />
          </PadButton>
          <span />
          <PadButton dir="left" label="Ke kiri" disabled={!ready} className="">
            <ArrowLeft size={40} strokeWidth={2.4} />
          </PadButton>
          <button
            type="button"
            aria-label="Berhenti"
            onPointerDown={(e) => {
              e.preventDefault();
              r.releaseAll();
            }}
            disabled={!ready}
            className="grid touch-none select-none place-items-center rounded-full bg-sys-red text-white shadow-[0_8px_24px_rgba(255,59,48,0.35)] transition active:scale-95 disabled:opacity-35"
          >
            <Octagon size={30} strokeWidth={2.4} />
            <span className="-mt-3 text-[11px] font-bold tracking-[0.08em]">STOP</span>
          </button>
          <PadButton dir="right" label="Ke kanan" disabled={!ready} className="">
            <ArrowRight size={40} strokeWidth={2.4} />
          </PadButton>
          <span />
          <PadButton dir="down" label="Ke belakang" disabled={!ready} className="">
            <ArrowDown size={40} strokeWidth={2.4} />
          </PadButton>
          <span />
        </div>
      </div>
      <p className="-mt-3 text-center text-[13px] text-ink-3">Tekan dan tahan untuk bergerak · lepas untuk berhenti</p>

      {/* speed */}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <label htmlFor="speed" className="flex items-center gap-2 text-[17px] font-semibold">
            <Gauge size={20} className="text-accent" /> Kelajuan
          </label>
          <span className="tabular text-[28px] font-bold tracking-[-0.03em]">{s.speed}%</span>
        </div>
        <input
          id="speed"
          type="range"
          min={10}
          max={100}
          step={5}
          value={s.speed}
          onChange={(e) => r.update({ speed: Number(e.target.value) })}
          className="h-8 w-full"
        />
        <div className="mt-3 grid grid-cols-3 gap-2">
          {presets.map((p) => (
            <button
              key={p.v}
              onClick={() => r.update({ speed: p.v })}
              className={`h-10 rounded-[12px] text-[14px] font-medium transition active:scale-[0.97] ${s.speed === p.v ? 'bg-accent text-white' : 'bg-fill text-ink'}`}
            >
              {p.l}
            </button>
          ))}
        </div>
        <div className="mt-5 flex gap-4">
          <MotorBar label={`Kiri · ${s.leftPort}`} value={r.motors.left} />
          <MotorBar label={`Kanan · ${s.rightPort}`} value={r.motors.right} />
        </div>
      </Card>
    </div>
  );
}
