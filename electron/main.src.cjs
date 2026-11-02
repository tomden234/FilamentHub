// FilamentHub für Windows: startet den eingebauten Server (spricht per LAN/MQTT mit dem Drucker) und zeigt die App im Fenster.
const { app, BrowserWindow, Menu, shell, session, dialog, ipcMain, net } = require('electron');
const { autoUpdater } = require('electron-updater');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const https = require('https');
const tls = require('tls');

const PORT = 38517; // fest, damit die gespeicherten Daten (Spulen, Einstellungen) immer im selben Speicher liegen
const URL = `http://127.0.0.1:${PORT}`;
let server = null;
let win = null;

function startServer() {
  const userData = app.getPath('userData');
  const dataDir = path.join(userData, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const entry = path.join(__dirname, '..', 'server-dist', 'server.mjs');
  server = spawn(process.execPath, [entry], {
    cwd: userData, // dort liegt .bambu-config.json (Drucker-Zugangsdaten)
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT: String(PORT),
      HOST: '127.0.0.1',
      FILAMENT_DATA_DIR: dataDir,
      ...(fs.existsSync(path.join(process.resourcesPath || '', 'ffmpeg.exe')) ? { FFMPEG_PATH: path.join(process.resourcesPath, 'ffmpeg.exe') } : {})
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  const log = fs.createWriteStream(path.join(userData, 'server.log'), { flags: 'a' });
  server.stdout.pipe(log);
  server.stderr.pipe(log);
  server.on('exit', code => {
    if (!app.isQuitting) console.error('Server beendet, Code', code);
  });
}

function waitForServer(tries = 60) {
  return new Promise((resolve, reject) => {
    const attempt = n => {
      const req = http.get(URL, res => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (n <= 0) return reject(new Error('Server startet nicht'));
        setTimeout(() => attempt(n - 1), 500);
      });
    };
    attempt(tries);
  });
}

async function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 420,
    minHeight: 600,
    title: 'FilamentHub',
    backgroundColor: '#0d1a19',
    icon: path.join(__dirname, '..', 'public', process.platform === 'win32' ? 'icon.ico' : 'pwa-512x512.png'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'preload.cjs') }
  });
  Menu.setApplicationMenu(null);
  // Immer groß starten (Vollbild-Fenster mit Taskleiste). F11 schaltet echten Vollbild an/aus.
  win.maximize();
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });
  // Maus-Zurück/Vorwärts-Tasten (Windows) und Wischgesten (Mac)
  const goBack = () => { if (win.webContents.navigationHistory?.canGoBack?.() ?? win.webContents.canGoBack()) win.webContents.goBack(); };
  const goFwd = () => { if (win.webContents.navigationHistory?.canGoForward?.() ?? win.webContents.canGoForward()) win.webContents.goForward(); };
  win.on('app-command', (_e, cmd) => {
    if (cmd === 'browser-backward') goBack();
    else if (cmd === 'browser-forward') goFwd();
  });
  win.on('swipe', (_e, dir) => {
    if (dir === 'left') goBack();
    else if (dir === 'right') goFwd();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(URL)) shell.openExternal(url);
    return { action: url.startsWith(URL) ? 'allow' : 'deny' };
  });
  try {
    await waitForServer();
    await win.loadURL(URL);
  } catch (e) {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<body style="font-family:sans-serif;background:#0d1a19;color:#f2e9da;padding:32px"><h2>FilamentHub startet nicht</h2><p>Der interne Server antwortet nicht. Port ' + PORT + ' evtl. belegt. Log: ' + path.join(app.getPath('userData'), 'server.log') + '</p></body>'));
  }
}

// Automatische Updates (wie bei der Handy-App): neue Version im Hintergrund laden, beim Beenden oder per Klick installieren
// Cloud-Datenbank über den Netzwerk-Stack von Windows/Chromium abrufen. Der nutzt die Windows-Zertifikate
// (wichtig, wenn ein Virenscanner HTTPS prüft: Node kennt dessen Zertifikat nicht → UNABLE_TO_VERIFY_LEAF_SIGNATURE).
// Zertifikat, das auf diesem PC für die Cloud-Datenbank ankommt (z. B. vom Virenscanner/Router). Nur wenn du es ausdrücklich
// bestätigst, wird genau dieses eine Zertifikat (per Fingerabdruck) für api.npoint.io akzeptiert. Alles andere bleibt streng geprüft.
const CLOUD_HOST = 'api.npoint.io';
let lastCloudCert = null;
function trustFile() {
  return path.join(app.getPath('userData'), 'trusted-certs.json');
}
function trustedList() {
  try {
    return JSON.parse(fs.readFileSync(trustFile(), 'utf8'));
  } catch {
    return [];
  }
}

// Electron-Fingerabdruck „sha256/BASE64“ → Node-Format „AA:BB:…“
function fpToHex(fp) {
  const b = Buffer.from(String(fp).replace(/^sha256\//, ''), 'base64');
  return [...b].map(x => x.toString(16).padStart(2, '0').toUpperCase()).join(':');
}

function pinnedRequest(url, method, body) {
  const allowed = trustedList().map(fpToHex);
  const u = new URL(url);
  const port = Number(u.port) || 443;
  return new Promise((resolve, reject) => {
    // Erst TLS aufbauen und Fingerabdruck prüfen, erst danach wird überhaupt etwas gesendet
    const sock = tls.connect({ host: u.hostname, port, servername: u.hostname, rejectUnauthorized: false, timeout: 20000 });
    sock.once('error', reject);
    sock.once('timeout', () => sock.destroy(new Error('Zeitüberschreitung')));
    sock.once('secureConnect', () => {
      const fp = sock.getPeerCertificate() && sock.getPeerCertificate().fingerprint256;
      if (!fp || !allowed.includes(String(fp).toUpperCase())) {
        sock.destroy();
        return reject(new Error('Zertifikat passt nicht zum bestätigten Fingerabdruck'));
      }
      const rq = https.request(
        {
          host: u.hostname,
          port,
          path: u.pathname,
          method,
          createConnection: () => sock,
          headers: body !== undefined ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}
        },
        resp => {
          const chunks = [];
          resp.on('data', c => chunks.push(c));
          resp.on('end', () => resolve({ status: resp.statusCode || 502, text: Buffer.concat(chunks).toString('utf8') }));
        }
      );
      rq.on('error', reject);
      if (body !== undefined) rq.write(body);
      rq.end();
    });
  });
}

function setupCloudBridge() {
  session.defaultSession.setCertificateVerifyProc((request, callback) => {
    if (request.hostname !== CLOUD_HOST || request.verificationResult === 'net::OK') return callback(-3);
    const c = request.certificate;
    lastCloudCert = {
      error: request.verificationResult,
      issuer: (c && c.issuerName) || '',
      subject: (c && c.subjectName) || '',
      fingerprint: (c && c.fingerprint) || '',
      validTo: c && c.validExpiry ? new Date(c.validExpiry * 1000).toISOString().slice(0, 10) : ''
    };
    if (lastCloudCert.fingerprint && trustedList().includes(lastCloudCert.fingerprint)) return callback(0);
    return callback(-3);
  });
  ipcMain.handle('cloud:cert-info', () => lastCloudCert);
  ipcMain.handle('cloud:trust-cert', (_e, fp) => {
    if (!lastCloudCert || fp !== lastCloudCert.fingerprint) return false;
    const list = trustedList();
    if (!list.includes(fp)) list.push(fp);
    fs.writeFileSync(trustFile(), JSON.stringify(list));
    return true;
  });

  ipcMain.handle('cloud:fetch', async (_e, req) => {
    const url = String((req && req.url) || '');
    if (!/^https:\/\/api\.npoint\.io\/[A-Za-z0-9_-]+$/.test(url)) return { status: 400, text: JSON.stringify({ error: 'Nur api.npoint.io erlaubt.' }) };
    const method = req.method === 'POST' ? 'POST' : 'GET';
    try {
      const r = await net.fetch(url, {
        method,
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
        body: method === 'POST' ? String(req.body || '') : undefined,
        cache: 'no-store'
      });
      return { status: r.status, text: await r.text() };
    } catch (e) {
      const msg = String((e && e.message) || e);
      // Vom Nutzer bestätigtes Zertifikat (z. B. Firewall mit SSL-Prüfung): direkt verbinden und nur genau diesen Fingerabdruck akzeptieren
      if (/CERT/i.test(msg) && trustedList().length) {
        try {
          return await pinnedRequest(url, method, method === 'POST' ? String(req.body || '') : undefined);
        } catch (e2) {
          return { status: 502, text: JSON.stringify({ error: 'Cloud nicht erreichbar: ' + String((e2 && e2.message) || e2) }) };
        }
      }
      return { status: 502, text: JSON.stringify({ error: 'Cloud nicht erreichbar: ' + msg }) };
    }
  });
}

function sendStatus(s) {
  if (win && !win.isDestroyed()) win.webContents.send('update:status', s);
}

// 1.176: „sha512 checksum mismatch“ kam von halb geladenen oder gemischten Update-Dateien (Teil-Download per Blockmap).
// Jetzt immer ganz laden, und bei diesem Fehler den Zwischenspeicher leeren und einmal neu versuchen.
function clearUpdaterCache() {
  try {
    const base = process.env.LOCALAPPDATA;
    if (!base) return;
    for (const n of ['filamenthub-updater', 'FilamentHub-updater', 'filamenthub']) {
      const dir = require('path').join(base, n + (n.endsWith('-updater') ? '' : '-updater'));
      require('fs').rmSync(dir, { recursive: true, force: true });
    }
  } catch {
    /* Cache nicht löschbar: egal */
  }
}
const isChecksumError = e => /checksum|sha512|sha256/i.test(String((e && e.message) || e));

function setupAutoUpdate() {
  try {
    autoUpdater.disableDifferentialDownload = true;
  } catch {
    /* ältere Version ohne dieses Feld */
  }
  // Knopf in der App: jetzt nach Update suchen / installieren
  ipcMain.handle('update:check', async () => {
    if (!app.isPackaged) return { state: 'dev', message: 'Entwicklungsmodus: kein Update möglich.' };
    try {
      sendStatus({ state: 'checking' });
      let r;
      try {
        r = await autoUpdater.checkForUpdates();
      } catch (e0) {
        if (!isChecksumError(e0)) throw e0;
        clearUpdaterCache();
        r = await autoUpdater.checkForUpdates();
      }
      const v = r && r.updateInfo && r.updateInfo.version;
      if (!v || v === app.getVersion()) {
        const s = { state: 'current', version: app.getVersion() };
        sendStatus(s);
        return s;
      }
      return { state: 'downloading', version: v };
    } catch (e) {
      const s = { state: 'error', message: String((e && e.message) || e).slice(0, 160) };
      sendStatus(s);
      return s;
    }
  });
  ipcMain.handle('update:install', () => {
    app.isQuitting = true;
    if (server) server.kill();
    autoUpdater.quitAndInstall(true, true);
  });

  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', info => sendStatus({ state: 'downloading', version: info.version, percent: 0 }));
  autoUpdater.on('download-progress', p => sendStatus({ state: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-not-available', () => sendStatus({ state: 'current', version: app.getVersion() }));
  autoUpdater.on('update-downloaded', info => {
    sendStatus({ state: 'ready', version: info.version });
    if (!win) return;
    dialog
      .showMessageBox(win, {
        type: 'info',
        buttons: ['Jetzt neu starten', 'Später'],
        defaultId: 0,
        title: 'FilamentHub Update',
        message: `Version ${info.version} ist bereit.`,
        detail: 'Neu starten, um zu aktualisieren. Sonst wird beim nächsten Beenden aktualisiert.'
      })
      .then(r => {
        if (r.response === 0) {
          app.isQuitting = true;
          if (server) server.kill();
          autoUpdater.quitAndInstall(true, true);
        }
      });
  });
  autoUpdater.on('error', e => {
    console.error('Update-Fehler:', e && e.message);
    sendStatus({ state: 'error', message: String((e && e.message) || e).slice(0, 160) });
  });
  const check = () =>
    autoUpdater.checkForUpdates().catch(e => {
      if (isChecksumError(e)) {
        clearUpdaterCache();
        autoUpdater.checkForUpdates().catch(() => {});
      }
    });
  setTimeout(check, 8000);
  setInterval(check, 30 * 60 * 1000);
}

const lock = app.requestSingleInstanceLock();
if (!lock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(() => {
    // Windows: Taskleisten-Symbol und Benachrichtigungen gehören zu FilamentHub (nicht zu „Electron“)
    if (process.platform === 'win32') app.setAppUserModelId('de.filamenthub.desktop');
    // Meldungen (Druck fertig, Trocknung fertig) erlauben
    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'notifications' || permission === 'clipboard-sanitized-write'));
    setupCloudBridge();
    startServer();
    createWindow();
    setupAutoUpdate();
  });
  app.on('before-quit', () => {
    app.isQuitting = true;
    if (server) server.kill();
  });
  app.on('window-all-closed', () => app.quit());
}
