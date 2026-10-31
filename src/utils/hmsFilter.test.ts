import { describe, expect, it } from 'vitest';
import { hmsIsImportant, printErrorIsImportant } from './hmsFilter';

// HMS-Eintrag: attr = Modul/Bereich, code = Stufe (obere 16 Bit) + Nummer. Stufe 1 Kritisch, 2 Ernst, 3 Normal, 4 Hinweis.
const hms = (level: number) => ({ attr: 0x03000100, code: level * 0x10000 + 0x0007 });

describe('hmsIsImportant', () => {
  it('meldet schwere Fehler während des Drucks', () => {
    expect(hmsIsImportant(hms(1), 'RUNNING')).toBe(true);
    expect(hmsIsImportant(hms(2), 'PAUSE')).toBe(true);
    expect(hmsIsImportant(hms(2), 'FAILED')).toBe(true);
  });
  it('meldet Hinweise und normale Meldungen nicht (Düse wechseln, Filament einlegen …)', () => {
    expect(hmsIsImportant(hms(3), 'RUNNING')).toBe(false);
    expect(hmsIsImportant(hms(4), 'PAUSE')).toBe(false);
  });
  it('meldet nichts, wenn gerade kein Druck läuft', () => {
    expect(hmsIsImportant(hms(1), 'IDLE')).toBe(false);
    expect(hmsIsImportant(hms(2), 'FINISH')).toBe(false);
    expect(hmsIsImportant(hms(2), undefined)).toBe(false);
  });
  it('ignoriert „MQTT command verification failed“', () => {
    expect(hmsIsImportant({ attr: 0x05000500, code: 0x00010007 }, 'RUNNING')).toBe(false);
  });
});

describe('printErrorIsImportant', () => {
  it('nur bei wirklich fehlgeschlagenem Druck', () => {
    expect(printErrorIsImportant(0x03004006, 'FAILED')).toBe(true);
    expect(printErrorIsImportant(0x03004006, 'PAUSE')).toBe(false);
    expect(printErrorIsImportant(0x03004006, 'RUNNING')).toBe(false);
  });
  it('kein Fehler und Abbruch durch dich zählen nicht', () => {
    expect(printErrorIsImportant(0, 'FAILED')).toBe(false);
    expect(printErrorIsImportant(0x0300400c, 'FAILED')).toBe(false);
  });
});
