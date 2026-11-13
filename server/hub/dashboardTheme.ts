// Glas-Theme für das Dashboard „Drucker“: helle, leicht getönte Karten auf blassem Teal, Eingabefelder und Verläufe gut lesbar.
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
  primary-color: "#5ff0cf"
  accent-color: "#5ff0cf"
  primary-text-color: "#f4fbfb"
  secondary-text-color: "rgba(240,250,250,0.72)"
  disabled-text-color: "rgba(240,250,250,0.45)"
  divider-color: "rgba(255,255,255,0.16)"
  # Karten durchsichtig, Menüs und Auswahllisten deckend (nutzen card-background-color / surface)
  card-background-color: "#6f8f93"
  ha-card-background: "rgba(255,255,255,0.13)"
  ha-card-border-radius: "16px"
  ha-card-border-width: "1px"
  ha-card-border-color: "rgba(255,255,255,0.22)"
  ha-card-box-shadow: "none"
  ha-card-backdrop-filter: "blur(10px)"
  paper-card-background-color: "rgba(255,255,255,0.13)"
  mdc-theme-surface: "#6f8f93"
  md-menu-container-color: "#6f8f93"
  md-sys-color-surface-container: "#6f8f93"
  ha-color-surface-default: "#6f8f93"
  state-icon-color: "#ffffff"
  # Eingabefelder: helles Glas mit weißer Linie (passt zum Pastell-Hintergrund)
  input-fill-color: "rgba(255,255,255,0.24)"
  input-disabled-fill-color: "rgba(255,255,255,0.12)"
  input-ink-color: "#ffffff"
  input-label-ink-color: "rgba(255,255,255,0.8)"
  input-idle-line-color: "#ffffff"
  input-hover-line-color: "#ffffff"
  input-dropdown-icon-color: "#ffffff"
  mdc-text-field-fill-color: "rgba(255,255,255,0.24)"
  mdc-text-field-ink-color: "#ffffff"
  mdc-text-field-label-ink-color: "rgba(255,255,255,0.8)"
  mdc-text-field-idle-line-color: "#ffffff"
  mdc-text-field-hover-line-color: "#ffffff"
  mdc-select-fill-color: "rgba(255,255,255,0.24)"
  mdc-select-ink-color: "#ffffff"
  mdc-select-label-ink-color: "rgba(255,255,255,0.8)"
  mdc-select-idle-line-color: "#ffffff"
  mdc-select-dropdown-icon-color: "#ffffff"
  md-filled-select-text-field-container-color: "rgba(255,255,255,0.24)"
  md-filled-select-text-field-input-text-color: "#ffffff"
  md-filled-select-text-field-label-text-color: "rgba(255,255,255,0.8)"
  md-filled-select-text-field-active-indicator-color: "#ffffff"
  md-filled-text-field-container-color: "rgba(255,255,255,0.24)"
  md-filled-text-field-input-text-color: "#ffffff"
  md-filled-text-field-active-indicator-color: "#ffffff"
  md-filled-field-container-color: "rgba(255,255,255,0.24)"
  md-filled-field-active-indicator-color: "#ffffff"
  ha-color-form-background: "rgba(255,255,255,0.24)"
  # Verläufe: kräftige Farben, heben sich vom hellen Hintergrund ab
  graph-color-1: "#6fe3ff"
  graph-color-2: "#ffd166"
  graph-color-3: "#ff6fd8"
  graph-color-4: "#ff9f6e"
  graph-color-5: "#c79bff"
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
