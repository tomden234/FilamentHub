// Was die begrenzte Home-Assistant-Weiterleitung (/api/homeassistant/raw) durchlassen darf.
// Rein (ohne Netz), damit es testbar ist. Alles andere wird mit 403 abgelehnt.

const ID_LIGHT = /^light\.[a-z0-9_]+$/;
const ID_INTENSITY = /^number\.[a-z0-9_]*intensity[a-z0-9_]*$/;
const hasOnly = (b: Record<string, unknown>, keys: string[]) => Object.keys(b).every(k => keys.includes(k));
const isObj = (b: unknown): b is Record<string, unknown> => Boolean(b) && typeof b === 'object' && !Array.isArray(b);

/** Dienste, die FilamentHub-Automationen aufrufen dürfen (genau die, die die App selbst anlegt). Alles andere (lock., shell_command., script. …) wird abgelehnt. */
const AUTOMATION_SERVICES = new Set([
  'switch.turn_on', 'switch.turn_off', 'light.turn_on', 'light.turn_off',
  'number.set_value', 'automation.turn_on', 'automation.turn_off'
]);

/** Automation für FilamentHub (1.233): nur diese Dienste, begrenzte Größe und Tiefe */
export function okAutomationBody(b: unknown): boolean {
  if (!isObj(b)) return false;
  let json: string;
  try { json = JSON.stringify(b); } catch { return false; }
  if (json.length > 20_000) return false;
  const walk = (v: unknown, depth: number): boolean => {
    if (depth > 12) return false;
    if (Array.isArray(v)) return v.every(x => walk(x, depth + 1));
    if (!isObj(v)) return true;
    for (const [k, x] of Object.entries(v)) {
      if ((k === 'service' || k === 'action') && typeof x === 'string' && !AUTOMATION_SERVICES.has(x)) return false;
      if (k === 'service_template' || k === 'action_template') return false;
      if (!walk(x, depth + 1)) return false;
    }
    return true;
  };
  return walk(b, 0);
}

/** Status-LED an/aus mit Farbe, Helligkeit und Effekt: genau ein Licht, nur diese Felder */
export function okLedLightBody(b: unknown): boolean {
  if (!isObj(b)) return false;
  if (typeof b.entity_id !== 'string' || !ID_LIGHT.test(b.entity_id)) return false;
  if (!hasOnly(b, ['entity_id', 'brightness_pct', 'rgb_color', 'effect'])) return false;
  const pct = b.brightness_pct;
  if (pct !== undefined && !(typeof pct === 'number' && Number.isFinite(pct) && pct >= 0 && pct <= 100)) return false;
  const rgb = b.rgb_color;
  if (rgb !== undefined && !(Array.isArray(rgb) && rgb.length === 3 && rgb.every(n => Number.isInteger(n) && n >= 0 && n <= 255))) return false;
  const fx = b.effect;
  if (fx !== undefined && !(typeof fx === 'string' && fx.length > 0 && fx.length <= 40)) return false;
  return true;
}

/** Regler „Intensity“ der Status-LED (Druckfortschritt-Balken): genau ein Regler, Wert 0 bis 255 */
export function okLedIntensityBody(b: unknown): boolean {
  if (!isObj(b)) return false;
  if (typeof b.entity_id !== 'string' || !ID_INTENSITY.test(b.entity_id)) return false;
  if (!hasOnly(b, ['entity_id', 'value'])) return false;
  return typeof b.value === 'number' && Number.isFinite(b.value) && b.value >= 0 && b.value <= 255;
}

/** Warteschlangen-LEDs am AMS-ESP: number.*ams*warteschlange, Wert 0-10 */
function okQueueBody(b: unknown): boolean {
  if (!isObj(b) || !hasOnly(b, ['entity_id', 'value'])) return false;
  if (typeof b.entity_id !== 'string' || !/^number\.[a-z0-9_]*_warteschlange(_modus)?(_\d+)?$/.test(b.entity_id)) return false;
  return typeof b.value === 'number' && Number.isInteger(b.value) && b.value >= 0 && b.value <= 10;
}

/** Test-Modus des Tasters: genau switch.*ams*_warteschlange_test */
function okQueueTestBody(b: unknown): boolean {
  return isObj(b) && hasOnly(b, ['entity_id']) && typeof b.entity_id === 'string' && /^switch\.[a-z0-9_]*_warteschlange_test(_\d+)?$/.test(b.entity_id);
}

/** Nachtmodus der LED-Streifen am AMS-ESP: number.*_led_nacht_ab/_bis (0-23) und *_led_nacht_helligkeit (5-100) */
function okNightBody(b: unknown): boolean {
  if (!isObj(b) || !hasOnly(b, ['entity_id', 'value'])) return false;
  if (typeof b.entity_id !== 'string' || typeof b.value !== 'number' || !Number.isInteger(b.value)) return false;
  if (/^number\.[a-z0-9_]*_led_nacht_(ab|bis)(_\d+)?$/.test(b.entity_id)) return b.value >= 0 && b.value <= 23;
  if (/^number\.[a-z0-9_]*_led_nacht_helligkeit(_\d+)?$/.test(b.entity_id)) return b.value >= 5 && b.value <= 100;
  return false;
}

/** Nachtmodus an/aus: genau switch.*_led_nachtmodus */
function okNightSwitchBody(b: unknown): boolean {
  return isObj(b) && hasOnly(b, ['entity_id']) && typeof b.entity_id === 'string' && /^switch\.[a-z0-9_]*_led_nachtmodus(_\d+)?$/.test(b.entity_id);
}

const RAW_ALLOWED: { method: string; path: RegExp; body?: (b: unknown) => boolean }[] = [
  { method: 'GET', path: /^\/api\/states$/ },
  { method: 'GET', path: /^\/api\/states\/automation\.filamenthub_[a-z0-9_]+$/ },
  { method: 'GET', path: /^\/api\/states\/(light|number)\.[a-z0-9_]+$/ },
  // AMS-ESP (ESPHome „Filament AMS“): Tag je Slot, Leser-Zustand, letzter Tag, Feuchte, Testschalter. Nur lesen.
  // 1.206: auch ohne „ams“ in der ID (Home Assistant behält alte IDs, wenn das Gerät früher anders hieß)
  { method: 'GET', path: /^\/api\/states\/(sensor|binary_sensor|switch)\.[a-z0-9_]+$/ },
  // Testmenü: Warteschlangen-LEDs (0-10) setzen und den Test-Modus des Tasters schalten
  { method: 'POST', path: /^\/api\/services\/number\/set_value$/, body: okQueueBody },
  { method: 'POST', path: /^\/api\/services\/switch\/(turn_on|turn_off)$/, body: okQueueTestBody },
  // Verlauf der Druck-Sensoren (Druckverlauf ohne App): nur Sensoren, höchstens 8, nur diese Zusätze
  { method: 'GET', path: /^\/api\/history\/period\/[0-9A-Za-z%.\-]+\?filter_entity_id=sensor\.[a-z0-9_]+(,sensor\.[a-z0-9_]+){0,7}(&(minimal_response|no_attributes|significant_changes_only=[01]|end_time=[0-9A-Za-z%.\-]+))*$/ },
  { method: 'POST', path: /^\/api\/config\/automation\/config\/filamenthub_[a-z0-9_]+$/, body: okAutomationBody },
  { method: 'POST', path: /^\/api\/services\/automation\/(turn_on|turn_off)$/ },
  { method: 'POST', path: /^\/api\/services\/light\/(turn_on|turn_off)$/, body: okLedLightBody },
  { method: 'POST', path: /^\/api\/services\/number\/set_value$/, body: okLedIntensityBody },
  // Nachtmodus der LED-Streifen (Werkstatt → Status-LED)
  { method: 'POST', path: /^\/api\/services\/number\/set_value$/, body: okNightBody },
  { method: 'POST', path: /^\/api\/services\/switch\/(turn_on|turn_off)$/, body: okNightSwitchBody }
];

export function isRawAllowed(method: string, path: string, body: unknown): boolean {
  return RAW_ALLOWED.some(a => a.method === method && a.path.test(path) && (!a.body || a.body(body)));
}
