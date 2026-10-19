// Änderungen aus EduOrga Web beim Öffnen der Tagesplanung anbieten: Rückmeldungen und Stundenplanänderungen (Krankmeldungen,
// Buchungen, Prüfungen, Stornos …), die noch weder übernommen noch ignoriert sind. „Ja“ übernimmt sie (wie die Seite
// „Stundenplanänderungen aus EduOrga Web“), „Nein“ markiert sie nach einer Warnung als ignoriert (sie werden nicht erneut
// angeboten), „Später“ fragt beim nächsten Öffnen wieder. Ohne Verbindung oder ohne offene Änderungen erscheint nichts.
import { api } from '@/api/client';
import { zustand } from '@/kern/zustand';
import { StandardDialog, dialogZeigen, frage } from '@/komponenten/dialoge';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { direktLaden, useDirekt } from '../../untplanweb/Senden';
import { mehrzahl } from './daten';
import './ablauf.css';

interface WebAenderung {
  id: string | number; datumText?: string; zeit?: string; stunde?: string | number; artText?: string; klassenFach?: string; lehrer?: string; raeume?: string;
  text?: string; ersteller?: string; uebernommen?: boolean | null; erledigt?: boolean; fehler?: string | boolean | null; gruppe?: boolean;
}

let laeuft = false;

function Liste({ zeilen, schliessen }: { zeilen: WebAenderung[]; schliessen: (w: 'ja' | 'nein' | null) => void }) {
  return (
    <StandardDialog<'ja' | 'nein'> titel="Änderungen aus EduOrga Web" breite="720px" beiKnopf={schliessen}
      knoepfe={[{ text: 'Ja, übernehmen', wert: 'ja', primaer: true }, { text: 'Nein', wert: 'nein' }, { text: 'Später', wert: null }]}>
      <p style={{ margin: '0 0 10px 0' }}>{`Wollen Sie folgende ${mehrzahl(zeilen.length, 'Änderung', 'Änderungen')} aus EduOrga Web übernehmen?`}</p>
      <div className="ta-webliste" data-testid="web-aenderungen">
        <div className="ta-webzeile kopf"><span>Datum</span><span>Std.</span><span>Art</span><span>Klasse / Fach</span><span>Lehrkraft</span><span>Text</span></div>
        {zeilen.map((z) => (
          <div key={String(z.id)} className="ta-webzeile">
            <span>{z.datumText}</span><span>{z.stunde ?? ''}</span><span>{z.artText}</span><span>{z.klassenFach}</span><span>{z.lehrer}</span>
            <span title={[z.text, z.ersteller ? `erfasst von ${z.ersteller}` : ''].filter(Boolean).join(' – ')}>{z.text}</span>
          </div>
        ))}
      </div>
      <p style={{ margin: '10px 0 0 0', fontSize: 12, color: 'var(--colorNeutralForeground3)' }}>„Später“ fragt beim nächsten Öffnen der Tagesplanung erneut. Einzeln bearbeiten: Seite „Stundenplanänderungen aus EduOrga Web“.</p>
    </StandardDialog>
  );
}

/** Beim Öffnen der Tagesplanung: offene Änderungen aus EduOrga Web anbieten (still, wenn nichts ansteht oder keine Verbindung besteht). */
export async function webAenderungenAnbieten(): Promise<void> {
  if (laeuft || !zustand().dokument || !zustand().benutzer?.darfSchreiben) return;
  laeuft = true;
  try {
    if (!useDirekt.getState().stand) await direktLaden();
    if (!useDirekt.getState().stand?.eingerichtet) return;
    let d: { zeilen: WebAenderung[] };
    try { d = await api.get<{ zeilen: WebAenderung[] }>(api.dok('/untplanweb/stpl?neu=true')); } catch { return; }
    const zeilen = (d.zeilen || []).filter((z) => !z.gruppe && z.uebernommen == null && !z.erledigt && !z.fehler);
    if (!zeilen.length) return;
    const w = await dialogZeigen<'ja' | 'nein'>((schliessen) => <Liste zeilen={zeilen} schliessen={schliessen} />);
    const ids = zeilen.map((z) => String(z.id));
    if (w === 'ja') {
      const r = await api.post<{ text: string }>(api.dok('/untplanweb/stpl/uebernehmen'), { ids });
      hinweis(r.text || 'Änderungen übernommen.', 'ok', 4000);
    } else if (w === 'nein') {
      if (!(await frage(`Die ${mehrzahl(ids.length, 'Änderung wird', 'Änderungen werden')} als ignoriert markiert und nicht erneut angeboten. Sie lassen sich danach nur noch auf der Seite „Stundenplanänderungen aus EduOrga Web“ (mit „Erledigte zeigen“) einsehen.\n\nWirklich ignorieren?`, { titel: 'Änderungen ignorieren', ja: 'Ignorieren', nein: 'Abbrechen', gefahr: true }))) return;
      const r = await api.post<{ text: string }>(api.dok('/untplanweb/stpl/ignorieren'), { ids });
      hinweis(r.text || 'Änderungen ignoriert.', 'info', 3000);
    }
  } catch (e) { fehlerMelden(e); } finally { laeuft = false; }
}
