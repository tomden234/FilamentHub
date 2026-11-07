# Mitmachen

Danke, dass du FilamentHub besser machen willst. Fehlerberichte, Ideen und Pull Requests sind willkommen.

## Fehler melden oder etwas vorschlagen

Eröffne ein Issue und schreib dazu:

- Was hast du gemacht, was ist passiert, was hast du erwartet?
- Wo läuft die App (Web, Android, Windows) und welche Version steht im Revisionsmenü?
- Drucker und AMS, wenn es um den Drucker geht (Modell, LAN-Modus ja/nein).
- **Keine Zugangsdaten, Tokens, Drucker-Seriennummern oder Zugangscodes** in Issues, Logs oder Screenshots.

## Code beitragen

```bash
git clone https://github.com/<dein-name>/<repo-name>.git
cd <repo-name>
npm ci
cp .env.example .env
npm run dev          # http://localhost:3000
```

Vor jedem Pull Request:

```bash
npm run lint         # Typprüfung
npm test             # Tests (vitest)
npm run build        # Produktions-Build
```

Regeln, damit es für alle einfach bleibt:

- **Klein halten:** ein Pull Request, ein Thema.
- **Reine Logik testbar machen:** Rechen- und Entscheidungslogik gehört in `src/utils/` (ohne Browser-Zugriff), dazu eine `*.test.ts` daneben. Beispiele: `hmsFilter.ts`, `pushPolicy.ts`.
- **Sprache:** Oberfläche und Kommentare auf Deutsch, kurz und verständlich. Variablen- und Dateinamen auf Englisch.
- **Keine Geheimnisse committen:** `.env`, `.bambu-config.json`, `.ha-config.json` und `src/data/mySpools.local.ts` stehen in der `.gitignore`. Beispiele heißen `*.example.json`.
- **Nicht am Gerät getestet? Sag es.** Schreib in den Pull Request, was du am echten Drucker, Handy oder ESP32 geprüft hast und was nicht.
- **Neue Revision:** Wer etwas Sichtbares ändert, trägt eine Revision „1.xx (Name)“ in `src/data/versions.ts` ein und zählt Version in `package.json` hoch (intern `2.0.<Revision>`). Kurzer, verständlicher Name.

## Hardware

Pläne, ESPHome-Datei, Halter und Gehäuse liegen unter `hardware/ams-nfc/`. Maße bitte vor dem Drucken mit dem Messschieber prüfen: AMS-Innenmaße sind nicht für alle Ausführungen gemessen.

## Lizenz

Mit deinem Beitrag stimmst du zu, dass er unter der [MIT-Lizenz](LICENSE) des Projekts steht.
