// Vorrat der Plantafel: offene Blöcke aller Unterrichte (Doppelstunden doppelt so breit), gruppiert nach Klasse bzw. Lehrkraft,
// filterbar. Karten aus dem Vorrat in das Steckbrett ziehen (oder mit Enter aufnehmen und mit den Pfeiltasten setzen); eine Karte
// aus dem Brett hierher ziehen entplant sie. „Neuer Unterricht“ öffnet den Dialog, der neue Unterricht erscheint sofort hier.
// Je Gruppe steht die Zahl der offenen Stunden; beim Ziehen eines Bandes sind die mitwandernden Kurse blass.
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Button, Input, Switch } from '@fluentui/react-components';
import { ChevronDown16Regular, ChevronUp16Regular, Search16Regular } from '@fluentui/react-icons';
import { memo, useMemo, type MouseEvent } from 'react';
import { useZiehen, type AblageDaten, type ZiehDaten } from '@/komponenten/ziehen';
import { kartenText, type Aufbereitet, type TafelDaten, type TafelTyp, type TafelUnterricht } from './daten';
import type { TafelZug } from './Steckbrett';

interface Gruppe { id: number; name: string; stunden: number; eintraege: { u: TafelUnterricht; laenge: number; anzahl: number }[] }

const VorratChip = memo(function VorratChip({ u, laenge, anzahl, gruppe, typ, daten, farben, ziehbar, gewaehlt, mitzug, aufnehmen, waehlen, kontext }: {
  u: TafelUnterricht; farben: boolean; mitzug: boolean; laenge: number; anzahl: number; gruppe: number; typ: TafelTyp; daten: TafelDaten; ziehbar: boolean; gewaehlt: boolean;
  aufnehmen: (z: TafelZug) => void; waehlen: (u: number) => void; kontext: (u: TafelUnterricht, ev: MouseEvent) => void;
}) {
  const gtyp: TafelTyp = typ === 'lehrer' ? 'lehrer' : 'klasse';
  const t = kartenText(u, gtyp, gruppe >= 0 ? gruppe : null, daten);
  const zug: TafelZug = { art: 'vorrat', u: u.u, laenge };
  const ziehDaten: ZiehDaten = {
    art: 'tafel-vorrat', zug,
    vorschau: () => <div className="pt-vorschau"><b>{t.fach}</b>{t.zweit ? ` · ${t.zweit}` : ''}{laenge > 1 ? ` · ${laenge} Std.` : ''}</div>,
  };
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: `tv|${gruppe}|${u.u}|${laenge}`, data: ziehDaten, disabled: !ziehbar });
  const titel = `${t.titel}\n${anzahl > 1 ? `${anzahl} × ` : ''}${laenge === 1 ? 'Einzelstunde' : laenge === 2 ? 'Doppelstunde' : `${laenge}er-Block`} offen${ziehbar ? '\nIn das Steckbrett ziehen oder Enter drücken' : ''}`;
  return (
    <button ref={setNodeRef} type="button" {...(ziehbar ? listeners : {})} {...(ziehbar ? attributes : {})}
      className={`pt-vchip${t.gekoppelt ? ' gekoppelt' : ''}${isDragging || mitzug ? ' zieht' : ''}${gewaehlt ? ' gewaehlt' : ''}`}
      style={{ width: 30 * laenge + (laenge - 1) * 2 + (anzahl > 1 ? 18 : 0), ...(t.farbe && farben ? { ['--fachfarbe' as string]: t.farbe } : {}) }}
      title={titel} aria-label={titel.replace(/\n/g, ', ')} data-vorrat={u.u} data-laenge={laenge}
      onClick={() => waehlen(u.u)} onContextMenu={(ev) => { ev.preventDefault(); kontext(u, ev); }}
      onKeyDown={(ev) => { if ((ev.key === 'Enter' || ev.key === ' ') && ziehbar) { ev.preventDefault(); ev.stopPropagation(); aufnehmen(zug); } }}>
      <span className="f">{t.fach}</span>
      {anzahl > 1 ? <span className="n">{anzahl}×</span> : null}
    </button>
  );
});

export function Vorrat({ daten, auf, typ, farben, schreiben, filter, setFilter, nurZeile, setNurZeile, zeileGewaehlt, auswahlU, offen, setOffen, beiNeu, aufnehmen, waehlen, beiGruppe, beiEntplanen, kontext }: {
  daten: TafelDaten; auf: Aufbereitet; typ: TafelTyp; farben: boolean; schreiben: boolean;
  filter: string; setFilter: (f: string) => void; nurZeile: boolean; setNurZeile: (b: boolean) => void; zeileGewaehlt: number | null; auswahlU: number | null;
  offen: boolean; setOffen: (b: boolean) => void;
  beiNeu: () => void; aufnehmen: (z: TafelZug) => void; waehlen: (u: number) => void; beiGruppe: (id: number) => void;
  beiEntplanen: (z: TafelZug) => void; kontext: (u: TafelUnterricht, ev: MouseEvent) => void;
}) {
  const gtyp: 'klasse' | 'lehrer' = typ === 'lehrer' ? 'lehrer' : 'klasse';
  const namen = gtyp === 'klasse' ? daten.namen.klassen : daten.namen.lehrer;
  const gruppen = useMemo<Gruppe[]>(() => {
    const f = filter.trim().toLowerCase();
    const reihenfolge = new Map((typ === gtyp ? daten.zeilen.map((z) => z.id) : Object.keys(namen).map(Number).sort((a, b) => (namen[a] || '').localeCompare(namen[b] || '', 'de', { numeric: true }))).map((id, i) => [id, i]));
    const m = new Map<number, Gruppe>();
    for (const u of daten.unterrichte) {
      if (!u.offen.length) continue;
      if (f) {
        const text = [u.u, u.fach, u.fachLang, u.text, ...u.zeilen.map((z) => z.fach), ...u.klassen.map((k) => daten.namen.klassen[k]), ...u.lehrer.map((l) => daten.namen.lehrer[l])].join(' ').toLowerCase();
        if (!text.includes(f)) continue;
      }
      const ids = gtyp === 'klasse' ? u.klassen : u.lehrer;
      const laengen = [...new Set(u.offen)].sort((a, b) => b - a).map((l) => ({ u, laenge: l, anzahl: u.offen.filter((x) => x === l).length }));
      for (const id of ids.length ? ids : [-1]) {
        if (nurZeile && zeileGewaehlt != null && typ === gtyp && id !== zeileGewaehlt) continue;
        let g = m.get(id);
        if (!g) m.set(id, g = { id, name: id < 0 ? (gtyp === 'klasse' ? 'ohne Klasse' : 'ohne Lehrkraft') : namen[id] || '?', stunden: 0, eintraege: [] });
        g.eintraege.push(...laengen);
        g.stunden += u.offen.reduce((x, b) => x + b, 0);
      }
    }
    return [...m.values()].sort((a, b) => (reihenfolge.get(a.id) ?? 1e9) - (reihenfolge.get(b.id) ?? 1e9) || a.name.localeCompare(b.name, 'de', { numeric: true }));
  }, [daten, filter, nurZeile, zeileGewaehlt, typ, gtyp, namen]);

  const stunden = auf.offen;
  const anzahlU = daten.unterrichte.filter((u) => u.offen.length).length;
  const ziehtKarte = useZiehen((z) => z.aktiv?.art === 'tafel-karte');
  // beim Ziehen eines Vorratsblocks mit Band: die übrigen Kurse des Bandes wandern mit
  const ziehU = useZiehen((z) => (z.aktiv?.art === 'tafel-vorrat' ? (z.aktiv.zug as TafelZug).u : null));
  const ziehL = useZiehen((z) => (z.aktiv?.art === 'tafel-vorrat' ? (z.aktiv.zug as TafelZug).laenge : null));
  const mitBand = useMemo(() => new Set(ziehU != null ? auf.bandVon(ziehU).filter((x) => x !== ziehU) : []), [ziehU, auf]);
  const ablage: AblageDaten = {
    annehmen: (d) => d.art === 'tafel-karte' && schreiben,
    ablegen: (d) => beiEntplanen(d.zug as TafelZug),
  };
  const { setNodeRef, isOver } = useDroppable({ id: 'pt-vorrat', data: ablage, disabled: !schreiben });

  return (
    <section ref={setNodeRef} className={`pt-vorrat${ziehtKarte ? ' ablage' : ''}${isOver && ziehtKarte ? ' drueber' : ''}${offen ? '' : ' zu'}`} aria-label="Vorrat: nicht verplante Stunden" data-testid="vorrat">
      <div className="pt-vkopf">
        <Button size="small" appearance="subtle" icon={offen ? <ChevronDown16Regular /> : <ChevronUp16Regular />} aria-label={offen ? 'Vorrat einklappen' : 'Vorrat aufklappen'} aria-expanded={offen} onClick={() => setOffen(!offen)} />
        <h2 className="pt-vtitel">Vorrat</h2>
        <span className="pt-vzahl">{stunden ? <><b>{stunden}</b> {stunden === 1 ? 'Stunde' : 'Stunden'} offen in {anzahlU} {anzahlU === 1 ? 'Unterricht' : 'Unterrichten'}</> : 'Alle Stunden sind verplant.'}</span>
        {ziehtKarte ? <span className="pt-vhinweis">Hier ablegen: Stunde entplanen</span> : null}
        {offen ? <>
          <Input size="small" className="pt-vsuche" type="search" contentBefore={<Search16Regular />} placeholder="Fach, Klasse, Lehrkraft" aria-label="Vorrat filtern" value={filter} onChange={(_, d) => setFilter(d.value)} />
          {zeileGewaehlt != null && typ === gtyp ? <Switch label={`Nur ${namen[zeileGewaehlt] ?? 'gewählte Zeile'}`} checked={nurZeile} onChange={(_, d) => setNurZeile(d.checked)} /> : null}
        </> : null}
        {schreiben ? <Button size="small" className="pt-vneu" onClick={beiNeu}>Neuer Unterricht</Button> : null}
      </div>
      {offen ? (
        <div className="pt-vliste">
          {!gruppen.length ? <p className="pt-vleer">{filter ? 'Keine offenen Stunden für diesen Filter.' : stunden ? 'Keine offenen Stunden für diese Auswahl.' : 'Keine offenen Stunden. Neuer Unterricht erscheint hier.'}</p> : null}
          {gruppen.map((g) => (
            <div key={g.id} className={`pt-vgruppe${zeileGewaehlt === g.id ? ' gewaehlt' : ''}`} data-gruppe={g.id}>
              <button type="button" className="pt-vgname" title={`${g.stunden} ${g.stunden === 1 ? 'Stunde' : 'Stunden'} offen${typ === gtyp && g.id >= 0 ? ' – zur Zeile im Steckbrett' : ''}`} onClick={() => { if (g.id >= 0) beiGruppe(g.id); }}>
                {g.name}<span className="n">{g.stunden}</span>
              </button>
              <div className="pt-vchips">
                {g.eintraege.map((e) => (
                  <VorratChip key={`${e.u.u}-${e.laenge}`} u={e.u} laenge={e.laenge} anzahl={e.anzahl} gruppe={g.id} typ={typ} daten={daten} farben={farben} ziehbar={schreiben} mitzug={mitBand.has(e.u.u) && e.laenge === ziehL}
                    gewaehlt={auswahlU === e.u.u} aufnehmen={aufnehmen} waehlen={waehlen} kontext={kontext} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
