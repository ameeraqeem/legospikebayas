import { motion } from 'motion/react';
import { Bluetooth, BluetoothOff, Cpu, ExternalLink, Gamepad2, Play, RotateCcw, Smartphone, TriangleAlert, Unplug } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button, Card, Row, SectionLabel } from '../components/ui';
import { batteryPct, CopyButton, LinkPill, PROGRAM_LABEL } from '../components/common';
import { bluetoothSupported } from '../lib/pybricks';
import { useRobot } from '../state/robot';
import hubProgram from '../hub/robot_control.py?raw';

function InfoRow({ k, v, warn, last }: { k: string; v: ReactNode; warn?: boolean; last?: boolean }) {
  return (
    <Row last={last}>
      <span className="flex-1 text-[15px]">{k}</span>
      <span className={`truncate text-right text-[15px] ${warn ? 'font-medium text-sys-red' : 'text-ink-2'}`}>{v}</span>
    </Row>
  );
}

export function RobotScreen() {
  const r = useRobot();
  const s = r.settings;
  const supported = bluetoothSupported();
  const connected = r.link === 'connected';
  const busy = r.link === 'connecting' || r.link === 'reconnecting';
  const err = (needle: string) => r.hubErrors.some((e) => e === needle);

  if (!supported) return <Unsupported />;

  return (
    <div className="space-y-7">
      {/* hero */}
      <Card className="overflow-hidden">
        <div className="flex flex-col items-center px-6 pb-6 pt-8 text-center">
          <motion.div
            className={`relative mb-5 grid h-24 w-24 place-items-center rounded-[28px] ${connected ? 'bg-gradient-to-b from-[#ffd60a] to-[#ffb800] shadow-[0_10px_30px_rgba(255,184,0,0.35)]' : 'bg-fill'}`}
            animate={busy ? { scale: [1, 1.05, 1] } : { scale: 1 }}
            transition={{ repeat: busy ? Infinity : 0, duration: 1.4 }}
          >
            {connected ? (
              <div className="grid h-12 w-12 grid-cols-5 gap-[2px] rounded-[8px] bg-[#1d1d1f] p-[6px]">
                {Array.from({ length: 25 }).map((_, i) => (
                  <span key={i} className={`rounded-[1px] ${[6, 8, 16, 17, 18, 15, 19].includes(i) ? 'bg-white' : 'bg-white/15'}`} />
                ))}
              </div>
            ) : (
              <Bluetooth size={40} className={busy ? 'text-sys-orange' : 'text-ink-2'} />
            )}
          </motion.div>
          <div className="text-[13px] font-medium uppercase tracking-[0.08em] text-ink-2">LEGO® SPIKE™ Prime · Pybricks</div>
          <h2 className="mt-1 text-[26px] font-bold tracking-[-0.025em]">{r.info?.name ?? 'Robot'}</h2>
          <div className="mt-1.5">
            <LinkPill state={r.link} />
          </div>
          {r.linkError && <p className="mt-3 max-w-sm text-[14px] text-sys-red">{r.linkError}</p>}

          <div className="mt-6 flex w-full flex-col items-center gap-2">
            {!connected && r.link !== 'disconnected' && (
              <Button size="lg" onClick={() => void r.connect()} disabled={busy} icon={<Bluetooth size={20} />}>
                {busy ? 'Menyambung…' : 'Sambung Robot'}
              </Button>
            )}
            {r.link === 'disconnected' && (
              <>
                <Button size="lg" onClick={() => void r.reconnect()} icon={<RotateCcw size={20} />}>Sambung semula</Button>
                <Button variant="plain" onClick={() => void r.connect()}>Pilih hub lain</Button>
              </>
            )}
            {connected && r.program === 'ready' && (
              <Button size="lg" onClick={() => r.setTab('control')} icon={<Gamepad2 size={20} />}>Pergi ke Kawalan</Button>
            )}
            {connected && r.program === 'stopped' && (
              <Button size="lg" onClick={() => void r.startProgram()} icon={<Play size={20} />}>Mula program</Button>
            )}
            {connected && (
              <Button variant="plain" onClick={r.disconnect} icon={<Unplug size={16} />}>Putuskan sambungan</Button>
            )}
          </div>
        </div>
      </Card>

      {!connected && r.link === 'idle' && (
        <section>
          <SectionLabel>Sebelum menyambung</SectionLabel>
          <Card className="p-5 text-[15px] leading-relaxed text-ink-2">
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Hidupkan hub (firmware <b className="text-ink">Pybricks</b>).</li>
              <li>Pastikan program kawalan sudah dipasang sekali (lihat Panduan di bawah).</li>
              <li>Tekan <b className="text-ink">Sambung Robot</b> dan pilih <i>Pybricks Hub</i> dalam senarai.</li>
            </ol>
          </Card>
        </section>
      )}

      {connected && (
        <section>
          <SectionLabel>Status robot</SectionLabel>
          <Card>
            <InfoRow k="Program kawalan" v={PROGRAM_LABEL[r.program]} warn={r.program === 'missing' || r.program === 'stopped'} />
            <InfoRow
              k="Bateri"
              v={r.batteryMv ? `${(r.batteryMv / 1000).toFixed(2)} V · ~${batteryPct(r.batteryMv)}%` : '—'}
              warn={r.batteryLow || (r.batteryMv !== null && batteryPct(r.batteryMv) < 15)}
            />
            <InfoRow k={`Motor kiri · Port ${s.leftPort}`} v={err(`motor ${s.leftPort}`) ? 'Tidak dikesan' : r.program === 'ready' ? 'OK' : '—'} warn={err(`motor ${s.leftPort}`)} />
            <InfoRow k={`Motor kanan · Port ${s.rightPort}`} v={err(`motor ${s.rightPort}`) ? 'Tidak dikesan' : r.program === 'ready' ? 'OK' : '—'} warn={err(`motor ${s.rightPort}`)} />
            <InfoRow k={`Sensor warna · Port ${s.colorPort}`} v={err(`sensor ${s.colorPort}`) ? 'Tidak dikesan' : r.program === 'ready' ? (r.color ? `OK · ${r.color}` : 'OK') : '—'} warn={err(`sensor ${s.colorPort}`)} />
            <InfoRow k="Firmware" v={r.info?.firmware ? `Pybricks ${r.info.firmware}` : '—'} />
            <InfoRow k="Protokol" v={r.info?.protocol ?? '—'} last />
          </Card>
          {r.hubErrors.includes('port bertindih') && <p className="mt-2 px-4 text-[13px] text-sys-red">Port motor dan sensor tidak boleh sama. Betulkan di Tetapan.</p>}
          {r.hubErrors.some((e) => e.startsWith('motor') || e.startsWith('sensor')) && (
            <p className="mt-2 px-4 text-[13px] text-ink-2">Semak kabel, atau tukar port di <button className="text-accent" onClick={() => r.setTab('settings')}>Tetapan</button>.</p>
          )}
        </section>
      )}

      {(r.program === 'missing' || !connected) && <InstallGuide highlight={r.program === 'missing'} onRetry={connected ? () => void r.restartProgram() : undefined} />}
    </div>
  );
}

function InstallGuide({ highlight, onRetry }: { highlight: boolean; onRetry?: () => void }) {
  return (
    <section>
      <SectionLabel>Panduan pemasangan (sekali sahaja)</SectionLabel>
      <Card className={`p-5 ${highlight ? 'ring-2 ring-sys-orange/60' : ''}`}>
        {highlight && (
          <div className="mb-4 flex gap-2.5 rounded-[14px] bg-sys-orange/10 p-3 text-[14px] text-ink">
            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-sys-orange" />
            <span>Hub bersambung, tetapi program kawalan tidak menjawab. Pasang program di bawah, atau hentikan program lain yang sedang berjalan.</span>
          </div>
        )}
        <ol className="space-y-4 text-[15px] leading-relaxed">
          <Step n={1} title="Pasang firmware Pybricks">
            Di MacBook, buka <b>code.pybricks.com</b> dalam Chrome → ikon ⚙︎ → <i>Install Pybricks Firmware</i> → ikut arahan (sambung hub dengan kabel USB). Firmware LEGO boleh dipulihkan bila-bila masa melalui app SPIKE.
          </Step>
          <Step n={2} title="Pasang program kawalan">
            Salin kod di bawah → di code.pybricks.com buat fail baharu → tampal → sambung hub (Bluetooth) → tekan <b>Run ▶</b>. Program disimpan dalam hub.
          </Step>
          <Step n={3} title="Putuskan dari komputer">
            Tekan butang <b>Disconnect</b> di code.pybricks.com. Hub hanya boleh bersambung dengan satu peranti pada satu masa.
          </Step>
        </ol>
        <div className="mt-5 flex flex-wrap gap-2">
          <CopyButton text={hubProgram} label="Salin kod program" />
          <a href="https://code.pybricks.com" target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full bg-fill px-5 text-[15px] font-semibold text-accent">
            <ExternalLink size={18} /> code.pybricks.com
          </a>
          {onRetry && (
            <Button variant="secondary" onClick={onRetry} icon={<RotateCcw size={18} />}>Cuba mula program</Button>
          )}
        </div>
      </Card>
    </section>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-[14px] font-semibold text-white">{n}</span>
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
    <div className="space-y-6">
      <Card className="p-6 text-center">
        <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-[24px] bg-fill">
          <BluetoothOff size={36} className="text-ink-2" />
        </div>
        <h2 className="text-[24px] font-bold tracking-[-0.02em]">Bluetooth tidak tersedia di sini</h2>
        <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-ink-2">
          {insecure
            ? 'Bluetooth hanya berfungsi pada alamat HTTPS. Buka app ini melalui pautan https (cth. GitHub Pages / Vercel).'
            : isIOS
              ? 'Safari dan Chrome di iPhone/iPad tidak menyokong Web Bluetooth. Gunakan pelayar percuma Bluefy.'
              : 'Pelayar ini tidak menyokong Web Bluetooth. Gunakan Chrome atau Edge.'}
        </p>
      </Card>
      {isIOS && !insecure && (
        <section>
          <SectionLabel>Cara buka di iPhone / iPad</SectionLabel>
          <Card className="p-5">
            <ol className="space-y-4 text-[15px] leading-relaxed">
              <Step n={1} title="Pasang Bluefy">Cari <b>“Bluefy – Web BLE Browser”</b> di App Store (percuma).</Step>
              <Step n={2} title="Buka pautan ini dalam Bluefy">Salin pautan di bawah, tampal di bar alamat Bluefy.</Step>
              <Step n={3} title="Benarkan Bluetooth">Bila diminta, benarkan Bluefy menggunakan Bluetooth.</Step>
            </ol>
            <div className="mt-5 flex flex-wrap gap-2">
              <CopyButton text={location.href.split('#')[0]} label="Salin pautan app" />
              <a href="https://apps.apple.com/app/id1492822055" className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-[15px] font-semibold text-white">
                <Smartphone size={18} /> App Store
              </a>
            </div>
          </Card>
        </section>
      )}
      <p className="flex items-center justify-center gap-1.5 text-[12px] text-ink-3">
        <Cpu size={12} /> Hub: LEGO SPIKE Prime dengan firmware Pybricks
      </p>
    </div>
  );
}
