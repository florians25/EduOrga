// Ort der gezeigten Seite (Ansicht + Parameter bzw. Arbeitsplatz) – für Navigation (Markierung), Seitenkopf und das
// Speichern der zuletzt gezeigten Seite je Schuldatei.
import { create } from 'zustand';
import type { Params } from '@/kern/befehle';

export interface Seitenort { typ?: string; p: Params; arbeitsplatz?: string }

export const useSeitenortStore = create<Seitenort>(() => ({ p: {} }));
export const useSeitenort = () => useSeitenortStore();
export const seitenortSetzen = (o: Seitenort) => useSeitenortStore.setState({ typ: o.typ, p: o.p, arbeitsplatz: o.arbeitsplatz }, true);
