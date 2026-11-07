// NDEFReader-Ersatz für die Android-App. Die WebView hat zwar ein „NDEFReader“, aber Web NFC ist dort gesperrt
// („NFC permission request denied“) und Android zeigt dann seinen eigenen „Neues Tag“-Bildschirm. Darum ersetzt die App
// NDEFReader immer durch das native Plugin FilamentNfc (Reader-Modus: Android fängt den Tag nicht mehr ab).
// Die Web-App nutzt weiter dieselbe NDEFReader-Schnittstelle.
import { IS_NATIVE } from './env';
import { getNativePlugin, type NativePlugin } from './nativeBridge';

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64 || '');
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function toBytes(data: any): Uint8Array {
  if (typeof data === 'string') return new TextEncoder().encode(data);
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return new Uint8Array();
}

interface NativeTagEvent {
  serialNumber: string;
  message: { records: Array<{ recordType: string; mediaType?: string; encoding: string; data: DataView }> };
}

function toEvent(ev: any): NativeTagEvent {
  const records = (ev?.records || []).map((r: any) => {
    const bytes = b64ToBytes(r.data);
    return {
      recordType: r.recordType,
      mediaType: r.mediaType,
      encoding: r.encoding || 'utf-8',
      data: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    };
  });
  return { serialNumber: ev?.serialNumber || '', message: { records } };
}

// ---------- Ein gemeinsamer Empfänger für alle Leser ----------
// Früher hängte jeder Scan einen eigenen Listener an und ein beendeter Scan stoppte auch die anderen.

type Reader = { onTag: (e: NativeTagEvent) => void; onError: () => void };
const readers = new Set<Reader>();
let listening = false;
let lastIdle: { event: NativeTagEvent; at: number } | null = null;
// Wie die App Tags ohne offenes Fenster abfängt: 'auto' = neue APK (Android liest immer selbst),
// 'scan' = alte APK (ein Dauer-Scan, der nie beendet wird), null = noch unbekannt
let idleMode: 'auto' | 'scan' | null = null;

function plugin(): NativePlugin | null {
  return getNativePlugin('FilamentNfc');
}

function ensureListener(p: NativePlugin) {
  if (listening) return;
  listening = true;
  p.on('tag', (raw: any) => {
    const event = toEvent(raw);
    if (readers.size === 0) {
      // Tag gehalten, während kein Fenster scannt: merken und App informieren (öffnet das NFC-Fenster)
      lastIdle = { event, at: Date.now() };
      window.dispatchEvent(new CustomEvent('filamenthub:nfc-idle-tag', { detail: event }));
      return;
    }
    // Nur der zuletzt gestartete Leser bekommt den Tag (das oberste Fenster)
    const last = Array.from(readers).pop();
    last?.onTag(event);
  });
  p.on('tagError', () => Array.from(readers).pop()?.onError());
}

/** Dafür sorgen, dass Android nie sein eigenes „Neuer Tag“-Fenster zeigt, solange die App vorne ist */
async function holdIdle(p: NativePlugin) {
  if (idleMode !== 'scan') {
    try {
      await p.call('setAutoRead', { enabled: true });
      idleMode = 'auto';
      return;
    } catch {
      idleMode = 'scan'; // ältere APK ohne setAutoRead
    }
  }
  p.call('startScan').catch(() => {});
}

/** Tag, der gerade (vor dem Öffnen eines Fensters) gehalten wurde */
export function peekIdleTag(maxAgeMs = 5000): NativeTagEvent | null {
  if (lastIdle && Date.now() - lastIdle.at < maxAgeMs) return lastIdle.event;
  return null;
}

async function checkAvailable(p: NativePlugin) {
  const state = await p.call<{ available: boolean; enabled: boolean }>('isAvailable');
  if (!state.available) throw new Error('Dieses Gerät hat kein NFC.');
  if (!state.enabled) throw new Error('NFC ist ausgeschaltet. Bitte in den Android-Einstellungen aktivieren.');
}

class NativeNDEFReader {
  onreading: ((ev: any) => void) | null = null;
  onreadingerror: ((ev: any) => void) | null = null;

  async scan(options?: { signal?: AbortSignal }) {
    const p = plugin();
    if (!p) throw new Error('NFC-Plugin nicht gefunden. Bitte die neueste App installieren.');
    if (options?.signal?.aborted) throw new DOMException('Abgebrochen', 'AbortError');
    await checkAvailable(p);
    ensureListener(p);

    const me: Reader = {
      onTag: e => this.onreading?.(e),
      onError: () => this.onreadingerror?.({})
    };
    readers.add(me);
    await p.call('startScan');

    // Gerade eben (vor dem Öffnen des Fensters) gehaltener Tag: direkt weitergeben
    if (lastIdle && Date.now() - lastIdle.at < 5000) {
      const e = lastIdle.event;
      lastIdle = null;
      setTimeout(() => me.onTag(e), 50);
    }

    options?.signal?.addEventListener(
      'abort',
      () => {
        readers.delete(me);
        // Im Dauer-Scan-Modus (alte APK) nie beenden, sonst zeigt Android sofort sein eigenes Fenster.
        // Im Auto-Modus liest Android ohnehin weiter: stopScan würde nur den Leser neu starten und den Tag neu erkennen
        // (dann ist ein gerade beginnendes Schreiben „out of date“).
        if (readers.size === 0 && idleMode !== 'scan' && idleMode !== 'auto') p.call('stopScan').catch(() => {});
      },
      { once: true }
    );
  }

  async write(message: any, options?: { signal?: AbortSignal }) {
    const p = plugin();
    if (!p) throw new Error('NFC-Plugin nicht gefunden. Bitte die neueste App installieren.');
    await checkAvailable(p);

    const records = (message?.records || []).map((r: any) => {
      if (r.recordType === 'mime') {
        return { recordType: 'mime', mediaType: r.mediaType || 'application/octet-stream', data: bytesToB64(toBytes(r.data)) };
      }
      const text = typeof r.data === 'string' ? r.data : new TextDecoder().decode(toBytes(r.data));
      return { recordType: r.recordType === 'url' ? 'url' : 'text', data: text };
    });
    if (options?.signal?.aborted) throw new DOMException('Abgebrochen', 'AbortError');
    options?.signal?.addEventListener('abort', () => p.call('cancelWrite').catch(() => {}), { once: true });
    try {
      await p.call('write', { records });
    } catch (err: any) {
      if (options?.signal?.aborted || /Abgebrochen/.test(String(err?.message || err))) {
        throw new DOMException('Abgebrochen', 'AbortError');
      }
      throw err;
    }
  }
}

/**
 * In der Android-App NDEFReader immer durch die native Variante ersetzen. Wichtig: Die WebView meldet „NDEFReader“
 * als vorhanden, blockiert es aber (daher kam „NFC permission request denied“).
 */
export function installNativeNfc() {
  if (!IS_NATIVE || typeof window === 'undefined') return;
  try {
    Object.defineProperty(window, 'NDEFReader', { value: NativeNDEFReader, configurable: true, writable: true });
  } catch {
    (window as any).NDEFReader = NativeNDEFReader;
  }
  // Tags auch ohne offenes Fenster abfangen, solange die App vorne ist. Neue APK: setAutoRead. Alte APK: Dauer-Scan.
  const p = plugin();
  if (p) {
    ensureListener(p);
    void holdIdle(p);
    // Android schaltet das Lesen beim Wegwechseln ab: beim Zurückkommen und zwischendurch neu absichern
    const reassert = () => {
      if (document.visibilityState === 'visible') void holdIdle(p);
    };
    document.addEventListener('visibilitychange', reassert);
    window.addEventListener('focus', reassert);
    window.setInterval(reassert, 15000);
  }
}
