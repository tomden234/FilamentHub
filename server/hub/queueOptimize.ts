// 1.273: Warteschlange smart sortieren – reine Logik (ohne Netz, darum testbar).
// Ziel: wenige Plattenwechsel, wenige Düsenwechsel, wenige Spulenwechsel, lange Drucke in der Nacht.
// Platten desselben Projekts bleiben zusammen und in Reihenfolge.
import { baseMaterial } from '../../src/utils/amsMatch.js';

export interface OptItem {
  id: string;
  /** Druckplatte der Datei (leer = unbekannt) */
  bed: string;
  /** Düsen-Text, z. B. „0,4“ (leer = unbekannt) */
  nozzle: string;
  /** Filamente der Datei als „MATERIAL|#FARBE“ */
  keys: string[];
  /** Druckdauer in Sekunden (0 = unbekannt) */
  sec: number;
  project?: string;
  part?: number;
}

export interface OptStats {
  bedChanges: number;
  nozzleChanges: number;
  spoolSwaps: number;
  /** Stunden, die lange Drucke (ab 3 h) in der Wachzeit laufen */
  dayHours: number;
}

export interface OptPlan {
  /** Neue Reihenfolge (IDs) */
  order: string[];
  changed: boolean;
  before: OptStats;
  after: OptStats;
  /** Kurze Begründung, z. B. „Plattenwechsel 3 → 1“ */
  reasons: string[];
}

export const filamentKey = (type: string, colorHex: string) => `${baseMaterial(type)}|${String(colorHex || '').toUpperCase()}`;

const LONG_SEC = 3 * 3600;
const W_BED = 10;
const W_NOZZLE = 10;
const W_SWAP = 3;
const W_DAY = 1;
/** Wachzeit (Stunden) in der lange Drucke „stören“: du bist da und könntest wechseln */
const AWAKE_FROM = 7;
const AWAKE_TO = 22;

const hourIn = (ms: number, tz: string): number => Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(new Date(ms))) % 24;

function dayHoursOf(startMs: number, sec: number, tz: string): number {
  let steps = 0;
  for (let t = startMs; t < startMs + sec * 1000; t += 15 * 60_000) {
    const h = hourIn(t, tz);
    if (h >= AWAKE_FROM && h < AWAKE_TO) steps++;
  }
  return steps * 0.25;
}

export function statsOf(seq: OptItem[], startMs: number, tz = 'Europe/Berlin'): OptStats {
  const st: OptStats = { bedChanges: 0, nozzleChanges: 0, spoolSwaps: 0, dayHours: 0 };
  let clock = startMs;
  seq.forEach((it, i) => {
    const prev = seq[i - 1];
    if (prev) {
      if (it.bed && prev.bed && it.bed !== prev.bed) st.bedChanges++;
      if (it.nozzle && prev.nozzle && it.nozzle !== prev.nozzle) st.nozzleChanges++;
      const have = new Set(prev.keys);
      st.spoolSwaps += it.keys.filter(k => !have.has(k)).length;
    }
    if (it.sec >= LONG_SEC) st.dayHours += dayHoursOf(clock, it.sec, tz);
    clock += (it.sec || 0) * 1000;
  });
  st.dayHours = Math.round(st.dayHours * 10) / 10;
  return st;
}

const cost = (s: OptStats) => s.bedChanges * W_BED + s.nozzleChanges * W_NOZZLE + s.spoolSwaps * W_SWAP + s.dayHours * W_DAY;

/** Einheiten: Platten eines Projekts bleiben als ein Block (nach Plattennummer), alles andere ist einzeln */
function toUnits(items: OptItem[]): OptItem[][] {
  const units: OptItem[][] = [];
  const byProject = new Map<string, OptItem[]>();
  for (const it of items) {
    if (it.project) {
      let u = byProject.get(it.project);
      if (!u) {
        u = [];
        byProject.set(it.project, u);
        units.push(u);
      }
      u.push(it);
    } else units.push([it]);
  }
  for (const u of byProject.values()) u.sort((a, b) => (a.part || 0) - (b.part || 0));
  return units;
}

const flat = (units: OptItem[][]) => units.flat();

function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr.slice()];
  const out: T[][] = [];
  arr.forEach((x, i) => {
    for (const rest of permutations([...arr.slice(0, i), ...arr.slice(i + 1)])) out.push([x, ...rest]);
  });
  return out;
}

export function optimize(items: OptItem[], startMs: number, tz = 'Europe/Berlin'): OptPlan {
  const before = statsOf(items, startMs, tz);
  const units = toUnits(items);
  const origIndex = new Map(items.map((x, i) => [x.id, i]));
  // Kleine Abweichung von der alten Reihenfolge kostet minimal: bei Gleichstand bleibt alles, wie es war
  const score = (us: OptItem[][]) => {
    const seq = flat(us);
    return cost(statsOf(seq, startMs, tz)) + seq.reduce((a, x, i) => a + Math.abs(i - (origIndex.get(x.id) || 0)) * 0.001, 0);
  };
  let best = units;
  if (units.length <= 8) {
    let bs = Infinity;
    for (const p of permutations(units)) {
      const sc = score(p);
      if (sc < bs - 1e-9) {
        bs = sc;
        best = p;
      }
    }
  } else {
    // Viele Einträge: Block jeweils an die beste Stelle schieben, bis nichts mehr besser wird
    let cur = units;
    let cs = score(cur);
    for (let round = 0; round < 6; round++) {
      let improved = false;
      for (let i = 0; i < cur.length; i++) {
        for (let j = 0; j < cur.length; j++) {
          if (i === j) continue;
          const next = cur.slice();
          next.splice(j, 0, next.splice(i, 1)[0]);
          const ns = score(next);
          if (ns < cs - 1e-9) {
            cur = next;
            cs = ns;
            improved = true;
          }
        }
      }
      if (!improved) break;
    }
    best = cur;
  }
  const seq = flat(best);
  const after = statsOf(seq, startMs, tz);
  // Nur umsortieren, wenn es wirklich etwas bringt (mehr als 0,5 Punkte)
  const better = cost(after) < cost(before) - 0.5;
  const order = (better ? seq : items).map(x => x.id);
  const used = better ? after : before;
  const reasons: string[] = [];
  if (better) {
    if (after.bedChanges < before.bedChanges) reasons.push(`Plattenwechsel ${before.bedChanges} → ${after.bedChanges}`);
    if (after.nozzleChanges < before.nozzleChanges) reasons.push(`Düsenwechsel ${before.nozzleChanges} → ${after.nozzleChanges}`);
    if (after.spoolSwaps < before.spoolSwaps) reasons.push(`Spulenwechsel ${before.spoolSwaps} → ${after.spoolSwaps}`);
    if (after.dayHours < before.dayHours) reasons.push(`Lange Drucke am Tag ${before.dayHours} h → ${after.dayHours} h`);
  }
  return { order, changed: better && order.some((id, i) => id !== items[i]?.id), before, after: used, reasons };
}
