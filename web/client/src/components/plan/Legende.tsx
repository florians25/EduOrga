// Legende und Filter: Arten der Stunden mit Anzahl in dieser Woche; Klick hebt eine Art hervor (die übrigen treten zurück).
import { alpha, Box, ButtonBase, Stack, Tooltip, Typography, useTheme } from '@mui/material';
import type { Karte } from '../../api/types';
import { artVon, type Art, type Typ } from './logik';

export const ARTEN: { art: Art; text: string; hinweis: string }[] = [
  { art: 'aenderung', text: 'Änderung', hinweis: 'Vertretung, Raum- oder Fachwechsel, Zusatzstunde – der neue Wert ist petrol, der alte durchgestrichen' },
  { art: 'entfall', text: 'Entfall', hinweis: 'Die Stunde fällt aus (schraffiert, durchgestrichen)' },
  { art: 'pruefung', text: 'Prüfung', hinweis: 'Klausur, Klassenarbeit oder Test' },
  { art: 'termin', text: 'Termin', hinweis: 'Veranstaltung oder Aktivität' },
  { art: 'abwesend', text: 'Vertreten', hinweis: 'Die Lehrkraft ist abwesend, andere halten die Stunde' },
  { art: 'buchung', text: 'Buchung', hinweis: 'Raumbuchung bzw. vorgemerkte Meldung' },
];

export function Muster({ art, gross = false }: { art: Art | 'regulaer'; gross?: boolean }) {
  const t = useTheme();
  const s = t.palette.status;
  const stil: Record<string, object> = {
    regulaer: { background: alpha(t.palette.primary.main, 0.16), border: `1px solid ${alpha(t.palette.primary.main, 0.4)}` },
    aenderung: { background: alpha(s.aenderung.main, 0.08), border: `1.5px solid ${s.aenderung.main}` },
    entfall: { background: `repeating-linear-gradient(135deg, ${alpha(s.entfall.main, 0.35)} 0 1.5px, transparent 1.5px 4px), ${s.entfall.flaeche}`, border: `1px solid ${alpha(s.entfall.main, 0.5)}` },
    pruefung: { background: s.pruefung.flaeche, border: `1.5px solid ${s.pruefung.main}` },
    termin: { background: s.termin.flaeche, border: `1.5px dashed ${s.termin.main}` },
    abwesend: { background: t.palette.background.paper, border: `1.5px dashed ${t.palette.text.secondary}` },
    buchung: { background: s.frei.flaeche, border: `1.5px dashed ${s.frei.main}` },
  };
  return <Box component="span" aria-hidden sx={{ display: 'inline-block', width: gross ? 22 : 14, height: gross ? 16 : 11, borderRadius: 0.75, flex: 'none', ...stil[art] }} />;
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
    <Stack direction="row" gap={0.75} flexWrap="wrap" alignItems="center" role="group" aria-label="Hervorheben">
      {gezeigt.map(a => {
        const an = fokus.has(a.art);
        const anzahl = n.get(a.art) ?? 0;
        return (
          <Tooltip key={a.art} title={`${a.hinweis}. Klick: nur diese hervorheben`}>
            <ButtonBase onClick={() => { const neu = new Set(fokus); if (an) neu.delete(a.art); else neu.add(a.art); setFokus(neu); }} aria-pressed={an}
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 30, px: 1.25, borderRadius: 999, border: 1,
                borderColor: an ? 'primary.main' : 'divider', bgcolor: an ? alpha(t.palette.primary.main, 0.08) : 'background.paper', fontSize: 13, fontWeight: 500,
                color: anzahl ? 'text.primary' : 'text.disabled', transition: 'all .12s' }}>
              <Muster art={a.art} />
              {a.text}
              <Typography component="span" sx={{ fontSize: 12, fontWeight: 600, color: anzahl ? 'text.secondary' : 'text.disabled', minWidth: 10 }}>{anzahl}</Typography>
            </ButtonBase>
          </Tooltip>
        );
      })}
      {fokus.size > 0 && <ButtonBase onClick={() => setFokus(new Set())} sx={{ fontSize: 13, color: 'primary.main', px: 1, height: 30, borderRadius: 999 }}>Alle zeigen</ButtonBase>}
    </Stack>
  );
}
