import { apiPost, type ApiBase, type ApiResult } from './client';
import { getServerKey, getServerUrl } from '../utils/serverEndpoint';

// KI-Spulenerkennung per Kamera (/api/recognize-spool)

type RecognizeResult = ApiBase & { spool?: any };

/** 1.266: Ist ein Pi eingetragen, geht das Foto direkt dorthin (GitHub Pages und Handy-App haben sonst keinen Server). */
async function viaPi(imageBase64: string, mimeType: string): Promise<ApiResult<RecognizeResult>> {
  const key = getServerKey();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) headers['x-api-key'] = key;
  const res = await fetch(`${getServerUrl()}/api/recognize-spool`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ imageBase64, mimeType }),
    signal: AbortSignal.timeout(60_000)
  });
  let data: any = {};
  let isJson = false;
  try {
    data = await res.json();
    isJson = true;
  } catch {
    /* keine JSON-Antwort */
  }
  if (res.status === 401) data = { success: false, error: 'Schlüssel für den Pi fehlt oder ist falsch (Verbindungen → FilamentHub Server).' };
  return { ok: res.ok, status: res.status, data, isJson };
}

export const recognizeApi = {
  recognizeSpool: (imageBase64: string, mimeType: string): Promise<ApiResult<RecognizeResult>> =>
    getServerUrl() ? viaPi(imageBase64, mimeType) : apiPost<RecognizeResult>('/api/recognize-spool', { imageBase64, mimeType })
};
