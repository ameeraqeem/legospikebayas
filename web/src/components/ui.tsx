import { motion } from 'motion/react';
import { ChevronLeft } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

const spring = { type: 'spring', stiffness: 420, damping: 30 } as const;

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'plain';
  size?: 'md' | 'lg';
  icon?: ReactNode;
};

export function Button({ variant = 'primary', size = 'md', icon, className = '', children, ...rest }: BtnProps) {
  const base =
    'inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold tracking-[-0.01em] transition-[background-color,opacity,transform] duration-200 active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100';
  const sizes = size === 'lg' ? 'h-14 px-8 text-[17px] min-w-[200px]' : 'h-11 px-5 text-[15px]';
  const variants = {
    primary: 'bg-accent text-white hover:brightness-110',
    secondary: 'bg-fill text-accent hover:bg-fill-2',
    plain: 'text-accent hover:opacity-70 px-2',
  }[variant];
  return (
    <button className={`${base} ${sizes} ${variants} ${className}`} {...rest}>
      {icon}
      {children}
    </button>
  );
}

export function IconButton({ label, children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`glass inline-flex h-10 w-10 items-center justify-center rounded-full text-ink transition active:scale-95 hover:bg-surface-strong ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[24px] bg-bg-elevated shadow-[var(--shadow-card)] ring-[0.5px] ring-hairline ${className}`}>{children}</div>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 px-4 text-[13px] font-medium uppercase tracking-[0.04em] text-ink-2">{children}</h2>;
}

export function Row({ children, last = false, className = '' }: { children: ReactNode; last?: boolean; className?: string }) {
  return (
    <div className={`relative flex min-h-[56px] items-center gap-3 px-4 py-3 ${className}`}>
      {children}
      {!last && <span className="pointer-events-none absolute bottom-0 left-4 right-0 h-px bg-hairline" />}
    </div>
  );
}

export function TopBar({ title, onBack, right, transparent = false }: { title?: string; onBack?: () => void; right?: ReactNode; transparent?: boolean }) {
  return (
    <header className={`safe-top safe-x sticky top-0 z-30 ${transparent ? '' : 'bg-bg/70 backdrop-blur-xl'}`}>
      <div className="mx-auto flex h-12 max-w-3xl items-center justify-between gap-2">
        <div className="flex min-w-[88px] items-center">
          {onBack && (
            <button onClick={onBack} className="-ml-2 flex items-center gap-0.5 rounded-full px-2 py-1 text-[17px] text-accent active:opacity-60">
              <ChevronLeft size={24} strokeWidth={2.2} />
              <span>Back</span>
            </button>
          )}
        </div>
        {title && <h1 className="truncate text-[17px] font-semibold tracking-[-0.02em]">{title}</h1>}
        <div className="flex min-w-[88px] items-center justify-end gap-2">{right}</div>
      </div>
    </header>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-300 ${checked ? 'bg-sys-green' : 'bg-fill-2'}`}
    >
      <motion.span
        layout
        transition={spring}
        className="absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)]"
        style={{ left: checked ? 22 : 2 }}
      />
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="relative flex w-full rounded-[10px] bg-fill p-[2px]">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`relative z-10 h-8 flex-1 rounded-[8px] text-[13px] font-medium transition-colors ${on ? 'text-ink' : 'text-ink-2'}`}
          >
            {on && (
              <motion.span
                layoutId={`seg-${label}`}
                transition={spring}
                className="absolute inset-0 -z-10 rounded-[8px] bg-bg-elevated shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)] dark:bg-[#636366]"
              />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`min-h-full ${className}`}
    >
      {children}
    </motion.main>
  );
}
