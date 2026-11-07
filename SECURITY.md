# Sicherheit

## Sicherheitslücke melden

Bitte **nicht** als öffentliches Issue. Nutze auf GitHub *Security → Report a vulnerability* (privater Bericht). Beschreib, was du gefunden hast und wie man es nachstellt. Zugangsdaten bitte nie mitschicken.

## Gut zu wissen

- Die App hält Zugangsdaten (Drucker, Home Assistant) nur im Gerät oder in Dateien auf dem eigenen Server (`.bambu-config.json`, `.ha-config.json`, `data/`). Alle stehen in der `.gitignore`.
- Der Server ist für das **Heimnetz** gedacht. Ist er von außen erreichbar, setze `APP_API_KEY` (siehe `.env.example`) und nutze ein VPN statt Port-Freigabe.
- Die Spulen-Daten liegen standardmäßig als Datei auf dem Pi (SSD, nur für den Server lesbar). Alternativ gibt es einen **privaten** GitHub-Gist, dessen Token im Gerät bleibt. Drucker- und Home-Assistant-Zugang im Sync sind mit dem Sync-Passwort verschlüsselt (AES-256).
- Wurde ein Token oder Schlüssel je öffentlich, gilt er als kompromittiert: erneuern (GitHub-Token, Bambu-Zugangscode, Home-Assistant-Token, Android-Signierschlüssel).
- Der Drucker im LAN-Modus nutzt ein selbstsigniertes Zertifikat. Die Prüfung ist standardmäßig aus (`BAMBU_TLS_VERIFY=false`).
