// Bambu-Cloud-Login mit E-Mail und Passwort. Reine fetch-Logik ohne Browser- oder Server-Abhängigkeit,
// damit sie sowohl in der Android-App (direkt, ohne Server) als auch im lokalen Server genutzt wird.
//
// Ablauf bei Bambu:
//  1. Login mit Konto + Passwort. Antwort: direkt ein accessToken, oder loginType "verifyCode" (Code per E-Mail)
//     oder loginType "tfa" (Authenticator-App, mit tfaKey).
//  2. verifyCode: Code per E-Mail anfordern (sendemail/code) und Login mit Konto + code wiederholen.
//  3. tfa: tfaKey + 6-stelliger Code der Authenticator-App an /api/sign-in/tfa senden.
//
// Hinweis: Im normalen Browser blockiert Bambu den Zugriff (CORS). In der Android-App läuft fetch über
// CapacitorHttp (siehe capacitor.config.json) und ist davon nicht betroffen.

const API = 'https://api.bambulab.com';
const WEB = 'https://bambulab.com';
const TIMEOUT_MS = 20000;

export interface BambuLoginInput {
  email: string;
  password: string;
  /** 6-stelliger Code aus der Bestätigungs-E-Mail */
  code?: string;
  /** Schlüssel, den Bambu bei aktiver 2-Faktor-App zurückgibt */
  tfaKey?: string;
  /** 6-stelliger Code der Authenticator-App */
  tfaCode?: string;
  /** Bestätigungs-E-Mail erneut senden, ohne Login */
  resend?: boolean;
}

export type BambuLoginResult =
  | { status: 'ok'; accessToken: string; userId?: string; refreshToken?: string }
  | { status: 'needCode'; message: string }
  | { status: 'needTfa'; tfaKey: string; message: string }
  | { status: 'error'; message: string; network?: boolean };

const NETWORK_MESSAGE =
  'Keine Verbindung zu Bambu. Im normalen Browser blockiert Bambu den Login (CORS) – nutze die Handy-App ' +
  'oder den lokalen Server, oder hole das Token manuell (Tab „Woher Tokens?“).';

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': 'BambuStudio/01.09.05.51',
    'X-BBL-Client-Type': 'BambuStudio',
    'X-BBL-Client-Version': '01.09.05.51'
  };
}

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: any; html: boolean }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  const text = await res.text();
  let data: any = {};
  let html = false;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    html = /<html|<!doctype/i.test(text);
  }
  return { ok: res.ok, status: res.status, data, html };
}

function blockedMessage(status: number): string {
  return `Bambu hat die Anfrage abgelehnt (HTTP ${status}, vermutlich Bot-Schutz). Bitte später erneut versuchen oder das Token manuell holen (Tab „Woher Tokens?“).`;
}

function decodeJwt(token: string): any | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

/** User-ID aus dem Token (JWT) lesen, sonst bei Bambu nachfragen. Gibt nur Ziffern zurück (ohne "u_"). */
export async function resolveBambuUserId(token: string): Promise<string | null> {
  const payload = decodeJwt(token);
  if (payload) {
    const candidate = payload.uid ?? payload.userId ?? payload.user_id ?? payload.username ?? payload.sub;
    const clean = String(candidate ?? '').trim().replace(/^u_/, '');
    if (/^\d+$/.test(clean)) return clean;
  }
  const urls = [`${API}/v1/design-user-service/my/preference`, `${API}/v1/user-service/my/profile`];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token.trim()}`, 'User-Agent': 'BambuStudio/01.09.05.51' },
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
      if (!res.ok) continue;
      const json = await res.json();
      const uid = json.uid ?? json.userId ?? json.user_id ?? json.profile?.uid;
      if (uid) return String(uid).trim().replace(/^u_/, '');
    } catch {
      // nächste Adresse versuchen
    }
  }
  return null;
}

/** Bestätigungs-E-Mail (6-stelliger Code) anfordern */
async function sendBambuEmailCode(email: string): Promise<{ ok: boolean; message?: string; network?: boolean }> {
  try {
    const r = await postJson(`${API}/v1/user-service/user/sendemail/code`, { email: email.trim(), type: 'codeLogin' });
    if (r.html) return { ok: false, message: blockedMessage(r.status) };
    if (r.ok) return { ok: true };
    return { ok: false, message: r.data?.message || r.data?.error || `Code konnte nicht gesendet werden (HTTP ${r.status}).` };
  } catch {
    return { ok: false, network: true, message: NETWORK_MESSAGE };
  }
}

async function finish(accessToken: string, refreshToken?: string): Promise<BambuLoginResult> {
  const userId = await resolveBambuUserId(accessToken);
  return { status: 'ok', accessToken, userId: userId || undefined, refreshToken };
}

/** Login bei Bambu. Liefert immer ein einheitliches Ergebnis, wirft nie. */
export async function bambuLogin(input: BambuLoginInput): Promise<BambuLoginResult> {
  const email = input.email.trim();
  if (!email) return { status: 'error', message: 'Bitte E-Mail eingeben.' };

  try {
    // Nur Code erneut senden
    if (input.resend) {
      const sent = await sendBambuEmailCode(email);
      return sent.ok
        ? { status: 'needCode', message: 'Neuer Bestätigungscode wurde per E-Mail gesendet.' }
        : { status: 'error', message: sent.message || 'Code konnte nicht gesendet werden.', network: sent.network };
    }

    // 2-Faktor-App: tfaKey + Code einlösen
    if (input.tfaKey && input.tfaCode?.trim()) {
      const r = await postJson(`${WEB}/api/sign-in/tfa`, { tfaKey: input.tfaKey, tfaCode: input.tfaCode.trim() });
      if (r.html) return { status: 'error', message: blockedMessage(r.status) };
      const token = r.data?.accessToken || r.data?.token || r.data?.data?.accessToken;
      if (token) return finish(token, r.data?.refreshToken);
      return {
        status: 'error',
        message: r.data?.message || r.data?.error || 'Der Code der Authenticator-App wurde nicht akzeptiert.'
      };
    }

    if (!input.password && !input.code) return { status: 'error', message: 'Bitte Passwort eingeben.' };

    // Mit E-Mail-Code: Konto + code, ohne Passwort
    const body = input.code?.trim()
      ? { account: email, code: input.code.trim() }
      : { account: email, password: input.password };

    const r = await postJson(`${API}/v1/user-service/user/login`, body);
    if (r.html) return { status: 'error', message: blockedMessage(r.status) };
    const data = r.data || {};

    if (data.accessToken) return finish(data.accessToken, data.refreshToken);

    if (data.loginType === 'verifyCode') {
      if (input.code?.trim()) {
        return { status: 'error', message: 'Der Bestätigungscode wurde nicht akzeptiert. Bitte neu anfordern.' };
      }
      const sent = await sendBambuEmailCode(email);
      if (!sent.ok) return { status: 'error', message: sent.message || 'Bestätigungscode konnte nicht gesendet werden.', network: sent.network };
      return { status: 'needCode', message: 'Bambu hat einen 6-stelligen Code an deine E-Mail gesendet. Bitte unten eingeben.' };
    }

    if (data.loginType === 'tfa' && data.tfaKey) {
      return {
        status: 'needTfa',
        tfaKey: String(data.tfaKey),
        message: 'Dein Konto nutzt eine Authenticator-App. Bitte den 6-stelligen Code der App eingeben.'
      };
    }

    return {
      status: 'error',
      message:
        data.message ||
        data.error ||
        (r.status === 400 || r.status === 401
          ? 'E-Mail oder Passwort falsch. Mit Google/Apple angemeldet? Dann den manuellen Token-Weg nutzen (Tab „Woher Tokens?“).'
          : `Login fehlgeschlagen (HTTP ${r.status}).`)
    };
  } catch {
    return { status: 'error', network: true, message: NETWORK_MESSAGE };
  }
}
