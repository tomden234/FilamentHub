// FilamentHub für Windows: startet den eingebauten Server (spricht per LAN/MQTT mit dem Drucker) und zeigt die App im Fenster.
const { app, BrowserWindow, Menu, shell, session, dialog, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = 38517; // fest, damit die gespeicherten Daten (Spulen, Einstellungen) immer im selben Speicher liegen
const URL = `http://127.0.0.1:${PORT}`;
let server = null;
let win = null;

// 1.193: ERR_HTTP2_PROTOCOL_ERROR kommt von Schul-/Firmennetz, Proxy oder Virenscanner, die HTTP/2 stören. HTTP/2 aus -> HTTP/1.1.
app.commandLine.appendSwitch('disable-http2');

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
  // 1.229: nur echte Webadressen im Browser öffnen (kein file:, ms-…: oder andere Protokolle)
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(URL + '/')) return { action: 'allow' };
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith(URL + '/') || url === URL) return;
    e.preventDefault();
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
  });
  try {
    await waitForServer();
    await win.loadURL(URL);
  } catch (e) {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<body style="font-family:sans-serif;background:#0d1a19;color:#f2e9da;padding:32px"><h2>FilamentHub startet nicht</h2><p>Der interne Server antwortet nicht. Port ' + PORT + ' evtl. belegt. Log: ' + path.join(app.getPath('userData'), 'server.log') + '</p></body>'));
  }
}

// Automatische Updates (wie bei der Handy-App): neue Version im Hintergrund laden, beim Beenden oder per Klick installieren
// 1.234: Die Cloud-Brücke für npoint (Windows-Zertifikate, Fingerabdruck-Vertrauen) ist entfernt: npoint ist abgeschaltet.

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
const isNetError = e => /ERR_HTTP2|ERR_CONNECTION|ERR_NETWORK|ERR_SSL|ERR_TIMED_OUT|ERR_INTERNET|ERR_PROXY|ERR_TUNNEL|ERR_EMPTY_RESPONSE/i.test(String((e && e.message) || e));
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
        if (isChecksumError(e0)) {
          clearUpdaterCache();
          r = await autoUpdater.checkForUpdates();
        } else if (isNetError(e0) || /latest\.yml|channel|404|ENOTFOUND|ETIMEDOUT|ECONNRESET/i.test(String((e0 && e0.message) || e0))) {
          // Release wird gerade neu veröffentlicht oder kurzer Netzfehler: nach 6 s noch einmal
          await new Promise(res => setTimeout(res, isNetError(e0) ? 2500 : 6000));
          r = await autoUpdater.checkForUpdates();
        } else {
          throw e0;
        }
      }
      const v = r && r.updateInfo && r.updateInfo.version;
      if (!v || v === app.getVersion()) {
        const s = { state: 'current', version: app.getVersion() };
        sendStatus(s);
        return s;
      }
      return { state: 'downloading', version: v };
    } catch (e) {
      const raw = String((e && e.message) || e);
      const s = {
        state: 'error',
        message: isNetError(e) ? 'Keine stabile Verbindung zu GitHub (Netz/Proxy/Firewall). Anderes WLAN oder Handy-Hotspot probieren, dann nochmal prüfen.' : /latest\.yml|channel/i.test(raw) ? 'Neue Version wird gerade veröffentlicht. In 3 Minuten nochmal prüfen.' : raw.slice(0, 160)
      };
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
        message: "Neue Version ist bereit.",
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
      if (isNetError(e)) {
        setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 5000);
      } else if (isChecksumError(e)) {
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
