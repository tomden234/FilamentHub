// „Nach Trocknen aus“ auch ohne offene App: Wie bei „Nach Druck aus“ legt die App in Home Assistant eine Automation an
// und schaltet sie nur ein, solange „Nach Trocknen ausschalten“ gewählt ist. Home Assistant schaltet die Steckdose aus,
// 3 Minuten nachdem die Rest-Trockenzeit des AMS auf 0 gefallen ist (und nicht gedruckt wird).
// Beginnt vorher ein Druck, schaltet sich die Automation selbst ab (Drucker bleibt an).
// Braucht die Bambu-Lab-Integration (HACS: ha-bambulab) mit dem Sensor „Rest-Trockenzeit“ des AMS.
import { callHaService, getHaCredentials } from './haClient';
import { findEntities, haFetch } from './haAutoOff';
import { safeStorage } from './safeStorage';

const AUTOMATION_ID = 'filamenthub_dry_off';
const ENTITY_KEY = 'filamenthub_ha_dryoff_entity';
const INFO_KEY = 'filamenthub_ha_dryoff_info';
const JSON_KEY = 'filamenthub_ha_dryoff_json';

/** Automation als Text zum Einfügen in Home Assistant (YAML-Editor), falls die App sie nicht selbst anlegen darf */
export function getHaDryOffJson(): string {
  return safeStorage.getItem(JSON_KEY) || '';
}

export interface HaDryOffInfo {
  ok: boolean;
  text: string;
  at: number;
}

export function getHaDryOffInfo(): HaDryOffInfo | null {
  try {
    return JSON.parse(safeStorage.getItem(INFO_KEY) || 'null');
  } catch {
    return null;
  }
}

function setInfo(ok: boolean, text: string): HaDryOffInfo {
  const i = { ok, text, at: Date.now() };
  safeStorage.setItem(INFO_KEY, JSON.stringify(i));
  return i;
}

/** Sensoren der AMS-Rest-Trockenzeit in Home Assistant suchen */
async function findDryEntities(): Promise<{ dry: string[]; maybe: string[]; automation?: string }> {
  const res = await haFetch('/api/states');
  if (!res.ok) throw new Error(`Home Assistant antwortet mit ${res.status}`);
  const states: any[] = await res.json();
  const sensors = states.filter(s => String(s.entity_id).startsWith('sensor.'));
  const text = (s: any) => `${s.entity_id} ${s.attributes?.friendly_name || ''}`.toLowerCase();
  // Rest-Trockenzeit: „drying_time“, „dry_time“, „Rest-Trockenzeit“, „Remaining drying time“ ...
  const dry = sensors
    .filter(s => /(dry|drying|trock)/.test(text(s)) && /(time|zeit|remaining|rest|left)/.test(text(s)) && !/(temp|humid|feucht)/.test(text(s)))
    .map(s => String(s.entity_id));
  const maybe = sensors.filter(s => /(dry|trock)/.test(text(s))).map(s => String(s.entity_id)).slice(0, 6);
  const automation = states.find(s => String(s.entity_id).startsWith('automation.') && s.attributes?.id === AUTOMATION_ID)?.entity_id;
  return { dry, maybe, automation };
}

export async function installHaDryOff(): Promise<HaDryOffInfo> {
  const { token, switchEntity } = getHaCredentials();
  if (!token) return setInfo(false, 'Kein Home-Assistant-Token in der App.');
  let step = 'Sensoren lesen';
  try {
    const { status } = await findEntities();
    const { dry, maybe, automation: existing } = await findDryEntities();
    if (existing) {
      safeStorage.setItem(ENTITY_KEY, existing);
      await callHaService('automation', 'turn_off', { entity_id: existing });
      return setInfo(true, `Automation in Home Assistant gefunden (${existing}). Home Assistant schaltet 3 Minuten nach Trocknungsende aus.`);
    }
    if (!status || !dry.length) {
      const found = `Gefunden: Druckstatus ${status || 'nein'}, Trockenzeit ${dry[0] || 'nein'}${maybe.length ? `, ähnliche Sensoren: ${maybe.join(', ')}` : ''}.`;
      return setInfo(false, `In Home Assistant fehlen Druckstatus oder AMS-Rest-Trockenzeit (Bambu-Lab-Integration, HACS). ${found} Bis dahin schaltet die App selbst aus, solange sie läuft.`);
    }
    const below = dry.map(e => ({ condition: 'numeric_state', entity_id: e, below: 0.01 }));
    const config = {
      id: AUTOMATION_ID,
      alias: 'FilamentHub: Drucker nach Trocknen aus',
      description: 'Von der FilamentHub-App angelegt. Wird nur eingeschaltet, wenn „Nach Trocknen ausschalten“ gewählt ist. 3 Minuten nach Trocknungsende geht die Steckdose aus, außer es wird gedruckt.',
      mode: 'single',
      trigger: [
        ...dry.map(e => ({ platform: 'numeric_state', entity_id: e, below: 0.01, for: { minutes: 3 }, id: 'dryend' })),
        { platform: 'state', entity_id: status, to: ['running', 'prepare', 'pause'], id: 'print' }
      ],
      condition: [],
      action: [
        {
          choose: [
            {
              conditions: [{ condition: 'trigger', id: 'print' }],
              sequence: [{ service: 'automation.turn_off', target: { entity_id: '{{ this.entity_id }}' } }, { stop: 'Druck gestartet: Drucker bleibt an' }]
            }
          ]
        },
        ...below,
        { condition: 'not', conditions: [{ condition: 'state', entity_id: status, state: ['running', 'prepare', 'pause'] }] },
        { service: 'switch.turn_off', target: { entity_id: switchEntity } },
        { service: 'automation.turn_off', target: { entity_id: '{{ this.entity_id }}' } }
      ]
    };
    safeStorage.setItem(JSON_KEY, JSON.stringify(config, null, 2));
    step = 'Automation anlegen';
    let res: Response;
    try {
      res = await haFetch(`/api/config/automation/config/${AUTOMATION_ID}`, { method: 'POST', body: JSON.stringify(config) });
    } catch {
      // Home Assistant ist erreichbar (Status wurde gelesen), nimmt Automationen aber nicht von fremden Seiten an
      return setInfo(
        false,
        'Home Assistant ist erreichbar, erlaubt der App aber nicht, Automationen anzulegen (Browser-Sperre). Einmal von Hand: „Automation kopieren“, in Home Assistant unter Einstellungen > Automationen > Neu > Menü (3 Punkte) > In YAML bearbeiten einfügen, speichern. Dann hier „Prüfen“.'
      );
    }
    if (!res.ok) return setInfo(false, res.status === 401 || res.status === 403 ? 'Der Home-Assistant-Token darf keine Automationen anlegen (Admin-Benutzer nötig).' : `Home Assistant hat die Automation abgelehnt (${res.status}).`);
    step = 'Automation einschalten';
    let entity = '';
    for (let i = 0; i < 6 && !entity; i++) {
      await new Promise(r => setTimeout(r, 1000));
      entity = (await findDryEntities()).automation || '';
    }
    if (!entity) return setInfo(false, 'Automation angelegt, aber Home Assistant zeigt sie noch nicht. Gleich nochmal versuchen.');
    safeStorage.setItem(ENTITY_KEY, entity);
    await callHaService('automation', 'turn_off', { entity_id: entity });
    return setInfo(true, `Eingerichtet. Home Assistant schaltet 3 Minuten nach Trocknungsende aus (${dry.join(', ')}).`);
  } catch (e: any) {
    {
    const raw = String(e?.message || e);
    let host = '';
    try {
      host = new URL(getHaCredentials().url).host;
    } catch {
      host = getHaCredentials().url || 'keine Adresse';
    }
    const netFail = /failed to fetch|networkerror|load failed|timeout|aborted/i.test(raw);
    return setInfo(
      false,
      netFail
        ? `Home Assistant (${host}) nicht erreichbar (Schritt: ${step}, Fehler: ${raw}). Adresse in den Einstellungen prüfen, Internet an? Bei eigener Adresse (http://…) darf die App sie nur im selben WLAN erreichen.`
        : `Home Assistant meldet (Schritt: ${step}): ${raw}`
    );
  }
  }
}

/** Automation an (wenn „Nach Trocknen aus“ gewählt) oder aus. Richtet sie beim ersten Mal selbst ein. */
export async function setHaDryOff(on: boolean): Promise<boolean> {
  let entity = safeStorage.getItem(ENTITY_KEY) || '';
  if (!entity && on) {
    const info = getHaDryOffInfo();
    if (info && !info.ok && Date.now() - info.at < 6 * 3600_000) return false;
    await installHaDryOff();
    entity = safeStorage.getItem(ENTITY_KEY) || '';
  }
  if (!entity) return false;
  const r = await callHaService('automation', on ? 'turn_on' : 'turn_off', { entity_id: entity });
  return r.success;
}
