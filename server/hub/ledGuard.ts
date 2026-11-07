// Status-LED nach „Fehler quittiert“ ausschalten (1.238).
// Die Automation in Home Assistant lässt den Streifen bei „failed“ rot blinken, bis sich der Druckstatus ändert. Der Drucker meldet nach dem
// Quittieren am Display aber weiter „FAILED“ (nur der Fehlercode wird 0). Darum schaltet der Pi den Streifen aus, sobald der Fehler weg ist.
import { haAvailable, haStates, haSwitch } from './ha.js';

export interface GuardState {
  /** In diesem FAILED wurde schon ein Fehler gesehen */
  seenError: boolean;
  /** Streifen wurde für dieses FAILED schon ausgeschaltet */
  off: boolean;
}

export const newGuard = (): GuardState => ({ seenError: false, off: false });

/** Ist am Drucker ein Fehler offen? Fehlercode oder ernste HMS-Meldung (Stufe 1-2) */
export function errorOpen(d: any): boolean {
  if (Number(d?.print_error) > 0) return true;
  const hms: any[] = Array.isArray(d?.hms) ? d.hms : [];
  return hms.some(h => {
    const lvl = Math.floor((Number(h?.code) >>> 0) / 0x10000);
    return lvl >= 1 && lvl <= 2;
  });
}

/** Reiner Schritt: gibt den neuen Zustand und zurück, ob der Streifen jetzt aus soll */
export function guardStep(prev: GuardState, gs: string, d: any): { next: GuardState; turnOff: boolean } {
  if (gs !== 'FAILED') return { next: newGuard(), turnOff: false };
  const open = errorOpen(d);
  if (open) return { next: { seenError: true, off: false }, turnOff: false };
  // Fehler war offen und ist jetzt weg = am Drucker quittiert
  if (prev.seenError && !prev.off) return { next: { seenError: true, off: true }, turnOff: true };
  return { next: prev, turnOff: false };
}

let guard = newGuard();

/** Takt (alle 30 s) */
export async function ledGuard(gs: string, d: any): Promise<void> {
  const { next, turnOff } = guardStep(guard, gs, d);
  guard = next;
  if (!turnOff || !haAvailable()) return;
  try {
    const states = await haStates();
    const light = (states || []).find(s => String(s?.entity_id || '').startsWith('light.') && Array.isArray(s?.attributes?.effect_list) && s.attributes.effect_list.includes('Percent'));
    if (!light) {
      guard = { ...guard, off: false }; // beim nächsten Takt nochmal versuchen
      return;
    }
    if (!(await haSwitch(String(light.entity_id), false))) guard = { ...guard, off: false };
  } catch {
    guard = { ...guard, off: false };
  }
}
