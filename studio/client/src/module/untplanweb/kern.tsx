// Gemeinsames des Moduls EduOrga Web: Auftragsverfolgung, Schreibweisen, Einstellungsdialog.
import { Button, Checkbox, Field, Input, makeStyles, tokens } from '@fluentui/react-components';
import { useState } from 'react';
import { api } from '@/api/client';
import { dialogZeigen, StandardDialog } from '@/komponenten/dialoge';
import { hinweis } from '@/komponenten/hinweise';
import { isoAus, plusTage } from '../vertretung/kern';

export const heute = () => isoAus(new Date());
export { plusTage };
export const iso = (d: string | null | undefined) => (d ? String(d).slice(0, 10) : '');

export interface Auftrag { id: string; fertig: boolean; wert: number; text: string; fehler?: string; fehlerTitel?: string; ergebnis?: string; danach?: string }

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Auftrag bis zum Ende verfolgen; fortschritt(wert, text) wird laufend aufgerufen. */
export async function verfolgen(auftrag: Auftrag, fortschritt: (wert: number, text: string) => void): Promise<Auftrag> {
  let a = auftrag;
  while (!a.fertig) {
    fortschritt(a.wert, a.text);
    await pause(250);
    a = await api.get<Auftrag>(api.dok(`/untplanweb/auftrag/${a.id}`));
  }
  fortschritt(a.wert, a.text);
  return a;
}

/** Servertexte in der Schreibweise der Oberfläche. */
export const sachlich = (t: unknown) => String(t ?? '').replace(/UntPlanWeb/g, 'EduOrga Web').replace(/Absenzen/g, 'Abwesenheiten');

interface Einstellungen {
  schulId: string; server: string; port: number; https: boolean; pfad: string; apiSchluesselGesetzt?: boolean; tageVoraus: number; unbegrenzt: boolean;
  ignoriertenUnterricht: boolean; ferienNichtExportieren: boolean; lehrerEmail: boolean; lehrerAbsenzen: boolean; absenzgruende: boolean; schueler: boolean;
}

const OPTIONEN: [keyof Einstellungen, string][] = [
  ['ignoriertenUnterricht', 'Ignorierten Unterricht übertragen'],
  ['ferienNichtExportieren', 'Ferien nicht als Stammdaten übertragen'],
  ['lehrerEmail', 'E-Mail-Adressen der Lehrkräfte übertragen'],
  ['lehrerAbsenzen', 'Abwesenheiten der Lehrkräfte übertragen (ohne Grund)'],
  ['absenzgruende', 'Abwesenheitsgründe übertragen (außer vertraulichen)'],
  ['schueler', 'Schülerliste übertragen (Klassenbuch, Fehlzeiten)'],
];

const useStile = makeStyles({
  h3: { margin: '16px 0 8px 0', fontSize: tokens.fontSizeBase300, fontWeight: tokens.fontWeightSemibold, ':first-child': { marginTop: 0 } },
  spalte: { display: 'flex', flexDirection: 'column', gap: '10px' },
  zeile: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  leise: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200, margin: '8px 0 0 0' },
  ok: { color: tokens.colorPaletteGreenForeground1, fontSize: tokens.fontSizeBase200 },
  fehler: { color: tokens.colorPaletteRedForeground1, fontSize: tokens.fontSizeBase200 },
});

/** Direkte Übertragung der Vertretungen (Studio-Datenbank je Dokument, nicht in der Schuldatei). */
interface Direkt { automatisch: boolean; sekunden: number }

function EinstellungenInhalt({ e, direkt, schliessen }: { e: Einstellungen; direkt: Direkt; schliessen: (w: Record<string, unknown> | null) => void }) {
  const s = useStile();
  const [w, setW] = useState({ ...e, port: String(e.port), tageVoraus: String(e.tageVoraus), apiSchluessel: '' });
  const [auto, setAuto] = useState({ automatisch: direkt.automatisch, sekunden: String(direkt.sekunden) });
  const [pruefung, setPruefung] = useState<{ text: string; ok?: boolean } | null>(null);
  const setze = (teil: Partial<typeof w>) => setW((x) => ({ ...x, ...teil }));
  const daten = () => ({
    schulId: w.schulId.trim(), server: w.server.trim(), port: Number(w.port) || (w.https ? 443 : 80), https: w.https, pfad: e.pfad,
    apiSchluessel: w.apiSchluessel.trim() || null, tageVoraus: Number(w.tageVoraus) || 7, unbegrenzt: w.unbegrenzt,
    ...Object.fromEntries(OPTIONEN.map(([k]) => [k, !!w[k]])),
  });
  const pruefen = async () => {
    setPruefung({ text: 'Verbindung wird geprüft …' });
    try { const r = await api.post<{ ok: boolean; text: string }>(api.dok('/untplanweb/pruefen'), daten()); setPruefung(r); }
    catch (f) { setPruefung({ text: (f as Error).message, ok: false }); }
  };
  return (
    <StandardDialog<boolean> titel="Einstellungen für EduOrga Web" breite="640px" knoepfe={[{ text: 'Speichern', wert: true, primaer: true }, { text: 'Abbrechen', wert: null }]}
      beiKnopf={(x) => schliessen(x ? { ...daten(), _direkt: { automatisch: auto.automatisch, sekunden: Math.min(600, Math.max(5, Number(auto.sekunden) || 30)) } } : null)}>
      <h3 className={s.h3}>Verbindung</h3>
      <div className={s.spalte}>
        <Field label="Schul-ID" orientation="horizontal"><Input value={w.schulId} onChange={(_, d) => setze({ schulId: d.value })} /></Field>
        <Field label="Server" orientation="horizontal"><Input value={w.server} placeholder="z. B. web.meine-schule.de" onChange={(_, d) => setze({ server: d.value })} /></Field>
        <Field label="Port" orientation="horizontal">
          <div className={s.zeile}>
            <Input type="number" min={1} max={65535} style={{ width: 100 }} value={w.port} onChange={(_, d) => setze({ port: d.value })} />
            <Checkbox label="Verschlüsselt (HTTPS)" checked={w.https} onChange={(_, d) => {
              const an = !!d.checked;
              setze({ https: an, port: an && w.port === '80' ? '443' : !an && w.port === '443' ? '80' : w.port });
            }} />
          </div>
        </Field>
        <Field label="API-Schlüssel" orientation="horizontal">
          <Input type="password" autoComplete="new-password" value={w.apiSchluessel} placeholder={e.apiSchluesselGesetzt ? 'Gespeichert – leer lassen, um ihn zu behalten' : ''} onChange={(_, d) => setze({ apiSchluessel: d.value })} />
        </Field>
        <div className={s.zeile}>
          <Button size="small" onClick={() => void pruefen()}>Verbindung prüfen</Button>
          {pruefung ? <span className={pruefung.ok === true ? s.ok : pruefung.ok === false ? s.fehler : s.leise} data-pruefung={pruefung.ok === true ? 'ok' : pruefung.ok === false ? 'fehler' : 'laeuft'}>{pruefung.text}</span> : null}
        </div>
      </div>
      <h3 className={s.h3}>Übertragung</h3>
      <Field label="Tage im Voraus" orientation="horizontal">
        <div className={s.zeile}>
          <Input type="number" min={1} max={366} style={{ width: 100 }} disabled={w.unbegrenzt} value={w.tageVoraus} onChange={(_, d) => setze({ tageVoraus: d.value })} />
          <Checkbox label="Ohne Begrenzung" title="Unterricht und Vertretungen bis zum Schuljahresende übertragen" checked={w.unbegrenzt} onChange={(_, d) => setze({ unbegrenzt: !!d.checked })} />
        </div>
      </Field>
      <h3 className={s.h3}>Vertretungen direkt übertragen</h3>
      <div className={s.zeile}>
        <Checkbox label="Vertretungen automatisch übertragen" checked={auto.automatisch} onChange={(_, d) => setAuto((x) => ({ ...x, automatisch: !!d.checked }))} data-testid="upw-automatisch" />
        <span className={s.zeile} style={{ gap: 6 }}>
          höchstens
          <Input type="number" min={5} max={600} style={{ width: 80 }} disabled={!auto.automatisch} value={auto.sekunden} onChange={(_, d) => setAuto((x) => ({ ...x, sekunden: d.value }))} aria-label="Sekunden nach einer Änderung" />
          Sekunden nach einer Änderung
        </span>
      </div>
      <p className={s.leise}>Geänderte Vertretungen gehen dann ohne Klick an EduOrga Web (wie „Vertretungen*“, nur die geänderten Stunden). Jederzeit von Hand: „An Web senden“ in der Kopfleiste der Vertretungsplanung.</p>
      <h3 className={s.h3}>Freigaben</h3>
      <div className={s.spalte} style={{ gap: 0 }}>
        {OPTIONEN.map(([k, t]) => <Checkbox key={k} label={t} checked={!!w[k]} onChange={(_, d) => setze({ [k]: !!d.checked } as Partial<typeof w>)} />)}
      </div>
      <p className={s.leise}>Personenbezogene Daten werden nur übertragen, wenn sie hier ausdrücklich freigegeben sind.</p>
    </StandardDialog>
  );
}

export async function einstellungenDialog(): Promise<boolean> {
  const [e, direkt] = await Promise.all([
    api.get<Einstellungen>(api.dok('/untplanweb/einstellungen')),
    api.get<Direkt>(api.dok('/untplanweb/direkt')).catch(() => ({ automatisch: false, sekunden: 30 })),
  ]);
  const w = await dialogZeigen<Record<string, unknown>>((schliessen) => <EinstellungenInhalt e={e} direkt={direkt} schliessen={schliessen} />);
  if (!w) return false;
  const { _direkt, ...einstellungen } = w;
  await api.put(api.dok('/untplanweb/einstellungen'), einstellungen);
  await api.put(api.dok('/untplanweb/direkt'), _direkt);
  hinweis('Einstellungen für EduOrga Web gespeichert.', 'ok');
  return true;
}
