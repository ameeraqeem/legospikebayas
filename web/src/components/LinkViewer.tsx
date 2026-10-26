import { AnimatePresence, motion } from 'motion/react';
import { ExternalLink, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { COLORS, colorLabel, isColorName } from '../lib/colors';
import { isCloseRequest, isYoutubeEnded, toEmbed } from '../lib/embed';
import { useRobot } from '../state/robot';

const CLOSE_AFTER_S = 4;

/**
 * Shows a colour link INSIDE the app (iframe), so the robot stays connected.
 * Big "Tutup" button; closes by itself when a YouTube video ends, a Google Form is
 * sent, or the teacher's own page posts 'spike-robot:close'.
 */
export function LinkViewer() {
  const r = useRobot();
  const v = r.viewer;
  const embed = useMemo(() => (v ? toEmbed(v.url) : null), [v]);
  const frame = useRef<HTMLIFrameElement>(null);
  const loads = useRef(0);
  const [done, setDone] = useState<number | null>(null); // seconds left before closing
  const autoClose = r.settings.autoClose;

  useEffect(() => {
    loads.current = 0;
    setDone(null);
  }, [v?.id]);

  // finished → count down, then close
  useEffect(() => {
    if (done === null) return;
    if (done <= 0) {
      r.closeViewer();
      return;
    }
    const t = setTimeout(() => setDone((d) => (d === null ? null : d - 1)), 1000);
    return () => clearTimeout(t);
  }, [done, r]);

  // messages from the framed page (YouTube player events, teacher's own quiz)
  useEffect(() => {
    if (!v) return;
    const onMsg = (e: MessageEvent) => {
      if (frame.current && e.source !== frame.current.contentWindow) return;
      if (isCloseRequest(e.data)) r.closeViewer();
      else if (autoClose && isYoutubeEnded(e.data)) setDone((d) => d ?? CLOSE_AFTER_S);
    };
    addEventListener('message', onMsg);
    return () => removeEventListener('message', onMsg);
  }, [v, autoClose, r]);

  const onLoad = () => {
    loads.current += 1;
    const w = frame.current?.contentWindow;
    if (embed?.kind === 'youtube' && w) {
      // ask the YouTube player to send its state (so we know when the video ends)
      try {
        w.postMessage(JSON.stringify({ event: 'listening', id: 'spike', channel: 'widget' }), '*');
      } catch {
        /* ignore */
      }
    }
    // Google Form: the 2nd page load is the "response recorded" page
    if (embed?.kind === 'gform' && autoClose && loads.current >= 2) setDone((d) => d ?? CLOSE_AFTER_S);
  };

  const c = v && isColorName(v.color) ? v.color : null;

  return (
    <AnimatePresence>
      {v && embed && (
        <motion.div
          key={v.id}
          role="dialog"
          aria-label="Pautan"
          className="fixed inset-0 z-[60] flex flex-col bg-[#dff3ff]"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.22 }}
        >
          <div className="safe-top safe-x flex items-center gap-2 border-b-[3px] border-ink bg-white px-3 py-2">
            <span className="h-9 w-9 shrink-0 rounded-full border-[3px] border-ink" style={{ background: c ? COLORS[c].hex : 'var(--fill)' }} />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[17px] font-bold">{c ? colorLabel(c) : 'Pautan'}</div>
              <div className="truncate text-[12px] text-ink-2">{embed.host}</div>
            </div>
            <a
              href={v.url}
              target="_blank"
              rel="noopener"
              aria-label="Buka di tab baharu"
              className="k-btn grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-ink"
            >
              <ExternalLink size={18} />
            </a>
            <button
              type="button"
              onClick={r.closeViewer}
              className="k-btn flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-k-red px-4 text-[17px] font-bold text-white"
            >
              <X size={20} strokeWidth={3} /> Tutup
            </button>
          </div>

          <div className="relative min-h-0 flex-1 bg-white">
            <iframe
              ref={frame}
              key={v.id}
              src={embed.src}
              title={c ? `Pautan ${colorLabel(c)}` : 'Pautan'}
              onLoad={onLoad}
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
            {done !== null && (
              <div className="absolute inset-x-0 bottom-0 flex justify-center p-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
                <div className="k-card flex items-center gap-3 bg-k-green px-4 py-2.5 text-white">
                  <span className="text-[17px] font-bold">Selesai! Tutup dalam {done}…</span>
                  <button type="button" onClick={() => setDone(null)} className="rounded-full bg-white/25 px-3 py-1 text-[14px] font-semibold">Jangan tutup</button>
                </div>
              </div>
            )}
          </div>

          <p className="safe-x bg-white px-3 pb-[calc(6px+env(safe-area-inset-bottom))] pt-1 text-center text-[12px] text-ink-2">
            Jika halaman kosong, laman itu tidak membenarkan paparan dalam app. Tekan <ExternalLink size={11} className="inline" /> untuk buka di tab baharu.
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
