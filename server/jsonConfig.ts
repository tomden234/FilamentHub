// Kleine Helfer für Dateien des Servers: sicher schreiben (nie halbe Dateien) und mit Rückfall auf die Vorversion lesen.
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

/** Vorversion einer Datei (wird von writeFileAtomic mit keepPrev angelegt) */
export const prevOf = (file: string): string => file.replace(/(\.[a-z0-9]+)?$/i, m => `.prev${m}`);

/**
 * 1.231: Datei sicher schreiben: erst in eine Zwischendatei, auf die Platte zwingen (fsync), dann umbenennen.
 * So bleibt bei Stromausfall immer die alte oder die neue Fassung ganz erhalten. Standard: nur für den Besitzer lesbar.
 * keepPrev: die bisherige Fassung als „.prev“ behalten (Rückfall beim Lesen).
 */
export function writeFileAtomic(file: string, data: string | Uint8Array, opts: { mode?: number; keepPrev?: boolean } = {}): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  const fd = fs.openSync(tmp, 'w', opts.mode ?? 0o600);
  try {
    fs.writeSync(fd, typeof data === 'string' ? Buffer.from(data, 'utf8') : data);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  if (opts.keepPrev && fs.existsSync(file)) {
    try {
      fs.copyFileSync(file, prevOf(file));
    } catch {
      /* Vorversion ist nur ein Zusatz */
    }
  }
  fs.renameSync(tmp, file);
}

/** JSON sicher schreiben (siehe writeFileAtomic). Gibt false zurück statt zu werfen. */
export function saveJsonConfig(file: string, value: unknown, label = 'Konfiguration', opts: { pretty?: boolean; keepPrev?: boolean } = {}): boolean {
  try {
    writeFileAtomic(file, JSON.stringify(value, null, opts.pretty === false ? undefined : 2), { keepPrev: opts.keepPrev });
    return true;
  } catch (err) {
    console.error(`Fehler beim Speichern der ${label}:`, (err as Error)?.message || err);
    return false;
  }
}

/** JSON lesen; ist die Datei kaputt oder fehlt, die Vorversion (.prev) nehmen. */
export function readJsonWithPrev<T>(file: string, ok: (d: T) => boolean = () => true): T | null {
  return loadJsonConfig<T>([file, prevOf(file)], ok);
}
