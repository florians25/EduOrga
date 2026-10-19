// Ansicht „Gruppen und Rechte“ (nur Administratoren): Rechte-Matrix Gruppe × Bereich mit farbigen Stufen (direkt änderbar),
// Einzelrechte je Gruppe, Benutzerliste mit Gruppe (durchsuchbar), Einschränkungen und lesbaren wirksamen Rechten.
import {
  Avatar, Badge, Button, Checkbox, Field, Input, Menu, MenuDivider, MenuItem, MenuItemRadio, MenuList, MenuPopover, MenuTrigger, Switch,
  Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Tooltip, makeStyles, mergeClasses, tokens,
} from '@fluentui/react-components';
import {
  Add20Regular, Delete16Regular, Edit16Regular, Eye16Regular, Key16Regular, MoreHorizontal20Regular, PeopleTeam16Regular, Prohibited16Regular,
  Search16Regular, WindowEdit16Regular, type FluentIcon,
} from '@fluentui/react-icons';
import { useMemo, useState } from 'react';
import { api } from '@/api/client';
import { initialen } from '@/kern/hilfen';
import { useDaten } from '@/kern/laden';
import { AnsichtRahmen, Werkzeug } from '@/komponenten/ansicht';
import { dialogZeigen, formular, frage, StandardDialog } from '@/komponenten/dialoge';
import { Suchauswahl } from '@/komponenten/eingaben';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import './rechte.css';

interface Gruppe { id: number; name: string; rechte: string[]; stufen: Record<string, string> }
interface Zuordnung { gruppeId: number; nurLesen: boolean; abteilung: string }
interface VBenutzer { name: string; anzeigename: string; rolle: string; wirksam: string; zuordnung?: Zuordnung | null }
interface Verwaltungsdaten {
  gruppen: Gruppe[];
  benutzer: VBenutzer[];
  bereiche: { bereich: string; text: string }[];
  stufen: { stufe: string; text: string }[];
  rechteListe: { recht: string; text: string }[];
}

/** Stufen von oben nach unten (stärkste zuerst), mit Kurztext für die Matrix. */
const STUFEN: { stufe: string; kurz: string; symbol: FluentIcon; erklaerung: string }[] = [
  { stufe: 'Bearbeiten', kurz: 'Bearbeiten', symbol: Edit16Regular, erklaerung: 'Daten des Bereichs lesen und ändern' },
  { stufe: 'AnsichtenBearbeiten', kurz: 'Ansichten', symbol: WindowEdit16Regular, erklaerung: 'Lesen, dazu eigene Ansichten (Spalten, Filter, Layouts) anpassen' },
  { stufe: 'NurLesen', kurz: 'Nur lesen', symbol: Eye16Regular, erklaerung: 'Daten des Bereichs nur ansehen' },
  { stufe: 'Keine', kurz: 'Kein Zugriff', symbol: Prohibited16Regular, erklaerung: 'Bereich ist nicht sichtbar' },
];
const RANG: Record<string, number> = { Keine: 0, NurLesen: 1, AnsichtenBearbeiten: 2, Bearbeiten: 3 };
const stufeInfo = (st: string) => STUFEN.find((x) => x.stufe === st) || STUFEN[3];

const ROLLE: Record<string, { text: string; farbe: 'brand' | 'informative' | 'subtle' }> = {
  Admin: { text: 'Administration', farbe: 'brand' },
  Planer: { text: 'Planung', farbe: 'informative' },
  Leser: { text: 'Nur lesen', farbe: 'subtle' },
};

const useStile = makeStyles({
  flaeche: {
    flex: 1, overflowY: 'auto', padding: '16px 20px 28px 20px', display: 'flex', flexDirection: 'column', gap: '20px',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  karte: {
    display: 'flex', flexDirection: 'column', minWidth: 0, border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground1, boxShadow: 'var(--edo-karte-schatten)', overflow: 'hidden',
  },
  kopf: {
    display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px 16px', padding: '10px 16px', backgroundColor: 'var(--edo-kopf-flaeche)',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  h2: { margin: 0, fontSize: tokens.fontSizeBase400, lineHeight: '22px', fontWeight: tokens.fontWeightSemibold, color: tokens.colorNeutralForeground1 },
  anzahl: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  rechts: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' },
  legende: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 14px', padding: '8px 16px', borderBottom: `1px solid ${tokens.colorNeutralStroke3}`, fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground2 },
  legendeEintrag: { display: 'inline-flex', alignItems: 'center', gap: '6px' },
  matrix: { overflow: 'auto', maxHeight: '60vh' },
  gruppeName: { fontWeight: tokens.fontWeightSemibold, color: tokens.colorNeutralForeground1 },
  gruppeInfo: { display: 'flex', alignItems: 'center', gap: '4px', color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200, marginTop: '1px' },
  rechteKnopf: { minWidth: 0, fontWeight: tokens.fontWeightRegular, whiteSpace: 'nowrap' },
  hinweis: { margin: 0, padding: '8px 16px', color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200, borderBottom: `1px solid ${tokens.colorNeutralStroke3}` },
  leer: { padding: '24px 16px', color: tokens.colorNeutralForeground3 },
  tabelle: { minWidth: '980px' },
  kopfzelle: { backgroundColor: tokens.colorNeutralBackground3, fontWeight: tokens.fontWeightSemibold, position: 'sticky', top: 0, zIndex: 1 },
  person: { display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 },
  personText: { display: 'flex', flexDirection: 'column', minWidth: 0, lineHeight: '16px' },
  personName: { fontWeight: tokens.fontWeightMedium, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  personLogin: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  wirksam: { display: 'flex', flexDirection: 'column', gap: '3px' },
  wirksamText: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground2, whiteSpace: 'nowrap' },
  tipTabelle: { borderCollapse: 'collapse', fontSize: tokens.fontSizeBase200, '& td': { padding: '1px 8px 1px 0' } },
  rechteRaster: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '2px 16px', marginTop: '4px' },
  dialogText: { margin: '0 0 12px 0', color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase300 },
});

/** Wirksame Stufen eines Benutzers (wie der Server: Administrator alles, Leser lesen, Planer ohne Gruppe alles, „Nur lesen“ begrenzt). */
function wirksameStufen(b: VBenutzer, v: Verwaltungsdaten): Record<string, string> {
  const alle = (st: string) => Object.fromEntries(v.bereiche.map((x) => [x.bereich, st]));
  if (b.rolle === 'Admin') return alle('Bearbeiten');
  if (b.rolle === 'Leser') return alle('NurLesen');
  const g = v.gruppen.find((x) => x.id === b.zuordnung?.gruppeId);
  const basis = !g ? alle('Bearbeiten') : g.rechte.includes('Administrator') ? alle('Bearbeiten') : Object.fromEntries(v.bereiche.map((x) => [x.bereich, g.stufen[x.bereich] || 'Keine']));
  if (b.zuordnung?.nurLesen) for (const k of Object.keys(basis)) if (RANG[basis[k]] > 1) basis[k] = 'NurLesen';
  return basis;
}

function StufenKennzeichen({ stufe, klein, text }: { stufe: string; klein?: boolean; text?: string }) {
  const i = stufeInfo(stufe);
  return <span className={mergeClasses('mu-stufe', klein && 'klein')} data-stufe={i.stufe} style={{ cursor: 'default' }}><i.symbol />{text ?? i.kurz}</span>;
}

/** Stufe einer Zelle: farbiges Kennzeichen, Klick öffnet die Auswahl. */
function StufenWahl({ g, bereich, text, stufen, aendern }: { g: Gruppe; bereich: string; text: string; stufen: Verwaltungsdaten['stufen']; aendern: (st: string) => void }) {
  const wert = g.stufen[bereich] || 'Keine';
  const i = stufeInfo(wert);
  const langText = (st: string) => stufen.find((x) => x.stufe === st)?.text || stufeInfo(st).kurz;
  return (
    <Menu checkedValues={{ stufe: [wert] }} onCheckedValueChange={(_, d) => { const n = d.checkedItems[0]; if (n && n !== wert) aendern(n); }}>
      <MenuTrigger disableButtonEnhancement>
        <button type="button" className="mu-stufe" data-stufe={i.stufe} aria-label={`${g.name}, ${text}: ${langText(wert)} – ändern`} title={`${text}: ${langText(wert)}`}>
          <i.symbol />{i.kurz}
        </button>
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          {STUFEN.map((x) => (
            <MenuItemRadio key={x.stufe} name="stufe" value={x.stufe}>
              {langText(x.stufe)}
            </MenuItemRadio>
          ))}
        </MenuList>
      </MenuPopover>
    </Menu>
  );
}

function GruppeDialog({ g, v, schliessen }: { g: Gruppe; v: Verwaltungsdaten; schliessen: (w: Gruppe | null) => void }) {
  const s = useStile();
  const [name, setName] = useState(g.name);
  const [rechte, setRechte] = useState(new Set(g.rechte));
  return (
    <StandardDialog<boolean> titel={`Gruppe ${g.name}: Name und Einzelrechte`} breite="640px"
      knoepfe={[{ text: 'Speichern', wert: true, primaer: true, deaktiviert: !name.trim() }, { text: 'Abbrechen', wert: null }]}
      beiKnopf={(w) => schliessen(w ? { ...g, name: name.trim(), rechte: [...rechte] } : null)}>
      <Field label="Name der Gruppe" required style={{ marginBottom: 16 }}>
        <Input value={name} onChange={(_, d) => setName(d.value)} autoFocus />
      </Field>
      <p className={s.dialogText}>Die Stufen je Bereich stellen Sie direkt in der Matrix ein. Einzelrechte gelten zusätzlich, unabhängig von den Bereichen.</p>
      <div className={s.rechteRaster}>
        {v.rechteListe.map((r) => (
          <Checkbox key={r.recht} label={r.text} checked={rechte.has(r.recht)}
            onChange={(_, d) => setRechte((x) => { const n = new Set(x); if (d.checked) n.add(r.recht); else n.delete(r.recht); return n; })} />
        ))}
      </div>
    </StandardDialog>
  );
}

function WirksameRechte({ b, v }: { b: VBenutzer; v: Verwaltungsdaten }) {
  const s = useStile();
  const st = wirksameStufen(b, v);
  const zaehlen = (x: string) => v.bereiche.filter((y) => st[y.bereich] === x).length;
  const teile = [
    [zaehlen('Bearbeiten'), 'bearbeiten'], [zaehlen('AnsichtenBearbeiten'), 'Ansichten'], [zaehlen('NurLesen'), 'lesen'], [zaehlen('Keine'), 'ohne Zugriff'],
  ].filter(([n]) => (n as number) > 0).map(([n, t]) => `${n} ${t}`);
  const herkunft = b.rolle === 'Admin' ? 'Administration' : b.rolle === 'Leser' ? 'Rolle „Nur lesen“' : b.wirksam || 'ohne Gruppe';
  const inhalt = (
    <table className={s.tipTabelle}>
      <tbody>{v.bereiche.map((x) => <tr key={x.bereich}><td>{x.text}</td><td><StufenKennzeichen stufe={st[x.bereich]} klein /></td></tr>)}</tbody>
    </table>
  );
  return (
    <Tooltip content={inhalt} relationship="description" withArrow>
      <div className={s.wirksam} tabIndex={0} data-fokusring aria-label={`Wirksame Rechte: ${herkunft}, ${teile.join(', ')}`}>
        <span className={s.wirksamText}>{`${herkunft}${b.zuordnung?.nurLesen && b.rolle === 'Planer' ? ' · nur lesen' : ''} · ${teile.join(' · ')}`}</span>
      </div>
    </Tooltip>
  );
}

function BenutzerZeile({ b, v, setzen }: { b: VBenutzer; v: Verwaltungsdaten; setzen: (v: Verwaltungsdaten) => void }) {
  const s = useStile();
  const planer = b.rolle === 'Planer';
  const [abteilung, setAbteilung] = useState(b.zuordnung?.abteilung || '');
  const speichern = async (teil: Partial<Zuordnung>) => {
    const z = { gruppeId: b.zuordnung?.gruppeId || 0, nurLesen: !!b.zuordnung?.nurLesen, abteilung, ...teil };
    try { setzen(await api.put<Verwaltungsdaten>(`/api/multiuser/benutzer/${encodeURIComponent(b.name)}`, z)); hinweis('Zuordnung gespeichert.', 'ok', 2000); } catch (e) { fehlerMelden(e); }
  };
  const rolle = ROLLE[b.rolle] || { text: b.rolle, farbe: 'subtle' as const };
  const optionen = useMemo(() => [{ wert: '0', text: 'Keine Gruppe', nebentext: 'alle Bereiche' }, ...v.gruppen.map((g) => ({ wert: String(g.id), text: g.name }))], [v.gruppen]);
  return (
    <TableRow>
      <TableCell>
        <div className={s.person}>
          <Avatar size={28} name={b.anzeigename || b.name} initials={initialen(b.anzeigename || b.name)} color="colorful" />
          <div className={s.personText}><span className={s.personName}>{b.anzeigename || b.name}</span><span className={s.personLogin}>{b.name}</span></div>
        </div>
      </TableCell>
      <TableCell><Badge appearance="tint" color={rolle.farbe} shape="rounded">{rolle.text}</Badge></TableCell>
      <TableCell>
        {planer ? (
          <Suchauswahl optionen={optionen} wert={String(b.zuordnung?.gruppeId || 0)} aria-label={`Gruppe von ${b.anzeigename}`} style={{ width: 200 }}
            beiWahl={(w) => { void speichern({ gruppeId: Number(w) }); }} />
        ) : <span className={s.anzahl}>{b.rolle === 'Admin' ? 'alle Rechte' : '–'}</span>}
      </TableCell>
      <TableCell><Switch disabled={!planer} aria-label={`Nur lesen für ${b.anzeigename}`} checked={!!b.zuordnung?.nurLesen} onChange={(_, d) => { void speichern({ nurLesen: !!d.checked }); }} /></TableCell>
      <TableCell>
        <Input size="small" style={{ width: 110 }} disabled={!planer} aria-label={`Abteilung von ${b.anzeigename}`} value={abteilung} placeholder={planer ? 'alle' : ''}
          onChange={(_, d) => setAbteilung(d.value)} onBlur={() => { if (abteilung !== (b.zuordnung?.abteilung || '')) void speichern({ abteilung }); }} />
      </TableCell>
      <TableCell><WirksameRechte b={b} v={v} /></TableCell>
    </TableRow>
  );
}

export default function Verwaltung() {
  const s = useStile();
  const { daten: v, setDaten, laedt } = useDaten(() => api.get<Verwaltungsdaten>('/api/multiuser/verwaltung'), []);
  const [suche, setSuche] = useState('');
  const setzen = (x: Verwaltungsdaten | null | undefined | void) => { if (x) setDaten(x); };

  const gruppeSpeichern = async (g: Gruppe, teil: Partial<Gruppe>) => {
    const neu = { ...g, ...teil };
    setzen(await api.put<Verwaltungsdaten>(`/api/multiuser/gruppen/${g.id}`, { name: neu.name, rechte: neu.rechte, stufen: neu.stufen }).catch(fehlerMelden));
  };
  const neueGruppe = async () => {
    const w = await formular('Neue Gruppe', [{ name: 'name', titel: 'Gruppenname', pflicht: true, hinweis: 'Alle Bereiche beginnen mit „Nur lesen“.' }]);
    if (w && v) setzen(await api.post<Verwaltungsdaten>('/api/multiuser/gruppen', { name: w.name, rechte: [], stufen: Object.fromEntries(v.bereiche.map((b) => [b.bereich, 'NurLesen'])) }).catch(fehlerMelden));
  };
  const bearbeiten = async (g: Gruppe) => {
    if (!v) return;
    const neu = await dialogZeigen<Gruppe>((schliessen) => <GruppeDialog g={g} v={v} schliessen={schliessen} />);
    if (neu) await gruppeSpeichern(g, { name: neu.name, rechte: neu.rechte });
  };
  const alleSetzen = (g: Gruppe, st: string) => gruppeSpeichern(g, { stufen: Object.fromEntries((v?.bereiche || []).map((b) => [b.bereich, st])) });
  const loeschen = async (g: Gruppe) => {
    if (await frage(`Gruppe „${g.name}“ löschen? Zugeordnete Benutzer haben danach keine Gruppe mehr.`, { gefahr: true, ja: 'Löschen' })) {
      setzen(await api.loeschen<Verwaltungsdaten>(`/api/multiuser/gruppen/${g.id}`).catch(fehlerMelden));
    }
  };

  const mitglieder = (g: Gruppe) => (v?.benutzer || []).filter((b) => b.rolle === 'Planer' && b.zuordnung?.gruppeId === g.id).length;
  const benutzer = useMemo(() => {
    const q = suche.trim().toLowerCase();
    const liste = v?.benutzer || [];
    if (!q) return liste;
    return liste.filter((b) => [b.name, b.anzeigename, b.wirksam, ROLLE[b.rolle]?.text || b.rolle].some((x) => (x || '').toLowerCase().includes(q)));
  }, [v, suche]);

  return (
    <AnsichtRahmen titel="Gruppen und Rechte" laden={laedt && !v} werkzeuge={<Werkzeug text="Neue Gruppe …" icon={<Add20Regular />} aktion={neueGruppe} />}>
      {v ? (
        <div className={s.flaeche}>
          <section className={s.karte} aria-label="Gruppen">
            <div className={s.kopf}>
              <h2 className={s.h2}>Rechte der Gruppen</h2>
              <span className={s.anzahl}>{v.gruppen.length === 1 ? '1 Gruppe' : `${v.gruppen.length} Gruppen`} · {v.bereiche.length} Bereiche</span>
            </div>
            <div className={s.legende} aria-label="Legende">
              {STUFEN.map((x) => <span key={x.stufe} className={s.legendeEintrag} title={x.erklaerung}><StufenKennzeichen stufe={x.stufe} klein /><span>{x.erklaerung}</span></span>)}
            </div>
            {v.gruppen.length ? (
              <div className={s.matrix}>
                <table className="mu-matrix" aria-label="Rechte der Gruppen je Bereich">
                  <thead>
                    <tr>
                      <th className="mu-gruppe" scope="col">Gruppe</th>
                      {v.bereiche.map((b) => <th key={b.bereich} scope="col">{b.text}</th>)}
                      <th scope="col">Einzelrechte</th>
                      <th scope="col"><span className="visually-hidden" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Aktionen</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.gruppen.map((g) => {
                      const n = mitglieder(g);
                      const rechteText = g.rechte.map((r) => v.rechteListe.find((x) => x.recht === r)?.text || r).join(', ');
                      return (
                        <tr key={g.id} data-gruppe={g.name}>
                          <th className="mu-gruppe" scope="row">
                            <div className={s.gruppeName}>{g.name}</div>
                            <div className={s.gruppeInfo}><PeopleTeam16Regular />{n === 1 ? '1 Benutzer' : `${n} Benutzer`}</div>
                          </th>
                          {v.bereiche.map((b) => (
                            <td key={b.bereich} className="mu-bereich">
                              <StufenWahl g={g} bereich={b.bereich} text={b.text} stufen={v.stufen}
                                aendern={(st) => { void gruppeSpeichern(g, { stufen: { ...g.stufen, [b.bereich]: st } }); }} />
                            </td>
                          ))}
                          <td>
                            <Tooltip content={rechteText || 'Keine Einzelrechte'} relationship="description">
                              <Button size="small" appearance="subtle" className={s.rechteKnopf} icon={<Key16Regular />} onClick={() => { void bearbeiten(g); }}>
                                {`${g.rechte.length} von ${v.rechteListe.length}`}
                              </Button>
                            </Tooltip>
                          </td>
                          <td className="mu-aktionen">
                            <Menu>
                              <MenuTrigger disableButtonEnhancement>
                                <Button size="small" appearance="subtle" icon={<MoreHorizontal20Regular />} aria-label={`Aktionen für ${g.name}`} />
                              </MenuTrigger>
                              <MenuPopover>
                                <MenuList>
                                  <MenuItem icon={<Edit16Regular />} onClick={() => { void bearbeiten(g); }}>Name und Einzelrechte …</MenuItem>
                                  <MenuDivider />
                                  {STUFEN.map((x) => <MenuItem key={x.stufe} onClick={() => { void alleSetzen(g, x.stufe); }}>{`Alle Bereiche: ${v.stufen.find((y) => y.stufe === x.stufe)?.text || x.kurz}`}</MenuItem>)}
                                  <MenuDivider />
                                  <MenuItem icon={<Delete16Regular />} onClick={() => { void loeschen(g); }}>Gruppe löschen …</MenuItem>
                                </MenuList>
                              </MenuPopover>
                            </Menu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <div className={s.leer}>Noch keine Gruppen angelegt. Ohne Gruppe dürfen Planer alle Bereiche bearbeiten.</div>}
          </section>

          <section className={s.karte} aria-label="Benutzer">
            <div className={s.kopf}>
              <h2 className={s.h2}>Benutzer</h2>
              <span className={s.anzahl}>{benutzer.length === v.benutzer.length ? `${v.benutzer.length} Benutzer` : `${benutzer.length} von ${v.benutzer.length} Benutzern`}</span>
              <div className={s.rechts}>
                <Input size="small" contentBefore={<Search16Regular />} placeholder="Benutzer suchen" aria-label="Benutzer suchen" value={suche} onChange={(_, d) => setSuche(d.value)} style={{ width: 240 }} />
              </div>
            </div>
            <p className={s.hinweis}>Administratoren haben immer alle Rechte, die Rolle „Nur lesen“ liest nur. Planer ohne Gruppe dürfen alle Bereiche bearbeiten; „Nur lesen“ und eine Abteilung schränken weiter ein.</p>
            <div style={{ overflowX: 'auto' }}>
              <Table size="small" aria-label="Benutzer" className={s.tabelle}>
                <TableHeader>
                  <TableRow>
                    {[['Benutzer', 240], ['Rolle', 130], ['Gruppe', 220], ['Nur lesen', 90], ['Abteilung', 130], ['Wirksame Rechte', undefined]].map(([x, w]) => (
                      <TableHeaderCell key={String(x)} className={s.kopfzelle} style={w ? { width: Number(w) } : undefined}>{x}</TableHeaderCell>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>{benutzer.map((b) => <BenutzerZeile key={`${b.name}|${b.zuordnung?.abteilung || ''}`} b={b} v={v} setzen={setDaten} />)}</TableBody>
              </Table>
              {!benutzer.length ? <div className={s.leer}>Kein Benutzer passt zur Suche.</div> : null}
            </div>
          </section>
        </div>
      ) : null}
    </AnsichtRahmen>
  );
}
