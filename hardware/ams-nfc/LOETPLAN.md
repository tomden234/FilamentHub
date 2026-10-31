# Lötplan: ESP32 + 5 × RC522 + 2 × SHT31-D

Stand 30.10.2026, passt zu `filament-ams.yaml`. Alles mit **3,3 V**, nie 5 V an RC522 oder Sensoren.

## 1. Gemeinsame Leitungen (alle 5 Leser parallel, 4 Stück)

| Leitung | RC522-Pin (jeder Leser) | ESP32 | Kabel bei Leser 1 |
|---|---|---|---|
| SCK | SCK | GPIO18 (D18) | gelb |
| MOSI | MOSI | GPIO23 (D23) | blau |
| MISO | MISO | GPIO19 (D19) | grün |
| RST | RST | GPIO22 (D22) | grau |
| 3,3 V | 3.3V | 3V3 | weiß |
| Masse | GND | GND | schwarz |

IRQ bleibt bei allen Lesern frei.

## 2. Einzelleitung je Leser (SDA = CS)

| Leser / Slot | RC522 SDA | ESP32 | Kabel |
|---|---|---|---|
| 1 | SDA | GPIO5 (D5) | lila |
| 2 | SDA | GPIO17 (D17) | eigene Farbe |
| 3 | SDA | GPIO16 (D16) | eigene Farbe |
| 4 | SDA | GPIO4 (D4) | eigene Farbe |
| 5 (Extern) | SDA | GPIO13 (D13) | eigene Farbe |

## 3. Sensoren (SHT31-D, Pinreihenfolge auf dem Board: VIN, GND, SCL, SDA)

| Sensor-Pin | Kabel | Box-Sensor | Trockner-Sensor |
|---|---|---|---|
| VIN | rot | 3V3 | 3V3 |
| GND | orange | GND | GND |
| SCL | gelb | GPIO32 (D32) | GPIO25 (D25) |
| SDA | grün | GPIO21 (D21) | GPIO33 (D33) |

Beide Sensoren haben Adresse 0x44, deshalb je ein eigener Bus. Beschriftung auf dem Sensor-Board geht vor, falls die Reihenfolge anders ist.

## 4. Reihenfolge beim Löten

1. Alle GND zusammen: Sammelpunkt (Lötleiste oder Lötpad), ein Kabel zum ESP32-GND.
2. Alle 3,3 V zusammen: Sammelpunkt, ein Kabel zum ESP32-3V3 (5 Leser + Sensoren, ca. 150 mA, das schafft der ESP32).
3. Die 4 Bus-Leitungen SCK, MOSI, MISO, RST: je ein Sammelpunkt, dann zum ESP32.
4. Die 5 SDA-Leitungen einzeln zum ESP32.
5. Sensoren: 4 Leitungen je Sensor. Sensor 1 zuerst anschließen, testen, dann Sensor 2.

Leitungen zum ESP32 insgesamt: 15 (GND, 3V3, 4 Bus, 5 SDA, je 2 für Box- und Trockner-Sensor). Die Sensoren holen Strom und Masse von den Sammelpunkten.

## 5. Prüfen vor dem Einschalten

- Durchgang: GND und 3V3 dürfen **nicht** verbunden sein (Piepser = Kurzschluss).
- Jede SDA-Leitung geht nur an einen Leser und nur an ihren GPIO.
- Kein Pin doppelt belegt (GPIO22 nur RST, GPIO21/32 nur Box-Sensor).

## 6. Test

1. Erst Leser 1 + Box-Sensor anschließen, USB an.
2. NTAG vor Leser 1: `slot_1_tag` zeigt die Nummer.
3. Box-Sensor: `sensor.filament_ams_box_temperatur` und `_feuchte` haben Werte.
4. Dann Leser 2 bis 5 einzeln dazu, jedes Mal testen.
