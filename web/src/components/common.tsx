import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import type { LinkState } from '../lib/pybricks';
import type { ProgramState } from '../state/robot';
import { PORT_LETTERS, type PortLetter } from '../lib/settings';

export const LINK_META: Record<LinkState, { label: string; dot: string; text: string }> = {
  idle: { label: 'Belum disambung', dot: 'bg-ink-3', text: 'text-ink-2' },
  connecting: { label: 'Menyambung…', dot: 'bg-sys-orange', text: 'text-sys-orange' },
  connected: { label: 'Bersambung', dot: 'bg-sys-green', text: 'text-sys-green' },
  reconnecting: { label: 'Menyambung semula…', dot: 'bg-sys-orange', text: 'text-sys-orange' },
  disconnected: { label: 'Terputus', dot: 'bg-ink-3', text: 'text-ink-2' },
  error: { label: 'Ralat', dot: 'bg-sys-red', text: 'text-sys-red' },
};

export const PROGRAM_LABEL: Record<ProgramState, string> = {
  unknown: '—',
  checking: 'Menyemak…',
  starting: 'Memulakan…',
  ready: 'Sedia',
  missing: 'Belum dipasang',
  stopped: 'Berhenti',
};

export function Dot({ className, pulse }: { className: string; pulse?: boolean }) {
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      {pulse && <span className={`absolute inset-0 animate-ping rounded-full opacity-60 ${className}`} />}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${className}`} />
    </span>
  );
}

export function LinkPill({ state }: { state: LinkState }) {
  const m = LINK_META[state];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${m.text}`}>
      <Dot className={m.dot} pulse={state === 'connecting' || state === 'reconnecting'} />
      {m.label}
    </span>
  );
}

export function PortPicker({ value, onChange, label, disabled = [] }: { value: PortLetter; onChange: (p: PortLetter) => void; label: string; disabled?: PortLetter[] }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1.5">
      {PORT_LETTERS.map((p) => {
        const on = p === value;
        const off = disabled.includes(p) && !on;
        return (
          <button
            key={p}
            role="radio"
            aria-checked={on}
            aria-label={`Port ${p}`}
            disabled={off}
            onClick={() => onChange(p)}
            className={`h-9 w-9 rounded-[10px] text-[15px] font-semibold transition ${on ? 'bg-accent text-white' : off ? 'bg-fill text-ink-3 opacity-40' : 'bg-fill text-ink active:scale-95'}`}
          >
            {p}
          </button>
        );
      })}
    </div>
  );
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1800);
  };
  return (
    <button onClick={copy} className="inline-flex h-11 items-center gap-2 rounded-full bg-fill px-5 text-[15px] font-semibold text-accent active:scale-[0.97]">
      {done ? <Check size={18} /> : <Copy size={18} />}
      {done ? 'Disalin' : label}
    </button>
  );
}

/** SPIKE Prime 2-cell Li-ion: ~8.3 V full, ~7.0 V low. Rough indicator only. */
export function batteryPct(mv: number) {
  return Math.max(0, Math.min(100, Math.round(((mv - 7000) / (8300 - 7000)) * 100)));
}
