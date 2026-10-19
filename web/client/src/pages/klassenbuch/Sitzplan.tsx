// Sitzplan einer Klasse (#/sitzplan/<Klasse>): Anordnung der Schüler*innen, Bearbeiten (Klassenleitung, Administration), Drucken
// und die persönlichen Klassenbuch-Einstellungen (Namen, Sortierung). Der Klassen-Sitzplan gilt in jedem Unterricht der Klasse.
import { useState } from 'react';
import { Alert, Button, IconButton, Tooltip } from '@mui/material';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import { holen } from '../../api/client';
import { useSitzung } from '../../app/sitzung';
import { Geladen, Leer, Seite } from '../../components/Seite';
import { ElementWahl } from '../../components/Auswahl';
import { EinstellungenPanel, kbEinstellungen, SchuelerKarte, sitzplanPdf, SitzplanAnordnung, SitzplanEditor, type SitzDaten, type Schueler, type Sitzplan as Plan } from '../../components/klassenbuch/sitzplan';
import { link, navigieren } from '../../lib/router';
import { useLaden } from '../../lib/useLaden';
import type { SeitenProps } from '../register';

export default function Sitzplan({ teile }: SeitenProps) {
  const { ich, elemente } = useSitzung();
  const [w, setW] = useState(kbEinstellungen);
  const [editor, setEditor] = useState(false);
  const [panel, setPanel] = useState(false);
  const g = useLaden(async sig => {
    const el = await elemente();
    const eigene = el.klassen.find(k => ich.element && (k.leitung ?? []).some(l => l.toLowerCase() === ich.element.toLowerCase()))?.kurz;
    const klasse = teile[0] && teile[0] !== '-' ? teile[0] : eigene ?? el.klassen[0]?.kurz ?? '';
    if (!klasse) return { el, klasse, r: null };
    const r = await holen<{ schueler: Schueler[]; plan: Plan; verwalten: boolean }>(`/api/app/sitzplan/${encodeURIComponent(klasse)}`, sig);
    return { el, klasse, r };
  }, [teile[0]]);
  const klasse = g.daten?.klasse ?? '';
  const r = g.daten?.r;
  const d: SitzDaten | null = r ? { kontext: { klasse, klassen: [klasse] }, schueler: r.schueler, gueltig: r.plan.vorhanden ? r.plan : null, plaene: { klasse: r.plan.vorhanden ? r.plan : null }, rechte: { klasse: r.verwalten } } : null;
  return (
    <Seite titel={klasse ? `Sitzplan ${klasse}` : 'Sitzplan'} aktionen={r && <>
      {r.verwalten && <Button variant="contained" onClick={() => setEditor(true)}>Sitzplan bearbeiten</Button>}
      <Button variant="outlined" disabled={!d?.gueltig} onClick={() => d?.gueltig && sitzplanPdf({ ...d.gueltig, bereich: 'klasse', klasse, klassen: [klasse], belegung: d.gueltig.belegung ?? {}, titel: `Sitzplan ${klasse}`, vornameZuerst: w.namen === 'vorname', kurz: w.namen === 'kurz', klasseZeigen: w.klasseZeigen })}>Drucken</Button>
      <Tooltip title="Klassenbuch-Einstellungen"><IconButton onClick={() => setPanel(true)} aria-label="Klassenbuch-Einstellungen"><SettingsOutlined /></IconButton></Tooltip>
    </>}
      filter={g.daten && <ElementWahl liste={g.daten.el.klassen} wert={klasse} onWahl={k => navigieren(link('sitzplan', k))} platzhalter="Klasse wählen" breite={180} />}>
      <Geladen g={g}>{({ r }) => {
        if (!r || !d) return <Leer text="Keine Klassen vorhanden." />;
        if (!r.schueler.length) return <Leer text="Für diese Klasse wurde keine Schülerliste aus EduOrga Studio übertragen." />;
        return d.gueltig
          ? <SitzplanAnordnung d={d} schueler={r.schueler} w={w} kachel={s => <SchuelerKarte s={s} w={w} />} />
          : <Alert severity="info" action={r.verwalten && <Button onClick={() => setEditor(true)}>Sitzplan erstellen</Button>}>Für die Klasse {klasse} ist noch kein Sitzplan hinterlegt.</Alert>;
      }}</Geladen>
      {d && editor && <SitzplanEditor offen zu={() => setEditor(false)} d={d} kontext={{ klasse, klassen: [klasse] }} titel={`Sitzplan ${klasse}`} untertitel={`Klasse ${klasse} · gilt in jedem Unterricht der Klasse`} bereich="klasse"
        onGespeichert={() => { setEditor(false); void g.neu(); }} />}
      <EinstellungenPanel offen={panel} zu={() => setPanel(false)} onAendern={setW} sitzplan={r?.verwalten ? { darf: true, onOeffnen: () => { setPanel(false); setEditor(true); } } : null} />
    </Seite>
  );
}
