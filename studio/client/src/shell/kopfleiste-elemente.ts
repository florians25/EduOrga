// Eigene Steuerelemente der Module in der Kopfleiste (z. B. Planungsdatum der Vertretungsplanung, aktive Benutzer).
import type { ComponentType } from 'react';
import { create } from 'zustand';
import type { Modus } from '@/kern/zustand';

export interface KopfleistenElement {
  id: string;
  komponente: ComponentType;
  /** nur in diesem Modus */
  modus?: Modus;
  /** 'mitte' (neben dem Modus) oder 'rechts' (vor der Suche) */
  ort: 'mitte' | 'rechts';
  /** nur mit geöffnetem Dokument (Standard: ja) */
  ohneDokument?: boolean;
}

export const useKopfleistenElemente = create<{ liste: KopfleistenElement[] }>(() => ({ liste: [] }));

export function kopfleistenElement(e: KopfleistenElement) {
  useKopfleistenElemente.setState((s) => ({ liste: [...s.liste.filter((x) => x.id !== e.id), e] }));
}
