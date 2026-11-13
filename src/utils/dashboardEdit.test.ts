import { describe, expect, it } from 'vitest';
import { EMPTY, ID, LIMITS, OLD_HELPERS, clampSoll, helperDefs, parseSpoolEntity, slotOfTray, sollTarget, spoolLabel, spoolOptions } from '../../server/hub/dashboardEditLogic';
import { THEME_YAML } from '../../server/hub/dashboardTheme';
import { THEME } from '../../server/hub/dashboardConfig';

describe('Dashboard-Eingabefelder', () => {
  it('Soll-Temperatur: Düsen bis 300, Bett bis 120, Müll abgelehnt', () => {
    expect(clampSoll('nozzle', 215.4)).toBe(215);
    expect(clampSoll('nozzle', 999)).toBe(300);
    expect(clampSoll('bed', 150)).toBe(120);
    expect(clampSoll('bed', -5)).toBe(0);
    expect(clampSoll('bed', '60')).toBe(60);
    expect(clampSoll('bed', 'abc')).toBeNull();
    expect(clampSoll('bed', '')).toBeNull();
    expect(clampSoll('nozzle', null)).toBeNull();
    expect(LIMITS.bed.max).toBe(120);
  });

  it('Soll-Felder → Ziel am Drucker (Düse 1 links, Düse 2 rechts)', () => {
    expect(sollTarget(ID.nozzleSoll)?.target).toBe('nozzle1');
    expect(sollTarget(ID.nozzle2Soll)?.target).toBe('nozzle2');
    expect(sollTarget(ID.bedSoll)).toMatchObject({ target: 'bed', kind: 'bed' });
    expect(sollTarget('input_number.fremd')).toBeNull();
  });

  it('Felder: alle Ids stimmen mit den Namen überein, die Home Assistant daraus macht', () => {
    const defs = helperDefs();
    expect(defs).toHaveLength(3 + 5);
    for (const d of defs) {
      expect(d.name).toMatch(/^[A-Za-z0-9 ]+$/); // keine Umlaute: Home Assistant macht aus „ü“ nur „u“
      const slug = d.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      expect(d.id).toBe(`${d.domain}.${slug}`);
    }
    expect(new Set(defs.map(d => d.id)).size).toBe(defs.length);
    expect(defs.find(d => d.id === ID.spool(1))?.body.options).toEqual([EMPTY]);
    expect(OLD_HELPERS).toHaveLength(15);
    expect(OLD_HELPERS.some(o => `${o.domain}.${o.id}` === ID.spool(1))).toBe(false);
  });

  it('Spulen-Liste: Text mit Rest, nur Spulen mit Rest (belegte bleiben), gleiche Namen eindeutig', () => {
    expect(spoolLabel({ id: 'a', brand: 'Sunlu', material: 'PLA+', colorName: 'Gelb', remainingWeight: 640.4, initialWeight: 1000 })).toBe('Sunlu PLA+ Gelb · 640 g (64 %)');
    expect(spoolLabel({ id: 'b', remainingWeight: 250, initialWeight: 500 })).toBe('Spule · 250 g (50 %)');
    const o = spoolOptions(
      [
        { id: 'x', brand: 'Sunlu', material: 'PLA', colorName: 'Rot', remainingWeight: 500 },
        { id: 'y', brand: 'Sunlu', material: 'PLA', colorName: 'Rot', remainingWeight: 500 },
        { id: 'leer', brand: 'Bambu', material: 'PETG', colorName: 'Blau', remainingWeight: 0 },
        { id: 'alt', brand: 'Bambu', material: 'ABS', colorName: 'Weiß', remainingWeight: 0 }
      ],
      ['alt']
    );
    expect(o.options[0]).toBe(EMPTY);
    expect(o.options).toHaveLength(4); // leer + 2× Rot + belegte ABS
    expect(new Set(o.options).size).toBe(o.options.length);
    expect(o.labelOf.get('y')).toMatch(/#2$/);
    expect(o.idOf.get(o.labelOf.get('alt')!)).toBe('alt');
    expect(o.labelOf.has('leer')).toBe(false);
    expect(spoolOptions(null as any).options).toEqual([EMPTY]);
  });

  it('Plätze', () => {
    expect(slotOfTray({ amsId: 0, slotId: 2 })).toBe(3);
    expect(slotOfTray({ amsId: 255, slotId: 0 })).toBe(5);
    expect(slotOfTray({ amsId: 128, slotId: 0 })).toBeNull();
    expect(parseSpoolEntity(ID.spool(2))).toBe(2);
    expect(parseSpoolEntity(ID.spool(5))).toBe(5);
    expect(parseSpoolEntity('input_select.filamenthub_slot_6_spule')).toBeNull();
    expect(parseSpoolEntity('input_select.fremd_slot_1_spule')).toBeNull();
  });

  it('Theme: Name passt, Karten getönt, Eingabefelder und Verläufe eingefärbt', () => {
    expect(THEME_YAML).toContain(`${THEME}:`);
    expect(THEME_YAML).toContain('ha-card-background: "rgba(18,28,32,0.62)"'); // dunkle Glaskarten
    expect(THEME_YAML).toContain("ha-font-family-body: \"'Outfit'");
    expect(THEME_YAML).toContain('mdc-select-fill-color');
    expect(THEME_YAML).toContain('graph-color-1');
    expect(THEME_YAML).toMatch(/card-background-color: "#[0-9a-f]{6}"/); // Menüs deckend
  });
});
