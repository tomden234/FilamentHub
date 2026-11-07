import path from 'path';
import { rootDir, dataDir } from './paths.js';
import { loadJsonConfig, saveJsonConfig } from './jsonConfig.js';
import { isAllowedHaUrl } from './netCheck.js';

// --- HOME ASSISTANT INTEGRATION (Lokales Netzwerk / Nabu Casa) ---
const haDataConfigPath = path.join(dataDir, 'ha-config.json');
/** Alter Speicherort (nur noch lesen) */
const haLegacyConfigPath = path.resolve(rootDir, '.ha-config.json');

interface HaConfig {
  haUrl: string;
  haToken: string;
  cameraEntity: string;
  switchEntity: string;
  isConfigured: boolean;
}

export function loadHaConfig(): HaConfig {
  const data = loadJsonConfig<any>([haDataConfigPath, haLegacyConfigPath], d => Boolean(d && (d.haUrl || d.haToken)));
  if (data) {
    return {
      haUrl: String(data.haUrl || ''),
      haToken: String(data.haToken || ''),
      cameraEntity: String(data.cameraEntity || 'camera.bambu_x2d'),
      switchEntity: String(data.switchEntity || 'switch.3d_drucker_steckdose'),
      isConfigured: true
    };
  }
  return {
    haUrl: process.env.HA_URL || '',
    haToken: process.env.HA_TOKEN || '',
    cameraEntity: process.env.HA_CAMERA_ENTITY || 'camera.bambu_x2d',
    switchEntity: process.env.HA_SWITCH_ENTITY || 'switch.3d_drucker_steckdose',
    isConfigured: Boolean(process.env.HA_URL || process.env.HA_TOKEN)
  };
}

export function saveHaConfig(config: { haUrl: string; haToken: string; cameraEntity: string; switchEntity: string }) {
  saveJsonConfig(haDataConfigPath, config, 'HA-Konfiguration');
}

/**
 * Ziel für einen Aufruf an Home Assistant. Eine Adresse aus der Anfrage gilt nur zusammen mit einem Token aus der Anfrage,
 * sonst würde der gespeicherte Token an eine fremde Adresse geschickt (1.229). Fremde Adressen nur im Heimnetz/Nabu Casa (1.231).
 */
export function haTarget(urlOverride: unknown, tokenOverride: unknown): { url: string; token: string } {
  const cfg = loadHaConfig();
  const tok = typeof tokenOverride === 'string' ? tokenOverride.trim() : '';
  const u = typeof urlOverride === 'string' ? urlOverride.trim() : '';
  // 1.231: fremde Adresse nur Nabu Casa / Heimnetz / *.local (kein Weiterleiten an beliebige Server im Internet)
  const own = tok && u && isAllowedHaUrl(u);
  // 1.233: auch die gespeicherte Adresse nur Nabu Casa / Heimnetz / *.local (sonst ginge der Token an einen fremden Server)
  const url = (own ? u : cfg.haUrl && isAllowedHaUrl(cfg.haUrl) ? cfg.haUrl : '').trim().replace(/\/+$/, '');
  return { url, token: own ? tok : cfg.haToken || '' };
}
