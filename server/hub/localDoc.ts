// Das Spulen-Dokument der App (Spulen, Verlauf, Druckliste) als Datei auf dem Pi (SSD).
// Ersatz für npoint/Gist: kein Fremddienst, kein Token. Jede Änderung zählt `rev` hoch,
// damit zwei Geräte sich nicht gegenseitig überschreiben (If-Match → 409).
import path from "path";
import { dataDir } from "../paths.js";
import { loadJsonConfig, prevOf, saveJsonConfig } from "../jsonConfig.js";

const file = () => path.join(dataDir, "filamenthub-doc.json");
const prevFile = () => prevOf(file());

interface StoredDoc {
  rev: number;
  doc: Record<string, unknown>;
}

const valid = (d: StoredDoc) =>
  !!d &&
  typeof d.rev === "number" &&
  !!d.doc &&
  typeof d.doc === "object" &&
  !Array.isArray(d.doc);

export function readLocalDoc(): StoredDoc {
  return (
    loadJsonConfig<StoredDoc>([file(), prevFile()], valid) || {
      rev: 0,
      doc: {},
    }
  );
}

type WriteResult =
  | { ok: true; rev: number }
  | { ok: false; status: 400 | 409 | 500; error: string };

/**
 * Dokument speichern. `expectedRev` gesetzt (App): nur wenn niemand dazwischen geschrieben hat.
 * Ein Dokument ohne Spulen ersetzt nie eines mit Spulen (Schutz vor halben Dokumenten).
 */
export function writeLocalDoc(doc: unknown, expectedRev?: number): WriteResult {
  if (!doc || typeof doc !== "object" || Array.isArray(doc))
    return { ok: false, status: 400, error: "Dokument muss ein Objekt sein." };
  const next = doc as Record<string, unknown>;
  const cur = readLocalDoc();
  if (expectedRev !== undefined && expectedRev !== cur.rev)
    return {
      ok: false,
      status: 409,
      error: "Zwischenzeitlich geändert. Bitte neu laden.",
    };
  const curSpools = Array.isArray(cur.doc.spools)
    ? (cur.doc.spools as unknown[]).length
    : 0;
  if (curSpools > 0 && !Array.isArray(next.spools))
    return { ok: false, status: 400, error: "Dokument ohne Spulen abgelehnt." };
  const rev = cur.rev + 1;
  if (
    !saveJsonConfig(
      file(),
      { rev, doc: next } satisfies StoredDoc,
      "Spulen-Dokument",
      { keepPrev: true },
    )
  )
    return {
      ok: false,
      status: 500,
      error: "Speichern auf dem Pi fehlgeschlagen.",
    };
  return { ok: true, rev };
}
