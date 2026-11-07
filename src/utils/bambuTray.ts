// Daten einer Bambu-Spule, wie das AMS sie aus dem RFID-Chip liest (über MQTT, auch im LAN-Modus).
// Nur lesen: Die App beschreibt oder kopiert Bambu-Chips nie.
import type { MaterialType, Spool } from '../types/filament';
import { COLOR_MAP } from '../data/defaultSpools';
import { bambuRfidOf, colorDistance } from './amsMatch';

export interface BambuTrayInfo {
  slot: number;
  rfid: string;
  /** z. B. „PLA Basic“, „PETG HF“ */
  product: string;
  type: string;
  colorHex: string;
  /** Rest in % (−1 = unbekannt) */
  remainPct: number;
  /** Nettogewicht der vollen Spule laut Chip (g) */
  fullWeight: number;
  nozzleMin?: number;
  nozzleMax?: number;
  dryTemp?: number;
  dryHours?: number;
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/** Bambu-Spulen im AMS (nur Slots mit RFID-Kennung) */
export function readBambuTrays(ams: any): BambuTrayInfo[] {
  const unit = Array.isArray(ams?.ams) ? ams.ams[0] : null;
  const trays: any[] = Array.isArray(unit?.tray) ? unit.tray : [];
  const out: BambuTrayInfo[] = [];
  [0, 1, 2, 3].forEach(i => {
    const t = trays.find(x => String(x?.id) === String(i)) ?? trays[i];
    const type = String(t?.tray_type || '').trim();
    const rfid = type ? bambuRfidOf(t) : '';
    if (!rfid) return;
    const col = String((Array.isArray(t?.cols) && t.cols.length ? t.cols[0] : t?.tray_color) || '888888').replace('#', '');
    out.push({
      slot: i + 1,
      rfid,
      product: String(t?.tray_sub_brands || '').trim() || type,
      type,
      colorHex: '#' + (col.slice(0, 6).toUpperCase() || '888888'),
      remainPct: num(t?.remain) ?? -1,
      fullWeight: num(t?.tray_weight) || 1000,
      nozzleMin: num(t?.nozzle_temp_min),
      nozzleMax: num(t?.nozzle_temp_max),
      dryTemp: num(t?.drying_temp) || undefined,
      dryHours: num(t?.drying_time) || undefined
    });
  });
  return out;
}

/** Bambu-Materialname (z. B. „PETG HF“, „PA6-CF“, „PLA-CF“) → Material der App */
function materialOf(type: string): MaterialType {
  const t = type.replace(/\s+/g, '').toUpperCase();
  if (/^(PA|PET|PPA|PAHT)[-]?\d*[-]?(CF|GF)/.test(t)) return 'PET-CF / PA-CF';
  if (/^(PA|PPA|NYLON)/.test(t)) return 'PA / Nylon';
  if (/^(PETG|PCTG)/.test(t)) return 'PETG';
  if (/^PLA/.test(t)) return 'PLA';
  if (/^TPU/.test(t)) return 'TPU';
  if (/^ABS/.test(t)) return 'ABS';
  if (/^ASA/.test(t)) return 'ASA';
  if (/^PC/.test(t)) return 'PC';
  return 'PLA';
}

/** Nächster Farbname aus der Farbliste der App */
export function colorNameOf(hex: string): string {
  let best = 'Farbe';
  let bestD = Infinity;
  for (const c of COLOR_MAP) {
    const d = colorDistance(hex, c.hex);
    if (d < bestD) {
      bestD = d;
      best = c.name;
    }
  }
  return bestD < 120 ? best : 'Farbe';
}

/** Vorbefüllung für „Neue Spule“ aus den Chip-Daten */
export function spoolFromBambu(b: BambuTrayInfo): Partial<Spool> {
  const colorName = colorNameOf(b.colorHex);
  const remaining = b.remainPct >= 0 ? Math.round((b.fullWeight * b.remainPct) / 100) : b.fullWeight;
  const nozzle = b.nozzleMin && b.nozzleMax ? Math.round((b.nozzleMin + b.nozzleMax) / 2 / 5) * 5 : undefined;
  return {
    brand: 'Bambu Lab',
    name: `${b.product} ${colorName === 'Farbe' ? '' : colorName}`.trim(),
    material: materialOf(b.type),
    colorName,
    colorHex: b.colorHex,
    initialWeight: b.fullWeight,
    remainingWeight: remaining,
    onSpool: true,
    nozzleTemp: nozzle,
    ...(b.dryTemp ? { dryTemp: b.dryTemp } : {}),
    ...(b.dryHours ? { dryHours: b.dryHours } : {}),
    bambuRfid: b.rfid
  };
}
