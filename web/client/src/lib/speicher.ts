// Gerätespeicher (localStorage/sessionStorage) – fehlertolerant (privater Modus).
export function lesen<T>(schluessel: string, vorgabe: T, sitzung = false): T {
  try {
    const s = (sitzung ? sessionStorage : localStorage).getItem(schluessel);
    return s === null ? vorgabe : (JSON.parse(s) as T);
  } catch {
    return vorgabe;
  }
}
export function schreiben(schluessel: string, wert: unknown, sitzung = false) {
  try {
    (sitzung ? sessionStorage : localStorage).setItem(schluessel, JSON.stringify(wert));
  } catch { /* privat */ }
}
