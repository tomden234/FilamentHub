export type MaterialType =
  | 'PLA'
  | 'PLA+'
  | 'PETG'
  | 'TPU'
  | 'ABS'
  | 'ASA'
  | 'PA / Nylon'
  | 'PC'
  | 'PET-CF / PA-CF';

export interface Spool {
  id: string;
  brand: string;
  name: string;
  material: MaterialType;
  colorName: string;
  colorHex: string;
  pricePerKg: number;
  initialWeight: number; // in grams, e.g. 1000
  remainingWeight: number; // in grams, net
  emptySpoolWeight: number; // in grams, tara
  storageNote?: string;
  lastDried: string; // ISO string
  dryIntervalDays: number;
  dryTemp: number; // °C
  dryHours: number; // h
  productUrl?: string;
  nfcWritten?: boolean; // true = Tag beschrieben (grün), false = unbeschrieben (rot)
  nfcTagId?: string;
  location?: string; // Lagerort, z. B. Regal 2, Box, Trockner
  nozzleTemp?: number; // beste Düsentemperatur (°C), wird beim Einlegen vorgeschlagen
  bedTemp?: number; // beste Betttemperatur (°C)
  onSpool?: boolean; // true = Filament sitzt auf einer Spule, false = Refill ohne Spule (Leerspule = 0 g). Leer = aus Leerspulengewicht ableiten
  sealed?: boolean; // true = Original verschweißt/ungeöffnet (muss nicht getrocknet werden)
  silicaBag?: boolean; // true = Silica-Trockenbeutel liegt bei der Spule (Beutel-Tara beim Wiegen, Standard 57 g)
  inEibos?: boolean; // true = liegt im Eibos-Vakuumbeutel (Beutel-Tara beim Wiegen)
  needsDrying?: boolean; // true = muss getrocknet werden, bis „Trocknen“ bestätigt wird
  incoming?: { key: string; orderId: string; status: 'ordered' | 'shipped'; eta?: string; asin?: string }; // 1.275: bestellt, noch nicht da („unterwegs“), kommt aus der Bestell-Mail
  bambuRfid?: string; // Kennung der Bambu-Spule (RFID, liest das AMS selbst). Damit erkennt die App die Spule im AMS ohne eigenen Tag
}

export interface HistoryEntry {
  id: string;
  spoolId: string;
  spoolLabel: string;
  grams: number;
  timestamp: string;
}

export interface VersionProfile {
  id: string; // e.g. 'v1.19', 'v1.20', 'v1.21', 'v1.22', 'v1.23'
  label: string;
  releaseDate: string;
  description: string;
  features: string[];
  spoolsSnapshot: Spool[];
  historySnapshot: HistoryEntry[];
  viewMode: ViewMode;
}

export type ViewMode = 'full' | 'simple' | 'params';

export type SidebarTab = 'home' | 'ai' | 'gcode' | 'calc' | 'tools' | 'settings' | 'connect' | 'notices' | 'test';

export interface GCodeAnalysis {
  weightGrams: number;
  timeHours: number;
  material: string;
  fileName: string;
}

export interface DryingStatus {
  diffMs: number;
  isOverdue: boolean;
  statusLevel: 'ok' | 'soon' | 'overdue';
  dryPct: number;
  dryBarColor: string;
  days: number;
  hours: number;
  mins: number;
  secs: number;
  lastDriedFormatted: string;
  /** Spule ist original verschweißt: kein Trocknen nötig */
  sealed?: boolean;
  /** Trocknen wurde von Hand als nötig markiert */
  forced?: boolean;
}

export interface MaterialDryingConfig {
  intervalDays: number;
  temp: number;
  hours: number;
}

export interface BrandConfig {
  tara: number;
  defaultPrice: number;
}

export interface AppSettings {
  materialPresets: Record<string, MaterialDryingConfig>;
  brandPresets: Record<string, BrandConfig>;
  eibosBagTara: number;
  silicaBagTara?: number; // Gewicht eines Silica-Beutels in g (Standard 57)
  cardSize?: number; // Minimale Kachelbreite in Pixel (z.B. 240..480px)
}

export interface BambuPrintProfile {
  brand: string;
  material: MaterialType;
  nozzleTempFirstLayer: number;
  nozzleTempOtherLayers: number;
  bedTempTexturedPEI: number;
  bedTempSmoothPlate: number;
  maxVolumetricSpeed: number; // mm³/s (Flow)
  fanSpeedMin: number; // %
  fanSpeedMax: number; // %
  printSpeedOuterWall: number; // mm/s
  printSpeedInnerWall: number; // mm/s
  density: number; // g/cm³
  dryingRecommendation: string;
  notes?: string;
}

export type LogCategory = 'steckdose' | 'drucker' | 'licht' | 'temp' | 'spule' | 'kamera' | 'system';

export interface SystemLogEntry {
  id: string;
  timestamp: string; // HH:mm:ss
  dateStr: string;   // DD.MM.YYYY
  category: LogCategory;
  message: string;
  details?: string;
  level?: 'info' | 'success' | 'warn' | 'error';
}

