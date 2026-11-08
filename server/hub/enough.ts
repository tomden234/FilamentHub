// 1.260: „Reicht die Spule?“ – reine Logik (ohne Netz, darum testbar).
// Je Filament einer Druckdatei: Gramm + Puffer gegen den Rest der Spule im gewählten Platz.
// Reicht es nicht, gibt es Ersatz-Spulen (gleiches Material, ähnliche Farbe, kleinster passender Rest zuerst).
import { baseMaterial, colorDistance, EXTERNAL_SLOT } from '../../src/utils/amsMatch.js';

export interface EnoughSpool {
  id: string;
  brand?: string;
  name?: string;
  material: string;
  colorHex?: string;
  colorName?: string;
  productUrl?: string;
  remainingWeight: number;
}

/** Angaben für den Kauf-Link der App */
export interface EnoughBuy {
  brand: string;
  material: string;
  name: string;
  colorName: string;
  url: string;
}

export interface EnoughAlt {
  id: string;
  label: string;
  remaining: number;
  colorHex: string;
}

export interface EnoughInfo {
  /** Filament-Nummer der Datei */
  id: number;
  /** Nötig (g) inkl. Puffer; bei zwei Filamenten auf derselben Spule die Summe */
  need: number;
  /** Rest der Spule im Platz (g); null = Spule nicht zugeordnet */
  have: number | null;
  /** false = reicht nicht (nur wenn die Spule bekannt ist) */
  ok: boolean;
  spoolId: string;
  spoolLabel: string;
  /** Fehlbetrag in g (0 = reicht) */
  missing: number;
  alternatives: EnoughAlt[];
  /** Nur wenn es nicht reicht: Angaben zum Nachkaufen derselben Spule */
  buy?: EnoughBuy;
}

export const BUFFER = 1.1;
/** Farbabstand (0-441), bis zu dem eine Ersatzspule noch „ähnlich“ gilt */
export const ALT_COLOR_MAX = 60;

const label = (s: EnoughSpool) => `${s.brand || ''} ${s.name || ''}`.trim() || s.material;

/** „amsId:slotId“ → Platz-Nummer der App (AMS 1 = 1-4, extern = 5); weitere AMS-Einheiten haben keine Zuordnung */
export function slotNumber(key: string): number | null {
  const m = String(key || '').match(/^(\d+):(\d+)$/);
  if (!m) return null;
  const ams = Number(m[1]);
  const slot = Number(m[2]);
  if (ams === 255) return EXTERNAL_SLOT;
  if (ams === 0 && slot >= 0 && slot <= 3) return slot + 1;
  return null;
}

export function checkEnough(i: {
  filaments: { id: number; type: string; colorHex: string; grams: number }[];
  /** Gewählter Platz je Filament-Nummer (Schlüssel „amsId:slotId“) */
  chosen: Record<number, { key: string }>;
  /** Platz-Nummer → Spulen-ID (aus der App) */
  amsSlots: Record<string, string>;
  spools: EnoughSpool[];
}): EnoughInfo[] {
  // Gramm je Spule zusammenzählen: zwei Filamente der Datei können dieselbe Spule nutzen
  const sums = new Map<string, number>();
  const spoolOf = new Map<number, EnoughSpool>();
  for (const f of i.filaments) {
    const n = slotNumber(i.chosen[f.id]?.key || '');
    const sp = n ? i.spools.find(s => s.id === i.amsSlots[String(n)]) : undefined;
    if (!sp) continue;
    spoolOf.set(f.id, sp);
    sums.set(sp.id, (sums.get(sp.id) || 0) + Math.max(0, f.grams));
  }
  return i.filaments.map(f => {
    const sp = spoolOf.get(f.id);
    if (!sp) return { id: f.id, need: Math.round(f.grams * BUFFER), have: null, ok: true, spoolId: '', spoolLabel: '', missing: 0, alternatives: [] };
    const need = Math.round((sums.get(sp.id) || 0) * BUFFER);
    const have = Math.round(Number(sp.remainingWeight) || 0);
    const ok = have >= need;
    const alternatives: EnoughAlt[] = ok
      ? []
      : i.spools
          .filter(s => s.id !== sp.id && baseMaterial(s.material) === baseMaterial(f.type) && Number(s.remainingWeight) >= need && colorDistance(s.colorHex || '#888888', f.colorHex) <= ALT_COLOR_MAX)
          .sort((a, b) => a.remainingWeight - b.remainingWeight)
          .slice(0, 3)
          .map(s => ({ id: s.id, label: label(s), remaining: Math.round(s.remainingWeight), colorHex: s.colorHex || '#888888' }));
    return { id: f.id, need, have, ok, spoolId: sp.id, spoolLabel: label(sp), missing: ok ? 0 : need - have, alternatives, ...(ok ? {} : { buy: { brand: String(sp.brand || ''), material: String(sp.material || ''), name: String(sp.name || ''), colorName: String(sp.colorName || ''), url: String(sp.productUrl || '') } }) };
  });
}

/** Kurztexte für Push und Log, nur für Filamente, die nicht reichen */
export function enoughLines(list: EnoughInfo[]): string[] {
  return list
    .filter(e => !e.ok)
    .map(e => {
      const alt = e.alternatives[0];
      return `📉 ${e.spoolLabel}: braucht ca. ${e.need} g, da ${e.have} g${alt ? `. Besser: ${alt.label} (${alt.remaining} g)` : '. Keine passende Ersatz-Spule da'}`;
    });
}
