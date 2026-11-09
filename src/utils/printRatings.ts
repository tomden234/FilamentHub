// 1.282: Bewertungen (👍/👎 nach dem Druck) für die Statistik-Ansicht aufbereiten.
export interface PrintRating {
  h: string;
  id: string;
  model: string;
  name: string;
  fils: string[];
  rating: 0 | 1 | -1;
  at: number;
}
export interface ModelRow {
  model: string;
  name: string;
  combos: { fils: string; up: number; down: number }[];
}
export interface FilRow {
  fil: string;
  up: number;
  down: number;
}

/** Je Modell: welches Filament wie oft gut/schlecht lief. Neueste Modelle zuerst. */
export function byModel(list: PrintRating[]): ModelRow[] {
  const rows = new Map<string, ModelRow & { at: number }>();
  for (const e of list) {
    if (!e.rating || !e.fils.length) continue;
    const r = rows.get(e.model) || { model: e.model, name: e.name, combos: [], at: 0 };
    const k = e.fils.join(' + ');
    let c = r.combos.find(x => x.fils === k);
    if (!c) r.combos.push((c = { fils: k, up: 0, down: 0 }));
    if (e.rating > 0) c.up++;
    else c.down++;
    if (e.at >= r.at) {
      r.at = e.at;
      r.name = e.name;
    }
    rows.set(e.model, r);
  }
  return [...rows.values()].sort((a, b) => b.at - a.at).map(({ at: _at, ...r }) => r);
}

/** Je Filament über alle Modelle: bestes zuerst (Anteil 👍, dann Anzahl). */
export function byFilament(list: PrintRating[]): FilRow[] {
  const m = new Map<string, FilRow>();
  for (const e of list) {
    if (!e.rating) continue;
    for (const f of e.fils) {
      const r = m.get(f) || { fil: f, up: 0, down: 0 };
      if (e.rating > 0) r.up++;
      else r.down++;
      m.set(f, r);
    }
  }
  return [...m.values()].sort((a, b) => b.up / (b.up + b.down) - a.up / (a.up + a.down) || b.up + b.down - (a.up + a.down));
}

/** Noch nicht bewertete Drucke (neueste zuerst, höchstens n) */
export const unrated = (list: PrintRating[], n = 5): PrintRating[] =>
  list
    .filter(e => !e.rating)
    .sort((a, b) => b.at - a.at)
    .slice(0, n);
