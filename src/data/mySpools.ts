import type { Spool } from '../types/filament';

// Optionale eigene Startliste (nur für dich, nicht Teil des Projekts).
//
// So geht es:
//  1. Lege die Datei src/data/mySpools.local.ts an (sie steht in der .gitignore und wird nie hochgeladen).
//  2. Inhalt:
//       import type { Spool } from '../types/filament';
//       export const MY_SPOOLS: Spool[] = [ /* deine Spulen, Felder siehe src/types/filament.ts */ ];
//       export const MY_SPOOLS_STAMP = 0; // 0 = nichts ersetzen
//  3. MY_SPOOLS_STAMP = Zeitpunkt in Millisekunden (z. B. Date.now() im Browser) → beim nächsten Start ersetzt jedes Gerät
//     seinen Bestand genau einmal durch diese Liste (die alte Liste bleibt als Notfall-Kopie im Gerät).
//     Der Zeitstempel zählt wie eine Änderung zu dieser Zeit: Hat ein anderes Gerät später etwas geändert,
//     gewinnt dessen Stand. Eine leere Liste mit Zeitstempel bedeutet „alles raus“.
//
// Ohne diese Datei startet die App leer, und du legst Spulen in der App an oder importierst ein Backup.

interface LocalSeed {
  MY_SPOOLS?: Spool[];
  MY_SPOOLS_STAMP?: number;
}

const local = import.meta.glob('./mySpools.local.ts', { eager: true }) as Record<string, LocalSeed>;
const mod: LocalSeed | undefined = Object.values(local)[0];

export const MY_SPOOLS: Spool[] = mod?.MY_SPOOLS ?? [];

export const MY_SPOOLS_SEED: { stamp: number; spools: Spool[] } = {
  stamp: mod?.MY_SPOOLS_STAMP ?? 0,
  spools: MY_SPOOLS
};
