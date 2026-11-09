# FilamentHub Server

Läuft rund um die Uhr auf deinem Pi. Er hört am Drucker mit (LAN-Modus) und speichert jeden Druck: Name, Start, Ende, fertig oder abgebrochen und welcher AMS-Slot benutzt wurde. Die Apps (Handy, Windows) holen die Liste und ziehen die Gramm von der richtigen Spule ab, auch wenn beim Druck keine App offen war.

## Einrichten

1. Reiter **Konfiguration** ausfüllen:
   - **Drucker-IP**: am besten im Router eine feste IP für den Drucker einstellen.
   - **Seriennummer**: steht am Drucker (Einstellungen → Gerät) oder in Bambu Studio.
   - **Zugangscode**: am Drucker unter Einstellungen → WLAN/LAN → Zugangscode.
   - **API-Key** (optional): eigenes Passwort. Leer lassen: der Pi erzeugt selbst einen Schlüssel (ab 1.3.8 Pflicht).
   - **gemini_api_key** (optional, ab 1.3.19): Schlüssel für die Foto-Erkennung. In der App ein Foto vom Spulen-Etikett machen, die Spule wird ausgefüllt. Kostenlosen Schlüssel holst du auf aistudio.google.com. Leer = Foto-Erkennung aus.
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

## Neu in 1.3.10 (Abgleich & Schutz)

- Alle Dateien werden stromausfallsicher geschrieben (Zwischendatei + Umbenennen, Vorversion `.prev`). Ist eine Datei kaputt, liest der Server die Vorversion.
- Neue Dateien auf dem Drucker werden alle 20-60 s gesucht (vorher alle 3 s), beim Drucken alle 60 s. Taster bei leerer Warteschlange sucht sofort.
- Der Abzug läuft im Hintergrund und hält Warnungen und „Aus nach Druck“ nicht mehr auf. Die Verbindung zu Home Assistant baut sich nach Abbrüchen selbst neu auf.
- Kamera und Live-Stream nutzen einen 12-Stunden-Token statt des Schlüssels in der Adresse.

## Neu in 1.3.32

- **Produktseite finden**: Der Pi sucht per Gemini mit Google-Suche die genaue Produktseite einer Spule (Klick auf den Shop-Link in der App) und merkt sie sich (`product-links.json`). Braucht `gemini_api_key`.
- **Bestell-Mails sicherer**: Teillieferungen, Wiederholung bei Fehlern, Spam-Ordner wird mitgelesen, Zustellung legt keine neuen Spulen an.

## Neu in 1.3.31

- **Bestell-Mails**: Neue Optionen `mail_user` und `mail_password` (App-Passwort eines zweiten Gmail-Kontos, IMAP aktiv). Der Pi prüft alle 10 Minuten, Gemini liest Bestellung, Versand und Zustellung. Spulen erscheinen als „Bestellt/Unterwegs“, bei Zustellung kommt ein Push. Das Passwort bleibt nur auf dem Pi. Anleitung im Testmenü, Punkt 7. Braucht `gemini_api_key`.

## Neu in 1.3.30

- **Datei-Archiv**: Der Pi sichert jede Datei aus der Warteschlange (Ordner `archive`, bis 2 GB / 400 Dateien). In der App: Menü „Datei-Archiv“ mit Suche, Sortierung, Material-Filter, Stern (wird nie gelöscht) und „Nochmal drucken“.

## Neu in 1.3.29

- **Smart sortieren**: Vorschlag für eine bessere Reihenfolge der Warteschlange (Platte, Düse, Spulen, Nacht), erst Vorschau, dann Übernehmen.
- **Temperatur-Wächter**: Warnung, wenn die Düsentemperatur der Datei stark von der Spule abweicht.

## Neu in 1.3.28

- **Alle Platten**: Dateien mit mehreren Platten kommen als einzelne Karten hintereinander in die Warteschlange, mit Projekt-Kopf (Fortschritt, Zeit, Gramm).

## Neu in 1.3.27

- **Druckzeit**: Der Pi liest die Slicer-Zeit aus der Druckdatei und lernt aus echten Drucken einen Faktor je Material (Datei `hub-timefactor.json`). Die Warteschlange zeigt Slicer-Zeit, berechnete Zeit und die Fertig-Uhrzeit.

## Neu in 1.3.26

- **Platte & Düse im Check**: Der Pi liest aus der Druckdatei (.3mf), welche Druckplatte und Düse sie braucht. Die Warteschlange zeigt beides und warnt gelb, wenn es sich zum Druck davor ändert.

## Neu in 1.3.25

- **Foto-Erkennung schneller**: Der Pi nimmt zuerst das schnelle Modell Gemini 3.5 Flash-Lite. Im Protokoll steht jetzt, wie lange die Erkennung gedauert hat („Gemini … fertig in … s“).

## Neu in 1.3.24

- **Foto-Erkennung**: Ist das Gemini-Guthaben leer (Code 402), sagt die App das jetzt klar und nennt den Ausweg.

## Neu in 1.3.23

- **Foto-Erkennung repariert**: Der Pi nutzte einen Modellnamen, den es nicht gibt („gemini-3.8-flash“). Jetzt der Alias `gemini-flash-latest` mit festen Reserve-Modellen. Fehler zeigen klare Texte (Schlüssel, Limit, Modell) und stehen im Pi-Protokoll.

## Neu in 1.3.22

- **Test „Druck fertig“ mit altem Druck**: Testmenü → 6. Push-Meldungen. Der Pi nimmt den neuesten fertigen Druck mit Foto und schickt den echten Push mit Bild, Dauer, Abzug und Strom.

## Neu in 1.3.21

- **Wochen wählen**: In der App (Einstellungen → FilamentHub Server → Wochen) stehen die letzten 8 Wochen. Jede lässt sich aufklappen und als Push senden. Frühere Wochen zählen Montag bis Sonntag.
- **Berichtsseite im App-Design** (Sand). „App öffnen“ geht zur Webseite der App; eigene Adresse mit der Umgebungsvariable `APP_URL` möglich.

## Neu in 1.3.20

- **Push-Test**: In der App Testmenü → 6. Push-Meldungen: jede Art Push einzeln oder alle nacheinander auslösen, dazu „Wochenbericht jetzt senden“.
- **Wochenbericht als Seite**: Die letzten 12 Berichte bleiben gespeichert. Tipp auf den Wochenbericht-Push öffnet `http://<Pi>:3000/bericht/<Kennung>` (Heimnetz oder Tailscale). Der Pi lernt seine Adresse aus den Anfragen der App, einmal die App mit dem Pi verbinden genügt.

## Neu in 1.3.19

- **Reicht die Spule?** Beim Einreihen und Starten rechnet der Pi die Gramm je Filament (plus 10 %) gegen den Rest der Spule im gewählten Platz. Reicht es nicht, steht es im Push und die Karte in der App wird rot (mit Ersatz-Spulen und Nachkauf-Link). Gestartet wird trotzdem, der Rest ist eine Schätzung.
- **Push-Knöpfe** bei „In der Warteschlange“: Jetzt starten, Löschen, Später. „Jetzt starten“ geht nur bei freier Platte, sonst fragt der Pi erst „Platte ist frei, starten“.
- **gemini_api_key** (optional): schaltet die Foto-Erkennung der Spulen am Pi ein.

## Neu in 1.3.18

- Warteschlangen-LEDs gleichen sich selbst ab (ESP wieder online, falsche Zahl, jede Minute).
- Neue Dateien: ohne Neues alle 20-30 s suchen; USB-Stick und weitere Ordner werden durchsucht; gleicher Dateiname wird als neu erkannt.

## Neu in 1.3.17

- Dauer-Protokoll `print-stats.json` (Start, Ende, Gramm je Material je Druck, bis 100.000 Drucke) für die Fun Facts. Übernimmt beim ersten Start die schon aufgezeichneten Drucke.

## Neu in 1.3.16

- Taster 4 s halten = laufenden Druck abbrechen (braucht ESP-Firmware 1.241, Entität „Taster lang“).
- Doppelklick wird auch ohne neue Firmware erkannt (zwei schnelle „Platte frei“).

## Neu in 1.3.15

- LED-Test in der App: Pi ignoriert die Warteschlange währenddessen und stellt sie danach wieder her.
- Taster doppelt: in den Einstellungen wählbar (pausieren/fortsetzen, ersten Eintrag nach hinten, nichts).

## Neu in 1.3.14

- Warteschlange: Wahl des AMS-Platzes pro Filament (Standard automatisch), gilt beim Start.
- Bei offener Warteschlange in der App sucht der Pi alle 8 s nach neuen Dateien.

## Neu in 1.3.13 (Fehler-Blinken aus)

- Die Status-LED hörte nach einem Fehler nicht auf zu blinken, weil der Drucker nach dem Quittieren am Display weiter „FAILED“ meldet. Der Pi schaltet den Streifen jetzt aus, sobald der Fehlercode weg ist (Prüfung alle 30 s). Blinkt er ohne gemeldeten Fehlercode, bleibt er an.

## Neu in 1.3.12 (npoint aus)

- npoint.io ist abgeschaltet: der Server nimmt keine npoint-Adresse mehr an, die Route `/api/cloud-proxy` ist weg. Im Add-on ist die Datei auf dem Pi (`pi:`) jetzt der **Standard-Speicher**, auch wenn noch keine App umgestellt hat oder in der Einstellung noch eine alte npoint-Adresse steht.
- Die Apps ziehen ihre Daten beim Start von selbst von npoint auf den Pi um (wenn Adresse und Schlüssel des Pi eingetragen sind).

## Neu in 1.3.9 (Pi speichert)

- Die Spulen-Daten liegen als Datei im Speicher der App (`/data/filamenthub-doc.json`, Vorversion als `.prev`). In der App unter Cloud & Geräte-Sync auf **Auf Pi-Server umstellen** tippen: vorhandene Daten werden einmal übernommen. Danach braucht es weder npoint noch Gist noch Token. Abzug, Warteschlange und Tages-Sicherung nutzen dieselbe Datei.

## Neu in 1.3.8 (Sicherheit)

- Der Server antwortet nur noch mit Schlüssel. Ohne eigenen API-Key erzeugt er beim ersten Start einen (steht im Protokoll, bleibt bei Updates gleich).

## Hinweise

- Drucker, die der Server nicht sieht (Pi aus oder Drucker aus), kann er nicht aufzeichnen. Ein Druck, der beim Neustart des Pi läuft, wird danach weiter verfolgt.
- Die Daten liegen im Speicher der App (`/data`) und gehen bei einem Update nicht verloren.
- Auf GitHub Pages (https) kann die Seite keinen http-Server ansprechen. Nutze dort die Handy- oder Windows-App.
