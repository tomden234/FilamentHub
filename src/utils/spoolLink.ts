// Link, den das QR-Etikett einer Spule enthält. Beim Scannen öffnet die App die Spule.
import { REPO } from './env';

function appBaseUrl(): string {
  const [owner, repo] = REPO.split('/');
  return `https://${owner}.github.io/${repo}/`;
}

export function spoolLink(id: string): string {
  return `${appBaseUrl()}#s=${encodeURIComponent(id)}`;
}

/** Spulen-ID aus dem URL-Hash (#s=ID) lesen */
export function spoolIdFromHash(hash: string): string | null {
  const m = /[#&]s=([^&]+)/.exec(hash || '');
  if (!m) return null;
  try {
    const id = decodeURIComponent(m[1]);
    return id.length > 0 && id.length <= 100 ? id : null; // kaputte Kodierung (z. B. „#s=%“) wirft sonst im Render
  } catch {
    return null;
  }
}

/** Link, der die Android-App direkt bei der Spule öffnet (Chrome-„intent“-Link, bleibt auf der Seite, wenn die App fehlt) */
export function appIntentLink(id: string, fallbackUrl: string): string {
  return `intent://spool/${encodeURIComponent(id)}#Intent;scheme=filamenthub;package=com.filamenthub.app;S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;
}
