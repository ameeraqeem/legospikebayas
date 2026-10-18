import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';

/**
 * One-axis thumb stick (drone style). Drag the knob; it springs back to the
 * centre on release. Each stick tracks its own pointer, so two thumbs work at once.
 */
export function Joystick({
  axis,
  onChange,
  disabled,
  color,
  label,
  long = 'max(140px, min(260px, 46vw, calc(100dvh - 120px)))',
  short = 'max(88px, min(132px, 26vw, calc((100dvh - 120px) * 0.55)))',
}: {
  axis: 'x' | 'y';
  onChange: (v: number) => void;
  disabled?: boolean;
  color: string;
  label: string;
  long?: string;
  short?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const pid = useRef<number | null>(null);
  const [v, setV] = useState(0);
  const vertical = axis === 'y';
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth + 6, h: el.clientHeight + 6 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const valueAt = (clientX: number, clientY: number) => {
    const r = track.current!.getBoundingClientRect();
    const knob = vertical ? r.width : r.height; // knob is ~ as big as the short side
    const range = ((vertical ? r.height : r.width) - knob) / 2;
    const d = vertical ? r.top + r.height / 2 - clientY : clientX - (r.left + r.width / 2);
    return Math.max(-1, Math.min(1, d / Math.max(1, range)));
  };
  const set = (n: number) => {
    setV(n);
    onChange(n);
  };
  const end = (e: React.PointerEvent) => {
    if (pid.current !== e.pointerId) return;
    pid.current = null;
    set(0);
  };

  // knob geometry from the measured track (inner box = track minus 3px border)
  const inner = { w: Math.max(0, size.w - 6), h: Math.max(0, size.h - 6) };
  const knob = Math.max(0, (vertical ? inner.w : inner.h) - 8);
  const travel = Math.max(0, ((vertical ? inner.h : inner.w) - 8 - knob) / 2);
  const dragging = pid.current !== null;
  const Neg = vertical ? ChevronDown : ChevronLeft;
  const Pos = vertical ? ChevronUp : ChevronRight;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        ref={track}
        role="slider"
        aria-label={label}
        aria-orientation={vertical ? 'vertical' : 'horizontal'}
        aria-valuemin={-100}
        aria-valuemax={100}
        aria-valuenow={Math.round(v * 100)}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onPointerDown={(e) => {
          if (disabled || pid.current !== null) return;
          e.preventDefault();
          pid.current = e.pointerId;
          try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
          set(valueAt(e.clientX, e.clientY));
        }}
        onPointerMove={(e) => {
          if (pid.current === e.pointerId) set(valueAt(e.clientX, e.clientY));
        }}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
        onContextMenu={(e) => e.preventDefault()}
        className={`relative touch-none select-none rounded-full border-[3px] border-ink bg-white shadow-[inset_0_4px_0_rgba(35,48,90,0.12),0_5px_0_var(--ink)] ${disabled ? 'opacity-50' : ''}`}
        style={{ width: vertical ? short : long, height: vertical ? long : short }}
      >
        {/* guide arrows */}
        <Pos size={30} strokeWidth={3.2} className={`absolute text-ink-3 ${vertical ? 'left-1/2 top-2 -translate-x-1/2' : 'right-2 top-1/2 -translate-y-1/2'}`} />
        <Neg size={30} strokeWidth={3.2} className={`absolute text-ink-3 ${vertical ? 'bottom-2 left-1/2 -translate-x-1/2' : 'left-2 top-1/2 -translate-y-1/2'}`} />
        {/* centre line */}
        <span className={`absolute rounded-full bg-fill-2 ${vertical ? 'left-[22%] right-[22%] top-1/2 h-[3px] -translate-y-1/2' : 'bottom-[22%] top-[22%] left-1/2 w-[3px] -translate-x-1/2'}`} />
        {/* knob */}
        <div
          className="pointer-events-none absolute rounded-full border-[3px] border-ink shadow-[0_4px_0_var(--ink)]"
          style={{
            width: knob,
            height: knob,
            left: vertical ? 4 : 4 + travel * (1 + v),
            top: vertical ? 4 + travel * (1 - v) : 4,
            background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.55), transparent 45%), ${color}`,
            transition: dragging ? 'none' : 'top 220ms cubic-bezier(.3,1.6,.5,1), left 220ms cubic-bezier(.3,1.6,.5,1)',
          }}
        />
      </div>
      <span className="text-[14px] font-semibold text-ink-2">{label}</span>
    </div>
  );
}
