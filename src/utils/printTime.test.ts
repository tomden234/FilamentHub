import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { weightsFromThreeMf } from '../../server/bambuJobFile';
import { factorFor, fmtDur, learn, mainMaterial, nextFactor, timeInfo, type Factors } from '../../server/hub/printTime';

describe('Druckzeit: Slicer-Zeit aus der .3mf', () => {
  it('liest prediction der gewählten Platte', () => {
    const xml =
      '<config><plate><metadata key="index" value="1"/><metadata key="prediction" value="3600"/><filament id="1" type="PLA" color="#FF0000" used_g="10"/></plate>' +
      '<plate><metadata key="index" value="2"/><metadata key="prediction" value="7843"/><filament id="1" type="PETG" color="#00FF00" used_g="20"/></plate></config>';
    const z = zipSync({ 'Metadata/slice_info.config': strToU8(xml) });
    expect(weightsFromThreeMf(z, 2)?.predSec).toBe(7843);
    expect(weightsFromThreeMf(z, 1)?.predSec).toBe(3600);
  });
  it('ohne prediction: undefined', () => {
    const z = zipSync({ 'Metadata/slice_info.config': strToU8('<config><plate><filament id="1" type="PLA" color="#FF0000" used_g="5"/></plate></config>') });
    expect(weightsFromThreeMf(z, 1)?.predSec).toBeUndefined();
  });
});

describe('Druckzeit: Faktor lernen', () => {
  it('Hauptmaterial nach Gramm', () => {
    expect(mainMaterial([{ type: 'pla', grams: 5 }, { type: 'PETG', grams: 30 }])).toBe('PETG');
    expect(mainMaterial([])).toBe('');
  });
  it('erster Druck setzt den Faktor, später Mittelwert', () => {
    const a = nextFactor(undefined, 1.2);
    expect(a).toEqual({ n: 1, f: 1.2 });
    expect(nextFactor(a, 1.0)).toEqual({ n: 2, f: 1.1 });
  });
  it('Ausreißer werden begrenzt', () => {
    expect(nextFactor(undefined, 10).f).toBe(3);
    expect(nextFactor(undefined, 0.01).f).toBe(0.5);
  });
  it('zu kurze Drucke zählen nicht', () => {
    const f: Factors = {};
    expect(learn(f, 'PLA', 200, 250)).toBe(f);
    expect(learn(f, 'PLA', 3600, 100)).toBe(f);
  });
  it('lernt je Material und über alle', () => {
    let f: Factors = {};
    f = learn(f, 'PLA', 3600, 4320);
    f = learn(f, 'PLA', 3600, 4320);
    expect(factorFor(f, 'PLA')).toEqual({ f: 1.2, n: 2, learned: true });
    // anderes Material mit zu wenig Drucken: Faktor über alle
    expect(factorFor(f, 'ASA').learned).toBe(true);
  });
  it('vor 2 Drucken: nicht gelernt, berechnet = Slicer', () => {
    const f = learn({}, 'PLA', 3600, 4320);
    const t = timeInfo(3600, 'PLA', f);
    expect(t).toMatchObject({ slicerSec: 3600, calcSec: 3600, learned: false, n: 1 });
  });
  it('berechnete Zeit nutzt den Faktor', () => {
    let f: Factors = {};
    f = learn(f, 'PETG', 7200, 8640);
    f = learn(f, 'PETG', 7200, 8640);
    expect(timeInfo(5000, 'PETG', f)).toMatchObject({ slicerSec: 5000, calcSec: 6000, learned: true });
  });
  it('Dauer als Text', () => {
    expect(fmtDur(2700)).toBe('45 min');
    expect(fmtDur(7800)).toBe('2:10 h');
  });
});
