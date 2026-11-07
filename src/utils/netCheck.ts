// Reine Netz-Prüfungen (ohne Seiteneffekte, testbar). Gemeinsam für Server, Drucker-Kern und App (1.231: vorher 3 Kopien).

/**
 * Heimnetz (10.x, 172.16-31.x, 192.168.x) oder Tailscale (100.64-127.x)? Nur IPv4.
 * So kann der LAN-Modus/LAN-Test nie an einen fremden Server im Internet geleitet werden.
 */
export function isLanIp(raw: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(raw || '').trim());
  if (!m) return false;
  const o = m.slice(1).map(Number);
  if (o.some(n => n > 255)) return false;
  return o[0] === 10 || (o[0] === 172 && o[1] >= 16 && o[1] <= 31) || (o[0] === 192 && o[1] === 168) || (o[0] === 100 && o[1] >= 64 && o[1] <= 127);
}

/**
 * 1.231: Darf der Server eine Home-Assistant-Adresse aus einer Anfrage ansprechen? Nur Nabu Casa, *.local, localhost/Supervisor
 * oder Heimnetz/Tailscale-IP. Sonst ließe sich der Server als Weiterleitung zu beliebigen Adressen im Internet benutzen.
 */
export function isAllowedHaUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(String(raw || '').trim());
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  if (u.username || u.password) return false;
  const h = u.hostname.toLowerCase();
  return /(^|\.)ui\.nabu\.casa$/.test(h) || /\.local$/.test(h) || h === 'localhost' || h === 'homeassistant' || h === 'supervisor' || h === '127.0.0.1' || isLanIp(h);
}
