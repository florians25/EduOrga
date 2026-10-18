// Gemeinsame Hilfen der Fachmodule.
import { useEffect, useState } from 'react';
import type { ElementOption } from '@/api/typen';
import { useEreignis, betrifft } from '@/kern/ereignisse';
import { textbreite } from '@/kern/hilfen';
import { elemente } from '@/kern/zustand';

/** Spaltenbreite so, dass der Titel lesbar bleibt. */
export const titelBreite = (titel: string, breite?: number) => Math.max(breite || 60, Math.ceil(textbreite(titel, '500 12px "IBM Plex Sans", sans-serif')) + 26);

export const ELEMENTNAME: Record<string, string> = { klasse: 'Klasse', lehrer: 'Lehrkraft', raum: 'Raum', fach: 'Fach' };

/** Auswahlliste eines Elementtyps (neu geladen nach Stammdatenänderungen). */
export function useElemente(typ: string | null | undefined): ElementOption[] {
  const [liste, setListe] = useState<ElementOption[]>([]);
  const [nr, setNr] = useState(0);
  useEffect(() => {
    if (!typ) { setListe([]); return; }
    let aktiv = true;
    void elemente(typ).then((l) => { if (aktiv) setListe(l); }).catch(() => {});
    return () => { aktiv = false; };
  }, [typ, nr]);
  useEreignis('daten', (e) => { if (betrifft(e, 'Stammdaten')) setNr((x) => x + 1); });
  return liste;
}

/** Gewähltes Element einer Ansicht: Parameter oder erstes Element der Liste. */
export function ersterOder(liste: ElementOption[], id: unknown): number | null {
  const n = typeof id === 'number' ? id : id ? Number(id) : NaN;
  if (!Number.isNaN(n) && liste.some((e) => e.id === n)) return n;
  return liste[0]?.id ?? (Number.isNaN(n) ? null : n);
}
