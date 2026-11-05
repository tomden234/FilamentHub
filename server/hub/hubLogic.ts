// Reine Logik des Hubs (ohne Netz, testbar): Ruhezeit, Wochen, Strom, Wochenbericht, AMS-Zuordnung für die Warteschlange, ESP-YAML.
import { baseMaterial, colorDistance } from '../../src/utils/amsMatch.js';

// ---------- Ruhezeit ----------

/** Liegt die Stunde in der Ruhezeit? (von 22 bis 7 = über Mitternacht) */
export function inQuietHours(hour: number, from: number, to: number): boolean {
  if (from === to) return false;
  return from < to ? hour >= from && hour < to : hour >= from || hour < to;
}

// ---------- Wochen ----------

/** Montag der Woche als „JJJJ-MM-TT“ (Ortszeit) */
export function weekKey(t: number): string {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function weekStartMs(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

// ---------- Strom ----------

export interface EnergyWeek {
  /** Wattstunden der Steckdose gesamt (Drucken, Trocknen, Standby) */
  totalWh: number;
  /** davon während Drucken */
  printWh: number;
}

/** Leistung über die Zeit aufsummieren (W × Sekunden → Wh). Lücken über 5 Minuten zählen nicht (Pi war aus). */
export function addEnergy(weeks: Record<string, EnergyWeek>, t: number, watts: number, dtMs: number, printing: boolean): Record<string, EnergyWeek> {
  if (!(watts >= 0) || !(dtMs > 0) || dtMs > 5 * 60_000) return weeks;
  const wh = (watts * dtMs) / 3600_000;
  const k = weekKey(t);
  const w = weeks[k] || { totalWh: 0, printWh: 0 };
  const next = { ...weeks, [k]: { totalWh: w.totalWh + wh, printWh: w.printWh + (printing ? wh : 0) } };
  // Nur 26 Wochen behalten
  const keys = Object.keys(next).sort();
  for (const old of keys.slice(0, Math.max(0, keys.length - 26))) delete next[old];
  return next;
}

// ---------- Wochenbericht ----------

export interface ReportInput {
  now: number;
  prints: { name: string; endMs: number; state: string }[];
  history: { grams: number; timestamp: string; spoolId: string }[];
  spools: { id: string; brand?: string; name?: string; pricePerKg?: number; remainingWeight: number }[];
  energy: EnergyWeek | undefined;
  kwhPrice: number;
  lowWeightG: number;
}

const euro = (v: number) => v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const kwh = (wh: number) => `${(wh / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} kWh`;

/** Text des Wochenberichts (Woche ab Montag bis jetzt) */
export function weeklyReport(i: ReportInput): { title: string; text: string } {
  const from = weekStartMs(i.now);
  const prints = i.prints.filter(p => p.endMs >= from && p.endMs <= i.now);
  const done = prints.filter(p => p.state === 'FINISH').length;
  const failed = prints.length - done;
  const price = new Map(i.spools.map(s => [s.id, Number(s.pricePerKg) || 0]));
  let grams = 0;
  let cost = 0;
  for (const h of i.history) {
    const t = Date.parse(h.timestamp);
    if (!(h.grams > 0) || !(t >= from && t <= i.now)) continue;
    grams += h.grams;
    cost += (h.grams / 1000) * (price.get(h.spoolId) || 0);
  }
  const lines: string[] = [];
  lines.push(prints.length ? `🖨️ ${prints.length} Drucke (${done} fertig${failed ? `, ${failed} abgebrochen` : ''})` : '🖨️ Keine Drucke');
  if (grams > 0) lines.push(`🧵 ${Math.round(grams)} g Filament · ${euro(cost)}`);
  if (i.energy && i.energy.totalWh > 0) {
    const e = i.energy;
    lines.push(`⚡ ${kwh(e.totalWh)} Strom · ${euro((e.totalWh / 1000) * i.kwhPrice)}${e.printWh > 0 ? ` (Drucken ${kwh(e.printWh)})` : ''}`);
  }
  const total = cost + (i.energy ? (i.energy.totalWh / 1000) * i.kwhPrice : 0);
  if (total > 0) lines.push(`💶 Zusammen ${euro(total)}`);
  const low = i.spools.filter(s => i.lowWeightG > 0 && s.remainingWeight > 0 && s.remainingWeight <= i.lowWeightG);
  if (low.length) lines.push(`⚠️ Fast leer: ${low.map(s => `${`${s.brand || ''} ${s.name || ''}`.trim()} (${Math.round(s.remainingWeight)} g)`).join(', ')}`);
  return { title: '📊 Deine 3D-Druck-Woche', text: lines.join('\n') };
}

// ---------- Warteschlange: Filament der Datei → AMS-Platz ----------

export interface AmsTray {
  /** Nummer der AMS-Einheit laut Drucker (0, 1 …; 128+ = AMS HT; 255 = extern) */
  amsId: number;
  /** Platz in der Einheit (0-3) */
  slotId: number;
  type: string;
  colorHex: string;
}

/** Alle belegten Plätze aller AMS-Einheiten plus extern */
export function allTrays(ams: any, vt: any): AmsTray[] {
  const out: AmsTray[] = [];
  const units: any[] = Array.isArray(ams?.ams) ? ams.ams : [];
  units.forEach((u, ui) => {
    const amsId = Number.isFinite(Number(u?.id)) ? Number(u.id) : ui;
    const trays: any[] = Array.isArray(u?.tray) ? u.tray : [];
    trays.forEach((t, ti) => {
      const type = String(t?.tray_type || '').trim();
      if (!type) return;
      const raw = String(Array.isArray(t?.cols) && t.cols.length ? t.cols[0] : t?.tray_color || '888888').replace('#', '');
      out.push({ amsId, slotId: Number.isFinite(Number(t?.id)) ? Number(t.id) : ti, type, colorHex: '#' + raw.slice(0, 6).toUpperCase() });
    });
  });
  const vtType = String(vt?.tray_type || '').trim();
  if (vtType) out.push({ amsId: 255, slotId: 0, type: vtType, colorHex: '#' + String(vt?.tray_color || '888888').replace('#', '').slice(0, 6).toUpperCase() });
  return out;
}

export interface Mapping {
  amsMapping: number[];
  amsMapping2: { ams_id: number; slot_id: number }[];
  /** Zum Anzeigen: „PLA Weiß → AMS 1 Slot 2“ */
  lines: string[];
  /** Filament ohne passenden Platz (dann nicht starten) */
  missing: string[];
}

export const trayLabel = (t: { amsId: number; slotId: number }) => (t.amsId === 255 ? 'Extern' : `AMS ${t.amsId >= 128 ? `HT ${t.amsId - 127}` : t.amsId + 1} Slot ${t.slotId + 1}`);

/** Für jedes Filament der Datei den passenden Platz suchen: gleiches Grundmaterial, nächste Farbe. */
export function mapFilaments(filaments: { id: number; type: string; colorHex: string; grams: number }[], trays: AmsTray[]): Mapping {
  const maxId = Math.max(0, ...filaments.map(f => f.id));
  const amsMapping: number[] = Array.from({ length: maxId }, () => -1);
  const amsMapping2: { ams_id: number; slot_id: number }[] = Array.from({ length: maxId }, () => ({ ams_id: 255, slot_id: 255 }));
  const lines: string[] = [];
  const missing: string[] = [];
  for (const f of filaments) {
    const same = trays.filter(t => baseMaterial(t.type) === baseMaterial(f.type));
    if (!same.length) {
      missing.push(`${f.type} ${f.colorHex}`);
      continue;
    }
    const t = same.reduce((a, b) => (colorDistance(a.colorHex, f.colorHex) <= colorDistance(b.colorHex, f.colorHex) ? a : b));
    const idx = f.id - 1;
    if (idx < 0) continue;
    amsMapping[idx] = t.amsId === 255 ? 254 : t.amsId * 4 + t.slotId;
    amsMapping2[idx] = t.amsId === 255 ? { ams_id: 255, slot_id: 0 } : { ams_id: t.amsId, slot_id: t.slotId };
    lines.push(`${f.type} ${f.colorHex} (${Math.round(f.grams)} g) → ${trayLabel(t)}`);
  }
  return { amsMapping, amsMapping2, lines, missing };
}

/** Fehlt ein Material der Datei komplett im AMS? (Material-Wächter) */
export function missingMaterials(filaments: { type: string }[], trays: AmsTray[]): string[] {
  const have = new Set(trays.map(t => baseMaterial(t.type)));
  return Array.from(new Set(filaments.map(f => baseMaterial(f.type)).filter(m => m && !have.has(m))));
}

// ---------- ESP-YAML: neue Fassung übernehmen, eigene Werte (substitutions) behalten ----------

/** Werte aus dem Block „substitutions:“ lesen */
export function readSubstitutions(yaml: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = yaml.split(/\r?\n/);
  const start = lines.findIndex(l => /^substitutions:\s*$/.test(l));
  if (start < 0) return out;
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^\S/.test(l)) break; // nächster Block
    const m = l.match(/^ {2}([A-Za-z0-9_]+):\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

/** Neue YAML mit den eigenen Werten aus der alten (z. B. led_count, led_cap) */
export function mergeEspYaml(newYaml: string, oldYaml: string): string {
  const keep = readSubstitutions(oldYaml);
  const lines = newYaml.split(/\r?\n/);
  const start = lines.findIndex(l => /^substitutions:\s*$/.test(l));
  if (start < 0) return newYaml;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\S/.test(lines[i])) break;
    const m = lines[i].match(/^( {2})([A-Za-z0-9_]+):\s*(.*?)\s*$/);
    if (m && keep[m[2]] !== undefined) lines[i] = `${m[1]}${m[2]}: ${keep[m[2]]}`;
  }
  return lines.join('\n');
}

/** Revision aus der ersten Zeile („# Erstellt: … (Revision 1.199)“) */
export function yamlRevision(yaml: string): string {
  return yaml.split(/\r?\n/)[0]?.match(/Revision\s+([\d.]+)/)?.[1] || '';
}

// ---------- Stillstand ----------

/** Hängt der Druck? Fortschritt und Schicht seit 30 Minuten gleich, obwohl er läuft */
export function stalled(lastChangeMs: number, now: number, limitMs = 30 * 60_000): boolean {
  return lastChangeMs > 0 && now - lastChangeMs >= limitMs;
}
