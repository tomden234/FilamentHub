# FilamentHub

Filament-Verwaltung für Bambu-Lab-Drucker (getestet mit dem X2D und AMS 2 Pro): Spulenbestand, Waage, Trocknen, Druckverlauf, Home Assistant, NFC-Tags und Cloud-Sync. Läuft als Webseite, Android-App und Windows-App. Frontend mit React und Vite, Server mit Express. Die Oberfläche ist deutsch. Open Source unter der [MIT-Lizenz](LICENSE).

> **English:** FilamentHub is a self-hosted filament inventory and printer companion for Bambu Lab printers (tested with the X2D + AMS 2 Pro): spool inventory, tare/scale calculator, drying reminders, print history, Home Assistant, NFC tags and optional cloud sync. It runs as a web app (GitHub Pages), an Android app (Capacitor) and a Windows app (Electron). The UI is in German. Contributions are welcome, see [CONTRIBUTING.md](CONTRIBUTING.md).

Aktuelle Version: **1.159 (Android-Build repariert)**. Die Zählung läuft ab 1.100 einfach weiter, die 2 bleibt für ein großes Update frei (intern heißt 1.159 im Paket 2.0.159, damit Updates sicher aufwärts zählen). Alle Versionen stehen im Revisionsmenü der App und lassen sich dort auswählen. Was seit 1.105 dazukam, steht in [docs/CHANGELOG.md](docs/CHANGELOG.md).

## Schnellstart: eigene Version in 5 Minuten (Fork)

Du brauchst nur ein GitHub-Konto, keinen eigenen Server.

1. Repository **forken**.
2. Im Fork: *Settings → Pages → Source: GitHub Actions*. Beim nächsten Push (oder unter *Actions → Deploy to GitHub Pages → Run workflow*) steht die Webseite unter `https://<dein-name>.github.io/<repo-name>/`.
3. Die App startet **leer**. Spulen anlegen, Foto-Erkennung und Drucker sind optional.
4. **Android-App:** *Actions → Build Android APK → Run workflow*. Die APK liegt danach im Release `apk-latest`. Ohne eigenen Schlüssel wird bei jedem Build ein neuer erzeugt (dann gehen Updates über eine ältere App nicht). Für dauerhafte Updates einmal einen eigenen Schlüssel anlegen, siehe [Webseite, Android, Windows](#webseite-android-windows).
5. **Windows-App:** *Actions → Build Windows App → Run workflow*, Installer im Release `desktop-latest`.
6. **Drucker, Kamera, Git-Push** brauchen den Server (`npm run build && npm start`, zum Beispiel auf einem Raspberry Pi). Der Bambu-X2D wird im LAN-Modus angebunden (Drucker-IP und LAN-Zugangscode in der App eintragen).

Cloud-Sync ist **aus**, bis du ihn einrichtest (Einstellungen → Verbindungen → Cloud). Dann liegen deine Daten in einem **privaten** GitHub-Gist, nirgends sonst.

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
- 🟢 **Druckerfehler** · schwere Fehler im Klartext aufs Handy (keine Dialoge wie „Düse wechseln“)
- 🟢 **Nach Druck aus** · Steckdose aus, wenn fertig und Düse kalt (auch über Home Assistant ohne App)

**Trocknen**
- 🟢 **AMS-Trocknung** · starten/stoppen mit Zeit und Temperatur
- 🟢 **Trocknen-Erinnerung** · je Spule nach Intervall
- 🟢 **Trocknen-Vorschlag** · beim Einlegen einer feuchten Spule, „Danach trocknen“
- 🟢 **Feuchte-Alarm** · ab 25 %, AMS trocknet ab 30 % von selbst, Box gegen Raum vergleichen

**Überblick**
- 🟢 **Mitteilungen** · Postfach mit Glocke; aufs Handy gehen nur die wichtigen (Druck fertig/fehlgeschlagen, schwere Fehler, Trocknung fertig), Tipp öffnet die Mitteilung
- 🟢 **Drucke mit Foto** · Verlauf mit Bild, Dauer, Gramm, Kosten
- 🟢 **Statistik** · Woche/Monat, Farben, Kosten je Druck
- 🟢 **Offline-KI** · Fragen zu Bestand und Sparen
- 🟢 **Cloud-Sync** · privater GitHub-Gist, verschlüsselt, mehrere Geräte
- 🟢 **Android, Windows, Web** · Auto-Update

**Optionale Hardware (selbst gebaut)**
- 🟡 **NFC-Leser im AMS** · liest Fremd-Spulen im AMS (ESP32 + RC522 an den Trennwänden), Bambu-Spulen liest das AMS selbst. Code, ESPHome-Datei, Halter und Aufbau-Anleitung unter `hardware/ams-nfc/`
- 🟡 **Feuchte-Sensor** · SHT31-D am ESP32 für Lagerbox und externen Trockner, Mini-Box zum Drucken
- 🟡 **Halter und Gehäuse** · STL-Dateien, SCAD und Skripte zum Anpassen

🟢 fertig und im Einsatz · 🟡 fertig, braucht selbst gebaute Hardware


## Inhalt

1. [Schnellstart (Fork)](#schnellstart-eigene-version-in-5-minuten-fork)
1. [Was die App kann](#was-die-app-kann-kurzüberblick)
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
- **Push aufs Handy** gibt es nur für das Wichtige: Druck fertig, Druck fehlgeschlagen, schwere Druckerfehler, Trocknung fertig. Alles andere landet im Postfach. Wer mehr will, schaltet „Auch weniger wichtige als Benachrichtigung“ ein.
- **Druckerfehler** kommen nur bei schweren Fehlern während eines Drucks und erst, wenn sie 1 Minute anstehen. Dialoge des Druckers (Düse wechseln, Filament einlegen, „fortsetzen?“) melden wir nicht, außer „Auch Hinweise und Dialoge melden“ ist an.
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

**GitHub Pages:** `https://<dein-name>.github.io/<repo-name>/` wird bei jedem Push auf `main` per GitHub Action gebaut (`.github/workflows/pages.yml`). Einmalig unter *Settings → Pages* die Quelle auf *GitHub Actions* stellen.

- Auf Pages läuft nur das Frontend (`VITE_STATIC=true`). Spulen und Einstellungen liegen im Browser.
- Drucker-Livedaten, Git-Push und Foto-Erkennung brauchen den Server (`server.ts`). Home Assistant lässt sich direkt aus dem Browser anbinden.
- Lokal testen: `VITE_BASE=/filament-website-google-ai/ VITE_STATIC=true npm run build && npm run preview`

**Android-App (APK):** `.github/workflows/apk.yml` baut bei jedem Push auf `main` eine signierte APK (Capacitor) im Release `apk-latest`. Download: `https://github.com/<dein-name>/<repo-name>/releases/latest/download/FilamentHub.apk`

- Signatur: eigener Schlüssel über zwei Secrets (*Settings → Secrets and variables → Actions*): `ANDROID_KEYSTORE_BASE64` und `ANDROID_KEYSTORE_PASSWORD`. Schlüssel einmal anlegen:
  `keytool -genkeypair -keystore filamenthub.keystore -alias filamenthub -keyalg RSA -keysize 2048 -validity 10000` (Alias muss `filamenthub` sein, Schlüssel- und Speicher-Passwort gleich), dann `base64 -w0 filamenthub.keystore` als Secret eintragen. Den Schlüssel gut sichern: Mit einem anderen Schlüssel lässt sich eine installierte App nicht mehr aktualisieren.
  Ohne Secrets nutzt der Build die alte Datei `android-signing/` (falls vorhanden), sonst erzeugt er für diesen Build einen neuen Schlüssel.
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
  - `data/`: `defaultSpools.ts` (Revisionen, Marken), `mySpools.ts` (optionale eigene Startliste über `mySpools.local.ts`, nicht im Repo)
  - `api/`, `types/`
- `server.ts`, `server/routes/`: Express-Server (Drucker, Kamera, Home Assistant, Git, Speicher, Erkennung); `server/bambuMqtt.ts`, `server/bambuCloudApi.ts`
- `hardware/ams-nfc/`: NFC-Leser (ESPHome, Pin-Plan, Halter)
- `android-native/`, `capacitor.config.json`: Android-App
- `electron/`: Windows-App
- `scripts/`: Hilfsskripte (PWA-Icons)
- `docs/`: Änderungsverlauf

## Prüfen

```bash
npm run lint    # Typprüfung (tsc --noEmit)
npm run build   # Produktions-Build
```

Beides läuft auch als GitHub Action bei jedem Pull Request. Mitmachen: siehe [CONTRIBUTING.md](CONTRIBUTING.md). Sicherheitslücken bitte nach [SECURITY.md](SECURITY.md) melden.

## Lizenz

[MIT](LICENSE). Die deutschen HMS-Fehlertexte (`public/hms_de.json`) stammen aus [ha-bambulab](https://github.com/greghesp/ha-bambulab) (MIT, siehe `public/hms_de.LICENSE.txt`). Bambu Lab ist eine Marke von Bambu Lab; dieses Projekt ist nicht mit dem Unternehmen verbunden.

