# NFC-Leser im AMS 2 Pro

**Komplette Aufbau-Anleitung mit Diagrammen: [`AUFBAU.pdf`](AUFBAU.pdf) / [`AUFBAU.md`](AUFBAU.md).** Diagramme und Skripte: `wiring/`.

Fünf RC522-Leser erkennen die NFC-Tags deiner Spulen direkt im AMS. Die FilamentHub-App ordnet dann jede Spule automatisch ihrem Slot zu und meldet Material und Farbe an den Drucker.

Slot 1–4 sind die AMS-Slots, Slot 5 ist die externe Spule.

## Pin-Plan

Gilt für ESP32-Boards mit 30 und mit 38 Pins (WROOM-32, DevKitC / NodeMCU).

| RC522-Pin | ESP32-Pin | Gemeinsam? |
|---|---|---|
| 3.3V | 3V3 | alle 5 Leser |
| GND | GND | alle 5 Leser |
| SCK | GPIO18 | alle 5 Leser |
| MOSI | GPIO23 | alle 5 Leser |
| MISO | GPIO19 | alle 5 Leser |
| RST | GPIO22 | alle 5 Leser |
| IRQ | frei lassen | – |
| SDA (= CS) Leser 1 / Slot 1 | GPIO5 | einzeln |
| SDA (= CS) Leser 2 / Slot 2 | GPIO17 | einzeln |
| SDA (= CS) Leser 3 / Slot 3 | GPIO16 | einzeln |
| SDA (= CS) Leser 4 / Slot 4 | GPIO4 | einzeln |
| SDA (= CS) Leser 5 / Extern | GPIO13 | einzeln |

**Wichtig:**
- RC522 **nur an 3,3 V**, nie an 5 V oder VIN.
- Gemeinsame Leitungen sternförmig oder als Kette verlöten, Lötstellen mit Schrumpfschlauch sichern.
- Erst **einen** Leser anschließen und testen, dann die anderen dazu.

## Fehlersuche: Leser erkennt nichts (ab Revision 1.200)

In Home Assistant (Gerät **Filament AMS**) und in der App (Tipp auf „NFC-Leser“) steht je Leser ein Zustand:

| Zustand | Bedeutung | Was tun |
|---|---|---|
| `OK (Chip 0x92)` (oder 0x91, 0x88, 0xB2, 0x12) | Leser spricht mit dem ESP | Tag 1–2 cm mittig vor die Antenne halten, „Letzter Tag“ muss sich ändern |
| `Keine Verbindung (0x00)` / `(0xFF)` | ESP hört den Leser nicht | SDA (CS) des Lesers, SCK, MOSI, MISO, 3V3 und GND prüfen. MISO/MOSI vertauscht ist der häufigste Fehler |
| `Fehler beim Start` | Leser antwortete beim Start nicht | wie oben, dann ESP neu starten |
| alle 5 `Keine Verbindung` | gemeinsame Leitung kaputt | SCK D18, MOSI D23, MISO D19, 3V3, GND |

- **„Letzter Tag“** zeigt jeden gelesenen Tag, auch ignorierte. Steht dort „(ignoriert, kein NTAG)“, ist es ein 4-Byte-Tag: in der YAML `own_uid_min: "11"` setzen.
- **Strom:** 5 Leser + ESP an einem USB-Anschluss am PC reicht manchmal nicht. Besser ein 5-V-Netzteil mit mind. 1 A am ESP.
- **Protokoll:** ESPHome → Filament AMS → Protokoll. Jeder Tag erscheint als `Found new tag '04-…'`.

## Taster „Platte frei“ und Warteschlangen-LEDs (ab Revision 1.199)

![Schaltplan Taster und 10 LEDs](wiring/7_taster_warteschlange.png)

| Teil | Anschluss | ESP32 |
|---|---|---|
| Taster C (Common) | GND | GND (neben D12) |
| Taster NO | Signal | D26 |
| Taster NC, Leuchtring (12 V) | frei lassen | – |
| Streifen 10 LEDs DIN | Daten (optional über 330 Ω) | D14 |
| Streifen 5V / GND | 5-V-Netzteil (das vom Status-Streifen) | GND mit ESP verbinden |

- **NFC-Tags:** NTAG215, rund 25 mm (7-Byte-Nummer) passen. Mittig 1 cm vor die Antenne halten.
- Testen: App → Menü → Testmenü.

## Feuchte-Sensor (optional, SHT31-D)

Ein kleiner I2C-Sensor misst Luftfeuchte und Temperatur, z. B. in der Filament-Lagerbox. Die App meldet sich, wenn die Feuchte über der Grenze liegt (Mitteilungen → Einstellungen → Luftfeuchte, Standard 25 %, AMS automatisch trocknen ab 30 %).

**Gekauft:** ARCELI SHT31-D (5 Stück, Pins VIN, GND, SCL, SDA). In der YAML ist er eingestellt (`platform: sht3xd`, Adresse 0x44). SHT40 oder AHT20 gehen auch, dafür stehen auskommentierte Blöcke in der YAML. DHT22 nicht nehmen.

| Sensor-Pin | ESP32-Pin |
|---|---|
| VIN / VCC | 3V3 |
| GND | GND |
| SDA | GPIO21 |
| SCL | GPIO32 |

- GPIO22 (Standard-SCL) ist schon RST der Leser, darum SCL auf GPIO32.
- Kabel bis ca. 1 m sind kein Problem. Sensor nicht direkt neben den ESP32 kleben (der wird warm).
- In Home Assistant heißen die Werte `sensor.filament_ams_box_feuchte` und `sensor.filament_ams_box_temperatur`. Die App kennt den Namen schon.
- **Zweiter Sensor im externen Spulentrockner (5. Spule):** eigener Bus, SDA GPIO33, SCL GPIO25 (gleiche Adresse geht nicht auf einem Bus) → `sensor.filament_ams_trockner_feuchte` und `_trockner_temperatur`. Die App zeigt ihn unter dem AMS als „Ext. Trockner“.
- **Kabel:** bis ca. 1 m problemlos, bis 2 m meist auch (Bus mit 50 kHz). SDA/SCL mit GND verdrillen.
- **Gehäuse für den Sensor:** `sensor-box/` (ca. 16 × 19 × 8 mm).

## Bambu-Spulen und eigene Tags

**Kurz:** Bambu-Spulen bekommen **keinen** eigenen Tag. Nur Spulen anderer Marken (Sunlu, Eryone, Polymaker …) bekommen einen NTAG-Aufkleber.

- **Bambu-Spulen liest das AMS selbst.** Es meldet über den Drucker Kennung, Sorte (z. B. „PETG HF“), Farbe, Rest-% und Gewicht an die App. Die App liest das nur mit, sie kopiert oder beschreibt den Chip nie. Neue Bambu-Spule im AMS → Frage „Als neue Spule anlegen“ (alles vorausgefüllt) oder „Ist schon in der App“. Danach erkennt die App sie bei jedem Einlegen von selbst.
- **Die eigenen Leser ignorieren Bambu-Chips.** Nur Tags mit 7-Byte-Nummer zählen (NTAG, `own_uid_min: "20"`), Bambu-Chips (MIFARE Classic, 4 Byte) stehen nur im Log und löschen nie einen Slot.
- **Bambu-Leser im AMS abschalten geht nicht** (nur das automatische Lesen beim Einlegen lässt sich am Drucker in den AMS-Einstellungen ausschalten). Ist auch nicht nötig.
- **Eigene Leser nicht direkt auf den Bambu-Leser kleben.** Zwei Leser direkt übereinander stören sich gegenseitig (gleiche Funkfrequenz 13,56 MHz), dann liest womöglich auch das AMS die Bambu-Spulen nicht mehr. Mindestens ca. 3–4 cm Abstand, am besten an die andere Stelle der Spulenseite.
- **Eigene Tags außen anbringen:** NTAG-Aufkleber auf den äußeren Rand der Spulenseite, den Leser genau dorthin. Der Bambu-Chip sitzt innen an der Nabe, außerhalb der Reichweite (RC522 ca. 2–3 cm).

## Einbau im AMS 2 Pro

**Wohin mit den Lesern?** Vorne in den Zuführungen sitzen die Bambu-Leser, dort ist kein Platz und die Leser würden sich stören. Darum kommen die RC522 an die **Trennwände** zwischen den Slots und an die **linke Außenwand**:

| Leser | Platz | Liest |
|---|---|---|
| Slot 1 | linke Außenwand innen | linke Seite der Spule in Slot 1 |
| Slot 2 | Trennwand 1│2, Seite zu Slot 2 | linke Seite der Spule in Slot 2 |
| Slot 3 | Trennwand 2│3, Seite zu Slot 3 | linke Seite der Spule in Slot 3 |
| Slot 4 | Trennwand 3│4, Seite zu Slot 4 | linke Seite der Spule in Slot 4 |
| Extern | am externen Spulenhalter hinten | – |

So hat jede Trennwand nur **einen** Leser.

- **Höhe und Lage:** unten an der Wand, kurz über den Laufrollen, eher **hinten/mittig** (weg von den Bambu-Lesern vorne in den Zuführungen, mindestens ca. 4 cm Abstand). Platine im Halter flach an die Wand (Einbau wie in `holder/README.md`), Abstand zur Spulenseite höchstens 2–3 cm. Stiftleiste nicht einlöten, Litzen direkt anlöten (sonst steht sie zur Spule hin ab).
- **Tag auf die Spule:** NTAG-Aufkleber auf die **linke** Spulenseite (von vorne gesehen), ca. 1–3 cm vom äußeren Rand. Spule immer mit dem Tag nach links einlegen. Der Bambu-Chip sitzt innen an der Nabe, weit weg.
- **Gelesen wird beim Drehen:** Der Tag kommt bei jeder Umdrehung unten am Leser vorbei. Die Spule dreht sich beim Einziehen, beim Drucken und beim Zurückspulen. Darum erkennt die App eine neue Fremd-Spule spätestens kurz nach dem Druckstart (der Spulen-Check wartet 90 s und hat sie dann). Ein Slot gilt erst nach 10 Minuten ohne Tag als leer.
- **Ferrit-Folie hinter jeden Leser** (NFC-Ferrit-Aufkleber, „Anti-Metall“, ca. 50 × 60 mm, wenige Euro), zwischen Wand und Halter: schirmt die Rückseite ab, damit der Leser nicht durch die Trennwand einen Tag im Nachbar-Slot liest.
- **Kleben:** hitzefestes Klebeband (3M VHB) oder der gedruckte Halter aus **PETG/ASA**. Innen bis 65 °C beim Trocknen. Normales Doppelklebeband und Isolierband lösen sich.
- **Kabel:** dünne Litzen (26–28 AWG) flach an der Wand nach hinten führen und unter der Deckeldichtung hinaus, oder durch eine vorhandene Öffnung. ESP32 **außen** (Gehäuse: `case/`).
- Nicht bohren (Garantie). Halter-Platte zum Kleben: `holder/`.

## Aufspielen (ESPHome)

1. In Home Assistant das Add-on **ESPHome Device Builder** installieren und öffnen.
2. **New Device** → Name `filament-ams` → ESP32 auswählen.
3. Den Inhalt von `filament-ams.yaml` in die neue Datei kopieren.
4. Unter **Secrets** eintragen: `wifi_ssid`, `wifi_password`, `filament_ams_api_key` (32 Byte Base64, ESPHome erzeugt beim Anlegen einen) und `filament_ams_ota` (beliebiges Passwort).
5. ESP32 per USB-C an den PC → **Install** → **Plug into this computer**.
   - Das Board hat einen CH340-Chip. Erkennt Windows es nicht, den CH340-Treiber installieren.
6. Danach erscheint das Gerät in Home Assistant unter **Einstellungen → Geräte → ESPHome**. Auf **Hinzufügen** klicken.

## Was die App macht

- Sie findet die Sensoren `sensor.filament_ams_slot_1_tag` … `slot_5_tag` automatisch über deine Home-Assistant-Verbindung.
- **Bekannter Tag** (von der App beschrieben): Die Spule wird dem Slot zugeordnet. Passt der Slot im Drucker nicht, schickt die App Material und Farbe an den Drucker (Entwickler-Modus nötig).
- **Unbekannter Tag:** Die App meldet „Unbekannter Tag in Slot X“. Wähl im Slot einmal die Spule aus, dann merkt sie sich den Tag.
- Der Slot gilt erst nach 10 Minuten ohne Tag als leer, weil sich die Spule beim Drucken dreht. Einstellbar mit `remove_after`.

## Testen

- In Home Assistant unter **Entwicklerwerkzeuge → Zustände** nach `filament_ams` suchen.
- Spule mit Tag vor einen Leser halten. Der Sensor zeigt die Tag-Nummer, z. B. `04-A1-B2-C3-D4-E5-F6`.
- Kommt nichts an: Verkabelung prüfen (MISO/MOSI vertauscht?), Abstand verkleinern, ESPHome-Log ansehen.
