# Änderungsverlauf (Auszug)

Die ausführliche Liste aller Revisionen (1.xx) steht in der App im Revisionsmenü (`src/data/defaultSpools.ts`).
Hier der Abschnitt zu den großen Ergänzungen vom 29./30.10.2026.

## Neu am 29./30.10.2026 (1.105 bis 1.138)

Alles, was an diesem Tag dazukam, steht hier zusammen.

| Version | Was |
|---|---|
| 1.105 | Druck-Wächter (jeder Druck, auch aus Studio/Handy/Display), Frage „Spule abziehen?“, Nach Druck aus |
| 1.106 | Druckerfehler als Klartext, Spulen-Check, Feuchte-Alarm, Trocknen-Vorschlag + Danach trocknen, Auto-Aus über Home Assistant, Drucke mit Foto, Statistik |
| 1.107 | Feuchte-Alarm ab 25 %, AMS trocknet ab 30 % von selbst, Kurzüberblick im README |
| 1.108 | Feuchte-Sensor SHT31-D in der ESPHome-Datei |
| 1.109 | Neue Spulen-Kacheln (Spulen-Symbol in Filamentfarbe, durchgehender Balken), zweiter Sensor im Raum zum Vergleich, Mini-Box für den Sensor, Abzug mehrerer Spulen repariert |
| 1.110 | Bambu-Chips: eigene NFC-Leser ignorieren sie, die App erkennt Bambu-Spulen über den RFID-Chip, den das AMS selbst liest |
| 1.111 | Schneller & sparsamer: App tickt nur noch einmal pro Minute statt jede Sekunde, Drucker-Status nicht mehr doppelt (Stream + Abfrage), Lebenszeichen vom Server |
| 1.112 | Bambu-Spulen anlegen: neue Bambu-Spule im AMS → Formular mit Sorte, Farbe, Rest, Temperaturen vom Chip (nur gelesen); Bearbeiten verliert keine NFC-Daten mehr |
| 1.113 | Leser-Einbau: RC522 an Trennwände und linke Außenwand statt an die Bambu-Leser, Tag links außen auf die Spule, Ferrit-Folie gegen Nachbar-Slot |
| 1.114 | Halter 5 mm dick (Abstand zur Wand) mit Mulde für Ferrit-Folie, dünne Version bleibt dabei |
| 1.115 | Aufbau-Anleitung als PDF (`hardware/ams-nfc/AUFBAU.pdf`) mit 4 Verkabelungs-Diagrammen (`wiring/`), Teileliste, Aufspielen, Testen, Fehlersuche |
| 1.116 | Extern-Spule (5.) wählen setzt Material und Farbe auch am Drucker |
| 1.117 | NFC-Leser setzt den Slot am Drucker zuverlässig und meldet Fehler ehrlich (LAN oder Cloud), Slot-Zuordnung geht sofort an PC und Handy |
| 1.118 | Tag beschreiben/löschen wartet im selben Fenster auf den Tag und schreibt sofort; „Spule ändern“ zeigt alle Spulen zur Auswahl |
| 1.119 | QR-Etikett scannen öffnet die App und zeigt gleich die passende Spule im Tag-Fenster |
| 1.120 | NFC-Schreiben stabil: Fehler „Tag is out of date“ behoben (Android-Leser startet nicht mehr ständig neu), braucht neue APK (`NATIVE_API` = 6) |
| 1.121 | QR zeigt Tag-Fenster: QR-Link sucht sofort die neueste Webseiten-Version und öffnet das Tag-Fenster der Spule |
| 1.122 | Aus vor Trocknen: „Nach Druck aus“ ist stärker als „Nach Druck trocknen“ (wählt das Trocknen ab, blockiert es) |
| 1.123 | Aus beendet Trocknen: „Nach Druck aus“ beendet laufende Trocknung, wartet 3 Min. aufs Auslaufen des AMS, schaltet dann aus; kein Auto-Trocknen mehr bei gewähltem Aus |
| 1.124 | Druck-Planer: Fenster bei neuem Druck (danach trocknen/aus, Druck verzögern in Stunden oder um Uhrzeit, Trocknung läuft mit Restzeit weiter); Box-Sensor und AMS-Klima in °C unter dem AMS |
| 1.125 | Sensor alle 10 s: SHT31-D misst alle 10 s (YAML neu aufspielen), App liest alle 10 s |
| 1.126 | FunFacts-Zähler: Codezeilen zeigten im Desktop-Build 0 (Windows-Pfad), repariert; Zahlen geprüft |
| 1.127 | Silica-Beutel 57 g: Wiege-Option in Spule bearbeiten und Spulenkachel, Tara wird automatisch abgezogen |
| 1.128 | Neue Spulenliste nach Diktat: 18 Spulen mit Beutel- und Silica-Abzug, Prusa PETG blieb unverändert |
| 1.129 | Bambu Hellgrün ist eine 1-kg-Spule (Startgewicht 1000 g, voll) |
| 1.130 | Hellgrün: Tara gesamt 315 g (1315 g Brutto = 1000 g Netto), eine weitere Bambu PLA Weiß mit Spule |
| 1.131 | Korrektur: nur 3 Bambu PLA Weiß, Hellgrün mit Tara 100 + 35 + 57 g (1315 g ergibt über 1 kg, bitte neu wiegen) |
| 1.132 | Bambu Hellgrün auf 960 g, Isan PLA Plus Dunkelgrün wieder dabei (getrennt von Bambu Dunkelgrün) |
| 1.133 | Druck verzögern repariert: Plan bleibt beim Pausieren erhalten, Trocknung blockiert das Fortsetzen nicht mehr, Sicherheitsnetz im Drucker-Kern setzt auch bei geschlossener App fort |
| 1.134 | Kamera aufgeräumt (keine Überlappung), flüssiger, Vollbild-Knopf; AMS-Temperatur und Feuchte als saubere Karten |
| 1.135 | Ext. Trockner-Sensor: zweiter SHT31-D sitzt im externen Spulentrockner (5. Spule), Karte unter dem AMS, neuer Verdrahtungsplan |
| 1.136 | Trocknung wird nicht mehr dauernd gestoppt (nur einmal, Quelle im Log), Cloud-Abgleich überschreibt Spulen-Änderungen nicht mehr mit altem Stand |
| 1.137 | Aus nach Druck schaltet 3 Minuten nach Druckende ab, ohne auf die Düsentemperatur zu warten (App und Home-Assistant-Automation) |
| 1.138 | Dunkelgrün bei den Standardfarben (Spule anlegen, AMS-Slot) |

### Druck-Wächter (1.105)

Die App verfolgt jeden Druck, egal ob über Bambu Studio, Bambu Handy, das Drucker-Display oder die App gestartet. Der Stand wird im Gerät gespeichert (`src/utils/printSession.ts`, `src/hooks/usePrintWatch.ts`).

- **Druck gestartet:** Mitteilung mit Auftrag, Spule im aktiven Slot und Fertig-Uhrzeit. Geht die App erst mitten im Druck auf, heißt sie „Druck läuft“.
- **Druck fertig / fehlgeschlagen:** kommt auch, wenn die App beim Ende zu war (beim nächsten Öffnen).
- **Abzug (LAN-Modus):** Ende live gesehen und Gewicht bekannt → automatisch. Ende verpasst → Frage „Spule abziehen? Ja/Nein“ mit vorgeschlagener Spule und Gramm. Abgebrochen → Gramm anteilig nach Fortschritt.
- Drucke, die vor dem ersten Start von 1.105 begannen, werden nie nachträglich abgezogen.

### Nach dem Druck ausschalten (1.105, 1.106)

Während ein Druck läuft, steht bei der Drucksteuerung **„Nach Druck aus“** (eingeklappt oben neben „Strom“). Ist der Druck fertig, wartet die App mindestens 1 Minute und bis die Düse unter 60 °C ist (spätestens 20 Minuten), dann schaltet sie die Steckdose über Home Assistant aus und schickt eine Mitteilung. Bei einem fehlgeschlagenen Druck bleibt der Drucker an. Läuft auf jedem Gerät mit offener App (Android: Hintergrund-Dienst an lassen). Strom von Hand ausschalten fragt während eines Drucks jetzt nach.

**Ohne App (1.106):** Beim ersten „Nach Druck aus“ legt die App in Home Assistant die Automation „FilamentHub: Drucker nach Druck aus“ an (`src/utils/haAutoOff.ts`) und schaltet sie nur ein, solange „Nach Druck aus“ gewählt ist. Braucht die Bambu-Lab-Integration (HACS) in Home Assistant und einen Admin-Token. Von Hand: Verbindungen → Home Assistant → „In Home Assistant einrichten“. Ist „Danach trocknen“ gewählt, steuert die App das Ausschalten (erst nach der Trocknung).

### Fehler, Check, Feuchte, Drucke, Statistik (1.106)

- **Druckerfehler:** jede HMS-Meldung und jeder Druckfehler als Klartext aufs Handy (`src/hooks/useHmsAlerts.ts`, Texte in `public/hms_de.json` aus ha-bambulab, MIT-Lizenz).
- **Spulen-Check beim Start** (`src/utils/printChecks.ts`): reicht das Filament, fehlt ein Material im AMS, passt das Material laut Drucker zur Spule laut App.
- **Feuchte-Alarm** (`src/hooks/useHumidityAlarm.ts`): AMS-Messwert und externer Sensor (`sensor.filament_ams_box_feuchte`, SHT31 am ESP32). Melden ab 25 %, AMS automatisch trocknen ab 30 % (10 Minuten darüber, höchstens einmal am Tag; läuft ein Druck: danach). Einstellbar unter Mitteilungen → Einstellungen.
- **Trocknen-Vorschlag beim Einlegen** (`src/hooks/useDryAfterPrint.ts`): Spule, die trocknen sollte, kommt ins AMS → Mitteilung + Frage „Nach dem Druck trocknen / Jetzt trocknen“. Die Temperatur passt für alle Spulen im AMS (niedrigste).
- **Werkstatt → Drucke:** Druck-Verlauf mit Foto vom Ende (Kamera über Home Assistant, Fotos in IndexedDB), Dauer, Verbrauch, Kosten.
- **Werkstatt → Statistik:** Gramm und Euro pro Woche/Monat/gesamt, letzte 8 Wochen, Lieblingsfarben und Materialien, Ø-Kosten je Druck.

### Feuchte: Box und Raum (1.107 bis 1.109)

- **Melden ab 25 %** (Box und AMS), **AMS trocknet ab 30 %** von selbst: 10 Minuten darüber, höchstens einmal am Tag, läuft ein Druck: danach. Beides unter Mitteilungen → Einstellungen → Luftfeuchte.
- **Sensor in der Box:** SHT31-D am ESP32 (SDA GPIO21, SCL GPIO32) → `sensor.filament_ams_box_feuchte`.
- **Zweiter Sensor im Raum (optional):** eigener I2C-Bus (SDA GPIO33, SCL GPIO25) → `sensor.filament_ams_raum_feuchte`. Die App zeigt beide und den Unterschied: Box mindestens 15 % trockener als der Raum = dicht, sonst Hinweis „Dichtung prüfen oder Trockenmittel tauschen“. Zwei Sensoren in derselben Box bringen dagegen nichts.
- **Kabel:** bis ca. 1 m problemlos, bis ca. 2 m meist auch (Bus läuft mit 50 kHz).
- **Mini-Box zum Drucken:** `hardware/ams-nfc/sensor-box/` (ca. 16 × 19 × 8 mm, Lüftungsschlitze, Kabel-Zugentlastung, Lasche).

### Bambu-Spulen ohne eigenen Tag (1.110, 1.112)

Die NFC-Leser im AMS zählen nur deine eigenen NTAG-Aufkleber (7-Byte-Nummer). Bambu-Chips (4-Byte-Nummer) werden ignoriert, es gibt also keine Verwechslung. Bambu-Spulen erkennt die App stattdessen über den Chip, den das AMS selbst liest (`src/hooks/useBambuRfid.ts`): einmal zugeordnet, landet die Spule beim nächsten Einlegen von selbst im richtigen Slot. Ab 1.112: Unbekannte Bambu-Spule im AMS → Frage „Als neue Spule anlegen“ (Sorte, Farbe, Rest-Gewicht, Düsen- und Trockentemperatur kommen vom Chip, nur gelesen) oder „Ist schon in der App“. Plan: Bambu-Spulen ohne eigenen Tag, nur andere Marken bekommen einen NTAG-Aufkleber. Eigene Tags außen auf den Spulenrand kleben, Leser dorthin (Details: `hardware/ams-nfc/README.md`).

### Spulen-Kacheln (1.109)

Links ein Spulen-Symbol in der Filamentfarbe; wie dick das Filament darauf ist, zeigt den Rest. Darunter wieder ein durchgehender Balken statt 10 Segmenten.

### Geplant

- 🟡 **NFC-Leser im AMS aufbauen** (ESP32 + 5× RC522): Code fertig, liest die Spulen im AMS selbst und ordnet sie den Slots zu. Teile kommen am 30.10.
- 🟡 **SHT31-D anlöten und Mini-Box drucken:** Code fertig.
- 🟡 **Halter und ESP32-Gehäuse drucken:** STL fertig.
- ⚪ **Am Gerät testen:** neue APK (Push, Hintergrund-Dienst), Druckerfehler, Home-Assistant-Automation, Fotos am Druckende.
- ⚪ **Spulen-Diktat:** alle Spulen einmal neu eintragen.

- ✅ **Status-LED (1.160):** WLED-Streifen am Drucker, Aufbau in `hardware/status-led/`. Die App legt die Home-Assistant-Automation selbst an. Noch zu tun: Streifen und ESP32 verdrahten, WLED flashen.
