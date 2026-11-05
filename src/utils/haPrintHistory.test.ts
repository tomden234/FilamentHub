import { describe, expect, it } from 'vitest';
import { extractPrints, findHistorySensors, normStatus, parseHistory, slotFromTrayText, valueAt } from './haPrintHistory';
import { isRawAllowed } from '../../server/haRawAllow';

const T0 = Date.parse('2026-11-04T10:00:00Z');
const min = (n: number) => T0 + n * 60_000;
const pt = (m: number, state: string) => ({ t: min(m), state });

describe('Status und Fach aus Home Assistant verstehen', () => {
  it('bildet Status englisch und deutsch ab, ignoriert offline/unbekannt', () => {
    expect(normStatus('running')).toBe('RUNNING');
    expect(normStatus('Pausiert')).toBe('PAUSE');
    expect(normStatus('finish')).toBe('FINISH');
    expect(normStatus('failed')).toBe('FAILED');
    expect(normStatus('slicing')).toBe('PREPARE');
    expect(normStatus('idle')).toBe('IDLE');
    expect(normStatus('unavailable')).toBeNull();
    expect(normStatus('offline')).toBeNull();
    expect(normStatus('irgendwas')).toBeNull();
  });
  it('liest den Slot aus dem Fach-Text', () => {
    expect(slotFromTrayText('AMS 1 Slot 2')).toBe(2);
    expect(slotFromTrayText('AMS 1 Tray 4')).toBe(4);
    expect(slotFromTrayText('3')).toBe(3);
    expect(slotFromTrayText('Externe Spule')).toBe(5);
    expect(slotFromTrayText('External Spool')).toBe(5);
    expect(slotFromTrayText('AMS 2 Slot 1')).toBeNull(); // zweite Einheit
    expect(slotFromTrayText('Generic PETG')).toBeNull(); // Filamentname
    expect(slotFromTrayText('unknown')).toBeNull();
  });
});

describe('Drucke aus dem Verlauf bauen', () => {
  it('fertiger Druck mit Name, Startzeit und Hauptslot', () => {
    const prints = extractPrints({
      status: [pt(-30, 'idle'), pt(0, 'prepare'), pt(2, 'running'), pt(62, 'finish')],
      names: [pt(-30, 'alt.gcode.3mf'), pt(0, 'Benchy.gcode.3mf')],
      trays: [pt(-30, 'AMS 1 Slot 1'), pt(0, 'AMS 1 Slot 2'), pt(40, 'AMS 1 Slot 3')],
      progress: [pt(2, '1'), pt(62, '100')],
      starts: [pt(0, new Date(min(1)).toISOString())]
    });
    expect(prints).toHaveLength(1);
    const p = prints[0];
    expect(p.name).toBe('Benchy.gcode.3mf');
    expect(p.state).toBe('FINISH');
    expect(p.percent).toBe(100);
    expect(p.startMs).toBe(min(1)); // Startzeit-Sensor gewinnt
    expect(p.endMs).toBe(min(62));
    expect(p.slots['2']).toBeCloseTo(40 * 60, 0);
    expect(p.slots['3']).toBeCloseTo(22 * 60, 0);
    expect(p.slots['1']).toBeUndefined();
  });
  it('abgebrochener Druck mit letztem Fortschritt', () => {
    const [p] = extractPrints({
      status: [pt(0, 'running'), pt(30, 'failed')],
      names: [pt(0, 'Vase')],
      progress: [pt(5, '10'), pt(29, '47'), pt(30, '0')]
    });
    expect(p.state).toBe('FAILED');
    expect(p.percent).toBe(47);
  });
  it('Leerlauf ohne „fertig“: bei 98 % fertig, bei 40 % abgebrochen', () => {
    const a = extractPrints({ status: [pt(0, 'running'), pt(20, 'idle')], names: [pt(0, 'A')], progress: [pt(19, '98')] });
    const b = extractPrints({ status: [pt(0, 'running'), pt(20, 'idle')], names: [pt(0, 'B')], progress: [pt(19, '40')] });
    expect(a[0].state).toBe('FINISH');
    expect(b[0].state).toBe('FAILED');
  });
  it('Pause und kurze Ausfälle (unavailable) trennen den Druck nicht', () => {
    const prints = extractPrints({
      status: [pt(0, 'running'), pt(10, 'pause'), pt(15, 'unavailable'), pt(16, 'running'), pt(40, 'finish')],
      names: [pt(0, 'Teil')]
    });
    expect(prints).toHaveLength(1);
    expect(prints[0].startMs).toBe(min(0));
  });
  it('mehrere Drucke, älteste zuerst; laufender Druck fehlt; Zucken unter 1 min zählt nicht', () => {
    const prints = extractPrints({
      status: [pt(0, 'running'), pt(20, 'finish'), pt(30, 'running'), pt(30.5, 'finish'), pt(40, 'running'), pt(70, 'failed'), pt(80, 'running')],
      names: [pt(0, 'Eins'), pt(40, 'Zwei'), pt(80, 'Drei')]
    });
    expect(prints.map(p => p.name)).toEqual(['Eins', 'Zwei']);
  });
  it('Ende ohne bekannten Start (Verlauf beginnt danach) wird übersprungen', () => {
    expect(extractPrints({ status: [pt(0, 'finish'), pt(5, 'idle')], names: [pt(0, 'X')] })).toHaveLength(0);
  });
  it('ohne Namen: „Druckauftrag“', () => {
    expect(extractPrints({ status: [pt(0, 'running'), pt(10, 'finish')] })[0].name).toBe('Druckauftrag');
  });
  it('valueAt nimmt den Wert, der zur Zeit galt', () => {
    const v = [pt(0, 'a'), pt(10, 'unknown'), pt(20, 'b')];
    expect(valueAt(v, min(15))).toBe('a');
    expect(valueAt(v, min(25))).toBe('b');
    expect(valueAt(v, min(-5))).toBe('');
  });
});

describe('HA-Antwort und Sensorsuche', () => {
  it('liest die minimale Verlaufsantwort', () => {
    const h = parseHistory([
      [{ entity_id: 'sensor.x2d_print_status', state: 'idle', last_changed: '2026-11-04T09:00:00+00:00' }, { state: 'running', last_changed: '2026-11-04T10:00:00+00:00' }],
      [{ entity_id: 'sensor.x2d_subtask_name', state: 'Benchy', last_changed: '2026-11-04T09:59:00+00:00' }]
    ]);
    expect(h['sensor.x2d_print_status']).toHaveLength(2);
    expect(h['sensor.x2d_print_status'][1].state).toBe('running');
    expect(h['sensor.x2d_subtask_name'][0].state).toBe('Benchy');
    expect(parseHistory(null)).toEqual({});
  });
  it('findet die Sensoren (englisch)', () => {
    const states = ['sensor.x2d_print_status', 'sensor.x2d_subtask_name', 'sensor.x2d_active_tray', 'sensor.x2d_start_time', 'sensor.x2d_print_progress', 'sensor.andere_start_time'].map(entity_id => ({ entity_id }));
    expect(findHistorySensors(states)).toEqual({
      status: 'sensor.x2d_print_status',
      name: 'sensor.x2d_subtask_name',
      tray: 'sensor.x2d_active_tray',
      progress: 'sensor.x2d_print_progress',
      start: 'sensor.x2d_start_time'
    });
  });
  it('findet die Sensoren (deutsch) und bevorzugt gleichen Präfix', () => {
    const states = ['sensor.a_start_time', 'sensor.x2d_druckstatus', 'sensor.x2d_start_time', 'sensor.x2d_druckfortschritt'].map(entity_id => ({ entity_id }));
    const f = findHistorySensors(states);
    expect(f.status).toBe('sensor.x2d_druckstatus');
    expect(f.start).toBe('sensor.x2d_start_time');
    expect(f.progress).toBe('sensor.x2d_druckfortschritt');
    expect(findHistorySensors([])).toEqual({ status: undefined, name: undefined, tray: undefined, progress: undefined, start: undefined });
  });
});

describe('Weiterleitung: Verlauf lesen ist eng begrenzt', () => {
  const ok = '/api/history/period/2026-11-01T00%3A00%3A00.000Z?filter_entity_id=sensor.x2d_print_status,sensor.x2d_subtask_name&end_time=2026-11-05T10%3A00%3A00.000Z&minimal_response&no_attributes';
  it('lässt Verlauf von Sensoren zu', () => {
    expect(isRawAllowed('GET', ok, undefined)).toBe(true);
  });
  it('lehnt andere Geräte, zu viele Einträge und Schreiben ab', () => {
    expect(isRawAllowed('GET', '/api/history/period/2026-11-01?filter_entity_id=lock.haustuer', undefined)).toBe(false);
    expect(isRawAllowed('GET', '/api/history/period/2026-11-01?filter_entity_id=sensor.a,lock.b', undefined)).toBe(false);
    expect(isRawAllowed('GET', '/api/history/period/2026-11-01?filter_entity_id=sensor.a&evil=1', undefined)).toBe(false);
    expect(isRawAllowed('GET', '/api/history/period/2026-11-01', undefined)).toBe(false);
    expect(isRawAllowed('POST', ok, {})).toBe(false);
    const nine = Array.from({ length: 9 }, (_, i) => `sensor.s${i}`).join(',');
    expect(isRawAllowed('GET', `/api/history/period/2026-11-01?filter_entity_id=${nine}`, undefined)).toBe(false);
  });
});
