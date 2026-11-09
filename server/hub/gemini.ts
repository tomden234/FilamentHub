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
