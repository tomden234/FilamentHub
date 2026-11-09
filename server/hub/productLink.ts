// 1.276: Produktseite einer Spule finden. Der Pi fragt Gemini mit Google-Suche, nimmt nur echte Treffer aus der Suche
// (nichts, was das Modell frei erfindet), kürzt Amazon-Links auf amazon.de/dp/ASIN und merkt sich das Ergebnis.
import path from 'path';
import { dataDir } from '../paths.js';
import { loadJsonConfig, saveJsonConfig } from '../jsonConfig.js';
import { geminiReady, geminiSearchUrls } from './gemini.js';

export interface ProductSpec {
  brand: string;
  material: string;
  name: string;
  colorName: string;
}

const clean = (v: unknown, max = 80) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
export const cleanSpec = (b: any): ProductSpec => ({ brand: clean(b?.brand, 40), material: clean(b?.material, 30), name: clean(b?.name), colorName: clean(b?.colorName, 40) });
export const specKey = (s: ProductSpec) => [s.brand, s.material, s.name, s.colorName].map(x => x.toLowerCase().replace(/[^a-z0-9äöüß]+/g, ' ').trim()).join('|');

const SHOPS: { test: RegExp; brand?: RegExp }[] = [
  { test: /(^|\.)bambulab\.com$/, brand: /bambu/i },
  { test: /(^|\.)sunlu\.com$/, brand: /sunlu/i },
  { test: /(^|\.)prusa3d\.com$/, brand: /prus/i },
  { test: /(^|\.)3djake\.[a-z]+$/, brand: /3djake/i },
  { test: /(^|\.)polymaker\.com$/, brand: /polymaker/i },
  { test: /(^|\.)esun3d\.com$/, brand: /esun/i },
  { test: /(^|\.)elegoo\.com$/, brand: /elegoo/i }
];

/** Aus den Such-Treffern die beste Produktseite wählen (rein, testbar). Nur Amazon-Produktseiten und offizielle Shops, keine Suchseiten. */
export function pickProductUrl(urls: string[], brand: string): string | null {
  const amazon: string[] = [];
  const official: string[] = [];
  for (const raw of urls) {
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      continue;
    }
    if (u.protocol !== 'https:') continue;
    const host = u.hostname.toLowerCase();
    const asin = /(?:\/dp\/|\/gp\/product\/)([A-Z0-9]{10})(?![A-Z0-9])/i.exec(u.pathname)?.[1];
    if (/(^|\.)amazon\.de$/.test(host) && asin) {
      amazon.push(`https://www.amazon.de/dp/${asin.toUpperCase()}`);
    } else if (SHOPS.some(s => s.test.test(host) && s.brand?.test(brand)) && /\/(products?|p|produkt)\//i.test(u.pathname) && !/search|suche/i.test(u.pathname)) {
      u.hash = '';
      official.push(u.toString().slice(0, 500));
    }
  }
  const ownShop = SHOPS.some(s => s.brand?.test(brand));
  return (ownShop ? official[0] || amazon[0] : amazon[0] || official[0]) || null;
}

/** Gemini-Treffer sind Weiterleitungen (vertexaisearch…): bis zur echten Adresse folgen */
export async function resolveRedirect(url: string, hops = 4): Promise<string> {
  let cur = url;
  for (let i = 0; i < hops; i++) {
    let host = '';
    try {
      host = new URL(cur).hostname;
    } catch {
      return cur;
    }
    if (!/vertexaisearch\.cloud\.google\.com$|google\.com$/.test(host)) return cur;
    const r = await fetch(cur, { redirect: 'manual', signal: AbortSignal.timeout(8000) });
    const loc = r.headers.get('location');
    if (!loc) return cur;
    cur = new URL(loc, cur).toString();
  }
  return cur;
}

const cacheFile = () => path.join(dataDir, 'product-links.json');
type Cache = Record<string, { url: string; at: number }>;
const readCache = (): Cache => loadJsonConfig<Cache>([cacheFile()]) || {};

export async function findProductPage(spec: ProductSpec): Promise<{ url: string | null; cached: boolean; error?: string }> {
  if (!spec.brand && !spec.name) return { url: null, cached: false, error: 'Marke oder Name fehlt' };
  const key = specKey(spec);
  const hit = readCache()[key];
  if (hit?.url) return { url: hit.url, cached: true };
  if (!geminiReady()) return { url: null, cached: false, error: 'Kein Gemini-Schlüssel im Add-on' };
  try {
    const q = `${spec.brand} ${spec.name} ${spec.material} ${spec.colorName} Filament 1.75mm`.replace(/\s+/g, ' ').trim();
    const found = await geminiSearchUrls(`Finde die Produktseite dieses 3D-Druck-Filaments auf amazon.de (bevorzugt) oder im offiziellen Shop des Herstellers: ${q}. Es geht um genau dieses Produkt in dieser Farbe, keine Suchseite.`);
    const real: string[] = [];
    for (const f of found.slice(0, 8)) {
      try {
        real.push(await resolveRedirect(f));
      } catch {
        /* Treffer überspringen */
      }
    }
    const url = pickProductUrl(real, spec.brand);
    if (!url) return { url: null, cached: false, error: 'Keine passende Produktseite gefunden' };
    const c = readCache();
    c[key] = { url, at: Date.now() };
    saveJsonConfig(cacheFile(), c, 'product-links.json', { pretty: false, keepPrev: true });
    return { url, cached: false };
  } catch (e: any) {
    return { url: null, cached: false, error: String(e?.message || e).slice(0, 120) };
  }
}
