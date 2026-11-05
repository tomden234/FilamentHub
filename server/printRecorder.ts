// Druck-Rekorder auf dem Server (läuft im Home-Assistant-Add-on rund um die Uhr):
// verfolgt den Druckstatus des Druckers und speichert jeden fertigen oder abgebrochenen Druck in eine Datei.
// Die Apps holen die Liste über /api/recorder/prints und tragen fehlende Drucke nach (Druckliste + Abzug).
import fs from 'fs';
import path from 'path';
import { dataDir } from './paths.js';

export const ACTIVE = new Set(['RUNNING', 'PREPARE', 'PAUSE']);
export const ENDED = new Set(['FINISH', 'FAILED']);

export interface RecordedPrint {
  id: string;
  name: string;
  startMs: number;
  endMs: number;
  state: 'FINISH' | 'FAILED';
  percent: number;
  /** Sekunden je Slot (1-4 = AMS, 5 = extern) */
  slots: Record<string, number>;
}

interface OpenPrint {
  id: string;
  name: string;
  startMs: number;
  seenAt: number;
  lastPercent: number;
  slots: Record<string, number>;
  lastFeed: number;
}

export interface Snapshot {
  /** Verbunden und der Drucker schickt Daten */
  connected: boolean;
  state?: string;
  name?: string;
  /** Startzeit laut Drucker (ms), 0 = unbekannt */
  startMs?: number;
  percent?: number;
  /** Aktiver Slot: 1-4 AMS, 5 extern, null = unbekannt */
  slot?: number | null;
}

interface FileShape {
  open: OpenPrint | null;
  prints: RecordedPrint[];
}

const IDLE_CONFIRM_MS = 60_000;
const MAX_KEEP = 200;

/** „Case.gcode.3mf“ = „case“ (gleiche Regel wie in der App) */
export const nameKey = (n: string) =>
  String(n || '')
    .toLowerCase()
    .replace(/\.(gcode\.3mf|3mf|gcode)$/g, '')
    .trim();

/** Gleiche Kennung wie makePrintId in der App, damit sich Einträge nicht doppeln */
export function makeId(name: string, startMs: number, seenAt: number): string {
  return `${nameKey(name) || 'druck'}|${startMs ? `s${Math.round(startMs / 1000)}` : `a${seenAt}`}`;
}

function matches(o: OpenPrint, name: string, startMs: number): boolean {
  if (startMs && o.startMs) return Math.abs(o.startMs - startMs) < 5000;
  if (!o.name || !name) return true;
  return nameKey(o.name) === nameKey(name);
}

export class PrintRecorder {
  private data: FileShape = { open: null, prints: [] };
  private lastWrite = 0;
  private idleSince = 0;

  constructor(private readonly file: string = path.join(dataDir, 'recorded-prints.json')) {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
      if (raw && Array.isArray(raw.prints)) this.data = { open: raw.open && typeof raw.open.id === 'string' ? raw.open : null, prints: raw.prints };
    } catch {
      /* noch keine Datei */
    }
  }

  private save(force: boolean, now: number): void {
    if (!force && now - this.lastWrite < 5000) return;
    this.lastWrite = now;
    try {
      fs.writeFileSync(this.file, JSON.stringify(this.data), 'utf-8');
    } catch (e) {
      console.warn('[Rekorder] Konnte nicht speichern:', (e as Error)?.message || e);
    }
  }

  private finish(o: OpenPrint, state: 'FINISH' | 'FAILED', now: number): RecordedPrint | null {
    this.data.open = null;
    this.idleSince = 0;
    if (now - (o.startMs || o.seenAt) < 60_000) {
      this.save(true, now);
      return null; // Zucken, kein Druck
    }
    const rec: RecordedPrint = {
      id: o.id,
      name: o.name || 'Druckauftrag',
      startMs: o.startMs || o.seenAt,
      endMs: now,
      state,
      percent: state === 'FINISH' ? 100 : Math.max(0, Math.min(99, Math.round(o.lastPercent || 0))),
      slots: o.slots
    };
    this.data.prints = [rec, ...this.data.prints.filter(p => p.id !== rec.id)].slice(0, MAX_KEEP);
    this.save(true, now);
    console.log(`[Rekorder] Druck gespeichert: ${rec.name} (${rec.state}, ${rec.percent} %)`);
    return rec;
  }

  /** Neuen Zustand des Druckers melden. Gibt den Druck zurück, wenn er gerade beendet wurde. */
  public feed(s: Snapshot, now: number = Date.now()): RecordedPrint | null {
    if (!s.connected || !s.state) return null; // Drucker aus oder keine Daten: offenen Druck behalten
    const name = s.name || '';
    const startMs = s.startMs || 0;
    const percent = Number(s.percent) || 0;
    if (s.state !== 'IDLE') this.idleSince = 0;

    if (ACTIVE.has(s.state)) {
      let o = this.data.open;
      if (o && !matches(o, name, startMs)) {
        // Anderer Auftrag läuft: den alten abschließen (war er fast fertig, gilt er als fertig)
        if (o.lastPercent >= 95) this.finish(o, 'FINISH', now);
        else this.data.open = null;
        o = null;
      }
      let changed = false;
      if (!o) {
        o = { id: makeId(name, startMs, now), name, startMs, seenAt: now, lastPercent: percent, slots: {}, lastFeed: now };
        this.data.open = o;
        changed = true;
      } else {
        if (name && !o.name) {
          o.name = name;
          changed = true;
        }
        if (startMs && !o.startMs) {
          o.startMs = startMs;
          changed = true;
        }
      }
      if (s.state === 'RUNNING' && s.slot) {
        const dt = Math.min(30, Math.max(0, (now - o.lastFeed) / 1000));
        const k = String(s.slot);
        if (!o.slots[k]) changed = true;
        o.slots[k] = Math.round(((o.slots[k] || 0) + dt) * 10) / 10;
      }
      o.lastFeed = now;
      o.lastPercent = percent || o.lastPercent;
      this.save(changed, now);
      return null;
    }

    if (ENDED.has(s.state)) {
      const o = this.data.open;
      if (o && matches(o, name, startMs)) return this.finish({ ...o, lastPercent: s.state === 'FINISH' ? 100 : o.lastPercent }, s.state as 'FINISH' | 'FAILED', now);
      return null; // Ende eines Drucks, den wir nicht gesehen haben (Server war aus): ignorieren
    }

    if (s.state === 'IDLE' && this.data.open) {
      // Leerlauf, obwohl noch ein Druck offen ist (z. B. Drucker war aus): nach 1 Minute Ruhe abschließen
      if (!this.idleSince) this.idleSince = now;
      else if (now - this.idleSince >= IDLE_CONFIRM_MS) {
        const o = this.data.open;
        if (o.lastPercent >= 95) return this.finish(o, 'FINISH', now);
        if (o.lastPercent >= 5) return this.finish(o, 'FAILED', now);
        this.data.open = null;
        this.idleSince = 0;
        this.save(true, now);
      }
    }
    return null;
  }

  public list(since = 0): RecordedPrint[] {
    return this.data.prints.filter(p => p.endMs > since).sort((a, b) => a.endMs - b.endMs);
  }

  public status() {
    const o = this.data.open;
    return { count: this.data.prints.length, open: o ? { name: o.name, percent: Math.round(o.lastPercent || 0), startMs: o.startMs || o.seenAt } : null };
  }
}

export const printRecorder = new PrintRecorder();
