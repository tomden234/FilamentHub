// Licht im Drucker beim Trocknen: reine Entscheidungslogik (ohne Browser, darum testbar).
// Läuft die AMS-Trocknung und es wird nicht gedruckt, braucht niemand das Bauraum-Licht: es geht einmal je Trocknung aus.
import { ACTIVE_STATES } from './printSession';

/** So lange muss die Lage (Trocknung läuft, kein Druck, Licht an) bestehen, bevor das Licht ausgeht (kurze Datenaussetzer) */
export const DRY_LIGHT_HOLD_MS = 15_000;
/** So lange ohne Trocknung, dann zählt die nächste Trocknung als neue (Licht darf wieder ausgehen) */
export const DRY_LIGHT_RESET_MS = 60_000;

export interface DryLightInput {
  enabled: boolean;
  connected: boolean;
  dryingNow: boolean;
  gcodeState?: string;
  lightOn: boolean;
  /** Für diese Trocknung ist das Licht schon einmal ausgegangen (du kannst es danach wieder anmachen) */
  alreadyDone: boolean;
  /** Wie lange besteht die Lage schon (ms) */
  heldMs: number;
}

/** Ist die Lage „Trocknung läuft, kein Druck“? */
export function dryIdleSituation(connected: boolean, dryingNow: boolean, gcodeState?: string): boolean {
  return connected && dryingNow && !ACTIVE_STATES.has(String(gcodeState || ''));
}

export function dryLightShouldTurnOff(i: DryLightInput): boolean {
  if (!i.enabled || i.alreadyDone || !i.lightOn) return false;
  if (!dryIdleSituation(i.connected, i.dryingNow, i.gcodeState)) return false;
  return i.heldMs >= DRY_LIGHT_HOLD_MS;
}
