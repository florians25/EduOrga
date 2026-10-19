// Legende und Filter: Arten der Stunden mit Anzahl in dieser Woche; Klick hebt eine Art hervor (die übrigen treten zurück).
import { Box, ButtonBase, Stack, Tooltip, useTheme } from '@mui/material';
import type { Karte } from '../../api/types';
import { artVon, type Art, type Typ } from './logik';
import { useDarstellung, type Kartendarstellung } from './darstellung';
import { mischen } from './Kachel';

export const ARTEN: { art: Art; text: string; hinweis: string }[] = [
  { art: 'aenderung', text: 'Änderung', hinweis: 'Vertretung, Raum- oder Fachwechsel, Zusatzstunde – violette Linie, neues Kürzel als violette Plakette, das bisherige grau durchgestrichen davor, offene Vertretung als „?“' },
  { art: 'entfall', text: 'Entfall', hinweis: 'Die Stunde fällt aus (rot durchgestrichen, fein schraffiert)' },
  { art: 'pruefung', text: 'Prüfung', hinweis: 'Klausur, Klassenarbeit oder Test' },
  { art: 'termin', text: 'Termin', hinweis: 'Veranstaltung oder Aktivität' },
  { art: 'abwesend', text: 'Vertreten', hinweis: 'Die Lehrkraft ist abwesend, andere halten die Stunde (gestrichelte Linie)' },
  { art: 'buchung', text: 'Buchung', hinweis: 'Raumbuchung bzw. vorgemerkte Meldung' },
];

/** Beschreibung der regulären Kachel nach der Kartendarstellung (Hilfe). */
export function unterrichtHinweis(d: Kartendarstellung) {
  const flaeche = d.flaeche === 'neutral' ? 'helle Kachel' : d.flaeche === 'getoent' ? 'leicht getönte Kachel' : 'weiße Kachel';
  const fach = {
    'balken-innen': 'die Fachfarbe steht als schmaler Streifen innen links', quadrat: 'die Fachfarbe steht als kleines Quadrat vor dem Fachkürzel', 'balken-links': 'die Fachfarbe steht als Balken am linken Rand',
    'balken-flaeche': 'die Fachfarbe steht als Balken am linken Rand, die Kachel ist leicht getönt', 'balken-oben': 'die Fachfarbe steht als Balken am oberen Rand', flaeche: 'die Kachel ist leicht in der Fachfarbe getönt', keine: 'ohne Fachfarbe',
  }[d.fachfarbe];
  return `${flaeche}, ${fach}`;
}

/** Kleines Muster einer Kachelart (Legende, Hilfe): weiße Fläche mit der Linie bzw. Schraffur der Art; „Unterricht“ nach der Kartendarstellung. */
export function Muster({ art, gross = false }: { art: Art | 'regulaer'; gross?: boolean }) {
  const t = useTheme();
  const { d } = useDarstellung();
  const pal = (t.vars ?? t).palette;
  const alpha = mischen;
  const s = pal.status;
  const papier = pal.background.paper;
  const stil: Record<string, object> = {
    regulaer: {
      background: d.fachfarbe === 'flaeche' || d.fachfarbe === 'balken-flaeche' ? alpha(pal.primary.main, d.deckkraft / 100) : d.flaeche === 'neutral' ? pal.kachel.flaeche : papier,
      border: `1px solid ${d.rahmen === 'keiner' || d.rahmen === 'schatten' ? alpha(pal.text.primary, 0.12) : d.rahmen === 'kraeftig' ? alpha(pal.text.primary, 0.42) : pal.kachel.rand}`,
      ...(d.fachfarbe === 'balken-innen' ? { boxShadow: `inset 3px 0 0 ${papier}, inset 5px 0 0 ${pal.primary.main}` }
        : d.fachfarbe === 'balken-links' || d.fachfarbe === 'balken-flaeche' ? { boxShadow: `inset ${Math.min(3, d.balkenbreite)}px 0 0 ${pal.primary.main}` }
        : d.fachfarbe === 'balken-oben' ? { boxShadow: `inset 0 ${Math.min(3, d.balkenbreite)}px 0 ${pal.primary.main}` } : {}) },
    aenderung: { background: d.statusflaeche ? s.aenderung.flaeche : papier, border: `1px solid ${s.aenderung.main}` },
    entfall: { background: `repeating-linear-gradient(135deg, ${alpha(s.entfall.main, 0.45)} 0 1px, transparent 1px 3px), ${papier}`, border: `1px solid ${alpha(s.entfall.main, 0.7)}` },
    pruefung: { background: d.statusflaeche ? s.pruefung.flaeche : papier, border: `1px solid ${s.pruefung.main}` },
    termin: { background: papier, border: `1px dashed ${pal.text.secondary}` },
    abwesend: { background: papier, border: `1px dashed ${pal.text.secondary}` },
    buchung: { background: papier, border: `1px dashed ${s.frei.main}` },
  };
  return <Box component="span" aria-hidden sx={{ display: 'inline-block', width: gross ? 20 : 10, height: gross ? 14 : 10, borderRadius: '1px', flex: 'none', ...stil[art] }} />;
}

export function zaehlen(karten: Karte[], typ: Typ) {
  const n = new Map<Art, number>();
  for (const k of karten) { if (k.ereignis) continue; const a = artVon(k, typ); n.set(a, (n.get(a) ?? 0) + 1); }
  return n;
}

export function Legende({ karten, typ, fokus, setFokus }: { karten: Karte[]; typ: Typ; fokus: Set<Art>; setFokus: (s: Set<Art>) => void }) {
  const n = zaehlen(karten, typ);
  const gezeigt = ARTEN.filter(a => (n.get(a.art) ?? 0) > 0 || ['aenderung', 'entfall', 'pruefung'].includes(a.art));
  const t = useTheme();
  return (
    <Stack direction="row" columnGap={2} rowGap={0.5} flexWrap="wrap" alignItems="center" role="group" aria-label="Hervorheben">
      {gezeigt.map(a => {
        const an = fokus.has(a.art);
        const anzahl = n.get(a.art) ?? 0;
        return (
          <Tooltip key={a.art} title={`${a.hinweis}. Klick: nur diese hervorheben`}>
            <ButtonBase onClick={() => { const neu = new Set(fokus); if (an) neu.delete(a.art); else neu.add(a.art); setFokus(neu); }} aria-pressed={an}
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 24, px: 0.25, borderRadius: '2px', fontSize: 12.5, fontWeight: an ? 600 : 400,
                color: an ? 'text.primary' : anzahl ? 'text.secondary' : 'text.disabled', borderBottom: '1.5px solid', borderColor: an ? t.palette.primary.main : 'transparent',
                transition: 'color .12s, border-color .12s', '&:hover': { color: 'text.primary' } }}>
              <Muster art={a.art} />
              {a.text}
              <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums', color: anzahl ? 'text.primary' : 'text.disabled', fontWeight: 600 }}>{anzahl}</Box>
            </ButtonBase>
          </Tooltip>
        );
      })}
      {fokus.size > 0 && <ButtonBase onClick={() => setFokus(new Set())} sx={{ fontSize: 12.5, color: 'primary.main', px: 0.5, height: 24, borderRadius: '2px', '&:hover': { textDecoration: 'underline' } }}>Alle zeigen</ButtonBase>}
    </Stack>
  );
}
