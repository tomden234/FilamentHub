import { Router } from 'express';
import { loadHaConfig, saveHaConfig, haTarget } from '../haConfig.js';
import { isRawAllowed } from '../haRawAllow.js';

const router = Router();

// 1.229: Entitäten nur in genau diesem Format (sonst ließe sich jedes Gerät schalten oder der API-Pfad verbiegen)
const SWITCH_ID = /^(switch|light)\.[a-z0-9_]+$/;
const CAMERA_ID = /^camera\.[a-z0-9_]+$/;
const isStr = (v: unknown): v is string => typeof v === 'string';

// Begrenzte Weiterleitung an Home Assistant (Browser dürfen Nabu Casa oft nicht direkt ansprechen, der Server schon).
// Erlaubt sind nur: Zustände lesen, die FilamentHub-Automationen anlegen, Automationen ein-/ausschalten und die Status-LED
// (ein Licht mit Farbe/Helligkeit/Effekt, ein Intensity-Regler). Die Regeln stehen in server/haRawAllow.ts.
router.post('/api/homeassistant/raw', async (req, res) => {
  try {
    const { method = 'GET', path = '', body } = req.body || {};
    // 1.229: fremde Adresse nur zusammen mit eigenem Token (sonst ginge der gespeicherte Token an diese Adresse)
    const { url, token } = haTarget(req.body?.haUrl, req.body?.haToken);
    if (!url || !token) return res.status(400).json({ success: false, error: 'Home Assistant URL und Token erforderlich.' });
    if (!/^https?:\/\//i.test(url)) return res.status(400).json({ success: false, error: 'Ungültige Adresse.' });
    if (!isRawAllowed(String(method), String(path), body)) {
      return res.status(403).json({ success: false, error: 'Diese Anfrage ist nicht erlaubt.' });
    }
    const resp = await fetch(`${url}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
      signal: AbortSignal.timeout(25000)
    });
    const text = await resp.text();
    return res.json({ success: true, status: resp.status, text });
  } catch (e: any) {
    return res.status(502).json({ success: false, error: String(e?.message || e) });
  }
});

// HA Konfiguration abrufen (ohne Token)
router.get('/api/homeassistant/config', (_req, res) => {
  const config = loadHaConfig();
  return res.json({
    haUrl: config.haUrl,
    hasToken: Boolean(config.haToken && config.haToken.length > 5),
    cameraEntity: config.cameraEntity,
    switchEntity: config.switchEntity,
    isConfigured: config.isConfigured
  });
});

// HA Konfiguration speichern
router.post('/api/homeassistant/config', (req, res) => {
  const { haUrl, haToken, cameraEntity, switchEntity } = req.body || {};
  const current = loadHaConfig();
  const url = isStr(haUrl) ? haUrl.trim().replace(/\/+$/, '') : current.haUrl;
  if (url && !/^https?:\/\/[^\s/]+/i.test(url)) return res.status(400).json({ success: false, error: 'Ungültige Adresse.' });
  const cam = isStr(cameraEntity) && cameraEntity.trim() ? cameraEntity.trim() : current.cameraEntity;
  const sw = isStr(switchEntity) && switchEntity.trim() ? switchEntity.trim() : current.switchEntity;
  const updated = {
    haUrl: url,
    haToken: isStr(haToken) && haToken.trim().length > 0 ? haToken.trim().slice(0, 1000) : current.haToken,
    cameraEntity: CAMERA_ID.test(cam) ? cam : current.cameraEntity,
    switchEntity: SWITCH_ID.test(sw) ? sw : current.switchEntity
  };
  saveHaConfig(updated);
  const { haToken: _hidden, ...visible } = updated;
  return res.json({ success: true, message: 'Home Assistant Zugangsdaten gespeichert!', config: { ...visible, hasToken: Boolean(updated.haToken) } });
});

// HA Verbindung testen & Entitäten auflisten (Kameras & Steckdosen)
router.post('/api/homeassistant/test', async (req, res) => {
  try {
    const { url, token } = haTarget(req.body?.haUrl, req.body?.haToken);
    if (!url || !token) {
      return res.status(400).json({ success: false, error: 'Home Assistant URL und Token erforderlich.' });
    }
    if (!/^https?:\/\//i.test(url)) return res.status(400).json({ success: false, error: 'Ungültige Adresse.' });

    const resp = await fetch(`${url}/api/states`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(4000)
    });

    if (!resp.ok) {
      let specificHint = '';
      if (resp.status === 401) {
        specificHint = ' Home Assistant meldet HTTP 401 Unauthorized: Das gespeicherte Token wurde in Home Assistant widerrufen oder ist ungültig. Bitte erstelle in HA (Profil unten links → Langlebige Zugangs-Token) ein neues Token und speichere es hier.';
      }
      return res.status(resp.status).json({
        success: false,
        status: resp.status,
        error: specificHint || `Home Assistant antwortete mit HTTP ${resp.status} (${resp.statusText}). Token oder URL prüfen.`
      });
    }

    const states = (await resp.json()) as any[];
    const pick = (prefixes: string[]) =>
      states
        .filter((s: any) => isStr(s?.entity_id) && prefixes.some(p => s.entity_id.startsWith(p)))
        .map((s: any) => ({ entity_id: s.entity_id, name: s.attributes?.friendly_name || s.entity_id, state: s.state }));
    const cameras = pick(['camera.']);
    const switches = pick(['switch.', 'light.']);

    return res.json({
      success: true,
      message: `Erfolgreich mit Home Assistant verbunden! Gefunden: ${cameras.length} Kameras, ${switches.length} Steckdosen/Schalter.`,
      cameras,
      switches
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: `Verbindungsfehler zu Home Assistant: ${err?.message || 'Host nicht erreichbar'}. Falls HA lokal läuft, nutze die direkte Browser-Abfrage oder trage die Nabu Casa / IP URL ein.`
    });
  }
});

// HA Kamera Snapshot Proxy
router.get('/api/homeassistant/camera-snapshot', async (req, res) => {
  try {
    const config = loadHaConfig();
    const entity = isStr(req.query.entity) && req.query.entity ? req.query.entity : config.cameraEntity;
    if (!config.haUrl || !config.haToken || !entity) {
      return res.status(400).send('Home Assistant oder Kamera-Entität nicht konfiguriert.');
    }
    if (!CAMERA_ID.test(entity)) return res.status(400).send('Ungültige Kamera-Entität.');

    const snapResp = await fetch(`${config.haUrl}/api/camera_proxy/${entity}`, {
      headers: { Authorization: `Bearer ${config.haToken}` },
      signal: AbortSignal.timeout(3000)
    });

    if (snapResp.ok && snapResp.headers.get('content-type')?.includes('image')) {
      const buffer = await snapResp.arrayBuffer();
      res.setHeader('Content-Type', snapResp.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.send(Buffer.from(buffer));
    }

    return res.status(snapResp.status >= 400 ? snapResp.status : 502).send('Konnte Snapshot von Home Assistant nicht abrufen.');
  } catch (err: any) {
    return res.status(500).send(`Home Assistant Kamera Fehler: ${err?.message}`);
  }
});

// HA Steckdose Status & Umschalten
router.get('/api/homeassistant/switch-status', async (req, res) => {
  try {
    const config = loadHaConfig();
    const entity = isStr(req.query.entity) && req.query.entity ? req.query.entity : config.switchEntity;
    if (!config.haUrl || !config.haToken || !entity) {
      return res.json({ configured: false, state: 'unknown' });
    }
    if (!SWITCH_ID.test(entity)) return res.status(400).json({ configured: true, state: 'error', error: 'Ungültige Entität' });

    const resp = await fetch(`${config.haUrl}/api/states/${entity}`, {
      headers: { Authorization: `Bearer ${config.haToken}` },
      signal: AbortSignal.timeout(6000)
    });
    if (!resp.ok) {
      return res.json({ configured: true, state: 'error', error: `HTTP ${resp.status}` });
    }
    const data = (await resp.json()) as any;
    return res.json({
      configured: true,
      entity_id: entity,
      state: data.state, // 'on' | 'off'
      power: data.attributes?.current_power_w || data.attributes?.power || null,
      friendly_name: data.attributes?.friendly_name || entity
    });
  } catch (err: any) {
    return res.json({ configured: true, state: 'error', error: err?.message });
  }
});

router.post('/api/homeassistant/toggle-switch', async (req, res) => {
  try {
    const config = loadHaConfig();
    const entity = isStr(req.body?.entity) && req.body.entity ? req.body.entity : config.switchEntity;
    const targetState = req.body?.state === 'on' || req.body?.state === 'off' ? (req.body.state as 'on' | 'off') : undefined;

    if (!config.haUrl || !config.haToken || !entity) {
      return res.status(400).json({ success: false, error: 'Home Assistant oder Steckdosen-Entität nicht konfiguriert.' });
    }
    if (!SWITCH_ID.test(entity)) return res.status(400).json({ success: false, error: 'Nur switch.* oder light.* erlaubt.' });

    const domain = entity.split('.')[0];
    const service = targetState === 'on' ? 'turn_on' : targetState === 'off' ? 'turn_off' : 'toggle';

    const resp = await fetch(`${config.haUrl}/api/services/${domain}/${service}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.haToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_id: entity }),
      signal: AbortSignal.timeout(8000)
    });

    if (resp.ok) {
      return res.json({ success: true, message: `Steckdose "${entity}" geschaltet (${service})!` });
    }
    return res.status(resp.status).json({ success: false, error: `Home Assistant Fehler: ${resp.statusText}` });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

export default router;
