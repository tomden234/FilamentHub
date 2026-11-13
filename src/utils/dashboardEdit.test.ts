import { describe, expect, it } from 'vitest';
import { COLORS, ID, LIMITS, MATERIALS, clampSoll, colorHexOf, helperDefs, materialOption, nearestColorName, parseSlotEntity, slotOfTray } from '../../server/hub/dashboardEditLogic';
import { THEME_YAML } from '../../server/hub/dashboardTheme';
import { THEME } from '../../server/hub/dashboardConfig';

describe('Dashboard-Eingabefelder', () => {
  it('Soll-Temperatur: Düse bis 300, Bett bis 120, Müll abgelehnt', () => {
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

  it('Felder: alle Ids stimmen mit den Namen überein, die Home Assistant daraus macht', () => {
    const defs = helperDefs();
    expect(defs).toHaveLength(2 + 5 * 3);
    for (const d of defs) {
      expect(d.name).toMatch(/^[A-Za-z0-9 ]+$/); // keine Umlaute: Home Assistant macht aus „ü“ nur „u“
      const slug = d.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      expect(d.id).toBe(`${d.domain}.${slug}`);
    }
    expect(new Set(defs.map(d => d.id)).size).toBe(defs.length);
  });

  it('Farben und Material', () => {
    expect(colorHexOf('Rot')).toBe('#C62828');
    expect(colorHexOf('Gibtsnicht')).toBeNull();
    expect(nearestColorName('#FF0000')).toBe('Rot');
    expect(nearestColorName('#FFFFFF')).toBe('Weiß');
    expect(nearestColorName('kaputt')).toBe('Grau');
    expect(COLORS.every(c => /^#[0-9A-F]{6}$/.test(c.hex))).toBe(true);
    expect(materialOption('PETG-HF')).toBe('PETG');
    expect(materialOption('pla')).toBe('PLA');
    expect(materialOption('PLA Matte')).toBe('PLA');
    expect(materialOption('')).toBeNull();
    expect(materialOption('Unbekannt')).toBeNull();
    expect(MATERIALS).toContain('PA / Nylon');
  });

  it('Plätze', () => {
    expect(slotOfTray({ amsId: 0, slotId: 2 })).toBe(3);
    expect(slotOfTray({ amsId: 255, slotId: 0 })).toBe(5);
    expect(slotOfTray({ amsId: 128, slotId: 0 })).toBeNull();
    expect(parseSlotEntity(ID.color(2))).toEqual({ slot: 2, field: 'color' });
    expect(parseSlotEntity(ID.grams(5))).toEqual({ slot: 5, field: 'grams' });
    expect(parseSlotEntity(ID.material(1))).toEqual({ slot: 1, field: 'material' });
    expect(parseSlotEntity('input_number.filamenthub_slot_6_gramm')).toBeNull();
    expect(parseSlotEntity('input_number.fremd_slot_1_gramm')).toBeNull();
  });

  it('Theme: Name passt, Karten durchsichtig', () => {
    expect(THEME_YAML).toContain(`${THEME}:`);
    expect(THEME_YAML).toContain('ha-card-background: "rgba(255,255,255,0.07)"');
  });
});
