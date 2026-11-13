// Glas-Theme für das Dashboard „Drucker“: Karten fast durchsichtig, damit der Drucker ohne Kasten auf dem Hintergrund steht.
// Der Pi legt die Datei in /homeassistant/themes ab und lädt die Themes neu. Home Assistant braucht dafür in configuration.yaml:
//   frontend:
//     themes: !include_dir_merge_named themes
import fs from 'fs';
import path from 'path';
import { writeFileAtomic } from '../jsonConfig.js';
import { haService } from './ha.js';
import { THEME } from './dashboardConfig.js';

const CONFIG_DIRS = ['/homeassistant', '/config'];

export const THEME_YAML = `# FilamentHub: vom Server geschrieben, wird bei Änderungen überschrieben
${THEME}:
  primary-color: "#38d6b4"
  accent-color: "#38d6b4"
  primary-text-color: "#f4f8fb"
  secondary-text-color: "#9fb4c4"
  disabled-text-color: "#6b7f8f"
  divider-color: "rgba(255,255,255,0.12)"
  card-background-color: "rgba(255,255,255,0.07)"
  ha-card-background: "rgba(255,255,255,0.07)"
  ha-card-border-radius: "22px"
  ha-card-border-width: "1px"
  ha-card-border-color: "rgba(255,255,255,0.14)"
  ha-card-box-shadow: "none"
  ha-card-backdrop-filter: "blur(10px)"
  paper-card-background-color: "rgba(255,255,255,0.07)"
  state-icon-color: "#9fb4c4"
`;

export interface ThemeResult {
  ok: boolean;
  /** Hinweis für den Nutzer (leer = alles gut) */
  hint: string;
}

/** Theme-Datei ablegen (nur bei Änderung) und Themes neu laden */
export async function ensureTheme(): Promise<ThemeResult> {
  const base = CONFIG_DIRS.find(d => fs.existsSync(d));
  if (!base) return { ok: false, hint: 'Konfigurationsordner von Home Assistant nicht gefunden' };
  try {
    const dir = path.join(base, 'themes');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'filamenthub.yaml');
    const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : '';
    if (old !== THEME_YAML) {
      writeFileAtomic(file, THEME_YAML, { mode: 0o644 });
      await haService('frontend', 'reload_themes', {});
    }
    let hint = '';
    try {
      const cfg = fs.readFileSync(path.join(base, 'configuration.yaml'), 'utf-8');
      if (!/^\s*themes:\s*!include_dir_merge_named\s+themes/m.test(cfg)) hint = 'In configuration.yaml fehlt: frontend: / themes: !include_dir_merge_named themes (dann Home Assistant neu starten). Ohne das bleiben die Karten dunkel statt durchsichtig.';
    } catch {
      /* configuration.yaml nicht lesbar: kein Hinweis */
    }
    return { ok: true, hint };
  } catch (e) {
    return { ok: false, hint: `Theme nicht geschrieben: ${(e as Error)?.message || e}` };
  }
}
