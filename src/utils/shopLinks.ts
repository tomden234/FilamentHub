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

export function generateAutoShopUrl(brand: string, material: string, name: string, colorName: string): string {
  const bLower = (brand || '').toLowerCase();
  const mLower = (material || 'PLA').toLowerCase();
  const nLower = `${name || ''} ${colorName || ''}`.toLowerCase();

  // 1. BAMBU LAB -> Offizieller Bambu Lab EU Store (DE-Lager, 1-3 Tage)
  if (bLower.includes('bambu')) {
    let slug = 'pla-basic-filament';
    if (nLower.includes('matte') || nLower.includes('matt')) slug = 'pla-matte-filament';
    else if (mLower.includes('petg')) slug = 'petg-hf';
    else if (mLower.includes('tpu')) slug = 'tpu-95a-hf';
    else if (mLower.includes('asa')) slug = 'asa-filament';
    else if (mLower.includes('abs')) slug = 'abs-filament';
    else if (mLower.includes('pa') || mLower.includes('nylon') || mLower.includes('cf')) slug = 'paht-cf';
    return `https://eu.store.bambulab.com/de/products/${slug}`;
  }

  // 2. SUNLU -> Offizieller SUNLU Store (1-3 Tage EU)
  if (bLower.includes('sunlu')) {
    const q = encodeURIComponent(`${material || 'PLA'} ${colorName || ''}`.trim());
    return `https://www.sunlu.com/search?q=${q}`;
  }

  // 3. ALLE ANDEREN MARKEN -> Amazon.de Prime (1-2 Tage)
  const query = encodeURIComponent(`${brand || ''} ${material || 'PLA'} ${colorName || ''} ${name || ''} Filament 1.75mm`.replace(/\s+/g, ' ').trim());
  return `https://www.amazon.de/s?k=${query}`;
}

export function getSpoolLink(spool: Spool): { url: string; label: string; auto: boolean } {
  const bLower = (spool.brand || '').toLowerCase();
  const safeUrl = safeHttpUrl(spool.productUrl);
  if (safeUrl) {
    let label = 'Shop öffnen';
    if (bLower.includes('bambu')) label = 'Bambu Lab Store';
    else if (bLower.includes('sunlu')) label = 'SUNLU Store';
    else if (safeUrl.includes('amazon')) label = 'Amazon.de Prime';
    return {
      url: safeUrl,
      label,
      auto: false
    };
  }
  const url = generateAutoShopUrl(spool.brand, spool.material, spool.name, spool.colorName);
  let label = 'Amazon.de Prime (1–2d)';
  if (bLower.includes('bambu')) label = 'Bambu Store (1–3d)';
  else if (bLower.includes('sunlu')) label = 'SUNLU Shop (1–3d)';
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

  const finalUrl = inputStr.startsWith('http')
    ? inputStr
    : generateAutoShopUrl(detectedBrand, detectedMaterial, cleanTitle, detectedColorName);

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
