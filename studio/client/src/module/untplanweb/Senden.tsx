// Vertretungen direkt an EduOrga Web senden: Knopf in der Kopfleiste (Vertretungsplanung), Befehl „untplanweb.vertretungenSenden“
// (Befehlssuche; andere Ansichten, z. B. der Kopf der Tagesplanung, können den Befehl auslösen oder <VertretungenSendenKnopf />
// einbinden) und der Stand der letzten Übertragung. Ist „Vertretungen automatisch übertragen“ eingeschaltet, sendet der Server
// selbst kurz nach jeder Änderung – hier steht dann, wann. Gleiches Paket wie „Vertretungen*“ im Fenster UntPlan Web.
import { Button, Spinner, Tooltip, makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import { CloudArrowUp20Regular } from '@fluentui/react-icons';
import { useEffect } from 'react';
import { create } from 'zustand';
import { api } from '@/api/client';
import { beiDokumentwechsel } from '@/kern/dokument';
import { an, betrifft, melden } from '@/kern/ereignisse';
import { datumDe, entprellen } from '@/kern/hilfen';
import { useStudio, zustand } from '@/kern/zustand';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { einstellungenDialog, sachlich } from './kern';

export interface DirektStand {
  eingerichtet: boolean;
  automatisch: boolean;
  sekunden: number;
  laufend: { teil: string; benutzer: string; text: string } | null;
  faellig: string | null;
  letzte: { zeit: string; ok: boolean; text: string; revision: number | null; automatisch: boolean; benutzer: string } | null;
  zuletztErfolgreich: string | null;
  revision: number;
}

export const useDirekt = create<{ stand: DirektStand | null; sendet: boolean }>(() => ({ stand: null, sendet: false }));

/** Stand vom Server holen (still; Fehler werden ignoriert). */
export async function direktLaden(): Promise<void> {
  if (!zustand().dokument) { useDirekt.setState({ stand: null }); return; }
  try { useDirekt.setState({ stand: await api.get<DirektStand>(api.dok('/untplanweb/direkt')) }); } catch { /* nächster Versuch */ }
}

const direktLadenEntprellt = entprellen(() => { void direktLaden(); }, 800);

/** Ein Klick: Vertretungen jetzt senden. Ohne eingerichtete Verbindung öffnet sich der Einstellungsdialog. */
export async function vertretungenSenden(): Promise<void> {
  if (!zustand().dokument || useDirekt.getState().sendet) return;
  let stand = useDirekt.getState().stand;
  if (!stand) { await direktLaden(); stand = useDirekt.getState().stand; }
  if (stand && !stand.eingerichtet) {
    hinweis('Für die Übertragung bitte zuerst die Verbindung zu EduOrga Web einrichten.', 'info');
    if (await einstellungenDialog()) await direktLaden();
    return;
  }
  useDirekt.setState({ sendet: true });
  try {
    const neu = await api.post<DirektStand>(api.dok('/untplanweb/vertretungen/senden'));
    useDirekt.setState({ stand: neu });
    if (neu.letzte?.ok) melden('meldung', { text: 'Vertretungen an EduOrga Web gesendet.', art: 'ok' });
    else hinweis(`Übertragung an EduOrga Web fehlgeschlagen: ${sachlich(neu.letzte?.text)}`, 'fehler');
  } catch (f) { fehlerMelden(f); } finally { useDirekt.setState({ sendet: false }); }
}

let gestartet = false;

/** Einmalig (Modulstart): Stand bei Dokumentwechsel, nach Übertragungen (Server-Ereignis) und Vertretungsänderungen aktualisieren. */
export function direktBeobachten(): void {
  if (gestartet) return;
  gestartet = true;
  beiDokumentwechsel(() => { useDirekt.setState({ stand: null }); void direktLaden(); });
  an('untplanweb.direkt', () => direktLadenEntprellt());
  // nach einer Änderung der Vertretungen ist eine automatische Übertragung vorgemerkt („automatisch in … s“)
  an('daten', (e) => { if (useDirekt.getState().stand?.automatisch && betrifft(e, 'Vertretung')) direktLadenEntprellt(); });
  if (zustand().dokument) void direktLaden();
}

const useStile = makeStyles({
  rahmen: { display: 'inline-flex', alignItems: 'center', gap: '4px', minWidth: 0 },
  knopf: { whiteSpace: 'nowrap' },
  text: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px', '@media (max-width: 1440px)': { display: 'none' } },
  fehler: { color: tokens.colorPaletteRedForeground1 },
  kurz: { '@media (max-width: 1600px)': { display: 'none' } },
});

const uhr = (iso: string | null | undefined) => (iso ? datumDe(iso).split(', ')[1] || datumDe(iso) : '');

function statusText(st: DirektStand | null, sendet: boolean): { text: string; titel: string; fehler: boolean } {
  if (!st) return { text: '', titel: '', fehler: false };
  if (sendet || st.laufend) return { text: 'Wird gesendet …', titel: st.laufend ? sachlich(st.laufend.text) : '', fehler: false };
  const auto = st.automatisch ? `Automatische Übertragung ${st.sekunden} s nach jeder Änderung ist eingeschaltet.` : 'Automatische Übertragung: aus (Einstellungen für UntPlan Web).';
  if (!st.eingerichtet) return { text: 'Nicht eingerichtet', titel: 'Keine Verbindung zu EduOrga Web eingerichtet.', fehler: false };
  if (st.letzte && !st.letzte.ok) {
    return { text: `Fehler ${uhr(st.letzte.zeit)}`, titel: `Übertragung am ${datumDe(st.letzte.zeit)} fehlgeschlagen: ${sachlich(st.letzte.text)}\n${auto}`, fehler: true };
  }
  if (st.faellig) return { text: `Automatisch um ${uhr(st.faellig)}`, titel: `Geänderte Vertretungen werden um ${uhr(st.faellig)} übertragen.\n${auto}`, fehler: false };
  if (st.zuletztErfolgreich) {
    const wer = st.letzte?.ok ? (st.letzte.automatisch ? ' (automatisch)' : ` (${st.letzte.benutzer})`) : '';
    return { text: `Gesendet · ${uhr(st.zuletztErfolgreich)}`, titel: `Zuletzt an EduOrga Web übertragen am ${datumDe(st.zuletztErfolgreich)}${wer}, Revision ${st.revision}.\n${auto}`, fehler: false };
  }
  return { text: 'Noch nicht gesendet', titel: auto, fehler: false };
}

/** Knopf „An EduOrga Web senden“ mit Stand der letzten Übertragung. */
export function VertretungenSendenKnopf({ mitText = true }: { mitText?: boolean }) {
  const s = useStile();
  const schreiben = useStudio((x) => !!x.benutzer?.darfSchreiben);
  const stand = useDirekt((x) => x.stand);
  const sendet = useDirekt((x) => x.sendet);
  useEffect(() => {
    direktBeobachten();
    // Anzeige „automatisch um …“/„Gesendet“ aktuell halten, solange sichtbar
    const t = setInterval(() => { if (!document.hidden && useDirekt.getState().stand?.automatisch) void direktLaden(); }, 15000);
    return () => clearInterval(t);
  }, []);
  if (!schreiben) return null;
  const st = statusText(stand, sendet);
  return (
    <span className={s.rahmen} data-testid="untplanweb-senden">
      <Tooltip relationship="description" content={st.titel ? `Vertretungen jetzt an EduOrga Web senden.\n${st.titel}` : 'Vertretungen jetzt an EduOrga Web senden'}>
        <Button appearance="subtle" className={s.knopf} disabled={sendet} icon={sendet ? <Spinner size="extra-tiny" /> : <CloudArrowUp20Regular />}
          onClick={() => { void vertretungenSenden(); }} aria-label="Vertretungen jetzt an EduOrga Web senden">
          <span className={s.kurz}>An Web senden</span>
        </Button>
      </Tooltip>
      {mitText && st.text ? <span className={mergeClasses(s.text, st.fehler && s.fehler)} data-stand={st.fehler ? 'fehler' : 'ok'}>{st.text}</span> : null}
    </span>
  );
}

/** Kopfleistenelement (nur Vertretungsplanung). */
export default function KopfleisteSenden() {
  return <VertretungenSendenKnopf />;
}
