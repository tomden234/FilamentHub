// Theme für das Dashboard „Drucker“: dunkle Glaskarten mit weißer Schrift auf dem Pastell-Hintergrund, Schrift Outfit, kräftige Verläufe.
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
  # Schrift Outfit (liefert der Server als Dashboard-Ressource mit)
  primary-font-family: "'Outfit', Roboto, sans-serif"
  paper-font-common-base_-_font-family: "'Outfit', Roboto, sans-serif"
  ha-font-family-body: "'Outfit', Roboto, sans-serif"
  ha-font-family-heading: "'Outfit', Roboto, sans-serif"
  primary-color: "#5ff0cf"
  accent-color: "#5ff0cf"
  primary-text-color: "#ffffff"
  secondary-text-color: "rgba(255,255,255,0.72)"
  disabled-text-color: "rgba(255,255,255,0.45)"
  divider-color: "rgba(255,255,255,0.14)"
  # Dunkle Glaskarten (gut lesbar auf dem Pastell-Hintergrund), Menüs und Listen deckend
  card-background-color: "#22313a"
  ha-card-background: "rgba(18,28,32,0.62)"
  ha-card-border-radius: "16px"
  ha-card-border-width: "1px"
  ha-card-border-color: "rgba(255,255,255,0.14)"
  ha-card-box-shadow: "0 4px 18px rgba(0,0,0,0.18)"
  ha-card-backdrop-filter: "blur(10px)"
  paper-card-background-color: "rgba(18,28,32,0.62)"
  mdc-theme-surface: "#22313a"
  md-menu-container-color: "#22313a"
  md-sys-color-surface-container: "#22313a"
  ha-color-surface-default: "#22313a"
  state-icon-color: "#9ff7e4"
  # Eingabefelder: leicht hell auf dunkler Karte, türkise Linie
  input-fill-color: "rgba(255,255,255,0.10)"
  input-disabled-fill-color: "rgba(255,255,255,0.05)"
  input-ink-color: "#ffffff"
  input-label-ink-color: "rgba(255,255,255,0.72)"
  input-idle-line-color: "#5ff0cf"
  input-hover-line-color: "#9ff7e4"
  input-dropdown-icon-color: "#ffffff"
  mdc-text-field-fill-color: "rgba(255,255,255,0.10)"
  mdc-text-field-ink-color: "#ffffff"
  mdc-text-field-label-ink-color: "rgba(255,255,255,0.72)"
  mdc-text-field-idle-line-color: "#5ff0cf"
  mdc-text-field-hover-line-color: "#9ff7e4"
  mdc-select-fill-color: "rgba(255,255,255,0.10)"
  mdc-select-ink-color: "#ffffff"
  mdc-select-label-ink-color: "rgba(255,255,255,0.72)"
  mdc-select-idle-line-color: "#5ff0cf"
  mdc-select-dropdown-icon-color: "#ffffff"
  md-filled-select-text-field-container-color: "rgba(255,255,255,0.10)"
  md-filled-select-text-field-input-text-color: "#ffffff"
  md-filled-select-text-field-label-text-color: "rgba(255,255,255,0.72)"
  md-filled-select-text-field-active-indicator-color: "#5ff0cf"
  md-filled-text-field-container-color: "rgba(255,255,255,0.10)"
  md-filled-text-field-input-text-color: "#ffffff"
  md-filled-text-field-active-indicator-color: "#5ff0cf"
  md-filled-field-container-color: "rgba(255,255,255,0.10)"
  md-filled-field-active-indicator-color: "#5ff0cf"
  ha-color-form-background: "rgba(255,255,255,0.10)"
  # Verläufe: kräftige Farben
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
