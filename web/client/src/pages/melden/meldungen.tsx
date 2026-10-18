// Rückmeldungen an UntPlan (Abwesenheit, Raumbuchung, Prüfung): Text und Status.
import { Plakette } from '../../components/Bausteine';
import { datumKurz } from '../../lib/datum';

export interface Meldung { id: string; typ: string; von?: string; bis?: string; stundeVon?: number; stundeBis?: number; grund?: string; raum?: string; titel?: string; klassen?: string[]; text?: string; status: string; erstellt?: string; [k: string]: unknown }

export function meldungText(m: Meldung): string {
  const std = m.stundeVon ? ` (${m.stundeVon}.${m.stundeBis && m.stundeBis !== m.stundeVon ? '–' + m.stundeBis + '.' : ''} Std.)` : '';
  const d = (x?: string) => (x ? datumKurz(x) : '');
  switch (m.typ) {
    case 'absenz': return `Abwesenheit ${d(m.von)}${m.bis && m.bis !== m.von ? ' – ' + d(m.bis) : ''}${std}${m.grund ? ' · ' + m.grund : ''}`;
    case 'raumbuchung': return `Raumbuchung ${m.raum} am ${d(m.von)}${std}${m.titel ? ' · ' + m.titel : ''}`;
    case 'klausur': return `Klausur ${(m.klassen || []).join(', ')} am ${d(m.von)}${std}${m.titel ? ' · ' + m.titel : ''}`;
    case 'klausurloeschen': return `Prüfung löschen: ${(m.klassen || []).join(', ')} am ${d(m.von)}${std}${m.titel ? ' · ' + m.titel : ''}`;
    default: return `Nachricht ${m.von ? d(m.von) : ''}: ${m.text ?? ''}`;
  }
}

export function MeldungStatus({ s }: { s: string }) {
  if (s === 'offen') return <Plakette ton="pruefung">offen</Plakette>;
  if (s === 'quittiert') return <Plakette ton="ok">übernommen</Plakette>;
  if (s === 'abgelehnt') return <Plakette ton="entfall">abgelehnt</Plakette>;
  return <Plakette>{s}</Plakette>;
}
