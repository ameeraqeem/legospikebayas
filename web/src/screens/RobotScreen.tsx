import { motion } from 'motion/react';
import { Bluetooth, ExternalLink, Gamepad2, Play, RotateCcw, Smartphone, TriangleAlert, Unplug } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button, Card, Row, SectionLabel } from '../components/ui';
import { batteryPct, CopyButton, LinkPill, PROGRAM_LABEL } from '../components/common';
import { Mascot, type Mood } from '../components/Mascot';
import { bluetoothSupported } from '../lib/pybricks';
import { PORT_LETTERS, ROBOT_TYPES, motorRolesFor, roleName } from '../lib/settings';
import { LATEST_HUB_VERSION, MIN_HUB_VERSION, useRobot } from '../state/robot';
import hubProgram from '../hub/robot_control.py?raw';

function InfoRow({ k, v, warn, last }: { k: string; v: ReactNode; warn?: boolean; last?: boolean }) {
  return (
    <Row last={last}>
      <span className="flex-1 text-[16px]">{k}</span>
      <span className={`truncate text-right text-[16px] ${warn ? 'font-semibold text-k-red' : 'text-ink-2'}`}>{v}</span>
    </Row>
  );
}

export function RobotScreen() {
  const r = useRobot();
  const s = r.settings;
  if (!bluetoothSupported()) return <Unsupported />;

  const connected = r.link === 'connected';
  const busy = r.link === 'connecting' || r.link === 'reconnecting' || r.program === 'checking' || r.program === 'starting';
  const mood: Mood = connected && r.program === 'ready' ? 'happy' : busy ? 'think' : r.link === 'error' || r.program === 'missing' || r.program === 'old' ? 'sad' : 'sleep';
  const n = (role: string) => PORT_LETTERS.filter((p) => s.roles[p] === role);
  const portErrors = Array.from(new Set(r.hubErrors.map((e) => e.split(' ')[0]).filter((x) => /^[A-F]$/.test(x))));
  const portList = (role: string) => (n(role).length ? n(role).join(', ') : 'tiada');

  return (
    <div className="mx-auto w-full max-w-xl space-y-7">
      <Card className="overflow-hidden p-0">
        <div className="flex flex-col items-center bg-k-sky/40 px-6 pb-6 pt-7 text-center">
          <motion.div animate={busy ? { rotate: [0, -5, 5, 0] } : {}} transition={{ repeat: busy ? Infinity : 0, duration: 1.2 }} className={connected ? 'anim-bob' : ''}>
            <Mascot mood={mood} size={128} />
          </motion.div>
          <h2 className="mt-2 text-[28px] font-bold leading-tight">{connected ? r.info?.name ?? 'Robot' : 'Hai! Jom sambung robot'}</h2>
          <div className="mt-1"><LinkPill state={r.link} /></div>
          {r.linkError && <p className="mt-2 max-w-sm text-[15px] font-semibold text-k-red">{r.linkError}</p>}

          <div className="mt-5 flex w-full flex-col items-center gap-2">
            {!connected && r.link !== 'disconnected' && (
              <Button size="lg" tone="blue" onClick={() => void r.connect()} disabled={busy} icon={<Bluetooth size={24} />}>
                {busy ? 'Menyambung…' : 'Sambung Robot'}
              </Button>
            )}
            {r.link === 'disconnected' && (
              <>
                <Button size="lg" tone="blue" onClick={() => void r.reconnect()} icon={<RotateCcw size={22} />}>Sambung semula</Button>
                <Button variant="plain" onClick={() => void r.connect()}>Pilih robot lain</Button>
              </>
            )}
            {connected && r.program === 'ready' && (
              <Button size="lg" tone="green" onClick={() => r.setTab('control')} icon={<Gamepad2 size={24} />}>Jom Pandu!</Button>
            )}
            {connected && r.program === 'stopped' && (
              <Button size="lg" tone="yellow" onClick={() => void r.startProgram()} icon={<Play size={22} />}>Mula program</Button>
            )}
            {connected && <Button variant="plain" onClick={r.disconnect} icon={<Unplug size={16} />}>Putuskan sambungan</Button>}
          </div>
        </div>
      </Card>

      {connected && r.program === 'ready' && r.hubVersion !== null && r.hubVersion < LATEST_HUB_VERSION && (
        <Card className="flex flex-col items-center gap-2 bg-k-yellow/40 p-4 text-center">
          <div className="text-[16px] font-semibold">Program hub v{r.hubVersion} — boleh digunakan</div>
          <p className="text-[14px] leading-snug text-ink-2">Kemas kini ke v{LATEST_HUB_VERSION} untuk mengenal pasti 10 warna. Salin kod di bawah dan jalankan sekali di code.pybricks.com.</p>
          <CopyButton text={hubProgram} label={`Salin kod v${LATEST_HUB_VERSION}`} />
        </Card>
      )}

      {connected && (
        <section>
          <SectionLabel>Status robot</SectionLabel>
          <Card>
            <InfoRow k="Program" v={`${PROGRAM_LABEL[r.program]}${r.hubVersion ? ` · v${r.hubVersion}` : ''}`} warn={r.program === 'missing' || r.program === 'stopped' || r.program === 'old'} />
            <InfoRow k="Bateri" v={r.batteryMv ? `${batteryPct(r.batteryMv)}% · ${(r.batteryMv / 1000).toFixed(2)} V` : '—'} warn={r.batteryLow || (r.batteryMv !== null && batteryPct(r.batteryMv) < 15)} />
            <InfoRow k="Jenis robot" v={ROBOT_TYPES.find((t) => t.id === r.settings.robotType)?.name ?? ''} />
            {motorRolesFor(r.settings.robotType).map((m) => (
              <InfoRow key={m} k={roleName(m, r.settings.robotType)} v={`Port ${portList(m)}`} warn={m !== 'X' && !n(m).length} />
            ))}
            <InfoRow k="Sensor warna" v={`Port ${portList('C')}`} />
            <InfoRow k="Sensor jarak" v={`Port ${portList('U')}${r.distanceMm !== null && n('U').length ? ` · ${r.distanceMm >= 2000 ? 'jauh' : `${Math.round(r.distanceMm / 10)} cm`}` : ''}`} />
            <InfoRow k="Sensor tekan" v={`Port ${portList('F')}${n('F').length ? (r.forcePressed ? ' · ditekan' : '') : ''}`} last />
          </Card>
          {portErrors.length > 0 && (
            <p className="mt-2 px-3 text-[14px] font-semibold text-k-red">
              Hub tidak dapat membuka peranti di port {portErrors.join(', ')}. Semak kabel atau <button className="underline" onClick={() => r.setTab('settings')}>Tetapan</button>.
            </p>
          )}
          {r.batteryMv !== null && batteryPct(r.batteryMv) < 15 && <p className="mt-2 px-3 text-[14px] font-semibold text-k-red">Bateri rendah — caskan hub dengan kabel USB.</p>}
        </section>
      )}

      {!connected && (r.link === 'error' || r.link === 'disconnected' || !!r.linkError) && <ConnectHelp />}

      {(!connected || r.program === 'missing' || r.program === 'old') && (
        <InstallGuide version={r.hubVersion} highlight={r.program === 'missing' || r.program === 'old'} old={r.program === 'old'} onRetry={connected ? () => void r.restartProgram() : undefined} />
      )}
      <p className="pb-2 text-center text-[13px] font-medium text-ink-3">© 2026 ameermustaqeem · Hak cipta terpelihara</p>
    </div>
  );
}

function InstallGuide({ highlight, old, onRetry, version }: { highlight: boolean; old: boolean; onRetry?: () => void; version?: number | null }) {
  return (
    <section>
      <SectionLabel>Panduan guru (sekali sahaja)</SectionLabel>
      <Card className={`p-5 ${highlight ? 'ring-4 ring-k-orange/50' : ''}`}>
        {highlight && (
          <div className="mb-4 flex gap-2.5 rounded-[16px] border-[3px] border-ink bg-k-orange/20 p-3 text-[15px]">
            <TriangleAlert size={20} className="mt-0.5 shrink-0" />
            <span>{old ? `Program dalam hub terlalu lama (v${version ?? 1}). App ini perlukan sekurang-kurangnya v${MIN_HUB_VERSION}. Salin kod v${LATEST_HUB_VERSION} di bawah, tampal di code.pybricks.com, tekan Run, kemudian Disconnect.` : 'Robot bersambung tetapi program tidak menjawab. Pasang program di bawah.'}</span>
          </div>
        )}
        <ol className="space-y-4 text-[16px] leading-relaxed">
          <Step n={1} title="Firmware Pybricks">Di Mac (Chrome): code.pybricks.com → ⚙︎ → Install Pybricks Firmware.</Step>
          <Step n={2} title="Pasang program">Salin kod → tampal di code.pybricks.com → sambung hub → Run ▶.</Step>
          <Step n={3} title="Putuskan dari Mac">Tekan Disconnect, kemudian sambung dari app ini.</Step>
        </ol>
        <div className="mt-5 flex flex-wrap gap-2">
          <CopyButton text={hubProgram} label="Salin kod program" />
          <a href="https://code.pybricks.com" target="_blank" rel="noreferrer" className="k-btn inline-flex h-12 items-center gap-2 rounded-full bg-white px-5 text-[16px] font-semibold">
            <ExternalLink size={18} /> code.pybricks.com
          </a>
          {onRetry && <Button tone="yellow" onClick={onRetry} icon={<RotateCcw size={18} />}>Cuba lagi</Button>}
        </div>
      </Card>
    </section>
  );
}

function ConnectHelp() {
  const items: [string, string][] = [
    ['Putuskan dari Mac', 'Hub hanya boleh bersambung dengan SATU peranti. Tekan Disconnect di code.pybricks.com, atau tutup tab itu.'],
    ['Hidupkan hub semula', 'Tekan butang tengah hub sehingga lampu menyala. Hub yang lama tidak digunakan akan mati sendiri.'],
    ['Cas bateri', 'Bateri rendah menyebabkan Bluetooth tidak stabil. Caskan dengan kabel USB.'],
    ['Dekatkan iPhone', 'Letak iPhone dalam jarak 1–2 meter dari hub semasa menyambung.'],
    ['Bluetooth iPhone hidup', 'Settings → Bluetooth: ON. Jangan pair hub dalam Settings iPhone — sambung melalui app ini sahaja.'],
    ['Tutup app lain', 'Tutup app LEGO SPIKE atau app robot lain yang mungkin sedang bersambung dengan hub.'],
    ['Muat semula Bluefy', 'Tarik halaman ke bawah untuk muat semula, kemudian tekan Sambung Robot sekali lagi.'],
  ];
  return (
    <section>
      <SectionLabel>Tak dapat sambung? Semak ini</SectionLabel>
      <Card className="p-5">
        <ol className="space-y-3.5 text-[15px] leading-snug">
          {items.map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-[3px] border-ink bg-k-sky text-[13px] font-bold">{i + 1}</span>
              <div className="min-w-0">
                <div className="font-semibold">{t}</div>
                <div className="text-ink-2">{d}</div>
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </section>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-[3px] border-ink bg-k-yellow text-[15px] font-bold">{n}</span>
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-ink-2">{children}</div>
      </div>
    </li>
  );
}

function Unsupported() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const insecure = !window.isSecureContext;
  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <Card className="flex flex-col items-center p-6 text-center">
        <Mascot mood="sad" size={110} />
        <h2 className="mt-2 text-[24px] font-bold">Bluetooth tak boleh di sini</h2>
        <p className="mx-auto mt-2 max-w-md text-[16px] leading-relaxed text-ink-2">
          {insecure
            ? 'Bluetooth hanya berfungsi pada pautan https (contoh GitHub Pages).'
            : isIOS
              ? 'Safari dan Chrome di iPhone/iPad tidak menyokong Bluetooth web. Gunakan pelayar percuma Bluefy.'
              : 'Gunakan Chrome atau Edge.'}
        </p>
      </Card>
      {isIOS && !insecure && (
        <Card className="p-5">
          <ol className="space-y-4 text-[16px] leading-relaxed">
            <Step n={1} title="Pasang Bluefy">Cari “Bluefy – Web BLE Browser” di App Store.</Step>
            <Step n={2} title="Buka pautan ini dalam Bluefy">Salin pautan di bawah dan tampal di Bluefy.</Step>
            <Step n={3} title="Benarkan Bluetooth">Tekan “Allow” bila diminta.</Step>
          </ol>
          <div className="mt-5 flex flex-wrap gap-2">
            <CopyButton text={location.href.split('#')[0]} label="Salin pautan app" />
            <a href="https://apps.apple.com/app/id1492822055" className="k-btn inline-flex h-12 items-center gap-2 rounded-full bg-k-blue px-5 text-[16px] font-semibold text-white">
              <Smartphone size={18} /> App Store
            </a>
          </div>
        </Card>
      )}
    </div>
  );
}
