# Status-LED: LED-Streifen zeigt den Druckerstatus

Ein WS2812B-Streifen (mit WLED auf einem ESP32) leuchtet passend zum Drucker. Die App legt die nötige Automation in Home Assistant selbst an.

| Farbe | Bedeutung |
|---|---|
| Blau, wächst mit dem Druck (Fortschrittsbalken) | Druck läuft |
| Gelb | Pause |
| Grün (30 Minuten, dann aus) | Druck fertig |
| Rot blinkend (30 Minuten, dann aus) | Fehler |
| Orange atmend | AMS trocknet (ohne Druck) |
| Aus | sonst |

## Teile

| Teil | Hinweis |
|---|---|
| WS2812B- oder WS2812-Streifen, 5 V, 1 m (60 oder 144 LEDs) | Mit Stecker, nicht wasserdicht (IP30) reicht |
| Alu-Profil mit Opal-Abdeckung, 1 m | Diffusor (oder gedruckter Diffusor aus weißem/natur PLA, 1–2 Linien dünn, 8–15 mm Abstand zur LED) |
| ESP32 | Ein freier, nicht der mit den NFC-Lesern |
| USB-Netzteil 5 V, mindestens 2 A + USB-A-Kabel zum Aufschneiden | |
| 3 Dupont-Kabel | |

Kein Widerstand und kein Elko nötig (siehe unten, „Ohne Widerstand und Elko“).

## Verdrahtung

| Von | Nach |
|---|---|
| USB rot (5 V) | Streifen **5V** und ESP32 **VIN** |
| USB schwarz (GND) | Streifen **GND** und ESP32 **GND** |
| ESP32 **GPIO27** | Streifen **DIN** (Eingang, Pfeil zeigt vom Eingang weg) |

USB grün/weiß (Daten) bleiben ab. GPIO27 ist auch auf dem NFC-ESP32 frei, falls du doch denselben nimmst.

**Ohne Widerstand und Elko, aber so:**
- Datenleitung kurz halten (unter 20 cm).
- Erst GND verbinden, dann Daten, Strom zuletzt einschalten. Nichts umstecken, solange Strom anliegt.
- In WLED die Stromgrenze setzen (siehe unten). Das schützt Netzteil und Streifen.
- **ESP32 nie gleichzeitig über USB-Buchse und VIN versorgen.** Zum Flashen das Netzteil abstecken.

## WLED einrichten (einmalig, ca. 10 Minuten)

1. ESP32 per USB an den Rechner, auf <https://install.wled.me> im Browser „Install“ wählen, WLAN eintragen.
2. WLED-Oberfläche öffnen (Adresse steht beim Einrichten) > **Config > LED Preferences**:
   - LED type: **WS281x**, GPIO: **27**, Length: **60** (oder 144, so viele LEDs wie der Streifen hat)
   - **Maximum Current: 1000 mA** (bei 2-A-Netzteil auch 1500 mA)
   - Brightness: 30 % (die App stellt später die Helligkeit selbst ein)
   - Speichern.
3. In Home Assistant: **Einstellungen > Geräte & Dienste**. WLED wird meist automatisch gefunden, dort „Hinzufügen“.
4. In der FilamentHub-App: **Werkstatt > Mitteilungen > Status-LED** einschalten. Die App findet das Gerät und legt die Automation an.

Voraussetzung: Die Bambu-Lab-Integration (HACS) ist in Home Assistant, wie für „Nach Trocknen aus“.

## Wie die App es steuert

- Automation `filamenthub_status_led` in Home Assistant (Modus „neu starten“). Sie ist nur an, solange „Status-LED“ in der App gewählt ist.
- Fortschrittsbalken: WLED-Effekt „Percent“, die Länge setzt die App über den WLED-Regler „Intensity“ (0–100 % = 0–255).
- Ohne „Percent“ oder „Intensity“ leuchtet der Druck einfach blau.
- Fehlt der Windows-App-Server (Browser/Android), zeigt die App „Automation kopieren“. Einfügen unter Einstellungen > Automationen > Neu > Menü (3 Punkte) > In YAML bearbeiten.

## Wärme

Der Kleber der Streifen hält nur bis ca. 60 °C. Außen am Drucker anbringen, nicht im Druckraum und nicht am AMS beim Trocknen. Am besten im Alu-Profil festklemmen.
