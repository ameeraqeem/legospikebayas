import { Cog, Eye, Hand, Radar, RefreshCw, RotateCcw, Sparkles } from 'lucide-react';
import { Button, Card, Row, SectionLabel, Toggle } from '../components/ui';
import { CopyButton } from '../components/common';
import { DEFAULT_SETTINGS, PORT_LETTERS, autoAssign, type ForceAction, type PortLetter, type Role } from '../lib/settings';
import { hapticsSupported } from '../lib/feedback';
import { useRobot } from '../state/robot';
import { LinksSection } from '../components/LinksSection';
import hubProgram from '../hub/robot_control.py?raw';

const ROLE_META: Record<Role, { label: string; tone: string }> = {
  L: { label: 'Roda kiri', tone: 'bg-k-green text-white' },
  R: { label: 'Roda kanan', tone: 'bg-k-blue text-white' },
  X: { label: 'Aksesori', tone: 'bg-k-purple text-white' },
  C: { label: 'Sensor warna', tone: 'bg-k-yellow text-ink' },
  U: { label: 'Sensor jarak', tone: 'bg-k-orange text-white' },
  F: { label: 'Sensor tekan', tone: 'bg-k-red text-white' },
  N: { label: 'Tiada', tone: 'bg-fill-2 text-ink-2' },
};

function PortCard({ p }: { p: PortLetter }) {
  const r = useRobot();
  const s = r.settings;
  const found = r.detected?.[p];
  const role = s.roles[p];
  const choices: Role[] =
    found === 'color' ? ['C', 'N'] : found === 'ultra' ? ['U', 'N'] : found === 'force' ? ['F', 'N'] : found === 'motor' ? ['L', 'R', 'X', 'N'] : ['L', 'R', 'X', 'C', 'U', 'F', 'N'];
  const isMotorRole = role === 'L' || role === 'R' || role === 'X';
  const mismatch =
    r.detected &&
    ((isMotorRole && found !== 'motor') || (role === 'C' && found !== 'color') || (role === 'U' && found !== 'ultra') || (role === 'F' && found !== 'force'));
  const err = r.hubErrors.some((e) => e.startsWith(`${p} `));

  const setRole = (nr: Role) => r.update({ autoPorts: false, roles: { ...s.roles, [p]: nr } });

  return (
    <Card className={`p-3 ${mismatch || err ? 'ring-4 ring-k-red/40' : ''}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-10 w-10 place-items-center rounded-[12px] border-[3px] border-ink bg-k-sky text-[20px] font-bold">{p}</span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex items-center gap-1 text-[15px] font-semibold">
            {found === 'motor' ? <><Cog size={16} /> Motor</>
              : found === 'color' ? <><Eye size={16} /> Sensor warna</>
              : found === 'ultra' ? <><Radar size={16} /> Sensor jarak</>
              : found === 'force' ? <><Hand size={16} /> Sensor tekan</>
              : found === 'none' ? 'Kosong' : '—'}
          </div>
          <div className="text-[12px] text-ink-2">{r.detected ? 'dikesan hub' : 'sambung robot untuk kesan'}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Peranan port ${p}`}>
        {choices.map((c) => (
          <button
            key={c}
            role="radio"
            aria-checked={role === c}
            onClick={() => setRole(c)}
            className={`rounded-full border-[2.5px] px-3 py-1.5 text-[14px] font-semibold transition ${role === c ? `border-ink ${ROLE_META[c].tone}` : 'border-transparent bg-fill text-ink-2'}`}
          >
            {ROLE_META[c].label}
          </button>
        ))}
      </div>
      {isMotorRole && (
        <label className="mt-2.5 flex items-center justify-between gap-2 text-[14px]">
          <span>Pusing terbalik</span>
          <Toggle label={`Terbalikkan motor port ${p}`} checked={s.inverts[p]} onChange={(v) => r.update({ autoPorts: false, inverts: { ...s.inverts, [p]: v } })} />
        </label>
      )}
      {(mismatch || err) && <p className="mt-2 text-[12px] font-semibold text-k-red">{err ? 'Hub tidak jumpa peranti ini.' : 'Peranan tidak sepadan dengan peranti dikesan.'}</p>}
    </Card>
  );
}

export function SettingsScreen() {
  const r = useRobot();
  const s = r.settings;
  const count = (role: Role) => PORT_LETTERS.filter((p) => s.roles[p] === role).length;

  return (
    <div className="mx-auto w-full max-w-xl space-y-7">
      <LinksSection />

      <section>
        <SectionLabel>Port robot</SectionLabel>
        <Card className="mb-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[17px] font-semibold">Susun automatik</div>
              <p className="text-[13px] text-ink-2">Motor pertama = roda kiri, kedua = roda kanan, yang lain = aksesori.</p>
            </div>
            <Toggle
              label="Susun automatik"
              checked={s.autoPorts}
              onChange={(v) => {
                if (v && r.detected) r.update({ autoPorts: true, ...autoAssign(r.detected) });
                else r.update({ autoPorts: v });
              }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[13px]">
            <span className="rounded-full bg-k-green/15 px-2.5 py-1 font-semibold text-ink">Kiri: {count('L')}</span>
            <span className="rounded-full bg-k-blue/15 px-2.5 py-1 font-semibold text-ink">Kanan: {count('R')}</span>
            <span className="rounded-full bg-k-purple/15 px-2.5 py-1 font-semibold text-ink">Aksesori: {count('X')}</span>
            <span className="rounded-full bg-k-yellow/30 px-2.5 py-1 font-semibold text-ink">Warna: {count('C')}</span>
            <span className="rounded-full bg-k-orange/20 px-2.5 py-1 font-semibold text-ink">Jarak: {count('U')}</span>
            <span className="rounded-full bg-k-red/15 px-2.5 py-1 font-semibold text-ink">Tekan: {count('F')}</span>
          </div>
          {r.link === 'connected' && (
            <Button className="mt-4 w-full" tone="white" onClick={r.rescanPorts} icon={<RefreshCw size={18} />}>Kesan semula port</Button>
          )}
        </Card>
        <div className="grid grid-cols-1 gap-3">
          {PORT_LETTERS.map((p) => <PortCard key={p} p={p} />)}
        </div>
        <p className="mt-3 px-2 text-center text-[13px] leading-snug text-ink-2">
          Uji: tolak kayu kiri ke depan. Jika robot berpusing, tukar <b>Pusing terbalik</b> pada roda satu sisi. Boleh pilih lebih dari satu motor untuk setiap sisi.
        </p>
      </section>

      <section>
        <SectionLabel>Pemanduan</SectionLabel>
        <Card>
          <Row className="flex-col items-stretch gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor="turn" className="text-[17px]">Kelajuan belok</label>
              <span className="tabular text-[16px] text-ink-2">{s.turn}%</span>
            </div>
            <input id="turn" type="range" min={20} max={100} step={5} value={s.turn} onChange={(e) => r.update({ turn: Number(e.target.value) })} />
          </Row>
          <Row last className="flex-col items-stretch gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor="acc" className="text-[17px]">Kelajuan aksesori</label>
              <span className="tabular text-[16px] text-ink-2">{s.accSpeed}%</span>
            </div>
            <input id="acc" type="range" min={10} max={100} step={5} value={s.accSpeed} onChange={(e) => r.update({ accSpeed: Number(e.target.value) })} />
          </Row>
        </Card>
      </section>

      <section>
        <SectionLabel>Sensor</SectionLabel>
        <Card>
          <Row className="flex-col items-stretch gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor="obs" className="flex items-center gap-2 text-[17px]"><Radar size={18} className="text-k-orange" /> Berhenti sebelum langgar</label>
              <span className="tabular text-[16px] text-ink-2">{s.obstacleCm === 0 ? 'Mati' : `${s.obstacleCm} cm`}</span>
            </div>
            <input id="obs" type="range" min={0} max={50} step={5} value={s.obstacleCm} onChange={(e) => r.update({ obstacleCm: Number(e.target.value) })} />
            <p className="text-[12px] text-ink-3">Perlukan sensor jarak (ultrasonik). Robot tidak boleh maju jika halangan lebih dekat dari jarak ini. Undur dan belok masih boleh.</p>
          </Row>
          <Row last className="flex-col items-stretch gap-2">
            <span className="flex items-center gap-2 text-[17px]"><Hand size={18} className="text-k-red" /> Bila sensor tekan ditekan</span>
            <div className="flex gap-2" role="radiogroup" aria-label="Tindakan sensor tekan">
              {([['scan', 'IMBAS warna'], ['stop', 'Berhenti'], ['none', 'Tiada']] as [ForceAction, string][]).map(([v, l]) => (
                <button
                  key={v}
                  role="radio"
                  aria-checked={s.forceAction === v}
                  onClick={() => r.update({ forceAction: v })}
                  className={`flex-1 rounded-full border-[2.5px] py-2 text-[14px] font-semibold ${s.forceAction === v ? 'border-ink bg-k-blue text-white' : 'border-transparent bg-fill text-ink-2'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </Row>
        </Card>
      </section>

      <section>
        <SectionLabel>Bunyi</SectionLabel>
        <Card>
          <Row>
            <span className="flex-1 text-[17px]">Bunyi bila imbas</span>
            <Toggle label="Bunyi" checked={s.sound} onChange={(sound) => r.update({ sound })} />
          </Row>
          <Row last>
            <div className="flex-1">
              <div className="text-[17px]">Getaran</div>
              {!hapticsSupported() && <p className="text-[12px] text-ink-3">Tidak disokong di iPhone.</p>}
            </div>
            <Toggle label="Getaran" checked={s.haptics} onChange={(haptics) => r.update({ haptics })} />
          </Row>
        </Card>
      </section>

      <section>
        <SectionLabel>Program hub</SectionLabel>
        <Card className="p-5">
          <p className="text-[15px] leading-relaxed text-ink-2">Salin dan jalankan sekali di code.pybricks.com bila app ini dikemas kini.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <CopyButton text={hubProgram} label="Salin kod program" />
            {r.link === 'connected' && <Button tone="white" onClick={() => void r.restartProgram()} icon={<RotateCcw size={18} />}>Mula semula</Button>}
          </div>
        </Card>
      </section>

      <div className="flex justify-center pb-4">
        <Button variant="plain" icon={<Sparkles size={16} />} onClick={() => r.update({ ...structuredClone(DEFAULT_SETTINGS), links: s.links })}>
          Set semula tetapan (pautan dikekalkan)
        </Button>
      </div>
      <p className="pb-2 text-center text-[13px] font-medium text-ink-3">© 2026 ameermustaqeem · Hak cipta terpelihara</p>
    </div>
  );
}
