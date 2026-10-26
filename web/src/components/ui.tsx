import { motion } from 'motion/react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type Tone = 'blue' | 'yellow' | 'green' | 'red' | 'purple' | 'white' | 'orange';

const TONE: Record<Tone, string> = {
  blue: 'bg-k-blue text-white',
  yellow: 'bg-k-yellow text-ink',
  green: 'bg-k-green text-white',
  red: 'bg-k-red text-white',
  purple: 'bg-k-purple text-white',
  orange: 'bg-k-orange text-white',
  white: 'bg-white text-ink',
};

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  /** legacy names used across screens */
  variant?: 'primary' | 'secondary' | 'plain';
};

export function Button({ tone, variant = 'primary', size = 'md', icon, className = '', children, ...rest }: BtnProps) {
  if (variant === 'plain') {
    return (
      <button className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[16px] font-semibold text-k-blue active:opacity-60 ${className}`} {...rest}>
        {icon}
        {children}
      </button>
    );
  }
  const t = tone ?? (variant === 'secondary' ? 'white' : 'blue');
  const sz = size === 'lg' ? 'h-16 px-8 text-[21px] min-w-[220px]' : size === 'sm' ? 'h-10 px-4 text-[15px]' : 'h-12 px-5 text-[17px]';
  return (
    <button className={`k-btn inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold tracking-[0.01em] ${TONE[t]} ${sz} ${className}`} {...rest}>
      {icon}
      {children}
    </button>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`k-card ${className}`}>{children}</div>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="mb-2.5 px-2 text-center text-[15px] font-semibold uppercase tracking-[0.06em] text-ink-2">{children}</h2>;
}

export function Row({ children, last = false, className = '' }: { children: ReactNode; last?: boolean; className?: string }) {
  return (
    <div className={`relative flex min-h-[60px] items-center gap-3 px-4 py-3 ${className}`}>
      {children}
      {!last && <span className="pointer-events-none absolute bottom-0 left-4 right-4 h-[2px] rounded-full bg-hairline" />}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[34px] w-[58px] shrink-0 rounded-full border-[3px] border-ink transition-colors duration-200 ${checked ? 'bg-k-green' : 'bg-fill-2'}`}
    >
      <motion.span
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        animate={{ left: checked ? 26 : 2 }}
        className="absolute top-[2px] h-[24px] w-[24px] rounded-full border-[3px] border-ink bg-white"
      />
    </button>
  );
}
