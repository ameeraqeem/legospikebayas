import { RotateCcw } from 'lucide-react';
import { Button, Card, Row, SectionLabel, Segmented, Toggle } from '../components/ui';
import { CopyButton, PortPicker } from '../components/common';
import { DEFAULT_SETTINGS } from '../lib/settings';
import { hapticsSupported } from '../lib/feedback';
import { useRobot } from '../state/robot';
import hubProgram from '../hub/robot_control.py?raw';

export function SettingsScreen() {
  const r = useRobot();
  const s = r.settings;
  const others = (exclude: 'leftPort' | 'rightPort' | 'colorPort') =>
    (['leftPort', 'rightPort', 'colorPort'] as const).filter((k) => k !== exclude).map((k) => s[k]);

  return (
    <div className="space-y-7">
      <section>
        <SectionLabel>Port robot</SectionLabel>
        <Card>
          <Row className="flex-col items-stretch gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[16px]">Motor kiri</span>
              <span className="text-[13px] text-ink-2">Terbalik</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <PortPicker label="Port motor kiri" value={s.leftPort} onChange={(leftPort) => r.update({ leftPort })} disabled={others('leftPort')} />
              <Toggle label="Terbalikkan motor kiri" checked={s.invertLeft} onChange={(invertLeft) => r.update({ invertLeft })} />
            </div>
          </Row>
          <Row className="flex-col items-stretch gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[16px]">Motor kanan</span>
              <span className="text-[13px] text-ink-2">Terbalik</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <PortPicker label="Port motor kanan" value={s.rightPort} onChange={(rightPort) => r.update({ rightPort })} disabled={others('rightPort')} />
              <Toggle label="Terbalikkan motor kanan" checked={s.invertRight} onChange={(invertRight) => r.update({ invertRight })} />
            </div>
          </Row>
          <Row last className="flex-col items-stretch gap-2.5">
            <span className="text-[16px]">Sensor warna</span>
            <PortPicker label="Port sensor warna" value={s.colorPort} onChange={(colorPort) => r.update({ colorPort })} disabled={others('colorPort')} />
          </Row>
        </Card>
        <p className="mt-2 px-4 text-[12px] leading-snug text-ink-3">
          Uji: tahan butang ke depan. Jika robot berpusing, hidupkan/matikan “Terbalik” pada satu motor. Jika robot ke belakang, tukar kedua-duanya.
        </p>
      </section>

      <section>
        <SectionLabel>Pemanduan</SectionLabel>
        <Card>
          <Row last className="flex-col items-stretch gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor="turn" className="text-[16px]">Kelajuan pusing</label>
              <span className="tabular text-[15px] text-ink-2">{s.turn}% daripada kelajuan</span>
            </div>
            <input id="turn" type="range" min={20} max={100} step={5} value={s.turn} onChange={(e) => r.update({ turn: Number(e.target.value) })} />
            <p className="text-[12px] text-ink-3">Kiri/kanan berpusing di tempat. Depan + kiri/kanan serentak membelok secara lengkung.</p>
          </Row>
        </Card>
      </section>

      <section>
        <SectionLabel>Paparan & maklum balas</SectionLabel>
        <Card>
          <Row className="flex-col items-stretch gap-2">
            <span className="text-[16px]">Tema</span>
            <Segmented
              label="Tema"
              value={s.appearance}
              onChange={(appearance) => r.update({ appearance })}
              options={[{ value: 'system', label: 'Sistem' }, { value: 'light', label: 'Cerah' }, { value: 'dark', label: 'Gelap' }]}
            />
          </Row>
          <Row>
            <span className="flex-1 text-[16px]">Bunyi bila warna dikesan</span>
            <Toggle label="Bunyi" checked={s.sound} onChange={(sound) => r.update({ sound })} />
          </Row>
          <Row last>
            <div className="flex-1">
              <div className="text-[16px]">Getaran</div>
              {!hapticsSupported() && <p className="text-[12px] text-ink-3">Tidak disokong oleh pelayar ini.</p>}
            </div>
            <Toggle label="Getaran" checked={s.haptics} onChange={(haptics) => r.update({ haptics })} />
          </Row>
        </Card>
      </section>

      <section>
        <SectionLabel>Program hub</SectionLabel>
        <Card className="p-5">
          <p className="text-[14px] leading-relaxed text-ink-2">
            Program Pybricks yang dipasang di hub. Kemas kini app ini? Salin semula dan jalankan sekali di code.pybricks.com.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <CopyButton text={hubProgram} label="Salin kod program" />
            {r.link === 'connected' && (
              <Button variant="secondary" onClick={() => void r.restartProgram()} icon={<RotateCcw size={18} />}>Mula semula program</Button>
            )}
          </div>
        </Card>
      </section>

      <div className="flex justify-center pb-4">
        <Button variant="plain" icon={<RotateCcw size={16} />} onClick={() => r.update({ ...structuredClone(DEFAULT_SETTINGS), links: s.links })}>
          Set semula tetapan (pautan dikekalkan)
        </Button>
      </div>
    </div>
  );
}
