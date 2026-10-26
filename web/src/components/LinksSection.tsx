import { AppWindow, ExternalLink, Link2, MonitorPlay } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Card, Row, SectionLabel, Toggle } from './ui';
import { COLORS, COLOR_ORDER, colorLabel, isColorName, type ColorName } from '../lib/colors';
import { linkWindowOpen, prepareLinkWindow } from '../lib/linkWindow';
import { normalizeUrl } from '../lib/settings';
import { useRobot } from '../state/robot';

function LinkRow({ c, last }: { c: ColorName; last: boolean }) {
  const { settings, update, openUrl } = useRobot();
  const [draft, setDraft] = useState(settings.links[c]);
  useEffect(() => setDraft(settings.links[c]), [settings.links, c]);
  const valid = draft.trim() === '' || normalizeUrl(draft) !== null;
  const url = normalizeUrl(draft);
  const save = () => valid && update({ links: { ...settings.links, [c]: draft.trim() } });

  return (
    <Row last={last} className="gap-2.5">
      <span className="h-9 w-9 shrink-0 rounded-full border-[3px] border-ink" style={{ background: COLORS[c].hex }} title={COLORS[c].ms} />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[16px] font-semibold">{COLORS[c].ms}</span>
          {url && <span className="rounded-full bg-k-green/15 px-2 py-0.5 text-[11px] font-semibold">Ada pautan</span>}
        </div>
        <div className="relative">
          <Link2 size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="url"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="https://…"
            aria-label={`Pautan untuk warna ${COLORS[c].ms}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className={`h-11 w-full rounded-[14px] border-[3px] bg-white pl-9 pr-3 text-[15px] text-ink outline-none placeholder:text-ink-3 ${valid ? 'border-ink/15 focus:border-k-blue' : 'border-k-red'}`}
          />
        </div>
        {!valid && <p className="mt-1 text-[12px] font-semibold text-k-red">Pautan tidak sah</p>}
      </div>
      <button
        disabled={!url}
        onClick={() => url && openUrl(url, c)}
        aria-label={`Uji pautan ${COLORS[c].ms}`}
        className="k-btn mt-6 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-ink"
      >
        <ExternalLink size={18} />
      </button>
    </Row>
  );
}

export function LinksSection() {
  const r = useRobot();
  const [winOpen, setWinOpen] = useState(linkWindowOpen());
  const [blocked, setBlocked] = useState(false);
  const count = COLOR_ORDER.filter((c) => normalizeUrl(r.settings.links[c])).length;
  useEffect(() => {
    const t = setInterval(() => setWinOpen(linkWindowOpen()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <section>
        <SectionLabel>Pautan warna · {count}/{COLOR_ORDER.length}</SectionLabel>
        <p className="mb-3 px-2 text-center text-[14px] leading-snug text-ink-2">
          Bila robot imbas sesuatu warna, pautan warna itu akan dibuka. Biarkan kosong jika tidak digunakan.
        </p>
        <Card>
          {COLOR_ORDER.map((c, i) => <LinkRow key={c} c={c} last={i === COLOR_ORDER.length - 1} />)}
        </Card>
      </section>

      <section>
        <SectionLabel>Cara buka pautan</SectionLabel>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Cara buka pautan">
          {([
            { id: 'app', icon: <MonitorPlay size={24} />, name: 'Dalam app', hint: 'Disyorkan · ada butang Tutup' },
            { id: 'window', icon: <AppWindow size={24} />, name: 'Tetingkap lain', hint: 'Untuk laman yang tidak boleh dibuka dalam app' },
          ] as const).map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={r.settings.linkMode === m.id}
              onClick={() => r.update({ linkMode: m.id })}
              className={`k-card flex min-w-0 flex-col items-center gap-1 px-2 py-3 text-center ${r.settings.linkMode === m.id ? 'bg-k-yellow' : ''}`}
            >
              {m.icon}
              <span className="text-[15px] font-bold leading-tight">{m.name}</span>
              <span className="text-[12px] leading-tight text-ink-2">{m.hint}</span>
            </button>
          ))}
        </div>

        {r.settings.linkMode === 'app' ? (
          <Card className="mt-3 p-4">
            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-[16px] font-semibold">Tutup sendiri bila selesai</span>
                <span className="block text-[13px] leading-snug text-ink-2">Bila video YouTube habis atau Google Form dihantar, pautan ditutup dan robot sedia dipandu semula.</span>
              </span>
              <Toggle label="Tutup sendiri bila selesai" checked={r.settings.autoClose} onChange={(v) => r.update({ autoClose: v })} />
            </label>
          </Card>
        ) : (
          <Card className="mt-3 flex flex-col items-center p-4 text-center">
            <div className="text-[16px] font-semibold">{winOpen ? 'Tetingkap pautan terbuka ✓' : 'Buka tetingkap pautan dahulu'}</div>
            <p className="mt-1 max-w-sm text-[13px] leading-snug text-ink-2">Buka sekali sebelum mula. Setiap imbasan akan membuka pautan di tetingkap itu.</p>
            <Button className="mt-3" tone={winOpen ? 'white' : 'blue'} icon={<AppWindow size={18} />} onClick={() => { const ok = prepareLinkWindow(); setBlocked(!ok); setWinOpen(ok); }}>
              {winOpen ? 'Buka semula' : 'Buka tetingkap pautan'}
            </Button>
            {blocked && <p className="mt-2 text-[13px] font-semibold text-k-red">Pelayar menyekat tetingkap baharu. Benarkan pop-up, kemudian cuba lagi.</p>}
          </Card>
        )}
      </section>

      {r.history.length > 0 && (
        <section>
          <SectionLabel>Imbasan terkini</SectionLabel>
          <Card>
            {r.history.slice(0, 8).map((e, i, arr) => (
              <Row key={e.id} last={i === arr.length - 1}>
                <span className="h-5 w-5 shrink-0 rounded-full border-[2.5px] border-ink" style={{ background: isColorName(e.color) ? COLORS[e.color].hex : 'var(--fill)' }} />
                <span className="flex-1 text-[15px]">{colorLabel(e.color)}</span>
                <span className="text-[13px] text-ink-2">{e.opened ? 'Dibuka' : e.url ? 'Belum dibuka' : '—'}</span>
                <span className="tabular w-[64px] shrink-0 text-right text-[12px] text-ink-3">{new Date(e.at).toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span>
              </Row>
            ))}
          </Card>
        </section>
      )}
    </>
  );
}
