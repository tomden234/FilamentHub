import { Spool } from '../types/filament';
import { encodeOpenTag3d, decodeOpenTag3d, OPENTAG3D_MIME } from './openTag3d';

export interface NfcPayload {
  app: 'FilamentHub';
  v: number;
  spoolId: string;
  brand: string;
  material: string;
  name: string;
  colorName?: string;
  colorHex?: string;
  remainingWeight: number;
  initialWeight: number;
  emptySpoolWeight: number;
  pricePerKg?: number;
  lastWritten: string;
}

export interface NfcReadResult {
  hasFilamentData: boolean;
  serialNumber?: string;
  payload?: NfcPayload;
  matchedSpool?: Spool;
  rawText?: string;
  error?: string;
}

const STORAGE_KEY_TAG_MAPPINGS = 'filamenthub_nfc_tag_mappings_v1';

// Tag-UID zu Spulen-ID Mappings laden
export function getTagMappings(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TAG_MAPPINGS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

// Tag-UID mit einer Spulen-ID verknüpfen
export function mapTagToSpool(serialNumber: string, spoolId: string): void {
  if (!serialNumber) return;
  const mappings = getTagMappings();
  mappings[serialNumber.trim().toLowerCase()] = spoolId;
  try {
    localStorage.setItem(STORAGE_KEY_TAG_MAPPINGS, JSON.stringify(mappings));
  } catch {}
}

// Tag-UID Verknüpfung entfernen (Löschen)
export function unmapTag(serialNumber: string): void {
  if (!serialNumber) return;
  const mappings = getTagMappings();
  delete mappings[serialNumber.trim().toLowerCase()];
  try {
    localStorage.setItem(STORAGE_KEY_TAG_MAPPINGS, JSON.stringify(mappings));
  } catch {}
}

// Prüfen, ob der Browser Web NFC unterstützt (Chrome Android, Samsung Internet, Edge Android)
export function isWebNfcSupported(): boolean {
  return typeof window !== 'undefined' && 'NDEFReader' in window;
}

/**
 * Schreibt eine Spule auf einen physischen NFC-Tag (oder speichert die Zuordnung)
 */
export type NfcWriteFormat = 'filamenthub' | 'opentag3d';

export async function writeSpoolToNfcTag(
  spool: Spool,
  signal?: AbortSignal,
  format: NfcWriteFormat = 'filamenthub'
): Promise<{ success: boolean; message: string; serialNumber?: string }> {
  if (format === 'opentag3d') {
    return writeOpenTag3dToNfcTag(spool, signal);
  }
  const payload: NfcPayload = {
    app: 'FilamentHub',
    v: 1,
    spoolId: spool.id,
    brand: spool.brand,
    material: spool.material,
    name: spool.name,
    colorName: spool.colorName,
    colorHex: spool.colorHex,
    remainingWeight: spool.remainingWeight,
    initialWeight: spool.initialWeight,
    emptySpoolWeight: spool.emptySpoolWeight,
    pricePerKg: spool.pricePerKg,
    lastWritten: new Date().toISOString()
  };

  const jsonStr = JSON.stringify(payload);

  if (isWebNfcSupported()) {
    try {
      const NDEFReaderClass = (window as any).NDEFReader;
      const ndef = new NDEFReaderClass();

      // NDEF Text Record schreiben
      await ndef.write(
        {
          records: [
            {
              recordType: 'text',
              data: jsonStr
            }
          ]
        },
        { signal }
      );

      return {
        success: true,
        message: `NFC-Tag erfolgreich mit „${spool.brand} ${spool.name}“ beschrieben!`
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw err;
      }
      // Fallback bei Berechtigungs- oder Schreibfehlern
      return {
        success: false,
        message: `Fehler beim Schreiben des NFC-Tags: ${err.message || 'Tag nicht erkannt oder schreibgeschützt'}`
      };
    }
  }

  // Für Browser ohne direkte Web NFC Schnittstelle (z.B. Desktop-Simulator)
  return {
    success: true,
    message: `NFC-Daten für „${spool.brand} ${spool.name}“ vorbereitet (Web NFC im aktuellen Browser nicht verfügbar).`
  };
}

/**
 * Schreibt die Spule im offenen OpenTag3D-Format (NDEF-MIME application/opentag3d, 224 Byte).
 * Dieses Format können auch andere Programme und Drucker-Software lesen, die OpenTag3D unterstützen.
 */
export async function writeOpenTag3dToNfcTag(
  spool: Spool,
  signal?: AbortSignal
): Promise<{ success: boolean; message: string }> {
  const payload = encodeOpenTag3d(spool);

  if (!isWebNfcSupported()) {
    return {
      success: true,
      message: `OpenTag3D-Daten für „${spool.brand} ${spool.name}“ vorbereitet (Web NFC im aktuellen Browser nicht verfügbar).`
    };
  }

  try {
    const NDEFReaderClass = (window as any).NDEFReader;
    const ndef = new NDEFReaderClass();
    await ndef.write(
      { records: [{ recordType: 'mime', mediaType: OPENTAG3D_MIME, data: payload }] },
      { signal }
    );
    return {
      success: true,
      message: `NFC-Tag im OpenTag3D-Format mit „${spool.brand} ${spool.name}“ beschrieben! (Tag muss mindestens ein NTAG215 sein.)`
    };
  } catch (err: any) {
    if (err.name === 'AbortError') throw err;
    return {
      success: false,
      message: `Fehler beim Schreiben des OpenTag3D-Tags: ${err.message || 'Tag nicht erkannt, zu klein (NTAG215 nötig) oder schreibgeschützt'}`
    };
  }
}

/**
 * Wandelt einen gelesenen OpenTag3D-Payload in den JSON-Text, den parseNfcContent versteht.
 * Die Seriennummer des Tags enthält (wenn von FilamentHub geschrieben) die Spulen-ID.
 */
export function openTag3dToJsonText(bytes: Uint8Array): string {
  const d = decodeOpenTag3d(bytes);
  return JSON.stringify({
    app: 'FilamentHub',
    v: 1,
    spoolId: d.serial || undefined,
    brand: d.manufacturer,
    material: d.material,
    name: `${d.baseMaterial}${d.modifier ? ' ' + d.modifier : ''} ${d.colorName}`.trim(),
    colorName: d.colorName,
    colorHex: d.colorHex,
    initialWeight: d.targetWeight || undefined,
    emptySpoolWeight: d.emptySpoolWeight || undefined,
    source: 'opentag3d'
  });
}

/**
 * Akustisches Feedback bei erfolgreichem NFC-Tag Schreibvorgang (Web Audio API)
 */
export function playNfcSuccessChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
    osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.start(now);
    osc.stop(now + 0.45);
  } catch {}
}

/**
 * Akustisches Feedback beim Löschen/Leeren eines NFC-Tags (abfallende Doppel-Töne)
 */
export function playNfcDeleteSound(): void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(440, now); // A4
    osc.frequency.setValueAtTime(293.66, now + 0.12); // D4
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.start(now);
    osc.stop(now + 0.35);
  } catch {}
}

/**
 * Löscht/formatiert einen NFC-Tag und entfernt Zuordnungen
 */
export async function eraseNfcTag(
  serialNumber?: string,
  signal?: AbortSignal
): Promise<{ success: boolean; message: string }> {
  if (serialNumber) {
    unmapTag(serialNumber);
  }

  if (isWebNfcSupported()) {
    try {
      const NDEFReaderClass = (window as any).NDEFReader;
      const ndef = new NDEFReaderClass();

      // Versuche ein leeres Record-Array oder leeren Text zu schreiben
      try {
        await ndef.write(
          {
            records: [
              {
                recordType: 'text',
                data: ''
              }
            ]
          },
          { signal }
        );
      } catch {
        // Fallback: overwrite mit leerem Inhalt
        await ndef.write(
          {
            records: [
              {
                recordType: 'empty'
              }
            ]
          },
          { signal }
        );
      }

      playNfcDeleteSound();
      triggerNfcHaptic();
      return {
        success: true,
        message: 'NFC-Tag wurde erfolgreich gelöscht und formatiert!'
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw err;
      }
      return {
        success: false,
        message: `Fehler beim Löschen des Tags: ${err.message || 'Schreibfehler'}`
      };
    }
  }

  // Simulation
  playNfcDeleteSound();
  triggerNfcHaptic();
  return {
    success: true,
    message: 'NFC-Tag Daten & Verknüpfung wurden erfolgreich gelöscht.'
  };
}

/**
 * Haptisches Feedback (Smartphone-Vibration) bei erfolgreichem Tag-Kontakt
 */
export function triggerNfcHaptic(): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([70, 40, 70]);
    }
  } catch {}
}

/**
 * Parst NDEF Text- oder JSON-Inhalte
 */
export function parseNfcContent(
  rawText: string,
  serialNumber?: string,
  spools: Spool[] = []
): NfcReadResult {
  const mappings = getTagMappings();
  const normalizedUid = serialNumber ? serialNumber.trim().toLowerCase() : '';

  // 1. Prüfen, ob der Text ein gültiges FilamentHub JSON ist
  try {
    const data = JSON.parse(rawText);
    if (data && (data.app === 'FilamentHub' || data.spoolId || (data.brand && data.material))) {
      // Zuerst nach exakter ID, sonst nach Marke + Name abgleichen
      const matchedSpool =
        (data.spoolId ? spools.find(s => s.id === data.spoolId) : undefined) ||
        // OpenTag3D kennt keinen Spulennamen: dann über Marke, Material und Farbname zuordnen
        (data.source === 'opentag3d'
          ? spools.find(
              s =>
                s.brand?.toLowerCase() === data.brand?.toLowerCase() &&
                s.material === data.material &&
                s.colorName?.toLowerCase() === data.colorName?.toLowerCase()
            )
          : undefined) ||
        spools.find(s => s.brand?.toLowerCase() === data.brand?.toLowerCase() && s.name?.toLowerCase() === data.name?.toLowerCase());

      if (normalizedUid && matchedSpool) {
        mapTagToSpool(normalizedUid, matchedSpool.id);
      } else if (normalizedUid && data.spoolId) {
        mapTagToSpool(normalizedUid, data.spoolId);
      }

      return {
        hasFilamentData: true,
        serialNumber,
        payload: data,
        matchedSpool,
        rawText
      };
    }
  } catch {}

  // 2. Prüfen, ob die Tag-UID bereits einer Spule in der Datenbank zugeordnet ist
  if (normalizedUid && mappings[normalizedUid]) {
    const matchedSpool = spools.find(s => s.id === mappings[normalizedUid]);
    if (matchedSpool) {
      return {
        hasFilamentData: true,
        serialNumber,
        matchedSpool,
        rawText
      };
    }
  }

  // 3. Unbeschriebener Tag oder unbekannter Fremd-Tag
  return {
    hasFilamentData: false,
    serialNumber,
    rawText
  };
}
