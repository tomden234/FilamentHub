// 1.271: Dauer als Text (ohne Server-Abhängigkeiten, damit App und Pi dieselbe Funktion nutzen)

/** „2:10 h“ oder „45 min“ */
export function fmtDur(sec: number): string {
  const min = Math.max(1, Math.round(sec / 60));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')} h`;
}
