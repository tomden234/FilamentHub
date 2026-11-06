// Reine Netz-Prüfungen (ohne Seiteneffekte, testbar)

// Heimnetz oder Tailscale (100.64.0.0/10)? Nur dorthin darf der LAN-Test verbinden (kein Port-Scanner ins Internet).
export function isLanIp(ip: string): boolean {
  const m = String(ip || '').trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const o = m.slice(1).map(Number);
  if (o.some(n => n > 255)) return false;
  return o[0] === 10 || (o[0] === 192 && o[1] === 168) || (o[0] === 172 && o[1] >= 16 && o[1] <= 31) || (o[0] === 100 && o[1] >= 64 && o[1] <= 127);
}
