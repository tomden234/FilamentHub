import { useEffect, useRef } from 'react';
import type { Spool } from '../types/filament';
import { raiseAlert } from '../utils/alerts';
import { getHaCredentials } from '../utils/haClient';
import { amsHumidityPercent, setHumidity, type HumidityReading } from '../utils/humidity';
import { spoolInSlot } from '../utils/printAlerts';
import { safeStorage } from '../utils/safeStorage';
import { getWorkshopSettings, useWorkshopSettings } from '../utils/workshopSettings';
import { armDryPlan, dryPlanFor, getDryPlan } from '../utils/dryAfterPrint';
import { addSystemLog } from '../utils/logService';

// Feuchte-Alarm: AMS (Messwert vom Drucker) und optional ein externer Sensor über Home Assistant
// (z. B. SHT31 am ESP32 des NFC-Lesers, siehe hardware/ams-nfc). Über der Grenze → Mitteilung.
//  - Wert muss 5 Minuten über der Grenze liegen (kurze Spitzen zählen nicht)
//  - danach erst wieder, wenn er 3 % unter die Grenze fiel, oder nach 12 Stunden
//  - während die AMS-Trocknung läuft, kein Alarm fürs AMS
//  - Automatisch trocknen ab autoDryAt (Standard 30 %), Alarm schon ab humidityMax (Standard 25 %)

interface Params {
  amsUnit: any;
  printerConnected: boolean;
  drying: boolean;
  spools: Spool[];
  /** Spulen, die gerade im AMS liegen */
  amsSpools: Spool[];
  /** Druck läuft (dann wird nach dem Druck getrocknet) */
  printActive: boolean;
  /** Kein automatisches Trocknen (z. B. „Nach Druck aus“ ist gewählt) */
  blockDrying?: boolean;
  startDrying: (o: { hours: number; temp: number }) => Promise<boolean>;
  notify: (t: { text: string; ok: boolean }) => void;
}

const AUTO_DRY_KEY = 'filamenthub_auto_dry_last';

type Source = 'ams' | 'external';
interface AlarmState {
  highSince: number | null;
  alertedAt: number;
  armed: boolean;
}

const KEY = 'filamenthub_humidity_alarm_v1';
const POLL_MS = 10_000; // Box-/Trockner-Sensor alle 10 Sekunden

function readState(): Record<Source, AlarmState> {
  const empty = (): AlarmState => ({ highSince: null, alertedAt: 0, armed: true });
  try {
    const v = JSON.parse(safeStorage.getItem(KEY) || '{}');
    return { ams: { ...empty(), ...(v.ams || {}) }, external: { ...empty(), ...(v.external || {}) } };
  } catch {
    return { ams: empty(), external: empty() };
  }
}

function saveState(s: Record<Source, AlarmState>): void {
  safeStorage.setItem(KEY, JSON.stringify(s));
}

export function useHumidityAlarm(p: Params) {
  const [settings] = useWorkshopSettings();
  const latest = useRef(p);
  latest.current = p;

  const check = (source: Source, value: number | null) => {
    if (value === null || !Number.isFinite(value)) return;
    const s = readState();
    const st = s[source];
    const max = settings.humidityMax;
    const now = Date.now();
    if (value <= max - 3) {
      st.armed = true;
      st.highSince = null;
    } else if (value > max) {
      if (st.highSince === null) st.highSince = now;
      const repeat = now - st.alertedAt > getWorkshopSettings().humidityRepeatH * 3600_000;
      if (now - st.highSince >= getWorkshopSettings().humidityHoldMin * 60_000 && (st.armed || repeat)) {
        st.armed = false;
        st.alertedAt = now;
        const where = source === 'ams' ? 'AMS' : 'Lager-Sensor';
        const text = `${where}: ${Math.round(value)} % Luftfeuchte (Grenze ${max} %). Trocknen empfohlen.`;
        const items: { title: string; sub?: string; color?: string }[] = [];
        if (source === 'ams') {
          [1, 2, 3, 4].forEach(slot => {
            const sp = spoolInSlot(slot, latest.current.spools);
            if (sp) items.push({ title: `${sp.brand} ${sp.name}`, sub: `Slot ${slot} · ${sp.material}`, color: sp.colorHex });
          });
        }
        void raiseAlert({
          kind: 'humidity',
          key: `humidity-${source}-${now}`,
          title: 'Feuchte zu hoch',
          text,
          toast: `💧 ${text}`,
          facts: [
            { label: 'Ort', value: where },
            { label: 'Gemessen', value: `${Math.round(value)} %` },
            { label: 'Grenze', value: `${max} %` }
          ],
          items: items.length ? items : undefined
        });
      }
    } else {
      st.highSince = null; // zwischen Grenze-3 und Grenze: weder Alarm noch neu scharf
    }
    saveState(s);
  };

  // AMS-Wert vom Drucker
  const amsValue = p.printerConnected ? amsHumidityPercent(p.amsUnit) : null;
  const amsTemp = p.printerConnected && p.amsUnit?.temp !== undefined ? Number(p.amsUnit.temp) : null;
  useEffect(() => {
    setHumidity({ ams: amsValue === null ? null : { value: amsValue, temp: Number.isFinite(amsTemp) ? amsTemp : null, at: Date.now() } });
    if (!settings.alertHumidity || p.drying) return;
    check('ams', amsValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amsValue, amsTemp, settings.alertHumidity, settings.humidityMax, p.drying]);

  // Gleichbleibender Wert: trotzdem regelmäßig prüfen (für die 5-Minuten-Regel)
  const amsRef = useRef(amsValue);
  amsRef.current = amsValue;
  useEffect(() => {
    if (!settings.alertHumidity) return;
    const id = setInterval(() => {
      if (!latest.current.drying) check('ams', amsRef.current);
    }, 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.alertHumidity, settings.humidityMax]);

  // Automatisch trocknen: AMS-Feuchte 10 Minuten auf oder über „autoDryAt“ (Standard 30 %) → Trocknung starten.
  // Läuft ein Druck, wird „nach dem Druck trocknen“ gesetzt. Höchstens einmal in 24 Stunden.
  const autoHighSince = useRef<number | null>(null);
  const autoBusy = useRef(false);
  useEffect(() => {
    if (!settings.autoDryOn) return;
    const tick = async () => {
      const cur = latest.current;
      const v = amsRef.current;
      if (cur.blockDrying) {
        autoHighSince.current = null;
        return;
      }
      if (!cur.printerConnected || v === null || cur.drying || v < settings.autoDryAt) {
        autoHighSince.current = null;
        return;
      }
      if (autoHighSince.current === null) autoHighSince.current = Date.now();
      if (Date.now() - autoHighSince.current < getWorkshopSettings().autoDryHoldMin * 60_000 || autoBusy.current) return;
      const last = Number(safeStorage.getItem(AUTO_DRY_KEY)) || 0;
      if (Date.now() - last < getWorkshopSettings().autoDryPauseH * 3600_000 || !cur.amsSpools.length) return;
      if (getDryPlan().armed) return; // schon geplant
      autoBusy.current = true;
      try {
        const plan = dryPlanFor(cur.amsSpools, cur.amsSpools);
        const names = cur.amsSpools.map(s => `${s.brand} ${s.name}`).join(', ');
        if (cur.printActive) {
          armDryPlan({ ...plan, spoolIds: cur.amsSpools.map(s => s.id) }, true);
          safeStorage.setItem(AUTO_DRY_KEY, String(Date.now()));
          const text = `AMS-Feuchte ${Math.round(v)} % (ab ${settings.autoDryAt} % wird getrocknet). Trocknung startet nach dem Druck (${plan.temp} °C, ${plan.hours} h).`;
          addSystemLog('drucker', 'Auto-Trocknen nach Druck geplant', text, 'info');
          void raiseAlert({ kind: 'humidity', key: `auto-dry-${Date.now()}`, title: 'Trocknung geplant', text, toast: `☀️ ${text}`, facts: [{ label: 'Spulen', value: names }] }, t => cur.notify({ text: t, ok: true }));
        } else if (await cur.startDrying(plan)) {
          safeStorage.setItem(AUTO_DRY_KEY, String(Date.now()));
          const text = `AMS-Feuchte ${Math.round(v)} % (ab ${settings.autoDryAt} %). Trocknung automatisch gestartet (${plan.temp} °C, ${plan.hours} h).`;
          addSystemLog('drucker', 'Auto-Trocknen gestartet', text, 'success');
          void raiseAlert({ kind: 'humidity', key: `auto-dry-${Date.now()}`, title: 'Trocknung gestartet', text, toast: `☀️ ${text}`, facts: [{ label: 'Spulen', value: names }] }, t => cur.notify({ text: t, ok: true }));
        }
      } finally {
        autoHighSince.current = null;
        autoBusy.current = false;
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.autoDryOn, settings.autoDryAt]);

  // Externe Sensoren über Home Assistant (alle 2 Minuten): Box (mit Alarm) und optional externer Trockner (nur Anzeige)
  useEffect(() => {
    const boxEntity = settings.humidityEntity;
    const roomEntity = settings.humidityRoomEntity;
    if (!boxEntity) setHumidity({ external: null });
    if (!roomEntity) setHumidity({ room: null });
    if (!boxEntity && !roomEntity) return;
    let stop = false;
    const poll = async () => {
      const { url, token } = getHaCredentials();
      if (!token) return;
      if (boxEntity) {
        const r = await readHaHumidity(url, token, boxEntity);
        if (stop) return;
        if (r) {
          setHumidity({ external: r });
          if (r.value !== null && settings.alertHumidity) check('external', r.value);
        }
      }
      if (roomEntity) {
        const r = await readHaHumidity(url, token, roomEntity);
        if (stop) return;
        if (r) setHumidity({ room: r });
      }
    };
    void poll();
    const id = setInterval(() => void poll(), POLL_MS);
    return () => {
      stop = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.humidityEntity, settings.humidityRoomEntity, settings.alertHumidity, settings.humidityMax]);
}

/** Feuchte (und Temperatur, falls es den passenden …_temperatur-Sensor gibt) aus Home Assistant lesen. null = gerade nicht erreichbar. */
async function readHaHumidity(url: string, token: string, entity: string): Promise<HumidityReading | null> {
  const tempEntity = entity.includes('feuchte') ? entity.replace('feuchte', 'temperatur') : entity.includes('humidity') ? entity.replace('humidity', 'temperature') : '';
  const headers = { Authorization: `Bearer ${token}` };
  try {
    const res = await fetch(`${url}/api/states/${entity}`, { headers, signal: AbortSignal.timeout(8000) });
    if (res.status === 404) return { value: null, at: Date.now(), error: 'Sensor nicht in Home Assistant gefunden' };
    if (!res.ok) return null;
    const value = Number((await res.json())?.state);
    let temp: number | null = null;
    if (tempEntity) {
      try {
        const r2 = await fetch(`${url}/api/states/${tempEntity}`, { headers, signal: AbortSignal.timeout(8000) });
        if (r2.ok) {
          const j2 = await r2.json();
          const t = Number(j2?.state);
          // Home Assistant kann in °F anzeigen: immer in °C umrechnen
          const unit = String(j2?.attributes?.unit_of_measurement || '');
          temp = Number.isFinite(t) ? Math.round((/f/i.test(unit) ? (t - 32) / 1.8 : t) * 10) / 10 : null;
        }
      } catch {
        /* Temperatur ist nur Zusatz */
      }
    }
    const ok = Number.isFinite(value);
    return { value: ok ? value : null, temp, at: Date.now(), error: ok ? undefined : 'Sensor meldet keinen Wert' };
  } catch {
    return null; // Home Assistant gerade nicht erreichbar
  }
}
