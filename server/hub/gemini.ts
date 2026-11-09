// Kleiner Gemini-Helfer für Text (Bestell-Mails). Schlüssel nur aus der Umgebung des Pi, nie in der Webseite.
import { GoogleGenAI } from '@google/genai';

let client: GoogleGenAI | null = null;
const getClient = () => {
  const k = process.env.GEMINI_API_KEY;
  if (!k) return null;
  return (client ||= new GoogleGenAI({ apiKey: k }));
};

export const geminiReady = () => Boolean(process.env.GEMINI_API_KEY);

/** Fragt Gemini und bekommt JSON-Text zurück. Wirft bei Fehler (ohne den Schlüssel in der Meldung). */
export async function geminiJson(prompt: string): Promise<string> {
  const ai = getClient();
  if (!ai) throw new Error('Kein Gemini-Schlüssel im Add-on eingetragen');
  const models = [process.env.GEMINI_MODEL, 'gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-3.6-flash'].filter((m, i, a): m is string => Boolean(m) && a.indexOf(m) === i);
  let last: any = null;
  for (const model of models) {
    try {
      const r = await ai.models.generateContent({ model, contents: [{ role: 'user', parts: [{ text: prompt }] }], config: { responseMimeType: 'application/json' } });
      return String(r.text || '');
    } catch (e: any) {
      last = e;
      if (e?.status !== 404) break;
    }
  }
  throw new Error(`Gemini-Fehler ${last?.status ?? ''}`.trim());
}

/** Gemini mit Google-Suche: Treffer-Adressen (aus der Suche) und der Antworttext. Flash-Lite kann die Suche nicht immer: dann das nächste Modell. */
export async function geminiSearch(prompt: string): Promise<{ urls: string[]; text: string }> {
  const ai = getClient();
  if (!ai) throw new Error('Kein Gemini-Schlüssel im Add-on eingetragen');
  const models = [process.env.GEMINI_MODEL, 'gemini-flash-latest', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'].filter((m, i, a): m is string => Boolean(m) && a.indexOf(m) === i);
  let last: any = null;
  for (const model of models) {
    try {
      const r = await ai.models.generateContent({ model, contents: [{ role: 'user', parts: [{ text: prompt }] }], config: { tools: [{ googleSearch: {} }] } });
      const chunks = r.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      return { urls: chunks.map(c => String(c.web?.uri || '')).filter(Boolean), text: String(r.text || '') };
    } catch (e: any) {
      last = e;
      console.warn(`[Produktlink] Gemini ${model} mit Suche: ${e?.status ?? ''} ${String(e?.message || e).slice(0, 160)}`);
      // Schlüssel- oder Limitfehler gelten für alle Modelle
      if ([401, 402, 403, 429].includes(Number(e?.status))) break;
    }
  }
  throw new Error(`Gemini-Suche fehlgeschlagen (${last?.status ?? 'unbekannt'})`);
}
