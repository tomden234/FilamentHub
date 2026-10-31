// „Nach Druck aus“ auch ohne offene App: Die App legt in Home Assistant eine Automation an (einmalig, automatisch)
// und schaltet sie nur ein, solange „Nach Druck aus“ gewählt ist. Home Assistant schaltet dann die Steckdose aus,
// 3 Minuten nach Druckende (feste Zeit, ohne Düsentemperatur). Braucht in Home Assistant die Bambu-Lab-Integration (HACS: ha-bambulab),
// denn nur so kennt Home Assistant den Druckstatus.
import { callHaService, getHaCredentials } from './haClient';
import { safeStorage } from './safeStorage';

const AUTOMATION_ID = 'filamenthub_auto_off';
const ENTITY_KEY = 'filamenthub_ha_autooff_entity';
const INFO_KEY = 'filamenthub_ha_autooff_info';
const VER_KEY = 'filamenthub_ha_autooff_ver';
const VER = '2'; // 2 = feste 3 Minuten statt Düsentemperatur

export interface HaAutoOffInfo {
  ok: boolean;
  text: string;
  statusEntity?: string;
  nozzleEntity?: string;
  automationEntity?: string;
  at: number;
}

export function getHaAutoOffInfo(): HaAutoOffInfo | null {
  try {
    return JSON.parse(safeStorage.getItem(INFO_KEY) || 'null');
  } catch {
    return null;
  }
}

function setInfo(i: HaAutoOffInfo): HaAutoOffInfo {
  safeStorage.setItem(INFO_KEY, JSON.stringify(i));
  return i;
}

async function haFetch(path: string, init?: RequestInit): Promise<Response> {
  const { url, token } = getHaCredentials();
  return fetch(`${url}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
    signal: AbortSignal.timeout(12000)
  });
}

/** Bambu-Sensoren in Home Assistant suchen (Druckstatus und Düsentemperatur) */
async function findEntities(): Promise<{ status?: string; nozzle?: string; automation?: string }> {
  const res = await haFetch('/api/states');
  if (!res.ok) throw new Error(`Home Assistant antwortet mit ${res.status}`);
  const states: any[] = await res.json();
  const ids = states.map(s => String(s.entity_id));
  const status = ids.find(id => /^sensor\..*_print_status$/.test(id)) || ids.find(id => /^sensor\..*(x2d|bambu).*_(stage|status)$/.test(id));
  const prefix = status ? status.replace(/_print_status$/, '') : '';
  const nozzle =
    ids.find(id => prefix && id.startsWith(prefix) && /_nozzle_temp(erature)?$/.test(id)) ||
    ids.find(id => /^sensor\..*_nozzle_temp(erature)?$/.test(id));
  const automation = states.find(s => String(s.entity_id).startsWith('automation.') && s.attributes?.id === AUTOMATION_ID)?.entity_id;
  return { status, nozzle, automation };
}

/** Automation anlegen oder aktualisieren. Gibt Infos zurück (auch, was fehlt). */
export async function installHaAutoOff(): Promise<HaAutoOffInfo> {
  const { token, switchEntity } = getHaCredentials();
  if (!token) return setInfo({ ok: false, text: 'Kein Home-Assistant-Token in der App.', at: Date.now() });
  try {
    const found = await findEntities();
    if (!found.status) {
      return setInfo({
        ok: false,
        text: 'In Home Assistant fehlt der Druckstatus des Druckers. Installiere die Bambu-Lab-Integration (HACS: „Bambu Lab“ von greghesp) und tippe dann nochmal. Bis dahin schaltet die App selbst aus, solange sie offen ist.',
        at: Date.now()
      });
    }
    const st = found.status;
    const config = {
      id: AUTOMATION_ID,
      alias: 'FilamentHub: Drucker nach Druck aus',
      description: 'Von der FilamentHub-App angelegt. Die App schaltet diese Automation ein, wenn du „Nach Druck aus“ wählst. 3 Minuten nach Druckende geht die Steckdose aus.',
      mode: 'single',
      trigger: [
        { platform: 'state', entity_id: st, to: 'finish', for: { minutes: 3 } },
        { platform: 'state', entity_id: st, to: 'failed' }
      ],
      condition: [],
      action: [
        {
          choose: [
            {
              conditions: [{ condition: 'state', entity_id: st, state: 'failed' }],
              sequence: [{ service: 'automation.turn_off', target: { entity_id: '{{ this.entity_id }}' } }, { stop: 'Druck fehlgeschlagen: Drucker bleibt an' }]
            }
          ]
        },
        { condition: 'state', entity_id: st, state: 'finish' },
        { service: 'switch.turn_off', target: { entity_id: switchEntity } },
        { service: 'automation.turn_off', target: { entity_id: '{{ this.entity_id }}' } }
      ]
    };
    const res = await haFetch(`/api/config/automation/config/${AUTOMATION_ID}`, { method: 'POST', body: JSON.stringify(config) });
    if (!res.ok) {
      return setInfo({
        ok: false,
        text: res.status === 401 || res.status === 403 ? 'Der Home-Assistant-Token darf keine Automationen anlegen (Admin-Benutzer nötig).' : `Home Assistant hat die Automation abgelehnt (${res.status}).`,
        statusEntity: st,
        nozzleEntity: found.nozzle,
        at: Date.now()
      });
    }
    // Home Assistant lädt die Automationen neu. Danach ausschalten (an ist sie nur, wenn „Nach Druck aus“ gewählt ist).
    let entity = '';
    for (let i = 0; i < 6 && !entity; i++) {
      await new Promise(r => setTimeout(r, 1000));
      entity = (await findEntities()).automation || '';
    }
    if (!entity) return setInfo({ ok: false, text: 'Automation angelegt, aber Home Assistant zeigt sie noch nicht. Gleich nochmal tippen.', statusEntity: st, nozzleEntity: found.nozzle, at: Date.now() });
    safeStorage.setItem(ENTITY_KEY, entity);
    safeStorage.setItem(VER_KEY, VER);
    await callHaService('automation', 'turn_off', { entity_id: entity });
    return setInfo({
      ok: true,
      text: `Eingerichtet. Home Assistant nutzt ${st} und schaltet 3 Minuten nach Druckende aus.`,
      statusEntity: st,
      nozzleEntity: found.nozzle,
      automationEntity: entity,
      at: Date.now()
    });
  } catch (e: any) {
    return setInfo({ ok: false, text: `Home Assistant nicht erreichbar: ${e?.message || e}`, at: Date.now() });
  }
}

/** Automation an (wenn „Nach Druck aus“ gewählt) oder aus. Richtet sie beim ersten Mal selbst ein. */
export async function setHaAutoOff(on: boolean): Promise<boolean> {
  let entity = safeStorage.getItem(ENTITY_KEY) || '';
  if (!entity && on) {
    const info = getHaAutoOffInfo();
    // Nicht bei jedem Druck neu versuchen, wenn es gerade erst nicht ging
    if (info && !info.ok && Date.now() - info.at < 6 * 3600_000) return false;
    const r = await installHaAutoOff();
    entity = r.automationEntity || '';
  }
  // Alte Automation (mit Düsentemperatur) einmal durch die neue ersetzen
  if (entity && on && safeStorage.getItem(VER_KEY) !== VER) {
    const r2 = await installHaAutoOff();
    entity = r2.automationEntity || entity;
  }
  if (!entity) return false;
  const r = await callHaService('automation', on ? 'turn_on' : 'turn_off', { entity_id: entity });
  return r.success;
}
