// Pausenaufsichten: Wochenplan nach Aufsichtsbereich bzw. Lehrkraft (Matrix Tage × Aufsichtspausen), Liste der Lehrkräfte
// mit Soll/Ist, Vorschlag mit Bewertung, Eingeben/Entfernen/Teilen, „keine Aufsicht“, automatische Einteilung, Gewichtung.
import { Button, Tab, TabList, mergeClasses } from '@fluentui/react-components';
import { useState, type MouseEvent } from 'react';
import { api } from '@/api/client';
import { useAnsicht } from '@/kern/ansichten';
import { useDaten } from '@/kern/laden';
import { useDarfSchreiben } from '@/kern/zustand';
import { AnsichtRahmen, ElementAuswahl, FussText, Ladeanzeige, Leer, Rechts, Trenner, Werkzeug } from '@/komponenten/ansicht';
import { frage } from '@/komponenten/dialoge';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { MenueKnopf, menue, type MenueListe } from '@/komponenten/menue';
import { eingebenDialog, gewichtungDialog, optimierenDialog, vorschlagDialog, type Vorschlag } from './dialoge';
import './pausenaufsicht.css';

type Sicht = 'gang' | 'lehrer';
interface Zelle { nach: number; text: string; keine?: boolean; offen?: boolean; schlecht?: string[]; moeglich?: boolean; teile: number }
interface Plan {
  minuten: string;
  spalten: { name: string; zeit: string; minuten: number }[];
  tage: { tag: number; name: string; zellen: Zelle[] }[];
  lehrer: { id: number; kurz: string; max: number; ist: number; anzahl: number; vertretungen: number; differenz: number; ueber?: boolean; geschlecht: string }[];
}
interface Liste { gaenge: { id: number; kurz: string }[]; lehrer: { id: number; kurz: string }[] }

export default function Wochenplan() {
  const a = useAnsicht();
  const schreiben = useDarfSchreiben();
  const sicht: Sicht = a.p.sicht === 'lehrer' ? 'lehrer' : 'gang';
  const [akt, setAkt] = useState<{ tag: number; nach: number } | null>(null);
  const bereiche = ['Stammdaten', 'Stundenplan', 'Einstellungen', 'Vertretung'] as const;
  const { daten: liste } = useDaten(() => api.get<Liste>(api.dok('/pausenaufsicht')), [], { bereiche: [...bereiche] });
  const elemente = (sicht === 'gang' ? liste?.gaenge : liste?.lehrer) || [];
  const gewuenscht = Number(a.p.element) || 0;
  const element = elemente.some((x) => x.id === gewuenscht) ? gewuenscht : elemente[0]?.id || 0;
  const { daten, setDaten, laedt, neuLaden } = useDaten(
    () => (element ? api.get<Plan>(api.dok(`/pausenaufsicht/${sicht}/${element}`)) : Promise.resolve(null)),
    [sicht, element], { bereiche: [...bereiche], quelle: a.id });

  const zelle = daten && akt ? daten.tage.find((t) => t.tag === akt.tag)?.zellen.find((z) => z.nach === akt.nach) : null;
  const nurBereich = () => { if (sicht !== 'gang') { hinweis('Aufsichten lassen sich nur in der Ansicht „Nach Aufsichtsbereich“ bearbeiten.', 'warnung'); return false; } return true; };
  const mitAuswahl = () => { if (!akt) { hinweis('Bitte zuerst eine Aufsicht wählen.', 'warnung'); return false; } return true; };
  const los = (f: () => Promise<unknown>) => () => { f().catch(fehlerMelden); };

  const eingeben = los(async () => {
    if (!nurBereich() || !mitAuswahl() || !akt) return;
    const t = await eingebenDialog(zelle?.text || '');
    if (t === null) return;
    setDaten(await api.put<Plan>(api.dok('/pausenaufsicht/zelle'), { gang: element, tag: akt.tag, nach: akt.nach, lehrer: t }, { quelle: a.id }));
  });
  const entfernen = los(async () => {
    if (!akt) return;
    await api.post(api.dok('/pausenaufsicht/loeschen'), { sicht, id: element, tag: akt.tag, nach: akt.nach }, { quelle: a.id });
    await neuLaden(true);
  });
  const teile = (delta: number) => los(async () => {
    if (!nurBereich() || !mitAuswahl() || !akt) return;
    setDaten(await api.post<Plan>(api.dok('/pausenaufsicht/teile'), { gang: element, tag: akt.tag, nach: akt.nach, delta }, { quelle: a.id }));
  });
  const vorschlag = los(async () => {
    if (!nurBereich() || !mitAuswahl() || !akt) return;
    const v = await api.get<Vorschlag>(api.dok(`/pausenaufsicht/vorschlag?gang=${element}&tag=${akt.tag}&nach=${akt.nach}`));
    const lehrer = await vorschlagDialog(v);
    if (lehrer == null) return;
    setDaten(await api.post<Plan>(api.dok('/pausenaufsicht/zuordnen'), { gang: element, tag: akt.tag, nach: akt.nach, lehrer }, { quelle: a.id }));
  });
  const optimieren = los(async () => {
    const w = await optimierenDialog(sicht === 'gang');
    if (!w) return;
    const r = await api.post<{ text: string }>(api.dok('/pausenaufsicht/optimieren'), { schlechteLoeschen: w.schlechteLoeschen, gang: w.nurBereich ? element : null, kuerzestePause: w.kuerzestePause });
    hinweis(r.text, 'ok');
    await neuLaden(true);
  });
  const allesLoeschen = (alle: boolean) => los(async () => {
    if (!(await frage(alle ? 'Alle Pausenaufsichten löschen?' : 'Alle Aufsichten dieses Eintrags löschen?', { gefahr: true, ja: 'Löschen', nein: 'Abbrechen' }))) return;
    await api.post(api.dok('/pausenaufsicht/loeschen'), alle ? { sicht: 'alle', id: 0 } : { sicht, id: element });
    await neuLaden(true);
  });
  const bereicheOeffnen = () => a.oeffnen('stammdaten', { typ: 'gang' });

  const zellmenue = (z: Zelle): MenueListe => [
    { text: 'Vorschlag …', aktion: vorschlag },
    { text: 'Eingeben …', aktion: eingeben },
    { text: 'Aufsicht entfernen', aktion: entfernen },
    null,
    { text: z.keine ? 'Aufsicht wieder einplanen' : 'Keine Aufsicht', aktion: teile(0) },
    { text: 'Aufsicht teilen', aktion: teile(1) },
    { text: 'Teilung entfernen', aktion: teile(-1), deaktiviert: z.teile < 2 },
  ];
  const kontext = (e: MouseEvent, tag: number, z: Zelle) => {
    e.preventDefault();
    setAkt({ tag, nach: z.nach });
    if (sicht === 'gang' && schreiben) setTimeout(() => menue(e.clientX, e.clientY, zellmenue(z)));
  };

  const ohneAuswahl = sicht !== 'gang' || !akt;
  return (
    <AnsichtRahmen titel="Pausenaufsichten"
      aktionen={<TabList size="small" selectedValue={sicht} onTabSelect={(_, d) => { setAkt(null); a.parameterSetzen({ sicht: d.value as string, element: null }); }}>
        <Tab value="gang">Nach Aufsichtsbereich</Tab><Tab value="lehrer">Nach Lehrkraft</Tab>
      </TabList>}
      werkzeuge={<>
        <ElementAuswahl typ={sicht === 'gang' ? 'gang' : 'lehrer'} titel={sicht === 'gang' ? 'Bereich' : 'Lehrkraft'} liste={elemente.map((x) => ({ id: x.id, k: x.kurz, l: '' }))} wert={element || null}
          beiWahl={(id) => { setAkt(null); a.parameterSetzen({ element: id }); }} />
        <Trenner />
        {schreiben ? <>
          <Werkzeug text="Vorschlag …" titel="Lehrkräfte für die gewählte Aufsicht mit Bewertung vorschlagen" aktion={vorschlag} deaktiviert={ohneAuswahl} />
          <Werkzeug text="Entfernen" titel="Gewählte Aufsicht entfernen" aktion={entfernen} deaktiviert={!akt} />
          <MenueKnopf text="Weitere Aktionen" eintraege={() => [
            { text: 'Eingeben …', deaktiviert: ohneAuswahl, aktion: eingeben },
            { text: zelle?.keine ? 'Aufsicht wieder einplanen' : 'Keine Aufsicht', deaktiviert: ohneAuswahl, aktion: teile(0) },
            { text: 'Aufsicht teilen', deaktiviert: ohneAuswahl, aktion: teile(1) },
            { text: 'Teilung entfernen', deaktiviert: ohneAuswahl || (zelle?.teile ?? 0) < 2, aktion: teile(-1) },
            null,
            { text: sicht === 'gang' ? 'Aufsichten dieses Bereichs löschen …' : 'Aufsichten dieser Lehrkraft löschen …', deaktiviert: !element, aktion: allesLoeschen(false) },
            { text: 'Alle Aufsichten löschen …', aktion: allesLoeschen(true) },
          ]} />
        </> : null}
        <Rechts>
          {schreiben ? <Werkzeug text="Automatisch einteilen …" titel="Offene Aufsichten automatisch besetzen" aktion={optimieren} /> : null}
          <MenueKnopf text="Einstellungen" eintraege={() => [
            { text: 'Gewichtung …', deaktiviert: !schreiben, aktion: los(async () => { if (await gewichtungDialog()) { hinweis('Gewichtung gespeichert.', 'ok'); await neuLaden(true); } }) },
            { text: 'Aufsichtsbereiche …', aktion: bereicheOeffnen },
          ]} />
        </Rechts>
      </>}
      fuss={daten ? <FussText>{daten.minuten}</FussText> : null}>
      {!liste || (laedt && !daten) ? <Ladeanzeige /> : !element || !daten ? (
        sicht === 'gang'
          ? <Leer text="Es sind noch keine Aufsichtsbereiche angelegt."><Button size="small" onClick={bereicheOeffnen}>Aufsichtsbereiche anlegen</Button></Leer>
          : <Leer text="Es sind keine Lehrkräfte vorhanden." />
      ) : (
        <div className="pa-teilung">
          <div className="pa-raster" tabIndex={0} data-testid="pa-raster">
            <table className="pa-tabelle">
              <thead><tr><th className="pa-ecke" />{daten.spalten.map((sp, i) => <th key={i} title={`${sp.minuten} Minuten`}><div>{sp.name}</div><div className="pa-zeit">{sp.zeit}</div></th>)}</tr></thead>
              <tbody>
                {daten.tage.map((t) => (
                  <tr key={t.tag}>
                    <th className="pa-tag">{t.name}</th>
                    {t.zellen.map((z) => {
                      const kl = mergeClasses('pa-zelle',
                        sicht === 'gang' ? mergeClasses(z.keine && 'keine', z.offen && !z.keine && 'offen', !!z.schlecht?.length && 'schlecht') : z.moeglich ? 'moeglich' : 'gesperrt',
                        akt?.tag === t.tag && akt.nach === z.nach && 'aktiv');
                      return (
                        <td key={z.nach} className={kl} title={z.schlecht?.length ? `Ungünstig: ${z.schlecht.join(', ')}` : undefined}
                          onClick={() => setAkt({ tag: t.tag, nach: z.nach })}
                          onDoubleClick={() => { setAkt({ tag: t.tag, nach: z.nach }); if (sicht === 'gang' && schreiben) setTimeout(eingeben); }}
                          onContextMenu={(e) => kontext(e, t.tag, z)}>
                          {z.keine ? 'keine Aufsicht' : z.text}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pa-lehrerliste">
            <div className="pa-seitenkopf"><b>Lehrkräfte</b><span className="leise">Doppelklick zeigt den Plan der Lehrkraft</span></div>
            <table className="pa-tabelle klein">
              <thead><tr>
                <th>Lehrkraft</th><th className="zahl" title="Höchstens Minuten Aufsicht pro Woche">Soll</th><th className="zahl" title="Eingeteilte Minuten pro Woche">Ist</th>
                <th className="zahl" title="Anzahl der Aufsichten">Anzahl</th><th className="zahl" title="Vertretene Aufsichten">Vertr.</th>
                <th className="zahl" title="Ist minus Soll in Minuten">Differenz</th><th title="Geschlecht">G.</th>
              </tr></thead>
              <tbody>
                {daten.lehrer.map((l) => (
                  <tr key={l.id} className="pa-lehrerzeile" onDoubleClick={() => { setAkt(null); a.parameterSetzen({ sicht: 'lehrer', element: l.id }); }}>
                    <td>{l.kurz}</td><td className="zahl">{l.max}</td><td className="zahl">{l.ist}</td><td className="zahl">{l.anzahl}</td><td className="zahl">{l.vertretungen}</td>
                    <td className={mergeClasses('zahl', l.ueber && 'pa-ueber')}>{l.differenz}</td><td>{l.geschlecht}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AnsichtRahmen>
  );
}
