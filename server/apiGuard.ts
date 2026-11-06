// Zugriffsschutz für /api (1.229). Rein testbar: decideAccess() bekommt alles von außen.
import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

/** Routen, die der Browser selbst lädt (<img>, EventSource) und die darum den Schlüssel auch als ?k= dürfen */
const QUERY_KEY_PATHS = [
  /^\/api\/printer\/stream$/,
  /^\/api\/printer\/camera-frame$/,
  /^\/api\/homeassistant\/camera-snapshot$/,
  /^\/api\/recorder\/photo$/,
  /^\/api\/hub\/queue\/thumb\/[0-9a-f]{12}$/,
  /^\/api\/hub\/backup$/
];

/** Host-Kopf ohne Port, klein geschrieben ("[::1]:3000" → "::1") */
export function hostName(host: string | undefined): string {
  const h = String(host || '').trim().toLowerCase();
  if (h.startsWith('[')) return h.slice(1, h.indexOf(']') > 0 ? h.indexOf(']') : undefined);
  return h.replace(/:\d+$/, '');
}

export const isLoopbackHost = (h: string) => h === 'localhost' || h === '::1' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h);

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function decideAccess(o: {
  expectedKey: string;
  headerKey: unknown;
  queryKey: unknown;
  method: string;
  path: string;
  host: string | undefined;
}): { ok: true } | { ok: false; status: number; error: string } {
  const expected = o.expectedKey;
  if (!expected) {
    // Kein Schlüssel eingerichtet: nur localhost (Windows-App, Entwicklung). Fremde Host-Namen = DNS-Rebinding oder WLAN.
    return isLoopbackHost(hostName(o.host))
      ? { ok: true }
      : { ok: false, status: 403, error: 'Kein API-Schlüssel eingerichtet: Zugriff nur über localhost erlaubt.' };
  }
  if (typeof o.headerKey === 'string' && sameSecret(o.headerKey, expected)) return { ok: true };
  const queryAllowed = o.method === 'GET' && QUERY_KEY_PATHS.some(r => r.test(o.path));
  if (queryAllowed && typeof o.queryKey === 'string' && sameSecret(o.queryKey, expected)) return { ok: true };
  return { ok: false, status: 401, error: 'Nicht autorisiert: Schlüssel vom Pi in der App eintragen (Menü → Pi-Server).' };
}

export function apiGuard() {
  return (req: Request, res: Response, next: NextFunction) => {
    const r = decideAccess({
      expectedKey: process.env.APP_API_KEY || '',
      headerKey: req.headers['x-api-key'],
      queryKey: req.query?.k,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      host: req.headers.host
    });
    if (r.ok) return next();
    return res.status(r.status).json({ success: false, error: r.error });
  };
}
