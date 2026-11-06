// Spulen-Dokument auf dem Pi-Server (Adresse „pi:“). Gleiches Verhalten wie npoint/Gist: GET liest, POST ersetzt.
// Zusätzlich liefert der Server einen Versionszähler (ETag); mit If-Match schreibt er nur, wenn niemand dazwischen war.
import { getServerKey, serverBase } from "./serverEndpoint";

export const PI_URL = "pi:";
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
  const headers: Record<string, string> = {
    ...(init.headers || {}),
    ...(key ? { "x-api-key": key } : {}),
  };
  try {
    const res = await fetch(`${b}/api/hub/doc`, {
      method: init.method || "GET",
      headers,
      body: init.body,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 401)
      return new Response(
        JSON.stringify({
          error: "Schlüssel fehlt oder falsch (Menü → FilamentHub Server).",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    return res;
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: `Pi nicht erreichbar: ${e?.message || e}` }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }
}
