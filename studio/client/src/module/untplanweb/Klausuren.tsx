// Klausuren: eigene und aus EduOrga Web übernommene (dort nur Aufsicht, Räume und „Aktiv“ änderbar).
import { Checkbox, Field, Input, makeStyles, tokens } from '@fluentui/react-components';
import { useRef, useState } from 'react';
import { api } from '@/api/client';
import { useAnsicht } from '@/kern/ansichten';
import { useDaten } from '@/kern/laden';
import { useDarfSchreiben } from '@/kern/zustand';
import { AnsichtRahmen, Feld, FussText, Rechts, Werkzeug } from '@/komponenten/ansicht';
import { dialogZeigen, frage, StandardDialog } from '@/komponenten/dialoge';
import { Tabelle, type TabelleApi } from '@/komponenten/tabelle/Tabelle';
import { DatumFeld } from '@/komponenten/eingaben';
import { heute, iso } from './kern';
import './untplanweb.css';

interface Klausur {
  id: number; name: string; datum: string; datumText: string; von: number; bis: number; stunde?: string; klassen: string; lehrer: string; raeume: string;
  unterrichtEntfaellt: boolean; aktiv: boolean; text: string; importiert?: boolean; buchungen?: number; aktivText?: string; herkunft?: string;
}
type KlausurDaten = Pick<Klausur, 'name' | 'datum' | 'von' | 'bis' | 'klassen' | 'lehrer' | 'raeume' | 'unterrichtEntfaellt' | 'aktiv' | 'text'>;

const useStile = makeStyles({
  formular: { display: 'flex', flexDirection: 'column', gap: '10px' },
  zeile: { display: 'flex', alignItems: 'center', gap: '8px' },
  leise: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200, margin: '0 0 6px 0' },
});

function klausurDialog(k: Partial<Klausur>): Promise<KlausurDaten | null> {
  const importiert = !!k.importiert;
  function Inhalt({ schliessen }: { schliessen: (w: KlausurDaten | null) => void }) {
    const s = useStile();
    const [w, setW] = useState({
      name: k.name ?? 'Klausur', datum: iso(k.datum ?? heute()), von: String(k.von ?? 1), bis: String(k.bis ?? 1), klassen: k.klassen ?? '', lehrer: k.lehrer ?? '',
      raeume: k.raeume ?? '', unterrichtEntfaellt: k.unterrichtEntfaellt ?? true, aktiv: k.aktiv ?? true, text: k.text ?? '',
    });
    const setze = (t: Partial<typeof w>) => setW((x) => ({ ...x, ...t }));
    const text = (titel: string, f: 'name' | 'klassen' | 'lehrer' | 'raeume' | 'text', gesperrt: boolean, platzhalter?: string) => (
      <Field label={titel} orientation="horizontal"><Input value={w[f]} disabled={gesperrt} placeholder={platzhalter} onChange={(_, d) => setze({ [f]: d.value })} /></Field>
    );
    return (
      <StandardDialog<boolean> titel={k.id ? 'Klausur bearbeiten' : 'Neue Klausur'} breite="560px" knoepfe={[{ text: 'OK', wert: true, primaer: true }, { text: 'Abbrechen', wert: null }]}
        beiKnopf={(x) => schliessen(x ? { ...w, von: Number(w.von), bis: Number(w.bis) } : null)}>
        {importiert ? <p className={s.leise}>Aus EduOrga Web übernommen: Nur Aufsicht, Räume und „Aktiv“ lassen sich hier ändern.</p> : null}
        <div className={s.formular}>
          {text('Bezeichnung', 'name', importiert)}
          <Field label="Datum" orientation="horizontal"><DatumFeld size="medium" wert={w.datum} disabled={importiert} beiAenderung={(datum) => setze({ datum: datum })} /></Field>
          <Field label="Stunden" orientation="horizontal">
            <span className={s.zeile}>
              <Input type="number" min={1} style={{ width: 80 }} aria-label="Von Stunde" value={w.von} disabled={importiert} onChange={(_, d) => setze({ von: d.value })} />
              <span>bis</span>
              <Input type="number" min={1} style={{ width: 80 }} aria-label="Bis Stunde" value={w.bis} disabled={importiert} onChange={(_, d) => setze({ bis: d.value })} />
            </span>
          </Field>
          {text('Klassen', 'klassen', importiert, 'z. B. Q1,Q2')}
          {text('Aufsicht', 'lehrer', false, 'Kürzel der Lehrkräfte, z. B. MÜL,SCH')}
          {text('Räume', 'raeume', false)}
          {text('Text', 'text', importiert)}
          <Checkbox label="Unterricht der Klassen entfällt in diesen Stunden" disabled={importiert} checked={w.unterrichtEntfaellt} onChange={(_, d) => setze({ unterrichtEntfaellt: !!d.checked })} />
          <Checkbox label="Aktiv" checked={w.aktiv} onChange={(_, d) => setze({ aktiv: !!d.checked })} />
        </div>
      </StandardDialog>
    );
  }
  return dialogZeigen<KlausurDaten>((schliessen) => <Inhalt schliessen={schliessen} />);
}

export default function Klausuren() {
  const a = useAnsicht();
  const schreiben = useDarfSchreiben();
  const t = useRef<TabelleApi<Klausur>>(null);
  const [von, setVon] = useState('');
  const [bis, setBis] = useState('');
  const { daten, neuLaden } = useDaten(
    () => api.get<Klausur[]>(api.dok(`/untplanweb/klausuren?${von ? `von=${von}&` : ''}${bis ? `bis=${bis}` : ''}`)),
    [von, bis], { bereiche: ['Vertretung'], quelle: a.id });
  const zeilen = (daten || []).map((k) => ({ ...k, aktivText: k.aktiv ? 'Ja' : 'Nein', herkunft: k.importiert ? 'EduOrga Web' : 'Eigene Eingabe' }));

  const neu = async () => { const d = await klausurDialog({}); if (d) { await api.post(api.dok('/untplanweb/klausuren'), d, { quelle: a.id }); await neuLaden(true); } };
  const bearbeiten = async (z: Klausur | null | undefined) => {
    if (!z || !schreiben) return;
    const d = await klausurDialog(z);
    if (!d) return;
    await api.put(api.dok(`/untplanweb/klausuren/${z.id}`), d, { quelle: a.id });
    await neuLaden(true);
  };
  const loeschen = async (z: Klausur | null | undefined) => {
    if (!z || !(await frage(`Klausur „${z.name}“ am ${z.datumText} löschen?${z.buchungen ? '\nZur Prüfung gewordene Buchungen kehren zurück.' : ''}`, { ja: 'Löschen', gefahr: true }))) return;
    await api.loeschen(api.dok(`/untplanweb/klausuren/${z.id}`), { quelle: a.id });
    await neuLaden(true);
  };

  return (
    <AnsichtRahmen titel="Klausuren"
      werkzeuge={<>
        {schreiben ? <>
          <Werkzeug text="Neue Klausur …" aktion={neu} />
          <Werkzeug text="Bearbeiten …" aktion={() => bearbeiten(t.current?.aktiveZeile())} />
          <Werkzeug text="Löschen" aktion={() => loeschen(t.current?.aktiveZeile())} />
        </> : null}
        <Rechts>
          <Feld titel="Von"><DatumFeld size="small" wert={von} beiAenderung={(datum) => setVon(datum)} /></Feld>
          <Feld titel="Bis"><DatumFeld size="small" wert={bis} beiAenderung={(datum) => setBis(datum)} /></Feld>
        </Rechts>
      </>}
      fuss={<>
        <span>{zeilen.length === 1 ? '1 Klausur' : `${zeilen.length} Klausuren`}</span>
        <FussText rechts>Doppelklick bearbeitet. Bei Prüfungen aus EduOrga Web sind nur Aufsicht, Räume und „Aktiv“ änderbar.</FussText>
      </>}>
      <Tabelle<Klausur> ref={t} name="upw-klausuren" zeilen={zeilen} id={(z) => z.id} zustandSchluessel="tabelle.untplanweb.klausuren" leerText="Keine Klausuren im gewählten Zeitraum."
        zeilenKlasse={(z) => (z.importiert ? 'upw-importiert' : z.aktiv ? '' : 'upw-erledigt')}
        beiDoppelklick={(z) => void bearbeiten(z)}
        kontextmenue={(l) => [
          { text: 'Bearbeiten …', aktion: () => bearbeiten(l[0]), deaktiviert: !l.length || !schreiben },
          { text: 'Löschen', aktion: () => loeschen(l[0]), deaktiviert: !l.length || !schreiben },
        ]}
        spalten={([['datumText', 'Datum', 85], ['stunde', 'Std.', 50], ['name', 'Name', 160], ['klassen', 'Klasse(n)', 100], ['lehrer', 'Aufsicht', 110], ['raeume', 'Räume', 100],
          ['aktivText', 'Aktiv', 60], ['herkunft', 'Herkunft', 100], ['text', 'Text', 200]] as [string, string, number][]).map(([schluessel, titel, breite]) => ({ schluessel, titel, breite, art: 'NurLesen' as const }))} />
    </AnsichtRahmen>
  );
}
