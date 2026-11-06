// Kamera direkt vom Drucker (ohne Home Assistant): RTSPS-Stream des Druckers (Port 322) per ffmpeg zu JPEG-Bildern.
// Läuft nur, solange Bilder abgerufen werden (stoppt nach 15 s ohne Abruf).
import { spawn, type ChildProcess } from 'node:child_process';

let proc: ChildProcess | null = null;
let procKey = '';
let latest: Buffer | null = null;
let latestAt = 0;
let lastRequest = 0;
let lastError = '';
let stopTimer: ReturnType<typeof setInterval> | null = null;
let starting: Promise<void> | null = null;

async function ffmpegPath(): Promise<string> {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    const m: any = await import('ffmpeg-static');
    const p = m.default || m;
    if (typeof p === 'string' && p) return p;
  } catch {
    /* nicht installiert: ffmpeg aus dem Systempfad */
  }
  return 'ffmpeg';
}

function stop() {
  if (proc) {
    try {
      proc.kill('SIGKILL');
    } catch {
      /* schon beendet */
    }
  }
  proc = null;
  procKey = '';
  if (stopTimer) clearInterval(stopTimer);
  stopTimer = null;
}

async function start(ip: string, code: string) {
  stop();
  const key = `${ip}|${code}`;
  procKey = key;
  const bin = await ffmpegPath();
  const url = `rtsps://bblp:${encodeURIComponent(code)}@${ip}:322/streaming/live/1`;
  // 3 Bilder pro Sekunde, 1280 Pixel breit, als JPEG-Folge auf stdout
  const args = ['-hide_banner', '-loglevel', 'error', '-rtsp_transport', 'tcp', '-i', url, '-an', '-vf', 'fps=3,scale=1280:-2', '-q:v', '5', '-f', 'image2pipe', '-c:v', 'mjpeg', 'pipe:1'];
  const p = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  proc = p;
  lastError = '';
  let buf: Buffer = Buffer.alloc(0);
  p.stdout!.on('data', (chunk: Buffer) => {
    buf = buf.length ? Buffer.concat([buf, chunk]) : chunk;
    for (;;) {
      const s = buf.indexOf(Buffer.from([0xff, 0xd8]));
      if (s < 0) {
        buf = Buffer.alloc(0);
        return;
      }
      const e = buf.indexOf(Buffer.from([0xff, 0xd9]), s + 2);
      if (e < 0) {
        buf = s > 0 ? buf.subarray(s) : buf;
        if (buf.length > 4_000_000) buf = Buffer.alloc(0);
        return;
      }
      latest = Buffer.from(buf.subarray(s, e + 2));
      latestAt = Date.now();
      buf = buf.subarray(e + 2);
    }
  });
  let err = '';
  p.stderr!.on('data', (d: Buffer) => {
    err = (err + d.toString()).slice(-600);
  });
  p.on('error', (e: any) => {
    lastError = e?.code === 'ENOENT' ? 'ffmpeg fehlt (bei der Windows-App ist es dabei, sonst ffmpeg installieren).' : `ffmpeg-Fehler: ${e?.message || e}`;
  });
  p.on('exit', () => {
    if (proc === p) {
      proc = null;
      procKey = '';
      if (!lastError) lastError = err.trim() ? `Stream-Fehler: ${err.trim().split('\n').pop()}` : 'Stream beendet.';
    }
  });
  stopTimer = setInterval(() => {
    if (Date.now() - lastRequest > 15_000) stop();
  }, 5000);
}

/** Neuestes Kamerabild des Druckers (wartet beim ersten Aufruf bis zu 10 s auf das erste Bild) */
export async function getPrinterFrame(ip: string, code: string): Promise<{ ok: true; jpeg: Buffer } | { ok: false; error: string }> {
  lastRequest = Date.now();
  if (!proc || procKey !== `${ip}|${code}`) {
    // 1.229: Zwei Abrufe gleichzeitig (Handy + PC) starteten zwei ffmpeg, der erste lief dann ewig weiter. Jetzt nur ein Start.
    if (!starting) {
      latest = null;
      starting = start(ip, code).finally(() => {
        starting = null;
      });
    }
    await starting;
  }
  const t0 = Date.now();
  while ((!latest || Date.now() - latestAt > 5000) && Date.now() - t0 < 10_000) {
    if (!proc) break;
    await new Promise(r => setTimeout(r, 150));
  }
  if (latest && Date.now() - latestAt <= 5000) return { ok: true, jpeg: latest };
  return {
    ok: false,
    error: lastError || 'Kein Bild vom Drucker. Im Drucker „LAN-Modus Liveview“ einschalten (Einstellungen > Allgemein) und IP/Code prüfen.'
  };
}
