// Start der Home-Assistant-App: Einstellungen aus der Konfiguration in die Server-Dateien und Umgebung übernehmen, dann den Server starten.
import fs from 'fs';
import { spawn } from 'child_process';
import crypto from 'crypto';

let o = {};
try {
  o = JSON.parse(fs.readFileSync('/data/options.json', 'utf-8'));
} catch (e) {
  console.error('Konfiguration nicht lesbar:', e.message);
}

const ip = String(o.printer_ip || '').trim();
const serial = String(o.serial || '').trim();
const code = String(o.access_code || '').trim();

if (ip && serial && code) {
  // LAN-Modus: direkt zum Drucker, ohne Bambu Cloud
  fs.writeFileSync(
    '/data/.bambu-config.json',
    JSON.stringify({ serialNumber: serial, userId: '', accessToken: '', brokerHost: '', adminPin: '', lanMode: true, lanIp: ip, lanCode: code }, null, 2),
    { mode: 0o600 }
  );
  try {
    fs.chmodSync('/data/.bambu-config.json', 0o600); // 1.231: Zugangscode nur für den Besitzer lesbar (auch bei alter Datei)
  } catch {
    /* egal */
  }
  console.log(`[FilamentHub] Drucker ${ip} (${serial}), LAN-Modus.`);
} else {
  console.warn('[FilamentHub] Drucker-IP, Seriennummer oder Zugangscode fehlt. Bitte in der Konfiguration der App eintragen und neu starten.');
}

const env = {
  ...process.env,
  PORT: '3000',
  HOST: '0.0.0.0',
  NODE_ENV: 'production',
  FILAMENT_DATA_DIR: '/data',
  // Hub an: Push, Foto, Abzug, Auto-Aus, Warnungen, Sicherung (nur hier, nie in der Windows-App, sonst würde doppelt abgezogen)
  FILAMENTHUB_HUB: '1',
  NOTIFY_SERVICE: String(o.notify_service || '').trim(),
  // 1.260: Schlüssel für die Foto-Erkennung der Spulen (Google Gemini, kostenloser Schlüssel von aistudio.google.com). Leer = Foto-Erkennung aus.
  GEMINI_API_KEY: String(o.gemini_api_key || '').trim(),
  // 1.275: eigenes Gmail-Postfach für Bestell-Mails (IMAP, App-Passwort). Nur hier auf dem Pi, nie in der Webseite.
  MAIL_USER: String(o.mail_user || '').trim(),
  MAIL_PASSWORD: String(o.mail_password || '').trim(),
  TZ: process.env.TZ || 'Europe/Berlin',
  // Handy-App, Windows-App und Webseite dürfen den Server ansprechen
  CORS_ORIGIN: 'https://tomden234.github.io,https://localhost,capacitor://localhost,http://localhost,http://localhost:3000,http://127.0.0.1:38517,http://localhost:38517,app://.'
};
// 1.229: Schlüssel ist Pflicht. Ohne eigenen Eintrag erzeugt der Pi einmal einen und merkt ihn sich (/data/api-key.txt).
let apiKey = String(o.api_key || '').trim();
// 1.233: zu kurze eigene Schlüssel sind im WLAN erratbar: ab 16 Zeichen gilt der eigene, sonst erzeugt der Pi einen starken
if (apiKey && apiKey.length < 16) {
  console.warn('[FilamentHub] Eigener Schlüssel ist kürzer als 16 Zeichen und wird ignoriert. Der Pi nutzt einen erzeugten (steht unten im Log).');
  apiKey = '';
}
if (!apiKey) {
  try {
    apiKey = fs.readFileSync('/data/api-key.txt', 'utf-8').trim();
  } catch {
    /* noch keiner */
  }
  if (!apiKey) {
    apiKey = crypto.randomBytes(18).toString('base64url');
    try {
      fs.writeFileSync('/data/api-key.txt', apiKey, { mode: 0o600 });
    } catch (e) {
      console.error('[FilamentHub] Schlüssel nicht speicherbar:', e.message);
    }
  }
}
env.APP_API_KEY = apiKey;
console.log('[FilamentHub] ==============================================');
console.log(`[FilamentHub] Schlüssel für die Apps: ${apiKey}`);
console.log('[FilamentHub] In jeder App: Menü → Pi-Server → Schlüssel eintragen → Prüfen');
console.log('[FilamentHub] ==============================================');

const child = spawn('node', ['/app/server-dist/server.mjs'], { cwd: '/data', env, stdio: 'inherit' });
child.on('exit', code => process.exit(code ?? 1));
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => child.kill(sig));
