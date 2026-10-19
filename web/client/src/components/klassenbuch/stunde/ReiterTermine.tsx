// Reiter „Prüfungen“ im Fenster „Unterrichtsstunde“: Prüfungen der Klasse(n) vier Wochen zurück bis drei Monate voraus (geplante und
// vorgemerkte), die Prüfung dieser Stunde hervorgehoben; „Prüfung erstellen“, „Prüfung bearbeiten“ und „Prüfung löschen“ wie bisher.
import { useEffect, useState } from 'react';
import { Box, Button, Skeleton, Stack, Typography } from '@mui/material';
import { holen } from '../../../api/client';
import { datumDe, heuteIso, plusTage, wochentagKurz } from '../../../lib/datum';
import { Plakette } from '../../Bausteine';
import { kuerzel } from '../../plan/logik';
import { Bereichskarte, Hinweis } from './bausteine';
import type { StundeProps } from './kontext';

interface Pruefung { art: string; titel: string; klassen: string[]; fach: string; lehrer: string[]; datum: string; beginn: string; ende: string; raeume: string[]; text: string; status: string; stundeVon: number; stundeBis: number }

export function ReiterTermine({ k, setDialog, darfPruefung, istPruefung, loeschen }: StundeProps & { darfPruefung: boolean; istPruefung: boolean; loeschen: () => void }) {
  const [liste, setListe] = useState<Pruefung[] | null>(null);
  const kl = kuerzel(k.klassen);
  useEffect(() => {
    let ok = true;
    setListe(null);
    Promise.all(kl.map(x => holen<Pruefung[]>(`/api/app/pruefungen?klasse=${encodeURIComponent(x)}&von=${plusTage(k.datum, -28)}&bis=${plusTage(k.datum, 92)}`).catch(() => [] as Pruefung[])))
      .then(r => {
        if (!ok) return;
        const alle = r.flat();
        setListe(alle.filter((x, i) => alle.findIndex(y => y.datum === x.datum && y.stundeVon === x.stundeVon && y.titel === x.titel && y.klassen.join() === x.klassen.join()) === i)
          .sort((a, b) => a.datum.localeCompare(b.datum) || a.stundeVon - b.stundeVon));
      });
    return () => { ok = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k.datum, kl.join(',')]);
  const heute = heuteIso();
  const diese = (p: Pruefung) => p.datum === k.datum && p.stundeVon <= k.bis && p.stundeBis >= k.von;
  return (
    <Bereichskarte titel={`Prüfungen · ${kl.join(', ')}`} zahl={liste?.filter(p => p.datum >= heute).length || null} rechts={<>
      {istPruefung ? <>
        <Button size="small" variant="outlined" onClick={() => setDialog({ art: 'pruefungEdit' })}>Prüfung bearbeiten</Button>
        <Button size="small" variant="outlined" color="error" onClick={loeschen}>Prüfung löschen</Button>
      </> : darfPruefung && <Button size="small" variant="contained" onClick={() => setDialog({ art: 'pruefung' })}>Prüfung in dieser Stunde erstellen</Button>}
    </>}>
      {liste === null ? <Stack gap={1}>{[0, 1, 2].map(i => <Skeleton key={i} variant="rounded" height={36} />)}</Stack> : !liste.length ? <Hinweis>Keine Prüfungen in den nächsten drei Monaten.</Hinweis> : (
        <Box role="list">
          {liste.map((p, i) => {
            const vorbei = p.datum < heute, hier = diese(p);
            return (
              <Box role="listitem" key={i} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '120px 90px minmax(0, 1fr) auto' }, columnGap: 1.5, py: 1, px: 1, mx: -1, borderTop: 1, borderColor: 'divider', alignItems: 'baseline',
                opacity: vorbei ? 0.6 : 1, bgcolor: hier ? 'status.pruefung.flaeche' : 'transparent', borderRadius: hier ? 1 : 0 }}>
                <Typography variant="body2" sx={{ fontWeight: hier ? 600 : 400 }}>{wochentagKurz(p.datum)} {datumDe(p.datum)}</Typography>
                <Typography variant="body2" color="text.secondary">{p.stundeVon === p.stundeBis ? `${p.stundeVon}. Std.` : `${p.stundeVon}.–${p.stundeBis}. Std.`}</Typography>
                <Typography variant="body2"><b>{p.fach || p.titel}</b>{p.art ? ` · ${p.art}` : ''}{p.text && p.text !== p.art ? <Typography component="span" variant="body2" color="text.secondary"> · {p.text}</Typography> : null}
                  <Typography component="span" variant="caption" color="text.secondary"> · {p.klassen.join(', ')}{p.lehrer.length ? ` · ${p.lehrer.join(', ')}` : ''}</Typography></Typography>
                <Stack direction="row" gap={0.5}>{hier && <Plakette ton="pruefung">Diese Stunde</Plakette>}{p.status === 'vorgemerkt' && <Plakette>vorgemerkt</Plakette>}</Stack>
              </Box>
            );
          })}
        </Box>
      )}
    </Bereichskarte>
  );
}
