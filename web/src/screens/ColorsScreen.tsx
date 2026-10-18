import { AppWindow, ExternalLink, Link2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Card, Row, SectionLabel, Toggle } from '../components/ui';
import { COLORS, COLOR_ORDER, type ColorName } from '../lib/colors';
import { linkWindowOpen, openLink, prepareLinkWindow } from '../lib/linkWindow';
import { normalizeUrl } from '../lib/settings';
import { useRobot } from '../state/robot';

const NAME_MS: Record<string, string> = { red: 'Merah', blue: 'Biru', green: 'Hijau', yellow: 'Kuning', white: 'Putih', none: 'Tiada' };
const RESULT_MS: Record<string, string> = { opened: 'Pautan dibuka', blocked: 'Perlu ketik', cooldown: 'Diabaikan (baru dibuka)', none: 'Tiada pautan', disabled: 'Dimatikan' };

function LinkRow({ c, last }: { c: ColorName; last: boolean }) {
  const { settings, update } = useRobot();
  const cfg = settings.links[c];
  const [draft, setDraft] = useState(cfg.url);
  useEffect(() => setDraft(cfg.url), [cfg.url]);
  const valid = draft.trim() === '' || normalizeUrl(draft) !== null;
  const save = (patch: Partial<typeof cfg>) => update({ links: { ...settings.links, [c]: { ...cfg, ...patch } } });
  const url = normalizeUrl(draft);

  return (
    <Row last={last} className="flex-col items-stretch gap-3">
      <div className="flex items-center gap-3">
        <span className="h-7 w-7 shrink-0 rounded-full" style={{ background: COLORS[c].hex, boxShadow: `0 2px 10px ${COLORS[c].glow}` }} />
        <span className="flex-1 text-[17px] font-semibold">{NAME_MS[c]}</span>
        <Toggle label={`Pautan ${NAME_MS[c]} aktif`} checked={cfg.enabled} onChange={(enabled) => save({ enabled })} />
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link2 size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="url"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="https://contoh.com/…"
            aria-label={`Pautan untuk warna ${NAME_MS[c]}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => valid && save({ url: draft.trim() })}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className={`h-11 w-full rounded-[12px] bg-fill pl-9 pr-3 text-[15px] text-ink outline-none placeholder:text-ink-3 focus:ring-2 ${valid ? 'focus:ring-accent/50' : 'ring-2 ring-sys-red/60'}`}
          />
        </div>
        <button
          disabled={!url}
          onClick={() => url && openLink(url, true)}
          className="inline-flex h-11 items-center gap-1.5 rounded-[12px] bg-fill px-3.5 text-[14px] font-semibold text-accent disabled:opacity-40"
        >
          <ExternalLink size={16} /> Uji
        </button>
      </div>
      {!valid && <p className="-mt-1 text-[12px] text-sys-red">Pautan tidak sah. Contoh: https://youtube.com/watch?v=…</p>}
    </Row>
  );
}

export function ColorsScreen() {
  const r = useRobot();
  const s = r.settings;
  const [winOpen, setWinOpen] = useState(linkWindowOpen());
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setWinOpen(linkWindowOpen()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-7">
      <section>
        <SectionLabel>Tetingkap pautan</SectionLabel>
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-[12px] ${winOpen ? 'bg-sys-green/15 text-sys-green' : 'bg-fill text-ink-2'}`}>
              <AppWindow size={22} />
            </div>
            <div className="flex-1">
              <div className="text-[16px] font-semibold">{winOpen ? 'Tetingkap pautan terbuka' : 'Tetingkap pautan belum dibuka'}</div>
              <p className="mt-0.5 text-[13px] leading-snug text-ink-2">
                Buka sekali sebelum mula. Bila robot imbas warna, pautan dibuka di tetingkap itu dan app kawalan ini kekal bersambung.
              </p>
            </div>
          </div>
          <Button
            className="mt-4 w-full"
            variant={winOpen ? 'secondary' : 'primary'}
            onClick={() => {
              const ok = prepareLinkWindow();
              setBlocked(!ok);
              setWinOpen(ok);
            }}
            icon={<AppWindow size={18} />}
          >
            {winOpen ? 'Buka semula tetingkap pautan' : 'Buka tetingkap pautan'}
          </Button>
          {blocked && <p className="mt-2 text-[13px] text-sys-red">Pelayar menyekat tetingkap baharu. Benarkan pop-up untuk laman ini, kemudian cuba lagi.</p>}
          <p className="mt-3 text-[12px] leading-snug text-ink-3">
            Jika tetingkap ditutup, app akan papar butang “Buka pautan” setiap kali warna dikesan.
          </p>
        </Card>
      </section>

      <section>
        <SectionLabel>Pautan bagi setiap warna</SectionLabel>
        <Card>
          {COLOR_ORDER.map((c, i) => (
            <LinkRow key={c} c={c} last={i === COLOR_ORDER.length - 1} />
          ))}
        </Card>
      </section>

      <section>
        <SectionLabel>Tingkah laku imbasan</SectionLabel>
        <Card>
          <Row className="flex-col items-stretch gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor="cool" className="text-[16px]">Jarak masa ulang</label>
              <span className="tabular text-[15px] text-ink-2">{s.linkCooldownSec === 0 ? 'Tiada' : `${s.linkCooldownSec} s`}</span>
            </div>
            <input id="cool" type="range" min={0} max={30} step={1} value={s.linkCooldownSec} onChange={(e) => r.update({ linkCooldownSec: Number(e.target.value) })} />
            <p className="text-[12px] text-ink-3">Warna yang sama tidak membuka pautan semula dalam tempoh ini.</p>
          </Row>
          <Row last>
            <div className="flex-1">
              <div className="text-[16px]">Berhenti bila warna dikesan</div>
              <p className="text-[12px] text-ink-3">Robot berhenti sebaik sahaja mengimbas Merah/Biru/Hijau/Kuning.</p>
            </div>
            <Toggle label="Berhenti bila warna dikesan" checked={s.stopOnColor} onChange={(stopOnColor) => r.update({ stopOnColor })} />
          </Row>
        </Card>
      </section>

      <section>
        <SectionLabel>Sejarah imbasan</SectionLabel>
        <Card>
          {r.scans.length === 0 ? (
            <p className="p-5 text-center text-[14px] text-ink-3">Belum ada imbasan.</p>
          ) : (
            r.scans.map((e, i) => (
              <Row key={e.id} last={i === r.scans.length - 1}>
                <span className="h-3.5 w-3.5 shrink-0 rounded-full ring-[0.5px] ring-hairline" style={{ background: (COLORS as Record<string, { hex: string }>)[e.color]?.hex ?? 'var(--fill-2)' }} />
                <span className="flex-1 text-[15px]">{NAME_MS[e.color] ?? e.color}</span>
                <span className={`text-[13px] ${e.link === 'opened' ? 'text-sys-green' : 'text-ink-2'}`}>{RESULT_MS[e.link]}</span>
                <span className="tabular w-[68px] shrink-0 text-right text-[12px] text-ink-3">{new Date(e.at).toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span>
              </Row>
            ))
          )}
        </Card>
      </section>
    </div>
  );
}
