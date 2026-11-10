// Spulen-Dokument auf dem Pi-Server (Adresse „pi:“). Gleiches Verhalten wie der Gist-Speicher: GET liest, POST ersetzt.
// Zusätzlich liefert der Server einen Versionszähler (ETag); mit If-Match schreibt er nur, wenn niemand dazwischen war.
import { getServerKey, serverBase } from "./serverEndpoint";

export const PI_URL = "pi:";
/** 1.298: Letzte gelesene Fassung (Versionsnummer + Text). Die App fragt „nur wenn neuer“ (If-None-Match); antwortet der Pi mit 304, kommt dieser Text zurück. */
let lastGet: { base: string; etag: string; body: string } | null = null;

export const isPiUrl = (u: string): boolean => u === PI_URL;

export async function piDocFetch(
  init: {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
  } = {},
): Promise<Response> {
  const b = serverBase();
  if (b === null)
    return new Response(
      JSON.stringify({
        error: "Kein Pi-Server eingetragen (Menü → FilamentHub Server).",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  const key = getServerKey();
  const isGet = !init.method || init.method.toUpperCase() === "GET";
  const headers: Record<string, string> = {
    ...(init.headers || {}),
    ...(key ? { "x-api-key": key } : {}),
    ...(isGet && lastGet?.base === b ? { "If-None-Match": lastGet.etag } : {}),
  };
  if (!isGet) lastGet = null; // nach dem Speichern gilt die alte Fassung nicht mehr
  try {
    const res = await fetch(`${b}/api/hub/doc`, {
      method: init.method || "GET",
      headers,
      body: init.body,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 304 && lastGet && lastGet.base === b)
      return new Response(lastGet.body, {
        status: 200,
        headers: { "Content-Type": "application/json", ETag: lastGet.etag },
      });
    if (res.status === 401)
      return new Response(
        JSON.stringify({
          error: "Schlüssel fehlt oder falsch (Menü → FilamentHub Server).",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    // Ein alter Pi kennt die Route nicht und liefert die Startseite (HTML, Status 200) statt Daten: klar melden statt später „Unexpected token <“
    if (!(res.headers.get('content-type') || '').includes('application/json')) {
      return new Response(JSON.stringify({ error: 'Der Pi kennt diese Funktion noch nicht. Home Assistant → Einstellungen → Apps → FilamentHub Server → auf Version 1.3.9 aktualisieren.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    const etag = res.headers.get("etag");
    if (isGet && res.ok && etag) {
      const body = await res.clone().text();
      lastGet = { base: b, etag, body };
    }
    return res;
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: `Pi nicht erreichbar: ${e?.message || e}` }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }
}
