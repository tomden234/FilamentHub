// Eingabefelder im Dashboard „Drucker“: reine Regeln (Namen, Grenzen, Spulen-Auswahl). Ohne Netz, getestet.

/** Plätze: 1-4 = AMS, 5 = externe Spule */
export const SLOTS = [1, 2, 3, 4, 5] as const;

/** Auswahl „kein Filament“ in der Spulen-Liste */
export const EMPTY = '— leer —';

/** Grenzen für Soll-Temperaturen (°C): Düsen bis 300, Bett bis 120 */
export const LIMITS = { nozzle: { min: 0, max: 300, step: 5 }, bed: { min: 0, max: 120, step: 5 } } as const;

export const ID = {
  nozzleSoll: 'input_number.filamenthub_duese_soll',
  nozzle2Soll: 'input_number.filamenthub_duese_2_soll',
  bedSoll: 'input_number.filamenthub_bett_soll',
  spool: (slot: number) => `input_select.filamenthub_slot_${slot}_spule`
};

/** Felder aus 1.305 (Material/Farbe/Gramm je Platz): werden in Home Assistant gelöscht */
export const OLD_HELPERS: { domain: 'input_select' | 'input_number'; id: string }[] = SLOTS.flatMap(s => [
  { domain: 'input_select' as const, id: `filamenthub_slot_${s}_material` },
  { domain: 'input_select' as const, id: `filamenthub_slot_${s}_farbe` },
  { domain: 'input_number' as const, id: `filamenthub_slot_${s}_gramm` }
]);

/** Alle Eingabefelder (Id → Anlegen-Befehl für Home Assistant) */
export function helperDefs(): { id: string; domain: 'input_select' | 'input_number'; name: string; body: Record<string, unknown> }[] {
  const num = (id: string, name: string, l: { min: number; max: number; step: number }, icon: string) => ({
    id,
    domain: 'input_number' as const,
    name,
    body: { name, min: l.min, max: l.max, step: l.step, mode: 'box', unit_of_measurement: '°C', icon }
  });
  return [
    num(ID.nozzleSoll, 'FilamentHub Duese Soll', LIMITS.nozzle, 'mdi:printer-3d-nozzle-heat'),
    num(ID.nozzle2Soll, 'FilamentHub Duese 2 Soll', LIMITS.nozzle, 'mdi:printer-3d-nozzle-heat'),
    num(ID.bedSoll, 'FilamentHub Bett Soll', LIMITS.bed, 'mdi:radiator'),
    // Name bestimmt die Id (Platz 5 = extern). Die Liste der Spulen setzt der Pi im Takt.
    ...SLOTS.map(s => ({ id: ID.spool(s), domain: 'input_select' as const, name: `FilamentHub Slot ${s} Spule`, body: { name: `FilamentHub Slot ${s} Spule`, options: [EMPTY], icon: 'mdi:printer-3d-nozzle' } }))
  ];
}

/** Soll-Temperatur begrenzen (Zahl, ganze Grad, innerhalb der Grenzen). Ungültig = null */
export function clampSoll(kind: 'nozzle' | 'bed', v: unknown): number | null {
  const n = Number(v);
  if (v === '' || v === null || v === undefined || !Number.isFinite(n)) return null;
  const l = LIMITS[kind];
  return Math.max(l.min, Math.min(l.max, Math.round(n)));
}

/** Welches Soll-Feld ist das? → Ziel am Drucker (wie in der App: Düse 1 links, Düse 2 rechts) */
export function sollTarget(entity: string): { target: 'nozzle1' | 'nozzle2' | 'bed'; kind: 'nozzle' | 'bed'; label: string } | null {
  if (entity === ID.nozzleSoll) return { target: 'nozzle1', kind: 'nozzle', label: 'Düse 1' };
  if (entity === ID.nozzle2Soll) return { target: 'nozzle2', kind: 'nozzle', label: 'Düse 2' };
  if (entity === ID.bedSoll) return { target: 'bed', kind: 'bed', label: 'Bett' };
  return null;
}

/** Platz eines Spulen-Felds: „input_select.filamenthub_slot_2_spule“ → 2 */
export function parseSpoolEntity(entity: string): number | null {
  const m = /^input_select\.filamenthub_slot_([1-5])_spule$/.exec(entity);
  return m ? Number(m[1]) : null;
}

/** Platznummer einer Spule am Drucker: AMS 0 → 1-4, extern → 5, sonst null (HT-Einheiten haben keinen Platz im Dashboard) */
export const slotOfTray = (t: { amsId: number; slotId: number }): number | null => (t.amsId === 255 ? 5 : t.amsId === 0 && t.slotId >= 0 && t.slotId <= 3 ? t.slotId + 1 : null);

export interface SpoolLite {
  id: string;
  brand?: string;
  material?: string;
  colorName?: string;
  remainingWeight?: number;
  initialWeight?: number;
}

export interface SpoolOptions {
  /** Auswahl-Liste (erst „leer“, dann die Spulen) */
  options: string[];
  /** Text → Spulen-Id */
  idOf: Map<string, string>;
  /** Spulen-Id → Text */
  labelOf: Map<string, string>;
}

/** Text einer Spule: „Sunlu PLA+ Gelb · 640 g (64 %)“ */
export function spoolLabel(s: SpoolLite): string {
  const g = Math.max(0, Math.round(Number(s.remainingWeight) || 0));
  const full = Number(s.initialWeight) > 0 ? Number(s.initialWeight) : 1000;
  const pct = Math.max(0, Math.min(100, Math.round((g / full) * 100)));
  const name = [s.brand, s.material, s.colorName].map(x => String(x || '').trim()).filter(Boolean).join(' ') || 'Spule';
  return `${name.slice(0, 80)} · ${g} g (${pct} %)`;
}

/** Auswahl-Liste aus dem Lager: Spulen mit Rest, dazu die gerade belegten (auch wenn leer). Gleiche Texte bekommen „#2“, „#3“. */
export function spoolOptions(spools: SpoolLite[], keep: string[] = []): SpoolOptions {
  const k = new Set(keep.filter(Boolean));
  const list = (Array.isArray(spools) ? spools : [])
    .filter(s => s && typeof s.id === 'string' && s.id && ((Number(s.remainingWeight) || 0) > 0 || k.has(s.id)))
    .sort((a, b) => spoolLabel(a).localeCompare(spoolLabel(b), 'de') || a.id.localeCompare(b.id));
  const options = [EMPTY];
  const idOf = new Map<string, string>();
  const labelOf = new Map<string, string>();
  for (const s of list) {
    const base = spoolLabel(s);
    let label = base;
    for (let n = 2; idOf.has(label); n++) label = `${base} #${n}`;
    options.push(label);
    idOf.set(label, s.id);
    labelOf.set(s.id, label);
  }
  return { options, idOf, labelOf };
}
