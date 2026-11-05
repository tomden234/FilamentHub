// ESP-Update übers WLAN: Der Pi holt die neueste YAML des AMS-ESP von GitHub und legt sie in den ESPHome-Ordner von Home Assistant
// (/homeassistant/esphome). Eigene Werte (led_count, led_cap …) bleiben. Danach in ESPHome nur noch „Installieren“ → „Drahtlos“.
import fs from 'fs';
import path from 'path';
import { mergeEspYaml, yamlRevision } from './hubLogic.js';

const RAW = 'https://raw.githubusercontent.com/tomden234/filament-website-google-ai/main/hardware/ams-nfc/filament-ams.yaml';
const DIRS = ['/homeassistant/esphome', '/config/esphome'];

export interface EspSyncInfo {
  at: number;
  ok: boolean;
  text: string;
  revision: string;
  file: string;
}

let info: EspSyncInfo | null = null;
export const espInfo = () => info;

function esphomeDir(): string | null {
  for (const d of DIRS) if (fs.existsSync(d)) return d;
  return null;
}

/** Datei des AMS-ESP im ESPHome-Ordner finden (Name egal, erkannt am Inhalt) */
function findTarget(dir: string): string {
  for (const f of fs.readdirSync(dir)) {
    if (!/\.ya?ml$/i.test(f) || f === 'secrets.yaml') continue;
    try {
      const t = fs.readFileSync(path.join(dir, f), 'utf-8');
      if (/FilamentHub: NFC-Leser im AMS/.test(t) || /^\s*name:\s*filament-ams\s*$/m.test(t)) return path.join(dir, f);
    } catch {
      /* weiter */
    }
  }
  return path.join(dir, 'filament-ams.yaml');
}

/** Neueste YAML holen und ablegen. Gibt zurück, ob es eine neue Fassung gab. */
export async function syncEspYaml(): Promise<{ changed: boolean; info: EspSyncInfo }> {
  const dir = esphomeDir();
  if (!dir) {
    info = { at: Date.now(), ok: false, text: 'ESPHome-Ordner nicht gefunden (ESPHome-App in Home Assistant installieren).', revision: '', file: '' };
    return { changed: false, info };
  }
  try {
    const r = await fetch(RAW, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`GitHub antwortet mit ${r.status}`);
    const fresh = await r.text();
    if (!/^esphome:/m.test(fresh)) throw new Error('Datei sieht nicht wie eine ESPHome-YAML aus');
    const target = findTarget(dir);
    const old = fs.existsSync(target) ? fs.readFileSync(target, 'utf-8') : '';
    const merged = old ? mergeEspYaml(fresh, old) : fresh;
    const rev = yamlRevision(fresh);
    if (merged === old) {
      info = { at: Date.now(), ok: true, text: `Aktuell (Revision ${rev || '?'})`, revision: rev, file: target };
      return { changed: false, info };
    }
    if (old) fs.writeFileSync(target + '.bak', old, 'utf-8');
    fs.writeFileSync(target, merged, 'utf-8');
    info = { at: Date.now(), ok: true, text: `Neue Fassung (Revision ${rev || '?'}) abgelegt: ${path.basename(target)}`, revision: rev, file: target };
    console.log(`[Hub] ESP-YAML aktualisiert: ${target} (Revision ${rev})`);
    return { changed: true, info };
  } catch (e) {
    info = { at: Date.now(), ok: false, text: `ESP-YAML: ${(e as Error)?.message || e}`, revision: '', file: '' };
    return { changed: false, info };
  }
}

// ---------- Bilder für Push-Meldungen (über Home Assistant /local/…) ----------

const WWW = ['/homeassistant/www', '/config/www'];

/** Foto in den www-Ordner von Home Assistant legen, damit die Push-Meldung es zeigen kann (auch unterwegs). Gibt /local/… zurück. */
export function publishImage(jpeg: Buffer, name: string): string | null {
  const base = WWW.find(d => fs.existsSync(path.dirname(d)) && (fs.existsSync(d) || tryMk(d)));
  if (!base) return null;
  const dir = path.join(base, 'filamenthub');
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name), jpeg);
    const files = fs
      .readdirSync(dir)
      .map(f => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    for (const x of files.slice(40)) fs.unlinkSync(path.join(dir, x.f));
    return `/local/filamenthub/${name}`;
  } catch {
    return null;
  }
}

function tryMk(d: string): boolean {
  try {
    fs.mkdirSync(d, { recursive: true });
    return true;
  } catch {
    return false;
  }
}
