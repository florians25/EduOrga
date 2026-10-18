// Tagesübersicht (Kollegium): alle Klassen, Lehrkräfte oder Räume eines Tages – Zeilen je Element, Spalten je Stunde, gleiche Kacheln wie
// im Stundenplan. Klick öffnet die Stundendetails.
import { useMemo, useState } from 'react';
import { alpha, Box, Button, Paper, Stack, Typography, useTheme } from '@mui/material';
import PrintOutlined from '@mui/icons-material/PrintOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';
import { holen } from '../api/client';
import type { Karte, PlanTyp, Tagesuebersicht } from '../api/types';
import { Geladen, Leer, Seite } from '../components/Seite';
import { Plakette, SuchFeld } from '../components/Bausteine';
import { ZeitNavi } from '../components/Auswahl';
import { Kachel } from '../components/plan/Kachel';
import { Stundendetails } from '../components/plan/Stundendetails';
import { vergangen } from '../components/plan/logik';
import { heuteIso, istIsoDatum, jetztMinuten, minuten, datumText } from '../lib/datum';
import { navigieren } from '../lib/router';
import { useLaden } from '../lib/useLaden';
import type { SeitenProps } from './register';

const TYPEN: Record<PlanTyp, string> = { klasse: 'Klassen', lehrer: 'Lehrkräfte', raum: 'Räume' };

export default function TagSeite({ teile }: SeitenProps) {
  const t = useTheme();
  const typ: PlanTyp = (['klasse', 'lehrer', 'raum'] as string[]).includes(teile[0]) ? teile[0] as PlanTyp : 'klasse';
  const datum = istIsoDatum(teile[1]) ? teile[1] : heuteIso();
  const u = teile[2] === 'u' ? '/u' : '';
  const [filter, setFilter] = useState('');
  const [details, setDetails] = useState<{ k: Karte; liste: Karte[] } | null>(null);
  const g = useLaden(s => holen<Tagesuebersicht>(`/api/app/tag?typ=${typ}&datum=${datum}`, s), [typ, datum]);
  const zeilen = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return (g.daten?.zeilen ?? []).filter(z => !f || `${z.kurz} ${z.name}`.toLowerCase().includes(f));
  }, [g.daten, filter]);
  return (
    <Seite titel={`Tag – ${TYPEN[typ]}`} untertitel={datumText(datum)} aktionen={<Button variant="outlined" startIcon={<PrintOutlined />} onClick={() => window.print()}>Drucken</Button>}
      filter={<><SuchFeld wert={filter} onWert={setFilter} platzhalter={`${TYPEN[typ]} filtern`} /><Box sx={{ flex: 1 }} /><ZeitNavi art="tag" datum={datum} onDatum={d => navigieren(`#/tag/${typ}/${d}${u}`)} /></>}>
      <Geladen g={g}>{tag => {
        const max = Math.max(6, ...tag.zeilen.flatMap(z => z.karten.map(k => k.bis)));
        const spalten = tag.zeitraster.filter(z => z.nr <= max);
        const jetzt = jetztMinuten(), heute = heuteIso();
        const alle = zeilen.flatMap(z => z.karten);
        const jetztSpalte = datum === heute ? spalten.findIndex(z => minuten(z.beginn) <= jetzt && jetzt < minuten(z.ende)) : -1;
        return (
          <>
            <Stack direction="row" gap={1} alignItems="center" sx={{ mb: 1.5 }} flexWrap="wrap">
              {!tag.gesperrt && <Plakette ton={tag.kopf.tagesaktuell ? 'ok' : 'neutral'}>{tag.kopf.tagesaktuell ? 'tagesaktuell' : 'Regelplan'}</Plakette>}
              {tag.kopf.hinweise.map((h, i) => <Plakette key={i} ton="warnung">{h}</Plakette>)}
            </Stack>
            {tag.gesperrt ? <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: '4px' }}><LockOutlined color="action" /><Typography sx={{ fontWeight: 600, mt: 1 }}>Es werden hier keine Termine angezeigt.</Typography><Typography variant="body2" color="text.secondary">{tag.sperrhinweis}</Typography></Paper>
              : tag.kopf.frei ? <Leer text={tag.kopf.freiGrund || 'Unterrichtsfrei'} />
              : !zeilen.length ? <Leer text="Keine Einträge." />
              : (
                <Paper variant="outlined" sx={{ borderRadius: '4px', overflow: 'auto' }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: `140px repeat(${spalten.length}, minmax(108px, 1fr))`, minWidth: 140 + spalten.length * 108 }}>
                    <Box sx={{ position: 'sticky', left: 0, zIndex: 2, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }} />
                    {spalten.map((z, i) => (
                      <Box key={z.nr} sx={{ px: 1, py: 0.875, borderBottom: 1, borderLeft: 1, borderColor: 'divider', bgcolor: i === jetztSpalte ? alpha(t.palette.primary.main, 0.028) : 'background.paper',
                        boxShadow: i === jetztSpalte ? `inset 0 2px 0 ${t.palette.primary.main}` : undefined, fontVariantNumeric: 'tabular-nums' }}>
                        <Typography sx={{ fontWeight: 600, fontSize: 13, lineHeight: '18px', color: i === jetztSpalte ? 'primary.main' : 'text.primary' }}>{z.bezeichnung || z.nr}.</Typography>
                        <Typography sx={{ fontSize: 11, lineHeight: '14px', color: 'text.secondary' }}>{z.beginn}–{z.ende}</Typography>
                      </Box>
                    ))}
                    {zeilen.map(z => {
                      const belegt = new Set<number>();
                      const sortiert = [...z.karten].sort((a, b) => a.von - b.von);
                      const zellen: React.ReactNode[] = [];
                      for (const s of spalten) {
                        if (belegt.has(s.nr)) continue;
                        const hier = sortiert.filter(k => k.von === s.nr);
                        if (!hier.length) { zellen.push(<Box key={s.nr} sx={{ borderLeft: 1, borderBottom: 1, borderColor: 'divider', minHeight: 64 }} />); continue; }
                        const bis = Math.min(max, Math.max(...hier.map(k => k.bis)));
                        for (let n = s.nr + 1; n <= bis; n++) belegt.add(n);
                        zellen.push(
                          <Box key={s.nr} sx={{ gridColumn: `span ${bis - s.nr + 1}`, borderLeft: 1, borderBottom: 1, borderColor: 'divider', p: '3px', display: 'flex', gap: '3px', minHeight: 64 }}>
                            {hier.map((k, i) => <Kachel key={i} k={k} typ={typ} hoehe={60} vorbei={k.status === 'regulaer' && vergangen(k, heute, jetzt)} onOpen={x => setDetails({ k: x, liste: alle })} style={{ flex: 1, minWidth: 0 }} />)}
                          </Box>,
                        );
                      }
                      return [
                        <Box key={`k-${z.kurz}`} sx={{ position: 'sticky', left: 0, zIndex: 1, bgcolor: 'background.paper', px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider', minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 600, fontSize: 13.5 }}>{z.kurz}</Typography>
                          {z.name !== z.kurz && <Typography variant="caption" color="text.secondary" noWrap component="div">{z.name}</Typography>}
                        </Box>,
                        ...zellen,
                      ];
                    })}
                  </Box>
                </Paper>
              )}
          </>
        );
      }}</Geladen>
      {details && <Stundendetails karte={details.k} liste={details.liste} typ={typ} onClose={() => setDetails(null)} onGeaendert={() => void g.neu()} />}
    </Seite>
  );
}
