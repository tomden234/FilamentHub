// Welche Druckermeldungen sind wichtig genug für eine Mitteilung? (reine Logik, ohne Browser, darum gut testbar)
import { hmsCode, hmsSeverity, type HmsEntry } from './hms';

/** Zustände, in denen ein Druck läuft oder gerade fehlgeschlagen ist */
export const JOB_STATES: ReadonlySet<string> = new Set(['RUNNING', 'PAUSE', 'FAILED']);
/** Abbruch durch dich (kommt schon als „Druck fehlgeschlagen/abgebrochen“) */
export const CANCELED_PRINT_ERROR = 0x0300400c;
/** „MQTT command verification failed“: Antwort auf App-Befehle, wird dort angezeigt */
export const IGNORE_HMS: ReadonlySet<string> = new Set(['0500_0500_0001_0007']);

/** Standard-Modus: nur schwere Meldungen (Stufe „Kritisch“ oder „Ernst“), nur während Druck, Pause oder Fehler. */
export function hmsIsImportant(h: HmsEntry, gcodeState: string | undefined): boolean {
  if (IGNORE_HMS.has(hmsCode(h))) return false;
  if (!JOB_STATES.has(String(gcodeState || ''))) return false;
  const level = hmsSeverity(h).level;
  return level === 1 || level === 2;
}

/** Standard-Modus: Druckfehler-Code (Grund) nur, wenn der Druck wirklich fehlgeschlagen ist und nicht von dir abgebrochen wurde. */
export function printErrorIsImportant(err: number, gcodeState: string | undefined): boolean {
  return Boolean(err) && err !== CANCELED_PRINT_ERROR && gcodeState === 'FAILED';
}
