import React, { useEffect, useMemo, useState } from 'react';
import { ThumbsDown, ThumbsUp, Zap } from 'lucide-react';
import { fetchEnergyWeeks, hasServer, piRatings, type EnergyWeekInfo } from '../../utils/recorderServer';
import { byFilament, byModel, unrated, type PrintRating } from '../../utils/printRatings';
import { BarChart3, CalendarDays, Palette, Printer, Wallet } from 'lucide-react';
import { monthlyUse, successRate, weeklyPrints } from '../../utils/printStats';
import type { HistoryEntry, Spool } from '../../types/filament';
import { STORAGE_KEY_HISTORY } from '../../utils/storageKeys';
import { safeStorage } from '../../utils/safeStorage';
import { usePrintLog } from '../../utils/printLog';
import { Card } from './ui';

// Verbrauchs-Statistik: Gramm und Euro pro Woche/Monat, Verlauf der letzten Wochen, Lieblingsfarben und Materialien, Kosten je Druck.
// Grundlage: jeder Abzug im Verlauf (Spule, Gramm, Zeit) und der Druck-Verlauf.

const euro = (v: number) => v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const g = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString('de-DE', { maximumFractionDigits: 2 })} kg` : `${Math.round(v)} g`);

function readHistory(): HistoryEntry[] {
  try {
    const v = JSON.parse(safeStorage.getItem(STORAGE_KEY_HISTORY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function weekStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Montag
  return x;
}

const Tile: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <div className="rounded-xl border p-2.5" style={{ backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)' }}>
    <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--app-text-muted)' }}>
      {label}
    </div>
    <div className="text-base font-extrabold font-mono-num">{value}</div>
    {sub && (
      <div className="text-[11px] font-mono-num" style={{ color: 'var(--app-text-muted)' }}>
        {sub}
      </div>
    )}
  </div>
);

const Votes: React.FC<{ up: number; down: number }> = ({ up, down }) => (
  <span className="flex items-center gap-1 shrink-0 text-[11px] font-bold font-mono-num">
    {up > 0 && <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400">👍 {up}</span>}
    {down > 0 && <span className="px-1.5 py-0.5 rounded-md bg-rose-500/15 text-rose-400">👎 {down}</span>}
  </span>
);

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--app-text-muted)' }}>
    {children}
  </div>
);

const RatingsCard: React.FC = () => {
  const [list, setList] = useState<PrintRating[] | null>(null);
  useEffect(() => {
    if (hasServer()) void piRatings().then(setList);
  }, []);
  if (!list) return null;
  const models = byModel(list);
  const fils = byFilament(list);
  const open = unrated(list);
  if (!models.length && !open.length) return null;
  const rate = async (h: string, up: boolean) => setList((await piRatings({ h, up })) || list);
  const rated = list.filter(e => e.rating).length;
  return (
    <Card>
      <div className="flex items-center gap-2 text-xs font-extrabold">
        <ThumbsUp className="w-4 h-4 text-emerald-400" />
        <span className="flex-1">Was lief gut?</span>
        <span className="text-[10px] font-bold" style={{ color: 'var(--app-text-muted)' }}>
          {rated} bewertet
        </span>
      </div>

      {fils.length > 0 && (
        <div className="space-y-1.5">
          <Label>Filamente</Label>
          {fils.slice(0, 6).map(f => (
            <div key={f.fil} className="flex items-center gap-2 text-[11px]">
              <span className="w-28 sm:w-40 truncate font-bold">{f.fil}</span>
              <div className="flex-1 h-2 rounded-full overflow-hidden flex" style={{ backgroundColor: 'var(--app-border)' }}>
                <div className="h-full bg-emerald-500" style={{ width: `${(f.up / (f.up + f.down)) * 100}%` }} />
                <div className="h-full bg-rose-500" style={{ width: `${(f.down / (f.up + f.down)) * 100}%` }} />
              </div>
              <Votes up={f.up} down={f.down} />
            </div>
          ))}
        </div>
      )}

      {models.length > 0 && (
        <div className="space-y-1.5">
          <Label>Modelle</Label>
          {models.slice(0, 8).map(m => (
            <div key={m.model} className="rounded-xl border p-2 space-y-1" style={{ borderColor: 'var(--app-border)' }}>
              <div className="text-[11px] font-extrabold truncate">{m.name}</div>
              {m.combos.map(c => (
                <div key={c.fils} className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                  <span className="flex-1 truncate">{c.fils}</span>
                  <Votes up={c.up} down={c.down} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {open.length > 0 && (
        <div className="space-y-1.5">
          <Label>Noch nicht bewertet</Label>
          {open.map(e => (
            <div key={e.h} className="flex items-center gap-2 rounded-xl border p-2 text-[11px]" style={{ borderColor: 'var(--app-border)' }}>
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{e.name}</div>
                {e.fils.length > 0 && (
                  <div className="truncate" style={{ color: 'var(--app-text-muted)' }}>
                    {e.fils.join(' + ')}
                  </div>
                )}
              </div>
              <button aria-label="Lief gut" className="p-2 rounded-lg border cursor-pointer text-emerald-400 hover:bg-emerald-500/10" style={{ borderColor: 'var(--app-border)' }} onClick={() => void rate(e.h, true)}>
                <ThumbsUp className="w-4 h-4" />
              </button>
              <button aria-label="Lief schlecht" className="p-2 rounded-lg border cursor-pointer text-rose-400 hover:bg-rose-500/10" style={{ borderColor: 'var(--app-border)' }} onClick={() => void rate(e.h, false)}>
                <ThumbsDown className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export const StatsTab: React.FC<{ spools: Spool[] }> = ({ spools }) => {
  const prints = usePrintLog();
  const stats = useMemo(() => {
    const hist = readHistory().filter(h => h.grams > 0);
    const byId = new Map(spools.map(s => [s.id, s]));
    const avgPrice = spools.length ? spools.reduce((a, s) => a + (Number(s.pricePerKg) || 0), 0) / spools.length : 0;
    const priceOf = (id: string) => {
      const p = Number(byId.get(id)?.pricePerKg);
      return Number.isFinite(p) && p > 0 ? p : avgPrice;
    };
    const now = new Date();
    const wk = weekStart(now).getTime();
    const mo = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const sum = (from: number) => {
      let grams = 0;
      let cost = 0;
      hist.forEach(h => {
        const t = new Date(h.timestamp).getTime();
        if (t >= from) {
          grams += h.grams;
          cost += (h.grams / 1000) * priceOf(h.spoolId);
        }
      });
      return { grams, cost };
    };
    const week = sum(wk);
    const month = sum(mo);
    const total = sum(0);

    // letzte 8 Wochen
    const weeks: { label: string; grams: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const start = wk - i * 7 * 86400000;
      const end = start + 7 * 86400000;
      const grams = hist.reduce((a, h) => {
        const t = new Date(h.timestamp).getTime();
        return t >= start && t < end ? a + h.grams : a;
      }, 0);
      weeks.push({ label: new Date(start).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }), grams });
    }

    // Farben und Materialien (letzte 90 Tage)
    const since = Date.now() - 90 * 86400000;
    const colors = new Map<string, { name: string; hex: string; grams: number }>();
    const mats = new Map<string, number>();
    hist.forEach(h => {
      if (new Date(h.timestamp).getTime() < since) return;
      const s = byId.get(h.spoolId);
      const key = s ? `${s.colorName}|${s.colorHex}` : 'unbekannt';
      const c = colors.get(key) || { name: s?.colorName || h.spoolLabel || 'Unbekannt', hex: s?.colorHex || '#888888', grams: 0 };
      c.grams += h.grams;
      colors.set(key, c);
      const m = s?.material || 'Unbekannt';
      mats.set(m, (mats.get(m) || 0) + h.grams);
    });
    const topColors = [...colors.values()].sort((a, b) => b.grams - a.grams).slice(0, 5);
    const topMats = [...mats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Drucke
    const done = prints.filter(p => p.state === 'FINISH');
    const withUse = prints.filter(p => p.grams > 0);
    const avgGrams = withUse.length ? withUse.reduce((a, p) => a + p.grams, 0) / withUse.length : 0;
    const avgCost = withUse.length ? withUse.reduce((a, p) => a + p.cost, 0) / withUse.length : 0;
    const priciest = withUse.reduce<(typeof prints)[number] | null>((a, p) => (!a || p.cost > a.cost ? p : a), null);
    const hours = prints.reduce((a, p) => a + (p.durationMin || 0), 0) / 60;

    // 1.198: Drucke je Woche, Kosten je Monat, Erfolgsquote
    const printWeeks = weeklyPrints(prints, Date.now());
    const months = monthlyUse(hist, priceOf, Date.now());
    const rate = successRate(prints);

    return { week, month, total, weeks, topColors, topMats, prints: prints.length, done: done.length, avgGrams, avgCost, priciest, hours, hasData: hist.length > 0, printWeeks, months, rate };
  }, [spools, prints]);

  const maxWeek = Math.max(1, ...stats.weeks.map(w => w.grams));
  const maxColor = Math.max(1, ...stats.topColors.map(c => c.grams));
  const maxPrints = Math.max(1, ...stats.printWeeks.map(w => w.done + w.failed));
  // Strom je Woche (misst der Pi über die Steckdose)
  const [energy, setEnergy] = useState<EnergyWeekInfo[]>([]);
  useEffect(() => {
    void fetchEnergyWeeks().then(setEnergy);
  }, []);
  const maxEnergy = Math.max(1, ...energy.map(e => e.totalWh));
  const maxMonth = Math.max(0.01, ...stats.months.map(m => m.cost));

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center gap-2 text-xs font-extrabold">
          <Wallet className="w-4 h-4 text-emerald-400" />
          <span>Verbrauch und Kosten</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Tile label="Diese Woche" value={g(stats.week.grams)} sub={euro(stats.week.cost)} />
          <Tile label="Dieser Monat" value={g(stats.month.grams)} sub={euro(stats.month.cost)} />
          <Tile label="Gesamt" value={g(stats.total.grams)} sub={euro(stats.total.cost)} />
        </div>
        {!stats.hasData && (
          <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
            Noch keine Abzüge im Verlauf. Sobald nach Drucken abgezogen wird, füllt sich das hier.
          </p>
        )}
      </Card>

      <Card>
        <div className="flex items-center gap-2 text-xs font-extrabold">
          <BarChart3 className="w-4 h-4 text-sky-400" />
          <span>Letzte 8 Wochen</span>
        </div>
        <div className="flex items-end gap-1.5 h-28 pt-2">
          {stats.weeks.map(w => (
            <div key={w.label} className="flex-1 flex flex-col items-center gap-1 h-full justify-end" title={`${w.label}: ${g(w.grams)}`}>
              <span className="text-[10px] font-mono-num" style={{ color: 'var(--app-text-muted)' }}>
                {w.grams > 0 ? Math.round(w.grams) : ''}
              </span>
              <div className="w-full rounded-t-md" style={{ height: `${Math.max(2, (w.grams / maxWeek) * 100)}%`, backgroundColor: w.grams > 0 ? 'var(--app-accent)' : 'var(--app-border)' }} />
              <span className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                {w.label}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
          Gramm je Woche (ab Montag).
        </p>
      </Card>

      {energy.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 text-xs font-extrabold">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span>Strom je Woche (Steckdose)</span>
          </div>
          <div className="space-y-1.5">
            {energy.slice(-8).map(e => (
              <div key={e.week} className="flex items-center gap-2 text-[11px]">
                <span className="w-12 font-bold">{e.week.slice(8, 10)}.{e.week.slice(5, 7)}.</span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--app-border)' }}>
                  <div className="h-full rounded-full bg-yellow-400" style={{ width: `${(e.totalWh / maxEnergy) * 100}%` }} />
                </div>
                <span className="font-mono-num w-16 text-right">{(e.totalWh / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} kWh</span>
                <span className="font-mono-num w-14 text-right" style={{ color: 'var(--app-text-muted)' }}>
                  {euro(e.cost)}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
            Alles, was die Drucker-Steckdose zieht (Drucken, Trocknen, Standby). Woche ab Montag. Strompreis in Verbindungen → FilamentHub Server.
          </p>
        </Card>
      )}

      <RatingsCard />

      <Card>
        <div className="flex items-center gap-2 text-xs font-extrabold">
          <CalendarDays className="w-4 h-4 text-sky-400" />
          <span>Kosten je Monat</span>
        </div>
        <div className="space-y-1.5">
          {stats.months.map(m => (
            <div key={m.start} className="flex items-center gap-2 text-[11px]">
              <span className="w-14 font-bold">{new Date(m.start).toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })}</span>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--app-border)' }}>
                <div className="h-full rounded-full bg-sky-400" style={{ width: `${(m.cost / maxMonth) * 100}%` }} />
              </div>
              <span className="font-mono-num w-16 text-right">{euro(m.cost)}</span>
              <span className="font-mono-num w-14 text-right" style={{ color: 'var(--app-text-muted)' }}>
                {g(m.grams)}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-2 text-xs font-extrabold">
          <Palette className="w-4 h-4 text-pink-400" />
          <span>Meistgenutzt (90 Tage)</span>
        </div>
        {stats.topColors.length === 0 ? (
          <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
            Noch nichts.
          </p>
        ) : (
          <div className="space-y-1.5">
            {stats.topColors.map(c => (
              <div key={c.name + c.hex} className="flex items-center gap-2 text-[11px]">
                <span className="w-3.5 h-3.5 rounded-full border shrink-0" style={{ backgroundColor: c.hex, borderColor: 'var(--app-border)' }} />
                <span className="w-24 truncate font-bold">{c.name}</span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--app-border)' }}>
                  <div className="h-full rounded-full" style={{ width: `${(c.grams / maxColor) * 100}%`, backgroundColor: c.hex }} />
                </div>
                <span className="font-mono-num w-14 text-right">{g(c.grams)}</span>
              </div>
            ))}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {stats.topMats.map(([m, v]) => (
                <span key={m} className="px-2 py-0.5 rounded-md border text-[11px]" style={{ borderColor: 'var(--app-border)' }}>
                  <strong>{m}</strong> {g(v)}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center gap-2 text-xs font-extrabold">
          <Printer className="w-4 h-4 text-orange-400" />
          <span>Drucke</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Tile label="Drucke" value={String(stats.prints)} sub={stats.prints ? `${stats.done} fertig` : undefined} />
          <Tile label="Ø je Druck" value={stats.avgGrams ? g(stats.avgGrams) : '–'} sub={stats.avgCost ? euro(stats.avgCost) : undefined} />
          <Tile label="Druckzeit" value={`${stats.hours.toLocaleString('de-DE', { maximumFractionDigits: 1 })} h`} sub={stats.rate !== null ? `${stats.rate} % geschafft` : undefined} />
        </div>
        <div className="text-[11px] font-bold pt-1">Drucke je Woche</div>
        <div className="flex items-end gap-1.5 h-20">
          {stats.printWeeks.map(w => {
            const n = w.done + w.failed;
            const label = new Date(w.start).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
            return (
              <div key={w.start} className="flex-1 flex flex-col items-center gap-1 h-full justify-end" title={`${label}: ${w.done} fertig, ${w.failed} abgebrochen`}>
                <span className="text-[10px] font-mono-num" style={{ color: 'var(--app-text-muted)' }}>
                  {n || ''}
                </span>
                <div className="w-full rounded-t-md overflow-hidden flex flex-col justify-end" style={{ height: `${(n / maxPrints) * 100}%`, minHeight: n ? 4 : 2, backgroundColor: n ? 'transparent' : 'var(--app-border)' }}>
                  {w.failed > 0 && <div className="w-full bg-rose-400" style={{ height: `${(w.failed / Math.max(1, n)) * 100}%` }} />}
                  {w.done > 0 && <div className="w-full bg-orange-400" style={{ height: `${(w.done / Math.max(1, n)) * 100}%` }} />}
                </div>
                <span className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
          Orange = fertig, rot = abgebrochen.
        </p>
        {stats.priciest && (
          <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
            Teuerster Druck: <strong style={{ color: 'var(--app-text)' }}>{stats.priciest.name}</strong> ({g(stats.priciest.grams)}, {euro(stats.priciest.cost)})
          </p>
        )}
        <p className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
          Druck-Zahlen zählen ab Version 1.106 (Druck-Verlauf).
        </p>
      </Card>
    </div>
  );
};
