/*
 * "Second window" for colour links.
 * Browsers block window.open() that is not triggered by a tap, and a BLE event is
 * not a tap. So the user opens the link window ONCE (a tap), and later colour scans
 * just navigate that already-open window — which browsers allow.
 * If the window is gone or blocked, the app shows a one-tap "Buka pautan" banner.
 */

const NAME = 'spike-robot-links';
let win: Window | null = null;

const HOLDING = `<!doctype html><html lang="ms"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pautan Robot</title>
<style>html,body{height:100%;margin:0;background:#000;color:#f5f5f7;font-family:-apple-system,system-ui,sans-serif;display:grid;place-items:center;text-align:center}
.d{width:96px;height:96px;border-radius:50%;margin:0 auto 24px;background:conic-gradient(#FF3B30,#FFCC00,#34C759,#007AFF,#FF3B30);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 4px),#000 calc(100% - 3px));animation:s 6s linear infinite}
@keyframes s{to{transform:rotate(1turn)}}h1{font-size:28px;letter-spacing:-.02em;margin:0 0 8px}p{color:#98989d;margin:0;font-size:16px}</style></head>
<body><div><div class="d"></div><h1>Tetingkap Pautan sedia</h1><p>Imbas kad warna dengan robot — pautan akan dibuka di sini.</p></div></body></html>`;

export function linkWindowOpen() {
  try {
    return !!win && !win.closed;
  } catch {
    return false;
  }
}

/** Call from a tap. Returns false if the browser blocked the window. */
export function prepareLinkWindow(): boolean {
  try {
    win = window.open('', NAME);
    if (!win) return false;
    try {
      win.document.open();
      win.document.write(HOLDING);
      win.document.close();
    } catch {
      /* window already on another site — fine, it's still ours to navigate */
    }
    window.focus();
    return true;
  } catch {
    return false;
  }
}

/** Navigate the link window. Works without a tap only if prepareLinkWindow() succeeded earlier. */
export function openLink(url: string, fromTap = false): 'window' | 'blocked' {
  if (linkWindowOpen()) {
    try {
      win!.location.href = url;
      return 'window';
    } catch {
      /* fall through */
    }
  }
  if (fromTap) {
    const w = window.open(url, NAME);
    if (w) {
      win = w;
      return 'window';
    }
  }
  return 'blocked';
}
