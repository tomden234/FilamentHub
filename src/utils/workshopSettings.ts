// Einstellungen der Werkstatt-Funktionen (Rest-Warnung, Erinnerungen, Druck-Meldungen).
// Ein gemeinsamer Speicher: Änderungen sind sofort in allen Komponenten sichtbar.
import { useSyncExternalStore } from 'react';
import { safeStorage } from './safeStorage';

export interface WorkshopSettings {
  /** Warnung, wenn eine Spule fast leer ist (Banner und Abzeichen auf der Karte) */
  lowWarning: boolean;
  /** Ab diesem Restgewicht (Gramm) gilt eine Spule als fast leer */
  lowWeightG: number;
  /** Welche Mitteilungen kommen sollen */
  /** Druck gestartet (auch wenn er nicht über die App gestartet wurde) */
  alertPrintStart: boolean;
  /** Beim Druckstart prüfen: reicht das Filament, passt das Material */
  alertPrintCheck: boolean;
  /** Schwere Fehler des Druckers (HMS), nur während eines Drucks und erst nach 1 Minute */
  alertErrors: boolean;
  /** Auch Hinweise und Dialoge des Druckers melden (Düse wechseln, Filament einlegen, „fortsetzen?“ …) */
  alertErrorsAll: boolean;
  /** Auch weniger wichtige Meldungen als Push aufs Gerät (sonst nur Druck fertig/fehlgeschlagen, schwere Fehler, Trocknung fertig) */
  pushAll: boolean;
  /** Luftfeuchte über der Grenze (AMS oder externer Sensor) */
  alertHumidity: boolean;
  /** Grenze Luftfeuchte in % */
  humidityMax: number;
  /** Externer Feuchte-Sensor in Home Assistant (leer = keiner) */
  humidityEntity: string;
  /** Zweiter Sensor im externen Spulentrockner (5. Spule), nur Anzeige (leer = keiner). Name aus Altgründen „Room“. */
  humidityRoomEntity: string;
  /** Beim Einlegen einer Spule, die trocknen sollte, fragen */
  drySuggest: boolean;
  /** AMS automatisch trocknen, wenn die Feuchte im AMS die Grenze erreicht */
  autoDryOn: boolean;
  /** Ab dieser AMS-Feuchte (%) automatisch trocknen */
  autoDryAt: number;
  /** Stand der Feuchte-Voreinstellung (für einmalige Umstellung auf neue Standardwerte) */
  humidityPresetV: number;
  alertPrintDone: boolean;
  alertPrintFail: boolean;
  alertDryDue: boolean;
  alertDryDone: boolean;
  /** Android: stehende Mitteilung mit Balken für Druck und Trocknung */
  liveStatus: boolean;
  /** Trocknung wurde vor dem Ende gestoppt */
  alertDryStop: boolean;
  alertLow: boolean;
  /** Zusätzlich als Benachrichtigung aufs Gerät (sonst nur im Postfach der App) */
  systemPush: boolean;
  /** Android-App: im Hintergrund aktiv bleiben (kleine dauerhafte Anzeige), damit Meldungen auch bei geschlossener App kommen */
  keepAlive: boolean;
  /** NFC-Leser im AMS (ESPHome über Home Assistant) nutzen */
  amsNfcOn: boolean;
  /** Bei erkannter Spule Material/Farbe an den Drucker senden */
  amsNfcToPrinter: boolean;
  /** Läuft die AMS-Trocknung ohne Druck, das Bauraum-Licht automatisch ausschalten */
  dryLightOff: boolean;
}

export const WORKSHOP_SETTINGS_KEY = 'filamenthub_workshop_settings';

export const DEFAULT_WORKSHOP_SETTINGS: WorkshopSettings = {
  lowWarning: true,
  lowWeightG: 100,
  alertPrintStart: true,
  alertPrintCheck: true,
  alertErrors: true,
  alertErrorsAll: false,
  pushAll: false,
  alertHumidity: true,
  humidityMax: 25,
  humidityEntity: 'sensor.filament_ams_box_feuchte',
  humidityRoomEntity: 'sensor.filament_ams_trockner_feuchte',
  drySuggest: true,
  autoDryOn: true,
  autoDryAt: 30,
  humidityPresetV: 2,
  alertPrintDone: true,
  alertPrintFail: true,
  alertDryDue: true,
  alertDryDone: true,
  liveStatus: true,
  alertDryStop: true,
  alertLow: true,
  systemPush: true,
  keepAlive: true,
  amsNfcOn: true,
  amsNfcToPrinter: true,
  dryLightOff: true
};

let cache: WorkshopSettings | null = null;
const listeners = new Set<() => void>();

function sanitize(raw: (Partial<WorkshopSettings> & Record<string, unknown>) | null | undefined): WorkshopSettings {
  const r: Record<string, unknown> = { ...(raw || {}) };
  // Alte Einstellungen (vor 2.01) übernehmen: wer „Druck-Meldung“ oder „Trocknungs-Erinnerung“ ausgeschaltet hatte, behält das
  if (r.finishAlert === false) {
    if (r.alertPrintDone === undefined) r.alertPrintDone = false;
    if (r.alertPrintFail === undefined) r.alertPrintFail = false;
  }
  if (r.dryReminder === false) {
    if (r.alertDryDue === undefined) r.alertDryDue = false;
    if (r.alertDryDone === undefined) r.alertDryDone = false;
    if (r.alertDryStop === undefined) r.alertDryStop = false;
  }
  if (r.lowWarning === false && r.alertLow === undefined) r.alertLow = false;
  // 1.107: neue Standardwerte Feuchte-Alarm 25 %, automatisch trocknen ab 30 % (einmalig übernehmen)
  if (Number(r.humidityPresetV || 0) < 2) {
    r.humidityMax = 25;
    r.autoDryAt = 30;
    r.humidityPresetV = 2;
  }
  const s: WorkshopSettings = { ...DEFAULT_WORKSHOP_SETTINGS };
  (Object.keys(DEFAULT_WORKSHOP_SETTINGS) as (keyof WorkshopSettings)[]).forEach(k => {
    if (typeof r[k] === typeof DEFAULT_WORKSHOP_SETTINGS[k]) (s as unknown as Record<string, unknown>)[k] = r[k];
  });
  const g = Number(s.lowWeightG);
  s.lowWeightG = Number.isFinite(g) ? Math.max(0, Math.min(1000, Math.round(g))) : DEFAULT_WORKSHOP_SETTINGS.lowWeightG;
  const h = Number(s.humidityMax);
  s.humidityMax = Number.isFinite(h) ? Math.max(10, Math.min(90, Math.round(h))) : DEFAULT_WORKSHOP_SETTINGS.humidityMax;
  s.humidityEntity = String(s.humidityEntity || '').trim();
  s.humidityRoomEntity = String(s.humidityRoomEntity || '').trim();
  // Früher war der zweite Sensor der Raum-Sensor: alten Standardnamen auf den Trockner umstellen
  if (s.humidityRoomEntity === 'sensor.filament_ams_raum_feuchte') s.humidityRoomEntity = DEFAULT_WORKSHOP_SETTINGS.humidityRoomEntity;
  const ad = Number(s.autoDryAt);
  s.autoDryAt = Number.isFinite(ad) ? Math.max(10, Math.min(90, Math.round(ad))) : DEFAULT_WORKSHOP_SETTINGS.autoDryAt;
  return s;
}

function readStored(): WorkshopSettings {
  try {
    const raw = safeStorage.getItem(WORKSHOP_SETTINGS_KEY);
    if (raw) return sanitize(JSON.parse(raw));
  } catch {
    // kaputte Daten: Standardwerte
  }
  return { ...DEFAULT_WORKSHOP_SETTINGS };
}

export function getWorkshopSettings(): WorkshopSettings {
  if (!cache) cache = readStored();
  return cache;
}

export function updateWorkshopSettings(patch: Partial<WorkshopSettings>): void {
  cache = sanitize({ ...getWorkshopSettings(), ...patch });
  safeStorage.setItem(WORKSHOP_SETTINGS_KEY, JSON.stringify(cache));
  listeners.forEach(l => l());
}

/** Nach einem Backup-Import: Einstellungen neu aus dem Speicher laden */
export function reloadWorkshopSettings(): void {
  cache = null;
  listeners.forEach(l => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useWorkshopSettings(): [WorkshopSettings, typeof updateWorkshopSettings] {
  const s = useSyncExternalStore(subscribe, getWorkshopSettings, getWorkshopSettings);
  return [s, updateWorkshopSettings];
}
