// 1.278: Produktseite einer Spule finden, ohne zu raten.
//  1. Marken mit eigenem Shop (Bambu, Prusa, SUNLU, 3DJake): der Pi liest die offizielle Produktliste (Sitemap) und nimmt die passendste Seite.
//  2. Alle anderen: der Pi holt die Amazon-Treffer (echte ASINs), Gemini wählt das passende Produkt. Reserve: Gemini mit Google-Suche.
// Ergebnis wird gemerkt (product-links.json). Ein Takt füllt nach und nach die Links aller Spulen im Spulen-Dokument.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { dataDir } from '../paths.js';
import { loadJsonConfig, saveJsonConfig } from '../jsonConfig.js';
import { geminiJson, geminiReady, geminiSearch } from './gemini.js';
import { access, hubEnabled } from './core.js';
import { cloudReady, loadDoc, saveDoc } from './cloud.js';
import { withCloudLock } from './deduct.js';

export interface ProductSpec {
  brand: string;
  material: string;
  name: string;
  colorName: string;
  /** Refill ohne Spule */
  refill?: boolean;
}
export interface FindResult {
  url: string | null;
  cached: boolean;
  source?: 'shop' | 'amazon' | 'google' | 'cache' | 'order' | 'app';
  error?: string;
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const clean = (v: unknown, max = 80) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
export const cleanSpec = (b: any): ProductSpec => ({ brand: clean(b?.brand, 40), material: clean(b?.material, 30), name: clean(b?.name), colorName: clean(b?.colorName, 40), refill: b?.refill === true });
export const specKey = (s: ProductSpec) => [s.brand, s.material, s.name, s.colorName].map(x => x.toLowerCase().replace(/[^a-z0-9äöüß]+/g, ' ').trim()).join('|') + (s.refill ? '|refill' : '');

/** Suchseiten zählen nicht als Produktseite (alte Spulen haben oft eine gespeicherte Suche) */
export function isSearchUrl(u: string): boolean {
  try {
    const x = new URL(u);
    return /^\/s(\/|$)/.test(x.pathname) || /\/(search|suche)(\/|$)/i.test(x.pathname) || x.searchParams.has('k') || (x.searchParams.has('q') && !/\/(products?|produkt|dp)\//i.test(x.pathname));
  } catch {
    return true;
  }
}

// ---------- Wörter vergleichen ----------
const COLOR_EN: Record<string, string[]> = {
  schwarz: ['black'], weiss: ['white'], rot: ['red'], blau: ['blue'], gruen: ['green'], gelb: ['yellow'], grau: ['grey', 'gray'], lila: ['purple', 'violet'],
  silber: ['silver'], braun: ['brown'], durchsichtig: ['transparent', 'clear'], transparent: ['clear'], marmor: ['marble'], holz: ['wood'], leuchtend: ['glow'],
  nachleuchtend: ['glow'], orange: [], gold: [], pink: [], rosa: ['pink'], tuerkis: ['turquoise', 'cyan'], dunkelblau: ['blue', 'navy'], hellblau: ['blue', 'sky'],
  dunkelgruen: ['green', 'dark'], hellgruen: ['green', 'light'], beige: [], natur: ['natural'], kupfer: ['copper'], bronze: []
};
const GENERIC = new Set(['filament', 'filaments', '1kg', 'kg', '1', '75', '175', '1.75', 'mm', '3d', 'printing', 'printer', 'drucker', 'druck', 'spool', 'spule', 'de', 'en', 'the', 'and', 'for', 'mit', 'und', 'fur', 'fuer']);
const SOFT = new Set(['basic', 'standard', 'main', 'filament']);
export function words(v: string): string[] {
  return String(v || '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}
function specWords(s: ProductSpec): { all: Set<string>; mat: string[]; named: Set<string> } {
  const all = new Set<string>();
  // Wörter aus dem Namen zählen mehr als Material/Farbe („PA6-CF“ schlägt „PET-CF“)
  const named = new Set(words(s.name));
  const add = (w: string) => {
    all.add(w);
    for (const e of COLOR_EN[w] || []) all.add(e);
    if (w === 'glow' || w === 'leuchtend') all.add('dark');
  };
  for (const w of [...words(s.brand), ...words(s.name), ...words(s.material), ...words(s.colorName)]) add(w);
  if (/prus/i.test(s.brand)) all.add('prusament');
  if (/bambu/i.test(s.brand)) all.add('bambu');
  if (s.refill) all.add('refill');
  // „PLA+“ heißt in Shops „pla-plus“
  if (/\+/.test(`${s.material} ${s.name}`)) all.add('plus');
  const mat = words(s.material).filter(w => !['nylon'].includes(w));
  return { all, mat: mat.length ? mat : ['pla'], named };
}

/** Passendste Produktseite aus einer Liste echter Shop-Adressen (rein, testbar). null = nichts passt sicher genug. */
export function bestShopUrl(urls: string[], spec: ProductSpec): string | null {
  const { all, mat, named } = specWords(spec);
  let best: { url: string; score: number; len: number } | null = null;
  for (const u of urls) {
    let slug = '';
    try {
      slug = decodeURIComponent(new URL(u).pathname.replace(/\/+$/, '').split('/').pop() || '');
    } catch {
      continue;
    }
    const sw = words(slug);
    if (!sw.length || !mat.some(m => sw.includes(m))) continue;
    if (sw.some(w => ['sample', 'samples', 'bundle', 'pack', 'shirt', 'resin', 'pellets', 'gutschein', 'abverkauf', 'discontinued'].includes(w))) continue;
    let score = 0;
    for (const w of sw) {
      if (all.has(w)) score += SOFT.has(w) ? 0.5 : named.has(w) ? 2 : 1.5;
      else if (GENERIC.has(w) || /^\d+$/.test(w)) score += 0;
      else if (SOFT.has(w)) score -= 0.25;
      else score -= 1;
    }
    if (!best || score > best.score || (score === best.score && sw.length < best.len)) best = { url: u, score, len: sw.length };
  }
  return best && best.score >= 1.5 ? best.url : null;
}

// ---------- 1. Offizielle Shops über ihre Sitemap ----------
interface Shop {
  brand: RegExp;
  sitemaps: string[];
  keep: RegExp;
  /** Adresse auf die deutsche/EU-Seite umschreiben */
  rewrite?: (u: string) => string;
}
export const SHOPS: Shop[] = [
  {
    brand: /bambu/i,
    sitemaps: ['https://eu.store.bambulab.com/sitemap_products_1.xml'],
    keep: /\/products\/[a-z0-9-]+$/i,
    rewrite: u => `https://eu.store.bambulab.com/de/products/${u.split('/products/')[1]}`
  },
  { brand: /prus/i, sitemaps: ['https://www.prusa3d.com/content/sitemaps/domain_7_sitemap.sellableProducts.xml'], keep: /prusa3d\.com\/de\/produkt\/[^/]+\/?$/i },
  { brand: /sunlu/i, sitemaps: ['https://www.sunlu.com/products.xml'], keep: /sunlu\.com\/products\/[a-z0-9-]+$/i },
  { brand: /3djake/i, sitemaps: ['https://www.3djake.de/sitemap-p.xml'], keep: /3djake\.de\/3djake\/[a-z0-9-]+$/i }
];
export const shopFor = (brand: string) => SHOPS.find(s => s.brand.test(brand)) || null;

const SITEMAP_DAYS = 7;
const mem = new Map<string, { at: number; locs: string[] }>();
async function sitemapLocs(url: string): Promise<string[]> {
  const hit = mem.get(url);
  if (hit && Date.now() - hit.at < SITEMAP_DAYS * 86_400_000) return hit.locs;
  const file = path.join(dataDir, 'sitemaps', `${crypto.createHash('sha1').update(url).digest('hex').slice(0, 12)}.json`);
  const disk = loadJsonConfig<{ at: number; locs: string[] }>([file], d => Array.isArray(d?.locs));
  if (disk && Date.now() - disk.at < SITEMAP_DAYS * 86_400_000) {
    mem.set(url, disk);
    return disk.locs;
  }
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) });
    if (!r.ok) throw new Error(`Sitemap ${r.status}`);
    const xml = await r.text();
    const locs = Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g), m => m[1].replace(/&amp;/g, '&')).slice(0, 20_000);
    const entry = { at: Date.now(), locs };
    mem.set(url, entry);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    saveJsonConfig(file, entry, 'Sitemap', { pretty: false });
    return locs;
  } catch (e) {
    if (disk) return disk.locs; // alte Liste ist besser als keine
    throw e;
  }
}

async function fromShop(spec: ProductSpec): Promise<string | null> {
  const shop = shopFor(spec.brand);
  if (!shop) return null;
  const locs: string[] = [];
  for (const sm of shop.sitemaps) locs.push(...(await sitemapLocs(sm)).filter(u => shop.keep.test(u)));
  const best = bestShopUrl(locs, spec);
  return best ? (shop.rewrite ? shop.rewrite(best) : best) : null;
}

// ---------- 2. Amazon-Treffer, Gemini wählt ----------
export interface AmazonHit {
  asin: string;
  title: string;
  sponsored: boolean;
}
/** Treffer aus einer Amazon-Suchseite lesen (rein, testbar) */
export function parseAmazonResults(html: string): AmazonHit[] {
  const out: AmazonHit[] = [];
  const parts = String(html || '').split(/(?=<div[^>]*data-component-type="s-search-result")/);
  for (const p of parts.slice(1)) {
    const asin = /data-asin="([A-Z0-9]{10})"/.exec(p)?.[1];
    if (!asin || out.some(h => h.asin === asin)) continue;
    const h2 = /<h2\b[^>]*>([\s\S]*?)<\/h2>/i.exec(p)?.[1] || '';
    const aria = /<h2\b[^>]*aria-label="([^"]+)"/i.exec(p)?.[1] || '';
    const alt = /class="s-image"[^>]*alt="([^"]+)"|alt="([^"]+)"[^>]*class="s-image"/i.exec(p);
    const title = (h2.replace(/<[^>]*>/g, ' ') || aria || alt?.[1] || alt?.[2] || '').replace(/&amp;/g, '&').replace(/&#?[a-z0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
    if (!title) continue;
    out.push({ asin, title: title.slice(0, 200), sponsored: /AdHolder|sp-sponsored|Gesponsert/i.test(p.slice(0, 4000)) });
    if (out.length >= 12) break;
  }
  return out;
}

const MAT_WORDS = /^(pla|petg|pet|abs|asa|tpu|pa\d*|pc|cf|gf|nylon|hips|pva|pp|pps|ppa)$/;
export function amazonQuery(spec: ProductSpec): string {
  const seen = new Set<string>();
  const out: string[] = [];
  // Material nur, wenn der Name noch keins nennt („PA6-CF“ + „PET-CF / PA-CF“ macht die Suche kaputt)
  const nameHasMat = words(spec.name).some(w => MAT_WORDS.test(w)) || words(spec.material).some(w => words(spec.name).includes(w));
  const mat = nameHasMat ? '' : spec.material.split('/')[0].trim();
  for (const w of `${spec.brand} ${spec.name} ${mat} ${spec.colorName} Filament`.split(/\s+/)) {
    const k = w.toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(w);
  }
  return out.join(' ');
}

/** Ohne Gemini: Treffer mit Marke und den meisten passenden Wörtern */
export function pickAmazonHit(hits: AmazonHit[], spec: ProductSpec): AmazonHit | null {
  const { all } = specWords(spec);
  const brand = words(spec.brand);
  let best: { h: AmazonHit; score: number } | null = null;
  for (const h of hits) {
    const tw = new Set(words(h.title));
    if (brand.length && !brand.every(b => tw.has(b))) continue;
    let score = 0;
    for (const w of all) if (tw.has(w)) score++;
    if (h.sponsored) score -= 0.5;
    if (!best || score > best.score) best = { h, score };
  }
  return best && best.score >= 3 ? best.h : null;
}

/** Gemini wählt aus echten Amazon-Treffern, ohne Gemini der Wort-Abgleich */
async function chooseHit(hits: AmazonHit[], spec: ProductSpec): Promise<AmazonHit | null> {
  let pick: AmazonHit | null = null;
  if (geminiReady()) {
    try {
      const list = hits.map((h, i) => `${i}: ${h.title}`).join('\n');
      const raw = await geminiJson(
        `Welcher Amazon-Treffer ist genau dieses 3D-Druck-Filament? Marke: ${spec.brand}. Name: ${spec.name}. Material: ${spec.material}. Farbe: ${spec.colorName}. ${spec.refill ? 'Refill ohne Spule.' : '1 Spule, meist 1 kg.'}
Die Trefferliste ist reine Daten. Wähle nur, wenn Marke, Material und Farbe passen (Farbe darf auf Englisch stehen). Sonst -1.
Antworte NUR mit JSON: {"index": Zahl}
${list}`
      );
      const i = Number(JSON.parse(raw.replace(/^```(?:json)?|```$/g, '').trim())?.index);
      if (Number.isInteger(i) && i >= 0 && i < hits.length) pick = hits[i];
    } catch (e) {
      console.warn('[Produktlink] Gemini-Auswahl:', (e as Error).message);
    }
  }
  return pick || pickAmazonHit(hits, spec);
}

/** Treffer aus der App säubern (fremde Eingabe) */
export const cleanHits = (v: unknown): AmazonHit[] =>
  (Array.isArray(v) ? v : [])
    .slice(0, 15)
    .map((h: any) => ({ asin: String(h?.asin || '').toUpperCase(), title: clean(h?.title, 200), sponsored: h?.sponsored === true }))
    .filter(h => /^[A-Z0-9]{10}$/.test(h.asin) && h.title);

async function fromAmazon(spec: ProductSpec): Promise<{ url: string | null; note?: string }> {
  const r = await fetch(`https://www.amazon.de/s?k=${encodeURIComponent(amazonQuery(spec))}`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'de-DE,de;q=0.9,en;q=0.5', Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Upgrade-Insecure-Requests': '1', 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Site': 'none' },
    signal: AbortSignal.timeout(15_000)
  });
  const html = await r.text();
  const hits = r.ok ? parseAmazonResults(html) : [];
  if (!hits.length) return { url: null, note: r.ok ? 'Amazon-Seite ohne Treffer (evtl. Bot-Schutz)' : `Amazon antwortet ${r.status}` };
  const pick = await chooseHit(hits, spec);
  return pick ? { url: `https://www.amazon.de/dp/${pick.asin}` } : { url: null, note: `Kein passender Amazon-Treffer unter ${hits.length}` };
}

// ---------- 3. Reserve: Gemini mit Google-Suche ----------
const asinOf = (u: string) => /(?:\/dp\/|\/gp\/product\/)([A-Z0-9]{10})(?![A-Z0-9])/i.exec(u)?.[1]?.toUpperCase() || null;

export async function resolveRedirect(url: string, hops = 4): Promise<string> {
  let cur = url;
  for (let i = 0; i < hops; i++) {
    let host = '';
    try {
      host = new URL(cur).hostname;
    } catch {
      return cur;
    }
    if (!/vertexaisearch\.cloud\.google\.com$|(^|\.)google\.com$/.test(host)) return cur;
    const r = await fetch(cur, { redirect: 'manual', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
    const loc = r.headers.get('location');
    if (!loc) return cur;
    cur = new URL(loc, cur).toString();
  }
  return cur;
}

/** Aus Such-Treffern: Amazon-Produktseite (gekürzt) oder Seite des eigenen Shops der Marke */
export function pickProductUrl(urls: string[], brand: string): string | null {
  const shop = shopFor(brand);
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
    const asin = asinOf(u.pathname);
    if (/(^|\.)amazon\.de$/i.test(u.hostname) && asin) amazon.push(`https://www.amazon.de/dp/${asin}`);
    else if (shop && shop.keep.test(`${u.origin}${u.pathname}`.replace(/\/+$/, '')) && !isSearchUrl(raw)) {
      u.hash = '';
      official.push(shop.rewrite ? shop.rewrite(`${u.origin}${u.pathname}`.replace(/\/+$/, '')) : u.toString());
    }
  }
  return (shop ? official[0] || amazon[0] : amazon[0]) || null;
}

async function fromGoogle(spec: ProductSpec): Promise<string | null> {
  const q = amazonQuery(spec);
  const r = await geminiSearch(`Finde die Produktseite dieses 3D-Druck-Filaments auf amazon.de: ${q}. Genau dieses Produkt in dieser Farbe, keine Suchseite. Nenne die Adresse.`);
  const real: string[] = [];
  for (const f of r.urls.slice(0, 8)) {
    try {
      real.push(await resolveRedirect(f));
    } catch {
      /* Treffer überspringen */
    }
  }
  return pickProductUrl(real, spec.brand);
}

// ---------- 0. Gelernt aus deinen Bestell-Mails (genaue ASIN) ----------
export interface CatalogEntry {
  brand: string;
  material: string;
  name: string;
  colorName: string;
  asin: string;
  at: number;
}
const catalogFile = () => path.join(dataDir, 'product-catalog.json');
export const readCatalog = (): CatalogEntry[] => loadJsonConfig<CatalogEntry[]>([catalogFile()], d => Array.isArray(d)) || [];

/** Produkte einer Bestellung merken (gleiche ASIN wird aktualisiert). Gibt die Zahl neuer Einträge zurück. */
export function learnCatalog(items: { brand: string; material: string; name: string; colorName: string; asin?: string }[]): number {
  const list = readCatalog();
  let added = 0;
  for (const it of items) {
    if (!it.asin || !/^[A-Z0-9]{10}$/.test(it.asin)) continue;
    const e: CatalogEntry = { brand: clean(it.brand, 40), material: clean(it.material, 30), name: clean(it.name), colorName: clean(it.colorName, 40), asin: it.asin, at: Date.now() };
    const i = list.findIndex(x => x.asin === it.asin);
    if (i >= 0) list[i] = e;
    else {
      list.push(e);
      added++;
    }
  }
  if (added || items.length) saveJsonConfig(catalogFile(), list.slice(-2000), 'product-catalog.json', { pretty: false, keepPrev: true });
  return added;
}

/** Passt ein gelerntes Produkt zur Spule? Marke muss stimmen, dazu Farbe oder genug vom Namen (rein, testbar). */
export function matchCatalog(entries: CatalogEntry[], spec: ProductSpec): CatalogEntry | null {
  const brand = words(spec.brand);
  if (!brand.length) return null;
  const sw = specWords(spec);
  const color = new Set(specWords({ brand: '', material: '', name: '', colorName: spec.colorName }).all);
  let best: { e: CatalogEntry; score: number } | null = null;
  for (const e of entries) {
    const eb = words(e.brand);
    if (!eb.length || !(brand.every(b => eb.includes(b)) || eb.every(b => brand.includes(b)))) continue;
    const ew = specWords({ brand: '', material: e.material, name: e.name, colorName: e.colorName });
    const em = words(e.material);
    if (!sw.mat.some(m => em.includes(m) || ew.all.has(m))) continue;
    const ec = specWords({ brand: '', material: '', name: '', colorName: e.colorName }).all;
    const colorHit = [...color].some(c => ec.has(c) || ew.all.has(c));
    let nameHit = 0;
    for (const w of sw.named) if (ew.all.has(w) && !GENERIC.has(w)) nameHit++;
    // Andere Farbe genannt? Dann ist es nicht dieselbe Spule
    if (color.size && ec.size && !colorHit) continue;
    const score = (colorHit ? 3 : 0) + nameHit;
    if (score >= 3 && (!best || score > best.score)) best = { e, score };
  }
  return best?.e || null;
}

// ---------- Zusammen, mit Merkzettel ----------
const cacheFile = () => path.join(dataDir, 'product-links.json');
type Cache = Record<string, { url: string; at: number; source?: string } | { fail: string; at: number }>;
const readCache = (): Cache => loadJsonConfig<Cache>([cacheFile()]) || {};
const writeCache = (key: string, v: Cache[string]) => {
  const c = readCache();
  c[key] = v;
  saveJsonConfig(cacheFile(), c, 'product-links.json', { pretty: false, keepPrev: true });
};
const FAIL_RETRY_MS = 3 * 86_400_000;

export async function findProductPage(spec: ProductSpec, opts: { force?: boolean; hits?: AmazonHit[] } = {}): Promise<FindResult> {
  if (!spec.brand && !spec.name) return { url: null, cached: false, error: 'Marke oder Name fehlt' };
  const key = specKey(spec);
  const learned = matchCatalog(readCatalog(), spec);
  if (learned) return { url: `https://www.amazon.de/dp/${learned.asin}`, cached: true, source: 'order' };
  const hit = readCache()[key];
  if (hit && 'url' in hit && hit.url) return { url: hit.url, cached: true, source: 'cache' };
  if (!opts.force && hit && 'fail' in hit && Date.now() - hit.at < FAIL_RETRY_MS) return { url: null, cached: true, error: hit.fail };
  const notes: string[] = [];
  const done = (url: string, source: FindResult['source']): FindResult => {
    writeCache(key, { url, at: Date.now(), source });
    console.log(`[Produktlink] ${spec.brand} ${spec.name} → ${url} (${source})`);
    return { url, cached: false, source };
  };
  try {
    const u = await fromShop(spec);
    if (u) return done(u, 'shop');
    if (shopFor(spec.brand)) notes.push('im Shop nichts Passendes');
  } catch (e) {
    notes.push(`Shop-Liste: ${(e as Error).message}`);
  }
  if (opts.hits?.length) {
    const p = await chooseHit(opts.hits, spec);
    if (p) return done(`https://www.amazon.de/dp/${p.asin}`, 'app');
    notes.push(`kein passender Treffer unter ${opts.hits.length} (App)`);
  }
  try {
    const a = await fromAmazon(spec);
    if (a.url) return done(a.url, 'amazon');
    if (a.note) notes.push(a.note);
  } catch (e) {
    notes.push(`Amazon: ${(e as Error).message}`);
  }
  if (geminiReady()) {
    try {
      const g = await fromGoogle(spec);
      if (g) return done(g, 'google');
      notes.push('Google-Suche ohne Produktseite');
    } catch (e) {
      notes.push((e as Error).message);
    }
  } else notes.push('kein Gemini-Schlüssel');
  const fail = notes.join(' · ').slice(0, 200) || 'nichts gefunden';
  writeCache(key, { fail, at: Date.now() });
  console.warn(`[Produktlink] ${spec.brand} ${spec.name}: ${fail}`);
  return { url: null, cached: false, error: fail };
}

// ---------- Gelernte Produkte direkt an passende Spulen schreiben ----------
/** Spulen ohne echte Produktseite bekommen den Link aus dem Katalog (rein, testbar). */
export function applyCatalogToSpools(spools: any[], entries: CatalogEntry[]): { spools: any[]; changed: number } {
  let changed = 0;
  const out = spools.map(sp => {
    if (!sp || hasRealLink(sp.productUrl)) return sp;
    const e = matchCatalog(entries, cleanSpec({ ...sp, refill: sp.onSpool === false }));
    if (!e) return sp;
    changed++;
    return { ...sp, productUrl: `https://www.amazon.de/dp/${e.asin}` };
  });
  return { spools: out, changed };
}

// ---------- Takt: Links aller Spulen nach und nach füllen ----------
export const hasRealLink = (u: unknown) => {
  const s = String(u || '');
  return /^https:\/\//i.test(s) && !isSearchUrl(s);
};
const fillState = { running: false, lastAt: 0, filled: 0, failed: 0, open: 0, text: 'Noch nicht gelaufen' };
export const productFillStatus = () => ({ ...fillState, learned: readCatalog().length });

/** Eine Spule pro Takt: sucht die Produktseite und schreibt sie ins Spulen-Dokument (nur wenn noch kein echter Link da ist). */
export async function productLinkTick(): Promise<void> {
  if (fillState.running || !hubEnabled() || !cloudReady(access())) return;
  fillState.running = true;
  fillState.lastAt = Date.now();
  try {
    const cat = readCatalog();
    if (cat.length) {
      const n = await withCloudLock(async () => {
        const fresh = await loadDoc(access());
        const r = applyCatalogToSpools(Array.isArray(fresh?.spools) ? fresh.spools : [], cat);
        if (r.changed) await saveDoc(access(), { ...fresh, spools: r.spools });
        return r.changed;
      });
      if (n) {
        fillState.filled += n;
        fillState.text = `${n} Spule(n) bekamen den Link aus deinen Bestellungen`;
      }
    }
    const doc = await loadDoc(access());
    const spools: any[] = Array.isArray(doc?.spools) ? doc.spools : [];
    const cache = readCache();
    const todo = spools.filter(s => !hasRealLink(s?.productUrl) && (s?.brand || s?.name)).filter(s => {
      const c = cache[specKey(cleanSpec({ ...s, refill: s?.onSpool === false }))];
      return !(c && 'fail' in c && Date.now() - c.at < FAIL_RETRY_MS);
    });
    fillState.open = todo.length;
    const sp = todo[0];
    if (!sp) {
      fillState.text = 'Alle Spulen haben einen Link oder wurden schon gesucht';
      return;
    }
    const r = await findProductPage(cleanSpec({ ...sp, refill: sp.onSpool === false }));
    if (!r.url) {
      fillState.failed++;
      fillState.text = `${sp.brand} ${sp.name}: ${r.error || 'nichts gefunden'}`;
      return;
    }
    await withCloudLock(async () => {
      const fresh = await loadDoc(access());
      const list: any[] = Array.isArray(fresh?.spools) ? fresh.spools : [];
      const i = list.findIndex(x => x?.id === sp.id);
      if (i < 0 || hasRealLink(list[i].productUrl)) return;
      list[i] = { ...list[i], productUrl: r.url };
      await saveDoc(access(), { ...fresh, spools: list });
    });
    fillState.filled++;
    fillState.open = Math.max(0, todo.length - 1);
    fillState.text = `${sp.brand} ${sp.name}: Link gespeichert`;
  } catch (e) {
    fillState.text = `Fehler: ${(e as Error).message}`.slice(0, 160);
  } finally {
    fillState.running = false;
  }
}

export function startProductLinks(): void {
  if (!hubEnabled()) return;
  setTimeout(() => void productLinkTick(), 90_000).unref();
  setInterval(() => void productLinkTick(), 3 * 60_000).unref();
}
