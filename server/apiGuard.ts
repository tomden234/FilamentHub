// Zugriffsschutz für /api (1.229). Rein testbar: decideAccess() bekommt alles von außen.
import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

/** Routen, die der Browser selbst lädt (<img>, EventSource): die dürfen den Zugang auch als Adress-Zusatz bekommen */
const QUERY_KEY_PATHS = [
  /^\/api\/printer\/stream$/,
  /^\/api\/printer\/camera-frame$/,
  /^\/api\/homeassistant\/camera-snapshot$/,
  /^\/api\/recorder\/photo$/,
  /^\/api\/hub\/queue\/thumb\/[0-9a-f]{12}$/,
  /^\/api\/hub\/backup$/
];

/** Gültigkeit eines Medien-Tokens (1.231): 12 Stunden */
const MEDIA_TOKEN_MS = 12 * 3600_000;

/** Host-Kopf ohne Port, klein geschrieben ("[::1]:3000" → "::1") */
export function hostName(host: string | undefined): string {
  const h = String(host || '').trim().toLowerCase();
  if (h.startsWith('[')) return h.slice(1, h.indexOf(']') > 0 ? h.indexOf(']') : undefined);
  return h.replace(/:\d+$/, '');
}

const isLoopbackHost = (h: string) => h === 'localhost' || h === '::1' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h);

/** Echte Absender-Adresse (Socket) ist dieser Rechner? ("::ffff:127.0.0.1" zählt mit) */
export const isLoopbackAddr = (a: string | undefined): boolean => {
  const s = String(a || '').trim().toLowerCase();
  return s === '::1' || /^(::ffff:)?127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(s);
};

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const mediaSig = (key: string, exp: number) => crypto.createHmac('sha256', key).update(`media:${exp}`).digest('base64url').slice(0, 32);

/**
 * 1.231: Kurzlebiger Medien-Token für <img>/EventSource statt des echten Schlüssels in der Adresse
 * (Adressen landen im Browser-Verlauf und Zwischenspeicher). Form: "<Ablauf-ms>.<HMAC>".
 */
export function makeMediaToken(key: string, now = Date.now()): { token: string; exp: number } {
  const exp = now + MEDIA_TOKEN_MS;
  return { token: `${exp}.${mediaSig(key, exp)}`, exp };
}

export function checkMediaToken(token: unknown, key: string, now = Date.now()): boolean {
  if (typeof token !== 'string' || !key) return false;
  const m = /^(\d{10,16})\.([A-Za-z0-9_-]{32})$/.exec(token);
  if (!m) return false;
  const exp = Number(m[1]);
  if (!(exp > now) || exp - now > MEDIA_TOKEN_MS + 60_000) return false;
  return sameSecret(m[2], mediaSig(key, exp));
}

export function decideAccess(o: {
  expectedKey: string;
  headerKey: unknown;
  queryKey: unknown;
  /** 1.231: Medien-Token (?mt=) */
  mediaToken?: unknown;
  method: string;
  path: string;
  host: string | undefined;
  /** 1.231: echte Absender-Adresse (Socket). Den Host-Kopf kann jeder fälschen. */
  remoteAddress?: string;
  now?: number;
}): { ok: true } | { ok: false; status: number; error: string } {
  const expected = o.expectedKey;
  if (!expected) {
    // Kein Schlüssel eingerichtet: nur localhost (Windows-App, Entwicklung). Host-Kopf UND Absender müssen dieser Rechner sein:
    // fremder Host-Name = DNS-Rebinding, fremder Absender = jemand im WLAN mit gefälschtem „Host: localhost“.
    return isLoopbackHost(hostName(o.host)) && isLoopbackAddr(o.remoteAddress)
      ? { ok: true }
      : { ok: false, status: 403, error: 'Kein API-Schlüssel eingerichtet: Zugriff nur über localhost erlaubt.' };
  }
  if (typeof o.headerKey === 'string' && sameSecret(o.headerKey, expected)) return { ok: true };
  const queryAllowed = o.method === 'GET' && QUERY_KEY_PATHS.some(r => r.test(o.path));
  if (queryAllowed && checkMediaToken(o.mediaToken, expected, o.now)) return { ok: true };
  // Übergang: ältere Apps schicken noch ?k= (der echte Schlüssel). Neue Apps nutzen den Medien-Token.
  if (queryAllowed && typeof o.queryKey === 'string' && sameSecret(o.queryKey, expected)) return { ok: true };
  return { ok: false, status: 401, error: 'Nicht autorisiert: Schlüssel vom Pi in der App eintragen (Menü → Pi-Server).' };
}

export function apiGuard() {
  return (req: Request, res: Response, next: NextFunction) => {
    const r = decideAccess({
      expectedKey: process.env.APP_API_KEY || '',
      headerKey: req.headers['x-api-key'],
      queryKey: req.query?.k,
      mediaToken: req.query?.mt,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      host: req.headers.host,
      remoteAddress: req.socket?.remoteAddress
    });
    if (r.ok) return next();
    return res.status(r.status).json({ success: false, error: r.error });
  };
}
