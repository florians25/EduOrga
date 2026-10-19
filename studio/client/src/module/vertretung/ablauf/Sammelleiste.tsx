// Mehrere Stunden auf einmal bearbeiten (Arbeitsliste und Vertretungsvorschlag): gemeinsame Kandidaten – Lehrkräfte, die in
// allen markierten Stunden frei sind – mit einem Klick für alle zuweisen; Entfall, Zusammenlegen, ohne Lehrkraft und Raum für alle.
import { Button, Spinner, mergeClasses } from '@fluentui/react-components';
import { useEffect, useState } from 'react';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { raumDialog } from '../dialoge';
import { QUELLE, alleBetreuen, alleZuweisen, entfallen, gemeinsamLaden, mehrzahl, ohneLehrkraft, type Gemeinsam } from './daten';
import './ablauf.css';

export function Sammelleiste({ ids, schreiben, aufheben, fertig, beiDaten }: {
  ids: number[]; schreiben: boolean; aufheben?: () => void; fertig?: () => void; beiDaten?: (g: Gemeinsam | null) => void;
}) {
  const [g, setG] = useState<Gemeinsam | null>(null);
  const schluessel = [...ids].sort((a, b) => a - b).join(',');
  useEffect(() => {
    let aktiv = true;
    setG(null); beiDaten?.(null);
    gemeinsamLaden(ids).then((x) => { if (aktiv) { setG(x); beiDaten?.(x); } }).catch(() => {});
    return () => { aktiv = false; };
  }, [schluessel]); // eslint-disable-line react-hooks/exhaustive-deps
  const los = (f: () => Promise<unknown>, text: string) => () => {
    if (!schreiben) return;
    f().then((r) => { if (r !== null) { hinweis(`${text} – ${mehrzahl(ids.length, 'Stunde', 'Stunden')}.`, 'ok', 2000); fertig?.(); } }).catch(fehlerMelden);
  };
  const offene = g?.ids.length ?? ids.length;
  const stunden = g ? [...new Set(g.stunden)].sort((a, b) => a - b).map((s) => `${s}.`).join(', ') : '';
  return (
    <div className="ta-sammel" data-testid="sammelleiste">
      <div className="ta-sammel-kopf">
        <span className="ta-pruefung-titel">{`${mehrzahl(ids.length, 'Stunde', 'Stunden')} markiert`}</span>
        {stunden ? <span className="ta-pruefung-text">{`${stunden} Std.${offene < ids.length ? ` · ${offene} davon offen` : ''}`}</span> : null}
        {aufheben ? <Button size="small" appearance="subtle" style={{ marginLeft: 'auto' }} onClick={aufheben}>Auswahl aufheben</Button> : null}
      </div>
      <div className="ta-kandidaten">
        {!g ? <span className="ta-laedt"><Spinner size="extra-tiny" /> Gemeinsame Kandidaten werden gesucht …</span>
          : g.gleicheZeit ? <span className="ta-leer">Mehrere Stunden liegen zur selben Zeit – eine Lehrkraft kann sie nur zusammenlegen (Betreuung).</span>
            : g.kandidaten.length ? g.kandidaten.slice(0, 5).map((k, i) => (
              <button key={k.lehrer} type="button" className={mergeClasses('ta-kandidat', k.rot && 'rot')} disabled={!schreiben} data-lehrer={k.k}
                title={`${k.name} für alle ${ids.length} Stunden eintragen${i < 3 ? ` (Taste ${i + 1})` : ''}`} onClick={los(() => alleZuweisen(g.ids, k.lehrer), `${k.k} eingetragen`)}>
                <kbd>{i < 3 ? i + 1 : '·'}</kbd><span className="ta-kurz">{k.k}</span><span className="ta-name">{k.name}</span>
                <span className="ta-gruende">{[`in allen frei (${k.lage})`, ...k.gruende].join(' · ')}</span>
                <span className="ta-last"><span className="ta-last-text">{`W ${k.woche}`}</span><span className="ta-last-text">{`M ${k.monat}`}</span></span>
              </button>
            )) : <span className="ta-leer">Keine Lehrkraft ist in allen markierten Stunden frei.</span>}
      </div>
      {schreiben ? (
        <div className="ta-aktionen">
          <button type="button" className={mergeClasses('ta-aktion', g?.entfallSinnvoll && 'empfohlen')} onClick={los(() => entfallen(ids), 'Entfall')}>Entfall für alle <kbd>E</kbd></button>
          {g?.betreuung ? <button type="button" className="ta-aktion" onClick={los(() => alleBetreuen(g.ids, g.betreuung!.lehrer), `Zusammengelegt mit ${g.betreuung.k}`)}>{`Zusammenlegen mit ${g.betreuung.k}`} <kbd>B</kbd></button> : null}
          <button type="button" className="ta-aktion" onClick={los(() => ohneLehrkraft(ids), 'Ohne Lehrkraft')}>Ohne Lehrkraft <kbd>O</kbd></button>
          <button type="button" className="ta-aktion" onClick={los(async () => ((await raumDialog(ids[0]!, ids, QUELLE)) ? true : null), 'Raum zugeordnet')}>Raum … <kbd>R</kbd></button>
        </div>
      ) : null}
    </div>
  );
}
