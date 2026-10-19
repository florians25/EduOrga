// Vertretungsstatistik: Abrechnung, Einzelnachweis, Mehrarbeit NRW, Monatsabrechnung, Entfalltage, Vertretungsübersicht und
// Wochenwerte – als Tabelle, HTML-Dokument und CSV.
import { useEffect, useState } from 'react';
import { api, dateiHerunterladen } from '@/api/client';
import { useAnsicht, type AnsichtProps } from '@/kern/ansichten';
import { useDaten } from '@/kern/laden';
import { AnsichtRahmen, Feld, Werkzeug } from '@/komponenten/ansicht';
import { MenueKnopf } from '@/komponenten/menue';
import { Tabelle } from '@/komponenten/tabelle/Tabelle';
import { DatumFeld } from '@/komponenten/eingaben';
import { useElemente } from '../gemeinsam';
import './abrechnung.css';
import { SuchAuswahl } from '@/komponenten/suchauswahl';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
interface Bericht { nr: number; text: string; lehrer: boolean }
interface Auswertung { nr: number; kopf: string[]; breiten: number[]; zeilen: { werte: string[]; markierung?: string; lehrer?: number }[]; summe: string }

export default function Statistik({ p }: AnsichtProps) {
  const a = useAnsicht();
  const jetzt = new Date();
  const [von, setVon] = useState(String(p.von || iso(new Date(jetzt.getFullYear(), jetzt.getMonth(), 1))));
  const [bis, setBis] = useState(String(p.bis || iso(new Date(jetzt.getFullYear(), jetzt.getMonth() + 1, 0))));
  const [bericht, setBericht] = useState(Number(p.bericht ?? 0));
  const [lehrer, setLehrer] = useState<number | null>(null);
  const lehrkraefte = useElemente('lehrer');
  const { daten: berichte } = useDaten(() => api.get<Bericht[]>(api.dok('/abrechnung/berichte')), []);
  const mitLehrer = !!berichte?.find((x) => x.nr === bericht)?.lehrer;
  useEffect(() => { if (lehrer == null && lehrkraefte[0]) setLehrer(lehrkraefte[0].id); }, [lehrkraefte, lehrer]);
  useEffect(() => { a.parameterSetzen({ von, bis, bericht }); }, [von, bis, bericht]); // eslint-disable-line react-hooks/exhaustive-deps
  const q = (alle = false) => `bericht=${bericht}&von=${von}&bis=${bis}${lehrer ? `&lehrer=${lehrer}` : ''}${alle ? '&alle=true' : ''}`;
  const { daten, laedt } = useDaten(() => api.get<Auswertung>(api.dok(`/abrechnung/statistik?${q()}`)), [von, bis, bericht, lehrer], { bereiche: ['Vertretung', 'Stammdaten'], aktiv: !!berichte });
  const zeitraum = (i: number) => {
    const d = new Date();
    if (i === 1) { setVon(iso(new Date(d.getFullYear(), d.getMonth(), 1))); setBis(iso(new Date(d.getFullYear(), d.getMonth() + 1, 0))); }
    if (i === 2) { setVon(iso(new Date(d.getFullYear(), d.getMonth() - 1, 1))); setBis(iso(new Date(d.getFullYear(), d.getMonth(), 0))); }
    if (i === 3) { const m = new Date(d); m.setDate(d.getDate() - ((d.getDay() + 6) % 7)); const s = new Date(m); s.setDate(m.getDate() + 6); setVon(iso(m)); setBis(iso(s)); }
    if (i === 4) { const j = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1; setVon(`${j}-08-01`); setBis(`${j + 1}-07-31`); }
  };
  const zeilen = (daten?.zeilen || []).map((z, i) => ({ ...z, i }));
  return (
    <AnsichtRahmen titel="Vertretungsstatistik" laden={laedt}
      werkzeuge={<>
        <Werkzeug text="Als HTML öffnen" titel="Dokument (HTML) zum Drucken" aktion={() => window.open(api.dok(`/abrechnung/statistik.html?${q()}`), '_blank')} />
        <Werkzeug text="CSV exportieren" titel="Tabelle als CSV-Datei herunterladen" aktion={() => dateiHerunterladen(api.dok(`/abrechnung/statistik.csv?${q()}`), 'Statistik.csv')} />
        <MenueKnopf text="Weitere Aktionen" eintraege={[{ text: 'HTML für alle Lehrkräfte (je Lehrkraft eine Seite)', aktion: () => window.open(api.dok(`/abrechnung/statistik.html?${q(true)}`), '_blank') }]} />
      </>}
      filter={<>
        <Feld titel="Auswertung"><SuchAuswahl size="small" breite={260} ariaLabel="Auswertung" wert={String(bericht)} beiWahl={(w) => setBericht(Number(w))} optionen={(berichte || []).map((x) => ({ wert: String(x.nr), text: x.text }))} /></Feld>
        <Feld titel="Lehrkraft"><SuchAuswahl size="small" breite={180} ariaLabel="Lehrkraft" disabled={!mitLehrer} wert={lehrer ? String(lehrer) : ''} beiWahl={(w) => setLehrer(Number(w))} platzhalter="Suchen …"
          optionen={lehrkraefte.map((l) => ({ wert: String(l.id), kurz: l.k, text: l.l ? `${l.k} – ${l.l}` : l.k }))} /></Feld>
        <Feld titel="Von"><DatumFeld size="small" wert={von} beiAenderung={(datum) => setVon(datum)} /></Feld>
        <Feld titel="Bis"><DatumFeld size="small" wert={bis} beiAenderung={(datum) => setBis(datum)} /></Feld>
        <SuchAuswahl size="small" breite={170} wert="" platzhalter="Zeitraum wählen" title="Zeitraum übernehmen" ariaLabel="Zeitraum übernehmen" beiWahl={(w) => { if (w) zeitraum(Number(w)); }}
          optionen={['Aktueller Monat', 'Vormonat', 'Aktuelle Woche', 'Schuljahr'].map((t, i) => ({ wert: String(i + 1), text: t }))} />
      </>}
      fuss={daten?.summe ? <span style={{ whiteSpace: 'pre-wrap' }}>{daten.summe}</span> : null}>
      <Tabelle key={`${daten?.nr}-${daten?.kopf.length}`} name="statistik" id={(z) => z.i} zeilen={zeilen} leerText="Keine Einträge im gewählten Zeitraum."
        zeilenKlasse={(z) => (z.markierung ? `abr-${z.markierung}` : null)}
        beiDoppelklick={(z) => { if (daten?.nr === 0 && z.lehrer) { setLehrer(z.lehrer); setBericht(1); } }}
        spalten={(daten?.kopf || []).map((titel, i) => ({ schluessel: `c${i}`, titel, breite: daten!.breiten[i], art: 'NurLesen' as const, wert: (z: (typeof zeilen)[number]) => z.werte[i] }))} />
    </AnsichtRahmen>
  );
}
