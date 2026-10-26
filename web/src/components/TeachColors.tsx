import { Check, GraduationCap, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Row, SectionLabel } from './ui';
import { COLORS, COLOR_ORDER, colorLabel, isColorName, type ColorName } from '../lib/colors';
import { LATEST_HUB_VERSION, useRobot } from '../state/robot';

/** HSV (0-359, 0-100, 0-100) → css colour, to show what the sensor actually saw. */
const hsvCss = ([h, s, v]: [number, number, number]) => {
  const l = (v / 100) * (1 - s / 200);
  const sl = l === 0 || l === 1 ? 0 : ((v / 100) - l) / Math.min(l, 1 - l);
  return `hsl(${h} ${Math.round(sl * 100)}% ${Math.round(l * 100)}%)`;
};

const MSG = {
  ok: 'Diajar ✓',
  nosensor: 'Tiada sensor warna',
  old: `Kemas kini program hub ke v${LATEST_HUB_VERSION}`,
  fail: 'Gagal membaca. Cuba lagi.',
} as const;

/**
 * "Ajar warna": printed colours look different from LEGO bricks, so pink may be read
 * as red or white. Put the sensor on each circle of the map and tap Ajar.
 */
export function TeachColors() {
  const r = useRobot();
  const ready = r.link === 'connected' && r.program === 'ready';
  const [busy, setBusy] = useState<ColorName | null>(null);
  const [note, setNote] = useState<{ c: ColorName; m: keyof typeof MSG } | null>(null);
  const taught = COLOR_ORDER.filter((c) => r.settings.calib[c]).length;
  const live = r.color && isColorName(r.color) ? r.color : null;

  const teach = async (c: ColorName) => {
    setBusy(c);
    const m = await r.teachColor(c);
    setBusy(null);
    setNote({ c, m });
  };

  return (
    <section>
      <SectionLabel>Ajar warna peta · {taught}/{COLOR_ORDER.length}</SectionLabel>
      <p className="mb-3 px-2 text-center text-[14px] leading-snug text-ink-2">
        Warna cetakan berbeza daripada bata LEGO. Letak sensor di atas bulatan warna pada peta (jarak ~1 cm), kemudian tekan <b>Ajar</b> pada warna itu.
      </p>

      <Card className="mb-3 flex items-center justify-center gap-3 p-3">
        <span className="text-[14px] text-ink-2">Sensor membaca sekarang:</span>
        <span className="h-6 w-6 rounded-full border-[3px] border-ink" style={{ background: live ? COLORS[live].hex : 'var(--fill)' }} />
        <span className="text-[16px] font-bold">{ready ? colorLabel(r.color) : 'robot belum sedia'}</span>
      </Card>

      <Card>
        {COLOR_ORDER.map((c, i) => {
          const v = r.settings.calib[c];
          const msg = note?.c === c ? note.m : null;
          return (
            <Row key={c} last={i === COLOR_ORDER.length - 1} className="gap-2.5">
              <span className="h-9 w-9 shrink-0 rounded-full border-[3px] border-ink" style={{ background: COLORS[c].hex }} />
              {v && <span title="Warna yang dilihat sensor" className="-ml-5 mt-5 h-5 w-5 shrink-0 rounded-full border-[2.5px] border-ink" style={{ background: hsvCss(v) }} />}
              <div className="min-w-0 flex-1 leading-tight">
                <div className="text-[16px] font-semibold">{COLORS[c].ms}</div>
                <div className={`text-[12px] ${msg && msg !== 'ok' ? 'font-semibold text-k-red' : 'text-ink-2'}`}>
                  {msg ? MSG[msg] : v ? `Diajar · H${v[0]} S${v[1]} V${v[2]}` : 'Warna asal LEGO'}
                </div>
              </div>
              <button
                type="button"
                disabled={!ready || busy !== null}
                onClick={() => void teach(c)}
                aria-label={`Ajar warna ${COLORS[c].ms}`}
                className={`k-btn flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-semibold ${v ? 'bg-k-green text-white' : 'bg-white text-ink'}`}
              >
                {busy === c ? 'Membaca…' : v ? <><Check size={15} strokeWidth={3} /> Ajar semula</> : <><GraduationCap size={16} /> Ajar</>}
              </button>
            </Row>
          );
        })}
      </Card>

      <p className="mt-3 px-2 text-center text-[13px] leading-snug text-ink-2">
        Selepas mengajar, uji dengan IMBAS pada setiap bulatan. Ajar hanya warna yang ada pada peta anda.
      </p>
      {taught > 0 && (
        <div className="mt-2 flex justify-center">
          <Button variant="plain" icon={<RotateCcw size={16} />} onClick={() => { r.resetColors(); setNote(null); }}>Guna semula warna asal LEGO</Button>
        </div>
      )}
    </section>
  );
}
