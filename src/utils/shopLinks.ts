import { safeHttpUrl } from './safeData';
import { BRAND_DATABASE, COLOR_MAP, KNOWN_ASIN_DB, MATERIAL_PRESETS } from '../data/defaultSpools';
import { AppSettings, DryingStatus, MaterialType, Spool } from '../types/filament';
import { isSealed } from './spoolState';

export function getBrandInfo(brandName: string, settings?: AppSettings) {
  const lower = (brandName || '').toLowerCase();
  const matched = BRAND_DATABASE.find(b => b.keys.some(k => lower.includes(k)) || b.name.toLowerCase() === lower);

  if (settings && matched && settings.brandPresets[matched.name]) {
    const custom = settings.brandPresets[matched.name];
    return {
      keys: matched.keys,
      name: matched.name,
      tara: custom.tara,
      defaultPrice: custom.defaultPrice,
      shopName: matched.shopName,
      shopType: matched.shopType
    };
  }

  return matched || {
    keys: [],
    name: brandName || 'Unbekannt',
    tara: 200,
    defaultPrice: 18.99,
    shopName: 'Amazon.de Prime (1–2 Tage)',
    shopType: 'amazon' as const
  };
}

// 1.275: Gemerkte Produktseiten. Die App sammelt die Links, die du an deinen Spulen gespeichert hast (auch aus Bestell-Mails),
// und nimmt sie für gleiche Sorten wieder: gleiche Marke + Material + Farbe → genau diese Produktseite statt einer Suche.
/** Gespeicherte Suchseiten (aus alten Versionen) zählen nicht als Produktseite */
export function isSearchUrl(u: string | null | undefined): boolean {
  if (!u) return true;
  try {
    const x = new URL(u);
    return /^\/s(\/|$)/.test(x.pathname) || /\/(search|suche)(\/|$)/i.test(x.pathname) || x.searchParams.has('k') || (x.searchParams.has('q') && !/\/(products?|produkt|dp)\//i.test(x.pathname));
  } catch {
    return true;
  }
}
const realUrl = (u: unknown): string | null => {
  const safe = safeHttpUrl(u);
  return safe && !isSearchUrl(safe) ? safe : null;
};

// Vom Pi gefundene Produktseiten, je Gerät gemerkt (damit der nächste Klick sofort direkt öffnet)
const LS_KEY = 'fh-product-links';
let learned: Record<string, string> = {};
try {
  learned = JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {};
} catch {
  learned = {};
}
export const productKey = (brand: string, material: string, name: string, colorName: string) => [brand, material, name, colorName].map(x => (x || '').toLowerCase().replace(/[^a-z0-9äöüß]+/g, ' ').trim()).join('|');
export function rememberProductUrl(brand: string, material: string, name: string, colorName: string, url: string) {
  const safe = safeHttpUrl(url);
  if (!safe) return;
  learned[productKey(brand, material, name, colorName)] = safe;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(learned));
  } catch {
    /* ohne Speicher: nur für diese Sitzung */
  }
}

let linkPool: Pick<Spool, 'brand' | 'material' | 'name' | 'colorName' | 'productUrl'>[] = [];
export function registerSpoolLinks(list: Spool[]) {
  linkPool = list.filter(s => realUrl(s.productUrl));
}
const norm = (v: string) => (v || '').toLowerCase().replace(/[^a-z0-9äöüß]+/g, ' ').trim();
/** Sucht eine schon bekannte Produktseite derselben Sorte (nur genaue Treffer, kein Raten) */
export function findKnownProductUrl(brand: string, material: string, name: string, colorName: string): string | null {
  const b = norm(brand);
  const m = norm(material);
  const c = norm(colorName);
  const n = norm(name);
  const mine = realUrl(learned[productKey(brand, material, name, colorName)]);
  if (mine) return mine;
  if (!b) return null;
  const same = linkPool.filter(x => norm(x.brand) === b && norm(x.material) === m);
  const hit = same.find(x => c && norm(x.colorName) === c && norm(x.name) === n) || same.find(x => n && norm(x.name) === n) || same.find(x => c && norm(x.colorName) === c);
  const url = hit ? realUrl(hit.productUrl) : null;
  if (url) return url;
  for (const [asin, k] of Object.entries(KNOWN_ASIN_DB)) {
    if (norm(k.brand || '') === b && norm(k.material || '') === m && c && norm(k.colorName || '') === c) return `https://www.amazon.de/dp/${asin}`;
  }
  return null;
}

/** Suchbegriff ohne doppelte Wörter („PLA PLA Basic Schwarz Schwarz“) und ohne Füllwörter */
export function shopQuery(brand: string, material: string, name: string, colorName: string, extra = ''): string {
  const seen = new Set<string>();
  const out: string[] = [];
  // Material nur, wenn der Name noch keins nennt („PA6-CF“ + „PET-CF / PA-CF“ macht die Suche kaputt)
  const nw = (name || '').toLowerCase().split(/[^a-z0-9]+/);
  const nameHasMat = nw.some(w => /^(pla|petg|pet|abs|asa|tpu|pa\d*|pc|cf|gf|nylon)$/.test(w));
  const mat = nameHasMat ? '' : (material || '').split('/')[0].trim();
  for (const w of `${brand} ${name} ${mat} ${colorName} ${extra}`.split(/\s+/)) {
    const k = w.toLowerCase().replace(/[^a-z0-9äöüß.+]/g, '');
    if (!k || seen.has(k) || k === 'filament' && seen.has('filament')) continue;
    seen.add(k);
    out.push(w);
  }
  return out.join(' ');
}

export function generateAutoShopUrl(brand: string, material: string, name: string, colorName: string): string {
  const known = findKnownProductUrl(brand, material, name, colorName);
  if (known) return known;
  const bLower = (brand || '').toLowerCase();
  const mat = material || 'PLA';

  // Offizielle Shops: Suche mit genauem Begriff (Produkt-Adressen werden nicht geraten, die ändern sich)
  if (bLower.includes('bambu')) return `https://eu.store.bambulab.com/de/search?q=${encodeURIComponent(shopQuery('', mat, name.replace(/bambu\s*lab/i, ''), colorName))}`;
  if (bLower.includes('sunlu')) return `https://www.sunlu.com/search?q=${encodeURIComponent(shopQuery('', mat, name.replace(/sunlu/i, ''), colorName))}`;
  if (bLower.includes('prusa')) return `https://www.prusa3d.com/de/search/?q=${encodeURIComponent(shopQuery('Prusament', mat, '', colorName))}`;
  if (bLower.includes('3djake')) return `https://www.3djake.de/search?q=${encodeURIComponent(shopQuery('', mat, name.replace(/3djake/i, ''), colorName))}`;

  // Alle anderen: Amazon.de mit Marke, Name, Material, Farbe, 1.75 mm
  return `https://www.amazon.de/s?k=${encodeURIComponent(shopQuery(brand, mat, name, colorName, 'Filament 1.75mm'))}`;
}

export function getSpoolLink(spool: Spool): { url: string; label: string; auto: boolean } {
  const bLower = (spool.brand || '').toLowerCase();
  const safeUrl = realUrl(spool.productUrl);
  if (safeUrl) {
    let label = 'Shop öffnen';
    if (bLower.includes('bambu')) label = 'Bambu Lab Store';
    else if (bLower.includes('sunlu')) label = 'SUNLU Store';
    else if (safeUrl.includes('amazon')) label = 'Amazon.de Prime';
    return { url: safeUrl, label, auto: false };
  }
  const known = findKnownProductUrl(spool.brand, spool.material, spool.name, spool.colorName);
  if (known) return { url: known, label: 'Produktseite (gemerkt)', auto: true };
  const url = generateAutoShopUrl(spool.brand, spool.material, spool.name, spool.colorName);
  let label = 'Amazon.de Suche';
  if (bLower.includes('bambu')) label = 'Bambu Store Suche';
  else if (bLower.includes('sunlu')) label = 'SUNLU Suche';
  else if (bLower.includes('prusa')) label = 'Prusa Shop Suche';
  else if (bLower.includes('3djake')) label = '3DJake Suche';
  return { url, label, auto: true };
}

function extractAsin(urlStr: string): string | null {
  const m = (urlStr || '').match(/(?:\/dp\/|\/gp\/product\/)([A-Z0-9]{10})/i);
  return m ? m[1].toUpperCase() : null;
}

export function findHexForColorName(val: string): string {
  const lower = (val || '').toLowerCase();
  for (const c of COLOR_MAP) {
    if (c.keys.some(k => lower.includes(k)) || c.name.toLowerCase().includes(lower)) {
      return c.hex;
    }
  }
  return '#f97316';
}

export function parseFilamentText(inputStr: string, rawText = '', settings?: AppSettings): Partial<Spool> {
  const asin = extractAsin(inputStr);
  if (asin && KNOWN_ASIN_DB[asin]) {
    return { ...KNOWN_ASIN_DB[asin], productUrl: inputStr };
  }
  const combined = `${inputStr} ${rawText}`.toLowerCase();

  let detectedBrand = 'Bambu Lab';
  let detectedTara = 250;
  let detectedPrice = 19.99;
  for (const b of BRAND_DATABASE) {
    if (b.keys.some(k => combined.includes(k))) {
      detectedBrand = b.name;
      detectedTara = settings?.brandPresets[b.name]?.tara ?? b.tara;
      detectedPrice = settings?.brandPresets[b.name]?.defaultPrice ?? b.defaultPrice;
      break;
    }
  }

  let detectedMaterial: MaterialType = 'PLA';
  if (combined.includes('pla+') || combined.includes('pla plus') || combined.includes('pla pro')) detectedMaterial = 'PLA+';
  else if (combined.includes('petg')) detectedMaterial = 'PETG';
  else if (combined.includes('tpu')) detectedMaterial = 'TPU';
  else if (combined.includes('asa')) detectedMaterial = 'ASA';
  else if (combined.includes('abs')) detectedMaterial = 'ABS';
  else if (combined.includes('nylon') || combined.includes('pa6') || combined.includes('pa12') || combined.includes('pa /')) detectedMaterial = 'PA / Nylon';
  else if (combined.includes('pc') || combined.includes('polycarbonat')) detectedMaterial = 'PC';
  else if (combined.includes('cf') || combined.includes('carbon')) detectedMaterial = 'PET-CF / PA-CF';

  let detectedColorName = 'Standard';
  let detectedColorHex = '#f97316';
  for (const c of COLOR_MAP) {
    if (c.keys.some(k => combined.includes(k))) {
      detectedColorName = c.name;
      detectedColorHex = c.hex;
      break;
    }
  }

  const isRefill = combined.includes('refill') || combined.includes('ohne spule');
  if (isRefill) detectedTara = 0;

  let cleanTitle = `${detectedMaterial} Basic ${detectedColorName}`;
  if (combined.includes('matte') || combined.includes('matt')) cleanTitle = `${detectedMaterial} Matte ${detectedColorName}`;
  else if (combined.includes('silk')) cleanTitle = `Silk ${detectedMaterial} ${detectedColorName}`;

  const customPreset = settings?.materialPresets[detectedMaterial];
  const preset = customPreset || MATERIAL_PRESETS[detectedMaterial] || MATERIAL_PRESETS['PLA'];

  // 1.278: Nur eine echte Adresse speichern; ohne Adresse sucht der Pi beim ersten Klick die Produktseite
  const finalUrl = inputStr.startsWith('http') && !isSearchUrl(inputStr) ? inputStr : undefined;

  return {
    brand: detectedBrand,
    material: detectedMaterial,
    colorName: detectedColorName,
    colorHex: detectedColorHex,
    name: cleanTitle,
    emptySpoolWeight: detectedTara,
    pricePerKg: detectedPrice,
    productUrl: finalUrl,
    dryIntervalDays: preset.intervalDays,
    dryTemp: preset.temp,
    dryHours: preset.hours
  };
}

export function getDryingStatus(spool: Spool, now = Date.now()): DryingStatus {
  // Original verschweißt = frisch (kein Trocknen nötig). „Muss trocknen“ von Hand gesetzt = fällig, bis getrocknet wird.
  const forced = Boolean(spool.needsDrying);
  const sealed = isSealed(spool) && !forced;
  const lastDriedMs = sealed ? now : new Date(spool.lastDried || now).getTime();
  const intervalDays = Number(spool.dryIntervalDays) || 30;
  const intervalMs = intervalDays * 86400000;
  const diffMs = forced ? Math.min((lastDriedMs + intervalMs) - now, -1) : (lastDriedMs + intervalMs) - now;
  const isOverdue = diffMs <= 0;
  const absMs = Math.abs(diffMs);

  // Prozentwert für den Trocknungsbalken (100% = frisch getrocknet, 0% = überfällig)
  const dryPct = Math.max(0, Math.min(100, Math.round((diffMs / intervalMs) * 100)));

  let statusLevel: 'ok' | 'soon' | 'overdue' = 'ok';
  let dryBarColor = 'bg-sky-500';
  if (isOverdue) {
    statusLevel = 'overdue';
    dryBarColor = 'bg-rose-500';
  } else if (diffMs < 3 * 86400000 || dryPct <= 20) {
    statusLevel = 'soon';
    dryBarColor = 'bg-amber-500';
  } else if (dryPct <= 55) {
    dryBarColor = 'bg-emerald-500';
  }

  return {
    diffMs,
    isOverdue,
    statusLevel,
    dryPct,
    dryBarColor,
    days: Math.floor(absMs / 86400000),
    hours: Math.floor((absMs % 86400000) / 3600000),
    mins: Math.floor((absMs % 3600000) / 60000),
    secs: Math.floor((absMs % 60000) / 1000),
    lastDriedFormatted: sealed ? 'verschweißt' : new Date(lastDriedMs).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    sealed,
    forced
  };
}
