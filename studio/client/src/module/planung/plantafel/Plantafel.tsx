// Plantafel der Stundenplanung: „Steckbrett“ (alle Klassen, Lehrkräfte oder Räume × Tage und Stunden mit Vorrat der offenen
// Blöcke) und „Klasse“ (Wochenplan einer Klasse mit den verknüpften Plänen der Lehrkräfte und Räume der gewählten Stunde).
// Werkzeuge: Fixieren, Entplanen (Stunde, Zeile, alle), Automatische Planung, Ansicht; Neuer Unterricht im Vorrat. Rückgängig und
// Wiederholen (Strg+Z, Strg+Y) über die Kopfleiste – die Plantafel lädt danach neu.
// Bänder (parallele Kurse) wandern als Ganzes (band.ts). Server: GET /planung/plantafel, /planung/plantafel/ziele; Ändern über
// /planung/verschieben, /verplanen, /band/verschieben, /band/verplanen, /entplanen, /fixieren.
import { MoreHorizontal20Regular } from '@fluentui/react-icons';
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { api } from '@/api/client';
import { useAnsicht, type AnsichtProps } from '@/kern/ansichten';
import { befehl, seiteOeffnen } from '@/kern/befehle';
import { useDaten } from '@/kern/laden';
import { useDarfSchreiben } from '@/kern/zustand';
import { AnsichtRahmen, ElementAuswahl, FussText, Segmente, Trenner, Werkzeug } from '@/komponenten/ansicht';
import { frage } from '@/komponenten/dialoge';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { MenueKnopf, menue, type MenueListe } from '@/komponenten/menue';
import type { PlanEintrag } from '@/komponenten/raster/Stundenplanraster';
import * as planung from '../aktionen';
import { neuerUnterrichtDialog } from '../neuerUnterricht';
import { ablegen as bandAblegen, bandStunden } from './band';
import { aufbereiten, kartenText, type Karte, type TafelDaten, type TafelTyp, type TafelUnterricht } from './daten';
import { Klassentafel, type KlassenAuswahl } from './Klassentafel';
import { Steckbrett, type SteckbrettApi, type TafelAblage, type TafelAuswahl, type TafelZug } from './Steckbrett';
import { Vorrat } from './Vorrat';
import './plantafel.css';

const ZEILEN: Record<TafelTyp, { einzahl: string; mehrzahl: string; gruppe: string }> = {
  klasse: { einzahl: 'Klasse', mehrzahl: 'Klassen', gruppe: 'Jahrgang' },
  lehrer: { einzahl: 'Lehrkraft', mehrzahl: 'Lehrkräfte', gruppe: 'Abteilung' },
  raum: { einzahl: 'Raum', mehrzahl: 'Räume', gruppe: 'Raumart' },
};

export default function Plantafel({ p }: AnsichtProps) {
  const a = useAnsicht();
  const schreiben = useDarfSchreiben();
  const modus = p.modus === 'klasse' ? 'klasse' : 'steckbrett';
  const zeilenTyp: TafelTyp = p.zeilen === 'lehrer' || p.zeilen === 'raum' ? p.zeilen : 'klasse';
  const typ: TafelTyp = modus === 'klasse' ? 'klasse' : zeilenTyp;
  const gruppe = p.gruppe == null ? '' : String(p.gruppe);
  const vorratOffen = p.vorrat !== false;
  const farben = p.farben !== false;

  const { daten, laedt, neuLaden } = useDaten(() => api.get<TafelDaten>(api.dok(`/planung/plantafel?typ=${typ}`)), [typ],
    { bereiche: ['Stundenplan', 'Unterricht', 'Stammdaten'], quelle: a.id });
  const [version, setVersion] = useState(0);
  useEffect(() => { setVersion((v) => v + 1); }, [daten]);
  const auf = useMemo(() => (daten && daten.typ === typ ? aufbereiten(daten, typ) : null), [daten, typ]);

  const [auswahl, setAuswahl] = useState<TafelAuswahl | null>(null);
  const [kAuswahl, setKAuswahl] = useState<KlassenAuswahl | null>(null);
  const [zeileGewaehlt, setZeileGewaehlt] = useState<number | null>(null);
  const [tastZug, setTastZug] = useState<TafelZug | null>(null);
  const [filter, setFilter] = useState('');
  const [nurZeile, setNurZeile] = useState(false);
  const brett = useRef<SteckbrettApi>(null);
  useEffect(() => { setZeileGewaehlt(null); setAuswahl(null); setTastZug(null); }, [typ]);

  const zeilen = useMemo(() => (daten?.zeilen || []).filter((z) => !gruppe || z.gruppe === gruppe), [daten, gruppe]);
  // Dichte: gewählt, sonst bei vielen Zeilen kompakt (eine Zeile je Karte)
  const dichte: 'kompakt' | 'normal' | 'auto' = p.dichte === 'kompakt' || p.dichte === 'normal' ? p.dichte : 'auto';
  const gruppen = useMemo(() => [...new Set((daten?.zeilen || []).map((z) => z.gruppe).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'de', { numeric: true })), [daten]);
  const offenJeZeile = useMemo(() => {
    const m = new Map<number, number>();
    if (!daten) return m;
    for (const u of daten.unterrichte) {
      const n = u.offen.reduce((x, b) => x + b, 0);
      if (!n) continue;
      for (const id of typ === 'klasse' ? u.klassen : typ === 'lehrer' ? u.lehrer : []) m.set(id, (m.get(id) || 0) + n);
    }
    return m;
  }, [daten, typ]);
  const klassen = useMemo(() => (modus === 'klasse' ? (daten?.zeilen || []).map((z) => ({ id: z.id, k: z.kurz, l: z.lang })) : []), [daten, modus]);
  const element = modus === 'klasse' ? (klassen.some((k) => k.id === Number(p.element)) ? Number(p.element) : klassen[0]?.id ?? null) : null;

  const nachAenderung = async (ok: boolean | void) => { if (ok !== false) await neuLaden(true); };
  const los = (f: () => Promise<boolean | void>) => () => { f().then(nachAenderung).catch(fehlerMelden); };

  // ---- Planen ----
  const ablegen = (x: TafelAblage) => {
    const { zug } = x;
    const d = zug.art === 'karte'
      ? { u: zug.u, tag: zug.tag, stunde: zug.stunde, einzeln: !!zug.einzeln, laenge: zug.laenge, zielTag: x.zielTag, zielStunde: x.zielStunde }
      : { u: zug.u, laenge: zug.laenge, zielTag: x.zielTag, zielStunde: x.zielStunde };
    if (!auf) return;
    bandAblegen(auf, d, a.id).then(nachAenderung).then(() => brett.current?.fokus()).catch(fehlerMelden);
  };
  // Stunden einer Karte samt parallel liegender Kurse ihres Bandes (ohne Band nur die Karte)
  const stundenVon = (k: Karte, nur?: number) => (auf ? bandStunden(auf, k, nur) : []);
  const entplanenKarte = (k: Karte, nur?: number) => los(() => planung.entplanen(stundenVon(k, nur), a.id))();
  const fixierenKarte = (k: Karte) => los(() => planung.fixieren(stundenVon(k).map((s) => ({ ...s, e: { fix: k.fix } as PlanEintrag })), a.id))();
  const gewaehlteKarte = (): Karte | null => {
    if (!auf) return null;
    if (modus === 'klasse') {
      if (!kAuswahl || kAuswahl.tag === undefined) return null;
      return (auf.kartenVon.get(kAuswahl.u) || []).find((k) => k.tag === kAuswahl.tag && kAuswahl.stunde! >= k.von && kAuswahl.stunde! < k.von + k.laenge) ?? null;
    }
    return auswahl?.karte ? auf.karten.find((k) => k.key === auswahl.karte) ?? null : null;
  };
  const zeileFuerAktion = modus === 'klasse' ? element : zeileGewaehlt;
  const zeileName = zeileFuerAktion != null ? daten?.zeilen.find((z) => z.id === zeileFuerAktion)?.kurz : undefined;
  const kartenDerZeile = (id: number) => (auf?.jeZeile.get(id) || []).map((b) => b.karte);

  const zeileEntplanen = async () => {
    if (zeileFuerAktion == null || !auf) return false;
    const karten = kartenDerZeile(zeileFuerAktion).filter((k) => !k.teilFix);
    const fixe = kartenDerZeile(zeileFuerAktion).length - karten.length;
    if (!karten.length) { hinweis(`${ZEILEN[typ].einzahl} ${zeileName}: keine Stunden, die nicht fixiert sind.`, 'warnung'); return false; }
    const n = karten.reduce((x, k) => x + k.laenge, 0);
    const gek = karten.filter((k) => (auf.zeilenVon(k.u).length > 1)).length;
    if (!(await frage(`${n} Stunden von ${ZEILEN[typ].einzahl} ${zeileName} entplanen?${fixe ? `\nFixierte Stunden (${fixe}) bleiben im Plan.` : ''}${gek ? `\n${gek} gekoppelte Stunden werden auch für die übrigen Beteiligten entplant.` : ''}`, { gefahr: true, ja: 'Entplanen', nein: 'Abbrechen' }))) return false;
    await api.post(api.dok('/planung/entplanen'), { stunden: karten.flatMap((k) => stundenVon(k)).map((s) => ({ unterricht: s.u, tag: s.tag, stunde: s.stunde })) }, { quelle: a.id });
    hinweis(`${n} Stunden entplant – Strg+Z macht es rückgängig.`, 'ok', 3000);
    return true;
  };
  const zeileFixieren = async (fix: boolean) => {
    if (zeileFuerAktion == null) return false;
    const karten = kartenDerZeile(zeileFuerAktion);
    if (!karten.length) return false;
    await api.post(api.dok('/planung/fixieren'), { stunden: karten.flatMap((k) => stundenVon(k)).map((s) => ({ unterricht: s.u, tag: s.tag, stunde: s.stunde })), fixieren: fix }, { quelle: a.id });
    hinweis(fix ? `Stunden von ${zeileName} fixiert.` : `Fixierungen von ${zeileName} gelöst.`, 'ok', 2500);
    return true;
  };

  const neu = async () => {
    const vorgabe = typ === 'lehrer' ? { lehrer: zeileGewaehlt } : { klasse: modus === 'klasse' ? element : zeileGewaehlt };
    const erg = await neuerUnterrichtDialog(vorgabe);
    if (!erg) return;
    await neuLaden(true);
    setAuswahl({ u: erg.id });
    setTimeout(() => document.querySelector(`[data-testid=vorrat] [data-vorrat="${erg.id}"], [data-testid=klassenvorrat] [data-vorrat="${erg.id}"]`)?.scrollIntoView({ block: 'nearest' }));
  };

  const unterrichtOeffnen = (u: TafelUnterricht) => a.oeffnen('unterricht', u.klassen[0] ? { sicht: 'klasse', element: u.klassen[0] } : { sicht: 'alle' });
  const planOeffnen = (id: number) => {
    if (typ === 'klasse') a.parameterSetzen({ modus: 'klasse', element: id });
    else a.oeffnen('stundenplan', { typ, element: id });
  };

  const karteMenue = (k: Karte, zeile: number, x: number, y: number) => {
    const u = auf?.uMap.get(k.u);
    if (!u || !daten) return;
    const t = kartenText(u, typ, zeile, daten, k);
    const ref = { u: k.u, tag: k.tag, stunde: k.von };
    const liste: MenueListe = [
      { titel: `Unterricht Nr. ${u.u} · ${t.fach} ${u.klassen.map((x) => daten.namen.klassen[x]).join(',')}` },
      { text: k.fix ? 'Fixierung lösen' : 'Fixieren', taste: 'F', deaktiviert: !schreiben, aktion: () => fixierenKarte(k) },
      { text: k.laenge > 1 ? 'Block entplanen' : 'Entplanen', taste: 'Entf', deaktiviert: !schreiben, aktion: () => entplanenKarte(k) },
      { text: 'Raum zuordnen …', aktion: los(() => planung.raumDialog(ref, a.id)) },
      { text: 'Tauschvorschläge …', deaktiviert: !schreiben, aktion: los(() => planung.tauschDialog(ref, a.id)) },
      null,
      typ === 'klasse' ? { text: `Klasse ${daten.namen.klassen[zeile] ?? ''} mit Lehrkräften und Räumen`, aktion: () => planOeffnen(zeile) } : { text: 'Plan öffnen', aktion: () => planOeffnen(zeile) },
      { text: 'Unterricht bearbeiten …', aktion: () => unterrichtOeffnen(u) },
      { text: 'Zeitwünsche des Unterrichts', aktion: () => a.oeffnen('zeitwuensche', { typ: 'unterricht', element: u.u }) },
    ];
    menue(x, y, liste);
  };
  const vorratMenue = (u: TafelUnterricht, ev: MouseEvent) => menue(ev.clientX, ev.clientY, [
    { titel: `Unterricht Nr. ${u.u}` },
    { text: 'Unterricht bearbeiten …', aktion: () => unterrichtOeffnen(u) },
    { text: 'Zeitwünsche des Unterrichts', aktion: () => a.oeffnen('zeitwuensche', { typ: 'unterricht', element: u.u }) },
  ]);

  const k = gewaehlteKarte();
  const z = ZEILEN[typ];
  // Klare Auswahl: in der Fußzeile steht, was gewählt ist (Fach, Klassen, Lehrkräfte, Zeit, Band)
  const auswahlU = modus === 'klasse' ? kAuswahl?.u : auswahl?.u;
  const auswahlText = (() => {
    if (auswahlU == null || !auf || !daten) return '';
    const u = auf.uMap.get(auswahlU);
    if (!u) return '';
    const zeit = k ? `${daten.zeitraster.tage[k.tag]?.kurz ?? ''} ${k.von}.${k.laenge > 1 ? `–${k.von + k.laenge - 1}.` : ''}` : 'offen';
    const band = auf.bandVon(u.u).length > 1 ? ` · Band ${u.band} (${auf.bandVon(u.u).length} Kurse)` : '';
    return `${u.fach} ${u.klassen.map((x) => daten.namen.klassen[x]).join(', ')} · ${u.lehrer.map((x) => daten.namen.lehrer[x]).join(', ') || 'ohne Lehrkraft'} · ${zeit}${band}`;
  })();
  const titel = modus === 'klasse' && element != null ? `Plantafel – Klasse ${daten?.zeilen.find((x) => x.id === element)?.kurz ?? ''}` : 'Plantafel';

  return (
    <AnsichtRahmen titel={titel} laden={laedt && !daten}
      werkzeuge={<>
        <Segmente titel="Darstellung" testid="pt-modus" wert={modus} beiWahl={(w) => a.parameterSetzen({ modus: w, element: w === 'klasse' ? (zeileGewaehlt && zeilenTyp === 'klasse' ? zeileGewaehlt : p.element) : p.element })}
          optionen={[{ wert: 'steckbrett', text: 'Steckbrett', titel: 'Alle Zeilen auf einen Blick, Vorrat unten' }, { wert: 'klasse', text: 'Klasse', titel: 'Wochenplan einer Klasse mit den Plänen der beteiligten Lehrkräfte und Räume' }]} />
        <Trenner />
        {modus === 'steckbrett' ? <>
          <Segmente titel="Zeilen" testid="pt-zeilen" wert={zeilenTyp} beiWahl={(w) => a.parameterSetzen({ zeilen: w, gruppe: undefined })}
            optionen={[{ wert: 'klasse', text: 'Klassen' }, { wert: 'lehrer', text: 'Lehrkräfte' }, { wert: 'raum', text: 'Räume' }]} />
          <MenueKnopf text={gruppe ? `${z.gruppe} ${gruppe}` : `Alle ${z.mehrzahl}`} titel={`${z.mehrzahl} nach ${z.gruppe} einschränken`} eintraege={() => [
            { text: `Alle ${z.mehrzahl}`, haken: !gruppe, aktion: () => a.parameterSetzen({ gruppe: undefined }) },
            gruppen.length ? null : undefined,
            ...gruppen.map((g) => ({ text: `${z.gruppe} ${g}`, haken: g === gruppe, aktion: () => a.parameterSetzen({ gruppe: g }) })),
          ]} />
        </> : <ElementAuswahl typ="klasse" liste={klassen} wert={element} beiWahl={(id) => { setKAuswahl(null); a.parameterSetzen({ element: id }); }} />}
        <Trenner />
        {schreiben ? <>
          <MenueKnopf text="Fixieren" titel="Stunden fixieren bzw. lösen (F)" eintraege={() => [
            { text: k ? (k.fix ? 'Gewählte Stunde lösen' : 'Gewählte Stunde fixieren') : 'Gewählte Stunde fixieren', taste: 'F', deaktiviert: !k, aktion: () => { if (k) fixierenKarte(k); } },
            { text: zeileName ? `Alle Stunden von ${zeileName} fixieren` : `${z.einzahl} wählen, um sie zu fixieren`, deaktiviert: zeileFuerAktion == null, aktion: los(() => zeileFixieren(true)) },
            { text: zeileName ? `Fixierungen von ${zeileName} lösen` : 'Fixierungen einer Zeile lösen', deaktiviert: zeileFuerAktion == null, aktion: los(() => zeileFixieren(false)) },
          ]} />
          <MenueKnopf text="Entplanen" titel="Stunden zurück in den Vorrat" eintraege={() => [
            { text: k ? (k.laenge > 1 ? 'Gewählten Block entplanen' : 'Gewählte Stunde entplanen') : 'Gewählte Stunde entplanen', taste: 'Entf', deaktiviert: !k, aktion: () => { if (k) entplanenKarte(k); } },
            { text: zeileName ? `Alle Stunden von ${zeileName} entplanen …` : `${z.einzahl} wählen (Zeilenkopf), um sie zu entplanen`, deaktiviert: zeileFuerAktion == null, aktion: los(zeileEntplanen) },
          ]} />
        </> : null}
        <Trenner />
        <Werkzeug text="Optimierung" titel="Automatische Planung (läuft im Hintergrund)" aktion={() => seiteOeffnen('optimierung.lauf')} />
        <MenueKnopf text="" icon={<MoreHorizontal20Regular />} titel="Weitere Aktionen und Darstellung" eintraege={() => [
          { titel: 'Darstellung' },
          { text: 'Karten automatisch (zwei Zeilen, wenn Platz ist)', haken: dichte === 'auto', aktion: () => a.parameterSetzen({ dichte: undefined }) },
          { text: 'Immer zwei Zeilen (breitere Spalten)', haken: dichte === 'normal', aktion: () => a.parameterSetzen({ dichte: 'normal' }) },
          { text: 'Immer eine Zeile', haken: dichte === 'kompakt', aktion: () => a.parameterSetzen({ dichte: 'kompakt' }) },
          { text: 'Fachfarben', haken: farben, aktion: () => a.parameterSetzen({ farben: !farben }) },
          { text: 'Vorrat zeigen', haken: vorratOffen, aktion: () => a.parameterSetzen({ vorrat: !vorratOffen }) },
          null,
          { text: 'Diagnose', aktion: () => befehl('optimierung.diagnose') },
          { text: 'Zeitwünsche', aktion: () => a.oeffnen('zeitwuensche', { typ, element: zeileFuerAktion ?? undefined }) },
          schreiben ? null : undefined,
          schreiben ? { text: 'Alle Stunden fixieren', aktion: los(async () => { await befehl('planung.alleFixieren', { fixieren: true }); }) } : undefined,
          schreiben ? { text: 'Alle Fixierungen aufheben', aktion: los(async () => { await befehl('planung.alleFixieren', { fixieren: false }); }) } : undefined,
          schreiben ? { text: 'Alle Stunden entplanen …', aktion: los(async () => { await befehl('planung.alleEntplanen'); }) } : undefined,
        ]} />
      </>}
      fuss={<>
        <span>{auf ? `${auf.verplant} Stunden verplant` : ''}</span>
        <span>{auf ? `${auf.offen} offen` : ''}</span>
        {modus === 'steckbrett' ? <span>{`${zeilen.length} ${zeilen.length === 1 ? z.einzahl : z.mehrzahl}`}</span> : null}
        {auswahlText ? <span className="pt-auswahltext" data-testid="pt-auswahl">Gewählt: {auswahlText}</span> : (
          <span title={modus === 'steckbrett' ? 'Ziehen: verschieben bzw. setzen · in den Vorrat ziehen: entplanen · Umschalt beim Ziehen: nur diese Stunde eines Blocks · Pfeile und Enter: per Tastatur · Entf entplant · F fixiert' : 'Stunde wählen: Pläne der Lehrkräfte und Räume darunter · Ziehen wie im Stundenplan'}>
            {modus === 'steckbrett' ? 'Ziehen, in den Vorrat: entplanen, Pfeile und Enter' : 'Stunde wählen: Pläne der Lehrkräfte und Räume'}
          </span>
        )}
        <FussText rechts>{daten?.periode}</FussText>
      </>}>
      {daten && auf ? (modus === 'steckbrett' ? (
        <div className="pt-flaeche">
          <Steckbrett ref={brett} daten={daten} auf={auf} typ={typ} zeilen={zeilen} dichte={dichte} farben={farben} version={version} schreiben={schreiben}
            auswahl={auswahl} beiAuswahl={setAuswahl} zeileGewaehlt={zeileGewaehlt} beiZeile={setZeileGewaehlt}
            tastZug={tastZug} setTastZug={setTastZug} beiAblegen={ablegen} beiEntplanen={entplanenKarte} beiFixieren={fixierenKarte}
            beiKontext={karteMenue} beiZeileOeffnen={planOeffnen} offenJeZeile={offenJeZeile} />
          <Vorrat daten={daten} auf={auf} typ={typ} farben={farben} schreiben={schreiben} filter={filter} setFilter={setFilter} nurZeile={nurZeile} setNurZeile={setNurZeile}
            zeileGewaehlt={zeileGewaehlt} auswahlU={auswahl?.u ?? null} offen={vorratOffen} setOffen={(b) => a.parameterSetzen({ vorrat: b })}
            beiNeu={() => { neu().catch(fehlerMelden); }} aufnehmen={setTastZug} waehlen={(u) => setAuswahl({ u })}
            beiGruppe={(id) => { setZeileGewaehlt(id); brett.current?.zuZeile(id); }}
            beiEntplanen={(zg) => { if (zg.karte) entplanenKarte(zg.karte, zg.einzeln ? zg.stunde : undefined); }} kontext={vorratMenue} />
        </div>
      ) : element != null ? (
        <Klassentafel daten={daten} auf={auf} farben={farben} element={element} version={version} schreiben={schreiben} auswahl={kAuswahl} setAuswahl={setKAuswahl}
          neuLaden={() => neuLaden(true)} beiNeu={() => { neu().catch(fehlerMelden); }} />
      ) : null) : null}
    </AnsichtRahmen>
  );
}
