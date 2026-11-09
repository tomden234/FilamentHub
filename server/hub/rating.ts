// 1.280: 👍/👎 nach dem Druck. Knöpfe in der „Druck fertig“-Meldung, der Pi merkt sich Modell + Filament + Urteil
// und sagt beim nächsten Druck desselben Modells, womit es gut oder schlecht lief.
import crypto from 'crypto';
import path from 'path';
import { dataDir } from '../paths.js';
import { loadJsonConfig, saveJsonConfig } from '../jsonConfig.js';
import { nameKey } from '../printRecorder.js';
import { hubEnabled, push } from './core.js';

export interface RatingEntry {
  h: string;
  id: string;
  model: string;
  name: string;
  fils: string[];
  rating: 0 | 1 | -1;
  at: number;
}

const file = () => path.join(dataDir, 'print-ratings.json');
const MAX = 500;
const ACTION_RE = /^FH_R_(UP|DOWN)_([0-9a-f]{12})$/;

export const ratingHash = (recId: string) => crypto.createHash('sha1').update(recId).digest('hex').slice(0, 12);
export const ratingActions = (h: string) => [
  { action: `FH_R_UP_${h}`, title: '👍 Lief gut' },
  { action: `FH_R_DOWN_${h}`, title: '👎 Lief schlecht' }
];

export const readRatings = (): RatingEntry[] => loadJsonConfig<RatingEntry[]>([file()], d => Array.isArray(d)) || [];
const save = (l: RatingEntry[]) => saveJsonConfig(file(), l.slice(-MAX), 'print-ratings.json', { pretty: false, keepPrev: true });

/** Druck für eine spätere Bewertung merken (rein, testbar) */
export function withPrint(list: RatingEntry[], p: { id: string; name: string; fils: string[] }, now = Date.now()): { list: RatingEntry[]; h: string } {
  const h = ratingHash(p.id);
  if (list.some(e => e.h === h)) return { list, h };
  return { list: [...list, { h, id: p.id, model: nameKey(p.name), name: p.name, fils: p.fils, rating: 0, at: now }], h };
}

/** Urteil eintragen (rein, testbar) */
export function withRating(list: RatingEntry[], h: string, up: boolean): { list: RatingEntry[]; entry: RatingEntry | null } {
  const i = list.findIndex(e => e.h === h);
  if (i < 0) return { list, entry: null };
  const entry = { ...list[i], rating: (up ? 1 : -1) as 1 | -1 };
  const out = [...list];
  out[i] = entry;
  return { list: out, entry };
}

/** „Gut: A · Schlecht: B“ aus früheren Drucken desselben Modells (rein, testbar). Leer, wenn nichts bekannt. */
export function summarize(list: RatingEntry[], name: string, excludeH = ''): string {
  const model = nameKey(name);
  if (!model) return '';
  const tally = new Map<string, { up: number; down: number }>();
  for (const e of list) {
    if (e.model !== model || e.h === excludeH || !e.rating || !e.fils.length) continue;
    const k = e.fils.join(' + ');
    const t = tally.get(k) || { up: 0, down: 0 };
    if (e.rating > 0) t.up++;
    else t.down++;
    tally.set(k, t);
  }
  const good: string[] = [];
  const bad: string[] = [];
  for (const [k, t] of tally) {
    if (t.up >= t.down) good.push(t.up > 1 ? `${k} (${t.up}×)` : k);
    else bad.push(t.down > 1 ? `${k} (${t.down}×)` : k);
  }
  return [good.length ? `👍 Gut mit: ${good.join(', ')}` : '', bad.length ? `👎 Schlecht mit: ${bad.join(', ')}` : ''].filter(Boolean).join('\n');
}

/** Beim Druckende: Druck merken. Gibt Knöpfe und den Hinweis aus früheren Drucken zurück. */
export function ratingForEnd(p: { id: string; name: string; fils: string[] }): { actions: { action: string; title: string }[]; hint: string } {
  const r = withPrint(readRatings(), p);
  if (r.list.length !== readRatings().length) save(r.list);
  return { actions: ratingActions(r.h), hint: summarize(r.list, p.name, r.h) };
}

/** Knopf 👍/👎 gedrückt */
export function onRatingAction(ev: { event_type: string; data: any }): void {
  if (!hubEnabled() || ev.event_type !== 'mobile_app_notification_action') return;
  const m = String(ev.data?.action || '').match(ACTION_RE);
  if (!m) return;
  const r = withRating(readRatings(), m[2], m[1] === 'UP');
  if (!r.entry) return void push('done', 'ℹ️ Nicht mehr da', 'Dieser Druck ist nicht mehr gemerkt.', { tag: 'rating' });
  save(r.list);
  const what = r.entry.fils.join(' + ') || 'Filament unbekannt';
  void push('done', m[1] === 'UP' ? '👍 Gemerkt: lief gut' : '👎 Gemerkt: lief schlecht', `${r.entry.name} mit ${what}`, { tag: `print-${r.entry.id}` });
}
