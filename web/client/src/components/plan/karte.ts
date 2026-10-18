// Stundenkarte aus Listen-Angaben (Klassenbuch-Übersicht, Offene Stunden, Startseite) für die Stundendetails.
import type { Karte, Wert } from '../../api/types';

const werte = (l: (string | Wert)[] | undefined): Wert[] => (l ?? []).map(x => (typeof x === 'string' ? { k: x } : x));

export function karteAus(x: Partial<Omit<Karte, 'klassen' | 'lehrer' | 'raeume'>> & { datum: string; von: number; bis?: number; klassen?: (string | Wert)[]; lehrer?: (string | Wert)[]; raeume?: (string | Wert)[] }): Karte {
  return {
    beginn: '', ende: '', status: 'regulaer', fach: '', fachAlt: null, fachName: '', farbe: '', art: '', text: '', vertretung: null, unterricht: null, gruppe: '', notizSchueler: '', notizLehrer: '',
    hausaufgabeFaellig: false, online: false, onlineLink: '', zusaetzlich: false, verlegung: null, verlegungVon: null, verlegungNach: null, marker: [], abwesendeKlassen: [], abwesendText: '',
    lehrerAbwesend: false, bereitschaft: false, vertretungOffen: false, mitklassen: [],
    ...x,
    bis: x.bis ?? x.von,
    klassen: werte(x.klassen), lehrer: werte(x.lehrer), raeume: werte(x.raeume),
  } as Karte;
}
