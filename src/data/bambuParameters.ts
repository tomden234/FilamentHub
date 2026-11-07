import { BambuPrintProfile, MaterialType } from '../types/filament';

/**
 * Getestete Hersteller-Druckparameter für Bambu Studio & OrcaSlicer
 * Enthält Nozzle-Temperaturen, Betttemperaturen (PEI & Smooth),
 * Max Volumetric Speed (Flow mm³/s), Lüfter und Geschwindigkeiten.
 */
const BAMBU_PROFILES: Record<string, BambuPrintProfile> = {
  // Bambu Lab
  'Bambu Lab_PLA': {
    brand: 'Bambu Lab',
    material: 'PLA',
    nozzleTempFirstLayer: 220,
    nozzleTempOtherLayers: 215,
    bedTempTexturedPEI: 55,
    bedTempSmoothPlate: 50,
    maxVolumetricSpeed: 21, // mm³/s (High Speed Flow)
    fanSpeedMin: 80,
    fanSpeedMax: 100,
    printSpeedOuterWall: 200,
    printSpeedInnerWall: 300,
    density: 1.24,
    dryingRecommendation: '50 °C für 5 Stunden (bei Feuchtigkeit)',
    notes: 'Bambu PLA Basic: Sehr hohe Volumengeschwindigkeit bis 21 mm³/s möglich.'
  },
  'Bambu Lab_PLA+': {
    brand: 'Bambu Lab',
    material: 'PLA+',
    nozzleTempFirstLayer: 225,
    nozzleTempOtherLayers: 220,
    bedTempTexturedPEI: 55,
    bedTempSmoothPlate: 55,
    maxVolumetricSpeed: 20,
    fanSpeedMin: 70,
    fanSpeedMax: 100,
    printSpeedOuterWall: 180,
    printSpeedInnerWall: 250,
    density: 1.25,
    dryingRecommendation: '50 °C für 5 Stunden',
    notes: 'Höhere Zähigkeit, minimale Schichthaftung bei 220°C optimal.'
  },
  'Bambu Lab_PETG': {
    brand: 'Bambu Lab',
    material: 'PETG',
    nozzleTempFirstLayer: 255,
    nozzleTempOtherLayers: 250,
    bedTempTexturedPEI: 70,
    bedTempSmoothPlate: 70,
    maxVolumetricSpeed: 16,
    fanSpeedMin: 20,
    fanSpeedMax: 50,
    printSpeedOuterWall: 150,
    printSpeedInnerWall: 220,
    density: 1.27,
    dryingRecommendation: '65 °C für 6 Stunden (zwingend trocken drucken!)',
    notes: 'PETG HF: Glatte Oberfläche bei 250°C, wenig Lüfter für maximale Festigkeit.'
  },
  'Bambu Lab_TPU': {
    brand: 'Bambu Lab',
    material: 'TPU',
    nozzleTempFirstLayer: 235,
    nozzleTempOtherLayers: 230,
    bedTempTexturedPEI: 40,
    bedTempSmoothPlate: 35,
    maxVolumetricSpeed: 6.5, // Flexibles Material erfordert reduzierten Flow
    fanSpeedMin: 40,
    fanSpeedMax: 80,
    printSpeedOuterWall: 45,
    printSpeedInnerWall: 60,
    density: 1.21,
    dryingRecommendation: '55 °C für 6 Stunden',
    notes: 'TPU 95A HF: Nicht im AMS drucken! Über externen Spulenhalter zuführen.'
  },
  'Bambu Lab_ABS': {
    brand: 'Bambu Lab',
    material: 'ABS',
    nozzleTempFirstLayer: 260,
    nozzleTempOtherLayers: 255,
    bedTempTexturedPEI: 95,
    bedTempSmoothPlate: 90,
    maxVolumetricSpeed: 18,
    fanSpeedMin: 0,
    fanSpeedMax: 20,
    printSpeedOuterWall: 180,
    printSpeedInnerWall: 250,
    density: 1.05,
    dryingRecommendation: '70 °C für 6 Stunden',
    notes: 'Nur im geschlossenen Gehäuse (X2D/P1S). Druckraum vorheizen!'
  },
  'Bambu Lab_ASA': {
    brand: 'Bambu Lab',
    material: 'ASA',
    nozzleTempFirstLayer: 265,
    nozzleTempOtherLayers: 260,
    bedTempTexturedPEI: 100,
    bedTempSmoothPlate: 95,
    maxVolumetricSpeed: 17,
    fanSpeedMin: 0,
    fanSpeedMax: 25,
    printSpeedOuterWall: 180,
    printSpeedInnerWall: 240,
    density: 1.07,
    dryingRecommendation: '70 °C für 6 Stunden',
    notes: 'UV- und witterungsbeständig. Bauraum auf 45°C+ erwärmen.'
  },
  'Bambu Lab_PA / Nylon': {
    brand: 'Bambu Lab',
    material: 'PA / Nylon',
    nozzleTempFirstLayer: 290,
    nozzleTempOtherLayers: 285,
    bedTempTexturedPEI: 100,
    bedTempSmoothPlate: 95,
    maxVolumetricSpeed: 15,
    fanSpeedMin: 0,
    fanSpeedMax: 20,
    printSpeedOuterWall: 120,
    printSpeedInnerWall: 180,
    density: 1.15,
    dryingRecommendation: '80 °C für 8 Stunden (extrem hygroskopisch)',
    notes: 'PAHT-CF: Gehärtete Düse (Hardened Steel) erforderlich!'
  },
  'Bambu Lab_PC': {
    brand: 'Bambu Lab',
    material: 'PC',
    nozzleTempFirstLayer: 275,
    nozzleTempOtherLayers: 270,
    bedTempTexturedPEI: 105,
    bedTempSmoothPlate: 100,
    maxVolumetricSpeed: 14,
    fanSpeedMin: 0,
    fanSpeedMax: 15,
    printSpeedOuterWall: 120,
    printSpeedInnerWall: 180,
    density: 1.20,
    dryingRecommendation: '80 °C für 8 Stunden',
    notes: 'Sehr hohe Schichthaftung bei 100°C Bett. Klebestift empfohlen.'
  },
  'Bambu Lab_PET-CF / PA-CF': {
    brand: 'Bambu Lab',
    material: 'PET-CF / PA-CF',
    nozzleTempFirstLayer: 290,
    nozzleTempOtherLayers: 285,
    bedTempTexturedPEI: 100,
    bedTempSmoothPlate: 95,
    maxVolumetricSpeed: 16,
    fanSpeedMin: 10,
    fanSpeedMax: 30,
    printSpeedOuterWall: 140,
    printSpeedInnerWall: 200,
    density: 1.18,
    dryingRecommendation: '80 °C für 8 Stunden vor JEDEM Druck',
    notes: 'Kohlefaserverstärkt: Mindestens 0.4 mm gehärtete Düse verwenden.'
  },

  // SUNLU
  'SUNLU_PLA': {
    brand: 'SUNLU',
    material: 'PLA',
    nozzleTempFirstLayer: 215,
    nozzleTempOtherLayers: 210,
    bedTempTexturedPEI: 55,
    bedTempSmoothPlate: 50,
    maxVolumetricSpeed: 17,
    fanSpeedMin: 80,
    fanSpeedMax: 100,
    printSpeedOuterWall: 180,
    printSpeedInnerWall: 250,
    density: 1.24,
    dryingRecommendation: '50 °C für 5 Stunden',
    notes: 'Sehr saubere Wicklung, idealer Flow bei 16–17 mm³/s.'
  },
  'SUNLU_PETG': {
    brand: 'SUNLU',
    material: 'PETG',
    nozzleTempFirstLayer: 245,
    nozzleTempOtherLayers: 240,
    bedTempTexturedPEI: 75,
    bedTempSmoothPlate: 70,
    maxVolumetricSpeed: 14,
    fanSpeedMin: 30,
    fanSpeedMax: 50,
    printSpeedOuterWall: 140,
    printSpeedInnerWall: 200,
    density: 1.27,
    dryingRecommendation: '65 °C für 6 Stunden',
    notes: 'SUNLU PETG neigt bei zu viel Lüfter zu Stringing – 30-40% Lüfter ist optimal.'
  },

  // ELEGOO
  'ELEGOO_PLA': {
    brand: 'ELEGOO',
    material: 'PLA',
    nozzleTempFirstLayer: 215,
    nozzleTempOtherLayers: 210,
    bedTempTexturedPEI: 55,
    bedTempSmoothPlate: 50,
    maxVolumetricSpeed: 18,
    fanSpeedMin: 80,
    fanSpeedMax: 100,
    printSpeedOuterWall: 180,
    printSpeedInnerWall: 260,
    density: 1.24,
    dryingRecommendation: '50 °C für 5 Stunden',
    notes: 'ELEGOO Rapid PLA / Marble: Sehr gutes Fließverhalten bis 18 mm³/s.'
  },
  'ELEGOO_PETG': {
    brand: 'ELEGOO',
    material: 'PETG',
    nozzleTempFirstLayer: 245,
    nozzleTempOtherLayers: 240,
    bedTempTexturedPEI: 75,
    bedTempSmoothPlate: 70,
    maxVolumetricSpeed: 15,
    fanSpeedMin: 30,
    fanSpeedMax: 50,
    printSpeedOuterWall: 140,
    printSpeedInnerWall: 200,
    density: 1.27,
    dryingRecommendation: '65 °C für 6 Stunden',
    notes: 'Sehr gleichmäßiger Schmelzfluss auf Bambu PEI-Platte.'
  },

  // Prusament
  'Prusament_PLA': {
    brand: 'Prusament',
    material: 'PLA',
    nozzleTempFirstLayer: 220,
    nozzleTempOtherLayers: 215,
    bedTempTexturedPEI: 55,
    bedTempSmoothPlate: 50,
    maxVolumetricSpeed: 18,
    fanSpeedMin: 80,
    fanSpeedMax: 100,
    printSpeedOuterWall: 180,
    printSpeedInnerWall: 260,
    density: 1.24,
    dryingRecommendation: '50 °C für 5 Stunden',
    notes: 'Prusament Galaxy Black: Enorme Schichtüberdeckung, glänzendes Finish.'
  },
  'Prusament_PETG': {
    brand: 'Prusament',
    material: 'PETG',
    nozzleTempFirstLayer: 250,
    nozzleTempOtherLayers: 245,
    bedTempTexturedPEI: 75,
    bedTempSmoothPlate: 70,
    maxVolumetricSpeed: 15,
    fanSpeedMin: 30,
    fanSpeedMax: 50,
    printSpeedOuterWall: 140,
    printSpeedInnerWall: 210,
    density: 1.27,
    dryingRecommendation: '65 °C für 6 Stunden',
    notes: 'Hervorragende Maßhaltigkeit (+-0.02mm).'
  },

  // Eryone
  'Eryone_PLA': {
    brand: 'Eryone',
    material: 'PLA',
    nozzleTempFirstLayer: 215,
    nozzleTempOtherLayers: 210,
    bedTempTexturedPEI: 55,
    bedTempSmoothPlate: 50,
    maxVolumetricSpeed: 16,
    fanSpeedMin: 80,
    fanSpeedMax: 100,
    printSpeedOuterWall: 160,
    printSpeedInnerWall: 240,
    density: 1.24,
    dryingRecommendation: '50 °C für 5 Stunden',
    notes: 'Eryone Glow / Silk: Bei Silk Nozzle um +5°C anheben für mehr Glanz.'
  },

  // Polymaker
  'Polymaker_PA / Nylon': {
    brand: 'Polymaker',
    material: 'PA / Nylon',
    nozzleTempFirstLayer: 285,
    nozzleTempOtherLayers: 280,
    bedTempTexturedPEI: 95,
    bedTempSmoothPlate: 90,
    maxVolumetricSpeed: 14,
    fanSpeedMin: 0,
    fanSpeedMax: 20,
    printSpeedOuterWall: 100,
    printSpeedInnerWall: 160,
    density: 1.14,
    dryingRecommendation: '80 °C für 8–12 Stunden',
    notes: 'Polymaker PA6-CF: Unglaubliche Steifigkeit, gehärtete 0.4mm Düse Pflicht!'
  },

  // Overture
  'Overture_TPU': {
    brand: 'Overture',
    material: 'TPU',
    nozzleTempFirstLayer: 235,
    nozzleTempOtherLayers: 230,
    bedTempTexturedPEI: 40,
    bedTempSmoothPlate: 35,
    maxVolumetricSpeed: 5.5,
    fanSpeedMin: 50,
    fanSpeedMax: 90,
    printSpeedOuterWall: 40,
    printSpeedInnerWall: 55,
    density: 1.21,
    dryingRecommendation: '55 °C für 6 Stunden',
    notes: 'Overture High Speed TPU: Niedrige Druckgeschwindigkeit einhalten!'
  }
};

/**
 * Ermittelt das beste Druckprofil für Hersteller + Material
 */
export function getBambuProfile(brand: string, material: MaterialType): BambuPrintProfile {
  const key = `${brand}_${material}`;
  if (BAMBU_PROFILES[key]) return BAMBU_PROFILES[key];

  // Fallback auf Bambu Lab Profil des Materials
  const bambuKey = `Bambu Lab_${material}`;
  if (BAMBU_PROFILES[bambuKey]) {
    return {
      ...BAMBU_PROFILES[bambuKey],
      brand
    };
  }

  // Generischer Fallback
  return {
    brand,
    material,
    nozzleTempFirstLayer: 220,
    nozzleTempOtherLayers: 215,
    bedTempTexturedPEI: 55,
    bedTempSmoothPlate: 50,
    maxVolumetricSpeed: 16,
    fanSpeedMin: 70,
    fanSpeedMax: 100,
    printSpeedOuterWall: 160,
    printSpeedInnerWall: 240,
    density: 1.24,
    dryingRecommendation: '50 °C für 5 Stunden',
    notes: 'Standard Slicer-Werte für ' + material
  };
}

/**
 * Formatiert die Parameter für 1-Klick-Kopieren in Bambu Studio / OrcaSlicer
 */
export function formatBambuParametersText(p: BambuPrintProfile, spoolName: string): string {
  return `=== BAMBU STUDIO FILAMENT-PARAMETER ===
Filament: ${p.brand} ${spoolName} (${p.material})

[TEMPERATUR DÜSE]
• Erste Schicht:      ${p.nozzleTempFirstLayer} °C
• Andere Schichten:   ${p.nozzleTempOtherLayers} °C

[TEMPERATUR DRUCKBETT]
• Texturierte PEI:    ${p.bedTempTexturedPEI} °C
• Glatte PEI-Platte:  ${p.bedTempSmoothPlate} °C

[VOLUMENGESCHWINDIGKEIT / FLOW]
• Max Volumetric Speed: ${p.maxVolumetricSpeed} mm³/s

[KÜHLUNG & LÜFTER]
• Bauteillüfter:      ${p.fanSpeedMin}% bis ${p.fanSpeedMax}%

[GESCHWINDIGKEITEN]
• Außenwand:          ${p.printSpeedOuterWall} mm/s
• Innenwand:          ${p.printSpeedInnerWall} mm/s

[TROCKNUNG & HINWEIS]
• Empfehlung:         ${p.dryingRecommendation}
${p.notes ? '• Hinweis:            ' + p.notes : ''}
=======================================`;
}
