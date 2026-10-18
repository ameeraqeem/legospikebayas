import { AnimatePresence, motion } from 'motion/react';
import { Check, ExternalLink, Link2Off, X } from 'lucide-react';
import { Mascot } from './Mascot';
import { Button } from './ui';
import { COLORS, colorLabel, isColorName } from '../lib/colors';
import { useRobot } from '../state/robot';

export function ScanResultSheet() {
  const r = useRobot();
  const res = r.result;
  const c = res && isColorName(res.color) ? res.color : null;
  const bg = c ? COLORS[c].hex : '#dde7fb';
  const darkText = !c || COLORS[c].dark;

  const title = !res ? '' : c ? `${COLORS[c].ms.toUpperCase()}!` : colorLabel(res.color);
  const sub = !res || c ? '' :
    res.color === 'none' ? 'Dekatkan sensor pada kad warna, kemudian imbas semula.' :
    res.color === 'nosensor' ? 'Tetapkan port Sensor warna di Tetapan.' : 'Semak sambungan Bluetooth.';

  return (
    <AnimatePresence>
      {res && (
        <motion.div key={res.id} className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={r.closeResult}>
          <motion.div
            role="dialog"
            aria-label={`Hasil imbasan: ${title}`}
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.6, rotate: -4 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 18 }}
            className="k-card relative w-full max-w-sm overflow-hidden p-0"
          >
            <div className="relative flex flex-col items-center px-6 pb-6 pt-8 text-center" style={{ background: bg }}>
              <button onClick={r.closeResult} aria-label="Tutup" className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full border-[3px] border-ink bg-white text-ink">
                <X size={20} strokeWidth={3} />
              </button>
              <Mascot mood={c ? 'wow' : 'think'} size={110} color={c && c !== 'white' ? '#ffffff' : '#4F7CFF'} className="anim-wiggle" />
              <div className={`mt-3 text-[38px] font-bold leading-none tracking-[0.02em] ${darkText ? 'text-ink' : 'text-white [text-shadow:0_3px_0_rgba(35,48,90,0.35)]'}`}>{title}</div>
            </div>
            <div className="flex flex-col items-center gap-3 p-5 text-center">
              {c && res.url && res.opened && (
                <div className="flex items-center gap-2 text-[17px] font-semibold text-k-green"><Check size={22} strokeWidth={3} /> Pautan dibuka</div>
              )}
              {c && res.url && !res.opened && <Button size="lg" tone="blue" onClick={r.openResultLink} icon={<ExternalLink size={22} />}>Buka pautan</Button>}
              {c && res.url && res.opened && <Button variant="plain" onClick={r.openResultLink} icon={<ExternalLink size={16} />}>Buka sekali lagi</Button>}
              {c && !res.url && (
                <>
                  <div className="flex items-center gap-2 text-[16px] text-ink-2"><Link2Off size={20} /> Belum ada pautan untuk warna ini</div>
                  <Button tone="white" onClick={() => { r.closeResult(); r.setTab('settings'); }}>Tetapkan di Tetapan</Button>
                </>
              )}
              {sub && <p className="text-[16px] text-ink-2">{sub}</p>}
              <Button variant="plain" onClick={r.closeResult}>Teruskan memandu</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
