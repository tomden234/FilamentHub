// Fest eingebaute Amazon-Produkte aus deiner Bestellhistorie (11/2026 ausgelesen, genaue ASIN).
// Neue Bestell-Mails ergänzen/überschreiben diese Liste im Pi-Katalog (gleiche ASIN = Pi-Eintrag gewinnt).
export interface SeedItem {
  brand: string;
  material: string;
  name: string;
  colorName: string;
  asin: string;
}

export const SEED_CATALOG: SeedItem[] = [
  { brand: 'ELEGOO', material: 'PLA', name: 'PLA Filament 1.75mm Weiß 2KG', colorName: 'Weiß', asin: 'B0CD78VS7N' },
  { brand: 'ELEGOO', material: 'PLA', name: 'PLA Filament 1.75mm Weiß 1KG', colorName: 'Weiß', asin: 'B0CD7B7ZKK' },
  { brand: 'ELEGOO', material: 'PLA+', name: 'PLA+ Filament 1.75mm Weiß 1KG', colorName: 'Weiß', asin: 'B0CD7DYZ1B' },
  { brand: 'ELEGOO', material: 'PLA', name: 'PLA Filament Marmorfarbe 1KG', colorName: 'Marmor', asin: 'B0CM6C7W84' },
  { brand: 'EONO', material: 'PLA', name: 'PLA Filament Silk Rainbow Tricolor 1kg', colorName: 'Rainbow Tricolor', asin: 'B0B8YX4Y95' },
  { brand: 'YXPOLYMER', material: 'PA6-CF', name: 'Nylon Kohlefaser Filament PA6-CF 1,75mm 1kg', colorName: 'Schwarz', asin: 'B0DRCR8FZP' },
  { brand: 'eSUN', material: 'PLA+', name: 'PLA+ Filament 1.75mm 1kg Kiefergrün', colorName: 'Kiefergrün', asin: 'B07FQD3VL5' },
  { brand: 'OVERTURE', material: 'TPU', name: 'TPU Filament 95A 1kg', colorName: 'Schwarz', asin: 'B08X6P6YNC' },
  { brand: 'JAYO', material: 'PLA', name: 'PLA Filament 1.75mm 1kg', colorName: 'Schwarz', asin: 'B097D4T2BQ' },
  { brand: 'GEEETECH', material: 'PLA', name: 'Filament PLA 1.75mm 1kg Holz', colorName: 'Holz', asin: 'B075ZPT7MF' },
  { brand: 'ERYONE', material: 'PLA', name: 'PLA Filament 1.75mm 1kg Transparent', colorName: 'Transparent', asin: 'B07NY4HQ2S' },
  { brand: 'ENISINA', material: 'PLA', name: 'Glow in the Dark Filament 1,75mm 1kg', colorName: 'Glow in the Dark', asin: 'B0BPGF7QS6' },
];
