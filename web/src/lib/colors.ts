/** Every colour the SPIKE Prime Color Sensor can tell apart (hub program v4). */
export type ColorName = 'red' | 'orange' | 'yellow' | 'green' | 'azure' | 'blue' | 'violet' | 'magenta' | 'white' | 'black';

export const COLOR_ORDER: ColorName[] = ['red', 'orange', 'yellow', 'green', 'azure', 'blue', 'violet', 'magenta', 'white', 'black'];

export const COLORS: Record<ColorName, { ms: string; hex: string; dark: boolean }> = {
  red: { ms: 'Merah', hex: '#FF4B4B', dark: false },
  orange: { ms: 'Oren', hex: '#FF9F43', dark: false },
  yellow: { ms: 'Kuning', hex: '#FFD23C', dark: true },
  green: { ms: 'Hijau', hex: '#2ECC71', dark: false },
  azure: { ms: 'Biru Muda', hex: '#4FC3F7', dark: true },
  blue: { ms: 'Biru', hex: '#3D6BFF', dark: false },
  violet: { ms: 'Ungu', hex: '#8E5CE6', dark: false },
  magenta: { ms: 'Merah Jambu', hex: '#F25CC1', dark: false },
  white: { ms: 'Putih', hex: '#FFFFFF', dark: true },
  black: { ms: 'Hitam', hex: '#2B2F3A', dark: false },
};

export function isColorName(v: unknown): v is ColorName {
  return typeof v === 'string' && v in COLORS;
}

export function colorLabel(v: string | null | undefined) {
  if (!v) return '—';
  if (isColorName(v)) return COLORS[v].ms;
  if (v === 'none') return 'Tiada';
  if (v === 'nosensor') return 'Tiada sensor';
  if (v === 'timeout') return 'Tiada jawapan';
  return v;
}
