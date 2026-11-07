// Status-LED: ein WS2812B-Streifen mit WLED (ESP32) zeigt den Druckerstatus. Die App legt dafür in Home Assistant eine
// Automation an (wie bei „Nach Trocknen aus“) und schaltet sie nur ein, solange „Status-LED“ gewählt ist.
// Blau mit Fortschrittsbalken = Druck, Gelb = Pause, Grün = fertig, Rot blinkend = Fehler, sonst aus. (Trocknen zeigt die LED nicht.)
import { callHaService, getHaCredentials } from './haClient';
import { haFetch } from './haAutoOff';
import { safeStorage } from './safeStorage';
import { getWorkshopSettings } from './workshopSettings';

const LED_AUTOMATION_ID = 'filamenthub_status_led';
const ENTITY_KEY = 'filamenthub_ha_led_entity';
const INFO_KEY = 'filamenthub_ha_led_info';
const JSON_KEY = 'filamenthub_ha_led_json';
const VERSION_KEY = 'filamenthub_ha_led_version';
/** Hochzählen, wenn sich die Automation ändert: dann wird sie in Home Assistant neu geschrieben */
const CONFIG_VERSION = '2';
export type LedColors = { print: string; pause: string; finish: string; failed: string };
export const DEFAULT_LED_COLORS: LedColors = { print: '#006eff', pause: '#ffbe00', finish: '#00dc46', failed: '#ff0000' };
export const hexToRgb = (hex: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  const n = parseInt(m ? m[1] : '000000', 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const rgbToHex = (c: [number, number, number]): string => '#' + c.map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
const currentColors = (): LedColors => ({ ...DEFAULT_LED_COLORS, ...(getWorkshopSettings().statusLedColors || {}) });
/** Nach „fertig“ oder „Fehler“ so lange leuchten lassen, dann aus */
const LED_HOLD_MIN = 30;

interface LedEntities {
  light: string;
  effects: string[];
  intensity?: string;
  status: string;
  progress?: string;
}

interface LedFind {
  entities?: LedEntities;
  /** Was gefunden wurde, für die Fehlermeldung */
  found: { light?: string; status?: string; progress?: string };
  automation?: string;
}

const id = (s: any) => String(s.entity_id);
const text = (s: any) => `${id(s)} ${s.attributes?.friendly_name || ''}`.toLowerCase();

/** LED-Streifen suchen: ESPHome-/WLED-Streifen erkennt man am Effekt „Percent“ (Fortschrittsbalken) oder am Namen */
function pickLedLight(states: any[]): any | undefined {
  const lights = states.filter(s => id(s).startsWith('light.'));
  return lights.find(s => Array.isArray(s.attributes?.effect_list) && s.attributes.effect_list.includes('Percent')) || lights.find(s => /wled/.test(text(s)));
}

/** Regler „Intensität“ desselben Geräts */
function pickLedIntensity(states: any[], light: any | undefined): any | undefined {
  const base = light ? id(light).replace(/^light\./, '') : '';
  const numbers = states.filter(s => id(s).startsWith('number.'));
  return numbers.find(s => base && id(s) === `number.${base}_intensity`) || numbers.find(s => base && id(s).startsWith(`number.${base}`) && /(intensity|intensit)/.test(text(s)));
}

/** WLED-Licht, Fortschritts-Regler, Druckstatus und Fortschritt in Home Assistant suchen (rein, ohne Netz) */
export function findLedEntities(states: any[], automationId = LED_AUTOMATION_ID): LedFind {
  const light = pickLedLight(states);
  const sensors = states.filter(s => id(s).startsWith('sensor.'));
  const isStatus = (s: any) => /(print_status|druckstatus)$/.test(id(s)) || /(^|\s)(print status|druckstatus)$/.test(String(s.attributes?.friendly_name || '').toLowerCase());
  const statusSensor = sensors.find(isStatus);
  const prefix = statusSensor ? id(statusSensor).replace(/_(print_status|druckstatus)$/, '') : '';
  const progress =
    sensors.find(s => prefix && id(s).startsWith(prefix) && /(print_progress|druckfortschritt)$/.test(id(s))) ||
    sensors.find(s => /(print_progress|druckfortschritt)$/.test(id(s)) || /(print progress|druckfortschritt|fortschritt)$/.test(String(s.attributes?.friendly_name || '').toLowerCase()));
  // Regler „Intensität“ desselben Geräts (ESPHome: „Status LED Intensity“): number.<name>_intensity (oder deutsch „intensität“)
  const intensity = pickLedIntensity(states, light);
  const automation = states.find(s => id(s).startsWith('automation.') && s.attributes?.id === automationId)?.entity_id;
  const found = { light: light ? id(light) : undefined, status: statusSensor ? id(statusSensor) : undefined, progress: progress ? id(progress) : undefined };
  if (!light || !statusSensor) return { found, automation };
  return {
    found,
    automation,
    entities: {
      light: id(light),
      effects: Array.isArray(light.attributes?.effect_list) ? light.attributes.effect_list.map(String) : [],
      intensity: intensity ? id(intensity) : undefined,
      status: id(statusSensor),
      progress: progress ? id(progress) : undefined
    }
  };
}

/** Die Automation als Home-Assistant-Konfiguration (rein, damit sie testbar ist) */
export function buildStatusLedConfig(e: LedEntities, brightnessPct: number, colors: LedColors = DEFAULT_LED_COLORS): Record<string, any> {
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
  return {
    id: LED_AUTOMATION_ID,
    alias: 'FilamentHub: Status-LED',
    description:
      'Von der FilamentHub-App angelegt. Wird nur eingeschaltet, wenn „Status-LED“ gewählt ist. Blau mit Fortschrittsbalken = Druck, Gelb = Pause, Grün = fertig, Rot = Fehler, sonst aus.',
    mode: 'restart',
    trigger: [
      { platform: 'homeassistant', event: 'start' },
      { platform: 'state', entity_id: e.status },
      ...(e.progress ? [{ platform: 'state', entity_id: e.progress }] : []),
    ],
    condition: [],
    action: [
      {
        choose: [
          {
            conditions: [printing],
            sequence: [
              on(hexToRgb(colors.print), pick('Percent')),
              ...(e.intensity && e.progress && e.effects.includes('Percent')
                ? [{ service: 'number.set_value', target: { entity_id: e.intensity }, data: { value: percent } }]
                : [])
            ]
          },
          { conditions: [{ condition: 'state', entity_id: e.status, state: 'pause' }], sequence: [on(hexToRgb(colors.pause), 'Solid')] },
          { conditions: [{ condition: 'state', entity_id: e.status, state: 'finish' }], sequence: [on(hexToRgb(colors.finish), 'Solid'), ...hold] },
          { conditions: [{ condition: 'state', entity_id: e.status, state: 'failed' }], sequence: [on(hexToRgb(colors.failed), pick('Blink')), ...hold] }
        ],
        default: [{ service: 'light.turn_off', target: { entity_id: e.light } }]
      }
    ]
  };
}

interface LedInfo {
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

const currentVersion = () => `${CONFIG_VERSION}-${getWorkshopSettings().statusLedBrightness}-${Object.values(currentColors()).join('')}`;

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
        `In Home Assistant fehlt ${!f.light ? 'der LED-Streifen (ESPHome-Gerät „filament-ams“ mit Status LED oder WLED in Home Assistant hinzufügen)' : 'der Druckstatus (Bambu-Lab-Integration, HACS)'}. Gefunden: LED ${f.light || 'nein'}, Druckstatus ${f.status || 'nein'}.`
      );
    }
    const e = find.entities;
    if (find.automation && safeStorage.getItem(VERSION_KEY) === currentVersion()) {
      safeStorage.setItem(ENTITY_KEY, find.automation);
      await callHaService('automation', 'turn_off', { entity_id: find.automation });
      return setInfo(true, `Automation in Home Assistant gefunden (${find.automation}). LED: ${e.light}.`);
    }
    const config = buildStatusLedConfig(e, getWorkshopSettings().statusLedBrightness, currentColors());
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
    const note = e.intensity && e.effects.includes('Percent') ? '' : ' Ohne Fortschrittsbalken: Effekt „Percent“ oder Regler „Intensität“ fehlt am Streifen (ESPHome/WLED), der Druck leuchtet dann einfach blau.';
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

// ---------- Test der Modi (Knöpfe in Werkstatt > Status-LED) ----------
export type LedTestMode = 'print' | 'pause' | 'finish' | 'failed' | 'colortest' | 'off';

interface LedTestKit {
  light: string;
  effects: string[];
  intensity?: string;
}

/** Farben und Effekte wie in der Automation (buildStatusLedConfig) */
export const LED_TEST_MODES: { mode: LedTestMode; label: string; rgb: [number, number, number] | null; effect: string; hint: string }[] = [
  { mode: 'print', label: 'Druck läuft', rgb: [0, 110, 255], effect: 'Percent', hint: 'Blau mit Fortschrittsbalken' },
  { mode: 'pause', label: 'Pause', rgb: [255, 190, 0], effect: 'Solid', hint: 'Gelb' },
  { mode: 'finish', label: 'Fertig', rgb: [0, 220, 70], effect: 'Solid', hint: 'Grün' },
  { mode: 'failed', label: 'Fehler', rgb: [255, 0, 0], effect: 'Blink', hint: 'Rot blinkend' },
  { mode: 'colortest', label: 'Farbtest', rgb: [255, 255, 255], effect: 'Farbtest', hint: 'Zeigt nacheinander Rot, Grün, Blau (je 2 s)' },
  { mode: 'off', label: 'Aus', rgb: null, effect: 'Solid', hint: 'LED aus' }
];

/** Farbtest zeigt Rot, Grün, Blau. Was der Streifen wirklich zeigt, sagt, welches led_order in der YAML nötig ist
 *  (die Firmware sendet GRB: je Streifen-Typ kommt eine feste Reihenfolge heraus). */
export const LED_ORDER_GUIDE: { seen: string; order: string }[] = [
  { seen: 'Rot, Grün, Blau', order: 'GRB' },
  { seen: 'Grün, Rot, Blau', order: 'RGB' },
  { seen: 'Rot, Blau, Grün', order: 'BRG' },
  { seen: 'Blau, Rot, Grün', order: 'RBG' },
  { seen: 'Blau, Grün, Rot', order: 'GBR' },
  { seen: 'Grün, Blau, Rot', order: 'BGR' }
];

/** LED und Regler für den Test finden (braucht keinen Druckstatus, rein, ohne Netz) */
export function findLedTestKit(states: any[]): LedTestKit | null {
  const light = pickLedLight(states);
  if (!light) return null;
  const intensity = pickLedIntensity(states, light);
  return {
    light: id(light),
    effects: Array.isArray(light.attributes?.effect_list) ? light.attributes.effect_list.map(String) : [],
    intensity: intensity ? id(intensity) : undefined
  };
}

/** Druckfortschritt in Prozent → Reglerwert 0-255 */
export const ledIntensityValue = (pct: number): number => Math.round((Math.max(0, Math.min(100, pct)) * 255) / 100);

interface LedCall {
  domain: string;
  service: string;
  data: Record<string, any>;
}

/** Home-Assistant-Aufrufe für einen Test-Modus (rein, testbar) */
export function buildLedTestCalls(kit: LedTestKit, mode: LedTestMode, brightnessPct: number, progressPct = 50, colors?: LedColors): LedCall[] {
  const base = LED_TEST_MODES.find(x => x.mode === mode);
  const own = colors && (mode === 'print' || mode === 'pause' || mode === 'finish' || mode === 'failed') ? hexToRgb(colors[mode]) : null;
  const m = base && { ...base, rgb: own || base.rgb };
  if (!m || !m.rgb) return [{ domain: 'light', service: 'turn_off', data: { entity_id: kit.light } }];
  const effect = kit.effects.includes(m.effect) ? m.effect : 'Solid';
  const calls: LedCall[] = [];
  // Zuerst den Balken setzen, dann einschalten: kein Aufblitzen mit altem Stand
  if (mode === 'print' && kit.intensity && kit.effects.includes('Percent')) {
    calls.push({ domain: 'number', service: 'set_value', data: { entity_id: kit.intensity, value: ledIntensityValue(progressPct) } });
  }
  calls.push({
    domain: 'light',
    service: 'turn_on',
    data: { entity_id: kit.light, brightness_pct: brightnessPct, rgb_color: m.rgb, ...(kit.effects.length ? { effect } : {}) }
  });
  return calls;
}

interface LedTestResult {
  ok: boolean;
  text: string;
}

let testKit: LedTestKit | null = null;

/** Service-Aufruf mit genauem Fehlertext (Status und Antwort von Home Assistant), geht bei Browser-Sperre über den eigenen Server */
async function haCall(c: LedCall): Promise<LedTestResult> {
  try {
    const res = await haFetch(`/api/services/${c.domain}/${c.service}`, { method: 'POST', body: JSON.stringify(c.data) });
    if (res.ok) return { ok: true, text: '' };
    const body = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 160);
    return { ok: false, text: `${c.domain}.${c.service} → Home Assistant ${res.status}${body ? `: ${body}` : ''}` };
  } catch (err: any) {
    const msg = String(err?.message || err);
    const hint = /fetch|network|load failed/i.test(msg)
      ? ' Der Browser darf Home Assistant nicht direkt ansprechen und der Weg über den eigenen Server hat nicht geklappt. Windows-App auf die neueste Version bringen (Verbindungen → Nach Update suchen) oder die App am PC über den lokalen Server öffnen.'
      : '';
    return { ok: false, text: `${c.domain}.${c.service} → nicht erreichbar (${msg}).${hint}` };
  }
}

/** Was die LED laut Home Assistant gerade tut (rein, testbar) */
export function describeLedState(state: any): string {
  if (!state) return 'Zustand nicht lesbar.';
  const a = state.attributes || {};
  if (state.state !== 'on') return `Gerät meldet: ${state.state}.`;
  const rgb = Array.isArray(a.rgb_color) ? `Farbe ${a.rgb_color.join('/')}` : 'Farbe unbekannt';
  const bri = typeof a.brightness === 'number' ? `Helligkeit ${Math.round((a.brightness / 255) * 100)} %` : 'Helligkeit unbekannt';
  return `Gerät meldet: an, Effekt ${a.effect || 'keiner'}, ${rgb}, ${bri}.`;
}

/** Einen Modus an der echten LED zeigen. Die Automation wird dafür kurz abgeschaltet, damit sie nicht dazwischenfunkt. */
export async function previewStatusLed(mode: LedTestMode, progressPct = 50, colors: LedColors = currentColors()): Promise<LedTestResult> {
  const { token } = getHaCredentials();
  if (!token) return { ok: false, text: 'Kein Home-Assistant-Token in der App.' };
  try {
    if (!testKit || mode === 'print') testKit = findLedTestKit(await readStates());
    if (!testKit) return { ok: false, text: 'Kein LED-Streifen in Home Assistant gefunden (ESPHome „filament-ams“ mit Status LED).' };
    if (mode === 'colortest' && !testKit.effects.includes('Farbtest')) {
      return { ok: false, text: 'Dem ESP32 fehlt der Effekt „Farbtest“. Neue filament-ams.yaml aufspielen (Installieren, Wireless).' };
    }
    const auto = safeStorage.getItem(ENTITY_KEY) || '';
    if (auto) await callHaService('automation', 'turn_off', { entity_id: auto });
    for (const c of buildLedTestCalls(testKit, mode, getWorkshopSettings().statusLedBrightness, progressPct, colors)) {
      const r = await haCall(c);
      if (!r.ok) return r;
    }
    const m = LED_TEST_MODES.find(x => x.mode === mode);
    if (mode === 'off') return { ok: true, text: 'LED aus.' };
    let seen = '';
    try {
      await new Promise(r => setTimeout(r, 900));
      const res = await haFetch(`/api/states/${testKit.light}`);
      if (res.ok) seen = ` ${describeLedState(await res.json())}`;
    } catch {
      /* Rückmeldung ist nur Zugabe */
    }
    const bar = mode === 'print' && !(testKit.intensity && testKit.effects.includes('Percent')) ? ' (Ohne Regler „Intensity“ leuchtet der Streifen nur blau, ohne Balken.)' : '';
    return { ok: true, text: `${m?.label}: ${m?.hint}.${seen}${bar}` };
  } catch (err: any) {
    return { ok: false, text: `Home Assistant meldet: ${String(err?.message || err)}` };
  }
}

/** Nur den Druckfortschritt-Balken ändern (Slider), während „Druck läuft“ gezeigt wird */
export async function previewProgress(progressPct: number): Promise<LedTestResult> {
  if (!testKit?.intensity) return { ok: false, text: 'Regler „Status LED Intensity“ nicht gefunden: der Balken lässt sich nicht ändern.' };
  return haCall({ domain: 'number', service: 'set_value', data: { entity_id: testKit.intensity, value: ledIntensityValue(progressPct) } });
}

/** Test beenden: LED aus. Ist „Status-LED“ gewählt, übernimmt die Automation wieder und zeigt den echten Stand. */
export async function endStatusLedPreview(): Promise<void> {
  const entity = testKit?.light;
  testKit = null;
  if (entity) await callHaService('light', 'turn_off', { entity_id: entity });
  if (getWorkshopSettings().statusLed) await setStatusLed(true);
}
