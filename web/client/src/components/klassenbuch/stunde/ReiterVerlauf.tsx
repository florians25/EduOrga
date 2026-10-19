// Reiter „Verlauf“ im Fenster „Unterrichtsstunde“: frühere (und geplante) Stunden dieses Unterrichts mit Thema, Hausaufgabe und
// Bemerkung – die aktuelle Stunde hervorgehoben, jede Zeile öffnet die Stunde im selben Fenster.
import { useEffect, useState } from 'react';
import { Box, ButtonBase, Skeleton, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import { holen, qs } from '../../../api/client';
import { datumDe, heuteIso, plusTage, wochentagKurz } from '../../../lib/datum';
import { Plakette } from '../../Bausteine';
import { karteAus } from '../../plan/karte';
import { kuerzel } from '../../plan/logik';
import { Bereichskarte, Hinweis } from './bausteine';
import type { StundeProps } from './kontext';

interface Zeile { datum: string; stunde: number; unterricht?: number; fach: string; lehrer: string; thema: string; hausaufgabe: string; faellig?: string | null; notiz?: string; klassen?: string[] }
/** Stunde aus der Klassenbuch-Übersicht (Kollegium: auch Stunden ohne Eintrag, Entfall, Kontrolle). */
interface UStunde { von: number; bis: number; beginn: string; ende: string; fach: string; fachName: string; farbe: string; art?: string; klassen: string[]; lehrer: string[]; raeume: string[]; status: string; unterricht: number; lehrstoff: string; geprueft: boolean; abwesend: number; hausaufgaben: string }
type VZeile = Zeile & { u?: UStunde; bis?: number };

async function uebersicht(klasse: string, unterricht: number, von: string, bis: string): Promise<VZeile[]> {
  const teile: [string, string][] = [];
  for (let x = von; x <= bis; x = plusTage(x, 31)) teile.push([x, plusTage(x, 30) < bis ? plusTage(x, 30) : bis]);
  const r = await Promise.all(teile.map(([a, b]) => holen<{ tage: { datum: string; stunden: UStunde[] }[] }>(`/api/app/klassenbuch/uebersicht${qs({ klasse, unterricht, von: a, bis: b })}`)));
  return r.flatMap(x => x.tage).flatMap(t => t.stunden.map(u => ({ datum: t.datum, stunde: u.von, bis: u.bis, unterricht: u.unterricht, fach: u.fach, lehrer: u.lehrer.join(', '), thema: u.lehrstoff, hausaufgabe: u.hausaufgaben, klassen: u.klassen, u })))
    .sort((a, b) => b.datum.localeCompare(a.datum) || b.stunde - a.stunde);
}

export function ReiterVerlauf({ k, kollegium, oeffnen }: StundeProps) {
  const [tage, setTage] = useState(56);
  const [liste, setListe] = useState<VZeile[] | null>(null);
  const kl = kuerzel(k.klassen);
  useEffect(() => {
    let ok = true;
    setListe(null);
    if (!kl[0]) { setListe([]); return; }
    const laden: Promise<VZeile[]> = kollegium && k.unterricht ? uebersicht(kl[0], k.unterricht, plusTage(k.datum, -tage), plusTage(k.datum, 14))
      : holen<Zeile[]>(`/api/app/klassenbuch/klasse${qs({ klasse: kl[0], von: plusTage(k.datum, -tage), bis: plusTage(k.datum, 14) })}`)
        .then(l => l.filter(x => (k.unterricht && x.unterricht ? x.unterricht === k.unterricht : x.fach === k.fach)));
    laden.then(l => { if (ok) setListe(l); })
      .catch(() => ok && setListe([]));
    return () => { ok = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k.datum, k.unterricht, tage, kl[0]]);
  const heute = heuteIso();
  const hier = (z: VZeile) => z.datum === k.datum && z.stunde >= k.von && z.stunde <= k.bis;
  return (
    <Bereichskarte titel={`Verlauf · ${kl.join(', ')} ${k.fach}`} zahl={liste?.length || null}
      rechts={<ToggleButtonGroup exclusive size="small" value={tage} onChange={(_, v) => v && setTage(v)} aria-label="Zeitraum">
        <ToggleButton value={56}>8 Wochen</ToggleButton><ToggleButton value={182}>Halbjahr</ToggleButton></ToggleButtonGroup>}>
      {liste === null ? <Stack gap={1}>{[0, 1, 2, 3].map(i => <Skeleton key={i} variant="rounded" height={40} />)}</Stack>
        : !liste.length ? <Hinweis>Für diesen Unterricht gibt es im Zeitraum noch keine Einträge.</Hinweis> : (
          <Box role="list">
            {liste.map((z, i) => (
              <ButtonBase role="listitem" key={i} disabled={hier(z) || !z.unterricht} onClick={() => oeffnen(z.u ? karteAus({ datum: z.datum, von: z.u.von, bis: z.u.bis, beginn: z.u.beginn, ende: z.u.ende, status: z.u.status, fach: z.u.fach, fachName: z.u.fachName, farbe: z.u.farbe, art: z.u.art ?? '', klassen: z.u.klassen, lehrer: z.u.lehrer, raeume: z.u.raeume, unterricht: z.u.unterricht })
                : karteAus({ datum: z.datum, von: z.stunde, bis: z.stunde, fach: z.fach, klassen: z.klassen ?? kl, lehrer: z.lehrer ? [z.lehrer] : [], unterricht: z.unterricht ?? null }))}
                sx={{ width: '100%', textAlign: 'left', display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '120px 44px minmax(0, 1.4fr) minmax(0, 1fr) 20px' }, columnGap: 1.5, rowGap: 0.25, px: 1, py: 1, borderTop: 1, borderColor: 'divider', alignItems: 'baseline',
                  bgcolor: hier(z) ? 'action.selected' : 'transparent', '&:hover': { bgcolor: hier(z) ? 'action.selected' : 'action.hover' } }}>
                <Typography variant="body2" sx={{ fontWeight: hier(z) ? 600 : 400 }}>{wochentagKurz(z.datum)} {datumDe(z.datum)}</Typography>
                <Typography variant="body2" color="text.secondary">{z.bis && z.bis > z.stunde ? `${z.stunde}.–${z.bis}.` : `${z.stunde}.`}</Typography>
                <Box sx={{ minWidth: 0 }}>
                  {z.u?.status === 'entfall' ? <Plakette ton="entfall">{z.u.art || 'Entfall'}</Plakette>
                    : <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>{z.thema || (z.datum > heute ? <Box component="span" sx={{ color: 'text.disabled' }}>geplant</Box> : <Box component="span" sx={{ color: 'status.pruefung.main', fontWeight: 600 }}>Thema fehlt</Box>)}</Typography>}
                  {z.u && z.u.abwesend > 0 && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{z.u.abwesend} abwesend</Typography>}
                  {kollegium && z.notiz && <Typography variant="caption" color="text.secondary">{z.notiz}</Typography>}
                </Box>
                <Typography variant="body2" color="text.secondary">{z.hausaufgabe}{z.faellig ? ` (bis ${datumDe(z.faellig).slice(0, 6)})` : ''}</Typography>
                {!hier(z) && z.unterricht ? <ChevronRightRounded sx={{ color: 'text.disabled', fontSize: 18 }} /> : <span />}
              </ButtonBase>
            ))}
          </Box>
        )}
    </Bereichskarte>
  );
}
