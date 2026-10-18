export type ColorName = 'red' | 'blue' | 'green' | 'yellow';
export type ExperienceId = 'reactor' | 'robot' | 'puzzle' | 'finale';

export const COLOR_ORDER: ColorName[] = ['red', 'blue', 'green', 'yellow'];

export const COLORS: Record<ColorName, { label: string; hex: string; deep: string; glow: string }> = {
  red: { label: 'Red', hex: '#FF3B30', deep: '#C41E15', glow: 'rgba(255,59,48,0.35)' },
  blue: { label: 'Blue', hex: '#007AFF', deep: '#0051B8', glow: 'rgba(0,122,255,0.35)' },
  green: { label: 'Green', hex: '#34C759', deep: '#1E8E3E', glow: 'rgba(52,199,89,0.35)' },
  yellow: { label: 'Yellow', hex: '#FFCC00', deep: '#C79A00', glow: 'rgba(255,204,0,0.4)' },
};

export const EXPERIENCES: Record<ExperienceId, { name: string; headline: string; blurb: string }> = {
  reactor: { name: 'Energy Reactor', headline: 'Energy Reactor Activated', blurb: 'Concentric fields and energy particles.' },
  robot: { name: 'Robot Experience', headline: 'Robot System Online', blurb: 'A robot boots up and says hello.' },
  puzzle: { name: 'STEM Puzzle', headline: 'STEM Challenge Unlocked', blurb: 'Drag S, T, E, M into place.' },
  finale: { name: 'Grand Finale', headline: 'KARNIVAL STEM 2026', blurb: 'The cinematic closing sequence.' },
};

export const EXPERIENCE_ORDER: ExperienceId[] = ['reactor', 'robot', 'puzzle', 'finale'];

export const DEFAULT_MAPPING: Record<ColorName, ExperienceId> = {
  red: 'reactor',
  blue: 'robot',
  green: 'puzzle',
  yellow: 'finale',
};

export function isColorName(v: unknown): v is ColorName {
  return v === 'red' || v === 'blue' || v === 'green' || v === 'yellow';
}
