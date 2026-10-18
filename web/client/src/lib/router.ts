// Hash-Router: Adressen wie bisher („#/plan/klasse/5a/2026-10-12“), damit Lesezeichen und Links aus E-Mails weiter funktionieren.
import { useEffect, useState } from 'react';

export function teileAusHash(hash = location.hash): string[] {
  return hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean).map(t => {
    try { return decodeURIComponent(t); } catch { return t; }
  });
}

/** Aktuelle Adresse als Teile (reagiert auf hashchange). */
export function useHash(): string[] {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const f = () => setHash(location.hash);
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return teileAusHash(hash);
}

/** Zu einer Adresse wechseln („#/plan/…“ oder Teile). ersetzen: ohne neuen Eintrag in der Verlaufsliste. */
export function navigieren(ziel: string | (string | number | null | undefined)[], ersetzen = false) {
  const hash = typeof ziel === 'string' ? ziel : '#/' + ziel.filter(x => x !== null && x !== undefined && x !== '').map(x => encodeURIComponent(String(x))).join('/');
  if (ersetzen) {
    history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = hash;
}

export const link = (...teile: (string | number | null | undefined)[]) => '#/' + teile.filter(x => x !== null && x !== undefined && x !== '').map(x => encodeURIComponent(String(x))).join('/');
