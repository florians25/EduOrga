// Legende und Filter: Arten der Stunden mit Anzahl in dieser Woche; Klick hebt eine Art hervor (die übrigen treten zurück).
// Dazu die „Kennzeichnungen“: je Gruppe (Unterricht, Geändert, Offen, Entfällt, Hinweise) eine Musterkarte und die Tags mit
// einem Satz – gleiche Regeln wie die Stundenkarte (aenderung.ts).
import { Box, ButtonBase, Stack, Tooltip, Typography, useTheme } from '@mui/material';
import type { Karte } from '../../api/types';
import { artVon, type Art, type Typ } from './logik';
import { useDarstellung, type Kartendarstellung } from './darstellung';
import { Feld, leiste, mischen, StatusFeld } from './Kachel';
import { KENNZEICHNUNGEN, type Kennzeichengruppe } from './aenderung';

export const ARTEN: { art: Art; text: string; hinweis: string }[] = [
  { art: 'aenderung', text: 'Änderung', hinweis: 'Vertretung, Raum- oder Fachwechsel, Verlegung, Zusatzstunde – grüne Fläche, schraffierte Kante, der neue Wert im grünen Feld „+neu (bisher)“' },
  { art: 'entfall', text: 'Entfall', hinweis: 'Die Stunde fällt aus – rote Fläche, alles durchgestrichen, Feld „× entfällt“' },
  { art: 'pruefung', text: 'Prüfung', hinweis: 'Klausur, Klassenarbeit oder Test' },
  { art: 'termin', text: 'Termin', hinweis: 'Veranstaltung oder Aktivität' },
  { art: 'abwesend', text: 'Vertreten', hinweis: 'Die Lehrkraft ist abwesend, andere halten die Stunde (grün, Vertretung im Feld)' },
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
    aenderung: { background: s.aenderung.flaeche, boxShadow: `inset 3px 0 0 ${s.aenderung.main}`, border: `1px solid ${alpha(s.aenderung.main, 0.5)}` },
    entfall: { background: s.entfall.flaeche, boxShadow: `inset 3px 0 0 ${s.entfall.main}`, border: `1px solid ${alpha(s.entfall.main, 0.5)}` },
    pruefung: { background: d.statusflaeche ? s.pruefung.flaeche : papier, border: `1px solid ${s.pruefung.main}` },
    termin: { background: pal.kachel.ereignis, border: `1px solid ${pal.kachel.ereignisRand}` },
    abwesend: { background: s.aenderung.flaeche, boxShadow: `inset 3px 0 0 ${s.aenderung.main}`, border: `1px dashed ${alpha(s.aenderung.main, 0.6)}` },
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

/** Musterkarte einer Gruppe: dieselbe Fläche, Leiste, Kennzeichen, Zeilen, Tags und Durchstreichung wie die Stundenkarte. */
export function Musterkarte({ g }: { g: Kennzeichengruppe }) {
  const t = useTheme();
  const pal = (t.vars ?? t).palette;
  const entfall = g.ton === 'entfall';
  const flaeche = g.ton && g.ton !== 'offen' ? pal.status[g.ton].flaeche : pal.background.paper;
  const offen = g.ton === 'offen';
  const kante = g.ton ? pal.status[g.ton].main : pal.kachel.balken;
  return (
    <Box aria-hidden data-muster={g.id} sx={{ position: 'relative', width: 132, flex: 'none', pl: '9px', pr: '12px', py: '4px', borderRadius: '4px', bgcolor: flaeche, overflow: 'hidden',
      border: offen ? `1px dashed ${mischen(kante, 0.9)}` : 0, boxShadow: g.ton && !offen ? `inset 0 0 0 1px ${mischen(kante, 0.35)}` : '0 1px 1.5px rgba(12,44,49,.14), 0 0 0 0.5px rgba(12,44,49,.07)', fontVariantNumeric: 'tabular-nums' }}>
      <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: leiste(kante) }} />
      {g.ton && <Box sx={{ position: 'absolute', top: 4, right: 4, width: 5, height: 5, borderRadius: 0, bgcolor: kante }} />}
      {g.muster.map((z, i) => (
        <Typography key={i} component="div" noWrap sx={{ fontSize: i ? 12 : 13, lineHeight: i ? '17px' : '18px', fontWeight: i ? 400 : 600, textDecoration: entfall ? 'line-through' : 'none',
          color: entfall ? (i ? 'status.entfall.text' : 'status.entfall.main') : i ? 'text.secondary' : 'text.primary' }}>
          {z.map((x, j) => x.feld ? <Feld key={j} ton={x.feld} klein alt={x.alt}>{x.text}</Feld> : <span key={j}>{x.text}</span>)}
        </Typography>
      ))}
      {g.status && <Box sx={{ mt: '3px' }}><StatusFeld s={g.status} klein /></Box>}
    </Box>
  );
}

/** „Kennzeichnungen“ (Legende im Plan, Hilfe): Gruppen mit Musterkarte, darunter die Tags mit einem Satz. */
export function Kennzeichnungen() {
  return (
    <Stack gap={2.5} aria-label="Kennzeichnungen im Stundenplan" role="list">
      {KENNZEICHNUNGEN.map(g => (
        <Box key={g.id} role="listitem" data-kennzeichnung={g.id} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
          {g.muster.length > 0 ? <Musterkarte g={g} /> : <Box sx={{ width: 132, flex: 'none', display: { xs: 'none', sm: 'block' } }} />}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{g.titel}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>{g.satz}</Typography>
            <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'max-content minmax(0, 1fr)', columnGap: 1.25, rowGap: 0.5, alignItems: 'baseline' }}>
              {g.eintraege.map((e, i) => (
                <Box key={i} sx={{ display: 'contents' }}>
                  <Box component="dt" sx={{ m: 0 }}>{e.tag.feld ? <Feld ton={e.tag.feld} alt={e.tag.alt}>{e.tag.text}</Feld>
                    : <Box component="span" sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary' }}>{e.tag.text}</Box>}</Box>
                  <Box component="dd" sx={{ m: 0, fontSize: 13, color: 'text.secondary' }}>{e.satz}</Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      ))}
    </Stack>
  );
}
