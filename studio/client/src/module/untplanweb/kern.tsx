// Gemeinsames des Moduls UntPlan Web: Auftragsverfolgung, Schreibweisen, Einstellungsdialog.
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
export const sachlich = (t: unknown) => String(t ?? '').replace(/UntPlanWeb/g, 'UntPlan Web').replace(/Absenzen/g, 'Abwesenheiten');

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

function EinstellungenInhalt({ e, schliessen }: { e: Einstellungen; schliessen: (w: Record<string, unknown> | null) => void }) {
  const s = useStile();
  const [w, setW] = useState({ ...e, port: String(e.port), tageVoraus: String(e.tageVoraus), apiSchluessel: '' });
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
    <StandardDialog<boolean> titel="Einstellungen für UntPlan Web" breite="640px" knoepfe={[{ text: 'Speichern', wert: true, primaer: true }, { text: 'Abbrechen', wert: null }]}
      beiKnopf={(x) => schliessen(x ? daten() : null)}>
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
          {pruefung ? <span className={pruefung.ok === true ? s.ok : pruefung.ok === false ? s.fehler : s.leise}>{pruefung.text}</span> : null}
        </div>
      </div>
      <h3 className={s.h3}>Übertragung</h3>
      <Field label="Tage im Voraus" orientation="horizontal">
        <div className={s.zeile}>
          <Input type="number" min={1} max={366} style={{ width: 100 }} disabled={w.unbegrenzt} value={w.tageVoraus} onChange={(_, d) => setze({ tageVoraus: d.value })} />
          <Checkbox label="Ohne Begrenzung" title="Unterricht und Vertretungen bis zum Schuljahresende übertragen" checked={w.unbegrenzt} onChange={(_, d) => setze({ unbegrenzt: !!d.checked })} />
        </div>
      </Field>
      <h3 className={s.h3}>Freigaben</h3>
      <div className={s.spalte} style={{ gap: 0 }}>
        {OPTIONEN.map(([k, t]) => <Checkbox key={k} label={t} checked={!!w[k]} onChange={(_, d) => setze({ [k]: !!d.checked } as Partial<typeof w>)} />)}
      </div>
      <p className={s.leise}>Personenbezogene Daten werden nur übertragen, wenn sie hier ausdrücklich freigegeben sind.</p>
    </StandardDialog>
  );
}

export async function einstellungenDialog(): Promise<boolean> {
  const e = await api.get<Einstellungen>(api.dok('/untplanweb/einstellungen'));
  const w = await dialogZeigen<Record<string, unknown>>((schliessen) => <EinstellungenInhalt e={e} schliessen={schliessen} />);
  if (!w) return false;
  await api.put(api.dok('/untplanweb/einstellungen'), w);
  hinweis('Einstellungen für UntPlan Web gespeichert.', 'ok');
  return true;
}
