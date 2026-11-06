// Adresse und Schlüssel des FilamentHub-Servers (Pi). Eigenes kleines Modul, damit Cloud-Zugriff und Server-Aufrufe sich nicht gegenseitig einbinden.
import { safeStorage } from "./safeStorage";
import { IS_NATIVE, IS_STATIC } from "./env";

export const SERVER_URL_KEY = "filamenthub_server_url";
export const SERVER_KEY_KEY = "filamenthub_server_key";

/** „192.168.68.10“ → „http://192.168.68.10:3000“ */
export function normalizeServerUrl(v: string): string {
  let u = String(v || "")
    .trim()
    .replace(/\/+$/, "");
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`;
  const host = u.replace(/^https?:\/\//i, "").split("/")[0];
  if (/^http:\/\//i.test(u) && !host.includes(":")) u += ":3000";
  return u;
}

export const getServerUrl = (): string =>
  safeStorage.getItem(SERVER_URL_KEY) || "";
export const getServerKey = (): string =>
  safeStorage.getItem(SERVER_KEY_KEY) || "";

/** Ohne eingetragene Adresse: nur der eigene Server (Windows-App, lokaler Server). Auf GitHub Pages und in der Handy-App gibt es keinen. */
export function serverBase(): string | null {
  const u = getServerUrl();
  if (u) return u;
  return IS_STATIC || IS_NATIVE ? null : "";
}
