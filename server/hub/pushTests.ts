// 1.261: Test-Meldungen für das Testmenü: jede Art Push, die der Pi schickt, einmal als Beispiel.
// Gesendet wird immer (Art „test“ umgeht die Schalter in den Einstellungen), nur die Ruhezeit macht sie lautlos.
import { queueActions } from './queue.js';
import type { PushOptions } from './ha.js';

export interface PushTest {
  id: string;
  label: string;
  title: string;
  text: string;
  opts: PushOptions;
}

/** Eintrag, den es nicht gibt: der Knopf antwortet mit „Nicht mehr da“ und zeigt so, dass der Weg funktioniert */
const FAKE_QUEUE_ID = '000000000000';

export const PUSH_TESTS: PushTest[] = [
  { id: 'basic', label: 'Einfacher Test', title: '🧪 FilamentHub', text: 'Test vom Pi-Server: Push klappt.', opts: { tag: 'test' } },
  { id: 'done', label: 'Druck fertig', title: '✅ Druck fertig', text: 'Testwürfel · 1 h 12 min · 18 g', opts: { tag: 'test-done' } },
  { id: 'failed', label: 'Druck abgebrochen', title: '❌ Druck abgebrochen', text: 'Testwürfel bei 42 % · 31 min\nIn der App: Spule anteilig abziehen?', opts: { tag: 'test-failed' } },
  { id: 'queue', label: 'Neu in der Warteschlange (mit Knöpfen)', title: '➕ In der Warteschlange', text: 'Testwürfel (Beispiel)\nPLA Weiß (18 g) → AMS 1 Slot 1\n📉 Beispiel: braucht ca. 20 g, da 12 g\nTipp auf einen Knopf: Der Pi antwortet „Nicht mehr da“.', opts: queueActions(FAKE_QUEUE_ID) },
  { id: 'low', label: 'Spule fast leer', title: '🧵 Spule fast leer', text: 'Bambu PLA Weiß: nur noch 80 g übrig.', opts: { tag: 'test-low' } },
  { id: 'spool-check', label: 'Filament reicht evtl. nicht', title: '⚠️ Filament reicht evtl. nicht', text: 'Testwürfel\nBambu PLA Weiß (Slot 1) reicht evtl. nicht: braucht ca. 90 g, da 60 g.', opts: { tag: 'test-spool-check' } },
  { id: 'long', label: 'Druck dauert länger', title: '⏰ Druck dauert länger als gewohnt', text: 'Testwürfel läuft seit 2 h 10 min (normal ca. 1 h 15 min). Bitte kurz nachsehen.', opts: { tag: 'test-long' } },
  { id: 'offline', label: 'Drucker antwortet nicht', title: '📡 Drucker antwortet nicht', text: 'Seit 2 Minuten keine Daten vom Drucker, obwohl „Testwürfel“ lief (42 %). Strom, WLAN oder Absturz?', opts: { tag: 'test-offline' } },
  {
    id: 'wait',
    label: 'Drucker wartet (Knöpfe ohne Wirkung)',
    title: '⏸️ Drucker wartet',
    text: 'Beispiel: Filament ist aufgebraucht.\nWeiter = am Drucker bestätigen.',
    opts: { tag: 'test-wait', actions: [{ action: 'FH_TEST_NOOP', title: '▶️ Weiter' }, { action: 'FH_TEST_NOOP', title: '⏹️ Abbrechen' }] }
  },
  { id: 'auto-off', label: 'Drucker ausgeschaltet', title: '🔌 Drucker ausgeschaltet', text: 'Nach „Testwürfel“ automatisch ausgeschaltet.', opts: { tag: 'test-auto-off' } },
  { id: 'dry-off', label: 'Trocknen fertig, Drucker aus', title: '🔌 Trocknen fertig, Drucker aus', text: 'Die Trocknung ist zu Ende. Der Drucker wurde ausgeschaltet.', opts: { tag: 'test-dry-off' } },
  { id: 'esp', label: 'ESP-Update bereit', title: '🔧 ESP-Update bereit', text: 'Neue AMS-ESP-Fassung (Beispiel). Home Assistant → ESPHome → Filament AMS → Installieren → Drahtlos.', opts: { tag: 'test-esp' } }
];

export const pushTestList = (): { id: string; label: string }[] => [{ id: 'weekly', label: 'Wochenbericht (mit Seite)' }, ...PUSH_TESTS.map(t => ({ id: t.id, label: t.label }))];

export const findPushTest = (id: string): PushTest | undefined => PUSH_TESTS.find(t => t.id === id);
