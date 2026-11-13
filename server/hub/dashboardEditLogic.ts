// Eingabefelder im Dashboard „Drucker“: reine Regeln (Namen, Grenzen, Farben). Ohne Netz, getestet.
import { colorDistance } from '../../src/utils/amsMatch.js';

export const MATERIALS = ['PLA', 'PLA+', 'PETG', 'TPU', 'ABS', 'ASA', 'PA / Nylon', 'PC', 'PET-CF / PA-CF'] as const;

/** Farbnamen zur Auswahl im Dashboard (Name → Farbwert) */
export const COLORS: { name: string; hex: string }[] = [
  { name: 'Schwarz', hex: '#1A1A1A' },
  { name: 'Weiß', hex: '#FFFFFF' },
  { name: 'Grau', hex: '#808080' },
  { name: 'Silber', hex: '#C0C0C0' },
  { name: 'Rot', hex: '#C62828' },
  { name: 'Orange', hex: '#EF6C00' },
  { name: 'Gelb', hex: '#F1C40F' },
  { name: 'Grün', hex: '#2E7D32' },
  { name: 'Türkis', hex: '#00ACC1' },
  { name: 'Blau', hex: '#1565C0' },
  { name: 'Lila', hex: '#7B1FA2' },
  { name: 'Pink', hex: '#EC407A' },
  { name: 'Braun', hex: '#6D4C41' },
  { name: 'Beige', hex: '#D7C4A3' },
  { name: 'Transparent', hex: '#E8F1F5' }
];

/** Plätze: 1-4 = AMS, 5 = externe Spule */
export const SLOTS = [1, 2, 3, 4, 5] as const;

/** Grenzen für Soll-Temperaturen (°C): Düse bis 300, Bett bis 120 */
export const LIMITS = { nozzle: { min: 0, max: 300, step: 5 }, bed: { min: 0, max: 120, step: 5 } } as const;

export const ID = {
  nozzleSoll: 'input_number.filamenthub_duese_soll',
  bedSoll: 'input_number.filamenthub_bett_soll',
  material: (slot: number) => `input_select.filamenthub_slot_${slot}_material`,
  color: (slot: number) => `input_select.filamenthub_slot_${slot}_farbe`,
  grams: (slot: number) => `input_number.filamenthub_slot_${slot}_gramm`
};

/** Alle Eingabefelder (Id → Anlegen-Befehl für Home Assistant) */
export function helperDefs(): { id: string; domain: 'input_select' | 'input_number'; name: string; body: Record<string, unknown> }[] {
  const out: { id: string; domain: 'input_select' | 'input_number'; name: string; body: Record<string, unknown> }[] = [];
  const num = (id: string, name: string, min: number, max: number, step: number, unit: string, icon: string) =>
    out.push({ id, domain: 'input_number', name, body: { name, min, max, step, mode: 'box', unit_of_measurement: unit, icon } });
  const sel = (id: string, name: string, options: string[], icon: string) => out.push({ id, domain: 'input_select', name, body: { name, options, icon } });
  num(ID.nozzleSoll, 'FilamentHub Duese Soll', LIMITS.nozzle.min, LIMITS.nozzle.max, LIMITS.nozzle.step, '°C', 'mdi:printer-3d-nozzle-heat');
  num(ID.bedSoll, 'FilamentHub Bett Soll', LIMITS.bed.min, LIMITS.bed.max, LIMITS.bed.step, '°C', 'mdi:radiator');
  for (const s of SLOTS) {
    const label = `Slot ${s}`; // Name bestimmt die Id (Platz 5 = extern)
    sel(ID.material(s), `FilamentHub ${label} Material`, [...MATERIALS], 'mdi:layers-triple');
    sel(ID.color(s), `FilamentHub ${label} Farbe`, COLORS.map(c => c.name), 'mdi:palette');
    num(ID.grams(s), `FilamentHub ${label} Gramm`, 0, 1000, 1, 'g', 'mdi:weight-gram');
  }
  return out;
}

/** Soll-Temperatur begrenzen (Zahl, ganze Grad, innerhalb der Grenzen). Ungültig = null */
export function clampSoll(kind: 'nozzle' | 'bed', v: unknown): number | null {
  const n = Number(v);
  if (v === '' || v === null || v === undefined || !Number.isFinite(n)) return null;
  const l = LIMITS[kind];
  return Math.max(l.min, Math.min(l.max, Math.round(n)));
}

/** Farbname zum Farbwert: der nächste in der Liste */
export function nearestColorName(hex: string): string {
  const h = /^#?[0-9a-fA-F]{6}$/.test(String(hex || '')) ? `#${String(hex).replace('#', '')}` : '#808080';
  let best = COLORS[0]!;
  let d = Infinity;
  for (const c of COLORS) {
    const x = colorDistance(h, c.hex);
    if (x < d) {
      d = x;
      best = c;
    }
  }
  return best.name;
}

export const colorHexOf = (name: string): string | null => COLORS.find(c => c.name === name)?.hex ?? null;

/** Material aus Text (Drucker meldet z. B. „PLA“, „PETG-HF“) zur Auswahl-Liste */
export function materialOption(m: string): string | null {
  const t = String(m || '').trim();
  if (!t) return null;
  const exact = MATERIALS.find(x => x.toLowerCase() === t.toLowerCase());
  if (exact) return exact;
  const base = t.split(/[\s\-_/]/)[0]!.toUpperCase();
  return MATERIALS.find(x => x.toUpperCase() === base) || null;
}

/** Platznummer einer Spule am Drucker: AMS 0 → 1-4, extern → 5, sonst null (HT-Einheiten haben keinen Platz im Dashboard) */
export const slotOfTray = (t: { amsId: number; slotId: number }): number | null => (t.amsId === 255 ? 5 : t.amsId === 0 && t.slotId >= 0 && t.slotId <= 3 ? t.slotId + 1 : null);

/** Welches Feld gehört zu welchem Platz? „input_select.filamenthub_slot_2_farbe“ → { slot: 2, field: 'color' } */
export function parseSlotEntity(entity: string): { slot: number; field: 'material' | 'color' | 'grams' } | null {
  const m = /^input_(?:select|number)\.filamenthub_slot_([1-5])_(material|farbe|gramm)$/.exec(entity);
  if (!m) return null;
  return { slot: Number(m[1]), field: m[2] === 'material' ? 'material' : m[2] === 'farbe' ? 'color' : 'grams' };
}
