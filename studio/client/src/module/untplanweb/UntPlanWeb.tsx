// EduOrga Web: Verbindung, Datenaustausch (Übertragen/Übernehmen mit Fortschritt), Anfangsdatum, automatischer Abgleich.
import { Button, Checkbox, Input, Link, MessageBar, MessageBarBody, MessageBarTitle, ProgressBar, makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import { useEffect, useRef, useState } from 'react';
import { api, dateiHerunterladen } from '@/api/client';
import { useAnsicht } from '@/kern/ansichten';
import { useDaten } from '@/kern/laden';
import { useDarfSchreiben } from '@/kern/zustand';
import { AnsichtRahmen, Trenner, Werkzeug } from '@/komponenten/ansicht';
import { meldung } from '@/komponenten/dialoge';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { MenueKnopf } from '@/komponenten/menue';
import { DatumFeld } from '@/komponenten/eingaben';
import { einstellungenDialog, heute, iso, sachlich, verfolgen, type Auftrag } from './kern';
import { SuchAuswahl } from '@/komponenten/suchauswahl';

interface Teil { teil: string; titel: string; hinweis: string; datum: string; zuletzt: string; export: boolean }
interface Abgleich { aktiv: boolean; minuten: number; vertretungen: boolean; rueckmeldungen: boolean; zuletzt?: string | null; ergebnis?: string }
interface Stand {
  eingerichtet: boolean; exportStatus: string; exportHinweis: string; schulname: string; server: string; schulId: string; adresse?: string;
  anfangsdatumAktiv: boolean; anfangsdatum: string; datumVorgaben: { text: string; datum: string }[]; zeilen: Teil[]; abgleich: Abgleich; laufend?: Auftrag | null;
}

const TEIL_TITEL: Record<string, string> = { 'stpl-aenderungen': 'Stundenplanänderungen', absenzen: 'Abwesenheiten der Lehrkräfte', studenten: 'Fehlzeiten der Schüler', kurse: 'Klassenbuch' };
const teilTitel = (z: Teil) => (TEIL_TITEL[z.teil] ? `${TEIL_TITEL[z.teil]}${z.titel.endsWith('*') ? '*' : ''}` : z.titel);

const useStile = makeStyles({
  flaeche: { flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px 24px 20px', display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' },
  abschnitt: { maxWidth: '980px', border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusMedium, backgroundColor: tokens.colorNeutralBackground1 },
  kopf: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderBottom: `1px solid ${tokens.colorNeutralStroke3}` },
  h3: { margin: 0, fontSize: tokens.fontSizeBase300, fontWeight: tokens.fontWeightSemibold },
  status: { marginLeft: 'auto', fontSize: tokens.fontSizeBase200, fontWeight: tokens.fontWeightMedium, color: tokens.colorPaletteGreenForeground1 },
  aus: { color: tokens.colorNeutralForeground3 },
  dl: { margin: 0, padding: '12px 16px', display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '6px 24px', fontSize: tokens.fontSizeBase300 },
  dt: { color: tokens.colorNeutralForeground3 },
  dd: { margin: 0, minWidth: 0, overflowWrap: 'anywhere' },
  leise: { color: tokens.colorNeutralForeground3 },
  anfang: { display: 'flex', flexWrap: 'wrap', gap: '8px 12px', alignItems: 'center', padding: '10px 16px', borderBottom: `1px solid ${tokens.colorNeutralStroke3}` },
  gruppentitel: { padding: '14px 16px 4px 16px', fontSize: tokens.fontSizeBase200, fontWeight: tokens.fontWeightSemibold, color: tokens.colorNeutralForeground3 },
  teil: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 220px 120px', alignItems: 'center', gap: '16px', minHeight: '52px', padding: '8px 16px', borderBottom: `1px solid ${tokens.colorNeutralStroke3}`, ':last-child': { borderBottom: 'none' } },
  titel: { fontWeight: tokens.fontWeightMedium },
  hinweis: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 },
  datum: { fontSize: tokens.fontSizeBase200, fontVariantNumeric: 'tabular-nums' },
  knopf: { justifySelf: 'end', minWidth: '112px' },
  meldung: { margin: '10px 16px 0 16px', display: 'flex', flexDirection: 'column', gap: '6px' },
  abgleich: { padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' },
  zeile: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 20px' },
  popup: {
    position: 'absolute', left: '50%', top: '40%', transform: 'translate(-50%, -50%)', width: '360px', padding: '16px 18px', zIndex: 20,
    backgroundColor: tokens.colorNeutralBackground1, border: `1px solid ${tokens.colorNeutralStroke1}`, borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow16, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: tokens.fontSizeBase200,
  },
});

function AbgleichFelder({ a, schreiben, jetzt }: { a: Abgleich; schreiben: boolean; jetzt: () => void }) {
  const s = useStile();
  const [w, setW] = useState(a);
  const [minuten, setMinuten] = useState(String(a.minuten));
  useEffect(() => { setW(a); setMinuten(String(a.minuten)); }, [a]);
  const speichern = async (neu: Abgleich) => {
    setW(neu);
    try { await api.put(api.dok('/untplanweb/abgleich'), { aktiv: neu.aktiv, minuten: Number(neu.minuten) || 15, vertretungen: neu.vertretungen, rueckmeldungen: neu.rueckmeldungen }); hinweis('Automatischer Abgleich gespeichert.', 'ok', 2000); }
    catch (e) { fehlerMelden(e); }
  };
  return (
    <div className={s.abgleich}>
      <div className={s.zeile}>
        <Checkbox label="Eingeschaltet" disabled={!schreiben} checked={w.aktiv} onChange={(_, d) => void speichern({ ...w, aktiv: !!d.checked })} />
        <span className={s.zeile} style={{ gap: 8 }}>
          <span className={s.leise}>Alle</span>
          <Input type="number" size="small" min={5} max={1440} style={{ width: 80 }} disabled={!schreiben} aria-label="Abstand in Minuten" value={minuten}
            onChange={(_, d) => setMinuten(d.value)} onBlur={() => { if (Number(minuten) !== w.minuten) void speichern({ ...w, minuten: Number(minuten) || 15 }); }} />
          <span className={s.leise}>Minuten</span>
        </span>
        <Checkbox label="Rückmeldungen übernehmen" title="Krankmeldungen, Nachrichten, Buchungen, Prüfungen und Stornierungen übernehmen (bereits bearbeitete werden übersprungen)"
          disabled={!schreiben} checked={w.rueckmeldungen} onChange={(_, d) => void speichern({ ...w, rueckmeldungen: !!d.checked })} />
        <Checkbox label="Vertretungen* übertragen" disabled={!schreiben} checked={w.vertretungen} onChange={(_, d) => void speichern({ ...w, vertretungen: !!d.checked })} />
        <Button size="small" disabled={!schreiben} onClick={jetzt}>Jetzt abgleichen</Button>
      </div>
      <div className={s.hinweis}>{a.zuletzt ? `Zuletzt ${new Date(a.zuletzt).toLocaleString('de-DE')}: ${a.ergebnis}` : 'Der Server gleicht im Hintergrund ab, auch wenn kein Browser geöffnet ist.'}</div>
    </div>
  );
}

export default function UntPlanWeb() {
  const s = useStile();
  const a = useAnsicht();
  const schreiben = useDarfSchreiben();
  const [laeuft, setLaeuft] = useState(false);
  const [popup, setPopup] = useState<{ wert: number; text: string } | null>(null);
  const [status, setStatus] = useState<{ art: 'fortschritt' | 'fehler'; titel?: string; text: string; wert?: number } | null>(null);
  const [schulname, setSchulname] = useState<string | null>(null);
  const laeuftRef = useRef(false);
  const { daten: stand, setDaten, neuLaden } = useDaten(() => api.get<Stand>(api.dok('/untplanweb')), [], { bereiche: ['Einstellungen', 'Vertretung'], quelle: a.id, aktiv: true });
  const gesperrt = laeuft || !!stand?.laufend || !schreiben;

  const sperren = (an: boolean) => { laeuftRef.current = an; setLaeuft(an); };

  // Schulname einmal vom Server holen
  const eingerichtet = !!stand?.eingerichtet;
  useEffect(() => {
    if (!eingerichtet || schulname) return;
    api.get<{ schulname?: string }>(api.dok('/untplanweb/schulname')).then((r) => { if (r.schulname) setSchulname(r.schulname); }).catch(() => {});
  }, [eingerichtet, schulname]);

  // läuft eine Übertragung eines anderen Benutzers bzw. einer anderen Ansicht, wird sie mitverfolgt
  const laufend = stand?.laufend;
  useEffect(() => {
    if (!laufend || laeuftRef.current) return;
    sperren(true);
    verfolgen(laufend, (wert, text) => setStatus({ art: 'fortschritt', wert, text }))
      .then((x) => { if (x.fehler) setStatus({ art: 'fehler', titel: x.fehlerTitel, text: x.fehler }); })
      .catch(() => {}).finally(() => { sperren(false); void neuLaden(true); });
  }, [laufend?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const einstellungen = async () => {
    if (laeuft) return;
    if (await einstellungenDialog().catch(fehlerMelden)) { setSchulname(null); setStatus(null); await neuLaden(true); }
  };

  async function ausfuehren(z: Teil) {
    if (laeuftRef.current) return;
    if (z.teil === 'stpl-aenderungen') { a.oeffnen('untplanweb.stpl'); return; }
    if (!stand?.eingerichtet) { setStatus({ art: 'fehler', titel: 'Keine Verbindung eingerichtet', text: 'Bitte zuerst unter „Einstellungen“ Server, Port, Schul-ID und API-Schlüssel eintragen.' }); return; }
    sperren(true);
    setStatus(null);
    let ergebnis: Auftrag | null = null;
    try {
      const auftrag = await api.post<Auftrag>(api.dok(`/untplanweb/${z.export ? 'export' : 'import'}/${z.teil}`));
      const x = await verfolgen(auftrag, (wert, text) => { if (wert < 100) setPopup({ wert, text }); });
      setPopup(null);
      if (x.fehler) setStatus({ art: 'fehler', titel: x.fehlerTitel || 'Übertragung fehlgeschlagen', text: x.fehler });
      else { setStatus({ art: 'fortschritt', wert: 100, text: x.text }); ergebnis = x; }
    } catch (e) {
      setPopup(null);
      setStatus({ art: 'fehler', titel: 'Übertragung fehlgeschlagen', text: (e as Error).message });
    } finally {
      sperren(false);
      await neuLaden(true);
    }
    if (ergebnis?.ergebnis) await meldung(sachlich(ergebnis.ergebnis), 'EduOrga Web');
    if (ergebnis?.danach) a.oeffnen('untplanweb.liste', { art: ergebnis.danach });
  }

  const anfangSetzen = async (aktiv: boolean, datum?: string) => {
    try { setDaten(await api.put<Stand>(api.dok('/untplanweb/anfangsdatum'), { aktiv, datum: datum || iso(stand?.anfangsdatum) || heute() }, { quelle: a.id })); }
    catch (e) { fehlerMelden(e); }
  };
  const jetzt = async () => {
    try {
      const e = await api.post<{ ergebnis: string }>(api.dok('/untplanweb/abgleich/jetzt'));
      hinweis(e.ergebnis, e.ergebnis.startsWith('Fehler') ? 'fehler' : 'ok', 5000);
      await neuLaden(true);
    } catch (e) { fehlerMelden(e); }
  };

  const zeile = (z: Teil) => {
    const stpl = z.teil === 'stpl-aenderungen';
    const listeArt = z.teil === 'studenten' ? 'schuelerabwesenheiten' : z.teil === 'kurse' ? 'klassenbuch' : null;
    return (
      <div key={z.teil} className={s.teil} data-teil={z.teil}>
        <div>
          <div className={s.titel}>{teilTitel(z)}{listeArt ? <> <Link as="button" title="Bereits übernommene Daten anzeigen" onClick={() => a.oeffnen('untplanweb.liste', { art: listeArt })}>Anzeigen</Link></> : null}</div>
          <div className={s.hinweis}>{sachlich(z.hinweis)}</div>
        </div>
        <div className={s.datum} title={z.zuletzt}><div>{stpl ? 'Prüfen und einzeln übernehmen' : z.datum}</div><div className={s.hinweis}>{z.zuletzt}</div></div>
        <Button size="small" className={s.knopf} title={z.zuletzt} disabled={gesperrt} onClick={() => void ausfuehren(z)}>{z.export ? 'Übertragen' : stpl ? 'Öffnen' : 'Übernehmen'}</Button>
      </div>
    );
  };

  const paar = (k: string, v: string | null | undefined, titel?: string) => [
    <dt key={`k${k}`} className={s.dt}>{k}</dt>,
    <dd key={`v${k}`} className={s.dd} title={titel}>{v || <span className={s.leise}>nicht eingetragen</span>}</dd>,
  ];

  return (
    <AnsichtRahmen titel="EduOrga Web" laden={!stand}
      werkzeuge={<>
        <Werkzeug text="Einstellungen" titel="Verbindung zu EduOrga Web (Server, Port, Schul-ID, API-Schlüssel) und Freigaben" deaktiviert={gesperrt} aktion={einstellungen} />
        <Trenner />
        <Werkzeug text="Stundenplanänderungen" titel="Stundenplanänderungen aus EduOrga Web prüfen und übernehmen" aktion={() => a.oeffnen('untplanweb.stpl')} />
        <Werkzeug text="Klausuren" titel="Klausuren (aus EduOrga Web übernommene: nur Aufsicht, Raum und Aktiv änderbar)" aktion={() => a.oeffnen('untplanweb.klausuren')} />
        <MenueKnopf text="Weitere Aktionen" eintraege={() => [
          { text: 'Übernommene Schülerfehlzeiten', aktion: () => a.oeffnen('untplanweb.liste', { art: 'schuelerabwesenheiten' }) },
          { text: 'Übernommenes Klassenbuch', aktion: () => a.oeffnen('untplanweb.liste', { art: 'klassenbuch' }) },
          null,
          { text: 'Paket als Datei speichern (JSON)', aktion: () => dateiHerunterladen(api.dok('/austausch/untplanweb.json'), 'untplanweb.json') },
        ]} />
      </>}>
      {stand ? (
        <div className={s.flaeche}>
          <section className={s.abschnitt}>
            <div className={s.kopf}><h3 className={s.h3}>Verbindung</h3><span className={mergeClasses(s.status, !stand.eingerichtet && s.aus)} title={stand.exportHinweis}>{stand.exportStatus}</span></div>
            <dl className={s.dl}>
              {paar('Schule', schulname || sachlich(stand.schulname))}{paar('Server', stand.server, stand.adresse)}{paar('Schul-ID', stand.schulId)}{paar('Stand', stand.exportHinweis)}
            </dl>
          </section>
          <section className={s.abschnitt}>
            <div className={s.kopf}><h3 className={s.h3}>Datenaustausch</h3></div>
            <div className={s.anfang}>
              <Checkbox label="Anfangsdatum für die mit * markierten Bereiche" disabled={gesperrt} checked={stand.anfangsdatumAktiv} onChange={(_, d) => void anfangSetzen(!!d.checked)} />
              <SuchAuswahl size="small" breite={260} ariaLabel="Vorgabe für das Anfangsdatum" title="Anfangsdatum aus Vorgaben wählen (Tagesdatum, nächster Montag, Schuljahresbeginn, Periodenbeginn)"
                disabled={gesperrt || !stand.anfangsdatumAktiv} wert="" platzhalter="Vorgabe wählen" beiWahl={(w) => { if (w) void anfangSetzen(stand.anfangsdatumAktiv, w); }}
                optionen={stand.datumVorgaben.map((v) => ({ wert: iso(v.datum), text: `${v.text} (${new Date(`${iso(v.datum)}T12:00:00`).toLocaleDateString('de-DE')})` }))} />
              <DatumFeld size="small" aria-label="Anfangsdatum" disabled={gesperrt || !stand.anfangsdatumAktiv} wert={iso(stand.anfangsdatum)} beiAenderung={(datum) => { if (datum) void anfangSetzen(stand.anfangsdatumAktiv, datum); }} />
            </div>
            {status ? (
              status.art === 'fehler' ? (
                <MessageBar intent="error" className={s.meldung} layout="multiline">
                  <MessageBarBody>
                    <MessageBarTitle>{sachlich(status.titel)}</MessageBarTitle> {sachlich(status.text)}
                    {schreiben ? <div style={{ marginTop: 6 }}><Button size="small" onClick={() => void einstellungen()}>Verbindung prüfen</Button></div> : null}
                  </MessageBarBody>
                </MessageBar>
              ) : (
                <div className={s.meldung}><ProgressBar value={Math.max(0, Math.min(100, status.wert ?? 0)) / 100} /><span className={s.hinweis}>{sachlich(status.text)}</span></div>
              )
            ) : null}
            <div className={s.gruppentitel}>An EduOrga Web übertragen</div>
            <div>{stand.zeilen.filter((z) => z.export).map(zeile)}</div>
            <div className={s.gruppentitel}>Aus EduOrga Web übernehmen</div>
            <div>{stand.zeilen.filter((z) => !z.export).map(zeile)}</div>
          </section>
          <section className={s.abschnitt}>
            <div className={s.kopf}><h3 className={s.h3}>Automatischer Abgleich</h3></div>
            <AbgleichFelder a={stand.abgleich} schreiben={schreiben} jetzt={() => void jetzt()} />
          </section>
          {popup ? (
            <div className={s.popup} role="status"><div>{sachlich(popup.text)}</div><ProgressBar value={Math.max(0, Math.min(100, popup.wert)) / 100} /></div>
          ) : null}
        </div>
      ) : null}
    </AnsichtRahmen>
  );
}
