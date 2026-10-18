// Vormerkungen: beiseitegelegte Stunden; offene Vormerkungen lassen sich in einen Tagesplan ziehen (dnd-kit) oder am
// Planungsdatum verplanen.
import { useDraggable } from '@dnd-kit/core';
import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import { ReOrderDotsVertical16Regular } from '@fluentui/react-icons';
import { useState } from 'react';
import { api } from '@/api/client';
import { useAnsicht } from '@/kern/ansichten';
import { useDaten } from '@/kern/laden';
import { useDarfSchreiben } from '@/kern/zustand';
import { AnsichtRahmen, Rechts, Schalter, Werkzeug } from '@/komponenten/ansicht';
import { formular, frage } from '@/komponenten/dialoge';
import type { ZiehDaten } from '@/komponenten/ziehen';
import { datumText, planungsdatum, vpfad } from './kern';

interface Vormerkung { id: number; herkunft: string; stunden: number; offen: number; fach: string; lehrer: string; klassen: string; raum: string; urspruenglich: string; gueltig: string; text: string; verplant: string }

const useStile = makeStyles({
  rollen: { flex: 1, overflow: 'auto' },
  zeile: { cursor: 'default' },
  gewaehlt: { backgroundColor: tokens.colorBrandBackground2, ':hover': { backgroundColor: tokens.colorBrandBackground2Hover } },
  leise: { color: tokens.colorNeutralForeground3 },
  griff: { cursor: 'grab', color: tokens.colorNeutralForeground3, display: 'inline-flex', touchAction: 'none' },
  z: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  leer: { padding: '24px', color: tokens.colorNeutralForeground3, textAlign: 'center' },
});

function Zeile({ v, aktiv, waehlen, ziehbar }: { v: Vormerkung; aktiv: boolean; waehlen: () => void; ziehbar: boolean }) {
  const s = useStile();
  const daten: ZiehDaten = { art: 'vormerkung', id: v.id, vorschau: () => <div className="ra-vorschau"><b>{v.fach}</b> {v.klassen} · {v.lehrer}</div> };
  const { setNodeRef, listeners, attributes } = useDraggable({ id: `vm|${v.id}`, data: daten, disabled: !ziehbar });
  const zahl = (x: number) => <TableCell className={s.z}>{String(x)}</TableCell>;
  return (
    <TableRow className={mergeClasses(s.zeile, aktiv && s.gewaehlt, !v.offen && s.leise)} onClick={waehlen} data-vormerkung={v.id}>
      <TableCell>{ziehbar ? <span ref={setNodeRef} {...listeners} {...attributes} className={s.griff} title="In einen Tagesplan ziehen, um die Vormerkung zu verplanen"><ReOrderDotsVertical16Regular /></span> : null}</TableCell>
      {zahl(v.id)}<TableCell>{v.herkunft}</TableCell>{zahl(v.stunden)}{zahl(v.offen)}<TableCell>{v.fach}</TableCell><TableCell>{v.lehrer}</TableCell>
      <TableCell>{v.klassen}</TableCell><TableCell>{v.raum}</TableCell><TableCell>{v.urspruenglich}</TableCell><TableCell>{v.gueltig}</TableCell><TableCell>{v.text}</TableCell><TableCell>{v.verplant}</TableCell>
    </TableRow>
  );
}

export default function Vormerkungen() {
  const s = useStile();
  const a = useAnsicht();
  const schreiben = useDarfSchreiben();
  const [alle, setAlle] = useState(false);
  const [aktiv, setAktiv] = useState<number | null>(null);
  const { daten, neuLaden } = useDaten(() => api.get<Vormerkung[]>(vpfad(`/vormerkungen?alle=${alle}`)), [alle], { bereiche: ['Vertretung', 'Stundenplan'] });
  const v = (daten || []).find((x) => x.id === aktiv) || null;
  return (
    <AnsichtRahmen titel="Vormerkungen"
      werkzeuge={<>
        {schreiben ? <>
          <Werkzeug text="Neu" titel="Neue Vormerkung" aktion={async () => {
            const w = await formular('Neue Vormerkung', [{ name: 'fach', titel: 'Fach' }, { name: 'lehrer', titel: 'Lehrkraft' }, { name: 'klassen', titel: 'Klassen' }, { name: 'raum', titel: 'Raum' }, { name: 'stunden', titel: 'Stunden', art: 'zahl', wert: 1 }, { name: 'text', titel: 'Text' }], { okText: 'Anlegen' });
            if (!w) return;
            await api.post(vpfad('/vormerkungen'), { ...w, stunden: Number(w.stunden) || 1 }, { quelle: a.id });
            await neuLaden(true);
          }} />
          <Werkzeug text="Verplanen …" titel="Markierte Vormerkung am Planungsdatum verplanen" aktion={async () => {
            if (!v) return;
            const w = await formular(`Vormerkung am ${datumText(planungsdatum())} verplanen`, [{ name: 'stunde', titel: 'Stunde', art: 'zahl', wert: 1, pflicht: true }], { okText: 'Verplanen' });
            if (!w) return;
            await api.post(vpfad(`/vormerkungen/${v.id}/verplanen`), { datum: planungsdatum(), stunde: Number(w.stunde) }, { quelle: a.id });
            await neuLaden(true);
          }} />
          <Werkzeug text="Löschen" titel="Markierte Vormerkung löschen" aktion={async () => {
            if (!v || !(await frage(`Vormerkung ${v.id} löschen?`, { gefahr: true, ja: 'Löschen', nein: 'Abbrechen' }))) return;
            await api.post(vpfad('/vormerkungen/loeschen'), { ids: [v.id] }, { quelle: a.id });
            await neuLaden(true);
          }} />
        </> : null}
        <Rechts><Schalter text="Auch verplante" an={alle} beiAenderung={setAlle} titel="Auch vollständig verplante Vormerkungen zeigen" /></Rechts>
      </>}
      fuss={<span>Zum Verplanen eine Vormerkung am Griff in einen Tagesplan ziehen.</span>}>
      <div className={s.rollen}>
        <Table size="small" aria-label="Vormerkungen">
          <TableHeader><TableRow>
            <TableHeaderCell style={{ width: 32 }} />
            {[['Nr.', 52], ['Herkunft', 90], ['Std.', 48], ['Offen', 52], ['Fach', 60], ['Lehrkraft', 80], ['Klassen', 86], ['Raum', 60], ['Ursprünglich', 120], ['Gültig', 140], ['Text', 0], ['Verplant am', 120]]
              .map(([t, b]) => <TableHeaderCell key={String(t)} style={b ? { width: Number(b) } : undefined}>{t}</TableHeaderCell>)}
          </TableRow></TableHeader>
          <TableBody>
            {(daten || []).map((x) => <Zeile key={x.id} v={x} aktiv={x.id === aktiv} waehlen={() => setAktiv(x.id)} ziehbar={schreiben && x.offen > 0} />)}
          </TableBody>
        </Table>
        {daten && !daten.length ? <div className={s.leer}>Es gibt keine offenen Vormerkungen.</div> : null}
      </div>
    </AnsichtRahmen>
  );
}
