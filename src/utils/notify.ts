// Meldungen aufs Gerät (Benachrichtigung). Funktioniert im Browser und in der installierten Web-App.
// In der Android-App läuft es über das eigene Plugin FilamentNotify (braucht die APK ab v1.82), sonst bleibt die Meldung in der App.
import { IS_NATIVE, IS_DESKTOP } from './env';
import { openWorkshop } from './uiEvents';

export type NotifyPermission = 'granted' | 'denied' | 'default' | 'unsupported';

// --- Android-App ---
let nativePerm: NotifyPermission = 'default';
let nativeAvailable = true;

function nativeCall<T = any>(method: string, args: Record<string, unknown> = {}): Promise<T> {
  const cap = (window as any).Capacitor;
  if (typeof cap?.nativePromise === 'function') return cap.nativePromise('FilamentNotify', method, args);
  const fn = cap?.Plugins?.FilamentNotify?.[method];
  if (typeof fn === 'function') return fn(args);
  return Promise.reject(new Error('FilamentNotify fehlt (alte App-Version)'));
}

/** Aktuellen Stand in der Android-App lesen (async, danach liefert notifyPermission() den Wert) */
export async function refreshNotifyPermission(): Promise<NotifyPermission> {
  if (!IS_NATIVE) return notifyPermission();
  try {
    const r = await nativeCall<{ granted: boolean }>('status');
    nativeAvailable = true;
    nativePerm = r.granted ? 'granted' : nativePerm === 'granted' ? 'default' : nativePerm;
  } catch {
    nativeAvailable = false; // alte APK ohne Plugin
  }
  return notifyPermission();
}

/** Android-App: Hintergrund-Dienst ein/aus (hält die Verbindung zum Drucker offen, damit Meldungen auch bei geschlossener App kommen).
 *  Braucht die APK ab 1.102, bei älteren passiert nichts. */
export async function setKeepAlive(on: boolean): Promise<boolean> {
  if (!IS_NATIVE) return false;
  try {
    const r = await nativeCall<{ running: boolean }>('keepAlive', { on });
    return Boolean(r?.running);
  } catch {
    return false;
  }
}

/** Android-Meldungseinstellungen der App öffnen (wenn blockiert) */
export async function openNotifySettings(): Promise<void> {
  try {
    await nativeCall('openSettings');
  } catch {
    /* alte APK */
  }
}

export function notifyNeedsNewApk(): boolean {
  return IS_NATIVE && !nativeAvailable;
}

export function notifyPermission(): NotifyPermission {
  if (IS_NATIVE) return nativeAvailable ? nativePerm : 'unsupported';
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as NotifyPermission;
}

export async function requestNotifyPermission(): Promise<NotifyPermission> {
  if (IS_NATIVE) {
    try {
      const r = await nativeCall<{ granted: boolean }>('request');
      nativeAvailable = true;
      nativePerm = r.granted ? 'granted' : 'denied';
    } catch {
      nativeAvailable = false;
    }
    return notifyPermission();
  }
  if (notifyPermission() === 'unsupported') return 'unsupported';
  try {
    const res = await Notification.requestPermission();
    return res as NotifyPermission;
  } catch {
    return notifyPermission();
  }
}

export interface LocalNotifyOptions {
  tag?: string;
  /** Adresse eines Bildes (z. B. Kamerabild), wird wenn möglich angezeigt */
  image?: string;
  /** Mitteilung im Postfach: Ein Tipp auf die Benachrichtigung öffnet sie in der App */
  inboxId?: string;
}

// --- Tipp auf eine Benachrichtigung ---
type TapHandler = (inboxId: string) => void;

/** Android-App: Hat der Nutzer auf eine Benachrichtigung getippt (auch beim Kaltstart), wird die ID gemeldet.
 *  Gibt eine Aufräum-Funktion zurück. Braucht die APK ab 2.01, bei älteren passiert einfach nichts. */
export function listenNotificationTaps(handler: TapHandler): () => void {
  if (!IS_NATIVE) return () => {};
  let stopped = false;
  const consume = async () => {
    try {
      const r = await nativeCall<{ id?: string }>('consumeTap');
      if (!stopped && r?.id) handler(r.id);
    } catch {
      /* alte APK ohne consumeTap */
    }
  };
  void consume();
  const onVisible = () => {
    if (document.visibilityState === 'visible') void consume();
  };
  document.addEventListener('visibilitychange', onVisible);
  let handle: { remove?: () => void } | undefined;
  try {
    const plugin = (window as any).Capacitor?.Plugins?.FilamentNotify;
    const p = plugin?.addListener?.('notificationTap', (e: { id?: string }) => {
      if (!e?.id) return;
      handler(e.id);
      void nativeCall('consumeTap').catch(() => {}); // gemerkte ID löschen, sonst öffnet sie sich beim nächsten Zurückkehren nochmal
    });
    Promise.resolve(p).then((h: any) => {
      handle = h;
    });
  } catch {
    /* kein Listener möglich */
  }
  return () => {
    stopped = true;
    document.removeEventListener('visibilitychange', onVisible);
    try {
      handle?.remove?.();
    } catch {
      /* egal */
    }
  };
}

/** Zeigt eine Benachrichtigung. Gibt false zurück, wenn das nicht möglich oder nicht erlaubt ist. */
export async function localNotify(title: string, body: string, opts: LocalNotifyOptions = {}): Promise<boolean> {
  if (IS_NATIVE) {
    try {
      const r = await nativeCall<{ shown: boolean }>('show', { title, body, tag: opts.tag || 'fh', id: opts.inboxId || '' });
      return Boolean(r?.shown);
    } catch {
      return false;
    }
  }
  if (notifyPermission() !== 'granted') return false;
  const icon = `${import.meta.env.BASE_URL || '/'}pwa-192x192.png`;
  const options = { body, tag: opts.tag, icon, badge: icon, image: opts.image, data: { inboxId: opts.inboxId || '' } } as NotificationOptions;
  try {
    // Windows-App (Electron) und Desktop-Browser: direkte Benachrichtigung, Klick bringt das Fenster nach vorn und öffnet die Mitteilung
    if (IS_DESKTOP) {
      const n = new Notification(title, options);
      n.onclick = () => {
        try {
          window.focus();
        } catch {
          /* egal */
        }
        if (opts.inboxId) openWorkshop('inbox', opts.inboxId);
        n.close();
      };
      return true;
    }
    // Android-Chrome erlaubt "new Notification" nicht, dort geht es nur über den Service Worker
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg && typeof reg.showNotification === 'function') {
      await reg.showNotification(title, options);
      return true;
    }
    const n = new Notification(title, options);
    n.onclick = () => {
      try {
        window.focus();
      } catch {
        /* egal */
      }
      if (opts.inboxId) openWorkshop('inbox', opts.inboxId);
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}

export interface OngoingStatus {
  title: string;
  text: string;
  sub: string;
  progress: number;
  etaMs: number;
  /** Kurztext für die Statusleiste (z. B. „45 %“) */
  shortText?: string;
}

/** Android-App: stehende Mitteilung mit Balken zeigen oder aktualisieren (braucht die APK ab 1.155) */
/** Farbe der App (gewähltes Akzent-Farbschema) als #RRGGBB für die Mitteilung */
function accentHex(): string {
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--app-accent').trim();
    if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
    if (/^#[0-9a-f]{3}$/i.test(raw)) return '#' + raw.slice(1).split('').map(c => c + c).join('');
    const m = raw.match(/rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/);
    if (m) return '#' + [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('');
  } catch {
    /* Standard */
  }
  return '#168a47';
}

export async function showOngoingStatus(s: OngoingStatus): Promise<boolean> {
  if (!IS_NATIVE) return false;
  try {
    const r = await nativeCall<{ shown: boolean }>('showOngoing', { ...s, color: accentHex() });
    return Boolean(r?.shown);
  } catch {
    return false; // alte APK ohne diese Funktion
  }
}

export async function clearOngoingStatus(): Promise<void> {
  if (!IS_NATIVE) return;
  try {
    await nativeCall('clearOngoing');
  } catch {
    /* alte APK */
  }
}
