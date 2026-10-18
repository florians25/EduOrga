// Datentypen der App-Schnittstelle (/api/app/*). Feldnamen wie im Server (camelCase). Nur was die Oberfläche nutzt ist typisiert;
// weitere Felder bleiben erhalten (Index-Signatur nur wo nötig).

export type Rolle = 'admin' | 'leitung' | 'lehrer' | 'klasse' | 'schueler' | 'eltern' | string;

export interface Benutzer {
  id: number;
  login: string;
  anzeigename: string;
  rolle: Rolle;
  rollenname: string;
  kollegium: boolean;
  admin: boolean;
  nachrichten: boolean;
  benachrichtigung: boolean;
  passwortAendern: boolean;
  typ: PlanTyp | '';
  familie: boolean;
  schuelerIds: number[];
  klassen: string[];
  element: string;
  fehlzeiten: boolean;
  fachlehrerEntschuldigungen: boolean;
  rechte: Record<string, number>;
  planWochenZurueck: number | null;
  planWochenVor: number | null;
  mitteilungen?: { senden: boolean; antworten: boolean };
}

export interface Sitzung {
  eingerichtet: boolean;
  schule: { name: string; schulId: string };
  paket: { vorhanden: boolean; revision: number; empfangen: string | null };
  schuljahr: { von: string; bis: string } | null;
  benutzer: Benutzer | null;
  ungelesen: number;
  ansicht: Ansicht;
  /** Darstellung der Stundenkarten (Administration, schulweit); fehlt bei älteren Servern. */
  darstellung?: Partial<import('../components/plan/darstellung').Kartendarstellung> | null;
}

export interface Ansicht {
  nachrichtenAnzeigen?: boolean;
  rss?: boolean;
  wochenende?: boolean;
  startseite?: 'heute' | 'uebersicht' | 'stundenplan' | string;
  kartenZeiten?: boolean;
}

export type PlanTyp = 'klasse' | 'lehrer' | 'raum';

export interface Element { kurz: string; name: string; jahrgang?: string; leitung?: string[]; farbe?: string }
export interface Zeit { nr: number; bezeichnung: string; beginn: string; ende: string }
export interface Ferien { name: string; von: string; bis: string; feiertag: boolean }

export interface Elemente {
  klassen: Element[];
  lehrer: Element[];
  raeume: Element[];
  faecher: Element[];
  stunden: Zeit[];
  andereKlassen: boolean;
  ferien: Ferien[];
}

/** Wert auf einer Karte: k = aktueller Wert, alt = ersetzter Wert, neu = geändert/hinzugefügt, plus = hinzugefügt. */
export interface Wert { k: string; alt?: string | null; neu?: boolean; plus?: boolean }

export interface Verlegungszeit { datum: string; beginn: string; ende: string; stunde: number; bisStunde: number }

export type KartenStatus = 'regulaer' | 'geaendert' | 'offen' | 'entfall' | 'abwesend' | 'klausur' | 'bereitschaft' | 'buchung' | 'vorgemerkt' | 'veranstaltung';

export interface Karte {
  datum: string;
  von: number;
  bis: number;
  beginn: string;
  ende: string;
  status: KartenStatus | string;
  fach: string;
  fachAlt: string | null;
  fachName: string;
  farbe: string;
  klassen: Wert[];
  lehrer: Wert[];
  raeume: Wert[];
  art: string;
  text: string;
  vertretung: number | null;
  unterricht: number | null;
  gruppe: string;
  notizSchueler: string;
  notizLehrer: string;
  hausaufgabeFaellig: boolean;
  online: boolean;
  onlineLink: string;
  zusaetzlich: boolean;
  verlegung: 'von' | 'nach' | null;
  verlegungVon: Verlegungszeit | null;
  verlegungNach: Verlegungszeit | null;
  marker: string[];
  abwesendeKlassen: string[];
  abwesendText: string;
  lehrerAbwesend: boolean;
  bereitschaft: boolean;
  vertretungOffen: boolean;
  mitklassen: Wert[];
  /** nur in der Oberfläche: Veranstaltung aus den Tagesereignissen */
  ereignis?: boolean;
}

export interface Aufsicht {
  datum: string;
  nachStunde: number;
  beginn: string;
  ende: string;
  gang: string;
  gangName: string;
  status: 'regulaer' | 'vertreten' | 'vertretung' | 'entfall' | string;
  lehrer: string;
  alt: string | null;
  grund?: string | null;
}

export interface Ereignis { titel: string; art: string; von: number; bis: number; ganztaegig: boolean; klassen: string[]; lehrer: string[]; raeume: string[] }

export interface Tageskopf {
  datum: string;
  wochentag: string;
  woche: string;
  frei: boolean;
  freiGrund: string | null;
  tagesaktuell: boolean;
  hinweise: string[];
  ereignisse: Ereignis[];
  freiArt: 'ferien' | 'feiertag' | 'frei' | null | string;
  freiVon: string | null;
  freiBis: string | null;
}

export interface PlanAbwesenheit { datum: string; von: string; bis: string; grund: string; art: string }

export interface Wochenplan {
  typ: PlanTyp;
  element: string;
  name: string;
  montag: string;
  woche: string;
  zeitraster: Zeit[];
  tage: Tageskopf[];
  karten: Karte[];
  aufsichten: Aufsicht[];
  gesperrt: boolean;
  sperrhinweis: string | null;
  abwesenheiten: PlanAbwesenheit[];
}

export interface Tageszeile { kurz: string; name: string; karten: Karte[] }
export interface Tagesuebersicht {
  typ: PlanTyp;
  datum: string;
  kopf: Tageskopf;
  zeitraster: Zeit[];
  zeilen: Tageszeile[];
  gesperrt: boolean;
  sperrhinweis: string | null;
}
