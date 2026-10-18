// Updatehinweis für Administratoren: GET /api/version (GitHub-Releases von florians25/UntPlanNext, serverseitig 6 Stunden
// zwischengespeichert). Ist eine neuere Version veröffentlicht, erscheint unter der Kopfleiste eine schließbare Leiste
// („Neue Version 1.5.0 verfügbar – Versionshinweise ansehen“); geschlossen wird je Version (localStorage), ein Punkt am
// Konto-Symbol und ein Eintrag im Kontomenü bleiben. Der Dialog zeigt die Versionshinweise und den Update-Befehl.
import {
  Button, Link, MessageBar, MessageBarActions, MessageBarBody, MessageBarTitle, Spinner, Text, Tooltip, makeStyles, tokens,
} from '@fluentui/react-components';
import { ArrowSync16Regular, Copy16Regular, Dismiss20Regular, Open16Regular } from '@fluentui/react-icons';
import { Fragment, useEffect, type ReactNode } from 'react';
import { create } from 'zustand';
import { api } from '@/api/client';
import { useStudio } from '@/kern/zustand';
import { StandardDialog, dialogZeigen } from '@/komponenten/dialoge';
import { hinweis } from '@/komponenten/hinweise';

export interface Versionsstand {
  anwendung: string;
  version: string;
  pruefungAktiv: boolean;
  neueste: string | null;
  updateVerfuegbar: boolean;
  releaseUrl: string | null;
  releaseName: string | null;
  veroeffentlicht: string | null;
  hinweise: string | null;
  geprueft: string | null;
  fehler: string | null;
  befehl: string;
}

const SPEICHER = 'untplanstudio.update.ausgeblendet';

function gelesen(): string | null {
  try { return localStorage.getItem(SPEICHER); } catch { return null; }
}

interface UpdateZustand { stand: Versionsstand | null; laedt: boolean; ausgeblendet: string | null }
const useUpdate = create<UpdateZustand>(() => ({ stand: null, laedt: false, ausgeblendet: gelesen() }));

let angefragt = false;

/** Versionsstand laden (nur Administratoren; neu = am Server erneut prüfen). Fehler bleiben still – kein Hinweis. */
export async function versionsstandLaden(neu = false): Promise<Versionsstand | null> {
  if (useStudio.getState().benutzer?.rolle !== 'Admin') return null;
  useUpdate.setState({ laedt: true });
  try {
    const stand = await api.get<Versionsstand>(`/api/version${neu ? '?neu=1' : ''}`);
    useUpdate.setState({ stand });
    return stand;
  } catch {
    return useUpdate.getState().stand;
  } finally {
    useUpdate.setState({ laedt: false });
  }
}

/** Versionsstand für Administratoren (einmal je Sitzung geladen); null für alle anderen. */
export function useVersionsstand(): { stand: Versionsstand | null; laedt: boolean; neu: boolean } {
  const admin = useStudio((x) => x.benutzer?.rolle === 'Admin');
  const { stand, laedt, ausgeblendet } = useUpdate();
  useEffect(() => {
    if (!admin || angefragt) return;
    angefragt = true;
    void versionsstandLaden();
  }, [admin]);
  if (!admin) return { stand: null, laedt: false, neu: false };
  return { stand, laedt, neu: !!stand?.updateVerfuegbar && ausgeblendet !== stand.neueste };
}

/** Hinweis für diese Version ausblenden (bis eine neuere erscheint). */
function ausblenden(version: string | null) {
  if (!version) return;
  try { localStorage.setItem(SPEICHER, version); } catch { /* privates Fenster: nur für diese Sitzung */ }
  useUpdate.setState({ ausgeblendet: version });
}

const useStile = makeStyles({
  leiste: { flexShrink: 0, borderRadius: 0, borderLeftWidth: 0, borderRightWidth: 0, borderTopWidth: 0 },
  hinweise: {
    maxHeight: '50vh', overflow: 'auto', padding: '4px 16px', marginTop: '8px', borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2, border: `1px solid ${tokens.colorNeutralStroke2}`,
    '& h3, & h4, & h5': { margin: '12px 0 4px 0', fontSize: tokens.fontSizeBase300, fontWeight: tokens.fontWeightSemibold },
    '& p': { margin: '6px 0' },
    '& ul': { margin: '4px 0', paddingLeft: '20px' },
    '& code': { fontFamily: tokens.fontFamilyMonospace, fontSize: tokens.fontSizeBase200 },
  },
  zeile: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  leise: { color: tokens.colorNeutralForeground3 },
  befehl: {
    display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', padding: '6px 6px 6px 12px', borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground3, fontFamily: tokens.fontFamilyMonospace, fontSize: tokens.fontSizeBase200,
  },
  befehlText: { flex: 1, userSelect: 'all' },
  abschnitt: { marginTop: '16px' },
  punktRahmen: { position: 'relative', display: 'inline-flex' },
  punkt: {
    position: 'absolute', top: '0px', right: '0px', width: '10px', height: '10px', borderRadius: '50%',
    backgroundColor: tokens.colorPaletteMarigoldBackground3, border: `2px solid ${tokens.colorNeutralBackground1}`,
  },
});

// ---------------------------------------------------------------------------------------------
// Versionshinweise (Markdown der GitHub-Releases) – bewusst kleiner, sicherer Umfang ohne HTML:
// Überschriften, Aufzählungen, Absätze, **fett**, `Code` und [Links](https://…).

function inline(text: string): ReactNode[] {
  const teile: ReactNode[] = [];
  const muster = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g;
  let rest = 0;
  for (const m of text.matchAll(muster)) {
    if (m.index! > rest) teile.push(text.slice(rest, m.index));
    const t = m[0];
    if (t.startsWith('**')) teile.push(<strong key={m.index}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith('`')) teile.push(<code key={m.index}>{t.slice(1, -1)}</code>);
    else teile.push(<Link key={m.index} href={m[2]} target="_blank" rel="noopener noreferrer" inline>{t.slice(1, t.indexOf(']('))}</Link>);
    rest = m.index! + t.length;
  }
  if (rest < text.length) teile.push(text.slice(rest));
  return teile;
}

export function Versionshinweise({ text }: { text: string }) {
  const bloecke: ReactNode[] = [];
  let liste: string[] = [];
  let absatz: string[] = [];
  const fertig = () => {
    if (absatz.length) bloecke.push(<p key={bloecke.length}>{inline(absatz.join(' '))}</p>);
    if (liste.length) bloecke.push(<ul key={bloecke.length}>{liste.map((x, i) => <li key={i}>{inline(x)}</li>)}</ul>);
    absatz = []; liste = [];
  };
  for (const roh of text.split('\n')) {
    const z = roh.trimEnd();
    const ueberschrift = /^(#{1,6})\s+(.*)$/.exec(z);
    const punkt = /^\s*[-*+]\s+(.*)$/.exec(z);
    if (ueberschrift) { fertig(); const Tag = (`h${Math.min(5, ueberschrift[1].length + 2)}`) as 'h3'; bloecke.push(<Tag key={bloecke.length}>{inline(ueberschrift[2])}</Tag>); }
    else if (punkt) { if (absatz.length) fertig(); liste.push(punkt[1]); }
    else if (!z.trim()) fertig();
    else { if (liste.length) fertig(); absatz.push(z.trim()); }
  }
  fertig();
  return <>{bloecke.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</>;
}

const datum = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

function kopieren(text: string) {
  navigator.clipboard?.writeText(text).then(() => hinweis('In die Zwischenablage kopiert.', 'ok'), () => hinweis('Kopieren nicht möglich – bitte markieren.', 'warnung'));
}

/** Befehl zum Aktualisieren auf dem Server mit Kopierknopf. */
export function UpdateBefehl({ befehl }: { befehl: string }) {
  const s = useStile();
  return (
    <div className={s.befehl}>
      <span className={s.befehlText}>{befehl}</span>
      <Tooltip content="Kopieren" relationship="label"><Button size="small" appearance="subtle" icon={<Copy16Regular />} onClick={() => kopieren(befehl)} /></Tooltip>
    </div>
  );
}

function UpdateDialogInhalt({ stand, schliessen }: { stand: Versionsstand; schliessen: (w: boolean | null) => void }) {
  const s = useStile();
  const titel = stand.updateVerfuegbar ? `Neue Version ${stand.neueste} verfügbar` : `UntPlan Studio ${stand.version}`;
  return (
    <StandardDialog<boolean> titel={titel} breite="640px" beiKnopf={schliessen}
      knoepfe={stand.updateVerfuegbar ? [{ text: 'Hinweis ausblenden', wert: true }, { text: 'Schließen', wert: null, primaer: true }] : [{ text: 'Schließen', wert: null, primaer: true }]}
      links={stand.releaseUrl ? <Link href={stand.releaseUrl} target="_blank" rel="noopener noreferrer">Auf GitHub ansehen <Open16Regular style={{ verticalAlign: 'middle' }} /></Link> : undefined}>
      <Text>
        Installiert: <strong>{stand.version}</strong>
        {stand.neueste ? <> · Neueste: <strong>{stand.neueste}</strong>{stand.releaseName && stand.releaseName !== stand.neueste ? ` („${stand.releaseName}“)` : ''}</> : null}
        {stand.veroeffentlicht ? <span className={s.leise}> · veröffentlicht am {datum(stand.veroeffentlicht)}</span> : null}
      </Text>
      {stand.hinweise ? (
        <div className={s.abschnitt}>
          <Text weight="semibold">Versionshinweise</Text>
          <div className={s.hinweise}><Versionshinweise text={stand.hinweise} /></div>
        </div>
      ) : null}
      <div className={s.abschnitt}>
        <Text weight="semibold">Update installieren</Text>
        <div className={s.leise}>Auf dem Server im Installationsordner (z. B. <code>/opt/untplannext</code>) ausführen – die Datenbank wird vorher gesichert, Migrationen laufen beim Start automatisch:</div>
        <UpdateBefehl befehl={stand.befehl} />
      </div>
    </StandardDialog>
  );
}

/** Dialog mit Versionshinweisen und Update-Befehl. */
export async function updateDialogZeigen(stand: Versionsstand): Promise<void> {
  const w = await dialogZeigen<boolean>((schliessen) => <UpdateDialogInhalt stand={stand} schliessen={schliessen} />);
  if (w === true) ausblenden(stand.neueste);
}

/** Leiste unter der Kopfleiste (nur Administratoren, nur bei neuer, nicht ausgeblendeter Version). */
export function UpdateLeiste() {
  const s = useStile();
  const { stand, neu } = useVersionsstand();
  if (!stand || !neu) return null;
  return (
    <MessageBar intent="info" layout="singleline" className={s.leiste} data-testid="update-hinweis">
      <MessageBarBody>
        <MessageBarTitle>Neue Version {stand.neueste} verfügbar</MessageBarTitle>
        UntPlan Studio {stand.version} ist installiert.{' '}
        <Link onClick={() => { void updateDialogZeigen(stand); }}>Versionshinweise ansehen</Link>
      </MessageBarBody>
      <MessageBarActions containerAction={
        <Button appearance="transparent" aria-label="Hinweis für diese Version ausblenden" icon={<Dismiss20Regular />} onClick={() => ausblenden(stand.neueste)} />
      } />
    </MessageBar>
  );
}

/** Punkt am Konto-Symbol, solange eine neuere Version verfügbar ist (auch nach dem Ausblenden der Leiste). */
export function UpdatePunkt({ children }: { children: ReactNode }) {
  const s = useStile();
  const { stand } = useVersionsstand();
  if (!stand?.updateVerfuegbar) return <>{children}</>;
  return <span className={s.punktRahmen}>{children}<span className={s.punkt} aria-hidden /></span>;
}

/** Versionsangaben für „Über UntPlan Studio“ (Administratoren): neueste Version, erneut prüfen, Hinweise. */
export function VersionsInfo() {
  const s = useStile();
  const { stand, laedt } = useVersionsstand();
  if (!stand) return laedt ? <Spinner size="tiny" label="Version wird geprüft …" labelPosition="after" /> : null;
  const geprueft = stand.geprueft ? new Date(stand.geprueft).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '';
  return (
    <div className={s.abschnitt} data-testid="versions-info">
      {!stand.pruefungAktiv ? <Text className={s.leise}>Die Prüfung auf neue Versionen ist abgeschaltet (STUDIO_UPDATE_PRUEFEN=0).</Text>
        : stand.updateVerfuegbar ? (
          <MessageBar intent="info">
            <MessageBarBody>
              <MessageBarTitle>Neue Version {stand.neueste} verfügbar</MessageBarTitle>
              {stand.veroeffentlicht ? `Veröffentlicht am ${datum(stand.veroeffentlicht)}. ` : ''}
              <Link onClick={() => { void updateDialogZeigen(stand); }}>Versionshinweise ansehen</Link>
            </MessageBarBody>
          </MessageBar>
        ) : stand.fehler ? <Text className={s.leise}>Neueste Version konnte nicht ermittelt werden ({stand.fehler}).</Text>
        : <Text className={s.leise}>UntPlan Studio ist aktuell (neueste veröffentlichte Version: {stand.neueste ?? '–'}).</Text>}
      {stand.pruefungAktiv ? (
        <div className={s.zeile} style={{ marginTop: 8 }}>
          <Button size="small" icon={<ArrowSync16Regular />} disabled={laedt} onClick={() => { void versionsstandLaden(true); }}>Erneut prüfen</Button>
          {geprueft ? <Text size={200} className={s.leise}>geprüft {geprueft}</Text> : null}
        </div>
      ) : null}
      <div className={s.abschnitt}>
        <Text size={200} className={s.leise}>Update auf dem Server (Installation mit Docker, siehe installation/README.md):</Text>
        <UpdateBefehl befehl={stand.befehl} />
      </div>
    </div>
  );
}
