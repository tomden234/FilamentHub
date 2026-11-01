import { Router } from 'express';
import { bambuService } from '../bambuMqtt.js';
import { loadHaConfig, saveHaConfig, triggerHaAutomation } from '../haConfig.js';

const router = Router();

// HA Automation direkt auslösen
router.post('/api/homeassistant/trigger-pull-automation', async (req, res) => {
  const { entity_id = 'automation.filament_website_auto_pull_github', haUrl, haToken } = req.body;
  const result = await triggerHaAutomation(entity_id, haUrl, haToken);
  return res.json(result);
});

// Begrenzte Weiterleitung an Home Assistant (Browser dürfen Nabu Casa oft nicht direkt ansprechen, der Server schon).
// Erlaubt sind nur: Zustände lesen, die FilamentHub-Automationen anlegen und Automationen ein-/ausschalten.
const RAW_ALLOWED = [
  { method: 'GET', path: /^\/api\/states$/ },
  { method: 'POST', path: /^\/api\/config\/automation\/config\/filamenthub_[a-z0-9_]+$/ },
  { method: 'POST', path: /^\/api\/services\/automation\/(turn_on|turn_off)$/ }
];
router.post('/api/homeassistant/raw', async (req, res) => {
  try {
    const config = loadHaConfig();
    const { method = 'GET', path = '', body } = req.body || {};
    const url = String(req.body?.haUrl || config.haUrl || '').trim().replace(/\/+$/, '');
    const token = String(req.body?.haToken || config.haToken || '');
    if (!url || !token) return res.status(400).json({ success: false, error: 'Home Assistant URL und Token erforderlich.' });
    if (!/^https?:\/\//i.test(url)) return res.status(400).json({ success: false, error: 'Ungültige Adresse.' });
    if (!RAW_ALLOWED.some(a => a.method === method && a.path.test(String(path)))) {
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

// HA Konfiguration abrufen (inkl. Nabu Casa Adresse & Token)
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
  const { haUrl, haToken, cameraEntity, switchEntity } = req.body;
  const current = loadHaConfig();
  const updated = {
    haUrl: haUrl !== undefined ? haUrl.trim().replace(/\/+$/, '') : current.haUrl,
    haToken: haToken !== undefined && haToken.trim().length > 0 ? haToken.trim() : current.haToken,
    cameraEntity: cameraEntity !== undefined ? cameraEntity.trim() : current.cameraEntity,
    switchEntity: switchEntity !== undefined ? switchEntity.trim() : current.switchEntity
  };
  saveHaConfig(updated);
  return res.json({ success: true, message: 'Home Assistant & Nabu Casa Zugangsdaten dauerhaft gespeichert!', config: updated });
});

// HA Verbindung testen & Entitäten auflisten (Kameras & Steckdosen)
router.post('/api/homeassistant/test', async (req, res) => {
  try {
    const config = loadHaConfig();
    const url = (req.body.haUrl || config.haUrl || '').trim().replace(/\/+$/, '');
    const token = req.body.haToken || config.haToken;

    if (!url || !token) {
      return res.status(400).json({ success: false, error: 'Home Assistant URL und Token erforderlich.' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const resp = await fetch(`${url}/api/states`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

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

    const states = await resp.json() as any[];
    const cameras = states
      .filter((s: any) => s.entity_id && s.entity_id.startsWith('camera.'))
      .map((s: any) => ({
        entity_id: s.entity_id,
        name: s.attributes?.friendly_name || s.entity_id,
        state: s.state
      }));

    const switches = states
      .filter((s: any) => s.entity_id && (s.entity_id.startsWith('switch.') || s.entity_id.startsWith('light.')))
      .map((s: any) => ({
        entity_id: s.entity_id,
        name: s.attributes?.friendly_name || s.entity_id,
        state: s.state
      }));

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
    const entity = (req.query.entity as string) || config.cameraEntity;
    const url = config.haUrl;
    const token = config.haToken;

    if (!url || !token || !entity) {
      return res.status(400).send('Home Assistant oder Kamera-Entität nicht konfiguriert.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const snapResp = await fetch(`${url}/api/camera_proxy/${entity}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (snapResp.ok && snapResp.headers.get('content-type')?.includes('image')) {
      const buffer = await snapResp.arrayBuffer();
      res.setHeader('Content-Type', snapResp.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.send(Buffer.from(buffer));
    }

    return res.status(snapResp.status).send('Konnte Snapshot von Home Assistant nicht abrufen.');
  } catch (err: any) {
    return res.status(500).send(`Home Assistant Kamera Fehler: ${err?.message}`);
  }
});

// HA Steckdose Status & Umschalten
router.get('/api/homeassistant/switch-status', async (req, res) => {
  try {
    const config = loadHaConfig();
    const entity = (req.query.entity as string) || config.switchEntity;
    if (!config.haUrl || !config.haToken || !entity) {
      return res.json({ configured: false, state: 'unknown' });
    }

    const resp = await fetch(`${config.haUrl}/api/states/${entity}`, {
      headers: { 'Authorization': `Bearer ${config.haToken}` }
    });
    if (!resp.ok) {
      return res.json({ configured: true, state: 'error', error: `HTTP ${resp.status}` });
    }
    const data = await resp.json() as any;
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
    const entity = (req.body.entity as string) || config.switchEntity;
    const targetState = req.body.state as 'on' | 'off' | undefined; // optional toggle if undefined

    if (!config.haUrl || !config.haToken || !entity) {
      return res.status(400).json({ success: false, error: 'Home Assistant oder Steckdosen-Entität nicht konfiguriert.' });
    }

    const domain = entity.split('.')[0] || 'switch';
    const service = targetState === 'on' ? 'turn_on' : targetState === 'off' ? 'turn_off' : 'toggle';

    const resp = await fetch(`${config.haUrl}/api/services/${domain}/${service}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.haToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ entity_id: entity })
    });

    if (resp.ok) {
      return res.json({ success: true, message: `Steckdose "${entity}" geschaltet (${service})!` });
    }
    return res.status(resp.status).json({ success: false, error: `Home Assistant Fehler: ${resp.statusText}` });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// HA Bambu Temperatur setzen
router.post('/api/homeassistant/set-temperature', async (req, res) => {
  try {
    const config = loadHaConfig();
    const { target, temp } = req.body;
    if (!config.haUrl || !config.haToken) {
      return res.status(400).json({ success: false, error: 'Home Assistant nicht konfiguriert.' });
    }

    const gcode = target === 'bed' ? `M140 S${temp}\n` : `M104 S${temp}\n`;

    // Sende über Service bambu_lab.send_gcode oder climate falls vorhanden
    const resp = await fetch(`${config.haUrl}/api/services/bambu_lab/send_gcode`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.haToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ gcode })
    });

    if (resp.ok) {
      return res.json({ success: true, message: `${target} auf ${temp}°C über Home Assistant gesetzt!` });
    }

    // Fallback: Direkter MQTTS Befehl
    const result = await bambuService.setTemperature(target as any, Number(temp));
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// HA Bambu Licht schalten
router.post('/api/homeassistant/set-light', async (req, res) => {
  try {
    const config = loadHaConfig();
    const { mode, entity } = req.body;
    if (!config.haUrl || !config.haToken) {
      return res.status(400).json({ success: false, error: 'Home Assistant nicht konfiguriert.' });
    }

    const targetEntity = entity || 'light.x2d_chamber_light';
    const service = mode === 'on' ? 'turn_on' : 'turn_off';

    const resp = await fetch(`${config.haUrl}/api/services/light/${service}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.haToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ entity_id: targetEntity })
    });

    if (resp.ok) {
      return res.json({ success: true, message: `Licht über Home Assistant ${mode === 'on' ? 'eingeschaltet' : 'ausgeschaltet'}!` });
    }

    // Fallback: Direct
    const directRes = await bambuService.toggleLight(mode);
    return res.json(directRes);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

export default router;
