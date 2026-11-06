# FilamentHub Server

Läuft rund um die Uhr auf deinem Pi. Er hört am Drucker mit (LAN-Modus) und speichert jeden Druck: Name, Start, Ende, fertig oder abgebrochen und welcher AMS-Slot benutzt wurde. Die Apps (Handy, Windows) holen die Liste und ziehen die Gramm von der richtigen Spule ab, auch wenn beim Druck keine App offen war.

## Einrichten

1. Reiter **Konfiguration** ausfüllen:
   - **Drucker-IP**: am besten im Router eine feste IP für den Drucker einstellen.
   - **Seriennummer**: steht am Drucker (Einstellungen → Gerät) oder in Bambu Studio.
   - **Zugangscode**: am Drucker unter Einstellungen → WLAN/LAN → Zugangscode.
   - **API-Key** (optional): eigenes Passwort. Leer lassen: der Pi erzeugt selbst einen Schlüssel (ab 1.3.8 Pflicht).
2. Am Drucker müssen **Nur-LAN-Modus** und **Entwicklermodus** an sein.
3. Reiter **Info**: „Beim Systemstart starten“ und „Watchdog“ einschalten, dann **Starten**.
4. Im Reiter **Protokoll** muss stehen: `Drucker ... LAN-Modus` und `FilamentHub Server läuft`.

## In der App

Menü → Verbindungen → **FilamentHub Server**: Adresse des Pi eintragen (zum Beispiel `192.168.68.10`, der Port 3000 wird ergänzt), den **Schlüssel** aus dem Reiter **Protokoll** (Zeile `Schlüssel für die Apps: …`) eintragen und auf **Prüfen** tippen. Unterwegs geht dieselbe Adresse über Tailscale. Mit Geräte-Sync-Passwort reicht es, den Schlüssel auf einem Gerät einzutragen.

## Was der Server ohne App macht (ab 1.1.0)

- **Push aufs Handy** über die Home-Assistant-App: Druck fertig/abgebrochen, Spule fast leer, Drucker aus, Warnungen. Ohne Einstellung geht der Push an alle Handys mit der Home-Assistant-App. Nur bestimmte Handys: bei **notify_service** z. B. `mobile_app_pixel_8` eintragen.
- **Foto am Druckende** (Kamera des Druckers, sonst die Kamera aus Home Assistant).
- **Abzug der Gramm** direkt in der Cloud der App, genau einmal je Druck. Die App schickt dem Server dafür einmal ihren Cloud-Zugang und die Slot-Zuordnung.
- **Aus nach Druck** und **Aus nach Trocknen** (Steckdose über Home Assistant).
- **Verzögerter Druck**: setzt zur Zeit fort, auch wenn alle Apps zu sind.
- **Warnung**, wenn ein Druck viel länger dauert als gewohnt, und **Spulen-Check** beim Start.
- **Sicherung** jede Nacht (Spulen, Verlauf, Druckliste), 30 Tage, in der App herunterladbar.

## Neu in 1.2.0

- **Warteschlange**: In der App (Werkstatt → Warteschlange) Dateien vom Drucker vormerken. Taster „Platte frei“ am AMS-ESP (GPIO26 → GND) startet den nächsten Druck, 10 LEDs (GPIO14) zeigen, wie viele warten.
- **Drucker wartet**: Push mit Foto und den Knöpfen „Weiter“ / „Abbrechen“ (Home-Assistant-App auf dem Handy).
- **Strom** der Drucker-Steckdose je Woche, **Wochenbericht** sonntags 18 Uhr, **Ruhezeit** (lautlos), **Drucker antwortet nicht**.
- **ESP-Update übers WLAN**: Mit der ESPHome-App in Home Assistant legt der Server die neueste AMS-YAML in den ESPHome-Ordner (eigene Werte bleiben). Dann nur „Installieren“ → „Drahtlos“.
- **App direkt vom Pi**: Knopf „Web-UI öffnen“ oder `http://<IP des Pi>:3000`. Über http geht im Browser der verschlüsselte Geräte-Sync nicht; Handy- und Windows-App sind davon nicht betroffen.

## Neu in 1.3.9 (Pi speichert)

- Die Spulen-Daten liegen als Datei im Speicher der App (`/data/filamenthub-doc.json`, Vorversion als `.prev`). In der App unter Cloud & Geräte-Sync auf **Auf Pi-Server umstellen** tippen: vorhandene Daten werden einmal übernommen. Danach braucht es weder npoint noch Gist noch Token. Abzug, Warteschlange und Tages-Sicherung nutzen dieselbe Datei.

## Neu in 1.3.8 (Sicherheit)

- Der Server antwortet nur noch mit Schlüssel. Ohne eigenen API-Key erzeugt er beim ersten Start einen (steht im Protokoll, bleibt bei Updates gleich).

## Hinweise

- Drucker, die der Server nicht sieht (Pi aus oder Drucker aus), kann er nicht aufzeichnen. Ein Druck, der beim Neustart des Pi läuft, wird danach weiter verfolgt.
- Die Daten liegen im Speicher der App (`/data`) und gehen bei einem Update nicht verloren.
- Auf GitHub Pages (https) kann die Seite keinen http-Server ansprechen. Nutze dort die Handy- oder Windows-App.
