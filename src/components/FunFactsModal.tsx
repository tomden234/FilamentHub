import React, { useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  X,
  Code2,
  MessageSquare,
  MessagesSquare,
  Layers,
  GitCommit,
  Printer,
  Flame,
  Package,
  Ruler,
  Palette,
  Nfc,
  Scale,
  CalendarDays,
  Euro
} from 'lucide-react';
import { useEscapeClose } from '../hooks/useEscapeClose';
import type { HistoryEntry, Spool } from '../types/filament';
import { INITIAL_VERSION_PROFILES } from '../data/defaultSpools';
import { STORAGE_KEY_HISTORY } from '../utils/storageKeys';
import { printerApi, type PrintTask } from '../api/printerApi';
import { APP_REVISION } from '../utils/env';

interface FunFactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  spools?: Spool[];
}

// Woher die Zahlen kommen:
//  LIVE      = jedes Mal neu aus deinen Daten oder der Bambu Cloud berechnet
//  BAUEN     = beim Bauen der App gezählt (Codezeilen)
//  GEZÄHLT   = von Claude beim letzten Update gezählt (Chats, Commits)
//  SCHÄTZUNG = ungefähr, genauer geht es nicht
type Source = 'LIVE' | 'BAUEN' | 'GEZÄHLT' | 'SCHÄTZUNG';

// Von Claude beim Update auf v1.203 gezählt
const CHATS = 11; // Chats im Projekt „filament webseite“
const MESSAGES = 408; // deine Nachrichten in diesen Chats (ca.)
const WORDS = 35960; // deine Wörter (ca., lange Sprachnachrichten zählen voll)
const COMMITS = 201; // Commits auf GitHub (main)
const PROJECT_START = new Date('2026-10-19T00:00:00');

const fmt = (n: number, digits = 0) => n.toLocaleString('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: digits });

/** Meter Filament aus Gramm (1,75 mm, Dichte je Material) */
function metersOf(s: Spool): number {
  const m = String(s.material || '').toUpperCase();
  const density = m.startsWith('PETG') ? 1.27 : m.startsWith('TPU') ? 1.21 : m.startsWith('ABS') ? 1.04 : m.startsWith('ASA') ? 1.07 : m.startsWith('PA') ? 1.14 : m.startsWith('PC') ? 1.2 : 1.24;
  const areaCm2 = Math.PI * 0.0875 * 0.0875;
  return (Math.max(0, s.remainingWeight || 0) / (density * areaCm2)) / 100;
}

function readHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const FunFactsModal: React.FC<FunFactsModalProps> = ({ isOpen, onClose, spools = [] }) => {
  useEscapeClose(onClose, isOpen);
  const [tasks, setTasks] = useState<PrintTask[] | null>(null);
  const [tasksError, setTasksError] = useState<string | null>(null);

  // Echte Druckzeit und echter Verbrauch aus der Bambu Cloud
  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    setTasksError(null);
    printerApi
      .tasks(200)
      .then(res => {
        if (!alive) return;
        if (res.ok && res.data?.tasks) setTasks(res.data.tasks);
        else setTasksError(res.data?.error || 'Keine Verbindung zur Bambu Cloud.');
      })
      .catch(() => alive && setTasksError('Keine Verbindung zur Bambu Cloud.'));
    return () => {
      alive = false;
    };
  }, [isOpen]);

  const stats = useMemo(() => {
    const grams = spools.reduce((a, s) => a + Math.max(0, s.remainingWeight || 0), 0);
    const value = spools.reduce((a, s) => a + (Math.max(0, s.remainingWeight || 0) / 1000) * (s.pricePerKg || 0), 0);
    const meters = spools.reduce((a, s) => a + metersOf(s), 0);
    const count = (key: (s: Spool) => string) => {
      const m = new Map<string, number>();
      spools.forEach(s => {
        const k = key(s);
        if (k) m.set(k, (m.get(k) || 0) + 1);
      });
      return Array.from(m.entries()).sort((a, b) => b[1] - a[1])[0];
    };
    const topMaterial = count(s => s.material);
    const topColor = count(s => (s.colorName || '').trim());
    const nfc = spools.filter(s => s.nfcWritten).length;
    const deducted = readHistory().reduce((a, h) => a + (h.grams > 0 ? h.grams : 0), 0);
    const days = Math.max(1, Math.floor((Date.now() - PROJECT_START.getTime()) / 86400000) + 1);
    return { grams, value, meters, topMaterial, topColor, nfc, deducted, days };
  }, [spools, isOpen]);

  if (!isOpen) return null;

  const done = (tasks || []).filter(t => t.status === 2);
  const printSeconds = done.reduce((a, t) => a + (t.costTime || 0), 0);
  const printGrams = done.reduce((a, t) => a + (t.totalGrams || 0), 0);
  const laps = Math.round(stats.meters / 346); // Umfang Fußballfeld ≈ 346 m

  const facts: { icon: any; title: string; value: string; desc: string; source: Source; big?: boolean }[] = [
    {
      icon: Code2,
      title: 'Codezeilen',
      value: `${fmt(typeof __CODE_LINES__ === 'number' && __CODE_LINES__ > 0 ? __CODE_LINES__ : 0)} Zeilen`,
      desc: 'Beim Bauen dieser Version gezählt: TypeScript, React, Server und die Android-Plugins in Java.',
      source: 'BAUEN',
      big: true
    },
    {
      icon: Printer,
      title: 'Druckzeit laut Bambu Cloud',
      value: tasks ? `${fmt(printSeconds / 3600, 1)} Std.` : tasksError ? '–' : 'lädt …',
      desc: tasks
        ? `Summe aus ${done.length} fertigen Cloud-Druckaufträgen. Drucke von SD-Karte oder im LAN-Modus zählt Bambu hier nicht mit.`
        : tasksError || 'Wird aus deinen letzten Druckaufträgen geholt.',
      source: 'LIVE',
      big: true
    },
    {
      icon: Flame,
      title: 'Verdruckt laut Bambu Cloud',
      value: tasks ? `${fmt(printGrams / 1000, 2)} kg` : tasksError ? '–' : 'lädt …',
      desc: 'Slicer-Gewicht aller fertigen Cloud-Drucke zusammen.',
      source: 'LIVE'
    },
    {
      icon: Package,
      title: 'Spulen im Lager',
      value: `${spools.length} Spulen · ${fmt(stats.grams / 1000, 1)} kg`,
      desc: 'Restgewicht aller Spulen, ohne Leerspule.',
      source: 'LIVE'
    },
    {
      icon: Ruler,
      title: 'So lang ist dein Filament',
      value: `${fmt(stats.meters / 1000, 1)} km`,
      desc: `Alles abgewickelt (1,75 mm). Damit läufst du ${fmt(laps)}-mal um ein Fußballfeld.`,
      source: 'LIVE'
    },
    {
      icon: Euro,
      title: 'Wert im Regal',
      value: `${fmt(stats.value, 0)} €`,
      desc: 'Restgewicht × Kilopreis jeder Spule.',
      source: 'LIVE'
    },
    {
      icon: Palette,
      title: 'Deine Lieblinge',
      value: `${stats.topMaterial?.[0] || '–'} · ${stats.topColor?.[0] || '–'}`,
      desc: `${stats.topMaterial?.[1] || 0} Spulen ${stats.topMaterial?.[0] || ''}, ${stats.topColor?.[1] || 0}× die Farbe „${stats.topColor?.[0] || '–'}“.`,
      source: 'LIVE'
    },
    {
      icon: Nfc,
      title: 'NFC-Tags beschrieben',
      value: `${stats.nfc} von ${spools.length}`,
      desc: stats.nfc === spools.length && spools.length > 0 ? 'Alle Spulen haben einen Tag. Stark!' : `Noch ${spools.length - stats.nfc} Spulen ohne Tag.`,
      source: 'LIVE'
    },
    {
      icon: Scale,
      title: 'In der App abgezogen',
      value: `${fmt(stats.deducted / 1000, 2)} kg`,
      desc: 'Alle Abzüge aus dem Verlauf (Knöpfe, Waage, Auto-Abzug).',
      source: 'LIVE'
    },
    {
      icon: MessageSquare,
      title: 'Deine Wörter an Claude',
      value: `ca. ${fmt(WORDS)} Wörter`,
      desc: `Grob gezählt über ${CHATS} Chats mit rund ${MESSAGES} Nachrichten. Deine langen Sprachnachrichten zählen voll mit.`,
      source: 'SCHÄTZUNG'
    },
    {
      icon: MessagesSquare,
      title: 'Gespräche',
      value: `${CHATS} Chats · ~${MESSAGES} Nachrichten`,
      desc: 'Chats im Projekt „filament webseite“, dieser hier mitgezählt.',
      source: 'GEZÄHLT'
    },
    {
      icon: Layers,
      title: 'Versionen',
      value: `${INITIAL_VERSION_PROFILES.length} Versionen`,
      desc: `Von v1.00 bis v${APP_REVISION}. Jede lässt sich im Revisionsmenü wiederherstellen.`,
      source: 'LIVE'
    },
    {
      icon: GitCommit,
      title: 'GitHub',
      value: `${COMMITS} Commits`,
      desc: 'Jeder Push baut automatisch 3 Dinge: Prüfung, Webseite und Android-App.',
      source: 'GEZÄHLT'
    },
    {
      icon: CalendarDays,
      title: 'Projekt-Alter',
      value: `${stats.days} Tage`,
      desc: `Seit dem 19. Oktober 2026. Das sind ${fmt(INITIAL_VERSION_PROFILES.length / stats.days, 1)} Versionen pro Tag.`,
      source: 'LIVE'
    }
  ];

  const sourceStyle: Record<Source, { bg: string; fg: string; label: string }> = {
    LIVE: { bg: 'rgba(16,185,129,0.15)', fg: '#10b981', label: '● live' },
    BAUEN: { bg: 'rgba(59,130,246,0.15)', fg: '#3b82f6', label: 'beim Bauen' },
    GEZÄHLT: { bg: 'rgba(168,85,247,0.15)', fg: '#a855f7', label: 'gezählt' },
    SCHÄTZUNG: { bg: 'rgba(245,158,11,0.15)', fg: '#f59e0b', label: 'Schätzung' }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--app-card)', color: 'var(--app-text)' }}
      >
        {/* Kopf */}
        <div className="sticky top-0 z-10 p-4 sm:p-5 text-white" style={{ background: 'var(--app-accent-gradient, var(--app-accent))' }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-lg leading-tight flex items-center gap-2">
                  Fun Facts
                  <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-mono">v{APP_REVISION}</span>
                </h3>
                <p className="text-[11px] text-white/85">Echte Zahlen aus deinen Spulen, deinem Drucker und unserem Projekt</p>
              </div>
            </div>
            <button onClick={onClose} aria-label="Schließen" className="p-2 rounded-xl bg-white/15 hover:bg-white/25 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {facts.map((fact, idx) => {
            const Icon = fact.icon;
            const src = sourceStyle[fact.source];
            return (
              <div
                key={idx}
                className={`p-3.5 rounded-2xl border space-y-1.5 ${fact.big ? 'sm:col-span-1' : ''}`}
                style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: 'var(--app-accent-sub)', color: 'var(--app-accent-text)' }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-bold truncate" style={{ color: 'var(--app-text-muted)' }}>
                      {fact.title}
                    </span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold shrink-0" style={{ backgroundColor: src.bg, color: src.fg }}>
                    {src.label}
                  </span>
                </div>
                <div className={`${fact.big ? 'text-2xl' : 'text-lg'} font-extrabold font-mono-num tracking-tight leading-tight`} style={{ color: 'var(--app-accent-text)' }}>
                  {fact.value}
                </div>
                <p className="text-[11px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>
                  {fact.desc}
                </p>
              </div>
            );
          })}
        </div>

        <div className="px-4 sm:px-5 pb-5 text-[10px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>
          <strong>live</strong> = jedes Öffnen neu berechnet · <strong>beim Bauen</strong> = beim Erstellen der Version gezählt ·{' '}
          <strong>gezählt</strong> = von Claude beim letzten Update gezählt · <strong>Schätzung</strong> = ungefähr
        </div>
      </div>
    </div>
  );
};
