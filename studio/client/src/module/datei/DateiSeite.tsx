// Seite „Schuldateien“: Informationen, Neu, Öffnen, BAL-Import, Konto, Benutzer (Admin), Über.
import {
  Button, Checkbox, Link, Tab, TabList, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text,
  makeStyles, mergeClasses, tokens,
} from '@fluentui/react-components';
import { ArrowLeft20Regular } from '@fluentui/react-icons';
import { useState, type DragEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import type { DokumentListe, Rolle } from '@/api/typen';
import type { AnsichtProps } from '@/kern/ansichten';
import { useAnsicht } from '@/kern/ansichten';
import { dokumentSchliessen, herunterladen, speichern, umbenennen } from '@/kern/dokument';
import { dateiWaehlen, datumDe, groesse } from '@/kern/hilfen';
import { useDaten } from '@/kern/laden';
import { useStudio, zustand } from '@/kern/zustand';
import { AnsichtRahmen, Ladeanzeige } from '@/komponenten/ansicht';
import { formular, frage } from '@/komponenten/dialoge';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { hochladen, importBerichtZeigen, oeffnenMit, type ImportBericht } from './aktionen';

const useStile = makeStyles({
  aufbau: { display: 'flex', flex: 1, minHeight: 0 },
  nav: { width: '220px', flexShrink: 0, padding: '12px 8px', borderRight: `1px solid ${tokens.colorNeutralStroke2}`, display: 'flex', flexDirection: 'column', gap: '4px' },
  navTitel: { padding: '12px 12px 4px 12px', fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, fontWeight: tokens.fontWeightSemibold },
  seite: { flex: 1, minWidth: 0, overflow: 'auto', padding: '20px 28px 32px 28px' },
  kopf: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' },
  h2: { margin: 0, fontSize: '18px', fontWeight: tokens.fontWeightSemibold, flex: 1 },
  h3: { margin: '24px 0 8px 0', fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold },
  eigenschaften: { maxWidth: '760px' },
  th: { width: '200px', color: tokens.colorNeutralForeground3 },
  einleitung: { color: tokens.colorNeutralForeground2, maxWidth: '720px', margin: '0 0 16px 0' },
  optionen: { display: 'flex', flexDirection: 'column', maxWidth: '720px', border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusLarge },
  option: { display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 16px', borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, ':last-child': { borderBottom: 'none' } },
  optionText: { flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' },
  leise: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  ablage: {
    border: `1px dashed ${tokens.colorNeutralStroke1}`, borderRadius: tokens.borderRadiusLarge, padding: '20px', display: 'flex', alignItems: 'center',
    gap: '12px', color: tokens.colorNeutralForeground2, maxWidth: '960px', backgroundColor: tokens.colorNeutralBackground2,
  },
  ablageUeber: { borderTopColor: tokens.colorBrandStroke1, borderBottomColor: tokens.colorBrandStroke1, borderLeftColor: tokens.colorBrandStroke1, borderRightColor: tokens.colorBrandStroke1, backgroundColor: tokens.colorBrandBackground2 },
  zeile: { cursor: 'pointer' },
  aktionen: { display: 'flex', gap: '4px', justifyContent: 'flex-end' },
  knoepfe: { display: 'flex', gap: '8px', marginTop: '16px' },
  liste: { maxWidth: '960px' },
  haken: { display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '16px' },
});

function Eigenschaften({ zeilen }: { zeilen: [string, ReactNode][] }) {
  const s = useStile();
  return (
    <Table size="small" className={s.eigenschaften} aria-label="Eigenschaften">
      <TableBody>
        {zeilen.map(([k, v]) => <TableRow key={k}><TableCell className={s.th}>{k}</TableCell><TableCell>{v ?? ''}</TableCell></TableRow>)}
      </TableBody>
    </Table>
  );
}

function SeiteInfo({ wechseln }: { wechseln: (s: string) => void }) {
  const s = useStile();
  const d = useStudio((x) => x.dokument);
  if (!d) return <SeiteOeffnen />;
  const z = d.zaehler || {};
  return (
    <>
      <div className={s.kopf}>
        <h2 className={s.h2}>Informationen</h2>
        <Button onClick={async () => {
          const w = await formular('Schuldatei umbenennen', [{ name: 'name', titel: 'Name', wert: d.name, pflicht: true }]);
          if (w) await umbenennen(w.name).catch(fehlerMelden);
        }}>Umbenennen …</Button>
      </div>
      <Eigenschaften zeilen={[
        ['Name', d.name], ['Schule', d.schulname], ['Schuljahr', d.schuljahr], ['Aktive Periode', `${d.periode}${d.periodeFixiert ? ' (fixiert)' : ''}`],
        ['Herkunft', d.herkunft], ['Angelegt von', d.besitzer],
        ['Stand', d.geaendert ? 'Ungespeicherte Änderungen (werden automatisch gespeichert)' : d.gespeichert ? `Gespeichert am ${datumDe(d.gespeichert)}` : 'Gespeichert'],
        ['Inhalt', `${z.klassen} Klassen, ${z.lehrer} Lehrkräfte, ${z.raeume} Räume, ${z.faecher} Fächer`],
        ['Planung', `${z.unterrichte} Unterrichte, ${z.planstunden} verplante Stunden, ${z.nichtVerplant} nicht verplant`],
        ['Geöffnet', d.abonnenten === 1 ? 'In einer Sitzung' : `In ${d.abonnenten} Sitzungen`],
      ]} />
      <div className={s.knoepfe}>
        <Button onClick={() => speichern().catch(fehlerMelden)} disabled={!zustand().benutzer?.darfSchreiben}>Speichern</Button>
        <Button onClick={() => herunterladen()}>Herunterladen (.up)</Button>
        <Button onClick={async () => { await dokumentSchliessen(); wechseln('oeffnen'); }}>Schließen</Button>
      </div>
    </>
  );
}

function SeiteNeu() {
  const s = useStile();
  const optionen: [string, string, string, () => Promise<void>][] = [
    ['Leere Schuldatei', 'Neue Schule mit Fächern und Zeitraster nach den Vorgaben in NRW.', 'Anlegen …', async () => {
      const w = await formular('Neue Schuldatei', [
        { name: 'schulname', titel: 'Schulname', pflicht: true },
        { name: 'schulform', titel: 'Schulform', art: 'auswahl', wert: 'GY', optionen: [['GY', 'Gymnasium'], ['GE', 'Gesamtschule'], ['RS', 'Realschule'], ['HS', 'Hauptschule'], ['SK', 'Sekundarschule'], ['GS', 'Grundschule'], ['BK', 'Berufskolleg'], ['FS', 'Förderschule']].map(([wert, text]) => ({ wert: wert!, text: text! })) },
      ], { okText: 'Anlegen' });
      if (!w) return;
      await oeffnenMit(() => api.post('/api/dokumente/neu', w));
    }],
    ['Beispielschule', 'Erfundenes Gymnasium mit fertigem Stundenplan zum Ausprobieren.', 'Öffnen', () => oeffnenMit(() => api.post('/api/dokumente/beispiel'))],
    ['Datei hochladen', 'Schuldatei (.up) oder BAL-Datei von diesem Rechner übernehmen.', 'Datei wählen …', () => hochladen()],
  ];
  return (
    <>
      <div className={s.kopf}><h2 className={s.h2}>Neu</h2></div>
      <div className={s.optionen}>
        {optionen.map(([t, x, k, f]) => (
          <div key={t} className={s.option}>
            <div className={s.optionText}><Text weight="semibold">{t}</Text><span className={s.leise}>{x}</span></div>
            <Button onClick={() => f().catch(fehlerMelden)}>{k}</Button>
          </div>
        ))}
      </div>
    </>
  );
}

function SeiteOeffnen() {
  const s = useStile();
  const schreiben = useStudio((x) => !!x.benutzer?.darfSchreiben);
  const [ueber, setUeber] = useState(false);
  const { daten, laedt, neuLaden } = useDaten(() => api.get<DokumentListe>('/api/dokumente'), []);
  const zuletzt = daten?.zuletzt || [];
  const sortiert = [...(daten?.dokumente || [])].sort((a, b) => (zuletzt.indexOf(a.id) + 1 || 999) - (zuletzt.indexOf(b.id) + 1 || 999));
  const oeffnen = (id: string) => oeffnenMit(() => api.get(`/api/dokumente/${id}`)).catch(fehlerMelden);
  const ablegen = (e: DragEvent) => { e.preventDefault(); setUeber(false); const f = e.dataTransfer.files?.[0]; if (f) hochladen(f).catch(fehlerMelden); };
  const loeschen = async (id: string, name: string) => {
    if (!(await frage(`Die Schuldatei „${name}“ endgültig vom Server löschen?`, { ja: 'Löschen', gefahr: true }))) return;
    if (zustand().dokument?.id === id) await dokumentSchliessen();
    await api.loeschen(`/api/dokumente/${id}`);
    hinweis(`„${name}“ gelöscht.`, 'ok');
    await neuLaden();
  };
  return (
    <>
      <div className={s.kopf}><h2 className={s.h2}>Öffnen</h2></div>
      {schreiben ? (
        <div className={mergeClasses(s.ablage, ueber && s.ablageUeber)} onDragOver={(e) => { e.preventDefault(); setUeber(true); }} onDragLeave={() => setUeber(false)} onDrop={ablegen} data-testid="ablage">
          <span>Schuldatei (.up) oder BAL-Datei hierher ziehen oder</span>
          <Button size="small" onClick={() => hochladen().catch(fehlerMelden)}>Datei wählen …</Button>
        </div>
      ) : null}
      <h3 className={s.h3}>Schuldateien auf dem Server</h3>
      <div style={{ position: 'relative' }} className={s.liste}>
        <Table size="small" aria-label="Schuldateien">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell><TableHeaderCell style={{ width: 170 }}>Geändert</TableHeaderCell>
              <TableHeaderCell style={{ width: 90, textAlign: 'right' }}>Größe</TableHeaderCell><TableHeaderCell style={{ width: 120 }}>Herkunft</TableHeaderCell>
              <TableHeaderCell style={{ width: 210 }} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortiert.map((d) => (
              <TableRow key={d.id} className={s.zeile} tabIndex={0} data-id={d.id}
                onClick={(e) => { if (!(e.target as HTMLElement).closest('button, a')) void oeffnen(d.id); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) void oeffnen(d.id); }}>
                <TableCell><div><Text weight="semibold">{d.name}</Text></div><div className={s.leise}>{zuletzt.includes(d.id) ? `${d.besitzer} · zuletzt verwendet` : d.besitzer}</div></TableCell>
                <TableCell className="zahl">{datumDe(d.geaendert)}{d.ungespeichert ? <div className={s.leise}>Geöffnet, nicht gespeichert</div> : null}</TableCell>
                <TableCell className="zahl" style={{ textAlign: 'right' }}>{groesse(d.groesse)}</TableCell>
                <TableCell className={s.leise}>{d.herkunft}</TableCell>
                <TableCell>
                  <div className={s.aktionen}>
                    <Button size="small" appearance="subtle" as="a" href={`/api/dokumente/${d.id}/herunterladen`} title="Als .up-Datei herunterladen">Herunterladen</Button>
                    {schreiben ? <Button size="small" appearance="subtle" onClick={() => loeschen(d.id, d.name).catch(fehlerMelden)}>Löschen</Button> : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {daten && !sortiert.length ? (
              <TableRow><TableCell colSpan={5} className={s.leise}>Noch keine Schuldateien vorhanden. Legen Sie unter „Neu“ eine an oder laden Sie eine Datei hoch.</TableCell></TableRow>
            ) : null}
          </TableBody>
        </Table>
        {laedt ? <Ladeanzeige /> : null}
      </div>
    </>
  );
}

const IMPORT_OPTIONEN: [string, string][] = [['zeitraster', 'Zeitraster'], ['stammdaten', 'Stammdaten'], ['unterrichtErsetzen', 'Unterricht und Stundenplan der aktiven Periode ersetzen'], ['stundenplan', 'Stundenplan'], ['pausenaufsichten', 'Pausenaufsichten'], ['zeitwuensche', 'Zeitwünsche']];

function SeiteImport({ zurueck }: { zurueck: () => void }) {
  const s = useStile();
  const [haken, setHaken] = useState<Record<string, boolean>>(() => Object.fromEntries(IMPORT_OPTIONEN.map(([k]) => [k, true])));
  const [laeuft, setLaeuft] = useState(false);
  if (!useStudio((x) => x.dokument)) return <SeiteOeffnen />;
  return (
    <>
      <div className={s.kopf}><h2 className={s.h2}>BAL-Import</h2></div>
      <p className={s.einleitung}>Übernimmt einen Stundenplan aus einer BAL-Datei (WILLI2) in die geöffnete Schuldatei. Der Import lässt sich mit Strg+Z rückgängig machen.</p>
      <h3 className={s.h3}>Übernehmen</h3>
      <div className={s.haken}>
        {IMPORT_OPTIONEN.map(([k, t]) => <Checkbox key={k} label={t} checked={haken[k]} onChange={(_, d) => setHaken((x) => ({ ...x, [k]: !!d.checked }))} />)}
      </div>
      <Button appearance="primary" disabled={laeuft} onClick={async () => {
        const datei = await dateiWaehlen('.txt,.bal,.csv,text/plain');
        if (!datei) return;
        setLaeuft(true);
        try {
          const b = await api.hochladen<ImportBericht>(api.dok('/bal-import'), datei, haken);
          zurueck();
          await importBerichtZeigen(b);
        } catch (e) { fehlerMelden(e); } finally { setLaeuft(false); }
      }}>BAL-Datei wählen und importieren …</Button>
    </>
  );
}

function SeiteKonto() {
  const s = useStile();
  const b = useStudio((x) => x.benutzer);
  if (!b) return null;
  return (
    <>
      <div className={s.kopf}><h2 className={s.h2}>Konto</h2></div>
      <Eigenschaften zeilen={[['Name', b.anzeigename], ['Benutzername', b.name], ['Rolle', b.rolle]]} />
      <div className={s.knoepfe}>
        <Button onClick={async () => {
          const w = await formular('Passwort ändern', [{ name: 'alt', titel: 'Bisheriges Passwort', art: 'passwort', pflicht: true }, { name: 'neu', titel: 'Neues Passwort', art: 'passwort', pflicht: true, hinweis: 'mindestens 6 Zeichen' }]);
          if (!w) return;
          await api.post('/api/ich/passwort', w).then(() => hinweis('Passwort geändert.', 'ok')).catch(fehlerMelden);
        }}>Passwort ändern …</Button>
        <Button onClick={async () => { await api.post('/api/abmeldung'); location.href = '/'; }}>Abmelden</Button>
      </div>
    </>
  );
}

const ROLLEN: Record<Rolle, string> = { Admin: 'Administrator', Planer: 'Planer', Leser: 'Leser' };
interface BenutzerZeile { name: string; anzeigename: string; rolle: Rolle; letzteAnmeldung: string | null }

function SeiteBenutzer() {
  const s = useStile();
  const { daten, neuLaden } = useDaten(() => api.get<BenutzerZeile[]>('/api/benutzer'), []);
  return (
    <>
      <div className={s.kopf}>
        <h2 className={s.h2}>Benutzer</h2>
        <Button onClick={async () => {
          const w = await formular('Neuer Benutzer', [
            { name: 'name', titel: 'Benutzername', pflicht: true }, { name: 'anzeigename', titel: 'Anzeigename' },
            { name: 'rolle', titel: 'Rolle', art: 'auswahl', wert: 'Planer', optionen: [{ wert: 'Planer', text: 'Planer (bearbeiten)' }, { wert: 'Leser', text: 'Leser (nur lesen)' }, { wert: 'Admin', text: 'Administrator' }] },
            { name: 'passwort', titel: 'Passwort', art: 'passwort', pflicht: true, hinweis: 'mindestens 6 Zeichen' }], { okText: 'Anlegen' });
          if (!w) return;
          await api.post('/api/benutzer', w).then(() => neuLaden()).catch(fehlerMelden);
        }}>Benutzer anlegen …</Button>
      </div>
      <Table size="small" className={s.liste} aria-label="Benutzer">
        <TableHeader><TableRow><TableHeaderCell>Benutzer</TableHeaderCell><TableHeaderCell>Rolle</TableHeaderCell><TableHeaderCell>Letzte Anmeldung</TableHeaderCell><TableHeaderCell /></TableRow></TableHeader>
        <TableBody>
          {(daten || []).map((b) => (
            <TableRow key={b.name}>
              <TableCell><div><Text weight="semibold">{b.anzeigename}</Text></div><div className={s.leise}>{b.name}</div></TableCell>
              <TableCell>{ROLLEN[b.rolle] || b.rolle}</TableCell>
              <TableCell className="zahl">{b.letzteAnmeldung ? datumDe(b.letzteAnmeldung) : <span className={s.leise}>Noch nie</span>}</TableCell>
              <TableCell>
                <div className={s.aktionen}>
                  <Button size="small" appearance="subtle" onClick={async () => {
                    const w = await formular(`Passwort für ${b.name}`, [{ name: 'passwort', titel: 'Neues Passwort', art: 'passwort', pflicht: true }]);
                    if (w) await api.post(`/api/benutzer/${encodeURIComponent(b.name)}/passwort`, w).then(() => hinweis('Passwort gesetzt.', 'ok')).catch(fehlerMelden);
                  }}>Passwort setzen …</Button>
                  <Button size="small" appearance="subtle" onClick={async () => {
                    if (await frage(`Benutzer „${b.name}“ löschen?`, { ja: 'Löschen', gefahr: true })) await api.loeschen(`/api/benutzer/${encodeURIComponent(b.name)}`).then(() => neuLaden()).catch(fehlerMelden);
                  }}>Löschen</Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}

function SeiteUeber() {
  const s = useStile();
  const system = useStudio((x) => x.system);
  return (
    <>
      <div className={s.kopf}><h2 className={s.h2}>Über UntPlan Studio</h2></div>
      <Eigenschaften zeilen={[['Anwendung', (system?.anwendung || 'UntPlan Studio').replace(' (Beta)', '')], ['Version', system?.version || '']]} />
      <p className={s.einleitung} style={{ marginTop: 16 }}>Stunden-, Kurs- und Vertretungsplanung für Schulen im Browser. Alle Berechnungen (Planung, Optimierung, Vertretungsvorschläge, Auswertungen) laufen auf dem Server; Schuldateien (.up) lassen sich jederzeit herunterladen und wieder hochladen.</p>
      <p className={s.leise}>Schrift: IBM Plex Sans (SIL Open Font License 1.1). Oberfläche mit Fluent UI (MIT-Lizenz). <Link href="/api/system" target="_blank">Systeminformation</Link></p>
    </>
  );
}

export default function DateiSeite({ p }: AnsichtProps) {
  const s = useStile();
  const a = useAnsicht();
  const navigate = useNavigate();
  const d = useStudio((x) => x.dokument);
  const schreiben = useStudio((x) => !!x.benutzer?.darfSchreiben);
  const admin = useStudio((x) => x.benutzer?.rolle === 'Admin');
  const seite = String(p.seite || (d ? 'info' : 'oeffnen'));
  const wechseln = (x: string) => a.parameterSetzen({ seite: x });
  const zurueck = () => { if (window.history.length > 1) navigate(-1); else navigate('/'); };
  const seiten: Record<string, ReactNode> = {
    info: <SeiteInfo wechseln={wechseln} />, neu: <SeiteNeu />, oeffnen: <SeiteOeffnen />, import: <SeiteImport zurueck={zurueck} />,
    konto: <SeiteKonto />, benutzer: admin ? <SeiteBenutzer /> : <SeiteKonto />, ueber: <SeiteUeber />,
  };
  return (
    <AnsichtRahmen titel="Schuldateien">
      <div className={s.aufbau}>
        <nav className={s.nav} aria-label="Schuldateien">
          {d ? <Button appearance="subtle" icon={<ArrowLeft20Regular />} style={{ justifyContent: 'flex-start' }} onClick={zurueck}>Zurück</Button> : null}
          <div className={s.navTitel}>Schuldatei</div>
          <TabList vertical selectedValue={seite} onTabSelect={(_, x) => wechseln(String(x.value))} size="medium">
            <Tab value="info" disabled={!d}>Informationen</Tab>
            <Tab value="neu" disabled={!schreiben}>Neu</Tab>
            <Tab value="oeffnen">Öffnen</Tab>
            <Tab value="import" disabled={!d || !schreiben}>BAL-Import</Tab>
          </TabList>
          <div className={s.navTitel}>Konto und System</div>
          <TabList vertical selectedValue={seite} onTabSelect={(_, x) => wechseln(String(x.value))}>
            <Tab value="konto">Konto</Tab>
            {admin ? <Tab value="benutzer">Benutzer</Tab> : null}
            <Tab value="ueber">Über UntPlan Studio</Tab>
          </TabList>
        </nav>
        <div className={s.seite} data-seite={seite}>{seiten[seite] || seiten.oeffnen}</div>
      </div>
    </AnsichtRahmen>
  );
}
