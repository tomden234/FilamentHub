import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { apiGuard } from './server/apiGuard.js';
import { rootDir } from './server/paths.js';
import storageRoutes from './server/routes/storage.js';
import recognizeRoutes from './server/routes/recognize.js';
import printerRoutes from './server/routes/printer.js';
import printerCameraRoutes from './server/routes/printerCamera.js';
import homeAssistantRoutes from './server/routes/homeAssistant.js';
import recorderRoutes from './server/routes/recorder.js';
import hubRoutes from './server/routes/hub.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// CORS: nur ausdrücklich erlaubte Ursprünge (Env CORS_ORIGIN, kommagetrennt).
// Ohne Angabe ist kein Cross-Origin-Zugriff erlaubt (Frontend wird vom selben Server ausgeliefert).
const corsOrigins = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: corsOrigins.length > 0 ? corsOrigins : false }));

// Zugriffsschutz (1.229): Ist APP_API_KEY gesetzt (Pi-App erzeugt ihn selbst), braucht jede /api-Route den Schlüssel.
// Ohne Schlüssel antwortet der Server nur Aufrufen über localhost (Windows-App, npm run dev): so kann weder jemand im WLAN
// noch eine fremde Webseite per DNS-Rebinding den Drucker steuern.
app.use('/api', apiGuard());
// JSON-Body: große Bilder/Dateien nur für Foto-Erkennung und G-Code-Upload, sonst höchstens 5 MB
app.use(['/api/recognize-spool', '/api/printer/upload-gcode'], express.json({ limit: '25mb' }));
app.use(express.json({ limit: '5mb' }));

// Routen (jede Gruppe liegt in server/routes/)
app.use(storageRoutes);
app.use(recognizeRoutes);
app.use(printerRoutes);
app.use(printerCameraRoutes);
app.use(homeAssistantRoutes);
app.use(recorderRoutes);
app.use(hubRoutes);

// Lebenszeichen für den Watchdog der Home-Assistant-App (ohne API-Key, verrät nichts)
app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Assetlinks (Android-App) mit passenden Headern
app.get('/.well-known/assetlinks.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.sendFile(path.resolve(rootDir, 'public', '.well-known', 'assetlinks.json'));
});

// Vite Middleware im Development Modus einhängen
async function startServer() {
  const http = await import('http');
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server: httpServer }
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // Produktion: Statische Dateien aus dist/ ausliefern
    const distPath = path.resolve(rootDir, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Zentrale Fehlerbehandlung: einheitliche Antwort, keine internen Details nach außen
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(err);
    const status = typeof err?.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;
    console.error('[Server] Unbehandelter Fehler:', err?.message || err);
    return res.status(status).json({
      success: false,
      error: status === 500 ? 'Interner Serverfehler' : err?.message || 'Fehler'
    });
  });

  httpServer.listen(PORT, process.env.HOST || '0.0.0.0', () => {
    console.log(`FilamentHub Server läuft auf http://localhost:${PORT}`);
  });
}

process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unbehandelte Promise-Ablehnung:', reason);
});

startServer();
