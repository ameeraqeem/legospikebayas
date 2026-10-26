/*
 * Turn a teacher's link into something that can be shown inside the app (iframe),
 * so the robot stays connected — leaving the page would drop Bluetooth.
 */

export type EmbedKind = 'youtube' | 'gform' | 'page';

export interface Embed {
  src: string;
  kind: EmbedKind;
  host: string;
}

function youtubeId(u: URL): string | null {
  const h = u.hostname.replace(/^www\.|^m\./, '');
  if (h === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
  if (h === 'youtube.com' || h === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') return u.searchParams.get('v');
    const m = u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{6,})/);
    if (m) return m[1];
  }
  return null;
}

export function toEmbed(url: string, origin = typeof location !== 'undefined' ? location.origin : ''): Embed {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { src: url, kind: 'page', host: url };
  }
  const host = u.hostname.replace(/^www\./, '');

  const yt = youtubeId(u);
  if (yt) {
    const start = u.searchParams.get('t') || u.searchParams.get('start');
    const p = new URLSearchParams({ autoplay: '1', playsinline: '1', rel: '0', modestbranding: '1', enablejsapi: '1' });
    if (origin) p.set('origin', origin);
    if (start) p.set('start', String(parseInt(start, 10) || 0));
    return { src: `https://www.youtube.com/embed/${yt}?${p}`, kind: 'youtube', host: 'YouTube' };
  }

  if (host === 'docs.google.com' && u.pathname.includes('/forms/')) {
    u.pathname = u.pathname.replace(/\/(edit|prefill)$/, '/viewform');
    u.searchParams.set('embedded', 'true');
    return { src: u.toString(), kind: 'gform', host: 'Google Form' };
  }
  if (host === 'forms.gle') return { src: u.toString(), kind: 'gform', host: 'Google Form' };

  // Google Slides / Docs: the preview view can be framed, the editor cannot
  if (host === 'docs.google.com' && /\/(presentation|document|spreadsheets)\//.test(u.pathname)) {
    u.pathname = u.pathname.replace(/\/(edit|view)$/, '/preview');
    return { src: u.toString(), kind: 'page', host: 'Google' };
  }

  return { src: u.toString(), kind: 'page', host };
}

/** A message from a YouTube player saying the video has ended. */
export function isYoutubeEnded(data: unknown): boolean {
  let d: unknown = data;
  if (typeof d === 'string') {
    try {
      d = JSON.parse(d);
    } catch {
      return false;
    }
  }
  if (!d || typeof d !== 'object') return false;
  const o = d as { event?: string; info?: unknown };
  if (o.event === 'onStateChange') return o.info === 0;
  if (o.event === 'infoDelivery' && o.info && typeof o.info === 'object') return (o.info as { playerState?: number }).playerState === 0;
  return false;
}

/** Teacher's own quiz pages can close the viewer with: parent.postMessage('spike-robot:close', '*') */
export function isCloseRequest(data: unknown): boolean {
  if (data === 'spike-robot:close') return true;
  return !!data && typeof data === 'object' && (data as { type?: string }).type === 'spike-robot:close';
}
