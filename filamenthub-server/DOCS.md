# FilamentHub Server

Läuft rund um die Uhr auf deinem Pi. Er hört am Drucker mit (LAN-Modus) und speichert jeden Druck: Name, Start, Ende, fertig oder abgebrochen und welcher AMS-Slot benutzt wurde. Die Apps (Handy, Windows) holen die Liste und ziehen die Gramm von der richtigen Spule ab, auch wenn beim Druck keine App offen war.

## Einrichten

1. Reiter **Konfiguration** ausfüllen:
   - **Drucker-IP**: am besten im Router eine feste IP für den Drucker einstellen.
   - **Seriennummer**: steht am Drucker (Einstellungen → Gerät) oder in Bambu Studio.
   - **Zugangscode**: am Drucker unter Einstellungen → WLAN/LAN → Zugangscode.
   - **API-Key** (optional): ein beliebiges Passwort. Dann braucht jede App den gleichen Schlüssel.
2. Am Drucker müssen **Nur-LAN-Modus** und **Entwicklermodus** an sein.
3. Reiter **Info**: „Beim Systemstart starten“ und „Watchdog“ einschalten, dann **Starten**.
4. Im Reiter **Protokoll** muss stehen: `Drucker ... LAN-Modus` und `FilamentHub Server läuft`.

## In der App

Menü → Verbindungen → **FilamentHub Server**: Adresse des Pi eintragen (zum Beispiel `192.168.68.10`, der Port 3000 wird ergänzt) und auf **Prüfen** tippen. Unterwegs geht dieselbe Adresse über Tailscale.

## Hinweise

- Drucker, die der Server nicht sieht (Pi aus oder Drucker aus), kann er nicht aufzeichnen. Ein Druck, der beim Neustart des Pi läuft, wird danach weiter verfolgt.
- Die Daten liegen im Speicher der App (`/data`) und gehen bei einem Update nicht verloren.
- Auf GitHub Pages (https) kann die Seite keinen http-Server ansprechen. Nutze dort die Handy- oder Windows-App.
