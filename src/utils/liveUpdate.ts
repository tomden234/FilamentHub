// Live-Update der Android-App: neue Oberfläche kommt aus dem GitHub-Release, ohne neue APK (Plugin FilamentLive).
// Nur wenn sich der Android-Teil ändert (nativeApi steigt), ist wieder eine neue APK nötig.
import { APK_URL, APP_VERSION, IS_NATIVE, REPO } from './env';
import { getNativePlugin } from './nativeBridge';

export interface LiveState {
  status: 'idle' | 'downloading' | 'ready' | 'needApk';
  version?: string;
}

const BASE = `https://github.com/${REPO}/releases/download/apk-latest`;
const parts = (v: string) => (v.match(/\d+/g) || []).map(Number);

function isNewer(a: string, b: string): boolean {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d > 0;
  }
  return false;
}

let state: LiveState = { status: 'idle' };
const listeners = new Set<(s: LiveState) => void>();

function set(next: LiveState) {
  state = next;
  listeners.forEach(l => l(state));
}

export function subscribeLive(cb: (s: LiveState) => void): () => void {
  listeners.add(cb);
  cb(state);
  return () => listeners.delete(cb);
}

let busy = false;

async function checkLiveUpdate(): Promise<void> {
  const plugin = getNativePlugin('FilamentLive');
  if (!plugin || busy || state.status === 'ready') return;
  busy = true;
  try {
    const info = await plugin.call<{ liveVersion: string; nativeApi: number }>('info');
    const res = await fetch(`${BASE}/live-version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const remote = await res.json();
    const version = String(remote.version || '');
    if (!version) return;
    const current = info.liveVersion && isNewer(info.liveVersion, APP_VERSION) ? info.liveVersion : APP_VERSION;
    if (!isNewer(version, current)) return;
    if ((remote.nativeApi || 1) > info.nativeApi) {
      set({ status: 'needApk', version });
      return;
    }
    set({ status: 'downloading', version });
    // 1.231: Prüfsumme mitgeben (die App prüft das Paket vor dem Umschalten)
    const sha256 = typeof remote.sha256 === 'string' && /^[0-9a-f]{64}$/i.test(remote.sha256) ? remote.sha256 : undefined;
    await plugin.call('download', { url: `${BASE}/live-bundle.zip`, version, ...(sha256 ? { sha256 } : {}) });
    set({ status: 'ready', version });
  } catch {
    // offline oder GitHub nicht erreichbar: beim nächsten Start erneut prüfen
    if (state.status === 'downloading') set({ status: 'idle' });
  } finally {
    busy = false;
  }
}

/** Heruntergeladene Version jetzt laden (lädt die Oberfläche neu) */
export async function applyLiveUpdate(): Promise<void> {
  await getNativePlugin('FilamentLive')?.call('apply');
}

/** In der App einmal beim Start aufrufen: meldet den erfolgreichen Start und sucht regelmäßig nach Updates */
export function startLiveUpdate() {
  if (!IS_NATIVE) return;
  const plugin = getNativePlugin('FilamentLive');
  if (!plugin) return;
  setTimeout(() => plugin.call('markGood').catch(() => {}), 4000);
  setTimeout(checkLiveUpdate, 2500);
  setInterval(checkLiveUpdate, 15 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkLiveUpdate();
  });
}

/**
 * Neue APK direkt in der App laden und den Android-Installer öffnen (kein Browser).
 * Gibt 'needPermission' zurück, wenn der App das Installieren erst erlaubt werden muss (Einstellungen öffnen sich),
 * 'browser' wenn die installierte App das noch nicht kann.
 */
export async function installApkInApp(): Promise<'started' | 'needPermission' | 'browser' | 'error'> {
  const plugin = getNativePlugin('FilamentLive');
  if (!plugin) return 'browser';
  try {
    await plugin.call('installApk', { url: APK_URL });
    return 'started';
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (msg.includes('needPermission')) return 'needPermission';
    if (/not implemented|nicht|UNIMPLEMENTED|fehlt/i.test(msg) && !/Download fehlgeschlagen/.test(msg)) return 'browser';
    return 'error';
  }
}
