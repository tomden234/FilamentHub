// Status-LED: ein WS2812B-Streifen mit WLED (ESP32) zeigt den Druckerstatus. Die App legt dafür in Home Assistant eine
// Automation an (wie bei „Nach Trocknen aus“) und schaltet sie nur ein, solange „Status-LED“ gewählt ist.
// Blau mit Fortschrittsbalken = Druck, Gelb = Pause, Grün = fertig, Rot blinkend = Fehler, Orange atmend = AMS trocknet, sonst aus.
import { callHaService, getHaCredentials } from './haClient';
import { haFetch } from './haAutoOff';
import { safeStorage } from './safeStorage';
import { getWorkshopSettings } from './workshopSettings';

export const LED_AUTOMATION_ID = 'filamenthub_status_led';
const ENTITY_KEY = 'filamenthub_ha_led_entity';
const INFO_KEY = 'filamenthub_ha_led_info';
const JSON_KEY = 'filamenthub_ha_led_json';
const VERSION_KEY = 'filamenthub_ha_led_version';
/** Hochzählen, wenn sich die Automation ändert: dann wird sie in Home Assistant neu geschrieben */
const CONFIG_VERSION = '1';
/** Nach „fertig“ oder „Fehler“ so lange leuchten lassen, dann aus */
export const LED_HOLD_MIN = 30;

export interface LedEntities {
  light: string;
  effects: string[];
  intensity?: string;
  status: string;
  progress?: string;
  dry: string[];
}

export interface LedFind {
  entities?: LedEntities;
  /** Was gefunden wurde, für die Fehlermeldung */
  found: { light?: string; status?: string; progress?: string; dry: string[] };
  automation?: string;
}

const id = (s: any) => String(s.entity_id);
const text = (s: any) => `${id(s)} ${s.attributes?.friendly_name || ''}`.toLowerCase();

/** WLED-Licht, Fortschritts-Regler, Druckstatus, Fortschritt und AMS-Trockenzeit in Home Assistant suchen (rein, ohne Netz) */
export function findLedEntities(states: any[], automationId = LED_AUTOMATION_ID): LedFind {
  const lights = states.filter(s => id(s).startsWith('light.'));
  // WLED erkennt man am Effekt „Percent“ (Fortschrittsbalken) oder am Namen
  const light = lights.find(s => Array.isArray(s.attributes?.effect_list) && s.attributes.effect_list.includes('Percent')) || lights.find(s => /wled/.test(text(s)));
  const sensors = states.filter(s => id(s).startsWith('sensor.'));
  const isStatus = (s: any) => /(print_status|druckstatus)$/.test(id(s)) || /(^|\s)(print status|druckstatus)$/.test(String(s.attributes?.friendly_name || '').toLowerCase());
  const statusSensor = sensors.find(isStatus);
  const prefix = statusSensor ? id(statusSensor).replace(/_(print_status|druckstatus)$/, '') : '';
  const progress =
    sensors.find(s => prefix && id(s).startsWith(prefix) && /(print_progress|druckfortschritt)$/.test(id(s))) ||
    sensors.find(s => /(print_progress|druckfortschritt)$/.test(id(s)) || /(print progress|druckfortschritt|fortschritt)$/.test(String(s.attributes?.friendly_name || '').toLowerCase()));
  const dry = sensors
    .filter(s => /(dry|drying|trock)/.test(text(s)) && /(time|zeit|remaining|rest|left)/.test(text(s)) && !/(temp|humid|feucht)/.test(text(s)))
    .map(id);
  // Regler „Intensität“ desselben WLED-Geräts: number.<name>_intensity (oder deutsch „intensität“)
  const base = light ? id(light).replace(/^light\./, '') : '';
  const numbers = states.filter(s => id(s).startsWith('number.'));
  const intensity = numbers.find(s => base && id(s) === `number.${base}_intensity`) || numbers.find(s => base && id(s).startsWith(`number.${base}`) && /(intensity|intensit)/.test(text(s)));
  const automation = states.find(s => id(s).startsWith('automation.') && s.attributes?.id === automationId)?.entity_id;
  const found = { light: light ? id(light) : undefined, status: statusSensor ? id(statusSensor) : undefined, progress: progress ? id(progress) : undefined, dry };
  if (!light || !statusSensor) return { found, automation };
  return {
    found,
    automation,
    entities: {
      light: id(light),
      effects: Array.isArray(light.attributes?.effect_list) ? light.attributes.effect_list.map(String) : [],
      intensity: intensity ? id(intensity) : undefined,
      status: id(statusSensor),
      progress: progress ? id(progress) : undefined,
      dry
    }
  };
}

/** Die Automation als Home-Assistant-Konfiguration (rein, damit sie testbar ist) */
export function buildStatusLedConfig(e: LedEntities, brightnessPct: number): Record<string, any> {
  const pick = (name: string) => (e.effects.includes(name) ? name : 'Solid');
  const hasEffects = e.effects.length > 0;
  const on = (rgb: [number, number, number], effect: string) => ({
    service: 'light.turn_on',
    target: { entity_id: e.light },
    data: { brightness_pct: brightnessPct, rgb_color: rgb, ...(hasEffects ? { effect } : {}) }
  });
  const hold = [{ delay: { minutes: LED_HOLD_MIN } }, { service: 'light.turn_off', target: { entity_id: e.light } }];
  const printing = { condition: 'state', entity_id: e.status, state: ['running', 'prepare'] };
  const percent = e.progress ? `{{ ((states('${e.progress}') | float(0)) * 2.55) | round(0) | int }}` : '';
  const dryAny = e.dry.length ? `{{ [${e.dry.map(d => `states('${d}') | float(0)`).join(', ')}] | max > 0 }}` : '{{ false }}';
  return {
    id: LED_AUTOMATION_ID,
    alias: 'FilamentHub: Status-LED',
    description:
      'Von der FilamentHub-App angelegt. Wird nur eingeschaltet, wenn „Status-LED“ gewählt ist. Blau mit Fortschrittsbalken = Druck, Gelb = Pause, Grün = fertig, Rot = Fehler, Orange = AMS trocknet, sonst aus.',
    mode: 'restart',
    trigger: [
      { platform: 'homeassistant', event: 'start' },
      { platform: 'state', entity_id: e.status },
      ...(e.progress ? [{ platform: 'state', entity_id: e.progress }] : []),
      // Trocknung beginnt (Rest-Trockenzeit über 0) oder endet (0): nicht bei jeder Minute dazwischen
      ...e.dry.flatMap(d => [
        { platform: 'numeric_state', entity_id: d, above: 0 },
        { platform: 'numeric_state', entity_id: d, below: 0.01 }
      ])
    ],
    condition: [],
    action: [
      {
        choose: [
          {
            conditions: [printing],
            sequence: [
              on([0, 110, 255], pick('Percent')),
              ...(e.intensity && e.progress && e.effects.includes('Percent')
                ? [{ service: 'number.set_value', target: { entity_id: e.intensity }, data: { value: percent } }]
                : [])
            ]
          },
          { conditions: [{ condition: 'state', entity_id: e.status, state: 'pause' }], sequence: [on([255, 190, 0], 'Solid')] },
          { conditions: [{ condition: 'state', entity_id: e.status, state: 'finish' }], sequence: [on([0, 220, 70], 'Solid'), ...hold] },
          { conditions: [{ condition: 'state', entity_id: e.status, state: 'failed' }], sequence: [on([255, 0, 0], pick('Blink')), ...hold] },
          { conditions: [{ condition: 'template', value_template: dryAny }], sequence: [on([255, 110, 0], pick('Breathe'))] }
        ],
        default: [{ service: 'light.turn_off', target: { entity_id: e.light } }]
      }
    ]
  };
}

export interface LedInfo {
  ok: boolean;
  text: string;
  at: number;
}

export function getLedInfo(): LedInfo | null {
  try {
    return JSON.parse(safeStorage.getItem(INFO_KEY) || 'null');
  } catch {
    return null;
  }
}

/** Automation als Text zum Einfügen in Home Assistant, falls die App sie nicht selbst anlegen darf */
export function getLedJson(): string {
  return safeStorage.getItem(JSON_KEY) || '';
}

function setInfo(ok: boolean, msg: string): LedInfo {
  const i = { ok, text: msg, at: Date.now() };
  safeStorage.setItem(INFO_KEY, JSON.stringify(i));
  return i;
}

const currentVersion = () => `${CONFIG_VERSION}-${getWorkshopSettings().statusLedBrightness}`;

async function readStates(): Promise<any[]> {
  const res = await haFetch('/api/states');
  if (!res.ok) throw new Error(`Home Assistant antwortet mit ${res.status}`);
  return res.json();
}

export async function installStatusLed(): Promise<LedInfo> {
  const { token } = getHaCredentials();
  if (!token) return setInfo(false, 'Kein Home-Assistant-Token in der App.');
  let step = 'Geräte suchen';
  try {
    const find = findLedEntities(await readStates());
    if (!find.entities) {
      const f = find.found;
      return setInfo(
        false,
        `In Home Assistant fehlt ${!f.light ? 'der LED-Streifen (WLED-Integration, Gerät „WLED“ hinzufügen)' : 'der Druckstatus (Bambu-Lab-Integration, HACS)'}. Gefunden: LED ${f.light || 'nein'}, Druckstatus ${f.status || 'nein'}.`
      );
    }
    const e = find.entities;
    if (find.automation && safeStorage.getItem(VERSION_KEY) === currentVersion()) {
      safeStorage.setItem(ENTITY_KEY, find.automation);
      await callHaService('automation', 'turn_off', { entity_id: find.automation });
      return setInfo(true, `Automation in Home Assistant gefunden (${find.automation}). LED: ${e.light}.`);
    }
    const config = buildStatusLedConfig(e, getWorkshopSettings().statusLedBrightness);
    safeStorage.setItem(JSON_KEY, JSON.stringify(config, null, 2));
    step = 'Automation anlegen';
    let res: Response;
    try {
      res = await haFetch(`/api/config/automation/config/${LED_AUTOMATION_ID}`, { method: 'POST', body: JSON.stringify(config) });
    } catch {
      return setInfo(
        false,
        'Home Assistant ist erreichbar, erlaubt der App aber nicht, Automationen anzulegen (Browser-Sperre). Einmal von Hand: „Automation kopieren“, in Home Assistant unter Einstellungen > Automationen > Neu > Menü (3 Punkte) > In YAML bearbeiten einfügen, speichern.'
      );
    }
    if (!res.ok) return setInfo(false, res.status === 401 || res.status === 403 ? 'Der Home-Assistant-Token darf keine Automationen anlegen (Admin-Benutzer nötig).' : `Home Assistant hat die Automation abgelehnt (${res.status}).`);
    step = 'Automation einschalten';
    let entity = '';
    for (let i = 0; i < 6 && !entity; i++) {
      await new Promise(r => setTimeout(r, 1000));
      entity = findLedEntities(await readStates()).automation || '';
    }
    if (!entity) return setInfo(false, 'Automation angelegt, aber Home Assistant zeigt sie noch nicht. Gleich nochmal versuchen.');
    safeStorage.setItem(ENTITY_KEY, entity);
    safeStorage.setItem(VERSION_KEY, currentVersion());
    await callHaService('automation', 'turn_off', { entity_id: entity });
    const note = e.intensity && e.effects.includes('Percent') ? '' : ' Ohne Fortschrittsbalken: Effekt „Percent“ oder Regler „Intensität“ fehlt in WLED, der Druck leuchtet dann einfach blau.';
    return setInfo(true, `Eingerichtet. LED: ${e.light}.${note}`);
  } catch (err: any) {
    return setInfo(false, `Home Assistant meldet (Schritt: ${step}): ${String(err?.message || err)}`);
  }
}

/** Status-LED an oder aus. Richtet die Automation beim ersten Mal selbst ein und stellt die LED sofort auf den aktuellen Stand. */
export async function setStatusLed(on: boolean): Promise<boolean> {
  let entity = safeStorage.getItem(ENTITY_KEY) || '';
  const outdated = on && Boolean(entity) && safeStorage.getItem(VERSION_KEY) !== currentVersion();
  if ((!entity || outdated) && on) {
    const info = getLedInfo();
    if (!outdated && info && !info.ok && Date.now() - info.at < 6 * 3600_000) return false;
    await installStatusLed();
    entity = safeStorage.getItem(ENTITY_KEY) || '';
  }
  if (!entity) return false;
  const r = await callHaService('automation', on ? 'turn_on' : 'turn_off', { entity_id: entity });
  // Gleich einmal auslösen, damit die LED sofort den Stand zeigt
  if (on && r.success) await callHaService('automation', 'trigger', { entity_id: entity, skip_condition: true });
  return r.success;
}
