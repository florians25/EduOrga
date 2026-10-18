// Elementtypen der Stammdaten (Titel, Einzahl).
export const TYPEN: Record<string, { titel: string; einzahl: string }> = {
  klasse: { titel: 'Klassen', einzahl: 'Klasse' },
  lehrer: { titel: 'Lehrkräfte', einzahl: 'Lehrkraft' },
  raum: { titel: 'Räume', einzahl: 'Raum' },
  fach: { titel: 'Fächer', einzahl: 'Fach' },
  raumgruppe: { titel: 'Raumgruppen', einzahl: 'Raumgruppe' },
  gang: { titel: 'Gänge', einzahl: 'Gang' },
  abteilung: { titel: 'Abteilungen', einzahl: 'Abteilung' },
  abwesenheitsgrund: { titel: 'Abwesenheitsgründe', einzahl: 'Abwesenheitsgrund' },
  schueler: { titel: 'Schüler', einzahl: 'Schüler' },
};
