// true im GitHub-Pages-Build (reines Frontend, kein Server). Wird in .github/workflows/pages.yml gesetzt.
export const IS_STATIC = import.meta.env.VITE_STATIC === 'true';

// true in der Android-App (Capacitor-Build, siehe .github/workflows/apk.yml)
export const IS_NATIVE = import.meta.env.VITE_NATIVE === 'true';

/** GitHub-Repository, aus dem Updates und die APK kommen. Die Workflows setzen VITE_REPO auf das eigene Repo (auch in Forks). */
export const REPO: string = import.meta.env.VITE_REPO || 'tomden234/filament-website-google-ai';

// Fester Download-Link der APK (GitHub Release "apk-latest", wird bei jedem Push auf main neu gebaut)
export const APK_URL = import.meta.env.VITE_APK_URL || `https://github.com/${REPO}/releases/download/apk-latest/FilamentHub.apk`;

/** Installierte Web-App (PWA im Standalone-Modus) oder Android-App: läuft ohne Browser-Leiste */
export function isAppShell(): boolean {
  if (IS_NATIVE) return true;
  try {
    return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  } catch {
    return false;
  }
}

/** Versionsnummer dieses Builds (aus package.json, wird beim Bauen eingesetzt) */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';

/** Revisionsname zur Anzeige (1.191 usw., aus dem Revisionsmenü). Intern zählt die Nummer als 2.0.<Revision> (damit Updates von 2.0.1 aus weiter aufwärts erkannt werden),
 *  gezeigt wird 1.<Revision>: 2.0.102 → „1.102“. Die 2 bleibt für ein großes Update frei. */
export const APP_REVISION: string =
  typeof __APP_REVISION__ === 'string' && __APP_REVISION__ ? __APP_REVISION__ : APP_VERSION.replace(/^2\.0\.(\d{3,})$/, '1.$1').replace(/\.0$/, '');

// Windows-App (Electron, Release "desktop-latest")
export const IS_DESKTOP = typeof navigator !== 'undefined' && /Electron\//.test(navigator.userAgent);
export const DESKTOP_URL = `https://github.com/${REPO}/releases/download/desktop-latest/FilamentHub-Setup.exe`;
