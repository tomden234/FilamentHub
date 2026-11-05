// Start der Home-Assistant-App: Einstellungen aus der Konfiguration in die Server-Dateien und Umgebung übernehmen, dann den Server starten.
import fs from 'fs';
import { spawn } from 'child_process';

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
    JSON.stringify({ serialNumber: serial, userId: '', accessToken: '', brokerHost: '', adminPin: '', lanMode: true, lanIp: ip, lanCode: code }, null, 2)
  );
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
  // Handy-App, Windows-App und Webseite dürfen den Server ansprechen
  CORS_ORIGIN: 'https://tomden234.github.io,https://localhost,capacitor://localhost,http://localhost,http://localhost:3000,http://127.0.0.1:38517,http://localhost:38517,app://.'
};
if (o.api_key) env.APP_API_KEY = String(o.api_key);

const child = spawn('node', ['/app/server-dist/server.mjs'], { cwd: '/data', env, stdio: 'inherit' });
child.on('exit', code => process.exit(code ?? 1));
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => child.kill(sig));
