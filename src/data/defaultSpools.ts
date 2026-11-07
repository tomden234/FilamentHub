import {
  AppSettings,
  MaterialType,
  Spool
} from '../types/filament';

interface MaterialPreset {
  intervalDays: number;
  temp: number;
  hours: number;
}

export const MATERIAL_PRESETS: Record<MaterialType, MaterialPreset> = {
  'PLA': { intervalDays: 30, temp: 50, hours: 5 },
  'PLA+': { intervalDays: 28, temp: 50, hours: 5 },
  'PETG': { intervalDays: 21, temp: 65, hours: 6 },
  'TPU': { intervalDays: 14, temp: 55, hours: 6 },
  'ABS': { intervalDays: 21, temp: 70, hours: 6 },
  'ASA': { intervalDays: 21, temp: 70, hours: 6 },
  'PA / Nylon': { intervalDays: 7, temp: 80, hours: 8 },
  'PC': { intervalDays: 10, temp: 80, hours: 8 },
  'PET-CF / PA-CF': { intervalDays: 10, temp: 80, hours: 8 }
};

interface BrandInfo {
  keys: string[];
  name: string;
  tara: number;
  defaultPrice: number;
  shopName: string;
  shopType: 'bambu' | 'sunlu' | 'amazon';
}

export const BRAND_DATABASE: BrandInfo[] = [
  { keys: ['bambulab', 'bambu'], name: 'Bambu Lab', tara: 250, defaultPrice: 19.99, shopName: 'Bambu Lab EU Store (1–3 Tage DE)', shopType: 'bambu' },
  { keys: ['sunlu', 'sunluu'], name: 'SUNLU', tara: 190, defaultPrice: 14.99, shopName: 'SUNLU Official Store (1–3 Tage EU)', shopType: 'sunlu' },
  { keys: ['prusament', 'prusa'], name: 'Prusament', tara: 200, defaultPrice: 29.99, shopName: 'Amazon.de / Prusa (2–3 Tage)', shopType: 'amazon' },
  { keys: ['elegoo'], name: 'ELEGOO', tara: 160, defaultPrice: 15.99, shopName: 'Amazon.de Prime (1–2 Tage)', shopType: 'amazon' },
  { keys: ['eryone'], name: 'Eryone', tara: 151, defaultPrice: 18.99, shopName: 'Amazon.de Prime (1–2 Tage)', shopType: 'amazon' },
  { keys: ['polymaker', 'polier', 'yx polier'], name: 'Polymaker', tara: 220, defaultPrice: 24.99, shopName: 'Amazon.de Prime (1–2 Tage)', shopType: 'amazon' },
  { keys: ['overture'], name: 'Overture', tara: 147, defaultPrice: 19.99, shopName: 'Amazon.de Prime (1–2 Tage)', shopType: 'amazon' },
  { keys: ['eono'], name: 'Eono', tara: 150, defaultPrice: 17.99, shopName: 'Amazon.de Prime (1–2 Tage)', shopType: 'amazon' },
  { keys: ['esun'], name: 'eSUN', tara: 210, defaultPrice: 18.99, shopName: 'Amazon.de Prime (1–2 Tage)', shopType: 'amazon' },
  { keys: ['extrudr'], name: 'Extrudr', tara: 220, defaultPrice: 26.99, shopName: 'Amazon.de Prime (1–2 Tage)', shopType: 'amazon' },
  { keys: ['geeetech', 'getech'], name: 'Geeetech', tara: 195, defaultPrice: 16.99, shopName: 'Amazon.de Prime (1–2 Tage)', shopType: 'amazon' },
  { keys: ['isan', 'isanmate'], name: 'Isan', tara: 210, defaultPrice: 17.99, shopName: 'Amazon.de Prime (1–2 Tage)', shopType: 'amazon' },
  { keys: ['anycubic'], name: 'Anycubic', tara: 190, defaultPrice: 16.49, shopName: 'Amazon.de Prime (1–2 Tage)', shopType: 'amazon' },
  { keys: ['creality'], name: 'Creality', tara: 180, defaultPrice: 16.99, shopName: 'Amazon.de Prime (1–2 Tage)', shopType: 'amazon' },
  { keys: ['3djake'], name: '3DJake', tara: 200, defaultPrice: 21.99, shopName: 'Amazon.de / 3DJake (1–2 Tage)', shopType: 'amazon' },
  { keys: ['no-name', 'china'], name: 'No-Name (China)', tara: 130, defaultPrice: 12.99, shopName: 'Amazon.de Prime (1–2 Tage)', shopType: 'amazon' }
];

export const COLOR_MAP = [
  { keys: ['marmor', 'marble'], name: 'Marmor', hex: '#e2e8f0' },
  { keys: ['dunkelgrün', 'dark green', 'forest', 'pine'], name: 'Dunkelgrün', hex: '#166534' },
  { keys: ['hellgrün', 'light green', 'lime', 'bambu green', 'grün', 'green'], name: 'Hellgrün', hex: '#4ade80' },
  { keys: ['galaxy black', 'galaxy'], name: 'Galaxy Black', hex: '#18181b' },
  { keys: ['schwarz', 'black', 'charcoal', 'anthrazit'], name: 'Schwarz', hex: '#18181b' },
  { keys: ['weiß', 'weiss', 'white', 'ivory', 'jade white'], name: 'Weiß', hex: '#f8fafc' },
  { keys: ['durchsichtig', 'transparent', 'clear', 'translucent'], name: 'Durchsichtig', hex: '#cbd5e1' },
  { keys: ['glow', 'leuchtblau', 'luminous'], name: 'Glow Blau', hex: '#38bdf8' },
  { keys: ['blau', 'blue', 'cyan', 'navy'], name: 'Blau', hex: '#3b82f6' },
  { keys: ['rot', 'red', 'crimson', 'scarlet'], name: 'Rot', hex: '#ef4444' },
  { keys: ['gold', 'gelb', 'yellow', 'silk gold'], name: 'Gold', hex: '#eab308' },
  { keys: ['orange', 'mandarin', 'amber'], name: 'Orange', hex: '#f97316' },
  { keys: ['holz', 'wood', 'braun', 'brown', 'walnut'], name: 'Holz / Braun', hex: '#a16207' },
  { keys: ['grau', 'grey', 'gray', 'silber', 'silver'], name: 'Grau / Silber', hex: '#94a3b8' },
  { keys: ['lila', 'purple', 'violet', 'magenta'], name: 'Lila', hex: '#a855f7' }
];

export const KNOWN_ASIN_DB: Record<string, Partial<Spool>> = {
  'B0CM6C7W84': {
    brand: 'ELEGOO',
    material: 'PLA',
    colorName: 'Marmor',
    colorHex: '#e2e8f0',
    name: 'PLA Filament 1.75mm Marmor 1kg',
    emptySpoolWeight: 160,
    pricePerKg: 16.99
  }
};

export const DEFAULT_21_SPOOLS: Spool[] = [
  { id: 'sp-1', brand: 'Bambu Lab', name: 'PETG Basic Weiß', material: 'PETG', colorName: 'Weiß', colorHex: '#f8fafc', initialWeight: 1000, remainingWeight: 891, emptySpoolWeight: 250, pricePerKg: 19.99, storageNote: 'Im Eibos Beutel mit Spule', lastDried: '2026-10-19T00:00:00.000Z', dryIntervalDays: 21, dryTemp: 65, dryHours: 6 },
  { id: 'sp-2', brand: 'Bambu Lab', name: 'PLA Basic Dunkelgrün', material: 'PLA', colorName: 'Dunkelgrün', colorHex: '#166534', initialWeight: 1000, remainingWeight: 476, emptySpoolWeight: 250, pricePerKg: 19.99, storageNote: 'Mit Spule im Eibos Beutel', lastDried: '2026-10-19T00:00:00.000Z', dryIntervalDays: 30, dryTemp: 50, dryHours: 5 },
  { id: 'sp-3', brand: 'Bambu Lab', name: 'PLA Basic Hellgrün (Eigene 50g Spule)', material: 'PLA', colorName: 'Hellgrün', colorHex: '#4ade80', initialWeight: 1200, remainingWeight: 1200, emptySpoolWeight: 50, pricePerKg: 19.99, storageNote: 'Gedruckte 50g Spule im Eibos Beutel', lastDried: '2026-10-04T00:00:00.000Z', dryIntervalDays: 15, dryTemp: 50, dryHours: 5 },
  { id: 'sp-4', brand: 'Bambu Lab', name: 'PLA Basic Weiß (Refill Verschweißt 1)', material: 'PLA', colorName: 'Weiß', colorHex: '#f8fafc', initialWeight: 1000, remainingWeight: 1000, emptySpoolWeight: 0, pricePerKg: 16.99, storageNote: 'Original verschweißt ohne Spule', lastDried: '2026-10-19T00:00:00.000Z', dryIntervalDays: 30, dryTemp: 50, dryHours: 5 },
  { id: 'sp-5', brand: 'Bambu Lab', name: 'PLA Basic Weiß (Refill Verschweißt 2)', material: 'PLA', colorName: 'Weiß', colorHex: '#f8fafc', initialWeight: 1000, remainingWeight: 1000, emptySpoolWeight: 0, pricePerKg: 16.99, storageNote: 'Original verschweißt ohne Spule', lastDried: '2026-10-19T00:00:00.000Z', dryIntervalDays: 30, dryTemp: 50, dryHours: 5 },
  { id: 'sp-6', brand: 'Bambu Lab', name: 'PLA Basic Weiß (Mit Spule Eingeschweißt)', material: 'PLA', colorName: 'Weiß', colorHex: '#f8fafc', initialWeight: 1000, remainingWeight: 1000, emptySpoolWeight: 250, pricePerKg: 19.99, storageNote: 'Original verpackt mit Spule', lastDried: '2026-10-19T00:00:00.000Z', dryIntervalDays: 30, dryTemp: 50, dryHours: 5 },
  { id: 'sp-7', brand: 'Eryone', name: 'PLA Standard Durchsichtig', material: 'PLA', colorName: 'Durchsichtig', colorHex: '#cbd5e1', initialWeight: 1000, remainingWeight: 970, emptySpoolWeight: 151, pricePerKg: 18.99, storageNote: 'Ohne Beutel – dringend trocknen!', lastDried: '2026-09-01T00:00:00.000Z', dryIntervalDays: 14, dryTemp: 50, dryHours: 5 },
  { id: 'sp-8', brand: 'Eryone', name: 'PLA Glow in the Dark Blau', material: 'PLA', colorName: 'Glow Blau', colorHex: '#38bdf8', initialWeight: 1000, remainingWeight: 957, emptySpoolWeight: 151, pricePerKg: 21.99, storageNote: 'Ohne Beutel – sofort trocknen!', lastDried: '2026-09-01T00:00:00.000Z', dryIntervalDays: 7, dryTemp: 50, dryHours: 5 },
  { id: 'sp-9', brand: 'Prusament', name: 'PETG Galaxy Black', material: 'PETG', colorName: 'Galaxy Black', colorHex: '#18181b', initialWeight: 1000, remainingWeight: 1000, emptySpoolWeight: 200, pricePerKg: 29.99, storageNote: 'Im Eibos Beutel mit Prusa Spule', lastDried: '2026-10-04T00:00:00.000Z', dryIntervalDays: 15, dryTemp: 65, dryHours: 6 },
  { id: 'sp-10', brand: 'Bambu Lab', name: 'PLA Basic Schwarz', material: 'PLA', colorName: 'Schwarz', colorHex: '#18181b', initialWeight: 1000, remainingWeight: 800, emptySpoolWeight: 250, pricePerKg: 19.99, storageNote: 'Mit Spule im Eibos Beutel', lastDried: '2026-10-04T00:00:00.000Z', dryIntervalDays: 15, dryTemp: 50, dryHours: 5 },
  { id: 'sp-11', brand: 'Prusament', name: 'PLA Galaxy Black', material: 'PLA', colorName: 'Galaxy Black', colorHex: '#18181b', initialWeight: 1000, remainingWeight: 619, emptySpoolWeight: 200, pricePerKg: 29.99, storageNote: 'Mit Prusa Spule im Eibos Beutel', lastDried: '2026-10-19T00:00:00.000Z', dryIntervalDays: 30, dryTemp: 50, dryHours: 5 },
  { id: 'sp-12', brand: 'Polymaker', name: 'PA6-CF Nylon (YX Polier)', material: 'PA / Nylon', colorName: 'Schwarz', colorHex: '#27272a', initialWeight: 1000, remainingWeight: 980, emptySpoolWeight: 220, pricePerKg: 39.99, storageNote: 'Im Eibos Beutel, frisch getrocknet', lastDried: '2026-10-19T00:00:00.000Z', dryIntervalDays: 7, dryTemp: 80, dryHours: 8 },
  { id: 'sp-13', brand: 'Eono', name: 'Silk PLA Rot', material: 'PLA', colorName: 'Rot', colorHex: '#ef4444', initialWeight: 1000, remainingWeight: 880, emptySpoolWeight: 150, pricePerKg: 17.99, storageNote: 'Im Eibos Beutel auf Pappspule', lastDried: '2026-10-19T00:00:00.000Z', dryIntervalDays: 30, dryTemp: 50, dryHours: 5 },
  { id: 'sp-14', brand: 'Eono', name: 'Silk PLA Gold', material: 'PLA', colorName: 'Gold', colorHex: '#eab308', initialWeight: 1000, remainingWeight: 880, emptySpoolWeight: 150, pricePerKg: 17.99, storageNote: 'Im Eibos Beutel auf Pappspule', lastDried: '2026-10-19T00:00:00.000Z', dryIntervalDays: 30, dryTemp: 50, dryHours: 5 },
  { id: 'sp-15', brand: 'Eono', name: 'Silk PLA Blau', material: 'PLA', colorName: 'Blau', colorHex: '#3b82f6', initialWeight: 1000, remainingWeight: 880, emptySpoolWeight: 150, pricePerKg: 17.99, storageNote: 'Im Eibos Beutel auf Pappspule', lastDried: '2026-10-19T00:00:00.000Z', dryIntervalDays: 30, dryTemp: 50, dryHours: 5 },
  { id: 'sp-16', brand: 'ELEGOO', name: 'PLA Weiß', material: 'PLA', colorName: 'Weiß', colorHex: '#f8fafc', initialWeight: 1000, remainingWeight: 770, emptySpoolWeight: 160, pricePerKg: 14.99, storageNote: 'Im Eibos Beutel mit Elegoo Spule', lastDried: '2026-10-19T00:00:00.000Z', dryIntervalDays: 30, dryTemp: 50, dryHours: 5 },
  { id: 'sp-17', brand: 'Overture', name: 'TPU Schwarz', material: 'TPU', colorName: 'Schwarz', colorHex: '#18181b', initialWeight: 1000, remainingWeight: 941, emptySpoolWeight: 147, pricePerKg: 21.99, storageNote: 'Ohne Beutel (1088g Brutto - 147g Spule)', lastDried: '2026-10-19T00:00:00.000Z', dryIntervalDays: 14, dryTemp: 55, dryHours: 6 },
  { id: 'sp-18', brand: 'ELEGOO', name: 'Color Marble PLA', material: 'PLA', colorName: 'Marmor', colorHex: '#e2e8f0', initialWeight: 1000, remainingWeight: 147, emptySpoolWeight: 160, pricePerKg: 16.99, storageNote: 'Pappspule (307g Brutto - 160g Spule)', lastDried: '2026-10-19T00:00:00.000Z', dryIntervalDays: 30, dryTemp: 50, dryHours: 5, productUrl: 'https://www.amazon.de/dp/B0CM6C7W84' },
  { id: 'sp-19', brand: 'Isan', name: 'PLA Plus Dunkelgrün', material: 'PLA+', colorName: 'Dunkelgrün', colorHex: '#166534', initialWeight: 1000, remainingWeight: 740, emptySpoolWeight: 210, pricePerKg: 17.99, storageNote: 'Ohne Beutel (950g Brutto - 210g Spule)', lastDried: '2026-10-19T00:00:00.000Z', dryIntervalDays: 30, dryTemp: 50, dryHours: 5 },
  { id: 'sp-20', brand: 'Geeetech', name: 'Color Wood PLA', material: 'PLA', colorName: 'Holz / Braun', colorHex: '#a16207', initialWeight: 1000, remainingWeight: 505, emptySpoolWeight: 195, pricePerKg: 18.99, storageNote: 'Ohne Beutel (700g Brutto - 195g Spule)', lastDried: '2026-10-19T00:00:00.000Z', dryIntervalDays: 30, dryTemp: 50, dryHours: 5 },
  { id: 'sp-21', brand: 'No-Name (China)', name: 'PLA Schwarz', material: 'PLA', colorName: 'Schwarz', colorHex: '#18181b', initialWeight: 1000, remainingWeight: 803, emptySpoolWeight: 130, pricePerKg: 12.99, storageNote: 'Plastikspule (933g Brutto - 130g Spule)', lastDried: '2026-10-04T00:00:00.000Z', dryIntervalDays: 15, dryTemp: 50, dryHours: 5 }
];

export const DEFAULT_APP_SETTINGS: AppSettings = {
  materialPresets: {
    'PLA': { intervalDays: 30, temp: 50, hours: 5 },
    'PLA+': { intervalDays: 28, temp: 50, hours: 5 },
    'PETG': { intervalDays: 21, temp: 65, hours: 6 },
    'TPU': { intervalDays: 14, temp: 55, hours: 6 },
    'ABS': { intervalDays: 21, temp: 70, hours: 6 },
    'ASA': { intervalDays: 21, temp: 70, hours: 6 },
    'PA / Nylon': { intervalDays: 7, temp: 80, hours: 8 },
    'PC': { intervalDays: 10, temp: 80, hours: 8 },
    'PET-CF / PA-CF': { intervalDays: 10, temp: 80, hours: 8 }
  },
  brandPresets: {
    'Bambu Lab': { tara: 250, defaultPrice: 19.99 },
    'SUNLU': { tara: 190, defaultPrice: 14.99 },
    'Prusament': { tara: 200, defaultPrice: 29.99 },
    'ELEGOO': { tara: 160, defaultPrice: 15.99 },
    'Eryone': { tara: 151, defaultPrice: 18.99 },
    'Polymaker': { tara: 220, defaultPrice: 24.99 },
    'Overture': { tara: 147, defaultPrice: 19.99 },
    'Eono': { tara: 150, defaultPrice: 17.99 },
    'eSUN': { tara: 210, defaultPrice: 18.99 },
    'Extrudr': { tara: 220, defaultPrice: 26.99 },
    'Geeetech': { tara: 195, defaultPrice: 16.99 },
    'Isan': { tara: 210, defaultPrice: 17.99 },
    'Anycubic': { tara: 190, defaultPrice: 16.49 },
    'Creality': { tara: 180, defaultPrice: 16.99 },
    '3DJake': { tara: 200, defaultPrice: 21.99 },
    'No-Name (China)': { tara: 130, defaultPrice: 12.99 }
  },
  eibosBagTara: 35,
  silicaBagTara: 57,
  cardSize: 340
};
