// Was die begrenzte Home-Assistant-Weiterleitung (/api/homeassistant/raw) durchlassen darf.
// Rein (ohne Netz), damit es testbar ist. Alles andere wird mit 403 abgelehnt.

const ID_LIGHT = /^light\.[a-z0-9_]+$/;
const ID_INTENSITY = /^number\.[a-z0-9_]*intensity[a-z0-9_]*$/;
const hasOnly = (b: Record<string, unknown>, keys: string[]) => Object.keys(b).every(k => keys.includes(k));
const isObj = (b: unknown): b is Record<string, unknown> => Boolean(b) && typeof b === 'object' && !Array.isArray(b);

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

const RAW_ALLOWED: { method: string; path: RegExp; body?: (b: unknown) => boolean }[] = [
  { method: 'GET', path: /^\/api\/states$/ },
  { method: 'GET', path: /^\/api\/states\/automation\.filamenthub_[a-z0-9_]+$/ },
  { method: 'GET', path: /^\/api\/states\/(light|number)\.[a-z0-9_]+$/ },
  // NFC-Leser im AMS (ESPHome „Filament AMS“): Tag je Slot, Leser-Zustand, letzter Tag. Nur Sensoren mit „ams“ im Namen.
  { method: 'GET', path: /^\/api\/states\/sensor\.[a-z0-9_]*ams[a-z0-9_]*$/ },
  // Verlauf der Druck-Sensoren (Druckverlauf ohne App): nur Sensoren, höchstens 8, nur diese Zusätze
  { method: 'GET', path: /^\/api\/history\/period\/[0-9A-Za-z%.\-]+\?filter_entity_id=sensor\.[a-z0-9_]+(,sensor\.[a-z0-9_]+){0,7}(&(minimal_response|no_attributes|significant_changes_only=[01]|end_time=[0-9A-Za-z%.\-]+))*$/ },
  { method: 'POST', path: /^\/api\/config\/automation\/config\/filamenthub_[a-z0-9_]+$/ },
  { method: 'POST', path: /^\/api\/services\/automation\/(turn_on|turn_off)$/ },
  { method: 'POST', path: /^\/api\/services\/light\/(turn_on|turn_off)$/, body: okLedLightBody },
  { method: 'POST', path: /^\/api\/services\/number\/set_value$/, body: okLedIntensityBody }
];

export function isRawAllowed(method: string, path: string, body: unknown): boolean {
  return RAW_ALLOWED.some(a => a.method === method && a.path.test(path) && (!a.body || a.body(body)));
}
