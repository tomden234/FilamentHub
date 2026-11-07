import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';

const router = Router();

// Gemini AI Client optional initialisieren (funktioniert auch offline ohne API Key)
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

// API-Route: Spule per Foto (Kamera) erkennen
router.post('/api/recognize-spool', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body || {};
    if (typeof imageBase64 !== 'string' || !imageBase64) {
      return res.status(400).json({ error: 'Kein Bild empfangen.' });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

    const promptText = `
Du bist ein Experte für 3D-Druck Filamente (Bambu Lab, SUNLU, Prusament, ELEGOO, Eryone, Polymaker, Overture, eSUN, Geeetech, Extrudr etc.).
Analysiere das beigefügte Foto einer Filamentspule oder des Hersteller-Etiketts.
Extrahiere folgende Angaben im exakten JSON-Format:
{
  "brand": "string (Herstellername, z.B. Bambu Lab, SUNLU, ELEGOO, Prusament, Eryone, Overture, oder Unbekannt)",
  "material": "PLA" | "PLA+" | "PETG" | "TPU" | "ABS" | "ASA" | "PA / Nylon" | "PC" | "PET-CF / PA-CF",
  "name": "string (Aussagekräftiger Name, z.B. PETG Basic Weiß, PLA Matte Schwarz, TPU 95A)",
  "colorName": "string (Farbe auf Deutsch, z.B. Marmor, Dunkelgrün, Weiß, Schwarz, Galaxy Black)",
  "colorHex": "string (Hex-Farbcode der Farbe, z.B. #f8fafc für Weiß, #18181b für Schwarz, #166534 für Dunkelgrün)",
  "initialWeight": number (Nettogewicht in Gramm, Standard 1000),
  "emptySpoolWeight": number (Typisches Leerspulengewicht / Tara in Gramm, z.B. Bambu Lab 250, SUNLU 190, Prusament 200, Elegoo 160, Eryone 151, Overture 147),
  "pricePerKg": number (Geschätzter oder abgelesener Preis in Euro pro kg, z.B. 19.99),
  "dryTemp": number (Empfohlene Trocknungstemperatur in °C, z.B. PLA 50, PETG 65, TPU 55, ABS 70, PA 80),
  "dryHours": number (Empfohlene Trocknungsdauer in Stunden, z.B. 5 oder 6),
  "dryIntervalDays": number (Tage bis Nachtrocknung, z.B. PLA 30, PETG 21, TPU 14, PA 7),
  "confidence": number (Zuversicht von 0 bis 100),
  "detectedText": "string (Gefundene Texte auf dem Etikett)"
}
Antworte AUSSCHLIESSLICH mit gültigem JSON ohne Markdown-Codeblöcke.
    `.trim();

    // 1.231: Ohne Schlüssel ehrlich „nicht verfügbar“ (vorher kam eine erfundene ELEGOO-Erkennung mit 85 %)
    if (!ai) return res.status(503).json({ success: false, offline: true, error: 'Foto-Erkennung ist nicht eingerichtet (kein GEMINI_API_KEY).' });
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [{ inlineData: { data: cleanBase64, mimeType: typeof mimeType === 'string' && /^image\/(jpeg|png|webp|heic)$/.test(mimeType) ? mimeType : 'image/jpeg' } }, { text: promptText }]
        }
      ],
      config: { responseMimeType: 'application/json' }
    });
    let parsedData: unknown;
    try {
      parsedData = JSON.parse(response.text || '');
    } catch {
      return res.status(502).json({ success: false, error: 'Die KI hat keine lesbare Antwort geliefert. Bitte nochmal versuchen.' });
    }
    if (!parsedData || typeof parsedData !== 'object') return res.status(502).json({ success: false, error: 'Keine Spule erkannt.' });

    return res.json({ success: true, spool: parsedData });
  } catch (error: any) {
    console.error('Fehler bei der Bilderkennung:', error);
    // 1.231: keine internen Fehlertexte nach außen
    return res.status(500).json({ success: false, error: 'Fehler bei der Spulenerkennung.' });
  }
});

export default router;
