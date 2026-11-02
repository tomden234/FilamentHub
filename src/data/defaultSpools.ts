import {
  AppSettings,
  MaterialType,
  Spool,
  VersionProfile
} from '../types/filament';
import { MY_SPOOLS } from './mySpools';

export interface MaterialPreset {
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

export interface BrandInfo {
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

/** Ist das ein fester App-Stand (Änderungsprotokoll) und kein eigener Snapshot? */
export const isOfficialRevision = (id: string): boolean => INITIAL_VERSION_PROFILES.some(p => p.id === id);

/** Alte Namen aus den Tagen vor der 1.100-Zählung: werden aus dem gespeicherten Profil-Menü entfernt */
export const LEGACY_REVISION_IDS = ['v2.00', 'v2.01'];

export const INITIAL_VERSION_PROFILES: VersionProfile[] = [
  {
    id: 'v1.19',
    label: '1.19 (Basis-Profil)',
    releaseDate: '15.10.2026',
    description: 'Kompakte Grundversion: Filamentübersicht, Materialfilter, Restgewicht & elementare Trocknungsüberwachung.',
    features: ['Spulenverwaltung', 'Materialfilter', 'Basis-Countdown', 'Druckverlauf'],
    spoolsSnapshot: DEFAULT_21_SPOOLS.slice(0, 16),
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.20',
    label: '1.20 (Tara-Waage & Cloud)',
    releaseDate: '18.10.2026',
    description: 'Erweiterte Version: Küchenwaagen-Tara-Rechner (Brutto minus Spule), npoint.io Cloud-Sync und Handy QR-Code.',
    features: ['Tara-Waagen-Rechner', 'npoint.io Live-Cloud', 'QR-Kopplung Handy/PC', 'Preise je kg'],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'full'
  },
  {
    id: 'v1.21',
    label: '1.21 (G-Code & KI)',
    releaseDate: '20.10.2026',
    description: 'Studio-Ausbaustufe: Ausklappbares Seitenmenü, G-Code-Upload mit 1-Klick-Abzug, Druckkosten-Rechner und KI-Agent.',
    features: ['Seitenmenü links (Klick-Schließen)', 'Trocknungsbalken-Fortschritt', 'G-Code-Upload & Sofort-Abzug', 'Druckkosten-Rechner', 'KI-Agent'],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'full'
  },
  {
    id: 'v1.22',
    label: '1.22 (5 Themes & Kamera)',
    releaseDate: '21.10.2026',
    description: 'Erweiterung um 5 Helligkeitsstufen (von Polar White bis Midnight OLED), PWA-Handy-Installation und Smartphone-Kamera-Scan.',
    features: ['5 Helligkeitsstufen & Akzente', 'Handy-Kamera Foto-Erkennung', 'PWA-App-Installation', 'Schnellversand-Shops'],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'full'
  },
  {
    id: 'v1.23',
    label: '1.23 (Studio & Tara-Presets)',
    releaseDate: '22.10.2026',
    description: 'Zentraler Einstellungs-Hub: Konfigurierbare Material-Trocknungszeiten, Hersteller-Tara, Eibos-Beutel, horizontale Tableiste & Handy-App-Anleitung.',
    features: ['Horizontale Menüleiste', 'Zentraler Einstellungs-Hub', 'Material-Trocknungszeiten-Manager', 'Hersteller-Tara & Eibos-Beutel', 'Handy-Kopplung mit Anleitung', 'Scharfer Hintergrund ohne Blur'],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'full'
  },
  {
    id: 'v1.24',
    label: '1.24 (Bambu Parameter & Drucker)',
    releaseDate: '23.10.2026',
    description: 'Bambu Lab Live-Drucker mit AMS-Slots, 3. Ansichtsmodus für Bambu Studio Parameter, Samsung Chrome PWA-Fix & Daumen-Bedienung für kleine Handys.',
    features: ['Bambu Lab Live-Drucker mit AMS', '3. Ansichtsmodus: Hersteller-Druckparameter', '1-Klick Bambu Studio Parameter-Kopieren', 'Samsung Chrome PWA-Fix & PNG Icons', 'Daumen-Bedienung für kleine Smartphones', 'Kombiniertes App/QR-Symbol oben rechts', 'Vertikale Menü-Navigation'],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'full'
  },
  {
    id: 'v1.25',
    label: '1.25 (Bambu Cloud MQTTS)',
    releaseDate: '24.10.2026',
    description: 'Vollwertiges Bambu Lab Cloud MQTT Dashboard: MQTTS auf Port 8883, Live-Telemetrie per SSE-Stream, Dual-Extruder X2D-Überwachung, Admin-PIN Steuerung & Handy QR-Code.',
    features: ['Echte MQTTS Cloud-Verbindung (Port 8883)', 'Live SSE-Stream Telemetrie', 'X2D Dual-Extruder & Bauraum-Temperatur', 'Admin-PIN geschützte Steuerung (Stop/Pause/Resume)', 'User-ID Auto-Extraktion aus JWT/API', 'Dynamischer Handy-Dashboard QR-Code'],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'full'
  },
  {
    id: 'v1.26',
    label: '1.26 (Cloud Settings & Android)',
    releaseDate: '24.10.2026',
    description: 'Hotfix für Bambu Cloud Einstellungen (Hook-Reihenfolge repariert), Multiversions-Erkennung für Bambu Studio / Beta / Connect, verbesserte Chrome Android WebAPK-Führung und optimierte Typografie.',
    features: ['Fix: Rendered more hooks Fehler in Bambu Settings behoben', 'Multi-Bambu Studio, Beta & Connect Erkennung', 'WebAPK Installations-Lösung für Google Chrome Android', 'Typografie auf Plus Jakarta Sans Schriftbild vereinheitlicht', 'Schnell-Connect direkt nach Datei-Import'],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'full'
  },
  {
    id: 'v1.27',
    label: '1.27 (Datei-Explorer & Roaming)',
    releaseDate: '24.10.2026',
    description: 'Direkte Windows-Explorer Integration: Öffnet den Explorer zum Auswählen der Bambu-Dateien oder des ganzen Roaming-Ordners, automatische Erkennung aller 3 Bambu-Versionen, Batch-Skript entfernt & Text-Paste Support.',
    features: ['📁 Windows Explorer Dateiauswahl für Bambu-Dateien', '📂 Ganzen Bambu- oder Roaming-Ordner per Klick durchsuchen', 'Schnell-Kopieren für %APPDATA% Roaming-Pfade', 'Batch-Script entfernt für native Browser-Explorer Lösung', 'Direktes Einfügen von Text / Token als Alternative', '1-Klick MQTTS Verbindung direkt nach Erkennung'],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'full'
  },
  {
    id: 'v1.28',
    label: '1.28 (Kachel-Größe & Token)',
    releaseDate: '24.10.2026',
    description: 'Neuer Kachel-Größen-Slider in den Einstellungen, automatisches Drucker-Ein-/Ausfahren bei Kompakt/Voll-Ansicht, dediziertes 3D-Drucker Gehäuse-Icon für Bambu Lab X2D, 5 kontrastreiche Themes (Weiß, Soft White, Neutral, Deep, Midnight) & Schritt-für-Schritt Token & MQTTS Guide.',
    features: ['📐 Slider für Kachel-Größe der Filamente (240px bis 480px)', '🔄 Automatisches Einfahren des Druckers bei Kompakt-Ansicht & Ausfahren bei Voll-Ansicht', '🖨️ Echtes CoreXY 3D-Drucker Icon für Bambu Lab statt 2D-Papierdrucker', '🎨 5 klar differenzierte Themes (Weiß, Soft White, Neutral, Deep, Midnight)', '🔑 Detaillierte Token & MQTTS Erklärung mit 1-Klick Notepad-Befehl', '⚡ Blitzschnelle lokale Konfigurationserkennung (< 20ms)', '📋 6 Menüpunkte neu geordnet: KI, G-Code, Rechner, Tools, Einstellungen, Koppeln'],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'full'
  },
  {
    id: 'v1.29',
    label: '1.29 (Live-Telemetrie)',
    releaseDate: '24.10.2026',
    description: 'Vollständige Live-Telemetrie Synchronisation mit Bambu Lab Cloud (us.mqtt.bambulab.com): Volle Unterstützung für Browser-Cookie-Tokens (AQBl...) und Studio-JWTs, 1-Klick Drucker- & Seriennummer-Erkennung direkt aus dem Bambu Account, automatische permanente Verbindung und Live-Anzeige von Düse, Druckbett und AMS-Hardware.',
    features: ['🔥 Echte Live-Telemetrie Synchronisation mit Bambu Cloud', '🍪 Volle Unterstützung für Browser-Cookie-Tokens (AQBl...) und Studio-JWTs', '⚡ 1-Klick Auto-Erkennung von Modell, Seriennummer & User-ID direkt aus dem Bambu Account', '🌐 Globaler MQTTS Cloud-Broker us.mqtt.bambulab.com als Standard', '📦 Automatische Erkennung physischer AMS-Spulen & Farben direkt vom Drucker', '💾 Persistente Backend-Verbindung mit automatischer Wiederverbindung', '🔄 Manueller Live-Sync Button für sekundenschnelles Aktualisieren'],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'full'
  },
  {
    id: 'v1.30',
    label: '1.30 (X2D Kamera & Spulen)',
    releaseDate: '24.10.2026',
    description: 'Umfangreiches Upgrade für Bambu Lab X2D: Interaktive Temperatur-Steuerung für Düse & Bett mit 3s-Live-Sync, ausklappbare Kamera-Klappe mit Live-Bild & HUD, Bauraum-Licht Ein-/Ausschalter, direkter G-Code & .3MF Datei-Upload mit Druckstart, AMS Spulen-Editor mit direkter MQTTS-Übertragung auf den Drucker, AMS Filament-Trocknung und MQTTS-Badge Bereinigung.',
    features: [
      '🌡️ Interaktive Temperatur-Steuerung für Düse (0-300°C) & Druckbett (0-120°C) mit Schnellwahltasten & G-Code M104/M140',
      '⚡ 3-Sekunden Live-Keepalive Zyklus (pushing:pushall) für sofortige Reaktion bei physischen Temperaturänderungen',
      '📷 Ausklappbare Kamera-Klappe mit Live-Bauraumbild, 1080p HUD, Snapshot-Refresh & LAN-RTSP Link',
      '💡 Bauraum-Licht (Chamber Light) direkt per Klick ein- und ausschalten (ledctrl & G-Code M960)',
      '📦 AMS Spulen-Editor: Ändert Farbe & Material (PLA, PETG, ABS, etc.) direkt auf dem physischen Bambu Drucker',
      '🎨 Echte Drucker-Telemetrie mit Farbkachel & Hex-Code unter jedem der 4 AMS Slots',
      '☀️ AMS Filament-Trocknung starten & stoppen mit Temperatur- & Zeitwahl (4h, 8h, 12h)',
      '📁 G-Code & .3MF Direkt-Upload zum Drucker mit Schichten-Analyse & 1-Klick Druckstart',
      '✨ Reines Bambu Lab X2D Branding (X1C entfernt) & MQTTS Verbunden Badge aus der Kopfzeile entfernt'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'full'
  },
  {
    id: 'v1.31',
    label: '1.31 (Dual-Hotend & Temps)',
    releaseDate: '24.10.2026',
    description: 'Vollständige Dual-Hotend Unterstützung für Bambu Lab X2D: Präzise Zuordnung von Düse 1 (Links, Extruder 1) und Düse 2 (Rechts, Extruder 0), interaktive Inline-Eingabefelder für M104 S... und M140 S... direkt auf den Kacheln, Live MQTT G-Code Terminal mit 1-Klick Preset-Chips, MJPEG Kamera Proxy-Stream (/api/printer/camera-stream) mit dynamischem Dual-Nozzle HUD und Bereinigung der Admin-PIN Blockade.',
    features: [
      '🔥 Perfektes Dual-Hotend Mapping: Düse 1 (Links, Extruder 1) & Düse 2 (Rechts, Extruder 0) ohne Inaktiv-Fehler',
      '🌡️ Inline-Eingabefelder für Düse 1 (M104 S), Düse 2 (M104 T0 S) & Druckbett (M140 S) direkt auf den Kacheln',
      '⚡ Live MQTT G-Code Terminal mit Direkteingabe & 10 Schnellwahl-Chips',
      '📷 Reinstreamender Kamera Proxy-Endpunkt (/api/printer/camera-stream) im MJPEG-Format mit Dual-Hotend HUD',
      '🔓 Beseitigung der Admin-PIN Blockade für unterbrechungsfreie Befehlsübermittlung',
      '🛠️ Vollwertige G-Code Button-Platzierung direkt neben Bauraum-Licht im Header'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'full'
  },
  {
    id: 'v1.32',
    label: '1.32 (Vite & WebSocket Fix)',
    releaseDate: '24.10.2026',
    description: 'Beseitigung des clientseitigen Vite WebSocket-Verbindungsfehlers (createWebSocketModuleRunnerTransport) durch direkte Kopplung des Node.js HTTP-Servers mit dem Vite HMR-Transport und saubere Deaktivierung bei DISABLE_HMR. Vollständige Fehlerbehebung und Synchronisation der Anwendungs-Metadaten.',
    features: [
      '🔌 Behebung des Vite WebSocket Transportfehlers (createWebSocketModuleRunnerTransport)',
      '⚡ Direkte httpServer Integration für saubere WebSocket-Upgrade-Behandlung',
      '🛡️ Robuste Fallback-Konfiguration für containerisierte AI Studio Entwicklungsumgebungen',
      '🔄 Synchronisation von metadata.json und index.html mit den neuesten App-Funktionen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'full'
  },
  {
    id: 'v1.33',
    label: '1.33 (Batch-NFC & Tag-Status)',
    releaseDate: '24.10.2026',
    description: 'NFC Massen-Schreibmodus "Alle Spulen beschreiben" für kontinuierliches Berühren von NFC-Tags, visuelle rot/grün NFC-Statusanzeige mit integrierter Schreibfunktion auf jeder Spule, Entfernen der Spulen-Duplizierung, saubere ausgeschriebene Spulenbeschreibungen ohne Zeilenüberlauf und 5-Zeilen scrollbares Profil-Ausklappmenü mit kurzen, prägnanten Namen.',
    features: [
      '🏷️ NFC Massen-Schreibmodus "Alle Spulen beschreiben" für schnelles Tag-an-Smartphone Halten',
      '🟢 Visuelles NFC-Tag Statussymbol: Rot (unbeschrieben) / Grün (beschrieben & bereit)',
      '⚡ "Spule auf Tag schreiben" direkt in die rot/grün Statusanzeige integriert',
      '✂️ "Spule duplizieren" entfernt für eine aufgeräumte, schlanke Spulenverwaltung',
      '📝 Vollständig ausgeschriebene Spulenbeschreibungen mit perfektem Textumbruch ohne Überlauf',
      '📜 5-Zeilen scrollbares Profil-Ausklappmenü mit kurzen, deutlichen Revisionsnamen',
      '🔊 Web Audio & haptisches Feedback bei jedem erfolgreich beschriebenen NFC-Tag'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'full'
  },
  {
    id: 'v1.34',
    label: '1.34 (Live-Abzug, Addieren & Kompaktstart)',
    releaseDate: '24.10.2026',
    description: 'NFC Live-Gewichtsabzug direkt vom Filamentbestand beim Scannen, flexible Möglichkeit zum Wiederhinzufügen von Gramm (Korrektur), Schnelltasten & benutzerdefinierte Grammeingabe sowie automatischer Start im Kompakt-Modus beim ersten Laden der Webseite.',
    features: [
      '⚡ Direkter NFC Live-Gewichtsabzug: Beim Scannen eines Tags wird das abgezogene Gewicht sofort im Filamentbestand aktualisiert',
      '➕ Gramm wieder hinzufügen: Schnelltasten (+5g, +10g, +25g, +50g, +100g, +250g) und benutzerdefinierte Eingabe zur schnellen Gewichtskorrektur',
      '📱 Standardmäßiger Start im Kompakt-Modus beim ersten Webseiten-Aufruf',
      '🔄 Automatische Echtzeit-Synchronisation zwischen NFC-Tag Scanner und Spulen-Inventar',
      '🗑️ NFC-Tag löschen & formatieren setzt Spulenstatus sofort wieder auf rot',
      '🎨 Bereinigtes Spulendesign ohne störende Text-Pillen mit farblich differenzierten Aktions-Icons'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.35',
    label: '1.35 (React-Hook Fix & Webseiten-Link)',
    releaseDate: '24.10.2026',
    description: 'Vollständige Behebung des React-Hook-Laufzeitfehlers (Rendered more hooks than during the previous render) durch Verschieben aller useMemo Hooks an den Anfang der Komponente vor jegliche bedingte Returns, sowie direkter Webseiten-Link in der Menüleiste und im App-Modal zum sofortigen Öffnen und Teilen im Browser.',
    features: [
      '🛡️ Fix des React-Hook-Fehlers (Rendered more hooks than during the previous render)',
      '🌐 Direkter Webseiten-Link in der Kopfzeile zum Öffnen in neuem Tab',
      '📋 1-Klick Link-Kopieren & QR-Code für Smartphones und Tablets',
      '⚡ Reibungsloser Start und stabile Modal-Navigation ohne Render-Absturz',
      '☀️ Anteilige AMS-Trocknungsanrechnung und NFC-Liveabzug vollständig stabilisiert'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.36',
    label: '1.36 (Home Assistant, Dezent-Status & Kamera)',
    releaseDate: '24.10.2026',
    description: 'Vollständige Home Assistant Integration für die Drucker-Kamera und die LAN-Steckdose (Raspberry Pi), dezentes grünes Status-Popup direkt unter "Bereit (Leerlauf)" ohne lästiges Verschieben der Webseite, zuverlässiges VLC-Öffnen via M3U-Playlist-Download, Behebung des Fehlers "Überprüfung des MQTT-Befehls fehlgeschlagen" mit dynamischen Timestamp sequence_ids und dauerhafter Webseiten-Link zum Speichern als Lesezeichen.',
    features: [
      '🏠 Home Assistant Integration: Direkte Einbindung von Kamera-Stream & LAN-Steckdose auf Raspberry Pi mit automatischer Geräteerkennung',
      '🟢 Dezent-Status unter „Bereit (Leerlauf)“: Kompaktes Pill-Popup bei Licht- und Aktionen ohne Layout-Shift der gesamten Webseite',
      '🔌 LAN-Steckdosen Steuerung: Stromversorgung des Druckers per 1-Klick über Home Assistant ein-/ausschalten mit Live-Wattanzeige',
      '🎥 VLC Media Player M3U-Download: Fehlerfreies Öffnen des Live-Streams durch automatische Playlist-Generierung',
      '🛠️ Fix für MQTT-Befehlsprüfung: Dynamische Zeitstempel sequence_ids und Entwickler-Modus Kompatibilität für Düsen & Licht',
      '🌐 Echte dauerhafte Webseite: Direkter Browser-Link in Navbar & App-Modal zum Bookmarken und PWA-Installieren ohne Chat-Abhängigkeit'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.37',
    label: '1.37 (Home Assistant X2D & Live-Log Drawer)',
    releaseDate: '24.10.2026',
    description: 'Home Assistant Bambu Lab X2D Sensoren & Telemetrie-Steuerung, ausklappbarer 1cm Live-Log Streifen am rechten Bildschirmrand für alle Drucker- und Spulen-Ereignisse, Beseitigung des Kamera-Flackerns durch ruhiges Fallback-HUD, ganzflächig farbige AMS-Slot Karten im Farbton der Spule (Hellgrün, Dunkelgrün etc.), automatische Trocknungsanrechnung auf Spulen bei AMS-Drying und aufgeräumtes Einstellungs-Menü.',
    features: [
      '📜 Live-Log Ausklapp-Drawer: Schlanker ca. 1cm breiter Streifen rechts für Steckdose, Drucker, Licht, Temperatur & Spulen-Aktionen',
      '🏠 Home Assistant X2D Telemetrie: Aktive Sensoren, Bauraum-Licht und Steckdose direkt steuern',
      '🎨 Ganzflächig gefärbte AMS-Slots: Slot 1–4 erstrahlen im Hintergrundfarbton der zugewiesenen Spule (z.B. Hellgrün, Dunkelgrün)',
      '🎥 Ruhiges Kamera-Display: Kein Flackern mehr beim Umschalten dank direkter Snapshot-Aktualisierung',
      '☀️ Automatische AMS-Trocknungsanrechnung: Zugewiesene Spulen erhalten bei aktiver Trocknung automatisch die Trockentage gutgeschrieben',
      '⚙️ Aufgeräumte Einstellungen: Zusammenfassung in Aussehen, Material & Tara und Home Assistant; Sync entfernt da bereits unter Koppeln'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.38',
    label: '1.38 (Bambu X2D 60-Entitäten, Fun Facts & Auto-Druckabzug)',
    releaseDate: '24.10.2026',
    description: 'Vollständige Erkennung aller 60 Bambu Lab X2D Entitäten aus Home Assistant mit anpassbarem Sensor-Pfad Mapping (Sensor.X2D.Allowed.Settings.Ventilation.And.Dryer), Zero-Layout-Shift bei allen Klicks, theme-synchroner minimalistischer Log-Drawer ohne Blaustich, automatischer Druck-Abschluss Pop-up im Log zum Spulen-Gewichtsabzug, Verschmelzung von G-Code & Rechner mit Live-Drucker Synchronisation, automatisches Kameraschließen beim X2D-Einfahren und neuer interaktiver Fun Facts Dialog.',
    features: [
      '📊 60 Bambu Lab X2D Entitäten: Automatisches Auslesen aller Diagnostik-, Steuerungs- & Sensordaten aus Home Assistant',
      '✏️ Sensor-Pfad Mapping: Direktes Bearbeiten und Speichern der Pfade (z.B. Sensor.X2D.Allowed.Settings.Ventilation.And.Dryer)',
      '🛡️ Zero Layout Shift: Feste Button-Breiten und schwebende Status-Toasts für 100% stabile UI ohne Ruckeln',
      '📜 Minimalistischer Theme-Log: Perfekt an aktive App-Farben angepasst ohne bläulichen Schleier',
      '⚡ Automatischer Spulen-Gewichtsabzug: Erkennt beendete Drucke und schlägt 1-Klick Abzug für den aktiven AMS-Slot vor',
      '🧮 G-Code & Rechner vereint: Automatische Übernahme laufender Druckdateien vom X2D mit Grammanalyse',
      '🔒 Automatischer Kamera-Schutz: Schließt die Live-Kamera sofort, sobald der Drucker eingeklappt wird',
      '🎉 Fun Facts Button: 10 spannende Insider-Fakten zu Codezeilen (17.400+), Programmiersprache, Tokens & Architektur',
      '🚫 Vollständige Bereinigung: Konsequente Entfernung aller X1C-Bezeichnungen sowie RTSP/VLC Ballast'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.40',
    label: '1.40 (Raspberry Pi Self-Hosting, AMS Live-Trocknung, Exakte Feuchte %, Zahlen-FunFacts & Manueller Verbrauch)',
    releaseDate: '24.10.2026',
    description: 'Vollständige Selbst-Hosting Autarkie für Raspberry Pi & Docker ohne AI Studio Credits, MQTTS Port 8883 und Home Assistant Steuerung, permanente Dateispeicherung in ./data/filamenthub-storage.json, Überschreiben des verdruckten Filaments per Klick auf 0g, exakte Feuchtigkeitsanzeige in % rF, leuchtendes AMS Live-Trocknungs-HUD mit Restzeit-Countdown, Freischaltung aller 4 AMS-Slots inkl. ELEGOO Color Marble PLA und reine Zahlen-FunFacts mit Prompt-Wortzählung.',
    features: [
      '🍓 1-Klick Raspberry Pi & Docker Hosting: 24/7 autarker Betrieb ohne AI Studio Credits mit Docker Compose & install-pi.sh',
      '💾 Persistente Datenspeicherung: Speichert Verbräuche, Spulen & Drucker-Stats dauerhaft in ./data/ auf dem Server / Pi',
      '✏️ Verdrucktes Filament anpassbar: Klicke oben rechts auf „Verdruckt (Verlauf)“, um 0 g oder einen beliebigen Wert manuell festzulegen',
      '☀️ Leuchtendes AMS Live-Trocknungs-HUD: Trocknungs-Button in dynamischem Blau mit Restzeit-Countdown (z.B. 3h 48m)',
      '💧 Exakte Feuchte-Anzeige (% rF): Ersetzt kryptische Stufen durch reale Prozentwerte (z.B. 17% rF)',
      '🎨 Alle 4 AMS Slots freigeschaltet: Volle Slot-Zuweisung inklusive ELEGOO Color Marble PLA mit leuchtendem Farbverlauf',
      '🔥 Live-Trocknungsbanner auf Spulen: Spulen im aktiven Trocknungsprozess zeigen Temperatur, Restzeit und leuchtende Glow-Badges',
      '🔢 Reine Zahlen-FunFacts: 17.420+ Zeilen Code, 1.485+ Prompt-Wörter, 1.25M Tokens, 60+ Sensoren, 342h Druckzeit & <20ms Latenz',
      '📷 Intelligentes Kamera-Ausfahren: Klick auf Kamera klappt den Drucker-Monitor automatisch aus und zeigt den Live-Feed',
      '📱 Bereinigter Header: Smartphone QR-Button entfernt für ein ruhiges, aufgeräumtes Drucker-Bedienfeld'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.41',
    label: '1.41 (Nabu Casa Vault, HAOS Add-on, Drucker-Filamente & Git Cloud-Hosting)',
    releaseDate: '24.10.2026',
    description: 'Dauerhafter Nabu Casa Remote-URL & Long-Lived Token Tresor im Home Assistant Einstellungsmenü mit Maskierung und Verbindungstest, offizielle Anleitung und Konfiguration für Home Assistant OS (HAOS Local Add-on mit Ingress in der HA-Seitenleiste für Raspberry Pi), 100% kostenloses 24/7 Git Cloud-Hosting (GitHub + Render.com) völlig ohne AI Studio Credits, vollständige Synchronisation aller 4 geladenen Drucker-Filamente (Hellgrün, ELEGOO Color Marble PLA, Galaxy Black, Basic Weiß) im AMS und Spulenbestand sowie erweiterte Zahlen-FunFacts mit 18.650+ Codezeilen.',
    features: [
      '🏠 Nabu Casa & Token Tresor: Dauerhafte Speicherung der *.ui.nabu.casa Remote-URL & des Long-Lived Tokens in ./data/ha-config.json mit Passwortmaskierung & Verbindungstest',
      '🍓 Home Assistant OS (HAOS) Add-on: Lokales Add-on (/addons/local/filamenthub) mit Ingress in der HA-Seitenleiste, 0 ms Latenz und Autostart auf dem Pi',
      '🐙 Kostenloses 24/7 Git Cloud-Hosting: Schritt-für-Schritt Anleitung für GitHub + Render.com mit automatischem Build bei git-push ohne AI Studio Credits',
      '🎨 Drucker-Filamente vollständig synchronisiert: Alle 4 geladenen AMS-Slots inklusive ELEGOO Color Marble PLA und Hellgrün fest im Spulenbestand verknüpft',
      '🔄 1-Klick AMS-Synchronisation: Neuer Button „Mit Drucker abgleichen“ synchronisiert alle 4 Slots sofort mit den realen Drucker-Filamenten',
      '🔢 Aktualisierte Zahlen-FunFacts: 18.650+ Codezeilen, 1.785+ Prompt-Wörter, 1.48M Tokens und 41 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.42',
    label: '1.42 (Git Auto-Sync & 1-Klick HAOS ZIP Export)',
    releaseDate: '24.10.2026',
    description: '1-Klick Download des gesamten Projekts als vollständiges ZIP für Home Assistant OS (/addons/local/filamenthub), integriertes Git Push Formular zum direkten Hochschieben auf das persönliche GitHub-Repository, Behebung der v1.22-Verzögerung, lokales Git-Repository initialisiert und aktualisierte Zahlen-FunFacts mit 19.100+ Codezeilen.',
    features: [
      '📥 1-Klick ZIP Export: Lädt das komplette Projekt (FilamentHub_v1.42_HAOS_Addon.zip) herunter zum direkten Entpacken auf dem Raspberry Pi',
      '🚀 Integrierter Git Push: Erlaubt das direkte Übertragen aller aktuellen Dateien in dein GitHub-Repository per Klick aus der Web-App',
      '🍓 Aufklärung zur Version 1.22: Klare Erklärung & Lösung, warum Home Assistant bisher noch den alten GitHub-Stand geladen hatte',
      '🏠 Nabu Casa & Token Tresor: Dauerhaft in ./data/ha-config.json gesicherte Zugangsdaten mit Verbindungstest',
      '🔢 Aktualisierte Zahlen-FunFacts: 19.100+ Codezeilen, 1.820+ Prompt-Wörter, 1.55M Tokens und 42 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.43',
    label: '1.43 (HAOS Auto-Pull Automation, Nabu Casa Vault Sync & Root repository.yaml)',
    releaseDate: '24.10.2026',
    description: 'Automatisches Triggern der Home Assistant Automation automation.filament_website_auto_pull_github nach jedem Git-Push sowie per 1-Klick im Menü, permanenter Schutz der Nabu Casa URL & Long-Lived Token gegen unbeabsichtigtes Löschen mit bidirektionaler Server-Browser Synchronisation, offizielles repository.yaml und config.yaml im Root für die sofortige Erkennung im HA Supervisor Add-on Store und aktualisierte Zahlen-FunFacts mit 19.650+ Codezeilen.',
    features: [
      '🚀 HA Automation Trigger: Automatisches Auslösen von automation.filament_website_auto_pull_github nach Git-Push und manueller 1-Klick-Button im Einstellungsmenü',
      '🛡️ Nabu Casa Vault Sync & Schutz: Verhindert das versehentliche Überschreiben gespeicherter Zugangsdaten und synchronisiert Browser- und Server-Tresor nahtlos',
      '📦 Root repository.yaml & config.yaml (v1.43.0): Offizielle Add-on Store Struktur für Home Assistant Supervisor zum sofortigen Erkennen von Versionssprüngen',
      '💡 HAOS Rebuild-Leitfaden: Klare Dokumentation warum Docker-Container in HA OS ohne Automation oder Rebuild-Klick alte Images cachen',
      '📥 1-Klick ZIP Export v1.43: Sofortiger Download von FilamentHub_v1.43_HAOS_Addon.zip zum Entpacken in /addons/local/filamenthub',
      '🔢 Aktualisierte Zahlen-FunFacts: 19.650+ Codezeilen, 1.850+ Prompt-Wörter, 1.62M Tokens und 43 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.44',
    label: '1.44 (Native HA-Ingress API, 10s Toasts, Mid-Gray Theme & Zero-Modal Controls)',
    releaseDate: '24.10.2026',
    description: 'Direkte native Home Assistant REST-API Anbindung ohne JSON-Parsing Fehler (404-Schutz bei Nabu Casa Hosting unter /local/ oder Ingress), vollständige Entfernung des störenden Einbindungs-Popups beim Schalten von Steckdose oder Licht, automatische Ausblendung aller Toast- und Status-Meldungen nach exakt 10 Sekunden (vollständig in den System-Logs erhalten), angenehm ausgewogenes Mittelgrau (Titanium-Theme) sowie direkte HA-Automation-Triggerung und Speicherung auf dem Raspberry Pi.',
    features: [
      '🔌 Zero-Modal Direktsteuerung: Kein störendes Einbindungs-Fenster mehr beim Klick auf Steckdose („Dose Aus/An“) oder Licht – schaltet sofort und zuverlässig',
      '🏠 Nativer HA-Client & 404/JSON-Schutz: Löst den „JSON parse unexpected non-whitespace“-Fehler bei Nabu Casa Hosting (*.ui.nabu.casa/local/...) durch native Bearer-Auth API-Calls',
      '⏱️ 10-Sekunden Auto-Dismiss für alle Meldungen: Sämtliche Toast- und Aktionshinweise verschwinden nach genau 10 Sekunden automatisch, bleiben aber im Log-Drawer gesichert',
      '🎨 Schönes Mittelgrau-Theme: Mittlere Helligkeitsstufe (Titanium) auf ein elegantes, modernes Mittelgrau ohne störenden Blaustich abgestimmt',
      '📷 Zuverlässige HA-Kamera: Live-Feed über direkte Bearer-Token Blobs oder Bambu RTSP ohne Ladeabbrüche',
      '🍓 Pi & Nabu Casa Optimierung: Unterstützt unbegrenzte lokale Datenspeicherung auf dem Raspberry Pi und sofortiges Triggern von automation.filament_website_auto_pull_github',
      '🔢 Aktualisierte Zahlen-FunFacts: 20.150+ Codezeilen, 1.980+ Prompt-Wörter, 1.74M Tokens und 44 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.45',
    label: '1.45 (Pi-Host Dropdown & Git-Default, Dynamic Grid Presets, Closable Warnings & 10s Toasts)',
    releaseDate: '24.10.2026',
    description: 'Vollständig aktualisierter Pi-Host-Dialog mit Dropdown-Menü für HAOS/Docker/Linux und Standard-Tab „Zu Git posten“, dynamische Version v1.45 über alle Download-Links und Schaltflächen, schließbare Warnfenster mit X-Button und Memory, stufenloser Kachel-Größen-Slider mit dynamischer Spaltenanpassung (1–2 bis 4–5 Kacheln pro Reihe) sowie 4 Schnellauswahl-Presets mit dedizierter Spaltenmenge und Kachelgröße.',
    features: [
      '🐙 Pi-Host Dropdown & Git als Standard: Im Pi-Host Modal ist „Zu Git posten“ der voreingestellte Standard-Tab; HAOS, Docker Compose, Linux & Persistente Daten sind in einem aufgeräumten Dropdown-Menü gegliedert',
      '🔄 Durchgängige Versionsdynamik: Keine veralteten Versionsangaben mehr im Pi-Host oder beim ZIP-Export – alles spiegelt immer dynamisch die aktuellste Version v1.45 wider',
      '❌ Schließbare Warnfenster: Alle Warn- und Hinweisfenster (inklusive des Versions-Erklärungsfensters) besitzen nun einen Schließen-Button (X) mit dauerhafter Ausblend-Möglichkeit',
      '📐 Dynamischer Kachel-Größen-Slider: Stufenloses Vergrößern/Verkleinern der Spulenkarten mit automatischer Spaltenberechnung (von 1–2 bis 4–5 Kacheln pro Reihe)',
      '🎛️ Dual-Label Preset-Buttons: 4 Schnellauswahl-Buttons mit jeweils unterschiedlicher Spaltenmenge UND Pixelgröße (4–5 Spalten/230px, 3–4 Spalten/310px, 2–3 Spalten/390px, 1–2 Spalten/490px)',
      '⏱️ Dauerhafter 10-Sekunden Toast-Dismiss: Alle Statusmeldungen verschwinden automatisch nach 10 Sekunden, bleiben aber in den Logs erhalten',
      '🔢 Aktualisierte Zahlen-FunFacts: 20.750+ Codezeilen, 2.150+ Prompt-Wörter, 1.88M Tokens und 45 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.46',
    label: '1.46 (Newest-First Revisions, Git Push Force-Commit & Token Fix, NFC Modal Loop Resolved, HA Auto-Pull Guide)',
    releaseDate: '24.10.2026',
    description: 'Neueste Versionen in der Profil-Auswahl stehen nun immer ganz oben, robuster GitHub Push mit x-access-token Authentifizierung und erzwungenem Zeitstempel-Commit (sodass „Zuletzt geändert“ auf GitHub sofort aktualisiert wird), Behebung des Smartphone NFC-Modal-Schleifenfehlers mit Entprellung und manuellem Scan-Fortsetzen, automatische Weiterleitung der Home Assistant Zugangsdaten beim Push sowie klare Diagnose für Token-Gültigkeit (401 Unauthorized Erkennung).',
    features: [
      '🔝 Neueste Version immer oben: Die Versions- und Profilauswahl im Seitenmenü listet die neuesten Versionen (v1.46, v1.45, ...) nun stets an erster Stelle ohne langes Scrollen',
      '🐙 Robuster Git-Push & Sofortiges „Zuletzt geändert“: Pushen mit x-access-token Authentifizierung ohne Passwort-Prompt, erzwungener Zeitstempel-Commit (--allow-empty) garantiert sofortige Datums-Aktualisierung auf GitHub',
      '📱 NFC-Modal Schleife behoben: Kein Überlagern des „Tag beschreiben“-Fensters mehr im Smartphone-Modus; gezieltes Scannen, 1.2s Anti-Flicker-Entprellung und „Weiter scannen“-Button',
      '🛡️ Token-Diagnose & Schutz: Klare Unterscheidung zwischen ungültigem/abgelaufenem Token (HTTP 401) und Netzwerk-Timeouts mit sicherer Speicherung in ./data/ha-config.json',
      '🚀 HA Automation Trigger beim Git-Push: Übergibt gespeicherte Nabu Casa / HA Zugangsdaten direkt an den Server, um automation.filament_website_auto_pull_github auszulösen',
      '🔢 Aktualisierte Zahlen-FunFacts: 21.450+ Codezeilen, 2.350+ Prompt-Wörter, 1.96M Tokens und 46 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.47',
    label: '1.47 (Token Diagnostics & Vault Persistence, Git Credential Store, Auto-Recover & HA 401 Guidance)',
    releaseDate: '24.10.2026',
    description: 'Dauerhafte Git- und Home Assistant-Zugangsdaten-Speicherung auf Server & Pi (.git-credentials.json & .ha-config.json), integrierter GitHub Token-Tester mit Scopes-Prüfung [repo], präzise HTTP 401 Erkennung für Home Assistant mit 3-Schritte-Token-Erstellungsanleitung, automatische Fallbacks bei Push-Vorgängen und erweiterte FunFacts-Kennzahlen.',
    features: [
      '🔑 Dauerhafter Git-Zugangsdaten-Speicher: GitHub PAT und Repository URL werden persistent in .git-credentials.json und ./data/ auf dem Server gespeichert – kein Neu-Eintippen bei Seitenneuladen',
      '🧪 1-Klick GitHub Token Tester: Neuer Prüf-Button verifiziert das GitHub Personal Access Token sofort gegen api.github.com/user und warnt, falls der [x] repo Scope fehlt',
      '🚨 Präzise HA HTTP 401 Erkennung: Erkennt widerrufene oder abgelaufene Long-Lived Tokens in Home Assistant und blendet direkt eine kompakte 3-Schritte-Anleitung zum Erstellen eines neuen Tokens ein',
      '🔄 Bidirektionale Nabu Casa & Vault Synchronisation: getHaCredentials() synchronisiert alle Keys (ha_nabu_url, ha_token, nabu_ha_url, nabu_ha_token) verlustfrei',
      '⚡ Automatischer Push-Fallback: Git-Push nutzt automatisch gespeicherte Server-Tokens, falls im Dialogfeld keines explizit eingegeben wurde',
      '🔢 Aktualisierte Zahlen-FunFacts: 22.150+ Codezeilen, 2.450+ Prompt-Wörter, 2.05M Tokens und 47 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.48',
    label: '1.48 (Smart Power-Off & Offline Detection, Dimmed Telemetry with Dashes & HA Socket Sync)',
    releaseDate: '25.10.2026',
    description: 'Vollständige Kopplung der Drucker-Statusanzeige mit der Home Assistant LAN-Steckdose: Zeigt „Ausgeschaltet (Stromlos)“ statt irreführendem „Bereit (Leerlauf)“, wenn der Drucker keinen Strom hat. Ausgegraute Telemetrie mit Strichen (-- °C) für Hotends, Bett und Bauraum, deaktivierte Steuerungsbuttons, ein dediziertes Stromlos-Warnbanner mit 1-Klick-Einschalter sowie automatischer Standby-Kameramodus.',
    features: [
      '🔌 Intelligente Stromlos-Erkennung: Zeigt „Ausgeschaltet (Stromlos)“ wenn die Home Assistant Steckdose aus ist, und „Offline (Verbindungsaufbau...)“ während des Bootvorgangs – kein irreführendes „Bereit (Leerlauf)“ mehr',
      '🌡️ Ausgegraute Telemetrie & Striche (-- °C): Solange der Drucker stromlos oder offline ist, zeigen Nozzle 1, Nozzle 2, Bett und Bauraum saubere Striche (-- °C / Ziel: -- °C) und sind gedimmt',
      '⚡ Integrierter Ein-Schalter im Header & Banner: Schnelles Ein- und Ausschalten direkt im Header („Drucker: AUS / AN“) und prominenter „⚡ Jetzt Drucker anschalten“-Banner in der Vollansicht',
      '🔒 Gesperrte Bedienelemente bei Stromlosigkeit: M104/M140 Temperatureingaben, Pause-, Resume- und Stopp-Buttons sind geschützt deaktiviert, solange keine Verbindung besteht',
      '📷 Standby-Kameramodus: Die Live-Kamera schaltet bei Stromlosigkeit auf eine aufgeräumte Standby-Ansicht mit direktem Einschalt-Button um',
      '⏱️ Zuverlässiger 10s Toast-Timer & System-Logs: Alle Schalt- und Statusvorgänge werden nahtlos protokolliert und blenden Hinweise nach 10s sanft aus',
      '🔢 Aktualisierte Zahlen-FunFacts: 22.850+ Codezeilen, 2.550+ Prompt-Wörter, 2.15M Tokens und 48 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.49',
    label: '1.49 (Layout-Harmonisierung, Spulen-Kachelgrößen Entkopplung & Git/HA Token Guide)',
    releaseDate: '25.10.2026',
    description: 'Vollständige Wiederherstellung der sauberen visuellen Ordnung: Entkopplung der Kachel-Größenanpassung vom Druckerbereich und saubere Platzierung direkt im Filament-Spulen Header mit flexiblen Spalten-Presets (Kompakt bis Maxi). Bereinigung des Drucker-Headers gegen unschönes Zeilenumbruch-Flackern, globale Code-Fehlerkorrektur und integrierte Schritt-für-Schritt Anleitung zur Erstellung und Nutzung des GitHub Tokens mit Home Assistant.',
    features: [
      '📐 Kachelgrößen-Entkopplung: Der Slider und die Spalten-Presets (230px bis 490px) sitzen nun exklusiv im Filament-Spulen Header statt unter dem Drucker',
      '✨ Tidy Drucker-Header: Kompakte, layoutstabile Buttons ohne störende Zeilenumbrüche für Strom, Licht, G-Code, Kamera, Refresh, HA und Settings',
      '🔑 GitHub Token Guide: Direkte Schritt-für-Schritt Anleitung im Pi-Host Dialog zur 1-Minuten-Token-Erstellung mit [x] repo Scope auf github.com',
      '🏠 Home Assistant Klärung: Kein erneutes Eintippen des Git-Tokens in HA nötig – einmaliger Push genügt, HA zieht Updates automatisch',
      '🛠️ Vollständige Code-Bereinigung: Beseitigung aller Versions-Diskrepanzen (v1.49 Fallback), geschlossene Container-Tags und typensichere Schnittstellen',
      '🔢 Aktualisierte Zahlen-FunFacts: 23.450+ Codezeilen, 2.650+ Prompt-Wörter, 2.25M Tokens und 49 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.50',
    label: '1.50 (Kachelgröße exklusiv in Einstellungen & Git-Dateistatus Erklärung)',
    releaseDate: '25.10.2026',
    description: 'Vollständige Verbannung der Kachelgrößen-Regler aus dem Hauptmenü: Die Größenanpassung (200px bis 540px und 4 Spalten-Vorwahlen) befindet sich nun exklusiv aufgeräumt in den App-Einstellungen (Zahnrad). Klärung des Git-Dateistatus (warum GitHub nur geänderte Dateien aktualisiert) und Behebung des transienten Disc3-Ladefehlers.',
    features: [
      '🧹 Kachelgrößen aus dem Hauptmenü entfernt: Das Hauptmenü zeigt nur noch die klare Übersicht der Filament-Spulen mit Anzahl-Badge – kein visueller Ballast',
      '⚙️ Exklusiv in den Einstellungen: Schieberegler (200–540px) und Schnellwahltasten (Kompakt bis Maxi) bleiben dauerhaft in Sidebar -> Einstellungen -> Allgemein verfügbar',
      '📦 Git-Dateistatus Klärung: Detaillierte Erklärung, warum GitHub nur Dateien mit neuem Zeitstempel versieht, die im Commit tatsächlich geändert wurden',
      '🛡️ Disc3-Ladefehler behoben: Saubere Icon-Referenzen ohne transiente Import-Lücken und verifizierter Cache-Buster',
      '🔢 Aktualisierte Zahlen-FunFacts: 23.600+ Codezeilen, 2.720+ Prompt-Wörter, 2.29M Tokens und 50 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.51',
    label: '1.51 (Vollständige Disc3-Bereinigung, PWA-Cache Purge & Notfall-Reload)',
    releaseDate: '25.10.2026',
    description: 'Radikale Eliminierung aller Disc3-Referenzen aus dem gesamten Codebestand (ersetzt durch stabiles Disc/Layers/Package), automatischer PWA-Service-Worker Cache Purge und neuer Notfall-Reload-Mechanismus im Fehlerbildschirm, der veraltete Browser-Caches auf Knopfdruck löscht.',
    features: [
      '🛡️ 100% Disc3-Befreiung: Vollständiger Austausch aller Disc3-Icons in Navbar, Sidebar und Drawer gegen den rock-solid Standard Disc',
      '🧹 Automatischer Cache-Purge: Service-Worker Version auf v1.51 angehoben mit automatischer Bereinigung aller Alt-Caches beim Start',
      '🔄 Intelligenter Notfall-Reload: Der „Neu laden“-Knopf im Fehlerfenster löscht automatisch CacheStorage und deregisteriert alte Service-Worker vor dem Neuladen',
      '🚀 Cache-Busting Header: No-Cache Meta-Tags im HTML verhindern das Festhängen veralteter JavaScript-Dateien im Browser-Speicher',
      '🔢 Aktualisierte Zahlen-FunFacts: 23.850+ Codezeilen, 2.760+ Prompt-Wörter, 2.32M Tokens und 51 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.52',
    label: '1.52 (White-Screen Fix, iFrame-Storage Schutz & Dunkelmodus-Sicherung)',
    releaseDate: '26.10.2026',
    description: 'Beseitigung des weißen Bildschirms: iFrame-gerechtes SessionStorage-Handling, automatische Deregistrierung störender Service-Worker in Vorschau-Frames, ausfallsichere Fehlergrenzen und garantierter Standard-Dunkelmodus (#0b111e) ohne Flackern.',
    features: [
      '🛡️ iFrame-sicheres SessionStorage: Verhindert DOMException/SecurityError-Abstürze beim Laden in eingebetteten iFrames',
      '🌙 Dunkelmodus-Sicherung: Verhindert versehentliche weiße Polar-Themes und setzt standardmäßig das kontraststarke Nachtblau (slate)',
      '🧹 Automatischer iFrame SW-Schutz: Deaktiviert und bereinigt Service-Worker im Vorschau-iFrame, um Caching-Hänger restlos auszuschließen',
      '🎨 Dunkler HTML-Vorlade-Hintergrund: Inline-Styling in index.html verhindert weißes Aufblitzen vor dem Rendern',
      '🔢 Aktualisierte Zahlen-FunFacts: 23.950+ Codezeilen, 2.780+ Prompt-Wörter, 2.34M Tokens und 52 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.53',
    label: '1.53 (Harmonisierte Filter- & Suchleiste, Live-Counts & Clean-Layout)',
    releaseDate: '26.10.2026',
    description: 'Optische Runderneuerung der Filter- und Suchleiste: Klares 2-Zeilen-Design ohne Quetschungen und Überlappungen, modernisiertes Suchfeld mit Lupe und Schnell-Reset-Kreuz, maßgeschneidertes Sortier-Dropdown mit Icon sowie elegante Material-Chips mit Live-Spulenzählern.',
    features: [
      '✨ Klares 2-Zeilen-Kommando-Layout: Keine Überlagerung von Material-Chips und Suchleiste mehr – saubere Trennung von Suche/Sortierung und Material-Filtern',
      '🔍 Aufgewertetes Suchfeld: Mit dezentem Lupen-Icon, Fokus-Leuchten und schnellem „X“-Button zum sekundenschnellen Leeren des Textes',
      '🏷️ Material-Chips mit Live-Zählern: Jeder Chip zeigt die exakte Spulenanzahl (z. B. Alle [22], PLA [7], PETG [4]) mit sattem Theme-Akzent',
      '⇅ Harmonisierte Sortierung: Schlankes Dropdown mit Sortier-Icon und Pfeil statt doppelter Button-Reihen',
      '🔢 Aktualisierte Zahlen-FunFacts: 24.100+ Codezeilen, 2.800+ Prompt-Wörter, 2.37M Tokens und 53 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.54',
    label: '1.54 (GitHub-Pages-Fix, Sicherheits-Härtung & Revisionsmenü)',
    releaseDate: '28.10.2026',
    description: 'Die GitHub-Pages-Seite zeigt wieder die App statt einer leeren Seite (Build per GitHub Action, korrekter Basispfad). Dazu Sicherheits-Härtung am Server: Git-Push ohne Shell-Injection, keine Token-Ausgabe mehr, ZIP-Export ohne Zugangsdaten, optionaler API-Key.',
    features: [
      '🌐 GitHub Pages Fix: Die Seite wird automatisch mit Vite gebaut und aus dem dist-Ordner veröffentlicht, Basispfad /filament-website-google-ai/ – kein leerer dunkler Bildschirm mehr',
      '🔒 Git-Push abgesichert: Branch und Repo-URL werden geprüft, kein Shell-Aufruf mehr, Token nicht mehr in .git/config oder in Fehlermeldungen',
      '🙈 Keine Token-Ausgabe: Die Konfigurationsrouten liefern kein rawToken mehr, Zugangscodes stehen nicht mehr im Quellcode',
      '📦 ZIP-Export ohne Zugangsdaten: .env, Token-Dateien und data/ werden nicht mehr mitgepackt',
      '🔑 Optionaler API-Key (APP_API_KEY) und geschlossenes CORS für alle /api-Routen',
      '🛠️ Bambu-Verbindung: Timer werden beim Trennen aufgeräumt, zentrale Fehlerbehandlung, optionale TLS-Prüfung (BAMBU_TLS_VERIFY)',
      '🔢 Aktualisierte Zahlen-FunFacts: 24.600+ Codezeilen, 2.900+ Prompt-Wörter, 2.45M Tokens und 54 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.55',
    label: '1.55 (Build-Fix für GitHub Pages: npm-Installation)',
    releaseDate: '28.10.2026',
    description: 'Der automatische Build für GitHub Pages brach bei der Paketinstallation ab (Konflikt zwischen vite 8 und esbuild 0.25). Mit .npmrc (legacy-peer-deps) läuft die Installation wie bisher lokal und im Docker-Build durch.',
    features: [
      '🧰 Build-Fix: Neue .npmrc mit legacy-peer-deps=true behebt den Abbruch bei npm ci und npm install auf GitHub Actions',
      '🌐 Pages-Seite: Der Workflow kann die App jetzt bauen und unter /filament-website-google-ai/ veröffentlichen',
      '🔢 Aktualisierte Zahlen-FunFacts: 24.700+ Codezeilen, 2.950+ Prompt-Wörter, 2.48M Tokens und 55 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.56',
    label: '1.56 (Zentrale API-Schicht, API-Key an einer Stelle & stabiler G-Code-Upload)',
    releaseDate: '28.10.2026',
    description: 'Alle Aufrufe an den eigenen Server laufen jetzt über eine gemeinsame API-Schicht (src/api/). API-Key, JSON-Antworten und Zeitlimits liegen an einer Stelle statt in 9 Dateien. Die App sieht für dich gleich aus, ist aber sauberer aufgebaut und leichter zu warten.',
    features: [
      '🧱 Neue API-Schicht src/api/: client.ts plus printerApi, homeAssistantApi, gitApi, storageApi und recognizeApi',
      '🔑 API-Key zentral: Der optionale APP_API_KEY wird nur noch in client.ts angehängt, der fetch-Umbau in main.tsx ist entfernt, Fremdserver (Cloud-Sync) bekommen den Key nie',
      '⏱️ Status-Abfrage mit Zeitlimit (8 s), damit hängende Anfragen das 3-Sekunden-Polling nicht verstopfen',
      '📤 G-Code-Upload: Netzwerkfehler werden jetzt gemeldet, der Lade-Zustand bleibt nicht mehr hängen',
      '🧩 Typ BambuLiveState nach src/types/bambu.ts ausgelagert',
      '🔢 Aktualisierte Zahlen-FunFacts: 24.800+ Codezeilen, 3.000+ Prompt-Wörter, 2.51M Tokens und 56 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.57',
    label: '1.57 (5 gleichmäßige Helligkeits-Themes, Soft als Standard, GitHub Pages & Aufräumen)',
    releaseDate: '28.10.2026',
    description: 'Die 5 Helligkeits-Themes sind jetzt gleichmäßig von hell nach dunkel verteilt (statt fast nur hell oder dunkel), Soft ist das Standard-Theme. Alle Reste der Google-AI-Studio-Zeit sind entfernt, die Seite ist komplett auf GitHub Pages ausgerichtet und überflüssige Dateien sind weg.',
    features: [
      '🎨 5 Helligkeitsstufen gleichmäßig verteilt: Weiß, Soft, Grau, Dämmerung und Nacht – von ganz hell bis fast schwarz in ähnlichen Abständen, das mittlere Grau ist jetzt ein weicheres Blaugrau mit helleren Karten und besserem Kontrast',
      '☁️ Soft ist Standard: Soft ist das Standard-Theme (auch Startfarbe und Browser-Leiste), bisher gespeicherte Themes werden einmalig darauf zurückgesetzt',
      '🧹 AI-Studio-Reste entfernt: Screenshot-Ordner, metadata.json, Studio-Kommentare, Studio-Header und Texte wie „ohne AI Studio Credits“; der Name ist jetzt einfach FilamentHub',
      '🌐 GitHub Pages: Eigener Static-Modus ohne Server-Aufrufe (kein Dauer-Polling mehr), Service Worker kommt von der Vite-PWA mit richtigem Basispfad, Repo-Links zeigen auf tomden234',
      '🗑️ Aufgeräumt: .continue, .roo, bun.lock, alter Service Worker, Test-G-Code und Studio-Screenshots entfernt, uploads/ und data/ stehen in der .gitignore',
      '🔢 Aktualisierte Zahlen-FunFacts: 24.900+ Codezeilen, 3.050+ Prompt-Wörter, 2.54M Tokens und 57 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.58',
    label: '1.58 (OpenTag3D-NFC-Tags, robustere Druckerverbindung & aufgeteilter Code)',
    releaseDate: '28.10.2026',
    description: 'Du kannst Spulen jetzt im offenen OpenTag3D-Format auf NFC-Tags schreiben, damit auch Fremdspulen sauber beschrieben sind. Die Verbindung zum Bambu-Drucker bricht nicht mehr durch zu viele Anfragen ab und meldet abgelaufene Tokens klar. Alle zu großen Dateien sind in kleine Bausteine aufgeteilt.',
    features: [
      '🏷️ OpenTag3D-Tags: Neues Tag-Format (Standard 2.004, application/opentag3d) beim Schreiben, einzeln und im Massen-Modus. Lesen erkennt solche Tags auch wieder (Zuordnung über Spulen-ID oder Marke, Material und Farbe). Mindestens NTAG215 nötig',
      '🖨️ Druckerverbindung: pushall nur noch alle 15 Sekunden statt alle 3 (Bambu kann das drosseln), kein Endlos-Wiederverbinden mehr bei abgelehnten Zugangsdaten, Token wird vor dem Verbinden geprüft und ein abgelaufener Token klar gemeldet',
      '✅ Ehrlicher Verbindungstest: Der Test meldet Fehler jetzt als Fehler, statt immer „erfolgreich" zu zeigen',
      '🧩 Server aufgeteilt: server.ts von 1.762 auf 104 Zeilen, die Routen liegen in server/routes/ (Drucker, Kamera, Home Assistant, Git, Speicher, Erkennung)',
      '🧩 Oberfläche aufgeteilt: Sidebar (2.609 auf 845 Zeilen), Bambu-Widget (2.650 auf 883), App (2.077 auf 1.071) und NFC-Fenster (1.632 auf 758) bestehen jetzt aus Tab-Komponenten und Hooks',
      '🎨 Mittleres Grau-Theme weicher: Blaugrau mit helleren Karten und besserem Kontrast',
      '🔢 Aktualisierte Zahlen-FunFacts: 25.200+ Codezeilen, 3.150+ Prompt-Wörter, 2.64M Tokens und 58 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.59',
    label: '1.59 (Menü-Absturz behoben, Verbindungs-Menü, echte Android-App per QR & Pi-Hosting entfernt)',
    releaseDate: '28.10.2026',
    description: 'Das Menü stürzt nicht mehr ab (React-Fehler #310). Alles rund um Raspberry Pi, Docker und Home-Assistant-Add-on ist entfernt. Neu ist ein Menüpunkt „Verbindungen“, der Bambu Lab, Home Assistant und Handy-Sync Schritt für Schritt erklärt, und eine echte Android-App, die GitHub Actions baut und die du per QR-Code lädst.',
    features: [
      '🐛 Menü-Absturz behoben: Zwei Hooks standen hinter einem frühen return in der Seitenleiste (Minified React error #310). Alle Hooks laufen jetzt vor dem return, andere Fenster wurden per Skript geprüft',
      '🔌 Neues Untermenü „Verbindungen“ (Einstellungen): Karten für Bambu Lab, Home Assistant und Handy & Cloud-Sync mit Status-Anzeige, kurzer Erklärung und Schritt-für-Schritt-Anleitung',
      '📱 Echte Android-APK: Neuer Workflow .github/workflows/apk.yml baut bei jedem Push auf main eine signierte APK (Capacitor) und legt sie im Release „apk-latest“ ab',
      '🔳 QR-Code im Tab „Handy“: Der Code zeigt auf den festen APK-Download, dazu Link kopieren, Installationsschritte und Web-App-Alternative',
      '🧹 Pi-Hosting entfernt: Dockerfile, docker-compose, install-pi.sh, Pi-Anleitung, HA-Add-on-Dateien, ZIP-Export, Pi-Host-Fenster und die Platzhalter-APK sind gelöscht',
      '🔒 Zugangsdaten aus dem Code: Fest eingetragener Bambu-Token und Standard-User-ID wurden entfernt, die Felder sind jetzt leer',
      '🔢 Aktualisierte Zahlen-FunFacts: 22.400+ Codezeilen, 3.300+ Prompt-Wörter, 2,75M Tokens und 59 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.60',
    label: '1.60 (E-Mail-Login ohne Server: direkt in der App, mit E-Mail-Code & 2FA)',
    releaseDate: '28.10.2026',
    description: 'Der E-Mail-Login im Bambu-Fenster funktioniert jetzt auch ohne eigenen Server: Die Android-App fragt direkt bei Bambu an. Dazu gibt es den richtigen Ablauf mit E-Mail-Bestätigungscode, Authenticator-App-Code und „Code erneut senden“. Die Meldung „Nicht verfügbar auf GitHub Pages“ erscheint dort nicht mehr.',
    features: [
      '🔑 Login direkt in der App: Die APK schickt die Anfrage per nativem HTTP (CapacitorHttp) direkt an Bambu, dadurch greift die Browser-Sperre (CORS) nicht und es wird kein Server gebraucht',
      '📧 Richtiger Bambu-Ablauf: Passwort-Login, bei Bedarf automatisch Code per E-Mail anfordern und mit Konto + Code einloggen (vorher wurde das Feld falsch benannt und der Code nie gesendet)',
      '🔐 2FA-App unterstützt: Ist eine Authenticator-App aktiv, fragt das Fenster den 6-stelligen App-Code ab',
      '🔁 „Code erneut senden“ und Zifferneingabe mit Autofill für den Code',
      '🆔 User-ID wird nach dem Login automatisch aus dem Token gelesen, „User-ID erkennen“ geht in der App ebenfalls ohne Server',
      '🧩 Eine gemeinsame Login-Logik (src/utils/bambuCloudLogin.ts) für App und lokalen Server, die alte Server-Funktion ist entfernt',
      '🌐 Im normalen Browser (GitHub Pages) blockiert Bambu den Login weiterhin; das Fenster zeigt dort eine klare Meldung mit dem Weg über App oder manuelles Token',
      '🔢 Aktualisierte Zahlen-FunFacts: 22.800+ Codezeilen, 3.400+ Prompt-Wörter, 2,85M Tokens und 60 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.61',
    label: '1.61 (Akzentfarbe überall, Systemleisten folgen dem Theme, Auto-Update & aufgeräumte App-Ansicht)',
    releaseDate: '28.10.2026',
    description: 'Die Akzentfarbe (jetzt auch Blau) färbt die ganze App, in der Android-App wechselt die untere Navigationsleiste live mit. Die Statusleiste verdeckt das Menü nicht mehr, die App startet immer im App-Modus und aktualisiert sich selbst. Überflüssige Knöpfe und Dateien sind entfernt.',
    features: [
      '🎨 Akzentfarbe überall: Alle bisher fest orangen Knöpfe, Verläufe, Symbole und Schatten folgen jetzt der gewählten Akzentfarbe, neu dazu kommt „Klassisch-Blau“',
      '📱 Systemleisten nach Theme: In der Android-App ist die untere Navigationsleiste in der Akzentfarbe, die Statusleiste in der Hintergrundfarbe, die Symbole wechseln automatisch zwischen hell und dunkel',
      '🔝 Menü nicht mehr verdeckt: Der Inhalt wird unter der Statusleiste und über der Navigationsleiste platziert, dazu Platz für Notch und Gestenleiste in der Web-App',
      '🔄 Auto-Update: Die Web-App sucht alle 15 Minuten und beim Zurückkehren nach einer neuen Version und lädt sie selbst. Die Android-App zeigt oben „Neue Version verfügbar“ mit Ein-Tipp-Download',
      '🚀 Immer im App-Modus: Android-App, installierte Web-App und Handy starten immer in der App-Ansicht, der Umschalter erscheint nur noch im Browser am PC',
      '🧹 Aufgeräumt: Kopfzeile ohne Browser-Knöpfe (Webseite öffnen, QR, App/Desktop) in der App, Handy-Tab nur im Browser, drei unbenutzte Fenster und zwei unbenutzte Pakete entfernt',
      '🧱 Kein hellgrauer Streifen mehr: Der feste Hellgrau-Hintergrund im Seitenkopf ist weg, dunkle Themes füllen jetzt den ganzen Bildschirm',
      '🔢 Aktualisierte Zahlen-FunFacts: 22.100+ Codezeilen, 3.600+ Prompt-Wörter, 3M Tokens und 61 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.62',
    label: '1.62 (Drucker & NFC ohne Server)',
    releaseDate: '28.10.2026',
    description: 'Die Android-App verbindet sich jetzt selbst mit dem Bambu-Drucker (natives MQTT) und beschreibt NFC-Tags direkt. Kein Server und kein npm mehr nötig, der Fehler „Nicht verfügbar auf GitHub Pages“ ist in der App weg.',
    features: [
      '🖨️ Drucker ohne Server: Token, Status, Temperaturen, Licht und Befehle laufen in der App direkt über natives MQTT (Cloud, Port 8883)',
      '🎨 AMS bearbeiten: Farbe, Material und Restmenge pro Slot per MQTT-Befehl setzen (der AMS selbst liest nur Bambu-RFID, nicht NFC)',
      '📲 NFC in der App: Spulen-Tags lesen und beschreiben über das neue native NFC-Plugin, die bestehende NFC-Oberfläche funktioniert unverändert',
      '🧩 Ein Kern für alles: Server und App teilen sich denselben Drucker-Code, doppelte Logik ist entfernt',
      '🔢 Aktualisierte Zahlen-FunFacts: 22.500+ Codezeilen, 3.700+ Prompt-Wörter, 3M Tokens und 62 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.63',
    label: '1.63 (Live-Update, Druck-Verbrauch & saubere Spulenkarte)',
    releaseDate: '28.10.2026',
    description: 'Die Android-App holt neue Versionen jetzt selbst, ohne neue APK und ohne Bestätigen. Der Verbrauch der letzten Drucke kommt aus der Bambu Cloud und lässt sich mit einem Tipp von der Spule abziehen. Die Spulenkarte in der App ist aufgeräumt.',
    features: [
      '🔄 Live-Update: Die App lädt neue Oberflächen-Versionen automatisch im Hintergrund, ein Tipp auf „Neu laden“ startet sie sofort. Deine Daten bleiben erhalten, bei Problemen fällt sie auf die eingebaute Version zurück',
      '📦 Neue APK nur noch selten: Nur wenn sich der Android-Teil ändert (Plugins), erscheint „neue App nötig“. Diese eine APK ist die letzte manuelle Installation für normale Updates',
      '⚖️ Druck-Verbrauch: Neuer Knopf „Verbrauch“ am Drucker zeigt die letzten Aufträge mit Gramm pro Farbe (Bambu Cloud) und zieht sie auf Wunsch von der passenden Spule ab, nichts wird doppelt abgezogen',
      '🧹 Spulenkarte aufgeräumt: Feste Raster für −10/−25/−50/−100 und +10/+25/+50/+100 sowie drei gleich große Knöpfe NFC, Ändern und Löschen, nichts bricht mehr unordentlich um',
      '🔢 Aktualisierte Zahlen-FunFacts: 23.000+ Codezeilen, 3.800+ Prompt-Wörter, 3M Tokens und 63 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.64',
    label: '1.64 (NFC-Tag direkt in AMS-Slot)',
    releaseDate: '28.10.2026',
    description: 'Spule mit NFC-Tag ans Handy halten, Slot wählen, ein Tipp: Farbe, Material und Temperatur gehen an den Drucker. Ohne NFC geht es auch über die Spulenliste.',
    features: [
      '📲 NFC → Slot: Neuer Knopf „NFC→Slot“ am Drucker liest FilamentHub- und OpenTag3D-Tags und trägt die Spule in AMS-Slot 1 bis 4 ein',
      '🌡️ Temperaturen automatisch: Düsen-Min und -Max kommen passend zum Material, lassen sich vor dem Senden ändern',
      '📋 Ohne NFC nutzbar: Spule alternativ aus der Liste wählen, auch am PC oder ohne Tag',
      '🔢 Aktualisierte Zahlen-FunFacts: 23.300+ Codezeilen, 3.900+ Prompt-Wörter, 3M Tokens und 64 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.65',
    label: '1.65 (App-Update ohne Browser)',
    releaseDate: '28.10.2026',
    description: 'Wenn doch einmal eine neue APK nötig ist, lädt die App sie selbst und öffnet direkt den Android-Installer. Kein Browser, kein Suchen im Download-Ordner, nur einmal „Installieren“ bestätigen.',
    features: [
      '📥 Installieren in der App: Der Knopf „Installieren“ lädt die neue APK im Hintergrund und öffnet sofort den Installer, der Browser bleibt zu',
      '🔐 Einmalige Erlaubnis: Beim ersten Mal öffnet sich die Android-Einstellung „Installieren erlauben“ für FilamentHub, danach geht es immer direkt',
      '🔄 Live-Update bleibt die Regel: Normale Änderungen kommen weiter ohne neue APK, nur Änderungen am Android-Teil brauchen sie',
      '🔢 Aktualisierte Zahlen-FunFacts: 23.400+ Codezeilen, 3.900+ Prompt-Wörter, 3M Tokens und 65 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.66',
    label: '1.66 (Auto-Abzug nach jedem Druck)',
    releaseDate: '28.10.2026',
    description: 'Fertige Drucke werden automatisch von der Spule abgezogen. Die App holt den Verbrauch aus der Bambu Cloud und merkt sich jeden Auftrag, damit nie doppelt abgezogen wird, auch wenn die App beim Druckende zu war.',
    features: [
      '🤖 Auto-Abzug: Wenn ein Druck fertig ist, zieht die App die Gramm pro Farbe von der passenden Spule ab und zeigt eine Meldung „Auto-Abzug …“',
      '🎯 Richtige Spule: Zuerst die Spule, die du dem AMS-Slot zugewiesen hast, sonst Material und Farbe',
      '📥 Nachholen: Was fertig wurde, während die App zu war, wird beim nächsten Öffnen abgezogen, aber nur Drucke ab dem Einschalten',
      '🔘 Schalter: Im Fenster „Verbrauch“ lässt sich der Auto-Abzug an- und ausschalten, das manuelle Abziehen bleibt',
      '🔢 Aktualisierte Zahlen-FunFacts: 23.700+ Codezeilen, 4.000+ Prompt-Wörter, 3M Tokens und 66 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.67',
    label: '1.67 (Warnungen & Spulen-Check)',
    releaseDate: '28.10.2026',
    description: 'Die App warnt, wenn eine Spule fast leer ist, prüft vor dem Druck ob der Rest reicht, erinnert ans Trocknen und kennt den Lagerort jeder Spule.',
    features: [
      '⚠️ Rest-Warnung: Banner oben, Abzeichen auf der Karte und eine Meldung, sobald eine Spule unter die Schwelle fällt (Standard 100 g, einstellbar)',
      '✅ Reicht die Spule?: Beim G-Code-Rechner und vor „Direkt drucken“ siehst du, welche Spulen genug Rest haben (5 % Reserve)',
      '☀️ Trocknungs-Erinnerung: Meldung, wenn Trocknen fällig oder die AMS-Trocknung fertig ist, dazu Feuchte-Hinweis pro Material (PETG, TPU, Nylon)',
      '📍 Lagerort pro Spule: eigenes Feld, Filter-Chips und Suche mit mehreren Wörtern („rot pla“)',
      '🌡️ Material-Profil pro Spule: beste Düsen- und Betttemperatur speichern und per Knopf an den AMS-Slot senden',
      '🛠️ Neues Fenster „Werkstatt“ oben (Meldungen einstellen) und Fix: Kopfzeile zeigt jetzt die echte aktuelle Version',
      '🔢 Aktualisierte Zahlen-FunFacts: 25.500+ Codezeilen, 4.100+ Prompt-Wörter, 3M Tokens und 67 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.68',
    label: '1.68 (Etiketten-Drucker E10)',
    releaseDate: '28.10.2026',
    description: 'Der Supvan-E10-Etikettendrucker ist per Bluetooth direkt in die App eingebunden: QR-Etikett pro Spule drucken, QR scannen öffnet die Spule.',
    features: [
      '🖨️ Supvan E10 direkt per Bluetooth: Drucker suchen, einmal verbinden, danach merkt sich die App ihn',
      '🏷️ QR-Etikett pro Spule mit Name, Material, Farbe, Gewicht und Lagerort, einzeln oder mehrere auf einmal',
      '📱 QR scannen öffnet die Spule direkt in der App (Link mit #s=ID)',
      '🔘 Knopf „QR-Etikett drucken“ direkt in der Spulen-Ansicht',
      '🖼️ Als Bild teilen, falls kein Drucker da ist (Teilen-Menü oder Download)',
      '⚙️ Druckstärke, Drehen, Spiegeln, Verschieben und Testetikett einstellbar',
      '🔌 Neues Android-Plugin FilamentBle (neue APK nötig), im Browser läuft derselbe Druck über Chrome Web Bluetooth',
      '🔢 Aktualisierte Zahlen-FunFacts: 26.600+ Codezeilen, 4.300+ Prompt-Wörter, 3M Tokens und 68 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.69',
    label: '1.69 (Drucker-Verbindung & AMS-Farben)',
    releaseDate: '28.10.2026',
    description: 'Die App verbindet sich selbst mit dem Drucker (nach Login, beim Start, wenn sie wieder offen ist) und zeigt, warum er offline ist. AMS-Farben kommen echt vom Drucker, die Handy-Ansicht ist aufgeräumt.',
    features: [
      '🔌 Drucker verbindet sich selbst: direkt nach dem Login, beim App-Start und wenn die App wieder offen ist. Die Seriennummer sucht die App im Bambu-Konto',
      '🔁 Automatisch neu verbinden (nach 5 s bis 2 min), Knopf „Neu verbinden“ und klare Meldung, warum der Drucker offline ist',
      '🎨 AMS-Farben kommen echt vom Drucker, keine Demo-Spulen mehr. Teil-Meldungen des Druckers löschen die Slots nicht mehr',
      '🔄 „Mit Drucker synchronisieren“ ordnet deine Spulen nach Material und Farbe den Slots zu, mit Warnung bei falscher Spule',
      '📱 Handy-Ansicht: Druckauftrag-Kasten und Temperaturen raus, Drucksteuerung und Sync bleiben, abgeschnittene Offline-Zeile weg',
      '⚖️ Auto-Abzug läuft schon mit dem Cloud-Login, der falsche 42-g-Vorschlag ist weg',
      '🔢 Aktualisierte Zahlen-FunFacts: 26.800+ Codezeilen, 4.600+ Prompt-Wörter, 3M Tokens und 69 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.70',
    label: '1.70 (NFC in der App & Slot-Fenster)',
    releaseDate: '28.10.2026',
    description: 'NFC läuft jetzt wirklich über die App (keine Berechtigungs-Fehler, kein Android-„Neues Tag“-Bildschirm). Neues, übersichtliches Fenster „Spule → AMS-Slot“ mit Suche, Licht flackert nicht mehr, Fun Facts mit echten Zahlen.',
    features: [
      '📲 NFC-Fix: Die App nutzt immer ihr eigenes NFC statt des gesperrten Browser-NFC. Lesen und Beschreiben gehen wieder, Android fängt den Tag nicht mehr ab',
      '🏷️ Tag-Format: OpenTag3D ist jetzt Standard (offen, kompakt, passt auf NTAG215/216), die Wahl wird gemerkt',
      '🎯 Neues Fenster „Spule → AMS-Slot“: Tag halten oder Spule per Suche finden, Slots mit echten Drucker-Farben, Temperatur mit +/−, Zuweisung wird in der App gemerkt',
      '💡 Licht flackert nicht mehr: Nach dem Schalten hält die App den neuen Zustand, bis der Drucker ihn meldet',
      '📊 Fun Facts neu: Druckzeit und Verbrauch echt aus der Bambu Cloud, Filament-Länge, Lagerwert, Lieblingsfarbe, Codezeilen beim Bauen gezählt. Jede Zahl zeigt, woher sie kommt',
      '🔢 Aktualisierte Zahlen-FunFacts: 28.000+ Codezeilen, ca. 12.000 Wörter, 5 Chats, 43 Commits und 70 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.71',
    label: '1.71 (Slot-Check & Etiketten)',
    releaseDate: '28.10.2026',
    description: 'Der AMS-Slot sagt jetzt ehrlich, ob der Drucker die Spule wirklich übernommen hat (Bambu blockiert fremde Befehle über die Cloud). Kleine Slot-Zeilen mit Tag-Symbol, eine Spulen-Suche überall, Etiketten-Druck-Knopf in allen Spulen-Menüs, kürzere Etiketten, Druckverlauf mit echten Drucken und korrigierte Spulen-Gewichte.',
    features: [
      '🔌 Slot-Prüfung: „In Slot übertragen“ meldet nur noch ✓, wenn der Drucker den Slot wirklich gesetzt hat. Lehnt Bambu den Befehl ab („MQTT-Befehl fehlgeschlagen“), steht das klar da, und die Zuweisung bleibt trotzdem in der App',
      '🧩 AMS-Slots klein: nur „Slot 1“, Farbe, Hersteller und Material, dazu ein Tag-Symbol. Draufdrücken, Tag halten, Spule ist im Slot',
      '🔎 Eine Spulen-Suche überall (Slot, Druckverbrauch, Log, G-Code-Rechner) statt langer Auswahllisten, mit grünem/grauem NFC-Symbol',
      '📲 NFC ohne Android-Fenster: App fängt Tags immer selbst ab, startet auch durch einen Tag, Schreiben versucht es bei wackelndem Tag von selbst nochmal (neue APK einmal installieren)',
      '🖨️ Etikett-Knopf überall: im NFC-Lesemenü, auf jeder Spulenkarte, in der Spulen-Bearbeitung. Verbindet den Etiketten-Drucker bei Bedarf selbst',
      '🏷️ Etiketten: kürzer (nur so lang wie nötig), freier Rand gegen den Strich am Ende, Vorschau zeigt die Druckstärke, Regler direkt unter der Vorschau',
      '📜 Verlauf: zeigt jetzt die echten Drucke vom Drucker (mit Bild, Dauer, Gramm) und getrennt die Abzüge zum Rückgängigmachen',
      '🧹 App aufgeräumt: G-Code-, Home- und Einstellungs-Knopf am Drucker sind in der App weg; „Letzter Druck“ hat ein eigenes Symbol',
      '📹 Kamera: Wenn kein Bild kommt, steht jetzt in einfachen Worten warum (Token, Kamera-Name oder Erreichbarkeit)',
      '⚖️ Spulen-Gewichte: unmögliche Werte (z. B. 1108 g auf 1000-g-Spule) werden automatisch als Netto korrigiert, Hellgrün mit 1200 g bleibt',
      '🔢 Aktualisierte Zahlen-FunFacts: 29.000+ Codezeilen, ca. 14.000 Wörter, 5 Chats, 44 Commits und 71 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.72',
    label: '1.72 (App-Update-Knopf)',
    releaseDate: '28.10.2026',
    description: 'Im Menü „Verbinden“ gibt es in der Android-App jetzt einen grünen Knopf „Neue App jetzt installieren“: lädt die neueste APK direkt in der App und öffnet den Android-Installer.',
    features: [
      '📲 Neuer Knopf „Neue App jetzt installieren“ im Menü Verbinden (nur in der Android-App), ohne Browser und ohne QR-Code',
      '💬 Klare Meldung: lädt, „Installieren“ bestätigen oder „Installieren erlauben“, falls Android das erst freigeben muss',
      '🔢 Aktualisierte Zahlen-FunFacts: 29.000+ Codezeilen, ca. 14.000 Wörter, 5 Chats, 45 Commits und 72 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.73',
    label: '1.73 (Fehlerjagd & Feinschliff)',
    releaseDate: '28.10.2026',
    description: 'Komplette Fehlersuche: keine Typ- und Konsolenfehler mehr, alle Fenster in allen 5 Helligkeiten lesbar, Gewichte können nicht mehr verfälscht werden, Esc schließt jedes Fenster, aufgeräumte Spulenkarten und ein schnellerer Start.',
    features: [
      '🐞 Fehlerjagd: 0 Typfehler, 0 Fehler in der Konsole (PC + Handy, alle Fenster durchgeklickt). Neue Typfehler stoppen ab jetzt den Upload automatisch',
      '🎨 Lesbar in allen Themes: unsichtbare weiße Texte im hellen Modus behoben (NFC-, Spulen-, G-Code-, App-, Kamera-Fenster), Farben in Soft, Grau und Dämmerung automatisch kontrastreicher',
      '⚖️ Gewicht-Schutz: „+“ geht nicht mehr über die Füllmenge der Spule, die Brutto→Netto-Reparatur läuft nur noch einmal (sonst hätte „+25 g“ Gewichte verfälschen können)',
      '📲 NFC: Scan wird beim Schließen des Fensters sicher beendet. Die neue App (APK) wird jetzt automatisch angeboten',
      '⌨️ Esc schließt jedes Fenster, immer nur das oberste',
      '🃏 Spulenkarten aufgeräumt: Name über die volle Breite, die Marke (z. B. Eryone) ist beim Bearbeiten immer markiert',
      '🔔 Meldungen kompakter, Antippen schließt sie, am Handy über der Daumenleiste. Etikett-Fehler wird nicht mehr abgeschnitten',
      '🏠 Home Assistant zeigt ehrlich „Token fehlt“, abgelehnte Drucker-Befehle melden sich jetzt statt still zu scheitern',
      '🚀 Schnellerer Start: große Fenster und die Etiketten-Kompression werden erst bei Bedarf geladen',
      '🔢 Aktualisierte Zahlen-FunFacts: 29.000+ Codezeilen, ca. 14.000 Wörter, 5 Chats, 46 Commits und 73 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
 },
  {
    id: 'v1.74',
    label: '1.74 (Drucker-Status & Kachel-Regler)',
    releaseDate: '29.10.2026',
    description: 'Der Drucker zeigt nicht mehr „Bereit“, wenn er aus ist: Nur wenn er wirklich Daten schickt, gilt er als erreichbar. Die Einstellung für die Kachelgröße ist neu und sauber aufgebaut.',
    features: [
      '🔌 Ehrlicher Drucker-Status: Cloud verbunden, aber der Drucker ist aus? Dann steht „Drucker aus / nicht erreichbar“ statt „Bereit“. Nach 2,5 Minuten ohne Meldung gilt er als aus',
      '🎛️ Steuerung (Pause, Stopp, Temperaturen) ist nur aktiv, wenn der Drucker wirklich antwortet',
      '📐 Kachelgröße aufgeräumt: Regler, darunter klein/groß und Kacheln pro Reihe, nichts überlappt mehr. Vier klare Knöpfe Kompakt, Standard, Groß, Maxi',
      '🔢 Aktualisierte Zahlen-FunFacts: 29.000+ Codezeilen, ca. 14.100 Wörter, 5 Chats, 47 Commits und 74 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.75',
    label: '1.75 (LAN-Modus)',
    releaseDate: '29.10.2026',
    description: 'Neuer LAN-Modus: Die App spricht jetzt direkt mit dem Drucker im Heimnetz, ganz ohne Bambu Cloud. Mit Tailscale klappt dieselbe IP auch unterwegs.',
    features: [
      '📡 LAN-Modus: IP, Zugangscode und Seriennummer eintragen, die App verbindet direkt mit dem Drucker (MQTT, Port 8883). Läuft, wenn am Drucker „Nur LAN“ an ist und Bambu Cloud und Handy-App aus sind',
      '🛡️ Sicher begrenzt: Erlaubt sind nur Adressen im Heimnetz (192.168.x, 10.x, 172.16-31.x) und Tailscale (100.64-127.x), nie ein Server im Internet',
      '🛠️ Entwicklermodus nutzbar: Im LAN darf die App Slots setzen und Temperaturen steuern, wenn der Entwicklermodus am Drucker an ist',
      '🔁 Cloud oder LAN: Neuer Tab „LAN“ in den Bambu-Einstellungen. Wer sich wieder per Cloud verbindet, wechselt automatisch zurück',
      '🔢 Aktualisierte Zahlen-FunFacts: 29.500+ Codezeilen, ca. 14.250 Wörter, 5 Chats, 48 Commits und 75 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.76',
    label: '1.76 (Externe Spule)',
    releaseDate: '29.10.2026',
    description: 'Die externe Spule ist jetzt als 5. Spule da (zählt nicht zum AMS). AMS-Trocknung meldet ehrlich Erfolg oder Fehler. QR-Codes auf Etiketten sind größer.',
    features: [
      '🧵 Externe Spule: Neue 5. Karte „Extern“ mit Farbe und Material direkt vom Drucker. Spule zuweisen per Tippen, auch beim Abgleich mit dem Drucker',
      '🔒 Nicht im AMS: Die externe Spule ist getrennt. AMS-Trocknung und AMS-Gutschrift betreffen nur die 4 AMS-Slots, Auto-Abzug nutzt sie nur bei Druck von extern',
      '🔥 AMS-Trocknung per App: Start und Stopp senden wirklich an den Drucker. Klappt es nicht, siehst du jetzt den Fehler statt einer falschen Erfolgsmeldung',
      '🔳 QR-Etiketten: Kleinerer weißer Rand, dadurch größere Punkte und besser scanbar',
      '🔢 Aktualisierte Zahlen-FunFacts: Codezeilen, 5 Chats, 49 Commits und 76 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.77',
    label: '1.77 (Trocknung echt)',
    releaseDate: '29.10.2026',
    description: 'AMS-Trocknung sendet jetzt das richtige Befehlsformat und zeigt nur noch echte Werte vom Drucker. Keine geschätzte Restzeit oder feste Feuchte mehr.',
    features: [
      '🔥 Richtiger Befehl: Die Trocknungs-Temperatur lag im falschen Feld, deshalb ignorierte der Drucker den Start. Jetzt Format wie bei AMS 2 Pro/HT üblich, mit der echten AMS-Nummer aus dem Drucker',
      '✅ Bestätigung: Die App meldet „läuft“ erst, wenn der Drucker die Trocknung wirklich zeigt. Sonst kommt eine klare Fehlermeldung mit Tipps',
      '📊 Echte Zahlen: Restzeit kommt direkt vom Drucker (dry_time), Feuchte als echter Wert (humidity_raw) oder ehrlich als Stufe. Keine festen 17 % mehr',
      '🔢 Aktualisierte Zahlen-FunFacts: 50 Commits und 77 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.78',
    label: '1.78 (QR am Ende)',
    releaseDate: '29.10.2026',
    description: 'Auf dem Etikett steht der QR-Code jetzt am Ende, der Text vorne. So läuft der Strich vom Bandanfang nicht mehr durch den QR.',
    features: [
      '🔳 QR am Ende: Text links, QR-Code rechts am Etikettenende mit sauberem Rand',
      '↔️ 2 mm freier Anfang: Der Bandanfang druckt unsauber und bleibt jetzt leer',
      '📏 Automatische Länge passt sich an (Text + QR)',
      '🔢 Aktualisierte Zahlen-FunFacts: 51 Commits und 78 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.79',
    label: '1.79 (Trocknung Diagnose)',
    releaseDate: '29.10.2026',
    description: 'AMS-Trocknung probiert jetzt mehrere Befehlsformen, erkennt die Trocknung auch über dry_setting und zeigt bei Fehlern genau, was der Drucker antwortet.',
    features: [
      '🔁 4 Befehlsformen: Die App probiert nacheinander verschiedene Formate (andere AMS-Nummer, mit Filamentart), bis der Drucker die Trocknung zeigt',
      '👀 Bessere Erkennung: Trocknung zählt, wenn der Drucker dry_time oder dry_setting meldet',
      '🩺 Diagnose: Bei Fehler steht in der Meldung und im Log die Antwort des Druckers, die AMS-Felder und HMS-Codes',
      '🔢 Aktualisierte Zahlen-FunFacts: 52 Commits und 79 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.80',
    label: '1.80 (Mehr Trocknungs-Optionen)',
    releaseDate: '29.10.2026',
    description: 'Mehr Auswahl bei der AMS-Trocknung: 8 Zeiten und 7 Temperaturen, trotzdem übersichtlich in zwei Reihen mit Zusammenfassung.',
    features: [
      '⏱️ Dauer: 1, 2, 4, 6, 8, 12, 16 oder 24 Stunden',
      '🌡️ Temperatur: 45° bis 80° in 7 Stufen, mit Materialtipp (TPU, PLA, PETG, ABS/ASA, PA/PC)',
      '📋 Zeile „Gewählt“ zeigt Zeit, Temperatur und Material auf einen Blick',
      '⚠️ Hinweis: 70° und 80° gehen nur mit AMS HT, das AMS 2 Pro schafft bis 65°',
      '🔢 Aktualisierte Zahlen-FunFacts: 53 Commits und 80 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.81',
    label: '1.81 (Trocknung eine Zeile)',
    releaseDate: '29.10.2026',
    description: 'Trocknungs-Auswahl in einer einzigen Zeile: 6h 8h 12h 24h und 45° 50° 60° 65°.',
    features: [
      '↔️ Eine Zeile: Dauer (6h, 8h, 12h, 24h) und Temperatur (45°, 50°, 60°, 65°) nebeneinander',
      '🎯 Standard jetzt 6h bei 50°, Zeile „Gewählt“ darunter bleibt',
      '🔢 Aktualisierte Zahlen-FunFacts: 54 Commits und 81 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.82',
    label: '1.82 (Meldungen aufs Handy)',
    releaseDate: '29.10.2026',
    description: 'Benachrichtigungen funktionieren jetzt in der Android-App. Vorher fehlte die Berechtigung, der Schalter in Android war grau und aus.',
    features: [
      '🔔 Berechtigung: Die App fragt Android jetzt nach Meldungen (Android 13+), der Schalter in den Einstellungen lässt sich einschalten',
      '📲 Echte Handy-Meldungen: Trocknen fällig, Trocknung fertig, Spule fast leer, Test-Meldung',
      '⚙️ Button „Android-Einstellungen öffnen“, falls Meldungen blockiert sind',
      '🆕 Neue APK nötig (neue Android-Berechtigung), die App zeigt einen Hinweis, wenn sie noch alt ist',
      '🔢 Aktualisierte Zahlen-FunFacts: 55 Commits und 82 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.83',
    label: '1.83 (Dunkelgrünes Logo)',
    releaseDate: '29.10.2026',
    description: 'Neues App-Logo: dunkelgrüne Spule mit Leuchten und ablaufendem Faden, statt des alten orangen Logos.',
    features: [
      '🟢 Neues Logo: tiefgrüner Hintergrund, smaragdgrüne Spule mit aufgewickeltem Filament und leuchtendem Rand',
      '🧵 Ablaufender Faden unten rechts als Blickfang',
      '📱 Überall gleich: App-Symbol (neue APK), Browser-Tab, Startbildschirm und Web-App',
      '🔢 Aktualisierte Zahlen-FunFacts: 56 Commits und 83 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.84',
    label: '1.84 (APK-Knopf im Menü)',
    releaseDate: '29.10.2026',
    description: 'Neuer Knopf im Menü: Neueste APK direkt herunterladen und installieren. Die automatischen Updates bleiben wie gehabt.',
    features: [
      '⬇️ Knopf „Neueste APK herunterladen“ ganz oben im Menü, in der App und im Browser sichtbar',
      '📲 In der App lädt sie die APK selbst und öffnet den Android-Installer, im Browser startet der Download',
      '🔄 Automatische Updates der Oberfläche bleiben unverändert aktiv',
      '🟢 Löst das alte App-Symbol: neue APK installieren, dann zeigt der Startbildschirm das grüne Logo',
      '🔢 Aktualisierte Zahlen-FunFacts: 57 Commits und 84 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.85',
    label: '1.85 (Dunkelgrün-Design)',
    releaseDate: '29.10.2026',
    description: 'Die App ist jetzt standardmäßig in einem satten Dunkelgrün, passend zum neuen Logo. Der Knopf für die neueste APK steht oben im Menü.',
    features: [
      '🌲 Neues Dunkelgrün als Akzentfarbe: tiefe Knöpfe, grüne Verläufe und Leisten, gut lesbar auf hell und dunkel',
      '🎨 Einmalig automatisch umgestellt, danach kannst du unter Design wieder jede andere Farbe wählen',
      '📲 „Neueste APK herunterladen“ oben im Menü, automatische Oberflächen-Updates bleiben an',
      '🔢 Aktualisierte Zahlen-FunFacts: 58 Commits und 85 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.86',
    label: '1.86 (Meldungen & Aufräumen)',
    releaseDate: '29.10.2026',
    description: 'Handy-Meldungen bei Druck fertig, Trocknung fertig und Trocknen nötig. Der APK-Knopf sitzt jetzt schön unten im Menü. Tools geprüft und eine Fehlanzeige korrigiert.',
    features: [
      '🖨️ Druck fertig oder fehlgeschlagen: Meldung aufs Handy, wenn der Drucker es meldet (Schalter im Meldungen-Tab)',
      '🔥 Trocknung fertig: Meldung, sobald der Drucker das Ende der AMS-Trocknung meldet (zusätzlich zur Zeit-Erinnerung)',
      '☀️ Trocknen nötig: Erinnerung pro Spule bleibt aktiv, höchstens einmal am Tag',
      '📲 APK-Knopf neu gestaltet: schmale Karte „App-Update holen“ unten im Menü, mit Version und Hinweis, dass Auto-Updates an bleiben',
      '🧰 Tools geprüft: Cloud-Sync, Backup, Zurücksetzen, G-Code-Rechner funktionieren. „Druckdatei vom X2D“ erfindet keine 42 g / 2,5 h mehr, sondern zeigt nur echte Werte',
      '🔢 Aktualisierte Zahlen-FunFacts: 59 Commits und 86 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.87',
    label: '1.87 (Auto-Abzug im LAN)',
    releaseDate: '29.10.2026',
    description: 'Auto-Abzug nach dem Druck klappt jetzt auch im LAN-Modus, ganz ohne Bambu Cloud: bekannte Aufträge ziehen automatisch ab, neue fragen einmal nach den Gramm.',
    features: [
      '⚖️ Auto-Abzug im LAN: Im Nur-LAN-Betrieb meldet der Drucker keine Gewichte an die Cloud, darum gab es vorher keinen Abzug',
      '🧠 Lernt mit: Gewicht je Auftragsname wird gemerkt. Gleicher Auftrag nochmal drucken = automatischer Abzug ohne Frage',
      '🧾 Neue Aufträge: Nach „Druck fertig“ kommt eine kleine Karte mit vorgewählter Spule (aus dem aktiven AMS-Slot) und Feld für die Gramm',
      '📤 Hochladen mit bekanntem Gewicht merkt sich das Gewicht gleich mit',
      '🔢 Aktualisierte Zahlen-FunFacts: 60 Commits und 87 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.88',
    label: '1.88 (Windows-App & Gewicht aus Datei)',
    releaseDate: '29.10.2026',
    description: 'Neue Windows-App mit voller Druckersteuerung. Im LAN-Modus liest sie das Gewicht je Filament selbst aus der Druckdatei auf dem Drucker, nichts mehr eintragen.',
    features: [
      '💻 Windows-App (FilamentHub-Setup.exe): komplette App mit Drucker-Steuerung, AMS, Trocknung, Etiketten und Meldungen',
      '⚖️ Gewicht automatisch: Die App holt die .3mf-Datei per FTPS vom Drucker und liest used_g je Filament. Bei mehreren Farben wird jede Spule einzeln abgezogen',
      '🔁 Fallback bleibt: Auf dem Handy (kein FTPS) gilt weiter gemerktes Gewicht oder die kleine Abfrage',
      '📲 Update-Knopf in der Windows-App lädt den neuesten Installer',
      '🔧 Sicherer APK-Link: zeigt fest auf das APK-Release, auch mit zweitem Release für Windows',
      '🔢 Aktualisierte Zahlen-FunFacts: 61 Commits und 88 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.89',
    label: '1.89 (Geräte-Sync)',
    releaseDate: '29.10.2026',
    description: 'Handy, Windows-App und alle weiteren Geräte gleichen sich selbst ab: Spulen, Einstellungen, Drucker-IP, Zugangscode, Seriennummer und Bambu-Login. Einmal Sync-Passwort, nie wieder IP tippen.',
    features: [
      '🔄 Geräte-Sync: Neue Karte „Geräte-Sync“ unter Einstellungen → Verbindungen. Auf jedem Gerät dasselbe Passwort, fertig',
      '🔐 Verschlüsselt: Drucker-IP, Zugangscode, Seriennummer, Bambu-Token und PIN werden im Gerät mit AES-256 verschlüsselt. Die Cloud sieht nur Zufallstext',
      '🔌 Verbindet sich selbst: Nach dem Übernehmen verbindet die App den Drucker (LAN oder Cloud) ohne Eingabe',
      '🥇 Neuester Stand gewinnt: Spulen und Verlauf werden alle 60 Sekunden und beim Öffnen abgeglichen, Einstellungen alle 45 Sekunden. Neuere Änderungen überschreiben nie ältere Geräte-Daten blind',
      '🧰 Sync überschreibt nichts mehr: Speichern von Spulen behält den verschlüsselten Geräte-Block in der Cloud',
      '🔢 Aktualisierte Zahlen-FunFacts: 62 Commits und 89 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.90',
    label: '1.90 (Sync-Diagnose)',
    releaseDate: '29.10.2026',
    description: 'Geräte-Sync zeigt bei einem Fehler jetzt den genauen Grund an und prüft, ob die Verschlüsselung auf dem Gerät verfügbar ist.',
    features: [
      '🔍 Grund-Zeile unter der Fehlermeldung: zeigt, warum der Abgleich nicht klappt (Cloud-Antwort, Verschlüsselung, Netzwerk)',
      '🔐 Prüft vorher, ob die Seite sicher läuft (https oder App), sonst klare Erklärung statt „Cloud nicht erreichbar“',
      '🛡️ Große Datenmengen beim Verschlüsseln sicherer verarbeitet',
      '🔢 Aktualisierte Zahlen-FunFacts: 63 Commits und 90 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.91',
    label: '1.91 (Windows Auto-Update)',
    releaseDate: '29.10.2026',
    description: 'Die Windows-App aktualisiert sich jetzt selbst: sie prüft beim Start und alle 30 Minuten, lädt neue Versionen im Hintergrund und installiert sie per Klick oder beim Beenden.',
    features: [
      '🔄 Auto-Update: Neue Version wird im Hintergrund geladen, ohne dass du etwas tust',
      '🪟 Hinweis „Version X ist bereit“ mit Button „Jetzt neu starten“. Wer „Später“ wählt, bekommt das Update beim nächsten Beenden',
      '⏱️ Prüfung beim Start und alle 30 Minuten, Daten (Spulen, Drucker-Zugang) bleiben erhalten',
      '⚠️ Einmal manuell: Version 1.89/1.90 hat das noch nicht eingebaut, deshalb einmal den neuen Installer ausführen',
      '🔢 Aktualisierte Zahlen-FunFacts: 64 Commits und 91 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.92',
    label: '1.92 (Windows-Sync fix)',
    releaseDate: '29.10.2026',
    description: 'Geräte-Sync und Cloud-Abgleich funktionieren jetzt auch in der Windows-App. Der Fehler „Failed to fetch“ kam vom Browser-Schutz im Fenster.',
    features: [
      '🪟 Windows-App: Cloud-Zugriff läuft über den eingebauten Server, dadurch kein „Failed to fetch“ mehr',
      '🔒 Sicher begrenzt: Der Server leitet nur Anfragen an api.npoint.io weiter, sonst nichts',
      '🔄 Gilt für Geräte-Sync (Drucker-Zugang, Einstellungen) und für den Spulen-Abgleich',
      '🔢 Aktualisierte Zahlen-FunFacts: 65 Commits und 92 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.93',
    label: '1.93 (Update-Knopf Windows)',
    releaseDate: '29.10.2026',
    description: 'Die Windows-App hat einen Knopf „Nach Update suchen“: sucht, lädt mit Fortschrittsanzeige und installiert per Klick, ganz ohne Browser.',
    features: [
      '🔎 Knopf unten im Menü: „Nach Update suchen“, dann „Lade Update … 45 %“, dann „Jetzt installieren“',
      '✅ Meldet auch „Du hast die neueste Version“ oder den genauen Fehler',
      '🔁 Automatische Prüfung (Start und alle 30 Minuten) bleibt zusätzlich aktiv',
      '🔢 Aktualisierte Zahlen-FunFacts: 66 Commits und 93 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.94',
    label: '1.94 (Sync stabiler)',
    releaseDate: '29.10.2026',
    description: 'Cloud-Zugriff der Windows-App ist robuster: zweiter Versuch über IPv4, Wiederholung bei kurzen Cloud-Fehlern und genauer Fehlergrund in der Anzeige.',
    features: [
      '🔁 Wiederholt automatisch, wenn die Cloud kurz mit einem Serverfehler (5xx) antwortet',
      '🌐 Zweiter Weg über IPv4, falls das Netzwerk oder der Router Probleme mit dem ersten Weg hat',
      '🔍 Grund-Zeile zeigt jetzt den echten Fehlertext aus dem Server statt nur die Zahl',
      '🔢 Aktualisierte Zahlen-FunFacts: 67 Commits und 94 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.95',
    label: '1.95 (Sync über Windows-Netz)',
    releaseDate: '29.10.2026',
    description: 'Geräte-Sync der Windows-App nutzt jetzt den Netzwerk-Zugang und die Zertifikate von Windows. Damit klappt es auch, wenn ein Virenscanner HTTPS prüft (Fehler UNABLE_TO_VERIFY_LEAF_SIGNATURE).',
    features: [
      '🛡️ Ursache: Ein Virenscanner oder Firmen-Proxy prüft HTTPS mit eigenem Zertifikat. Windows kennt es, der eingebaute Server nicht',
      '🪟 Lösung: Cloud-Abgleich läuft über das Windows-Netz (Chromium net.fetch) mit den Windows-Zertifikaten, ohne Sicherheit abzuschalten',
      '🔒 Weiterhin nur api.npoint.io erlaubt',
      '🔢 Aktualisierte Zahlen-FunFacts: 68 Commits und 95 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.96',
    label: '1.96 (Zertifikat-Hilfe)',
    releaseDate: '29.10.2026',
    description: 'Wenn auf dem PC ein Virenscanner oder Netzfilter die Cloud-Verbindung mit eigenem Zertifikat abfängt, zeigt die Windows-App jetzt den Aussteller und erlaubt, genau diesem Zertifikat zu vertrauen.',
    features: [
      '🔎 Zeigt den Aussteller des fremden Zertifikats (z. B. Virenscanner, Router-Filter) und das Ablaufdatum',
      '✅ Knopf „Diesem Zertifikat vertrauen“: gilt nur für die Cloud-Datenbank und nur für genau dieses Zertifikat (Fingerabdruck)',
      '🔐 Drucker-Zugang und Passwörter bleiben Ende-zu-Ende verschlüsselt, alle anderen Seiten werden weiter streng geprüft',
      '🔢 Aktualisierte Zahlen-FunFacts: 69 Commits und 96 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.97',
    label: '1.97 (Schlauere KI & Zertifikat-Fix)',
    releaseDate: '29.10.2026',
    description: 'Der KI-Assistent ist jetzt Standard im Menü und deutlich schlauer. Außerdem klappt „Diesem Zertifikat vertrauen“ in der Windows-App wirklich.',
    features: [
      '🤖 KI ist Standard: Menü öffnet direkt den Assistenten',
      '🧠 Versteht freie Sätze: „25 g PETG schwarz verbraucht“, „Setz Eryone Rot auf 640 g“, „200 g zu Sunlu hinzufügen“, „zieh 10 g davon ab“',
      '❓ Fragt nach, wenn mehrere Spulen passen, Antwort einfach mit Nummer',
      '📊 Beantwortet Fragen: fast leer, was trocknen, wie viel PLA, Gesamtbestand, Filament-Wert, günstigste/teuerste, Spulen-Info, Lagerort',
      '📴 Läuft komplett im Gerät, auch offline',
      '🛡️ Windows: Bestätigtes Zertifikat (z. B. FortiGate-Firewall) wird jetzt per Fingerabdruck direkt geprüft. Vorher blinkte der Knopf nur, weil Windows das alte Ergebnis zwischengespeichert hatte',
      '🔢 Aktualisierte Zahlen-FunFacts: 70 Commits und 97 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.98',
    label: '1.98 (NFC-Leser im AMS)',
    releaseDate: '29.10.2026',
    description: 'Vorbereitung für eigene NFC-Leser im AMS 2 Pro: ESPHome-Datei, Pin-Plan und App-Anbindung. Spule rein, App erkennt sie und setzt den Slot automatisch.',
    features: [
      '📡 ESPHome-Datei für ESP32 + 5× RC522 (4 Slots + extern), geprüft mit esphome config',
      '🔌 Pin-Plan für ESP32 mit 30 und 38 Pins, Anleitung in hardware/ams-nfc/README.md',
      '🤖 App findet die Leser über Home Assistant selbst, ordnet Spule ↔ Slot zu und setzt Material/Farbe am Drucker, wenn es nicht passt',
      '🧠 Unbekannter Tag: einmal im Slot die Spule wählen, die App merkt sich den Tag',
      '🔄 Geräte-Sync überträgt jetzt auch Tag-Zuordnungen und Home-Assistant-Zugang',
      '⚙️ Schalter im Meldungen-Tab: NFC-Leser an/aus, an Drucker senden an/aus',
      '🔢 Aktualisierte Zahlen-FunFacts: 71 Commits und 98 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.99',
    label: '1.99 (Spulen-Zustand, Gist-Cloud & Neustart)',
    releaseDate: '29.10.2026',
    description: 'Jede Spule kennt jetzt ihren Zustand (mit/ohne Spule, verschweißt, Eibos-Beutel, muss trocknen). Cloud läuft über einen privaten GitHub-Gist statt npoint (Schulnetz). Alle Spulen lassen sich mit einem Knopf entfernen. Dazu ein RC522-Halter zum Drucken und ein neues README.',
    features: [
      '🧵 Neue Felder pro Spule: auf Spule / ohne Spule, original verschweißt, im Eibos-Beutel, muss trocknen, mit Abzeichen auf der Karte',
      '⚖️ Waage rechnet richtig: ohne Spule 0 g Leerspule, Eibos-Beutel (35 g) wird abgezogen, Leerspule aus der Marke wenn nicht gesetzt',
      '💧 Trocknen: verschweißt = frisch, „muss trocknen“ = sofort fällig bis zum Trocknen',
      '🗑️ Tools-Tab: „Alle Spulen entfernen (Neustart)“ mit Backup-Datei und Kopie im Gerät, Verlauf bleibt, AMS- und Tag-Zuordnungen werden geleert',
      '🌱 Eigene Startliste in src/data/mySpools.ts: Spulen einmal diktieren, Claude trägt sie sauber ein',
      '☁️ Cloud-Speicher: privater GitHub-Gist statt npoint.io (wird im Schulnetz gesperrt). Anlegen, Daten übernehmen, zweites Gerät per QR-Code koppeln (Token bleibt im URL-Teil nach #)',
      '🔒 Leere Spulenliste wird jetzt auch aus der Cloud übernommen und springt nicht mehr auf die Beispiele zurück',
      '🔀 Revision wechseln löscht keine Spulen und keinen Verlauf mehr',
      '📡 NFC-Leser: Home-Assistant-Zugang wird bei jeder Abfrage frisch gelesen, Pause im versteckten Tab, Zeitlimit pro Abfrage, Hinweis „Unbekannter Tag“ kommt nach Abnehmen wieder',
      '🖨️ RC522-Halter für PETG/ASA: STL, SCAD und SVG-Zeichnung in hardware/ams-nfc/holder/',
      '🔢 Aktualisierte Zahlen-FunFacts: 72 Commits und 99 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.100',
    label: '1.100 (Flacher RC522-Halter)',
    releaseDate: '29.10.2026',
    description: 'Der RC522-Halter hat keine Seitenteile mehr. Es ist jetzt eine flache Platte, die du mit doppelseitigem Klebeband an Platine und AMS klebst.',
    features: [
      '🖨️ Halter ohne Seitenwände, Ohren und Nuten: nur Platte 44 × 64 × 2,4 mm',
      '📌 Flache Mulde (0,6 mm) zeigt, wo die Platine hinkommt, Fenster lässt die Stiftleiste durch',
      '📐 STL, SCAD und SVG-Zeichnung neu, Anleitung in hardware/ams-nfc/holder/README.md',
      '📝 README und NFC-Anleitung angepasst',
      '🔢 Aktualisierte Zahlen-FunFacts: 73 Commits und 100 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.101',
    label: '1.101 (Mitteilungen & neues Verbindungen-Menü)',
    releaseDate: '29.10.2026',
    description: 'Mitteilungen mit Postfach: Ein Tipp auf die Benachrichtigung öffnet die App direkt bei „Trocknung fertig“ & Co. mit allen Details. Das Verbindungen-Menü ist komplett neu und zeigt nur, was es auf dem Gerät gibt. Der Log-Spam ist weg.',
    features: [
      '🔔 Glocke oben mit Zähler und Postfach: alle Mitteilungen mit Details (Dauer, Temperatur, welche Spulen getrocknet wurden)',
      '👆 Tipp auf die Benachrichtigung öffnet die App bei genau dieser Mitteilung (Android, Windows-App, installierte Web-App)',
      '⚙️ Einstellungen: Druck fertig, Druck fehlgeschlagen, Trocknung fertig, Trocknen fällig, Spule fast leer einzeln an/aus, Benachrichtigung aufs Gerät an/aus',
      '🔌 Verbindungen neu: aufgeräumte Liste mit Status auf einen Blick (Drucker, Home Assistant, Cloud & Sync, NFC-Leser, Mitteilungen, Handy koppeln). In der Android-App fehlt „Handy koppeln“, Anleitungen nur solange etwas nicht eingerichtet ist',
      '🏠 Home Assistant schlank: Adresse, Token, Kamera und Steckdose (Auswahl aus Liste nach „Testen“). Weg sind die 60-Sensoren-Liste, der Sensorpfad-Platzhalter und der alte GitHub-Pull-Knopf',
      '🧰 Tools-Tab neu sortiert: Abgleich, Backup, Spulenbestand mit eigener Gefahrenzone',
      '📜 Log-Spam behoben: „Drucker bereit“ kam jede Sekunde. Statuswechsel zählen erst nach 15 s, gleiche Meldungen werden nicht doppelt gespeichert, alte zugespamte Logs räumen sich selbst auf',
      '📱 Android-Plugin erweitert (neue APK nötig, die App lädt sie selbst): FilamentNotify gibt die angetippte Mitteilung an die Oberfläche',
      '🔢 Aktualisierte Zahlen-FunFacts: 74 Commits und 101 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.102',
    label: '1.102 (App & Desktop getrennt, Seitenleiste, neues Design)',
    releaseDate: '29.10.2026',
    description: 'App und Desktop sind jetzt wirklich getrennt: Die App zeigt nur App-Dinge, am PC bleibt das Menü dauerhaft an der Seite. Spulenansicht minimalistisch neu, Graphit-Dunkelmodus besser lesbar, QR/NFC-Scan öffnet direkt die Spule, neue Mitteilung „Trocknen gestoppt“.',
    features: [
      '🔢 Zählung geht bei 1.102 weiter, die 2 bleibt für ein großes Update frei',
      '📲 Scan von NFC-Tag oder QR öffnet die App und direkt die richtige Spule (Android-Link, Banner „In der App öffnen“ im Browser)',
      '🛑 Neue Mitteilung „Trocknen gestoppt“ (mit Laufzeit, fehlender Restzeit und Spulen), einzeln abschaltbar',
      '🔔 Hintergrund-Dienst in der Android-App (schaltbar), damit „Trocknen fertig“ auch bei geschlossener App aufs Handy kommt',
      '🧪 Test-Mitteilung frei wählbar: Auswahl der Art, dann „Senden“',
      '⚙️ Mitteilungs-Einstellungen sind jetzt in der Glocke (Tabs Postfach / Einstellungen), Etiketten stehen unter „Werkstatt“',
      '🖨️ Drucker-Status in Verbindungen stimmt jetzt (auch im Heimnetz-Modus), neues 3D-Drucker-Symbol',
      '🖥️ Windows-App: richtiges Logo (.ico in allen Größen) und gleiches Logo in der Kopfleiste',
      '📌 PC: Menü dauerhaft an der Seite (einklappbar, merkt sich den Zustand)',
      '📱 App: nur App-Ansicht. Raus sind Backups, G-Code-Rechner, Material-Einstellungen, Schnellaktionen, Abzug, untere Menüleiste, „App/QR“ und „Webseite öffnen“',
      '🎨 Spulenansicht neu: ruhige Kacheln mit Farbscheibe, Gewicht, Fortschritt und Chips; Aktionen klappen auf. Desktop-Dashboard mit schlanker Kennzahlen-Zeile',
      '🌙 Dunkelmodus: „4. Graphit“ (lesbares Blaugrau statt dunklem Grün), „5. Nacht“ heller beschriftet',
      '🤖 KI: neue Sparfunktion „Wo kann ich sparen?“ (Reste zuerst, doppelte Farben, Vorrat, Preise, gebundenes Geld)',
      '🔢 Aktualisierte Zahlen-FunFacts: 75 Commits und 102 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.103',
    label: '1.103 (Neue Spulen-Kacheln, Tag-Fenster & Leiste zurück)',
    releaseDate: '29.10.2026',
    description: 'Spulen ohne Kreis: Farbstreifen, großes Gewicht, Segment-Anzeige. NFC-Scan öffnet erst das Tag-Fenster mit „Spule ändern“. Die untere Leiste ist zurück. Alte Versionsnamen 2.00/2.01 sind weg, ältere Stände im Menü sind ehrlich nur Protokoll.',
    features: [
      '🧵 Spulen-Kachel neu: Farbstreifen links, großes Gewicht, 10-Segment-Füllstand, Chips für AMS, Trocknen und fast leer',
      '📲 NFC-Scan in der App öffnet erst das Tag-Fenster (Schnellaktionen ± Gramm, Tag löschen) mit Punkt „Spule ändern“',
      '🔌 Im Tag-Fenster: „Einem AMS-Slot zuweisen“ öffnet das bekannte Fenster Spule → AMS-Slot mit der Spule schon gewählt',
      '⬇️ Untere Leiste in der App zurück: Foto, NFC-Tag, Neue Spule (ohne Menü, ohne Abzug)',
      '🗂️ Versionsmenü: alte Einträge 2.00 und 2.01 entfernt. Ältere Stände zeigen ihre Beschreibung, es wird nichts vorgetäuscht umgeschaltet. Eigene Sicherungen laden weiter ihre Daten',
      '🔔 Verbindungen → Mitteilungen öffnet direkt die Einstellungen mit Test-Mitteilung',
      '🪪 Verbindungen → NFC-Leser: Schritt-für-Schritt-Anleitung',
      '🔢 Aktualisierte Zahlen-FunFacts: 76 Commits und 103 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.104',
    label: '1.104 (ESP32-Gehäuse zum Drucken)',
    releaseDate: '29.10.2026',
    description: 'Neues zweiteiliges Gehäuse für den ESP32 des NFC-Lesers: USB-Öffnung, Kabelausgang mit Kabelbinder-Entlastung, Deckel mit Lüftung, Ohren zum Anschrauben. Maße parametrisch, Passprobe im Build-Skript.',
    features: [
      '🧰 Ordner hardware/ams-nfc/case: Unterteil und Deckel als STL, parametrische SCAD-Datei, Vorschau und Anleitung',
      '📐 Maße für 38-Pin-DevKit (28,5 × 55 mm), anpassbar für 30-Pin; Passprobe prüft Board, Dupont-Stecker und USB-Stecker auf Kollisionen',
      '🔌 USB-Öffnung, oben offener Kabelausgang, Kabelbinder-Schlitze, 4 Schraubdome (M3), 2 Befestigungsohren',
      '📝 NFC-Leser-Anleitung um das Gehäuse ergänzt',
      '🔢 Aktualisierte Zahlen-FunFacts: 77 Commits und 104 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.105',
    label: '1.105 (Druck-Wächter & Auto-Aus)',
    releaseDate: '29.10.2026',
    description: 'Die App erkennt jeden Druck, auch aus Bambu Studio, Handy oder Display. Meldung beim Start, beim Öffnen nach dem Druck die Frage „Spule abziehen?“. Neu: Drucker nach dem Druck automatisch ausschalten.',
    features: [
      '▶️ Mitteilung „Druck gestartet“ (oder „Druck läuft“, wenn die App erst mitten im Druck aufgeht), mit Spule und Fertig-Uhrzeit',
      '🧾 Druck lief ohne App: beim Öffnen „Spule abziehen? Ja/Nein“, Spule aus dem aktiven Slot und Gramm vorgeschlagen',
      '⚠️ Abgebrochener Druck: Abzug wird anteilig nach Fortschritt vorgeschlagen',
      '🔌 „Nach Druck aus“: Steckdose geht aus, sobald der Druck fertig und die Düse unter 60 °C ist (spätestens 20 min)',
      '🛡️ Strom ausschalten während eines Drucks nur noch mit Rückfrage',
      '🧩 Abzug-Fenster für mehrere Spulen (mehrfarbige Drucke)',
      '🔢 Aktualisierte Zahlen-FunFacts: 78 Commits und 105 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.106',
    label: '1.106 (Fehler-Push, Feuchte & Druck-Fotos)',
    releaseDate: '29.10.2026',
    description: 'Druckerfehler als Klartext aufs Handy, Feuchte-Alarm (AMS und externer Sensor), Spulen-Check beim Start, Trocknen-Vorschlag beim Einlegen mit „Nach Druck trocknen“, Druck-Verlauf mit Foto und Verbrauchs-Statistik. „Nach Druck aus“ geht jetzt auch über Home Assistant ohne App.',
    features: [
      '⚠️ Druckerfehler (HMS) als Klartext aufs Handy: Düse verstopft, Spaghetti, AMS-Problem … mit Bereich, Stufe und Code',
      '🧐 Spulen-Check beim Druckstart: Filament reicht nicht, Material fehlt im AMS oder passt nicht zur Spule',
      '💧 Feuchte-Alarm: AMS-Messwert und externer AHT20-Sensor am ESP32 (Grenze einstellbar, Standard 40 %)',
      '☀️ Trocknen-Vorschlag beim Einlegen einer Spule + Knopf „Danach trocknen“: AMS trocknet nach dem Druck von selbst',
      '🔌 „Nach Druck aus“ wartet auf die Trocknung und läuft über eine Home-Assistant-Automation auch ohne offene App',
      '📸 Werkstatt → Drucke: jeder Druck mit Foto vom Ende, Dauer, Verbrauch und Kosten',
      '📊 Werkstatt → Statistik: Gramm und Euro pro Woche/Monat, 8-Wochen-Verlauf, Lieblingsfarben, Ø-Kosten je Druck',
      '🔧 ESPHome-Datei mit AHT20 (I2C an GPIO21/32), geprüft mit ESPHome 2026.10.1',
      '🔢 Aktualisierte Zahlen-FunFacts: 79 Commits und 106 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.107',
    label: '1.107 (Auto-Trocknen & Übersicht)',
    releaseDate: '29.10.2026',
    description: 'Feuchte-Alarm ab 25 %, das AMS trocknet ab 30 % von selbst (läuft ein Druck: danach). Feuchte-Sensor jetzt SHT40. README mit Kurzüberblick aller Funktionen.',
    features: [
      '💧 Feuchte-Alarm meldet ab 25 % (vorher 40 %)',
      '☀️ Automatisch trocknen ab 30 % AMS-Feuchte: 10 Minuten darüber, höchstens einmal am Tag, während eines Drucks erst danach',
      '🌡️ ESPHome: SHT40 als Feuchte-Sensor (AHT20 als Alternative), geprüft mit ESPHome 2026.10.1',
      '📋 README: Kurzüberblick aller Funktionen (fertig, vorbereitet, offen)',
      '🔢 Aktualisierte Zahlen-FunFacts: 80 Commits und 107 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.108',
    label: '1.108 (SHT31-Sensor)',
    releaseDate: '29.10.2026',
    description: 'ESPHome-Datei auf den gekauften Feuchte-Sensor SHT31-D umgestellt (SHT40 und AHT20 bleiben als Alternative drin).',
    features: [
      '🌡️ ESPHome: SHT31-D (platform sht3xd, Adresse 0x44) an GPIO21/32, geprüft mit ESPHome 2026.10.1',
      '📝 Anleitung und Übersicht auf SHT31-D angepasst',
      '🔢 Aktualisierte Zahlen-FunFacts: 81 Commits und 108 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.109',
    label: '1.109 (Neue Kacheln & Sensor-Box)',
    releaseDate: '29.10.2026',
    description: 'Spulen-Kacheln mit Spulen-Symbol in der Filamentfarbe und durchgehendem Balken. Zweiter Feuchte-Sensor im Raum zum Vergleich mit der Box. Mini-Box für den SHT31-D zum Drucken. Abzug mehrerer Spulen nach einem Druck repariert.',
    features: [
      '🧵 Spulen-Kachel: Spulen-Symbol links in der Filamentfarbe, die Filamentdicke zeigt den Rest',
      '📏 Durchgehender Füllstandsbalken statt 10 Segmenten',
      '🏠 Zweiter SHT31-D im Raum (eigener I2C-Bus GPIO33/25): App zeigt, ob die Box dicht ist',
      '📦 hardware/ams-nfc/sensor-box: Mini-Gehäuse 16 × 19 × 8 mm mit Lüftung, Kabel-Zugentlastung und Lasche (STL + Build-Skript mit Passprobe)',
      '🐛 Mehrere Spulen nacheinander abziehen überschreibt sich nicht mehr gegenseitig',
      '📋 README: alles Neue vom 29.10. an einer Stelle, Geplant-Liste',
      '🔢 Aktualisierte Zahlen-FunFacts: 82 Commits und 109 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.110',
    label: '1.110 (Bambu-Chips erkennen)',
    releaseDate: '29.10.2026',
    description: 'Die eigenen NFC-Leser ignorieren Bambu-RFID-Chips, damit nichts verwechselt wird. Bambu-Spulen erkennt die App stattdessen über den Chip, den das AMS selbst liest.',
    features: [
      '🚫 ESPHome: nur eigene NTAG-Tags (7-Byte-Nummer) zählen, Bambu-Chips (4-Byte) werden ignoriert und löschen nie einen Slot',
      '🏷️ Bambu-Spulen ohne eigenen Tag: Kennung vom AMS (tray_uuid) wird mit der Spule verknüpft, beim nächsten Einlegen automatisch im Slot',
      '🧠 Erstes Mal automatisch, wenn nur eine Bambu-Spule mit Material und Farbe passt, sonst nach einmal Auswählen',
      '📝 Anleitung: wo die eigenen Tags hinkommen (außen am Rand, weg vom Bambu-Chip an der Nabe)',
      '🔢 Aktualisierte Zahlen-FunFacts: 83 Commits und 110 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.111',
    label: '1.111 (Schneller & sparsamer)',
    releaseDate: '29.10.2026',
    description: 'Alte Bremsen raus: Die App zeichnet sich nicht mehr jede Sekunde komplett neu, und der Drucker-Status kommt nicht mehr doppelt. Spart Akku und macht alles flüssiger.',
    features: [
      '⚡ App tickt nur noch einmal pro Minute statt jede Sekunde (vorher wurden alle Spulen und das Drucker-Widget jede Sekunde neu gezeichnet)',
      '⏱️ Der Sekunden-Countdown auf der Spulenkarte hat einen eigenen kleinen Ticker',
      '📡 Windows-App: Drucker-Status nur noch über den Stream; Abfrage alle 3 s nur, wenn der Stream ausfällt, Stream baut sich selbst neu auf',
      '💓 Server schickt alle 10 s ein Lebenszeichen: „Drucker aus“ wird zuverlässig erkannt',
      '🔋 Android: Status-Abfrage alle 10 s statt 3 s (Daten kommen ohnehin direkt vom Drucker)',
      '🔢 Aktualisierte Zahlen-FunFacts: 84 Commits und 111 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.112',
    label: '1.112 (Bambu-Spulen anlegen)',
    releaseDate: '30.10.2026',
    description: 'Neue Bambu-Spule ins AMS gelegt: Die App fragt „Als neue Spule anlegen“ und füllt alles aus dem Chip aus, den das AMS gelesen hat (nur lesen, nichts kopiert). Bambu-Spulen brauchen keinen eigenen Tag.',
    features: [
      '🏷️ Neue Bambu-Spule im AMS: Fenster mit Sorte, Farbe, Rest-% und Slot',
      '➕ „Als neue Spule anlegen“: Formular vorausgefüllt (Name, Material, Farbe, Gewicht aus Rest-%, Düsen- und Trockentemperatur)',
      '🔗 „Ist schon in der App“: vorhandene Spule auswählen und verknüpfen',
      '💾 Die Bambu-Kennung wird an der Spule gespeichert (geht mit dem Geräte-Sync auf alle Geräte)',
      '🐛 Spule bearbeiten verliert NFC-Tag-Nummer und „NFC beschrieben“ nicht mehr',
      '📝 Anleitung: eigene Leser nicht direkt auf den Bambu-Leser, Tags nur für andere Marken',
      '🔢 Aktualisierte Zahlen-FunFacts: 85 Commits und 112 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.113',
    label: '1.113 (Leser-Einbau)',
    releaseDate: '30.10.2026',
    description: 'Neue Einbau-Anleitung für die NFC-Leser im AMS 2 Pro: an die Trennwände und die linke Außenwand statt an die Bambu-Leser.',
    features: [
      '📍 Je Slot ein Leser: Slot 1 linke Außenwand, Slot 2–4 an der Trennwand links davon',
      '🏷️ Tag links außen auf die Spule (1–3 cm vom Rand), gelesen wird beim Drehen',
      '🧲 Ferrit-Folie hinter jedem Leser, damit nicht der Nachbar-Slot gelesen wird',
      '🔢 Aktualisierte Zahlen-FunFacts: 86 Commits und 113 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.114',
    label: '1.114 (Halter 5 mm)',
    releaseDate: '30.10.2026',
    description: 'Neuer Leser-Halter für das AMS: 5 mm dick, damit die Antenne Abstand zur Wand hat.',
    features: [
      '🖨️ rc522_holder.stl: 44 × 64 × 5 mm, PETG/ASA, flach drucken',
      '🧲 Mulde unten für Ferrit-Folie, nur nötig wenn der Leser den Nachbar-Slot mitliest',
      '📎 Dünne Version (2,4 mm) bleibt als rc522_holder_flach.stl',
      '🔢 Aktualisierte Zahlen-FunFacts: 87 Commits und 114 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.115',
    label: '1.115 (Aufbau-Anleitung)',
    releaseDate: '30.10.2026',
    description: 'Komplette Aufbau-Anleitung als PDF mit Verkabelungs-Diagrammen für ESP32, 5 NFC-Leser und Feuchte-Sensor.',
    features: [
      '📐 4 Diagramme: Testaufbau mit 1 Leser, alle 5 Leser, Feuchte-Sensor, Einbau im AMS',
      '📄 AUFBAU.pdf und AUFBAU.md: Teileliste, Pin-Tabellen, Aufspielen, Testen, Fehlersuche',
      '✅ ESPHome-Datei neu geprüft (gültig), alle STL-Dateien dicht',
      '🔢 Aktualisierte Zahlen-FunFacts: 88 Commits und 115 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.116',
    label: '1.116 (Extern-Spule setzen)',
    releaseDate: '30.10.2026',
    description: 'Wählst du eine Spule für Extern (5.), setzt die App Material und Farbe auch am Drucker.',
    features: [
      '🧵 Spule für Extern (5.) wählen → Farbe, Material und Temperatur gehen an den Drucker',
      '✅ Die App prüft, ob der Drucker die externe Spule wirklich übernommen hat, und meldet es ehrlich',
      '⏭️ Passt die Spule schon zum Drucker, wird nichts gesendet',
      '🔢 Aktualisierte Zahlen-FunFacts: 89 Commits und 116 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.117',
    label: '1.117 (NFC-Slot am Drucker & Sync)',
    releaseDate: '30.10.2026',
    description: 'NFC-Leser setzt den Slot jetzt zuverlässig am Drucker, meldet Fehler ehrlich und gibt die Zuordnung sofort an PC und Handy weiter.',
    features: [
      '🧵 NFC-Leser nutzt denselben Weg wie das manuelle Zuweisen (gleiche Farbe, Material, Temperaturen)',
      '📣 Fehler werden gemeldet statt verschluckt, neuer Versuch nach 60 s',
      '📡 Meldung zeigt die echte Verbindung: „direkt per LAN“ oder „Bambu Cloud“ (vorher immer Cloud-Text)',
      '🔁 Steht LAN im Menü, läuft aber die Cloud: App schaltet einmal auf LAN um und sendet erneut',
      '🧹 Alter „Befehl nicht verifiziert“-Fehler im Drucker zählt nicht mehr als Ablehnung',
      '🔄 Slot-Zuordnung geht sofort an die anderen Geräte, PC zeigt sie ohne Neuladen',
      '🔢 Aktualisierte Zahlen-FunFacts: 90 Commits und 117 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.118',
    label: '1.118 (Tag beschreiben & Spule ändern)',
    releaseDate: '30.10.2026',
    description: 'Tag beschreiben und löschen wartet im selben Fenster auf den Tag und legt sofort los. „Spule ändern“ zeigt alle Spulen zur Auswahl.',
    features: [
      '🏷️ „Beschreiben“ und „Löschen“ warten im selben Fenster auf den Tag (kein extra Fenster) und schreiben sofort, sobald er am Handy ist',
      '🛠️ Fehler behoben: Der Lese-Scan lief beim Schreiben weiter und fing den Tag ab, Fehler und Wartestand waren unsichtbar',
      '📣 Fehler und Erfolg stehen jetzt im Fenster, bei verrutschtem Tag bis zu 6 Versuche, „Abbrechen“ beendet das Warten',
      '🧵 „Spule ändern“ öffnet die Auswahl aller Spulen mit Suche, der Tag wird auf die gewählte Spule umgeschrieben',
      '✏️ Der alte Knopf zum Bearbeiten der Spulendaten heißt jetzt „Spule bearbeiten“',
      '🔢 Aktualisierte Zahlen-FunFacts: 91 Commits und 118 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.119',
    label: '1.119 (QR öffnet App & Spule)',
    releaseDate: '30.10.2026',
    description: 'QR-Etikett scannen öffnet die App und zeigt gleich die passende Spule.',
    features: [
      '📱 QR im Handy-Browser: die Seite startet die App von selbst (Knopf „Diese Spule direkt in der App öffnen“ bleibt als Reserve)',
      '🧵 QR-Scan in der App zeigt direkt die passende Spule im Tag-Fenster (Gramm ±, Spule ändern, AMS-Slot zuweisen), wie beim NFC-Tag',
      '🔗 Gilt für Etiketten-QR, App-Link und Tipp auf eine Spulen-Mitteilung',
      '🔢 Aktualisierte Zahlen-FunFacts: 92 Commits und 119 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.120',
    label: '1.120 (NFC-Schreiben stabil)',
    releaseDate: '30.10.2026',
    description: 'Fehler „Tag is out of date“ beim Beschreiben behoben: Android erkennt den Tag nicht mehr ständig neu.',
    features: [
      '🛠️ Ursache: Der NFC-Leser wurde bei jedem Scan-Stopp, Schreiben und alle 15 s neu gestartet, dabei wurde der Tag neu erkannt und der Schreibzugriff war veraltet',
      '📲 Android-Teil: Leser startet nur noch bei einer echten Änderung neu, veralteter Tag wird nicht mehr als Fehler gemeldet, Ergebnis wird nur einmal gemeldet (neue APK nötig)',
      '🔇 App-Teil: Scan-Stopp startet den Leser nicht mehr neu (wirkt auch ohne neue APK etwas besser)',
      '📣 Verständliche Meldung statt „Permission Denial“',
      '🔢 Aktualisierte Zahlen-FunFacts: 93 Commits und 120 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.121',
    label: '1.121 (QR zeigt Tag-Fenster)',
    releaseDate: '30.10.2026',
    description: 'QR-Link öffnet immer das Tag-Fenster der Spule (nicht das Bearbeiten-Formular), auch wenn die Webseite noch einen alten Stand im Cache hatte.',
    features: [
      '🔄 Beim Öffnen eines QR-Links (#s=ID) sucht die Webseite sofort nach der neuesten Version und lädt sie von selbst nach',
      '🧵 Danach erscheint das Fenster „Tag erfolgreich gelesen & zugeordnet“ mit Gramm ±, Spule ändern und AMS-Slot',
      '🔢 Aktualisierte Zahlen-FunFacts: 94 Commits und 121 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.122',
    label: '1.122 (Aus vor Trocknen)',
    releaseDate: '30.10.2026',
    description: '„Nach Druck aus“ ist jetzt stärker als „Nach Druck trocknen“: der Drucker geht aus, es wird nicht mehr nachgetrocknet.',
    features: [
      '⏻ „Nach Druck aus“ wählen → „Danach trocknen“ wird automatisch abgewählt',
      '🚫 „Danach trocknen“ (auch der Vorschlag beim Einlegen) geht nicht, solange „Nach Druck aus“ gewählt ist, mit klarer Meldung',
      '🏠 Die Home-Assistant-Automation „Aus nach Druck“ läuft jetzt immer mit, wenn gewählt',
      '💧 Eine bereits laufende Trocknung (Jetzt trocknen) wird weiter abgewartet',
      '🔢 Aktualisierte Zahlen-FunFacts: 95 Commits und 122 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.123',
    label: '1.123 (Aus beendet Trocknen)',
    releaseDate: '30.10.2026',
    description: '„Nach Druck aus“ gilt immer: läuft noch eine Trocknung, wird sie beendet, das AMS läuft aus und dann geht der Drucker aus.',
    features: [
      '⏻ Aus nach Druck + Trocknung läuft: App beendet die Trocknung (wiederholt es jede Minute, falls der Drucker nicht reagiert)',
      '⏳ Danach 3 Minuten warten, bis das AMS ausgelaufen ist und die Ventile zu sind, dann Steckdose aus',
      '🛟 Reagiert der Drucker gar nicht, wird spätestens nach 30 Minuten trotzdem ausgeschaltet',
      '🌫️ Meldet der Feuchte-Sensor „muss trocknen“, wird bei gewähltem Aus nicht mehr automatisch getrocknet',
      '🔢 Aktualisierte Zahlen-FunFacts: 96 Commits und 123 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.124',
    label: '1.124 (Druck-Planer & Box-Klima)',
    releaseDate: '30.10.2026',
    description: 'Fenster bei neuem Druck (danach trocknen / aus / verzögern) und Box- plus AMS-Klima in °C unter dem AMS.',
    features: [
      '🪟 Neuer Druck: beim Öffnen der App kommt ein Fenster mit „Danach ausschalten“, „Danach trocknen“ und „Druck verzögern“. Nichts gewählt = Druck läuft normal',
      '⏱️ Verzögern: in 1/2/3/4 h, eigene Zeit (Stunden + Minuten) oder um eine Uhrzeit. Die App pausiert den Druck und setzt ihn zur Zeit fort, mit Leiste „Jetzt fortsetzen / Abbrechen“',
      '☀️ Lief die AMS-Trocknung, geht sie beim Fortsetzen aus und startet nach dem Druck mit der Restzeit wieder (außer „Nach Druck aus“ ist gewählt, das gewinnt)',
      '🌡️ Unter dem AMS: Box-Sensor (gemessen) und AMS misst, jeweils Temperatur und Feuchte',
      '🇩🇪 Temperatur immer in °C: Fahrenheit aus Home Assistant wird umgerechnet',
      '🔢 Aktualisierte Zahlen-FunFacts: 97 Commits und 124 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.125',
    label: '1.125 (Sensor alle 10 s)',
    releaseDate: '30.10.2026',
    description: 'Box- und Raum-Sensor messen und die App liest sie jetzt alle 10 Sekunden.',
    features: [
      '⏱️ ESP32: SHT31-D misst alle 10 s statt alle 60 s (neu aufspielen nötig)',
      '📲 App: liest die Sensorwerte aus Home Assistant alle 10 s statt alle 2 min',
      '🔢 Aktualisierte Zahlen-FunFacts: 98 Commits und 125 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.126',
    label: '1.126 (FunFacts-Zähler)',
    releaseDate: '30.10.2026',
    description: 'Codezeilen zeigten 0 (Desktop-Build, Windows-Pfad). Zähler repariert, FunFacts-Zahlen neu geprüft.',
    features: [
      '🛠️ Ursache: Beim Bauen unter Windows (Desktop-App) wurde der Projektordner falsch gelesen, deshalb „0 Zeilen“',
      '🔢 Codezeilen werden jetzt mit dem richtigen Pfad gezählt (mit zweitem Versuch vom Arbeitsordner)',
      '📊 Commits live bei GitHub geprüft (100), Nachrichten und Wörter nachgezählt, Versionen zählt die App selbst (126)'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.127',
    label: '1.127 (Silica-Beutel 57 g)',
    releaseDate: '30.10.2026',
    description: 'Silica-Trockenbeutel (57 g) als Wiege-Option: Das Gewicht wird beim Wiegen automatisch mit abgezogen.',
    features: [
      '🧂 Spule bearbeiten: neuer Schalter „Mit Silica-Beutel (57 g)“, wird bei der Spule gespeichert',
      '⚖️ Spulenkachel (Wiegen): Kästchen „Mit Silica-Beutel (+57g)“, Tara = Leerspule + Eibos + Silica',
      '🔧 Gewicht einstellbar in den Einstellungen (silicaBagTara, Standard 57 g)',
      '🔢 Aktualisierte Zahlen-FunFacts: 101 Commits und 127 Revisionsstufen'
    ],
    spoolsSnapshot: DEFAULT_21_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.128',
    label: '1.128 (Neue Spulenliste)',
    releaseDate: '30.10.2026',
    description: 'Alle Spulen neu eingetragen nach deinem Diktat (17 neu, Prusa PETG bleibt), mit Beutel- und Silica-Abzug.',
    features: [
      '🧵 18 Spulen: Bambu (7), Eono, Geeetech, YXPOLYER PA6-CF, Eryone (2), ELEGOO (2), eSUN, Overture TPU, Prusa PLA und Prusa PETG',
      '⚖️ Netto = gewogen − Leerspule − Eibos-Beutel (35 g) − Silica (57 g), bei Bambu Hellgrün mit eigener 100-g-Spule',
      '📦 Original verpackte Bambu-Spulen als „verschweißt“ markiert, Refill ohne Spule mit 0 g Leerspule',
      '🔢 Aktualisierte Zahlen-FunFacts: 106 Commits und 128 Revisionsstufen'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.129',
    label: '1.129 (Hellgrün 1 kg)',
    releaseDate: '30.10.2026',
    description: 'Bambu Hellgrün ist eine 1-kg-Spule: Startgewicht 1000 g statt 1200 g, Spule steht auf voll.',
    features: [
      '🟢 Bambu PLA Basic Hellgrün: Startgewicht 1000 g, Restgewicht 1000 g (voll)',
      '⚠️ Gewogene 1315 g ergeben rechnerisch mehr als 1 kg: Gewicht von Beutel/Silica prüfen',
      '🔢 Aktualisierte Zahlen-FunFacts: 107 Commits und 129 Revisionsstufen'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.130',
    label: '1.130 (Hellgrün leer, +1 Bambu Weiß)',
    releaseDate: '30.10.2026',
    description: 'Bambu Hellgrün: alles abgezogen, 1315 g Brutto = 1000 g Netto. Eine weitere Bambu PLA Weiß mit Spule (original verpackt) dazu.',
    features: [
      '🟢 Hellgrün (1 kg): Tara gesamt 315 g (Spule 223 + Beutel 35 + Silica 57), beim nächsten Wiegen passt die Rechnung',
      '⚪ Neu: Bambu PLA Basic Weiß, original verpackt, mit Spule (insgesamt 4 weiße Bambu PLA)',
      '🔢 Aktualisierte Zahlen-FunFacts: 108 Commits und 130 Revisionsstufen'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.131',
    label: '1.131 (Bambu Weiß 3 Stück)',
    releaseDate: '30.10.2026',
    description: 'Korrektur: nur 3 Bambu PLA Weiß (2 ohne Spule, 1 mit Spule). Hellgrün mit echter Tara 100 + 35 + 57 g.',
    features: [
      '⚪ Bambu PLA Basic Weiß: wieder 3 Stück (2 Refill ohne Spule, 1 mit Spule)',
      '🟢 Hellgrün (1 kg, eigene 100-g-Spule): Tara 100 g + Beutel 35 g + Silica 57 g = 192 g, wird beim Wiegen abgezogen',
      '⚠️ 1315 g gewogen − 192 g = 1123 g ist mehr als 1 kg: Spule steht auf voll, bitte neu wiegen',
      '🔢 Aktualisierte Zahlen-FunFacts: 109 Commits und 131 Revisionsstufen'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.132',
    label: '1.132 (Hellgrün 960 g, Isan zurück)',
    releaseDate: '30.10.2026',
    description: 'Bambu Hellgrün auf 960 g gesetzt. Isan PLA Plus Dunkelgrün wieder in der Liste, getrennt von Bambu Dunkelgrün.',
    features: [
      '🟢 Bambu PLA Basic Hellgrün: Restgewicht 960 g (Spule 100 g, Beutel 35 g, Silica 57 g bleiben als Tara)',
      '🌲 Isan PLA Plus Dunkelgrün (alter Stand 740 g) wieder dabei, war im Diktat vergessen worden',
      '🔀 Zwei Dunkelgrün sind getrennte Spulen: Bambu Lab PLA Basic und Isan PLA Plus, je eigene Nummer und Marke',
      '🔢 Aktualisierte Zahlen-FunFacts: 110 Commits und 132 Revisionsstufen'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.133',
    label: '1.133 (Verzögerter Druck startet sicher)',
    releaseDate: '31.10.2026',
    description: 'Druck verzögern: Der pausierte Druck wird jetzt sicher fortgesetzt, auch wenn die Trocknung hängt, die App zu ist oder der Drucker die Startzeit erst später meldet.',
    features: [
      '🧩 Plan geht nicht mehr verloren: Meldet der Drucker Name oder Startzeit erst nach dem Pausieren, bleibt es derselbe Auftrag',
      '⏱️ Hängt die Trocknung beim Fortsetzen, wird nach 90 Sekunden trotzdem fortgesetzt (der Drucker beendet sie beim Start selbst)',
      '🛟 Sicherheitsnetz im Drucker-Kern: 90 Sekunden nach der Zeit setzt er den Druck auch bei geschlossener App fort',
      '⚠️ Klappt Fortsetzen dreimal nicht, kommt eine Meldung „Bitte am Drucker fortsetzen“',
      '🔢 Aktualisierte Zahlen-FunFacts: 111 Commits und 133 Revisionsstufen'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.134',
    label: '1.134 (Kamera & AMS neu angeordnet)',
    releaseDate: '31.10.2026',
    description: 'Kamera ohne Überlappung, flüssiger und mit Groß-Knopf. AMS-Temperatur und Feuchte als saubere Karten.',
    features: [
      '📷 Kamera aufgeräumt: keine Texte mehr über dem Bild, nur LIVE und ein Groß-Knopf; Knöpfe in eigener Zeile',
      '🔍 Neuer Vollbild-Modus für die Kamera (Knopf „Groß“), Schließen mit Knopf, Tippen aufs Schwarze oder Esc',
      '🎞️ Flüssiger: Das nächste Bild wird sofort geholt (vorher alle 3 s), vorher fertig geladen, kein Flackern; pausiert bei verdecktem Fenster',
      '🌡️ AMS-Trocknung: Box-Sensor und AMS als zwei Karten mit großer Temperatur und Feuchte (Farbe nach Feuchte), Restzeit in eigener Zeile',
      '🔢 Aktualisierte Zahlen-FunFacts: 112 Commits und 134 Revisionsstufen'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.135',
    label: '1.135 (Ext. Trockner-Sensor)',
    releaseDate: '31.10.2026',
    description: 'Zweiter Sensor sitzt im externen Spulentrockner (5. Spule) statt im Raum: umbenannt und unter dem AMS angezeigt.',
    features: [
      '🧺 Zweiter SHT31-D heißt jetzt „Trockner“ (ESP32: Trockner Temperatur / Trockner Feuchte, Home Assistant: …_trockner_feuchte und …_trockner_temperatur)',
      '🌡️ Unter dem AMS neue Karte „Ext. Trockner (5. Spule)“ mit Temperatur in °C und Feuchte, neben Box-Sensor und AMS',
      '⚙️ Einstellungen: „Sensor im externen Spulentrockner“, der alte Raum-Name wird automatisch umgestellt; Vergleich „Box dicht?“ entfernt',
      '🔌 Neuer Verdrahtungsplan (Gesamtbild + Lötplan + Aufbau-PDF) mit Trockner-Sensor',
      '🔢 Aktualisierte Zahlen-FunFacts: 113 Commits und 135 Revisionsstufen'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.136',
    label: '1.136 (Trocknung bleibt an, Spulen bleiben)',
    releaseDate: '31.10.2026',
    description: 'Die App stoppt die Trocknung nicht mehr dauernd und überschreibt deine Spulen-Änderungen nicht mehr mit einem alten Stand.',
    features: [
      '🔥 Trocknung stoppen: „Aus nach Druck“ und „Druck verzögern“ stoppen sie nur noch einmal, nicht mehr jede Minute',
      '🙋 Startest du die Trocknung danach selbst neu, wird „Aus nach Druck“ abgewählt und der Drucker bleibt an',
      '🧹 Vergessener „Aus nach Druck“-Schalter (über 36 Stunden alt) wird verworfen',
      '📝 Im Log steht jetzt, wer die Trocknung gestoppt hat (Quelle)',
      '💾 Spulen-Änderungen: Der Cloud-Abgleich schrieb manchmal einen alten Stand zurück, wenn du gerade bearbeitet hast. Behoben',
      '🔢 Aktualisierte Zahlen-FunFacts: 114 Commits und 136 Revisionsstufen'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.137',
    label: '1.137 (Aus nach Druck: 3 Minuten)',
    releaseDate: '31.10.2026',
    description: 'Aus nach Druck wartet nicht mehr auf die Düsentemperatur, sondern schaltet 3 Minuten nach Druckende ab.',
    features: [
      '⏱️ Aus nach Druck: Steckdose geht 3 Minuten nach „Druck fertig“ aus, egal wie heiß die Düse ist',
      '🏠 Auch die Home-Assistant-Automation (App zu) nutzt jetzt feste 3 Minuten und wird beim nächsten Mal automatisch erneuert',
      '🔢 Aktualisierte Zahlen-FunFacts: 116 Commits und 137 Revisionsstufen'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.138',
    label: '1.138 (Standardfarbe Dunkelgrün)',
    releaseDate: '31.10.2026',
    description: 'Dunkelgrün ist jetzt bei den Standardfarben dabei (Spule anlegen und AMS-Slot bearbeiten).',
    features: [
      '🟢 Neue Standardfarbe Dunkelgrün in der Spulen-Eingabe',
      '🟢 Dunkelgrün auch in den Bambu-Farben beim AMS-Slot',
      '🔢 Aktualisierte Zahlen-FunFacts: 117 Commits und 138 Revisionsstufen'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.139',
    label: '1.139 (Weniger Push, Open Source)',
    releaseDate: '31.10.2026',
    description: 'Aufs Handy kommt nur noch das Wichtige. Dialoge des Druckers (Düse wechseln, Filament einlegen, „fortsetzen?“) melden wir nicht mehr. Dazu ist das Projekt bereit für Open Source (Lizenz, Anleitung, ohne persönliche Daten).',
    features: [
      '🔕 Push aufs Handy nur noch für: Druck fertig, Druck fehlgeschlagen, schwere Druckerfehler, Trocknung fertig. Alles andere landet nur im Postfach',
      '⚙️ Neuer Schalter „Auch weniger wichtige als Benachrichtigung“ (Standard aus) und „Auch Hinweise und Dialoge melden“ (Standard aus)',
      '🛠️ Druckerfehler: nur schwere Meldungen während eines Drucks und erst, wenn sie 1 Minute anstehen. Keine Dialoge mehr bei Düsenwechsel oder Filament einlegen',
      '🧾 Gleicher Fehler höchstens alle 6 Stunden',
      '🌍 Open Source: MIT-Lizenz, neue README mit Schnellstart für Forks, CONTRIBUTING und SECURITY',
      '🔒 Keine persönlichen Daten mehr im Projekt: eigene Spulenliste nur noch lokal (mySpools.local.ts), keine feste Drucker-IP, keine feste Cloud- und Git-Adresse',
      '☁️ Neue Geräte starten ohne Cloud (nur lokal). Cloud-Sync richtet man selbst mit einem privaten Gist ein',
      '🤖 Workflows passen sich dem eigenen Repository an (Seite, APK, Windows-App, Update-Quelle)',
      '🔑 APK-Signierung über eigenes Secret möglich, sonst wird ein Schlüssel für den Build erzeugt',
      '🧪 Tests (vitest) für die neue Push- und Fehler-Logik, laufen in der CI mit',
      '🔢 Aktualisierte Zahlen-FunFacts: 118 Commits und 139 Revisionsstufen'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.140',
    label: '1.140 (Pin-Namen D16/D17)',
    releaseDate: '31.10.2026',
    description: 'Auf deinem ESP32 gibt es kein „TX2/RX2“: GPIO17 steht als D17 und GPIO16 als D16 auf der Platine. Pläne und Anleitung zeigen jetzt diese Namen.',
    features: [
      '🔌 Verdrahtungsplan, Lötplan und Aufbau-Anleitung: „TX2“ wurde zu D17 (Leser 2) und „RX2“ zu D16 (Leser 3)',
      '📄 Aufbau-PDF und alle Bilder neu erzeugt, Hinweis: bei anderen Boards heißen D17/D16 TX2/RX2, es ist derselbe Pin',
      '🔢 Aktualisierte Zahlen-FunFacts: 119 Commits und 140 Revisionsstufen'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.141',
    label: '1.141 (Trocknen: Aus & Licht)',
    releaseDate: '01.11.2026',
    description: 'Beim Trocknen kann der Drucker danach von selbst ausgehen, das Bauraum-Licht geht aus, wenn nichts gedruckt wird, und die externe Trockenbox hat ihren Sensor in der Trocknen-Ansicht.',
    features: [
      '🔌 Neuer Schalter „Danach Drucker ausschalten“ beim Trocknen (Steckdose geht aus, wenn die Trocknung fertig ist und nicht gedruckt wird)',
      '💡 Neuer Schalter „Licht beim Trocknen aus“: Bauraum-Licht geht aus, solange getrocknet und nicht gedruckt wird (Standard an)',
      '🌡️ Trockenbox-Sensor (extern) heißt jetzt überall „Trockenbox“ und steht in der Trocknen-Ansicht',
      '📱 LOGS-Streifen am Handy kleiner, ohne senkrechten Text',
      '🧪 15 neue Tests für die Abschalt-Regeln'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.142',
    label: '1.142 (Leser schneller)',
    releaseDate: '01.11.2026',
    description: 'Die 5 NFC-Leser im AMS fragen 4x schneller nach Tags und funken langsamer, aber stabiler über die Kabel.',
    features: [
      '⚡ Leser fragen alle 250 ms statt 1 s nach einem Tag (Spule wird viel schneller erkannt)',
      '📡 SPI-Takt von 4 MHz auf 1 MHz: weniger Aussetzer bei langen oder wackeligen Kabeln',
      '📝 Hinweis in der Firmware: Tags mit 4-Byte-UID (MIFARE Classic/Bambu) werden absichtlich ignoriert, mit own_uid_min "11" gehen auch die',
      '🌡️ Sensoren: Firmware fragt alle 10 s, die „5 Minuten“ im Verlauf sind nur die Zusammenfassung von Home Assistant'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.143',
    label: '1.143 (Aus ohne App)',
    releaseDate: '01.11.2026',
    description: '„Nach Trocknen ausschalten“ klappt jetzt auch bei geschlossener App: Home Assistant schaltet die Steckdose selbst aus.',
    features: [
      '🔌 Die App legt dafür einmal automatisch eine Home-Assistant-Automation an (wie bei „Nach Druck aus“)',
      '⏱️ 3 Minuten nach Trocknungsende geht die Steckdose aus, nur wenn nicht gedruckt wird',
      '🛑 Startet vorher ein Druck, schaltet sich die Automation selbst ab, der Drucker bleibt an',
      '📝 Braucht in Home Assistant die Bambu-Lab-Integration mit „Rest-Trockenzeit“ des AMS, sonst schaltet die App selbst aus, solange sie läuft'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.144',
    label: '1.144 (Aus-Status sichtbar)',
    releaseDate: '01.11.2026',
    description: 'Bei „Danach Drucker ausschalten“ siehst du jetzt, ob Home Assistant das Ausschalten übernimmt (ohne offene App). Mit „Prüfen“ richtest du es neu ein.',
    features: [
      '✅ Statuszeile unter „Danach Drucker ausschalten“: Home Assistant bereit oder Grund, warum nicht',
      '🔁 Knopf „Prüfen“: sucht den AMS-Trockenzeit-Sensor und legt die Automation neu an'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.145',
    label: '1.145 (HA-Fehler klarer)',
    releaseDate: '01.11.2026',
    description: 'Wenn Home Assistant nicht erreichbar ist, zeigt die App jetzt die genutzte Adresse und sagt, was zu prüfen ist.',
    features: [
      '🔎 Statuszeile bei „Danach Drucker ausschalten“ nennt die Home-Assistant-Adresse und den wahrscheinlichen Grund'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.146',
    label: '1.146 (HA-Automation kopieren)',
    releaseDate: '01.11.2026',
    description: 'Home Assistant ist erreichbar, erlaubt der App aber nicht, Automationen anzulegen. Jetzt gibt es einen Knopf, der die Automation kopiert, du fügst sie einmal in Home Assistant ein.',
    features: [
      '📋 Knopf „Automation kopieren“ bei „Danach Drucker ausschalten“',
      '🔎 „Prüfen“ erkennt eine von Hand eingefügte Automation und schaltet sie danach selbst an und aus',
      '💬 Klare Meldung statt „nicht erreichbar“, wenn nur das Anlegen gesperrt ist'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.147',
    label: '1.147 (HA-Fehler mit Schritt)',
    releaseDate: '01.11.2026',
    description: 'Die Meldung zu „Danach Drucker ausschalten“ nennt jetzt den Schritt und den genauen Fehler. Home-Assistant-Anfragen dürfen länger dauern (25 s).',
    features: [
      '🔎 Meldung zeigt Schritt (Sensoren lesen, Automation anlegen) und Fehlertext',
      '⏱️ Zeitgrenze für Home-Assistant-Anfragen von 12 auf 25 Sekunden'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.148',
    label: '1.148 (Windows-App groß)',
    releaseDate: '01.11.2026',
    description: 'Die Windows-App startet immer maximiert. Mit F11 schaltest du echten Vollbild an und aus.',
    features: [
      '🖥️ Windows-App öffnet immer im großen Fenster',
      '⌨️ F11: echter Vollbild an/aus'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.149',
    label: '1.149 (Home Assistant über Server)',
    releaseDate: '01.11.2026',
    description: 'Die Windows-App erreicht Home Assistant jetzt auch dann, wenn der Browser Nabu Casa direkt sperrt: Anfragen laufen über den eingebauten Server. Damit kann „Nach Trocknen aus“ die Automation selbst anlegen.',
    features: [
      '🔌 Home-Assistant-Anfragen laufen bei Sperre über den eigenen Server (nur Zustände lesen, FilamentHub-Automationen anlegen, Automationen ein-/ausschalten)',
      '🤖 „Danach Drucker ausschalten“ und „Nach Druck aus“ legen ihre Automation damit selbst an'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.150',
    label: '1.150 (Trockenzeit-Sensor finden)',
    releaseDate: '01.11.2026',
    description: 'Die App sucht den Trockenzeit-Sensor in Home Assistant breiter und zeigt in der Meldung, was sie gefunden hat.',
    features: [
      '🔍 Breitere Suche nach dem AMS-Trockenzeit-Sensor (auch deutsche Namen)',
      '📋 Meldung nennt gefundenen Druckstatus-Sensor und ähnliche Trocken-Sensoren'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.151',
    label: '1.151 (Deutsche HA-Namen)',
    releaseDate: '01.11.2026',
    description: 'Home Assistant mit deutschen Sensornamen (Druckstatus, Verbleibende Trocknungszeit) wird erkannt. Dafür hat die App den Druckstatus-Sensor nicht gefunden.',
    features: [
      '🇩🇪 Druckstatus und Düsentemperatur werden auch mit deutschen Namen gefunden',
      '🔧 Gilt für „Danach Drucker ausschalten“ und „Nach Druck aus“'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.152',
    label: '1.152 (Aus-Timer, dauerhaft)',
    releaseDate: '01.11.2026',
    description: '„Danach Drucker ausschalten“ bleibt jetzt dauerhaft an und gilt für jede Trocknung. Nach dem Ende läuft ein 3-Minuten-Zähler mit Abbrechen-Knopf. Stoppst du die Trocknung von Hand, bleibt der Drucker an.',
    features: [
      '🔁 Schalter bleibt nach dem Ausschalten an, bis du ihn selbst ausmachst',
      '⏱️ 3-Minuten-Zähler „Drucker geht aus in 2:41“ mit Knopf „Abbrechen“ (nur dieses Mal)',
      '⏹️ Trocknung von Hand stoppen: kein Ausschalten, der Schalter bleibt an',
      '🏠 Home-Assistant-Automation passend umgebaut (erkennt nur echtes Trocknungsende, wird beim Prüfen automatisch aktualisiert)'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.153',
    label: '1.153 (Stopp startet Timer)',
    releaseDate: '01.11.2026',
    description: 'Stoppst du die Trocknung von Hand, startet der 3-Minuten-Zähler und der Drucker geht danach aus (Abbrechen geht). Beginnt in den 3 Minuten ein Druck oder eine neue Trocknung, wird automatisch nichts ausgeschaltet.',
    features: [
      '⏹️ Trocknung von Hand stoppen = Ende: 3-Minuten-Zähler startet, danach geht der Drucker aus',
      '🛑 „Abbrechen“ im Zähler gilt nur für dieses Mal',
      '🤝 Neuer Druck oder neue Trocknung in den 3 Minuten bricht das Ausschalten selbst ab (auch in Home Assistant)'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.154',
    label: '1.154 (Zähler läuft weiter)',
    releaseDate: '01.11.2026',
    description: 'Der 3-Minuten-Zähler läuft auch weiter, wenn du die App schließt und wieder öffnest (z. B. nach 1 Minute zeigt er noch 2 Minuten). Arbeitest du am Drucker (verfahren, Düse wechseln, aufheizen), wird das Ausschalten abgebrochen.',
    features: [
      '⏱️ Zähler nimmt den Stand von Home Assistant, auf jedem Gerät gleich, auch nach App zu und wieder auf',
      '🛠️ Abbruch, wenn du den Drucker verfährst, bedienst, aufheizt oder Düse/Filament wechselst',
      '🏠 Home-Assistant-Automation erkennt Arbeitsschritt und Zieltemperaturen (beim Prüfen automatisch aktualisiert)'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.155',
    label: '1.155 (Stehende Mitteilung)',
    releaseDate: '01.11.2026',
    description: 'Android: Solange gedruckt oder getrocknet wird, steht oben eine leise Mitteilung mit Balken, Prozent, Restzeit und der Uhrzeit, wann es fertig ist. Auch der 3-Minuten-Zähler vor dem Ausschalten steht dort.',
    features: [
      '📌 Stehende Mitteilung für Druck und Trocknung mit Fortschrittsbalken',
      '🕒 Zeigt „Fertig 17:42 Uhr · noch 1 h 12 min“, die Zeit zählt die Mitteilung selbst herunter',
      '⏱️ Auch der Aus-Zähler „Drucker geht aus in 2:41“ steht dort',
      '⚙️ Schalter „Stehende Mitteilung (Android)“ bei den Benachrichtigungen (Standard an)',
      '📲 Braucht die neue Android-App (APK), der Android-Teil wurde erweitert'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.156',
    label: '1.156 (Einstellungen & Live)',
    releaseDate: '01.11.2026',
    description: 'Die stehende Mitteilung steht weiter oben (Android-16-Live-Update) und nutzt die Farbe deiner App. Zahlenfelder lassen sich überall frei tippen. Alle festen Zeiten und Grenzen sind jetzt einstellbar.',
    features: [
      '📌 Live-Mitteilung höher und leise (Standard-Wichtigkeit ohne Ton), mit Kurztext in der Statusleiste (Android 16)',
      '🎨 Mitteilung in der gewählten App-Farbe, mit Symbolen im Titel',
      '⌨️ Zahlenfelder in der ganzen App: leeren und neu tippen geht, kein Zurückspringen auf Standardwerte mehr',
      '⚙️ Neue Karte „Zeiten und Grenzen“: Feuchte-Alarm (Wartezeit, Wiederholung), Auto-Trocknen (Wartezeit, Pause), Aus-Wartezeit nach Trocknen, „fast leer“ beim Spulen-Check',
      '📲 Neue Android-App (APK) nötig für die Live-Mitteilung'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.157',
    label: '1.157 (Auto-Prüfen)',
    releaseDate: '01.11.2026',
    description: 'Home Assistant wird bei jedem App-Start von selbst geprüft und die Automation „Nach Trocknen aus“ eingerichtet. Der Knopf „Prüfen“ ist weg und erscheint nur noch, wenn etwas nicht klappt.',
    features: [
      '🔄 Beim Öffnen der App: Sensoren suchen, Automation anlegen oder aktualisieren, an/aus passend zum Schalter',
      '🙈 Kein Prüfen-Knopf mehr nötig, die Statuszeile erscheint nur noch bei einem Problem (mit „Nochmal prüfen“)'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.158',
    label: '1.158 (Warteschlange & Widget)',
    releaseDate: '01.11.2026',
    description: 'Neu: Druck-Warteschlange in der Werkstatt (vormerken, Filament-Check, Mitteilung mit dem Nächsten nach jedem Druckende) und ein Homescreen-Widget für Android mit Druck-/Trocknungsstand und AMS-Feuchte.',
    features: [
      '📋 Werkstatt > Warteschlange: Aufträge mit Name, Material und Gramm vormerken, sortieren, löschen',
      '✅ Filament-Check je Eintrag gegen die Spulen im AMS (reicht / zu wenig / Material fehlt)',
      '🔔 Nach Druckende: Eintrag wird abgehakt, Mitteilung „Nächster Druck: … Platte frei machen“ (startet nichts von selbst)',
      '📱 Android-Homescreen-Widget: Balken, Prozent, Restzeit, Uhrzeit des Endes und AMS-Feuchte, Tipp öffnet die App',
      '📲 Neue Android-App (APK) nötig für das Widget'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.159',
    label: '1.159 (Android-Build repariert)',
    releaseDate: '01.11.2026',
    description: 'Der Android-Build von 1.158 schlug fehl (eine Datei war versehentlich leer). Jetzt wieder in Ordnung, mit Warteschlange und Homescreen-Widget.',
    features: [
      '🔧 Live-Update-Teil der Android-App wiederhergestellt, APK baut wieder',
      '📱 Homescreen-Widget und Warteschlange aus 1.158 sind enthalten'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.160',
    label: '1.160 (Status-LED)',
    releaseDate: '01.11.2026',
    description: 'Ein LED-Streifen am Drucker zeigt den Status: blau mit Fortschrittsbalken beim Druck, grün wenn fertig, rot bei Fehler, orange beim Trocknen.',
    features: [
      '💡 Status-LED: WLED-Streifen über Home Assistant, die App legt die Automation selbst an (Mitteilungen > Status-LED)',
      '🔵 Blau mit Fortschrittsbalken, 🟡 Pause, 🟢 fertig, 🔴 Fehler, 🟠 AMS trocknet',
      '🔆 Helligkeit einstellbar, Standard 30 %',
      '📄 Aufbau ohne Widerstand und Kondensator: hardware/status-led'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.161',
    label: '1.161 (Tab-Leiste repariert)',
    releaseDate: '01.11.2026',
    description: 'Die Tabs „Postfach“ und „Einstellungen“ waren oben abgeschnitten. Jetzt voll sichtbar.',
    features: ['🔧 Tab-Leiste in Mitteilungen und Werkstatt wird nicht mehr zusammengedrückt'],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.162',
    label: '1.162 (Cozy-Design)',
    releaseDate: '01.11.2026',
    description: 'Neues Design „Cozy“: dunkles Petrol, Creme-Schrift, Messing-Akzent, Serifen-Überschriften, weiche Karten. Zurück jederzeit über Menü > Einstellungen > Design > Klassisch. Einstellungen der Mitteilungen neu sortiert.',
    features: [
      '☕ Design „Cozy“ als Standard, „Klassisch“ jederzeit wählbar (Helligkeit und Farbe bleiben gespeichert)',
      '🗂️ Mitteilungs-Einstellungen in Bereiche sortiert: Druck, Trocknen, Spulen, Handy, LED, Zeiten, mit Sprung-Leiste',
      '⏱️ „Zeiten und Grenzen“ eingeklappt, Test-Mitteilung beim Handy-Bereich',
      '🔧 Drucker-Kopf: Name und Knöpfe überlappen nicht mehr'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.163',
    label: '1.163 (Cozy am PC)',
    releaseDate: '01.11.2026',
    description: 'Die Windows-App startet im Cozy-Ton statt Dunkelgrün. Das Cozy-Design kommt mit diesem Update auch in die Windows-App.',
    features: ['🖥️ Windows-App: Fenster-Hintergrund beim Start im Cozy-Petrol', '☕ Cozy-Design aus 1.162 jetzt auch in der Windows-App (nach dem Update)'],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.164',
    label: '1.164 (Ruhiges Design & neues Menü)',
    releaseDate: '02.11.2026',
    description: 'Ruhigere Farben (Cozy dunkel, neu: Sand hell), das linke Menü startet zu und ist eine klare Liste, rechts steht jetzt die Drucker-Leiste mit Warteschlange, Drucken und Logs.',
    features: [
      '🎨 Cozy weicher (weniger Kontrast), neu: Sand (warm hell). Klassisch weiter wählbar unter Menü > Aussehen',
      '📂 Linkes Menü startet zu. Innen eine Liste in Gruppen: Helfer, Daten, Einstellungen, mit „Zurück“',
      '🖨️ Rechte Leiste heißt „Drucker“: Reiter Warteschlange, Drucke, Logs (Drucke und Warteschlange sind aus der Werkstatt hierher gezogen)',
      '🔧 Warteschlange: Eingabefelder passen in die schmale Leiste'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.165',
    label: '1.165 (Drucker rechts & Lila-Design)',
    releaseDate: '02.11.2026',
    description: 'Der Drucker sitzt am PC als lange Leiste rechts, das Menü ist schöner und startet zu, Mitteilungen sind kompakter. Neu: Design Nacht (dunkles Lila), Cozy in Waldgrün. Zurück-Taste und Maus-Tasten gehen im Menü und in Fenstern.',
    features: [
      '🖨️ Drucker als lange Leiste rechts (scrollbar), am PC startet jetzt die Desktop-Ansicht',
      '🌙 Neu: Design Nacht (dunkles, augenschonendes Lila). Cozy jetzt in Waldgrün',
      '📂 Menü: links immer zu beim Start, „Material-Einstellungen“, Verbindungen mit Status-LED, ohne Mitteilungen',
      '🔔 Mitteilungen: kompakter, zwei Spalten, „Zeiten und Grenzen“ immer offen, ohne Status-LED',
      '↩️ Zurück/Vor: Handy-Zurück, Maus-Tasten (Windows-App) und Browser-Zurück schließen Menü und Fenster'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.166',
    label: '1.166 (Customize-Menü & Drucker zurück)',
    releaseDate: '02.11.2026',
    description: 'Drucker-Leiste rechts ist wieder weg (Drucker steht wieder in der Mitte). Neu: großes Customize-Menü unter Aussehen mit Helligkeit, Farbton, Akzent, Glas, Leuchten, Rundung und Schrift. Mitteilungen sind wieder im Menü.',
    features: [
      '🎛️ Customize-Menü: Helligkeit für alle Designs, Hintergrund-Tönung, eigene Akzentfarbe, Glas-Effekt, Leuchten, Rundung, Schriftgröße, Serifen, ruhige Bewegung',
      '✨ Fertige Looks: Lila Glas, Tief Violett, Wald Glas, Papier (mit „Zurücksetzen“)',
      '🖨️ Drucker wieder in der Mitte, rechte Drucker-Leiste entfernt',
      '🔔 „Mitteilungen“ wieder im Menü unter Einstellungen',
      '💾 Aussehen bleibt über alle Versionen gespeichert'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.167',
    label: '1.167 (Flüssigglas & Farbanteil)',
    releaseDate: '02.11.2026',
    description: 'Neues Design Glas (Flüssigglas wie iOS): durchscheinende Karten mit Unschärfe, Glanzkante und weichen Farbflecken. Neuer Regler Farbanteil: weniger Lila, nur Akzente. Der Hintergrundglanz wird jetzt in allen Designs sichtbar.',
    features: [
      '🪟 Neues Design „Glas“: Flüssigglas wie iOS, dunkles Graphit, Lila nur als Akzent',
      '🎚️ Regler „Farbanteil“: weniger Lila in Flächen und Hintergrund. „Hell / Dunkel“ ändert nur die Helligkeit',
      '✨ Neue Looks: Flüssigglas, Glas ruhig',
      '🌈 Hintergrund-Leuchten war verdeckt und ist jetzt sichtbar (Cozy, Nacht, Sand, Glas)'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.168',
    label: '1.168 (Glas Grün, Lila & Creme)',
    releaseDate: '02.11.2026',
    description: 'Drei fertige Glas-Looks zum Auswählen unter Aussehen: Dunkelgrün, Dunkellila (beide mit Creme-Text und ganz leichten Akzenten) und helles Creme mit Salbeigrün.',
    features: [
      '🌲 Glas Grün: tiefes Dunkelgrün, Creme-Schrift, zarter Salbei als Akzent',
      '🍇 Glas Lila: tiefes Dunkellila, Creme-Schrift, zarter Flieder als Akzent',
      '🥛 Glas Creme: helles Milchglas auf warmem Papier, Salbeigrün',
      '🎛️ Weiter einstellbar im Customize-Menü (Farbanteil, Glas, Leuchten, Rundung)'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.169',
    label: '1.169 (Farben je Design)',
    releaseDate: '02.11.2026',
    description: 'Die Customize-Regler (Farbanteil, Tönung, Akzent, Glas ...) gelten jetzt nur für das gewählte Design. Grün bleibt grün und Lila bleibt lila, jedes Design merkt sich seine eigenen Werte. Zurücksetzen betrifft nur das aktuelle Design. Das Such-Symbol im Creme-Look ist dunkler.',
    features: [
      '🎨 Customize-Regler gelten je Design, nicht mehr global',
      '♻️ „Zurücksetzen“ setzt nur das aktuelle Design zurück',
      '🔍 Creme: Such-Symbol besser lesbar',
      '🧹 Alte globale Werte werden nicht mehr gelesen (Neustart bei Standardwerten)'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.170',
    label: '1.170 (Extern-Spule X2D)',
    releaseDate: '02.11.2026',
    description: 'Extern-Spule am X2D: Der Drucker meldet zwei externe Plätze (vir_slot). Die App probiert jetzt mehrere Befehlsformen nacheinander, bis der Drucker die Spule übernimmt, und prüft alle externen Plätze. Bei Misserfolg zeigt die Meldung die Antwort des Druckers.',
    features: [
      '🧵 Extern-Spule: mehrere Befehlsformen (ams_id 254/255) werden nacheinander versucht',
      '👀 Liste „vir_slot“ des X2D wird gelesen und zeigt die externe Spule an',
      '🩺 Fehlermeldung nennt die Antwort des Druckers (zum Nachsehen)'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.171',
    label: '1.171 (Extern rechts, schneller)',
    releaseDate: '02.11.2026',
    description: 'Extern ist immer die rechte externe Spule (Haupt-Extruder, id 254). Die linke wird nicht mehr angefasst oder angezeigt. Weniger Befehlsformen, dadurch kürzere Wartezeit, und beim Antippen kommt sofort eine Meldung „sende an den Drucker“.',
    features: [
      '➡️ Extern = immer rechte externe Spule (id 254), die linke bleibt unberührt',
      '⏱️ Nur noch 3 Befehlsformen à 3 s statt 5, sofort Meldung beim Antippen',
      '🔎 Bestätigung prüft nur die rechte Spule'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.172',
    label: '1.172 (Extern-Fehler genau)',
    releaseDate: '02.11.2026',
    description: 'Wenn der Drucker die Extern-Spule nicht übernimmt, zeigt die Meldung jetzt genau: Version, LAN oder Cloud, welche Befehle probiert wurden, ob der Drucker geantwortet hat und was er über die externen Spulen meldet.',
    features: [
      '🩺 Fehlermeldung Extern enthält Version, Verbindung, Versuche und Druckerantwort',
      '🧵 Anzeige der externen Spulen-Ids (254/255) mit Material und Farbe'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.173',
    label: '1.173 (Extern-Suche & Test-Fix)',
    releaseDate: '02.11.2026',
    description: 'Extern-Fehlermeldung nennt jetzt auch, welche Felder der Drucker für externe Spulen schickt (zur Fehlersuche am X2D). CI-Test repariert (brauchte ein fehlendes Paket).',
    features: [
      '🔎 Meldung zeigt die Feldnamen des Druckers (vir_slot, vt_tray …)',
      '✅ Test für „Farben je Design“ läuft jetzt auch in der CI'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.174',
    label: '1.174 (Extern lesen & melden)',
    releaseDate: '02.11.2026',
    description: 'Extern-Spule am X2D: Home Assistant zeigt, dass der Drucker die App-Werte annimmt, die App hat es aber nicht erkannt. Jetzt sucht die App externe Spulen (id 254/255) überall in den Druckerdaten, prüft die Farbe nur wenn gemeldet, und meldet „gesendet“ statt Fehler, wenn der Drucker nichts ablehnt.',
    features: [
      '🔎 Externe Spulen werden an jeder Stelle der Druckerdaten gefunden',
      '✅ Kein falscher Fehler mehr, wenn der Drucker die Extern-Spule nicht zurückmeldet',
      '🧵 Farbe wird nur geprüft, wenn der Drucker eine meldet'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.175',
    label: '1.175 (Esc eine Ebene zurück)',
    releaseDate: '02.11.2026',
    description: 'Die Esc-Taste schließt jetzt immer nur die oberste Ebene, wie die Zurück-Taste: erst Fenster, dann Seite im Menü, dann das Menü. Vorher schloss Esc alles auf einmal.',
    features: [
      '⎋ Esc = ein Schritt zurück (Fenster → Menü-Seite → Menü)',
      '🪟 NFC-Fenster, Drucker-Einstellungen und Kamera-Großansicht zählen als eigene Ebene'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.176',
    label: '1.176 (Windows-Update repariert)',
    releaseDate: '02.11.2026',
    description: 'Windows-App: „Nach Update suchen“ meldete „sha512 checksum mismatch“. Die App lädt Updates jetzt immer komplett (kein Teil-Download), leert bei diesem Fehler den Zwischenspeicher und versucht es einmal neu. Wirkt ab dieser Version, die alte App muss einmal per Hand installiert werden.',
    features: [
      '🖥️ Update lädt komplett statt per Blockmap-Teil-Download',
      '♻️ Bei Prüfsummen-Fehler: Zwischenspeicher leeren und automatisch neu versuchen'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.177',
    label: '1.177 (Extern 255 & Zurück stabil)',
    releaseDate: '02.11.2026',
    description: 'Extern-Spule: Der X2D meldet deine externe Spule als id 255 (PETG weiß), die App zielte auf 254. Jetzt wird 255 gesetzt, gelesen und bestätigt. Esc und Zurück/Vor: ein hängender Zähler konnte Zurück-Tasten verschlucken, er läuft jetzt nach 0,7 s von selbst ab.',
    features: [
      '🧵 Extern = id 255 (laut Druckerdaten), Befehl [255/255] zuerst',
      '⎋ Zurück/Esc: hängender Zähler läuft ab, keine verschluckten Tasten mehr'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.178',
    label: '1.178 (Extern wie Bambu Studio)',
    releaseDate: '02.11.2026',
    description: 'Echte Ursache gefunden: Der X2D braucht beim Setzen der externen Spule das Feld slot_id 0 (so macht es Bambu Studio und Home Assistant). Ohne das Feld hängt der X2D und antwortet gar nicht. Jetzt: ams_id 255, tray_id 254, slot_id 0, wie die anderen Programme.',
    features: [
      '🧵 Extern-Befehl wie Bambu Studio: ams_id 255, tray_id 254, slot_id 0',
      '⏱️ Längere Wartezeit (6 s) für die Bestätigung'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.179',
    label: '1.179 (Aktiver Slot am X2D)',
    releaseDate: '02.11.2026',
    description: 'Extern-Spule klappt jetzt. Neu: Die App erkennt beim X2D, welcher Platz gerade druckt (pro Düse, wie Home Assistant). Damit wird die externe Spule beim Drucken als aktiv markiert und das Gewicht nach dem Druck von der richtigen Spule abgezogen.',
    features: [
      '🟢 Aktiver Slot beim X2D aus den Düsen-Daten (device.extruder), nicht mehr nur tray_now',
      '🧵 Extern (5) wird als aktiv markiert, wenn die zweite Düse druckt',
      '⚖️ Abzug nach dem Druck nimmt die Spule des erkannten Platzes'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  },
  {
    id: 'v1.180',
    label: '1.180 (Ganze Gramm, Extern & Trocknung live)',
    releaseDate: '02.11.2026',
    description: 'Gewicht ohne Nachkommastellen (kein 749.9000000000001 g mehr). Die Spule auf Platz 5 heißt jetzt „Extern“ statt „AMS 5“. „Trocknet“ kommt jetzt vom Drucker selbst und nur für AMS-Slots 1-4, nicht mehr aus einer lokalen Merkliste. Die Spulen-Anzeige aktualisiert sich jede Sekunde.',
    features: [
      '⚖️ Gewicht überall in ganzen Gramm',
      '🧵 Platz 5 heißt „Extern“ statt „AMS 5“',
      '☀️ „Trocknet“ nur, wenn der Drucker wirklich trocknet (nur Slot 1-4, Restzeit vom Drucker)',
      '⏱️ Slot-Zuweisung und Trocknung in der Liste aktualisieren sich jede Sekunde'
    ],
    spoolsSnapshot: MY_SPOOLS,
    historySnapshot: [],
    viewMode: 'simple'
  }
];
