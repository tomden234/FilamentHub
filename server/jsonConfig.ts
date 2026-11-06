// Kleine Helfer für JSON-Konfigurationsdateien des Servers (lesen mit Fallback-Pfaden, sicher schreiben).
import fs from 'fs';
import path from 'path';

/** Erste lesbare Datei aus der Liste, die `ok` erfüllt (sonst null). Kaputte Dateien werden übersprungen. */
export function loadJsonConfig<T>(files: string[], ok: (d: T) => boolean = () => true): T | null {
  for (const f of files) {
    try {
      if (!fs.existsSync(f)) continue;
      const d = JSON.parse(fs.readFileSync(f, 'utf8')) as T;
      if (ok(d)) return d;
    } catch {
      /* nächste Datei */
    }
  }
  return null;
}

/** Schreibt über eine Zwischendatei (kein halbes JSON bei Stromausfall). Nur für den Besitzer lesbar. */
export function saveJsonConfig(file: string, value: unknown, label = 'Konfiguration'): boolean {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file + '.tmp', JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(file + '.tmp', file);
    return true;
  } catch (err) {
    console.error(`Fehler beim Speichern der ${label}:`, (err as Error)?.message || err);
    return false;
  }
}
