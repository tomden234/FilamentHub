# FilamentHub

Filament-Verwaltung für den Bambu Lab X2D mit AMS 2 Pro: Spulenbestand, Waage, Trocknen, Druckverlauf, Home Assistant, NFC-Tags und Cloud-Sync. Läuft als Webseite, Android-App und Windows-App. Frontend mit React und Vite, Server mit Express.

Aktuelle Version: **1.137 (Aus nach Druck: 3 Minuten)**. Die Zählung läuft ab 1.100 einfach weiter, die 2 bleibt für ein großes Update frei (intern heißt 1.137 im Paket 2.0.137, damit Updates sicher aufwärts zählen). Alle Versionen stehen im Revisionsmenü der App und lassen sich dort auswählen.

## Was die App kann (Kurzüberblick)

**Spulen**
- 🟢 **Spulen verwalten** · Bestand, Gewicht, Preis, Lagerort, Zustand (verschweißt, Eibos, muss trocknen), Kacheln mit Spulen-Symbol
- 🟢 **Waage** · Netto rechnet Leerspule und Beutel selbst raus
- 🟢 **Foto-Erkennung** · Spule fotografieren, KI füllt Marke, Material, Farbe aus
- 🟢 **Nachkauf-Links** · Amazon-Link je Spule
- 🟢 **Fast leer** · Warnung unter einer Grenze

**NFC und QR**
- 🟢 **NFC-Tag beschreiben** · schreibt die Spule auf den Tag (einzeln oder alle in einer Reihe)
- 🟢 **NFC-Tag lesen** · öffnet die Spule, Gramm ±, einem AMS-Slot zuweisen
- 🟢 **QR-Etiketten drucken** · mit dem Supvan E10 (Bluetooth), Werkstatt → Etiketten
- 🟢 **QR öffnet Spule** · direkt in der App

**Drucker (Bambu X2D, LAN)**
- 🟢 **Live-Status** · Fortschritt, Restzeit, Temperaturen, Kamera, Licht, Pause/Stopp
- 🟢 **AMS-Slots** · Spule ↔ Slot, Material/Farbe an den Drucker senden, externe Spule, Bambu-Spulen per RFID erkennen
- 🟢 **Druck-Wächter** · erkennt jeden Druck, auch aus Studio, Handy oder Display
- 🟢 **Auto-Abzug** · zieht Gramm nach dem Druck ab, sonst Frage „Spule abziehen?“
- 🟢 **Spulen-Check** · reicht das Filament, passt das Material
- 🟢 **Druckerfehler** · Klartext aufs Handy
- 🟢 **Nach Druck aus** · Steckdose aus, wenn fertig und Düse kalt (auch über Home Assistant ohne App)

**Trocknen**
- 🟢 **AMS-Trocknung** · starten/stoppen mit Zeit und Temperatur
- 🟢 **Trocknen-Erinnerung** · je Spule nach Intervall
- 🟢 **Trocknen-Vorschlag** · beim Einlegen einer feuchten Spule, „Danach trocknen“
- 🟢 **Feuchte-Alarm** · ab 25 %, AMS trocknet ab 30 % von selbst, Box gegen Raum vergleichen

**Überblick**
- 🟢 **Mitteilungen** · Postfach mit Glocke, Push aufs Handy, Tipp öffnet die Mitteilung
- 🟢 **Drucke mit Foto** · Verlauf mit Bild, Dauer, Gramm, Kosten
- 🟢 **Statistik** · Woche/Monat, Farben, Kosten je Druck
- 🟢 **Offline-KI** · Fragen zu Bestand und Sparen
- 🟢 **Cloud-Sync** · privater GitHub-Gist, verschlüsselt, mehrere Geräte
- 🟢 **Android, Windows, Web** · Auto-Update

**Vorbereitet, wartet auf Hardware**
- 🟡 **NFC-Leser im AMS** · liest Fremd-Spulen im AMS (ESP32 + RC522 an den Trennwänden), Bambu-Spulen liest das AMS selbst; Code fertig, Teile da
- 🟡 **Feuchte-Sensor** · SHT31-D am ESP32 für Lagerbox (und optional Raum), Code und Mini-Box fertig, Sensor bestellt
- 🟡 **Halter und Gehäuse** · STL-Dateien fertig, noch drucken

**Noch offen**
- ⚪ **Spulen-Diktat** · alle Spulen einmal neu eintragen
- ⚪ **Am Gerät testen** · neue APK (Push, Hintergrund-Dienst), Home-Assistant-Automation, Fotos

🟢 fertig · 🟡 vorbereitet · ⚪ offen

## Neu am 29./30.10.2026 (1.105 bis 1.137)

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

## Inhalt

1. [Was die App kann](#was-die-app-kann-kurzüberblick)
1. [Neu am 29./30.10.2026](#neu-am-2930102026-1105-bis-1114)
1. [App und Desktop](#app-und-desktop)
2. [Starten](#starten)
3. [Spulen verwalten](#spulen-verwalten)
4. [NFC-Leser im AMS](#nfc-leser-im-ams)
5. [Mitteilungen](#mitteilungen)
6. [Verbindungen](#verbindungen)
7. [Cloud-Speicher (privater GitHub-Gist)](#cloud-speicher-privater-github-gist)
8. [Webseite, Android, Windows](#webseite-android-windows)
9. [Umgebungsvariablen](#umgebungsvariablen)
10. [Zugangsdaten und Sicherheit](#zugangsdaten-und-sicherheit)
11. [Projektstruktur](#projektstruktur)
12. [Prüfen](#prüfen)

## App und Desktop

- **Android-App** zeigt nur App-Dinge: Spulen (Kacheln), KI, Tools, Einstellungen, Logs, NFC, Foto. Unten eine Schnellleiste (Foto, NFC-Tag, Neue Spule). Ohne Backups, G-Code-Rechner, Material-Einstellungen, Schnellaktionen und Abzug.
- **Desktop/Browser** behält alles inkl. Umschalter App/Desktop. Auf breiten Bildschirmen (ab 1100 px) steht das Menü dauerhaft an der Seite (einklappbar, wird gemerkt).
- **Dunkelmodus:** „4. Graphit“ (Blaugrau) und „5. Nacht“.

## Starten

```bash
npm install
cp .env.example .env     # Werte anpassen
npm run dev              # Entwicklung (Server + Vite) auf http://localhost:3000
npm run build && npm start   # Produktion (NODE_ENV=production)
```

## Spulen verwalten

Jede Spule hat diese Zustände (Spule bearbeiten → Kasten „Zustand der Spule“). Auf der Karte erscheinen passende Abzeichen.

| Zustand | Bedeutung |
|---|---|
| Auf Spule / ohne Spule | Ohne Spule (Refill) zählt die Leerspule als 0 g |
| Original verschweißt | Gilt als frisch, kein Trocknen nötig |
| Im Eibos-Beutel | Beutelgewicht (Standard 35 g) wird beim Wiegen abgezogen |
| Muss trocknen | Sofort fällig, bis du „getrocknet“ drückst |

**Waage:** Nettogewicht = Waage − Leerspule − Beutel. Die Leerspule kommt von der Spule selbst, sonst aus der Marke (z. B. Bambu 250 g).

**Alles neu eintragen:**

1. Tools-Tab → **Alle Spulen entfernen (Neustart)**. Vorher wird eine Backup-Datei geladen und eine Kopie im Gerät gesichert. Verlauf bleibt, AMS- und Tag-Zuordnungen werden geleert. Oben auf „Zurück“ stellt alles wieder her.
2. Spulen diktieren: pro Spule Marke, Material und Farbe, auf Spule oder nicht, original verschweißt oder nicht, muss trocknen, im Eibos-Beutel, Waagengewicht.
3. Claude trägt sie in `src/data/mySpools.ts` ein (Startliste `MY_SPOOLS_SEED`), erhöht die Revision und pusht. Die App übernimmt die Liste einmal als neuesten Stand.

Ein Revisionswechsel löscht keine Spulen und keinen Verlauf mehr.

## NFC-Leser im AMS

Fünf RC522-Leser erkennen die NFC-Tags der Spulen direkt im AMS 2 Pro. Die App ordnet jede Spule dem Slot zu und setzt Material und Farbe am Drucker, wenn der Slot nicht passt. Slot 1–4 sind die AMS-Slots, Slot 5 ist die externe Spule.

Ordner `hardware/ams-nfc/`:

| Datei | Inhalt |
|---|---|
| `README.md` | Pin-Plan, Einbau, Aufspielen, Testen |
| `filament-ams.yaml` | ESPHome-Konfiguration (mit `esphome config` geprüft: gültig) |
| `holder/` | Flacher RC522-Halter zum Kleben (PETG/ASA): `rc522_holder.stl` (Druck), `.scad` (anpassbar), `.svg` (Zeichnung mit Maßen) |

**Teile:** ESP32 (30 oder 38 Pins), 5× RC522, NTAG215-Tags, Dupont-Kabel, doppelseitiges Klebeband.

**Pin-Plan:**

| RC522 | ESP32 | |
|---|---|---|
| 3.3V, GND | 3V3, GND | alle 5 Leser, **nur 3,3 V** |
| SCK / MOSI / MISO | GPIO18 / 23 / 19 | alle 5 Leser |
| RST | GPIO22 | alle 5 Leser |
| SDA (CS) Slot 1 / 2 / 3 / 4 / extern | GPIO5 / 17 / 16 / 4 / 13 | je Leser einzeln |
| IRQ | frei | |

**Ablauf:**

1. Halter drucken (flach aufs Bett, PETG oder ASA, 0,2 mm, 3 Wände), Platine mit der Rückseite aufkleben, Halter mit Klebeband ans AMS.
2. ESPHome Device Builder in Home Assistant, neues Gerät `filament-ams`, `filament-ams.yaml` einfügen, Secrets eintragen (`wifi_ssid`, `wifi_password`, `filament_ams_api_key`, `filament_ams_ota`), per USB-C aufspielen.
3. Das Gerät in Home Assistant hinzufügen. Es liefert `sensor.filament_ams_slot_1_tag` bis `slot_5_tag`.
4. In der App Einstellungen → Verbindungen → Home Assistant eintragen, dann unter „NFC-Leser im AMS“ einschalten. Die App findet die Sensoren selbst.
5. **Tags in einer Reihe beschreiben:** NFC-Fenster → Tab **Alle Spulen beschreiben**. Eine Spule nach der anderen an das Handy halten, die App schreibt den Tag und merkt ihn sich.

**Verhalten:**

- Bekannter Tag: Spule wird dem Slot zugeordnet, bei Abweichung geht Material/Farbe an den Drucker (Entwickler-Modus nötig, abschaltbar).
- Unbekannter Tag: Hinweis „Unbekannter Tag in Slot X“, einmal die Spule wählen, dann ist der Tag gemerkt.
- Slot gilt erst nach 10 Minuten ohne Tag als leer (`remove_after`), weil sich die Spule beim Drucken dreht.
- Die App fragt Home Assistant nur ab, solange der Tab sichtbar ist.

**Einbau:** ESP32 außen montieren (innen bis 65 °C beim Trocknen, druckbares Gehäuse: `hardware/ams-nfc/case/`), nur die flachen RC522-Platinen ins AMS, Abstand zum Tag unter 3 cm, nicht bohren. Die genaue Innenform des AMS 2 Pro ist nicht vermessen, der Halter ist deshalb eine flache Platte ohne Seitenteile, die mit doppelseitigem Klebeband am AMS und an der Platine klebt.

## Mitteilungen

Die Glocke oben öffnet das Postfach. Dort stehen alle Mitteilungen mit Details: Druck gestartet, fertig oder fehlgeschlagen, Spulen-Check, Druckerfehler, Feuchte zu hoch, Trocknung fertig/gestoppt/gestartet, Trocknen fällig (auch beim Einlegen), Spule fast leer, Drucker ausgeschaltet.

- **Einstellungen** (Reiter im selben Fenster): jede Mitteilungsart einzeln an oder aus, Grenze für „fast leer“, Benachrichtigung aufs Gerät an oder aus.
- **Tipp auf die Benachrichtigung** öffnet die App direkt bei dieser Mitteilung (Android-App, Windows-App, installierte Web-App). Für Android braucht das die APK ab 2.01, die App lädt sie selbst.
- **Trocknen gestoppt** kommt, wenn die Trocknung vor dem Ende ausgeht (mit Laufzeit und fehlender Restzeit), einzeln abschaltbar.
- **Test-Mitteilung:** im Reiter Einstellungen die Art wählen und „Senden“.
- **Hintergrund-Dienst (Android, schaltbar):** eine kleine dauerhafte Anzeige hält die App wach, damit „Trocknen fertig“ auch bei geschlossener App aufs Handy kommt. Braucht die APK ab 1.102 (`NATIVE_API` = 5). Ab 1.120 gilt `NATIVE_API` = 6 (stabiles NFC-Schreiben).
- Ohne Hintergrund-Dienst kommen Mitteilungen, solange die App läuft oder im Hintergrund offen ist und mit dem Drucker verbunden bleibt.
- Etiketten drucken steht unter **Werkstatt** (Schraubenschlüssel oben).

## QR und NFC öffnen die Spule

QR-Code öffnet die App direkt bei der Spule (`filamenthub://spool/ID`). Ein NFC-Tag öffnet das Tag-Fenster (Gramm ±, „Spule ändern“). Im Android-Browser erscheint oben „In der App öffnen“. Ist die App offen und der Leser meldet einen Tag, springt sie ebenfalls zur Spule.

## Verbindungen

Menü → Einstellungen → **Verbindungen** zeigt eine Liste mit dem Stand auf einen Blick: Bambu-Drucker, Home Assistant, Cloud & Geräte-Sync, NFC-Leser, Mitteilungen und (nur Windows und Browser) Handy koppeln. Details klappen beim Tippen auf. Der Drucker-Status ist live (online, verbindet, offline; Cloud, Heimnetz oder direkt über die App). Anleitungen erscheinen nur, solange etwas nicht eingerichtet ist.

## Cloud-Speicher (privater GitHub-Gist)

npoint.io wird in manchen Schul- und Firmennetzen gesperrt und ist öffentlich lesbar. Deshalb speichert FilamentHub jetzt in einem **privaten GitHub-Gist**.

1. Token erstellen: https://github.com/settings/tokens/new?scopes=gist (klassisch, nur Haken „gist“).
2. Einstellungen → Verbindungen → **Cloud & Geräte-Sync** → Token eintragen → „Privaten Gist anlegen und Daten übernehmen“.
3. Zweites Gerät: „Handy & App“ → QR-Code scannen. Gist-ID und Token stehen im Link nach dem `#` und gehen nie an einen Server.
4. Alten npoint-Speicher erst leeren, wenn alle Geräte umgestellt sind (Knopf in derselben Karte).

Es gewinnt immer der neueste Stand. Der Zugang zu Drucker und Home Assistant bleibt zusätzlich mit deinem Sync-Passwort verschlüsselt (AES-GCM).

Hinweis: Die Verbindung zu `api.github.com` muss im Netz erlaubt sein. Ein Test gegen die echte GitHub-API steht noch aus.

## Webseite, Android, Windows

**GitHub Pages:** https://tomden234.github.io/filament-website-google-ai/ wird bei jedem Push auf `main` per GitHub Action gebaut (`.github/workflows/pages.yml`). Einmalig unter *Settings → Pages* die Quelle auf *GitHub Actions* stellen.

- Auf Pages läuft nur das Frontend (`VITE_STATIC=true`). Spulen und Einstellungen liegen im Browser.
- Drucker-Livedaten, Git-Push und Foto-Erkennung brauchen den Server (`server.ts`). Home Assistant lässt sich direkt aus dem Browser anbinden.
- Lokal testen: `VITE_BASE=/filament-website-google-ai/ VITE_STATIC=true npm run build && npm run preview`

**Android-App (APK):** `.github/workflows/apk.yml` baut bei jedem Push auf `main` eine signierte APK (Capacitor) im Release `apk-latest`. Download: `https://github.com/tomden234/filament-website-google-ai/releases/latest/download/FilamentHub.apk`

- Signatur: `android-signing/filamenthub.keystore`. Eigener Schlüssel: Secret `ANDROID_KEYSTORE_PASSWORD` setzen und Datei ersetzen.
- Das Repository muss öffentlich sein, damit der Download ohne Login klappt.
- Seit 1.62 spricht die App selbst mit dem Drucker (natives MQTT) und liest/beschreibt NFC-Tags (`android-native/`).
- Seit 1.63 aktualisiert sie sich live (Plugin `FilamentLive`, `live-bundle.zip`). Nur bei Änderungen am Java-Teil `NATIVE_API` (FilamentLivePlugin.java) und `nativeApi` (apk.yml) erhöhen, dann ist eine neue APK nötig.
- Seit 1.65 lädt sie neue APKs selbst und öffnet den Installer (`NATIVE_API` = 2). Beim ersten Mal „Installieren erlauben“ bestätigen.
- Der Bambu-E-Mail-Login läuft in der App direkt (CapacitorHttp). Im Browser blockiert Bambu das (CORS): Token manuell holen oder den Server nutzen.

**Windows-App:** `.github/workflows/desktop.yml` (Electron, `electron/`). Zertifikate der Firewall (z. B. FortiGate) lassen sich in der App per Fingerabdruck bestätigen.

## Umgebungsvariablen

| Variable | Zweck |
|---|---|
| `PORT` | Port des Servers (Standard 3000) |
| `GEMINI_API_KEY` | Optional: KI-Bilderkennung (Google Gemini) |
| `BAMBU_HOST`, `BAMBU_SERIAL` | Drucker (IP im LAN, Seriennummer) |
| `BAMBU_ACCESS_CODE` | LAN-Zugangscode (RTSP-Kamera-Link) |
| `BAMBU_USER_ID`, `BAMBU_ACCESS_TOKEN`, `BAMBU_ADMIN_PIN` | Bambu-Cloud-Zugang und PIN für Steuerbefehle |
| `BAMBU_TLS_VERIFY` | `true` prüft das MQTT-Zertifikat (Standard aus) |
| `APP_API_KEY` | Optional: schützt alle `/api`-Routen, Header `x-api-key` |
| `CORS_ORIGIN` | Erlaubte Ursprünge (kommagetrennt) |
| `GIT_AUTHOR_EMAIL` | E-Mail für Commits, die der Server erzeugt |

Vorlage: `.env.example`.

## Zugangsdaten und Sicherheit

- Echte Zugangsdaten gehören nie ins Repository: `.env`, `.git-credentials.json`, `.bambu-config.json`, `.ha-config.json` stehen in der `.gitignore`. Vorlagen heißen `*.example.json`.
- Der Server speichert eingegebene Tokens in diesen Dateien (bzw. in `data/`). Das Gist-Token bleibt nur im Gerät.
- Ist die Seite von außen erreichbar, setze `APP_API_KEY`. Im Browser einmalig: `localStorage.setItem('app_api_key', 'DEIN_KEY')`.
- Wurde ein Token je öffentlich, gilt es als kompromittiert: bei GitHub bzw. am Drucker erneuern.

## Projektstruktur

- `src/`: Frontend
  - `components/`: Hauptfenster; Unterordner `sidebar/`, `bambu/`, `nfc/`, `app/`, `workshop/`
  - `hooks/`: u. a. `useAmsNfcReaders.ts` (NFC-Leser über Home Assistant)
  - `utils/`: u. a. `spoolState.ts` (Spulen-Zustand), `gistStore.ts` und `cloudFetch.ts` (Cloud), `deviceSync.ts` (verschlüsselter Geräte-Sync), `openTag3d.ts` (NFC-Tag-Format)
  - `data/`: `defaultSpools.ts` (Revisionen, Marken), `mySpools.ts` (deine Startliste)
  - `api/`, `types/`
- `server.ts`, `server/routes/`: Express-Server (Drucker, Kamera, Home Assistant, Git, Speicher, Erkennung); `server/bambuMqtt.ts`, `server/bambuCloudApi.ts`
- `hardware/ams-nfc/`: NFC-Leser (ESPHome, Pin-Plan, Halter)
- `android-native/`, `android-signing/`, `capacitor.config.json`: Android-App
- `electron/`: Windows-App
- `scripts/`: Hilfsskripte (PWA-Icons)

## Prüfen

```bash
npm run lint    # Typprüfung (tsc --noEmit)
npm run build   # Produktions-Build
```

Beides läuft auch als GitHub Action bei jedem Pull Request.
