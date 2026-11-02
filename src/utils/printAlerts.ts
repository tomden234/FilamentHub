// Mitteilungen rund um einen Druck: gestartet, fertig, fehlgeschlagen. Kommen von usePrintWatch (einmal je Druck).
import type { Spool } from '../types/filament';
import { raiseAlert } from './alerts';
import { mainSlot, type PrintSession } from './printSession';
import { safeStorage } from './safeStorage';
import { EXTERNAL_SLOT } from './amsMatch';
import { loadedSpools, onQueuePrintFinished } from './printQueue';

const AMS_SLOTS_KEY = 'filamenthub_ams_slots_x2d';

const clock = (ms: number) => new Date(ms).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' Uhr';

export function fmtMinutes(m: number): string {
  const v = Math.max(0, Math.round(m));
  return v >= 60 ? `${Math.floor(v / 60)} h ${v % 60} min` : `${v} min`;
}

/** Spule im Slot laut AMS-Zuordnung der App */
export function spoolInSlot(slot: number | null, spools: Spool[]): Spool | null {
  if (!slot) return null;
  try {
    const map: Record<string, string> = JSON.parse(safeStorage.getItem(AMS_SLOTS_KEY) || '{}');
    const id = map[String(slot)];
    return spools.find(s => s.id === id) || null;
  } catch {
    return null;
  }
}

const slotName = (slot: number) => (slot === EXTERNAL_SLOT ? 'Extern' : `Slot ${slot}`);

interface StartExtra {
  spools: Spool[];
  activeSlot: number | null;
  percent: number;
  remainingMin: number;
  etaText: string;
  showToast?: (t: string) => void;
  /** App wurde während des Drucks geöffnet: neue Meldung, auch wenn der Start schon gemeldet war */
  resume?: boolean;
}

export function alertPrintStart(s: PrintSession, x: StartExtra): void {
  const name = s.name || 'Druckauftrag';
  const sp = spoolInSlot(x.activeSlot, x.spools);
  const eta = x.remainingMin > 0 && x.etaText && !x.etaText.includes('--') ? x.etaText : '';
  const live = s.midway || x.resume;
  const title = live ? 'Druck läuft' : 'Druck gestartet';
  const text = live
    ? `${name} läuft (${Math.round(x.percent)} %).${eta ? ` Fertig ca. ${eta}.` : ''}`
    : `${name} wurde gestartet.${eta ? ` Fertig ca. ${eta}.` : ''}`;
  void raiseAlert(
    {
      kind: 'print-start',
      key: x.resume ? `print-open-${s.id}-${Date.now()}` : `print-start-${s.id}`,
      title,
      text,
      toast: `▶️ ${text}`,
      facts: [
        { label: 'Auftrag', value: name },
        { label: live ? 'Gesehen' : 'Gestartet', value: clock(s.startMs || s.seenAt) },
        ...(x.remainingMin > 0 ? [{ label: 'Restzeit', value: fmtMinutes(x.remainingMin) }] : []),
        ...(eta ? [{ label: 'Fertig ca.', value: eta }] : [])
      ],
      items: sp && x.activeSlot ? [{ title: `${sp.brand} ${sp.name}`, sub: `${slotName(x.activeSlot)} · ${sp.material} · ${Math.round(sp.remainingWeight)} g`, color: sp.colorHex }] : undefined
    },
    x.showToast
  );
}

export function alertPrintEnd(s: PrintSession, info: { state: 'FINISH' | 'FAILED'; missed: boolean }, x: { spools: Spool[]; showToast?: (t: string) => void }): void {
  const name = s.name || 'Druckauftrag';
  const begin = s.startMs || (s.midway ? 0 : s.seenAt);
  const mins = begin && !info.missed ? (Date.now() - begin) / 60000 : 0;
  const slot = mainSlot(s);
  const sp = spoolInSlot(slot, x.spools);
  const facts = [
    { label: 'Auftrag', value: name },
    { label: info.missed ? 'Gesehen' : 'Beendet', value: clock(Date.now()) },
    ...(mins >= 1 ? [{ label: 'Dauer', value: fmtMinutes(mins) }] : []),
    ...(info.state === 'FAILED' && s.lastPercent > 0 ? [{ label: 'Abgebrochen bei', value: `${Math.round(s.lastPercent)} %` }] : []),
    ...(info.missed ? [{ label: 'Hinweis', value: 'Ende passierte, während die App zu war' }] : [])
  ];
  const items = sp && slot ? [{ title: `${sp.brand} ${sp.name}`, sub: `${slotName(slot)} · ${sp.material}`, color: sp.colorHex }] : undefined;
  if (info.state === 'FINISH') {
    const text = `${name} ist fertig.`;
    void raiseAlert({ kind: 'print-done', key: `print-end-${s.id}`, title: 'Druck fertig', text, toast: `✅ ${text}`, facts, items }, x.showToast);
    onQueuePrintFinished(name, loadedSpools(x.spools), x.showToast);
  } else {
    const text = `${name} ist fehlgeschlagen oder wurde abgebrochen.`;
    void raiseAlert({ kind: 'print-fail', key: `print-end-${s.id}`, title: 'Druck fehlgeschlagen', text, toast: `⚠️ ${text}`, facts, items }, x.showToast);
  }
}
