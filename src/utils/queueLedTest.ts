// LED-Test der Warteschlange (1.235): zeigt am Streifen der Reihe nach alle Zustände mit den echten Farben.
// Reine Beschreibung der Schritte (ohne Netz), damit sie testbar ist. Die Farben stehen so in filament-ams.yaml.

export interface LedStep {
  /** Was der Streifen gerade zeigt, in einem Satz */
  text: string;
  /** Anzahl LEDs im Stapel */
  count: number;
  /** ESP-Modus: 0 normal, 1 rot blinken, 2 grün, 3 Platte räumen */
  mode: 0 | 1 | 2 | 3;
  /** Wie lange der Schritt steht (ms) */
  ms: number;
}

/** Legende mit den echten Farben aus der ESP-Datei */
export const LED_LEGEND: { color: string; label: string }[] = [
  { color: 'rgb(0,90,255)', label: 'Blau: so viele Drucke warten (Stapel von unten)' },
  { color: 'rgb(150,210,255)', label: 'Hellblau: neuer Druck fällt von oben rein' },
  { color: 'rgb(255,70,0)', label: 'Orange: Platte räumen (freie LEDs oben)' },
  { color: 'rgb(0,255,0)', label: 'Grün: nächster Druck startet' },
  { color: 'rgb(255,0,0)', label: 'Rot blinkt: Fehler' }
];

/** Ablauf für `n` Drucke (1 bis 10) */
export function ledTestSteps(n: number): LedStep[] {
  const max = Math.max(1, Math.min(10, Math.round(n) || 1));
  const steps: LedStep[] = [{ text: 'Streifen leer', count: 0, mode: 0, ms: 1000 }];
  for (let i = 1; i <= max; i++) steps.push({ text: `Stapel wächst: ${i} von ${max} (blau, hellblau fällt rein)`, count: i, mode: 0, ms: 1500 });
  steps.push({ text: 'Platte räumen: freie LEDs orange', count: max, mode: 3, ms: 3000 });
  steps.push({ text: 'Nächster Druck startet: alles grün', count: max, mode: 2, ms: 2500 });
  steps.push({ text: 'Fehler: rot blinkt', count: max, mode: 1, ms: 3000 });
  steps.push({ text: 'Zurück auf normal', count: max, mode: 0, ms: 1200 });
  return steps;
}
