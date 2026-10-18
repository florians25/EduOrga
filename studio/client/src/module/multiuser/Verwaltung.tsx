// Ansicht „Gruppen und Rechte“ (nur Administratoren): Gruppen mit Rechtestufen je Bereich und Einzelrechten, Zuordnung der Benutzer.
import {
  Button, Checkbox, Input, Select, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, mergeClasses,
} from '@fluentui/react-components';
import { useState } from 'react';
import { api } from '@/api/client';
import { useDaten } from '@/kern/laden';
import { AnsichtRahmen, Werkzeug } from '@/komponenten/ansicht';
import { dialogZeigen, formular, frage, StandardDialog } from '@/komponenten/dialoge';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { useMuStile } from './stile';

interface Gruppe { id: number; name: string; rechte: string[]; stufen: Record<string, string> }
interface VBenutzer { name: string; anzeigename: string; rolle: string; wirksam: string; zuordnung?: { gruppeId: number; nurLesen: boolean; abteilung: string } | null }
interface Verwaltungsdaten {
  gruppen: Gruppe[];
  benutzer: VBenutzer[];
  bereiche: { bereich: string; text: string }[];
  stufen: { stufe: string; text: string }[];
  rechteListe: { recht: string; text: string }[];
}

function GruppeDialog({ g, v, schliessen }: { g: Gruppe; v: Verwaltungsdaten; schliessen: (w: Gruppe | null) => void }) {
  const s = useMuStile();
  const [name, setName] = useState(g.name);
  const [rechte, setRechte] = useState(new Set(g.rechte));
  const [stufen, setStufen] = useState<Record<string, string>>(() => Object.fromEntries(v.bereiche.map((b) => [b.bereich, g.stufen[b.bereich] ?? v.stufen[0]?.stufe ?? ''])));
  return (
    <StandardDialog<boolean> titel={`Gruppe ${g.name} bearbeiten`} breite="760px"
      knoepfe={[{ text: 'Speichern', wert: true, primaer: true }, { text: 'Abbrechen', wert: null }]}
      beiKnopf={(w) => schliessen(w ? { ...g, name, rechte: [...rechte], stufen } : null)}>
      <div className={s.formular} style={{ marginBottom: 16 }}>
        <label htmlFor="mu-gruppe-name">Name</label>
        <Input id="mu-gruppe-name" value={name} onChange={(_, d) => setName(d.value)} />
      </div>
      <div className={s.spalten}>
        <div>
          <h3 className={s.h3}>Rechtestufen je Bereich</h3>
          <div className={s.formular} style={{ marginTop: 8 }}>
            {v.bereiche.map((b) => [
              <label key={`l${b.bereich}`}>{b.text}</label>,
              <Select key={`s${b.bereich}`} size="small" aria-label={b.text} value={stufen[b.bereich]} onChange={(_, d) => setStufen((x) => ({ ...x, [b.bereich]: d.value }))}>
                {v.stufen.map((st) => <option key={st.stufe} value={st.stufe}>{st.text}</option>)}
              </Select>,
            ])}
          </div>
        </div>
        <div>
          <h3 className={s.h3}>Rechte</h3>
          <div className={s.rechte} style={{ marginTop: 8 }}>
            {v.rechteListe.map((r) => (
              <Checkbox key={r.recht} label={r.text} checked={rechte.has(r.recht)}
                onChange={(_, d) => setRechte((x) => { const n = new Set(x); if (d.checked) n.add(r.recht); else n.delete(r.recht); return n; })} />
            ))}
          </div>
        </div>
      </div>
    </StandardDialog>
  );
}

function BenutzerZeile({ b, v, setzen }: { b: VBenutzer; v: Verwaltungsdaten; setzen: (v: Verwaltungsdaten) => void }) {
  const s = useMuStile();
  const planer = b.rolle === 'Planer';
  const [abteilung, setAbteilung] = useState(b.zuordnung?.abteilung || '');
  const speichern = async (teil: Partial<{ gruppeId: number; nurLesen: boolean; abteilung: string }>) => {
    const z = { gruppeId: b.zuordnung?.gruppeId || 0, nurLesen: !!b.zuordnung?.nurLesen, abteilung, ...teil };
    try { setzen(await api.put<Verwaltungsdaten>(`/api/multiuser/benutzer/${encodeURIComponent(b.name)}`, z)); hinweis('Zuordnung gespeichert.', 'ok', 2000); } catch (e) { fehlerMelden(e); }
  };
  return (
    <TableRow>
      <TableCell>{b.anzeigename}<span className={s.leise}>{` (${b.name})`}</span></TableCell>
      <TableCell>{b.rolle}</TableCell>
      <TableCell>
        <Select size="small" disabled={!planer} aria-label={`Gruppe von ${b.anzeigename}`} value={String(b.zuordnung?.gruppeId || 0)} onChange={(_, d) => speichern({ gruppeId: Number(d.value) })}>
          <option value="0">Keine Gruppe</option>
          {v.gruppen.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </Select>
      </TableCell>
      <TableCell><Checkbox disabled={!planer} aria-label="Nur lesen" checked={!!b.zuordnung?.nurLesen} onChange={(_, d) => speichern({ nurLesen: !!d.checked })} /></TableCell>
      <TableCell>
        <Input size="small" style={{ width: 100 }} disabled={!planer} aria-label="Abteilung" value={abteilung}
          onChange={(_, d) => setAbteilung(d.value)} onBlur={() => { if (abteilung !== (b.zuordnung?.abteilung || '')) void speichern({ abteilung }); }} />
      </TableCell>
      <TableCell className={s.leise}>{b.wirksam}</TableCell>
    </TableRow>
  );
}

export default function Verwaltung() {
  const s = useMuStile();
  const { daten: v, setDaten, laedt } = useDaten(() => api.get<Verwaltungsdaten>('/api/multiuser/verwaltung'), []);
  const setzen = (x: Verwaltungsdaten | null | undefined | void) => { if (x) setDaten(x); };

  const neueGruppe = async () => {
    const w = await formular('Neue Gruppe', [{ name: 'name', titel: 'Gruppenname', pflicht: true }]);
    if (w) setzen(await api.post<Verwaltungsdaten>('/api/multiuser/gruppen', { name: w.name, rechte: [], stufen: {} }).catch(fehlerMelden));
  };
  const bearbeiten = async (g: Gruppe) => {
    if (!v) return;
    const neu = await dialogZeigen<Gruppe>((schliessen) => <GruppeDialog g={g} v={v} schliessen={schliessen} />);
    if (neu) setzen(await api.put<Verwaltungsdaten>(`/api/multiuser/gruppen/${g.id}`, { name: neu.name, rechte: neu.rechte, stufen: neu.stufen }).catch(fehlerMelden));
  };
  const loeschen = async (g: Gruppe) => {
    if (await frage(`Gruppe „${g.name}“ löschen?`, { gefahr: true, ja: 'Löschen' })) setzen(await api.loeschen<Verwaltungsdaten>(`/api/multiuser/gruppen/${g.id}`).catch(fehlerMelden));
  };

  return (
    <AnsichtRahmen titel="Gruppen und Rechte" laden={laedt && !v} werkzeuge={<Werkzeug text="Neue Gruppe …" aktion={neueGruppe} />}>
      {v ? (
        <div className={s.flaeche}>
          <section className={s.abschnitt} aria-label="Gruppen">
            <div className={s.kopf}><h3 className={s.h3}>Gruppen</h3></div>
            {v.gruppen.length ? (
              <Table size="small" aria-label="Gruppen">
                <TableHeader><TableRow>
                  <TableHeaderCell>Gruppe</TableHeaderCell>
                  {v.bereiche.map((b) => <TableHeaderCell key={b.bereich}>{b.text}</TableHeaderCell>)}
                  <TableHeaderCell>Rechte</TableHeaderCell><TableHeaderCell />
                </TableRow></TableHeader>
                <TableBody>
                  {v.gruppen.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell><b>{g.name}</b></TableCell>
                      {v.bereiche.map((b) => <TableCell key={b.bereich}>{v.stufen.find((x) => x.stufe === g.stufen[b.bereich])?.text || ''}</TableCell>)}
                      <TableCell className={s.leise} title={g.rechte.map((r) => v.rechteListe.find((x) => x.recht === r)?.text || r).join(', ')}>
                        {g.rechte.length === 1 ? '1 Recht' : `${g.rechte.length} Rechte`}
                      </TableCell>
                      <TableCell className={s.aktion}>
                        <Button size="small" onClick={() => bearbeiten(g)}>Bearbeiten …</Button>{' '}
                        <Button size="small" appearance="subtle" onClick={() => loeschen(g)}>Löschen</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <p className={mergeClasses(s.text, s.leise)}>Noch keine Gruppen angelegt.</p>}
          </section>
          <section className={s.abschnitt} aria-label="Benutzer">
            <div className={s.kopf}><h3 className={s.h3}>Benutzer</h3></div>
            <p className={mergeClasses(s.text, s.leise)}>Administratoren haben immer alle Rechte, Leser lesen nur. Planer ohne Gruppe dürfen alle Bereiche bearbeiten.</p>
            <Table size="small" aria-label="Benutzer">
              <TableHeader><TableRow>{['Benutzer', 'Rolle', 'Gruppe', 'Nur lesen', 'Abteilung', 'Wirksame Rechte'].map((x) => <TableHeaderCell key={x}>{x}</TableHeaderCell>)}</TableRow></TableHeader>
              <TableBody>{v.benutzer.map((b) => <BenutzerZeile key={b.name} b={b} v={v} setzen={setDaten} />)}</TableBody>
            </Table>
          </section>
        </div>
      ) : null}
    </AnsichtRahmen>
  );
}
