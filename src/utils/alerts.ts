// Zentrale Stelle für alle Mitteilungen: prüft die Einstellung, speichert sie im Postfach und zeigt (wenn erlaubt)
// eine Benachrichtigung aufs Gerät. Ein Tipp auf die Benachrichtigung öffnet die Mitteilung in der App.
import { addInbox, type InboxItem, type InboxKind } from './inbox';
import { localNotify } from './notify';
import { addSystemLog } from './logService';
import { getWorkshopSettings, type WorkshopSettings } from './workshopSettings';
import { shouldPush } from './pushPolicy';

const KIND_SETTING: Record<InboxKind, keyof WorkshopSettings | null> = {
  'print-start': 'alertPrintStart',
  'print-check': 'alertPrintCheck',
  'printer-error': 'alertErrors',
  humidity: 'alertHumidity',
  'print-done': 'alertPrintDone',
  'print-fail': 'alertPrintFail',
  'dry-due': 'alertDryDue',
  'dry-done': 'alertDryDone',
  'dry-stop': 'alertDryStop',
  low: 'alertLow',
  info: null
};

interface AlertInput {
  kind: InboxKind;
  title: string;
  text: string;
  key?: string;
  facts?: InboxItem['facts'];
  items?: InboxItem['items'];
  /** Kurzer Text für das Einblend-Fenster in der App (Standard: der Text) */
  toast?: string;
}

/** Meldet ein Ereignis. Gibt die ID im Postfach zurück, oder null, wenn die Meldung abgeschaltet oder schon bekannt ist. */
export async function raiseAlert(input: AlertInput, showToast?: (text: string) => void): Promise<string | null> {
  const settings = getWorkshopSettings();
  const flag = KIND_SETTING[input.kind];
  if (flag && settings[flag] === false) return null;

  const { id, isNew } = addInbox({ kind: input.kind, title: input.title, text: input.text, key: input.key, facts: input.facts, items: input.items });
  if (!isNew) return null;

  showToast?.(input.toast || input.text);
  addSystemLog('system', input.title, input.text, input.kind === 'print-fail' || input.kind === 'dry-due' || input.kind === 'dry-stop' || input.kind === 'low' ? 'warn' : 'success');
  if (shouldPush(input.kind, settings)) {
    void localNotify(input.title, input.text, { tag: input.key || input.kind, inboxId: id });
  }
  return id;
}

// --- Test-Mitteilungen: zeigen genau so eine Meldung, wie sie später echt kommt (mit Postfach-Eintrag und Tipp-zum-Öffnen) ---

export const TEST_KINDS: { kind: InboxKind; label: string }[] = [
  { kind: 'dry-done', label: 'Trocknung fertig' },
  { kind: 'dry-stop', label: 'Trocknung gestoppt' },
  { kind: 'dry-due', label: 'Trocknen fällig' },
  { kind: 'print-start', label: 'Druck gestartet' },
  { kind: 'print-check', label: 'Spulen-Check' },
  { kind: 'printer-error', label: 'Druckerfehler' },
  { kind: 'humidity', label: 'Feuchte zu hoch' },
  { kind: 'print-done', label: 'Druck fertig' },
  { kind: 'print-fail', label: 'Druck fehlgeschlagen' },
  { kind: 'low', label: 'Spule fast leer' }
];

const sampleTime = () => new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' Uhr';

function sample(kind: InboxKind): Pick<InboxItem, 'title' | 'text' | 'facts' | 'items'> {
  const spools = [
    { title: 'Bambu PLA Basic Weiß', sub: 'Slot 1 · PLA', color: '#f1f5f9' },
    { title: 'Sunlu PETG Schwarz', sub: 'Slot 2 · PETG', color: '#1f2937' }
  ];
  switch (kind) {
    case 'dry-done':
      return {
        title: 'Test: Trocknung fertig',
        text: 'AMS-Trocknung fertig (6 h bei 55 °C). Im AMS: Bambu PLA Basic Weiß, Sunlu PETG Schwarz.',
        facts: [
          { label: 'Dauer', value: '6 h' },
          { label: 'Temperatur', value: '55 °C' },
          { label: 'Fertig seit', value: sampleTime() }
        ],
        items: spools
      };
    case 'dry-stop':
      return {
        title: 'Test: Trocknung gestoppt',
        text: 'Die AMS-Trocknung wurde gestoppt. Es fehlten noch 2 h 10 min.',
        facts: [
          { label: 'Gestoppt', value: sampleTime() },
          { label: 'Es fehlten noch', value: '2 h 10 min' }
        ],
        items: spools
      };
    case 'dry-due':
      return {
        title: 'Test: Trocknen fällig',
        text: 'Trocknen fällig: Sunlu PETG Schwarz (65 °C, 8 h).',
        items: [{ title: 'Sunlu PETG Schwarz', sub: 'PETG · 65 °C · 8 h', color: '#1f2937' }]
      };
    case 'print-check':
      return {
        title: 'Test: Spulen-Check',
        text: 'Benchy.3mf braucht ca. 120 g, Bambu PLA Basic Weiß hat nur 62 g.',
        items: [{ title: 'Bambu PLA Basic Weiß', sub: 'Slot 1 · braucht 120 g · da 62 g', color: '#f1f5f9' }]
      };
    case 'printer-error':
      return {
        title: 'Test: Druckerfehler',
        text: 'Die Düse ist verstopft.',
        facts: [{ label: 'Bereich', value: 'Druck' }, { label: 'Stufe', value: 'Ernst' }, { label: 'Code', value: '0300_4006' }]
      };
    case 'humidity':
      return {
        title: 'Test: Feuchte zu hoch',
        text: 'AMS: 28 % Luftfeuchte (Grenze 25 %). Trocknen empfohlen.',
        facts: [{ label: 'Gemessen', value: '28 %' }, { label: 'Grenze', value: '25 %' }],
        items: spools
      };
    case 'print-start':
      return {
        title: 'Test: Druck gestartet',
        text: 'Benchy.3mf läuft. Fertig ca. 21:40 Uhr.',
        facts: [{ label: 'Auftrag', value: 'Benchy.3mf' }, { label: 'Gestartet', value: sampleTime() }, { label: 'Fertig ca.', value: '21:40 Uhr' }],
        items: [spools[0]]
      };
    case 'print-done':
      return { title: 'Test: Druck fertig', text: 'Benchy.3mf ist fertig.', facts: [{ label: 'Auftrag', value: 'Benchy.3mf' }, { label: 'Beendet', value: sampleTime() }, { label: 'Dauer', value: '1 h 12 min' }] };
    case 'print-fail':
      return { title: 'Test: Druck fehlgeschlagen', text: 'Benchy.3mf ist fehlgeschlagen oder wurde abgebrochen.', facts: [{ label: 'Auftrag', value: 'Benchy.3mf' }, { label: 'Beendet', value: sampleTime() }] };
    case 'low':
      return { title: 'Test: Spule fast leer', text: 'Bambu PLA Basic Weiß hat nur noch 62 g.', items: [{ title: 'Bambu PLA Basic Weiß', sub: 'Rest 62 g von 1000 g', color: '#f1f5f9' }] };
    default:
      return { title: 'Test: Info', text: 'So sieht eine Info aus.' };
  }
}

/** Schickt eine Test-Mitteilung (ignoriert die Ein/Aus-Schalter der Art, sonst wäre ein Test bei ausgeschalteter Art sinnlos).
 *  pushed = die Benachrichtigung aufs Gerät wurde wirklich gezeigt. */
export async function testAlert(kind: InboxKind): Promise<{ id: string; pushed: boolean }> {
  const s = sample(kind);
  const key = `test-${kind}-${Date.now()}`;
  const { id } = addInbox({ kind, title: s.title, text: s.text, key, facts: s.facts, items: s.items });
  const pushed = await localNotify(s.title, s.text, { tag: key, inboxId: id });
  return { id, pushed };
}
