// „Findet online statt“ einzelner Stunden an einem Datum (Abweichung vom Unterricht): Dialog und Liste der Abweichungen
// im Zeitraum. Endpunkte: GET/PUT /vertretung/online, GET /vertretung/online/stunde (siehe ARCHITEKTUR.md).
import { Checkbox, Field, Input, Radio, RadioGroup, Text, makeStyles, tokens } from '@fluentui/react-components';
import { useMemo, useRef, useState } from 'react';
import { api } from '@/api/client';
import { useAnsicht, type AnsichtProps } from '@/kern/ansichten';
import { useDaten } from '@/kern/laden';
import { darfSchreiben, useDarfSchreiben } from '@/kern/zustand';
import { AnsichtRahmen, Feld, FussText, Werkzeug } from '@/komponenten/ansicht';
import { StandardDialog, dialogZeigen } from '@/komponenten/dialoge';
import { hinweis } from '@/komponenten/hinweise';
import { Tabelle, type Spalte, type TabelleApi } from '@/komponenten/tabelle/Tabelle';
import { linkGueltig } from '../unterricht/online';
import { tagText, vpfad } from './kern';
import { useZeitraum, ZeitraumAuswahl } from './steuer';

export interface OnlineStunde {
  datum: string; stunde: number; unterricht: number; online: boolean; onlineLink: string | null; abweichend: boolean;
  regel: { online: boolean; onlineLink: string | null }; fach: string; lehrer: string; klassen: string; geaendert?: string; benutzer?: string;
}

const useStile = makeStyles({
  inhalt: { display: 'flex', flexDirection: 'column', gap: '12px' },
  leise: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
});

type Wahl = 'regel' | 'online' | 'praesenz';

function Inhalt({ stand, schliessen }: { stand: OnlineStunde; schliessen: (w: { wahl: Wahl; link: string; block: boolean } | null) => void }) {
  const s = useStile();
  const schreiben = darfSchreiben();
  const [wahl, setWahl] = useState<Wahl>(!stand.abweichend ? 'regel' : stand.online ? 'online' : 'praesenz');
  const [link, setLink] = useState(stand.abweichend && stand.online ? stand.onlineLink || '' : '');
  const [block, setBlock] = useState(true);
  const fehler = linkGueltig(link) ? undefined : 'Bitte eine Adresse mit http:// oder https:// angeben.';
  const regelText = stand.regel.online ? `Wie der Unterricht: online${stand.regel.onlineLink ? ` (${stand.regel.onlineLink})` : ''}` : 'Wie der Unterricht: in Präsenz';
  return (
    <StandardDialog<boolean> titel={`Findet online statt – ${tagText(stand.datum)}, ${stand.stunde}. Stunde`} breite="560px"
      knoepfe={schreiben ? [{ text: 'Speichern', wert: true, primaer: true, deaktiviert: wahl === 'online' && !!fehler }, { text: 'Abbrechen', wert: null }] : [{ text: 'Schließen', wert: null }]}
      beiKnopf={(w) => schliessen(w ? { wahl, link, block } : null)}>
      <div className={s.inhalt}>
        <Text>{`U-Nr. ${stand.unterricht} · ${[stand.fach, stand.klassen, stand.lehrer].filter(Boolean).join(' · ')}`}</Text>
        <RadioGroup value={wahl} disabled={!schreiben} onChange={(_, d) => setWahl(d.value as Wahl)} aria-label="Stunde findet statt">
          <Radio value="regel" label={regelText} />
          <Radio value="online" label="Diese Stunde findet online statt" />
          <Radio value="praesenz" label="Diese Stunde findet in Präsenz statt" />
        </RadioGroup>
        {wahl === 'online' ? (
          <Field label="Link zur Online-Stunde" hint="Leer = Link des Unterrichts verwenden." validationMessage={fehler}>
            <Input value={link} disabled={!schreiben} onChange={(_, d) => setLink(d.value)} placeholder={stand.regel.onlineLink || 'https://'} type="url" />
          </Field>
        ) : null}
        <Checkbox label="Für den ganzen Block (Doppel-/Blockstunde)" checked={block} disabled={!schreiben} onChange={(_, d) => setBlock(!!d.checked)} />
        <span className={s.leise}>Die Angabe gilt nur für dieses Datum und wird an UntPlan Web übertragen. Den regelmäßigen Online-Unterricht legt der Unterricht fest.</span>
      </div>
    </StandardDialog>
  );
}

/** Dialog „Findet online statt“ für eine Stunde an einem Datum; true = geändert. */
export async function onlineStundeDialog(st: { datum: string; stunde: number; unterricht: number }, quelle?: string): Promise<boolean> {
  const stand = await api.get<OnlineStunde>(vpfad(`/online/stunde?datum=${st.datum}&stunde=${st.stunde}&unterricht=${st.unterricht}`));
  const w = await dialogZeigen<{ wahl: Wahl; link: string; block: boolean }>((zu) => <Inhalt stand={stand} schliessen={zu} />);
  if (!w) return false;
  const online = w.wahl === 'regel' ? null : w.wahl === 'online';
  const r = await api.put<{ stunden: OnlineStunde[] }>(vpfad('/online'), { datum: st.datum, stunde: st.stunde, unterricht: st.unterricht, online, onlineLink: w.wahl === 'online' ? w.link.trim() : undefined, block: w.block }, { quelle });
  const n = r.stunden?.length || 1;
  hinweis(online === null ? 'Es gilt wieder der Unterricht.' : online ? `${n === 1 ? 'Stunde findet' : `${n} Stunden finden`} online statt.` : `${n === 1 ? 'Stunde findet' : `${n} Stunden finden`} in Präsenz statt.`, 'ok', 2500);
  return true;
}

/** Ansicht „Online-Stunden“: abweichende Angaben einzelner Stunden im Zeitraum. */
export default function OnlineStunden({ p }: AnsichtProps) {
  const a = useAnsicht();
  const schreiben = useDarfSchreiben();
  const tabelle = useRef<TabelleApi<OnlineStunde & { id: string }>>(null);
  const zr = useZeitraum((p.zeitraum as 'woche') || 'woche', 7, (z) => a.parameterSetzen({ zeitraum: z.art }));
  const { daten, neuLaden } = useDaten(() => api.get<OnlineStunde[]>(vpfad(`/online?von=${zr.von}&bis=${zr.bis}`)), [zr.von, zr.bis], { bereiche: ['Vertretung', 'Unterricht'], aktiv: !!zr.von });
  const zeilen = useMemo(() => (daten || []).map((x) => ({ ...x, id: `${x.datum}|${x.stunde}|${x.unterricht}` })), [daten]);
  type Z = (typeof zeilen)[number];
  const spalten: Spalte<Z>[] = [
    { schluessel: 'datum', titel: 'Datum', breite: 110, art: 'NurLesen', wert: (z) => tagText(z.datum) },
    { schluessel: 'stunde', titel: 'Std.', breite: 50, art: 'NurLesen', ausrichtung: 'rechts' },
    { schluessel: 'unterricht', titel: 'U-Nr.', breite: 64, art: 'NurLesen', ausrichtung: 'rechts' },
    { schluessel: 'fach', titel: 'Fach', breite: 70, art: 'NurLesen' }, { schluessel: 'klassen', titel: 'Klassen', breite: 100, art: 'NurLesen' },
    { schluessel: 'lehrer', titel: 'Lehrkraft', breite: 90, art: 'NurLesen' },
    { schluessel: 'online', titel: 'Findet statt', breite: 110, art: 'NurLesen', wert: (z) => (z.online ? 'online' : 'in Präsenz') },
    { schluessel: 'onlineLink', titel: 'Link', breite: 260, art: 'NurLesen' },
    { schluessel: 'regel', titel: 'Unterricht', breite: 110, art: 'NurLesen', wert: (z) => (z.regel.online ? 'online' : 'in Präsenz') },
    { schluessel: 'benutzer', titel: 'Geändert von', breite: 110, art: 'NurLesen' },
  ];
  const bearbeiten = async () => { const z = tabelle.current?.aktiveZeile(); if (z && (await onlineStundeDialog(z, a.id))) await neuLaden(true); };
  const entfernen = async () => {
    const liste = tabelle.current?.ausgewaehlte() || [];
    for (const z of liste) await api.put(vpfad('/online'), { datum: z.datum, stunde: z.stunde, unterricht: z.unterricht, online: null }, { quelle: a.id });
    if (liste.length) { hinweis(`${liste.length} Abweichung(en) entfernt.`, 'ok'); await neuLaden(true); }
  };
  return (
    <AnsichtRahmen titel="Online-Stunden"
      werkzeuge={<>
        <Werkzeug text="Bearbeiten" titel="Angabe der markierten Stunde ändern" aktion={bearbeiten} deaktiviert={!schreiben} />
        <Werkzeug text="Abweichung entfernen" titel="Es gilt wieder die Angabe des Unterrichts" aktion={entfernen} deaktiviert={!schreiben} />
      </>}
      filter={<Feld titel="Zeitraum"><ZeitraumAuswahl z={zr} /></Feld>}
      fuss={<><span>{zeilen.length} abweichende Stunden</span><FussText rechts>Regelmäßigen Online-Unterricht legt der Unterricht fest (Unterricht → Online).</FussText></>}>
      <Tabelle<Z> ref={tabelle} name="online-stunden" spalten={spalten} zeilen={zeilen} leerText="Im Zeitraum weichen keine Stunden vom Unterricht ab."
        beiDoppelklick={() => void bearbeiten()} kontextmenue={() => [
          { text: 'Bearbeiten …', aktion: bearbeiten, deaktiviert: !schreiben },
          { text: 'Abweichung entfernen', aktion: entfernen, deaktiviert: !schreiben },
        ]} />
    </AnsichtRahmen>
  );
}
