// Zustand einer Spule: mit/ohne Spule, verschweißt, Eibos-Beutel, muss trocknen.
// Alte Daten kennen nur die Notiz („Im Eibos Beutel“, „Original verschweißt ohne Spule“): daraus werden die Felder einmalig abgeleitet.
import { sanitizeSpoolList } from './safeData';
import type { Spool } from '../types/filament';

const NOTE_EIBOS = /eibos/i;
const NOTE_SEALED = /verschwei|eingeschwei|original verpackt|ungeöffnet|ungeoeffnet/i;

/** Sitzt das Filament auf einer Spule? (Refill ohne Spule: onSpool = false oder Leerspule 0 g) */
export function hasSpoolBody(s: Pick<Spool, 'onSpool' | 'emptySpoolWeight'>): boolean {
  if (typeof s.onSpool === 'boolean') return s.onSpool;
  return Number(s.emptySpoolWeight) > 0;
}

/** Gewicht der Leerspule für die Waage: ohne Spule 0 g, sonst eigener Wert oder der Marken-Standard */
export function spoolTara(s: Pick<Spool, 'onSpool' | 'emptySpoolWeight'>, brandTara: number): number {
  if (!hasSpoolBody(s)) return 0;
  const own = Number(s.emptySpoolWeight);
  return own > 0 ? own : brandTara || 200;
}

export function isInEibos(s: Pick<Spool, 'inEibos' | 'storageNote'>): boolean {
  if (typeof s.inEibos === 'boolean') return s.inEibos;
  return NOTE_EIBOS.test(s.storageNote || '');
}

export function isSealed(s: Pick<Spool, 'sealed' | 'storageNote'>): boolean {
  if (typeof s.sealed === 'boolean') return s.sealed;
  return NOTE_SEALED.test(s.storageNote || '');
}

/** Fehlende Felder aus Notiz und Leerspulengewicht füllen (ändert vorhandene Angaben nie) */
function normalizeSpool(s: Spool): Spool {
  const out: Spool = { ...s };
  let changed = false;
  if (typeof out.onSpool !== 'boolean') {
    out.onSpool = Number(out.emptySpoolWeight) > 0;
    changed = true;
  }
  if (typeof out.inEibos !== 'boolean') {
    out.inEibos = NOTE_EIBOS.test(out.storageNote || '');
    changed = true;
  }
  if (typeof out.sealed !== 'boolean') {
    out.sealed = NOTE_SEALED.test(out.storageNote || '');
    changed = true;
  }
  return changed ? out : s;
}

/** Fehlende Felder füllen und fremde Daten säubern (1.233): ungültige Einträge entfallen, Links nur http(s) */
export const normalizeSpools = (list: Spool[]): Spool[] => sanitizeSpoolList(list).map(normalizeSpool);
