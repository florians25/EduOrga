// Legende und Filter: Arten der Stunden mit Anzahl in dieser Woche; Klick hebt eine Art hervor (die übrigen treten zurück).
// Dazu die Tabelle „Änderungstyp | Darstellung“ mit je einer Musterkarte (gleiche Regeln wie die Stundenkarte, aenderung.ts).
import { Box, ButtonBase, Stack, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography, useTheme } from '@mui/material';
import type { Karte } from '../../api/types';
import { artVon, type Art, type Typ } from './logik';
import { useDarstellung, type Kartendarstellung } from './darstellung';
import { Feld, mischen, schraffur, StatusFeld } from './Kachel';
import { LEGENDE_EINTRAEGE, type Legendeneintrag } from './aenderung';

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
    aenderung: { background: `${schraffur(s.aenderung.main)} left / 3px 100% no-repeat, ${s.aenderung.flaeche}`, border: `1px solid ${alpha(s.aenderung.main, 0.5)}` },
    entfall: { background: `${schraffur(s.entfall.main)} left / 3px 100% no-repeat, ${s.entfall.flaeche}`, border: `1px solid ${alpha(s.entfall.main, 0.5)}` },
    pruefung: { background: d.statusflaeche ? s.pruefung.flaeche : papier, border: `1px solid ${s.pruefung.main}` },
    termin: { background: pal.kachel.ereignis, border: `1px solid ${pal.kachel.ereignisRand}` },
    abwesend: { background: `${schraffur(s.aenderung.main)} left / 3px 100% no-repeat, ${s.aenderung.flaeche}`, border: `1px dashed ${alpha(s.aenderung.main, 0.6)}` },
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

/** Musterkarte der Legende: dieselbe Fläche, Kante, Zeilen, Felder und Durchstreichung wie die Stundenkarte. */
export function Musterkarte({ e }: { e: Legendeneintrag }) {
  const t = useTheme();
  const pal = (t.vars ?? t).palette;
  if (e.notiz) return (
    <Box aria-hidden sx={{ width: 104, minHeight: 64, p: '5px 6px', borderRadius: '4px', bgcolor: 'kachel.notiz', color: 'kachel.notizText', border: 1, borderColor: 'kachel.notizRand', fontSize: 11.5, lineHeight: '14px' }}>{e.notiz}</Box>
  );
  const entfall = e.ton === 'entfall';
  const flaeche = e.ton && e.ton !== 'offen' ? pal.status[e.ton].flaeche : pal.background.paper;
  const kante = e.ton ? pal.status[e.ton].main : pal.kachel.balken;
  return (
    <Box aria-hidden data-muster={e.id} sx={{ position: 'relative', width: 104, minHeight: 64, pl: '10px', pr: '4px', py: '3px', borderRadius: '4px', bgcolor: flaeche, overflow: 'hidden',
      boxShadow: e.ton && e.ton !== 'offen' ? `inset 0 0 0 1px ${mischen(kante, 0.35)}` : '0 1px 1.5px rgba(12,44,49,.14), 0 0 0 0.5px rgba(12,44,49,.07)', fontVariantNumeric: 'tabular-nums' }}>
      <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: e.ton === 'offen' ? `repeating-linear-gradient(180deg, ${kante} 0 4px, transparent 4px 7px)` : e.ton ? schraffur(kante) : kante }} />
      {e.zeilen.map((z, i) => (
        <Typography key={i} component="div" noWrap sx={{ fontSize: i ? 11.5 : 12.5, lineHeight: i ? '14px' : '16px', fontWeight: i ? 400 : 600, textDecoration: entfall ? 'line-through' : 'none',
          color: entfall ? (i ? 'status.entfall.text' : 'status.entfall.main') : i ? 'text.secondary' : 'text.primary' }}>
          {z.map((x, j) => x.feld ? <Feld key={j} ton={x.feld} klein>{x.text}</Feld> : <span key={j}>{x.text}</span>)}
        </Typography>
      ))}
      {e.status && <Box sx={{ mt: '2px' }}><StatusFeld s={e.status} klein /></Box>}
    </Box>
  );
}

/** Tabelle „Änderungstyp | Darstellung“ (Hilfe zum Stundenplan, Legende) – wie die Liste im Enbrea-Leitfaden, in EduOrga-Farben. */
export function LegendeTabelle() {
  return (
    <Table size="small" aria-label="Änderungstypen und ihre Darstellung" sx={{ '& td, & th': { verticalAlign: 'top' } }}>
      <TableHead><TableRow><TableCell>Änderungstyp</TableCell><TableCell sx={{ width: 128 }}>Darstellung</TableCell></TableRow></TableHead>
      <TableBody>
        {LEGENDE_EINTRAEGE.map(e => (
          <TableRow key={e.id} data-legende={e.id}>
            <TableCell>
              <Typography sx={{ fontWeight: 600, fontSize: 13.5 }}>{e.titel}</Typography>
              <Typography variant="body2" color="text.secondary">{e.text}</Typography>
            </TableCell>
            <TableCell><Musterkarte e={e} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
