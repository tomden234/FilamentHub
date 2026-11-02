// AMS-Daten vom Drucker lesen und mit den eigenen Spulen abgleichen („Mit Drucker synchronisieren").
import type { Spool } from '../types/filament';

export interface HwTray {
  /** Slot 1-4 */
  slot: number;
  empty: boolean;
  /** Material laut Drucker, z. B. PLA, PETG-HF */
  type: string;
  /** Farbe laut Drucker (#RRGGBB) oder null */
  colorHex: string | null;
  /** Marke/Sorte laut Drucker, z. B. „Bambu PLA Basic" */
  brand: string;
  minTemp?: number;
  maxTemp?: number;
  /** Restmenge in % (nur Bambu-Spulen mit RFID, sonst -1) */
  remain?: number;
  /** Kennung der Bambu-Spule (RFID, vom AMS selbst gelesen). Leer = keine Bambu-Spule */
  rfid?: string;
}

/** Bambu-RFID einer Spule: tray_uuid (gleich für beide Tags einer Spule), sonst tag_uid. Nur Nullen = keine. */
export function bambuRfidOf(t: any): string {
  const ok = (v: unknown) => {
    const s = String(v || '').trim();
    return /^[0-9a-fA-F]{8,}$/.test(s) && /[1-9a-fA-F]/.test(s) ? s.toUpperCase() : '';
  };
  return ok(t?.tray_uuid) || ok(t?.tag_uid);
}

function hexOf(raw: unknown): string | null {
  const h = String(raw || '').replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}/.test(h)) return null;
  return '#' + h.slice(0, 6).toUpperCase();
}

/** Die 4 Slots der ersten AMS-Einheit. Leere Liste, wenn der Drucker (noch) nichts gemeldet hat. */
export function readTrays(ams: any): HwTray[] {
  const unit = Array.isArray(ams?.ams) ? ams.ams[0] : null;
  const trays: any[] = Array.isArray(unit?.tray) ? unit.tray : [];
  if (!unit) return [];
  return [0, 1, 2, 3].map(i => {
    const t = trays.find(x => String(x?.id) === String(i)) ?? trays[i];
    const type = String(t?.tray_type || '').trim();
    const color = hexOf(Array.isArray(t?.cols) && t.cols.length ? t.cols[0] : t?.tray_color);
    return {
      slot: i + 1,
      empty: !type,
      type,
      colorHex: type ? color : null,
      brand: String(t?.tray_sub_brands || '').trim(),
      minTemp: t?.nozzle_temp_min != null ? Number(t.nozzle_temp_min) : undefined,
      maxTemp: t?.nozzle_temp_max != null ? Number(t.nozzle_temp_max) : undefined,
      remain: t?.remain != null ? Number(t.remain) : undefined,
      rfid: type ? bambuRfidOf(t) : ''
    };
  });
}

/** Externe Spule (Spulenhalter hinten, `vt_tray`). Slot-Nr. 5, zählt NICHT zum AMS. Null = Drucker hat nichts gemeldet. */
export const EXTERNAL_SLOT = 5;
export function readExternal(vt: any): HwTray | null {
  if (!vt || typeof vt !== 'object') return null;
  const type = String(vt.tray_type || '').trim();
  const color = hexOf(Array.isArray(vt.cols) && vt.cols.length ? vt.cols[0] : vt.tray_color);
  return {
    slot: EXTERNAL_SLOT,
    empty: !type,
    type,
    colorHex: type ? color : null,
    brand: String(vt.tray_sub_brands || '').trim(),
    minTemp: vt.nozzle_temp_min != null ? Number(vt.nozzle_temp_min) : undefined,
    maxTemp: vt.nozzle_temp_max != null ? Number(vt.nozzle_temp_max) : undefined,
    remain: vt.remain != null ? Number(vt.remain) : undefined
  };
}

/** Aktiver Slot (1-4) laut Drucker, sonst null. tray_now zählt über alle AMS: 0-3 = erste Einheit, 254 = extern, 255 = keiner. */
export function activeSlotFromPrinter(ams: any): number | null {
  // X2D/H2D: der Kern legt den aktiven Platz der aktiven Düse in fh_active ab (1-4 AMS, 5 extern, 0 keiner)
  if (ams && typeof ams.fh_active === 'number') return ams.fh_active >= 1 && ams.fh_active <= 5 ? ams.fh_active : null;
  const n = Number(ams?.tray_now);
  if (n === 254) return EXTERNAL_SLOT; // externe Spule aktiv
  return Number.isInteger(n) && n >= 0 && n <= 3 ? n + 1 : null;
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '').padEnd(6, '0');
  return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0];
}

/** Farbabstand 0 (gleich) bis ~441 (Schwarz/Weiß) */
export function colorDistance(a: string, b: string): number {
  const [r, g, bl] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.sqrt((r - r2) ** 2 + (g - g2) ** 2 + (bl - b2) ** 2);
}

/** Grundmaterial: „PETG-HF" → PETG, „PLA Matte" → PLA */
export function baseMaterial(m: string): string {
  const u = String(m || '').toUpperCase();
  const known = ['PETG', 'PLA', 'ABS', 'ASA', 'TPU', 'PCTG', 'PC', 'PA', 'PET', 'PVA', 'HIPS', 'PP'];
  return known.find(k => u.startsWith(k)) || (u.match(/[A-Z]+/)?.[0] ?? '');
}

/** Ab diesem Abstand gilt eine Farbe als „passt nicht" */
export const COLOR_TOLERANCE = 110;

function fits(spool: Spool, tray: HwTray): number | null {
  if (tray.empty) return null;
  if (baseMaterial(spool.material) !== baseMaterial(tray.type)) return null;
  if (!tray.colorHex) return 0;
  const d = colorDistance(spool.colorHex || '#888888', tray.colorHex);
  return d <= COLOR_TOLERANCE ? d : null;
}

/** Farbe/Material der zugewiesenen Spule passt nicht zum Slot laut Drucker */
export function mismatch(spool: Spool | undefined, tray: HwTray | undefined): boolean {
  if (!spool || !tray || tray.empty) return false;
  return fits(spool, tray) === null;
}

/**
 * Ordnet jedem Slot die passendste Spule zu (gleiches Material, ähnlichste Farbe, Marke als Bonus).
 * Eine bisherige Zuweisung bleibt, solange sie passt. Leere Slots werden geleert.
 */
export function syncSlots(
  spools: Spool[],
  trays: HwTray[],
  current: Record<number, string>
): { slots: Record<number, string>; lines: string[] } {
  const slots: Record<number, string> = {};
  const used = new Set<string>();
  const lines: string[] = [];

  // 1. Bestehende, weiterhin passende Zuweisungen behalten
  for (const t of trays) {
    const keep = spools.find(s => s.id === current[t.slot]);
    if (keep && fits(keep, t) !== null) {
      slots[t.slot] = keep.id;
      used.add(keep.id);
    }
  }

  // 2. Restliche Slots neu zuordnen
  for (const t of trays) {
    if (slots[t.slot]) {
      const s = spools.find(x => x.id === slots[t.slot]);
      lines.push(`Slot ${t.slot}: ${s?.brand ?? ''} ${s?.name ?? ''}`.trim());
      continue;
    }
    if (t.empty) {
      slots[t.slot] = '';
      lines.push(`Slot ${t.slot}: leer`);
      continue;
    }
    let best: Spool | null = null;
    let bestScore = Infinity;
    for (const s of spools) {
      if (used.has(s.id) || (s.remainingWeight ?? 1) <= 0) continue;
      const d = fits(s, t);
      if (d === null) continue;
      const firstWord = (s.brand || '').toLowerCase().split(' ')[0];
      const brandBonus = t.brand && firstWord && t.brand.toLowerCase().includes(firstWord) ? -15 : 0;
      const score = d + brandBonus;
      if (score < bestScore) {
        bestScore = score;
        best = s;
      }
    }
    if (best) {
      slots[t.slot] = best.id;
      used.add(best.id);
      lines.push(`Slot ${t.slot}: ${best.brand} ${best.name}`);
    } else {
      slots[t.slot] = '';
      lines.push(`Slot ${t.slot}: keine passende Spule (${t.type}${t.colorHex ? ' ' + t.colorHex : ''})`);
    }
  }
  return { slots, lines };
}
