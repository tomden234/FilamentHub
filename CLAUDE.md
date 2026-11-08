# Filament-Verwaltung – Regeln für Claude

## Sprache & Stil
- Antworte auf Deutsch, kurz (caveman), leicht verständlich, ohne lange Einleitung.
- Du bist professioneller Coder. Mach alles so weit du kannst, damit der Nutzer nichts mehr tun muss.
- Nur in den Ordnern/Dateien ändern, die für die Aufgabe nötig sind.

## Revisionen
- Revisionsmenü: `src/data/versions.ts` (Anzeige u.a. in `src/App.tsx`, `src/components/Sidebar.tsx`).
- Neue Revision nur, wenn ein Upgrade plausibel ist, nicht bei jeder kleinen Filament-Änderung.
- Stil: `1.26 (Name)`. Namen kurz und verständlich, z. B. `1.52 (White-Screen Fix, iFrame-Storage Schutz & Dunkelmodus-Sicherung)`.
- Nutzer muss alte Revisionen im Menü auswählen und zurückgehen können.

## Fun-Fact-Fenster
- `src/components/FunFactsModal.tsx` und `src/utils/funStats.ts`: bei jeder Änderung die Zeilen-Code-Statistik etc. aktualisieren.

## Git
- Immer die neueste Version committen und pushen.
- Commit-Nachricht beginnt mit der Version, z. B. `1.251 (Name)`.

## Zusammenfassung am Ende
Immer in diesem Aufbau (nur Aufbau, nicht Inhalt):

Revisions- & Projekt-Aktualisierungen
- Neue Version: <Nr> (<kurzer Name>) ist im Revisionsmenü aktiv.
- Git: Auf Stand Version <Nr> aktualisiert und committed (Commit <hash>).

## Projekt-Wissen
- Frühere Stände stehen als `stand-v*.md` und `audit-v*.md` in den Docs des Claude-Projekts „filament webseite".

## Skills (.claude/skills, im Repo mitgeliefert)
- apple-design (Emil Kowalski, MIT), security-audit (Cloudflare, MIT), agent-skills von Addy Osmani (MIT): using-agent-skills, code-review-and-quality, test-driven-development, git-workflow-and-versioning, frontend-ui-engineering, security-and-hardening, debugging-and-error-recovery, ci-cd-and-automation.
- Neue Skills: erst mit SkillSpector scannen (`skillspector scan <ordner> --no-llm`) UND selbst lesen, dann erst einbauen. Statischer Scan meldet bei Sicherheits-Skills viele Fehlalarme.

## Build (GitHub Actions, bei Push auf main)
- ci.yml (Lint, Test, Build), apk.yml (Android APK), desktop.yml (Windows-App), pages.yml (GitHub Pages).
