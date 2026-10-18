// Stundenplanänderungen aus UntPlan Web: Zeitraum laden, markieren (Buchungen/Prüfungen), übernehmen oder ignorieren.
import { Button, Checkbox, Field, Input } from '@fluentui/react-components';
import { useMemo, useRef, useState } from 'react';
import { api } from '@/api/client';
import { useAnsicht } from '@/kern/ansichten';
import { useDaten } from '@/kern/laden';
import { useDarfSchreiben } from '@/kern/zustand';
import { AnsichtRahmen, Feld, FussText, Schalter, Trenner, Werkzeug } from '@/komponenten/ansicht';
import { dialogZeigen, meldung, StandardDialog } from '@/komponenten/dialoge';
import { hinweis } from '@/komponenten/hinweise';
import { MenueKnopf } from '@/komponenten/menue';
import { Tabelle, type Spalte, type TabelleApi } from '@/komponenten/tabelle/Tabelle';
import { heute, plusTage, sachlich } from './kern';
import './untplanweb.css';

interface Aenderung { id: string | number; datumText: string; zeit?: string; stunde?: string | number; art?: string; artText?: string; unterricht?: string; klassenFach?: string;
  lehrer?: string; raeume?: string; wert?: string; statistik?: string; text?: string; ersteller?: string; uebernommen?: boolean | null; erledigt?: boolean; fehler?: boolean;
  gruppe?: boolean; statusText?: string }
interface StplEinst { vorPruefungIgnorieren: boolean; nachPruefungIgnorieren: boolean; tage: number }
interface StplDaten { zeilen: Aenderung[]; status: string; einstellungen: StplEinst }

const SPALTEN: [string, string, number][] = [
  ['id', 'Nummer', 110], ['datumText', 'Datum', 85], ['zeit', 'Zeit', 90], ['stunde', 'Stunde', 50], ['artText', 'Art', 75], ['unterricht', 'Unterricht', 70], ['klassenFach', 'Klasse(n) / Fach', 130],
  ['lehrer', 'Lehrkraft', 80], ['raeume', 'Räume', 80], ['wert', 'Wert', 44], ['statistik', 'Statistik', 60], ['text', 'Text', 260], ['ersteller', 'Erfasst von', 130], ['statusText', 'Status', 90],
];

function einstellungenDialog(e: StplEinst): Promise<StplEinst | null> {
  function Inhalt({ schliessen }: { schliessen: (w: StplEinst | null) => void }) {
    const [w, setW] = useState({ ...e, tage: String(e.tage) });
    return (
      <StandardDialog<boolean> titel="Einstellungen zum Import" breite="560px" knoepfe={[{ text: 'Speichern', wert: true, primaer: true }, { text: 'Abbrechen', wert: null }]}
        beiKnopf={(x) => schliessen(x ? { ...w, tage: Number(w.tage) || 14 } : null)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Zeitraum (Tage ab heute)" hint="Voreinstellung, für wie viele Tage Stundenplanänderungen geladen werden.">
            <Input type="number" min={1} max={365} style={{ width: 100 }} value={w.tage} onChange={(_, d) => setW({ ...w, tage: d.value })} />
          </Field>
          <Field label="Pausenaufsichten">
            <Checkbox label="Vor Prüfungen nicht berücksichtigen" checked={w.vorPruefungIgnorieren} onChange={(_, d) => setW({ ...w, vorPruefungIgnorieren: !!d.checked })} />
            <Checkbox label="Nach Prüfungen nicht berücksichtigen" checked={w.nachPruefungIgnorieren} onChange={(_, d) => setW({ ...w, nachPruefungIgnorieren: !!d.checked })} />
          </Field>
        </div>
      </StandardDialog>
    );
  }
  return dialogZeigen<StplEinst>((schliessen) => <Inhalt schliessen={schliessen} />);
}

export default function Stpl() {
  const a = useAnsicht();
  const schreiben = useDarfSchreiben();
  const t = useRef<TabelleApi<Aenderung>>(null);
  const [von, setVon] = useState(heute());
  const [bis, setBis] = useState(plusTage(heute(), 14));
  const [erledigte, setErledigte] = useState(false);
  const [status, setStatus] = useState('');
  const neuVomServer = useRef(true);
  const angepasst = useRef(false);
  const { daten, laedt, neuLaden } = useDaten(async () => {
    const neu = neuVomServer.current;
    neuVomServer.current = false;
    const d = await api.get<StplDaten>(api.dok(`/untplanweb/stpl?von=${von}&bis=${bis}&erledigte=${erledigte}&neu=${neu}`));
    if (!angepasst.current) {
      angepasst.current = true;
      if (d.einstellungen.tage !== 14 && von === heute() && bis === plusTage(heute(), 14)) setBis(plusTage(von, d.einstellungen.tage));
    }
    setStatus(sachlich(d.status));
    return d;
  }, [von, bis, erledigte], { bereiche: ['Vertretung', 'Einstellungen'], quelle: a.id });

  const zeilen = useMemo(() => {
    const l: Aenderung[] = [];
    let letzter: string | null = null;
    for (const z of daten?.zeilen || []) {
      if (z.datumText !== letzter) { l.push({ id: `datum-${z.datumText}`, gruppe: true, datumText: z.datumText }); letzter = z.datumText; }
      l.push({ ...z, statusText: z.uebernommen === true ? 'Übernommen' : z.uebernommen === false ? 'Ignoriert' : '' });
    }
    return l;
  }, [daten]);
  const spalten: Spalte<Aenderung>[] = SPALTEN.map(([schluessel, titel, breite]) => ({
    schluessel, titel, breite, art: 'NurLesen', wert: (z) => (z.gruppe && schluessel !== 'datumText' ? '' : (z as unknown as Record<string, unknown>)[schluessel] ?? ''),
  }));

  const markieren = (pruefungen: boolean) => t.current?.markieren(zeilen.filter((z) => !z.gruppe && !z.erledigt && (pruefungen ? z.art === 'Pruefung' : z.art !== 'Pruefung')).map((z) => z.id));
  const gewaehlt = () => (t.current?.ausgewaehlte() || []).filter((z) => !z.gruppe && !z.erledigt).map((z) => z.id);
  const uebernehmen = async () => {
    const ids = gewaehlt();
    if (!ids.length) { await meldung('Bitte zuerst Änderungen markieren, z. B. mit „Buchungen markieren“.', 'Stundenplanänderungen aus UntPlan Web'); return; }
    const r = await api.post<{ text: string; abgelehnt: unknown[] }>(api.dok('/untplanweb/stpl/uebernehmen'), { ids }, { quelle: a.id });
    await neuLaden(true);
    setStatus(sachlich(r.text));
    hinweis(sachlich(r.text), r.abgelehnt.length ? 'warnung' : 'ok', 6000);
  };
  const ignorieren = async () => {
    const ids = gewaehlt();
    if (!ids.length) return;
    const r = await api.post<{ text: string }>(api.dok('/untplanweb/stpl/ignorieren'), { ids }, { quelle: a.id });
    await neuLaden(true);
    setStatus(sachlich(r.text));
  };
  const vomServer = () => { neuVomServer.current = true; void neuLaden(); };
  const einstellungen = async () => {
    if (!daten) return;
    const w = await einstellungenDialog(daten.einstellungen);
    if (!w) return;
    const e = await api.put<StplEinst>(api.dok('/untplanweb/stpl/einstellungen'), w);
    setBis(plusTage(von, e.tage));
  };

  return (
    <AnsichtRahmen titel="Stundenplanänderungen aus UntPlan Web" laden={laedt}
      werkzeuge={<>
        <Werkzeug text="Übernehmen" titel="Markierte Änderungen in den Stundenplan übernehmen" deaktiviert={!schreiben} aktion={uebernehmen} />
        <Werkzeug text="Ignorieren" titel="Markierte Änderungen nicht übernehmen" deaktiviert={!schreiben} aktion={ignorieren} />
        <Trenner />
        <Werkzeug text="Buchungen markieren" deaktiviert={!schreiben} aktion={() => markieren(false)} />
        <Werkzeug text="Prüfungen markieren" deaktiviert={!schreiben} aktion={() => markieren(true)} />
        <MenueKnopf text="Weitere Aktionen" eintraege={() => [
          { text: 'Neu vom Server laden', aktion: vomServer },
          { text: 'Einstellungen zum Import …', aktion: einstellungen },
        ]} />
      </>}
      filter={<>
        <Feld titel="Von"><Input type="date" size="small" value={von} onChange={(_, d) => { if (d.value) setVon(d.value); }} /></Feld>
        <Feld titel="Bis"><Input type="date" size="small" value={bis} onChange={(_, d) => { if (d.value) setBis(d.value); }} /></Feld>
        <Button size="small" onClick={vomServer}>Laden</Button>
        <Schalter text="Erledigte anzeigen" titel="Bereits übernommene oder ignorierte Änderungen anzeigen" an={erledigte} beiAenderung={setErledigte} />
      </>}
      fuss={<FussText>{status}</FussText>}>
      <Tabelle<Aenderung> ref={t} name="upw-stpl" zeilen={zeilen} spalten={spalten} id={(z) => z.id} sortierbar={false} zustandSchluessel="tabelle.untplanweb.stpl"
        leerText="Keine Stundenplanänderungen im gewählten Zeitraum"
        zeilenKlasse={(z) => (z.gruppe ? 'upw-datumzeile' : [z.erledigt ? 'upw-erledigt' : '', z.fehler ? 'upw-fehlerzeile' : z.art === 'Aktivitaet' ? 'upw-aktivitaet' : ''].join(' ').trim())} />
    </AnsichtRahmen>
  );
}
