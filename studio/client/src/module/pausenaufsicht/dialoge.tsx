// Dialoge der Pausenaufsichten: Eingeben, Vorschlag mit Bewertung, automatische Einteilung, Gewichtung.
import { Checkbox, Field, Input, Slider, makeStyles, tokens } from '@fluentui/react-components';
import { useRef, useState } from 'react';
import { api } from '@/api/client';
import { dialogZeigen, StandardDialog } from '@/komponenten/dialoge';
import { Tabelle, type TabelleApi } from '@/komponenten/tabelle/Tabelle';

const useStile = makeStyles({
  spalte: { display: 'flex', flexDirection: 'column', gap: '12px' },
  leise: { color: tokens.colorNeutralForeground3, margin: 0, fontSize: tokens.fontSizeBase200 },
  vorschlag: { height: '420px', display: 'flex', border: `1px solid ${tokens.colorNeutralStroke2}` },
  gewichtung: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 220px 24px', alignItems: 'center', gap: '4px 12px' },
  h3: { gridColumn: '1 / -1', margin: '12px 0 0 0', fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold },
  voll: { gridColumn: '1 / -1' },
  wert: { fontVariantNumeric: 'tabular-nums', textAlign: 'right' },
  einheit: { display: 'flex', alignItems: 'center', gap: '8px' },
});

export function eingebenDialog(alt: string): Promise<string | null> {
  const start = alt === '???' ? '' : alt.replace(/\?\?\?/g, '').replace(/,\s*,/g, ',').replace(/^,|,$/g, '');
  function Inhalt({ schliessen }: { schliessen: (w: string | null) => void }) {
    const [t, setT] = useState(start);
    return (
      <StandardDialog<boolean> titel="Pausenaufsicht eingeben" breite="420px" knoepfe={[{ text: 'Übernehmen', wert: true, primaer: true }, { text: 'Abbrechen', wert: null }]}
        beiKnopf={(w) => schliessen(w ? t : null)}>
        <Field label="Lehrkräfte" hint="Kurznamen; mehrere teilen sich die Aufsicht.">
          <Input value={t} placeholder="z. B. MÜL, SCH" autoFocus onChange={(_, d) => setT(d.value)} onKeyDown={(e) => { if (e.key === 'Enter') schliessen(t); }} />
        </Field>
      </StandardDialog>
    );
  }
  return dialogZeigen<string>((schliessen) => <Inhalt schliessen={schliessen} />);
}

interface VZeile { id: number; werte: (string | number)[]; verletzt: string[]; schlecht?: boolean }
export interface Vorschlag { titel: string; ersetzt?: string; spalten: string[]; zeilen: VZeile[] }

/** Vorschlag mit Bewertung; liefert die Id der gewählten Lehrkraft. */
export function vorschlagDialog(v: Vorschlag): Promise<number | null> {
  function Inhalt({ schliessen }: { schliessen: (w: number | null) => void }) {
    const s = useStile();
    const t = useRef<TabelleApi<VZeile>>(null);
    const zeilen = v.zeilen;
    return (
      <StandardDialog<boolean> titel={String(v.titel || '').replace(/^Lehrervorschlag/, 'Vorschlag')} breite="960px"
        knoepfe={[{ text: 'Einteilen', wert: true, primaer: true }, { text: 'Abbrechen', wert: null }]}
        beiKnopf={(w) => schliessen(w ? (t.current?.aktiveZeile() || zeilen[0])?.id ?? null : null)}>
        <div className={s.spalte}>
          {v.ersetzt ? <p className={s.leise}>{`Alle Teile sind belegt – ersetzt wird ${v.ersetzt}.`}</p> : null}
          <div className={s.vorschlag}>
            <Tabelle<VZeile> ref={t} name="pa-vorschlag" zeilen={zeilen} id={(z) => z.id} sortierbar={false} leerText="Keine Lehrkraft verfügbar."
              zeilenKlasse={(z) => (z.schlecht ? 'pa-schlecht' : '')}
              beiDoppelklick={(z) => schliessen(z.id)}
              spalten={v.spalten.map((titel, i) => ({
                schluessel: `v${i}`, titel, hinweis: titel, art: 'NurLesen' as const,
                breite: Math.max(i === 0 ? 64 : 56, Math.round(titel.length * 6.6) + 22), wert: (z: VZeile) => z.werte[i],
              }))} />
          </div>
        </div>
      </StandardDialog>
    );
  }
  return dialogZeigen<number>((schliessen) => <Inhalt schliessen={schliessen} />);
}

export interface OptimierenWahl { schlechteLoeschen: boolean; nurBereich: boolean; kuerzestePause: number }

export function optimierenDialog(bereichMoeglich: boolean): Promise<OptimierenWahl | null> {
  function Inhalt({ schliessen }: { schliessen: (w: OptimierenWahl | null) => void }) {
    const s = useStile();
    const [w, setW] = useState<OptimierenWahl>({ schlechteLoeschen: false, nurBereich: false, kuerzestePause: 0 });
    return (
      <StandardDialog<boolean> titel="Pausenaufsichten automatisch einteilen" breite="480px"
        knoepfe={[{ text: 'Einteilen', wert: true, primaer: true }, { text: 'Abbrechen', wert: null }]} beiKnopf={(x) => schliessen(x ? w : null)}>
        <div className={s.spalte}>
          <Checkbox label="Nur der aktuelle Aufsichtsbereich" disabled={!bereichMoeglich} checked={w.nurBereich} onChange={(_, d) => setW({ ...w, nurBereich: !!d.checked })} />
          <Checkbox label="Ungünstige Einteilungen vorher entfernen" checked={w.schlechteLoeschen} onChange={(_, d) => setW({ ...w, schlechteLoeschen: !!d.checked })} />
          <Field label="Nur Pausen ab">
            <span className={s.einheit}>
              <Input type="number" min={0} max={60} style={{ width: 90 }} value={String(w.kuerzestePause)} onChange={(_, d) => setW({ ...w, kuerzestePause: Number(d.value) || 0 })} />
              <span className={s.leise}>Minuten</span>
            </span>
          </Field>
          <p className={s.leise}>Besetzt werden nur offene Aufsichten. Lehrkräfte ohne Aufsichtsminuten, gesperrte Lehrkräfte und unpassende Zuordnungen nach Geschlecht bleiben außen vor.</p>
        </div>
      </StandardDialog>
    );
  }
  return dialogZeigen<OptimierenWahl>((schliessen) => <Inhalt schliessen={schliessen} />);
}

interface Gewichtung { maxProTag: number; kriterien: { schluessel: string; text: string; wert: number }[] }

/** Gewichtung laden, bearbeiten, speichern; true bei Änderung. */
export async function gewichtungDialog(): Promise<boolean> {
  const g = await api.get<Gewichtung>(api.dok('/pausenaufsicht/gewichtung'));
  function Inhalt({ schliessen }: { schliessen: (w: { maxProTag: number; werte: Record<string, number> } | null) => void }) {
    const s = useStile();
    const [max, setMax] = useState(g.maxProTag);
    const [werte, setWerte] = useState<Record<string, number>>(() => Object.fromEntries(g.kriterien.map((k) => [k.schluessel, k.wert])));
    return (
      <StandardDialog<boolean> titel="Gewichtung der Pausenaufsichten" breite="620px"
        knoepfe={[{ text: 'Speichern', wert: true, primaer: true }, { text: 'Abbrechen', wert: null }]} beiKnopf={(x) => schliessen(x ? { maxProTag: max || 1, werte } : null)}>
        <div className={s.gewichtung}>
          <label htmlFor="pa-max">Höchstens Aufsichten pro Tag</label>
          <Input id="pa-max" type="number" min={1} max={5} style={{ width: 80 }} value={String(max)} onChange={(_, d) => setMax(Number(d.value) || 0)} /><span />
          <h3 className={s.h3}>Gewichtung der Kriterien</h3>
          <p className={`${s.leise} ${s.voll}`}>0 = unwichtig, 5 = darf nie verletzt werden.</p>
          {g.kriterien.map((k) => [
            <span key={`t${k.schluessel}`}>{k.text}</span>,
            <Slider key={`s${k.schluessel}`} min={0} max={5} step={1} value={werte[k.schluessel] ?? 0} aria-label={k.text} onChange={(_, d) => setWerte((x) => ({ ...x, [k.schluessel]: d.value }))} />,
            <span key={`w${k.schluessel}`} className={s.wert}>{werte[k.schluessel]}</span>,
          ])}
        </div>
      </StandardDialog>
    );
  }
  const w = await dialogZeigen<{ maxProTag: number; werte: Record<string, number> }>((schliessen) => <Inhalt schliessen={schliessen} />);
  if (!w) return false;
  await api.put(api.dok('/pausenaufsicht/gewichtung'), w);
  return true;
}
