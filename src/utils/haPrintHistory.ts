// Druckverlauf aus Home Assistant (Bambu-Lab-Integration): Aus dem Verlauf der Sensoren (Status, Auftragsname, aktives Fach, Fortschritt)
// werden fertige und abgebrochene Drucke gebaut, auch wenn keine App offen war. Rein (ohne Netz), damit es testbar ist.

import { betterPrintName, samePrint } from './printMatch';
type PState = 'RUNNING' | 'PREPARE' | 'PAUSE' | 'FINISH' | 'FAILED' | 'IDLE';

interface HistPoint {
  t: number;
  state: string;
}

export interface HaPrint {
  name: string;
  startMs: number;
  endMs: number;
  state: 'FINISH' | 'FAILED';
  percent: number;
  /** Sekunden je Slot (1-4 = AMS, 5 = extern) laut „aktives Fach“ */
  slots: Record<string, number>;
  /** Text des aktiven Fachs, wie HA ihn meldet (zum Nachprüfen im Protokoll) */
  trayRaw: string;
}

const BAD = new Set(['', 'unknown', 'unavailable', 'none', 'null', 'offline']);

/** Status-Text aus Home Assistant (englisch oder deutsch) auf einen Druckzustand abbilden. null = ignorieren (offline, unbekannt) */
export function normStatus(raw: string): PState | null {
  const s = String(raw ?? '').trim().toLowerCase();
  if (BAD.has(s)) return null;
  if (/^(running|printing|läuft|laeuft|druckt|druck läuft)$/.test(s)) return 'RUNNING';
  if (/^(pause|paused|pausiert)$/.test(s)) return 'PAUSE';
  if (/^(finish|finished|fertig|abgeschlossen|beendet)$/.test(s)) return 'FINISH';
  if (/^(failed|fehlgeschlagen|fehler|error|cancelled|canceled|abgebrochen)$/.test(s)) return 'FAILED';
  if (/^(prepare|preparing|slicing|init|vorbereitung|vorbereiten|auto_bed_leveling|heatbed_preheating)$/.test(s)) return 'PREPARE';
  if (/^(idle|leerlauf|bereit|ready)$/.test(s)) return 'IDLE';
  return null;
}

/** Slot aus dem Text des aktiven Fachs: „AMS 1 Slot 2“ → 2, „2“ → 2, „Externe Spule“ → 5. Andere AMS-Einheiten oder Filamentnamen: null. */
export function slotFromTrayText(raw: string): number | null {
  const s = String(raw ?? '').trim().toLowerCase();
  if (BAD.has(s) || s === 'empty' || s === 'leer') return null;
  if (/(extern|external|ext\.?\s*spool|\bvt\b)/.test(s)) return 5;
  const ams = s.match(/ams\s*(?:ht\s*)?(\d+)/);
  if (ams && Number(ams[1]) !== 1) return null; // zweite AMS-Einheit: nur über Material/Farbe
  const m = s.match(/(?:slot|tray|fach|spule)\s*(\d)/) || s.match(/^\s*(\d)\s*$/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 4 ? n : null;
}

const sorted = (pts: HistPoint[]) => [...pts].filter(p => Number.isFinite(p.t)).sort((a, b) => a.t - b.t);

/** Wert, der zum Zeitpunkt t galt (letzter brauchbarer Eintrag bis t) */
export function valueAt(pts: HistPoint[], t: number): string {
  let v = '';
  for (const p of sorted(pts)) {
    if (p.t > t) break;
    if (!BAD.has(String(p.state).trim().toLowerCase())) v = String(p.state);
  }
  return v;
}

/** Letzter Zahlenwert bis t, der die Bedingung erfüllt */
function lastNumber(pts: HistPoint[], t: number, ok: (n: number) => boolean): number {
  let v = 0;
  for (const p of sorted(pts)) {
    if (p.t > t) break;
    const n = Number(p.state);
    if (Number.isFinite(n) && ok(n)) v = n;
  }
  return v;
}

interface HistoryInput {
  status: HistPoint[];
  names?: HistPoint[];
  trays?: HistPoint[];
  progress?: HistPoint[];
  starts?: HistPoint[];
}

/** Dauer je Slot im Zeitraum [from, to] aus dem Verlauf „aktives Fach“ */
function trayDwell(trays: HistPoint[], from: number, to: number): { slots: Record<string, number>; raw: string } {
  const pts = sorted(trays);
  const slots: Record<string, number> = {};
  const rawSec = new Map<string, number>();
  for (let i = 0; i < pts.length; i++) {
    const a = Math.max(pts[i].t, from);
    const b = Math.min(i + 1 < pts.length ? pts[i + 1].t : to, to);
    if (b <= a) continue;
    const sec = (b - a) / 1000;
    const raw = String(pts[i].state);
    if (!BAD.has(raw.trim().toLowerCase())) rawSec.set(raw, (rawSec.get(raw) || 0) + sec);
    const slot = slotFromTrayText(raw);
    if (slot) slots[String(slot)] = Math.round(((slots[String(slot)] || 0) + sec) * 10) / 10;
  }
  const raw = [...rawSec.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] || '';
  return { slots, raw };
}

/** Aus den Verläufen fertige und abgebrochene Drucke bauen (älteste zuerst). Laufende Drucke fehlen absichtlich. */
export function extractPrints(input: HistoryInput): HaPrint[] {
  const names = input.names || [];
  const trays = input.trays || [];
  const progress = input.progress || [];
  const starts = input.starts || [];
  const out: HaPrint[] = [];

  const push = (start: number, end: number, state: 'FINISH' | 'FAILED') => {
    if (end - start < 60_000) return; // Zucken des Sensors, kein Druck
    const name = valueAt(names, end) || valueAt(names, start) || 'Druckauftrag';
    let startMs = start;
    const st = Date.parse(valueAt(starts, end));
    if (Number.isFinite(st) && st > start - 15 * 60_000 && st <= end) startMs = st;
    const percent = state === 'FINISH' ? 100 : Math.max(0, Math.min(99, Math.round(lastNumber(progress, end, n => n > 0))));
    const dwell = trayDwell(trays, start, end);
    out.push({ name, startMs, endMs: end, state, percent, slots: dwell.slots, trayRaw: dwell.raw });
  };

  let open: { start: number } | null = null;
  for (const p of sorted(input.status)) {
    const s = normStatus(p.state);
    if (!s) continue;
    if (s === 'RUNNING' || s === 'PREPARE' || s === 'PAUSE') {
      if (!open) open = { start: p.t };
    } else if (s === 'FINISH' || s === 'FAILED') {
      if (open) push(open.start, p.t, s);
      open = null;
    } else if (s === 'IDLE' && open) {
      // Leerlauf ohne „fertig“ (z. B. Drucker war aus): bei fast 100 % gilt der Druck als fertig
      push(open.start, p.t, lastNumber(progress, p.t, n => n > 0) >= 95 ? 'FINISH' : 'FAILED');
      open = null;
    }
  }
  return out;
}

/** Antwort von /api/history/period (minimal_response) in Punkte je Entität umwandeln */
export function parseHistory(json: unknown): Record<string, HistPoint[]> {
  const out: Record<string, HistPoint[]> = {};
  if (!Array.isArray(json)) return out;
  for (const arr of json) {
    if (!Array.isArray(arr) || arr.length === 0) continue;
    const id = String(arr.find((x: any) => x && x.entity_id)?.entity_id || '');
    if (!id) continue;
    out[id] = arr
      .map((x: any) => ({ t: Date.parse(String(x?.last_changed ?? x?.last_updated ?? '')), state: String(x?.state ?? '') }))
      .filter(p => Number.isFinite(p.t));
  }
  return out;
}

export interface HistorySensors {
  status?: string;
  name?: string;
  tray?: string;
  progress?: string;
  start?: string;
}

/** Sensoren der Bambu-Integration in der Zustandsliste von Home Assistant finden (Ids englisch oder deutsch) */
export function findHistorySensors(states: any[]): HistorySensors {
  const ids = (Array.isArray(states) ? states : []).map(s => String(s?.entity_id || '')).filter(i => i.startsWith('sensor.'));
  const status = ids.find(i => /_(print_status|druckstatus)$/.test(i));
  const prefix = status ? status.replace(/_(print_status|druckstatus)$/, '_') : '';
  const pick = (re: RegExp) => ids.find(i => prefix && i.startsWith(prefix) && re.test(i)) || ids.find(i => re.test(i));
  return {
    status,
    name: pick(/_(subtask_name|task_name|auftragsname)$/),
    tray: pick(/_(active_tray|aktives_fach|aktive_spule)$/) || pick(/_active_tray_index$/),
    progress: pick(/_(print_progress|druckfortschritt)$/),
    start: pick(/_(start_time|startzeit)$/)
  };
}

/** Drucke aus mehreren Quellen zusammenführen (gleicher Name, Ende nah beieinander = ein Druck). Die erste Quelle gewinnt, fehlende Angaben kommen aus den anderen. */
export function mergePrintSources(lists: HaPrint[][], windowMs = 10 * 60_000): HaPrint[] {
  const out: HaPrint[] = [];
  for (const list of lists) {
    for (const p of list) {
      // 1.225: auch ohne Namen („Druckauftrag“ aus dem HA-Verlauf) oder mit anderem Namen bei gleicher Laufzeit = derselbe Druck
      const i = out.findIndex(x => samePrint(x, p, windowMs));
      if (i < 0) {
        out.push({ ...p, slots: { ...p.slots } });
        continue;
      }
      const keep = out[i];
      keep.name = betterPrintName(keep.name, p.name);
      if (!Object.keys(keep.slots).length && Object.keys(p.slots).length) keep.slots = { ...p.slots };
      if (!keep.trayRaw && p.trayRaw) keep.trayRaw = p.trayRaw;
      if (keep.state === 'FAILED' && !keep.percent && p.percent) keep.percent = p.percent;
    }
  }
  return out.sort((a, b) => a.endMs - b.endMs);
}
