// Vertretungsplan (Schüler- bzw. Lehrerversion je nach Konto): je Tag eine Karte mit Nachrichten, Veranstaltungen, abwesenden Klassen,
// Lehrkräften und gesperrten Räumen; Tabelle der Änderungen (alt durchgestrichen → neu). Filter nach Klasse bzw. Lehrkraft, 1/2/5 Tage.
import { useState } from 'react';
import { alpha, Box, Button, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, ToggleButton, ToggleButtonGroup, Typography, useTheme } from '@mui/material';
import CampaignOutlined from '@mui/icons-material/CampaignOutlined';
import { holen } from '../api/client';
import { useSitzung } from '../app/sitzung';
import { Geladen, Leer, Seite } from '../components/Seite';
import { Plakette, SuchFeld } from '../components/Bausteine';
import { ZeitNavi } from '../components/Auswahl';
import { datumLang, heuteIso, istIsoDatum } from '../lib/datum';
import { navigieren } from '../lib/router';
import { lesen, schreiben } from '../lib/speicher';
import { useLaden } from '../lib/useLaden';
import type { SeitenProps } from './register';

export interface VZeile { klassen: string; stunde: string; stundeVon: number; fach: string; fachAlt: string | null; lehrer: string; lehrerAlt: string | null; raum: string; raumAlt: string | null; art: string; text: string; vertrVon?: string; nach?: string; status: string; ohneLehrer?: boolean }
export interface VTag { datum: string; wochentag: string; woche?: string; frei: boolean; freiGrund: string | null; nachrichten: string[]; abwesendeKlassen: string[]; abwesendeLehrer: string[]; blockierteRaeume: string[]; veranstaltungen: string[]; zeilen: VZeile[] }

const TON: Record<string, 'entfall' | 'pruefung' | 'aenderung' | 'neutral'> = { entfall: 'entfall', offen: 'entfall', klausur: 'pruefung', geaendert: 'aenderung' };

function Wert({ alt, neu, status, ohneErsatz, trenn = '→' }: { alt: string | null; neu: string; status: string; ohneErsatz?: boolean; trenn?: string }) {
  const s = <Box component="s" sx={{ color: 'text.secondary', mr: 0.5 }}>{alt}</Box>;
  if (status === 'entfall') return <>{alt && s}{neu}</>;
  if (alt && !neu) return ohneErsatz ? <Box component="s" sx={{ color: 'status.aenderung.main', fontWeight: 600 }}>{alt}</Box> : s;
  if (alt) return <Box component="span" sx={{ whiteSpace: 'nowrap' }}>{s}<Box component="span" sx={{ color: 'text.disabled', mr: 0.5 }}>{trenn}</Box><Box component="span" sx={{ color: 'status.aenderung.main', fontWeight: 600 }}>{neu}</Box></Box>;
  return <>{neu}</>;
}

export function VertretungsTag({ t, kollegium, filter = '' }: { t: VTag; kollegium: boolean; filter?: string }) {
  const th = useTheme();
  const f = filter.trim().toLowerCase();
  const zeilen = f ? t.zeilen.filter(z => z.klassen.toLowerCase().split(/,\s*/).some(k => k.startsWith(f)) || (kollegium && `${z.lehrer} ${z.lehrerAlt ?? ''}`.toLowerCase().includes(f))) : t.zeilen;
  const infos: [string, string[]][] = [['Abwesende Klassen', t.abwesendeKlassen], ...(kollegium ? [['Abwesende Lehrkräfte', t.abwesendeLehrer] as [string, string[]]] : []), ['Nicht verfügbare Räume', t.blockierteRaeume]];
  return (
    <Paper variant="outlined" sx={{ borderRadius: 1.5, overflow: 'hidden', mb: 2, breakInside: 'avoid' }}>
      <Stack direction="row" alignItems="center" gap={1.5} sx={{ px: 2, py: 2, borderBottom: 1, borderColor: 'divider', bgcolor: t.datum === heuteIso() ? alpha(th.palette.primary.main, 0.05) : undefined }}>
        <Typography variant="h3" component="h2">{datumLang(t.datum)}</Typography>
        {t.woche && <Typography color="text.secondary">{t.woche}-Woche</Typography>}
        {t.datum === heuteIso() && <Plakette ton="primaer" fest>Heute</Plakette>}
        <Box sx={{ ml: 'auto' }}><Plakette>{zeilen.length} {zeilen.length === 1 ? 'Eintrag' : 'Einträge'}</Plakette></Box>
      </Stack>
      {(t.nachrichten.length > 0 || t.veranstaltungen.length > 0 || infos.some(x => x[1].length)) && (
        <Stack gap={1} sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
          {t.nachrichten.map((n, i) => <Stack key={i} direction="row" gap={1} alignItems="flex-start"><CampaignOutlined fontSize="small" color="primary" /><Typography variant="body2">{n}</Typography></Stack>)}
          {t.veranstaltungen.length > 0 && <Stack direction="row" gap={0.75} flexWrap="wrap">{t.veranstaltungen.map((v, i) => <Plakette key={i} ton="termin">{v}</Plakette>)}</Stack>}
          {infos.filter(x => x[1].length).map(([a, l]) => <Typography key={a} variant="body2"><Box component="span" sx={{ color: 'text.secondary' }}>{a}: </Box>{l.join(', ')}</Typography>)}
        </Stack>
      )}
      {t.frei ? <Typography color="text.secondary" sx={{ p: 2 }}>{t.freiGrund || 'Unterrichtsfrei'}</Typography>
        : !zeilen.length ? <Typography color="text.secondary" variant="body2" sx={{ p: 2 }}>{f ? 'Keine Einträge für diesen Filter.' : 'Keine Vertretungen.'}</Typography> : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead><TableRow><TableCell>Klasse(n)</TableCell><TableCell>Stunde</TableCell><TableCell>Fach</TableCell><TableCell>{kollegium ? 'Vertretung' : 'Lehrkraft'}</TableCell><TableCell>Raum</TableCell><TableCell>Art</TableCell><TableCell>Text</TableCell></TableRow></TableHead>
              <TableBody>{zeilen.map((z, i) => {
                const entfall = z.status === 'entfall';
                return (
                  <TableRow key={i} hover sx={{ '& td': { color: entfall ? 'text.secondary' : undefined } }}>
                    <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{z.klassen || '–'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{z.stunde}</TableCell>
                    <TableCell sx={{ textDecoration: entfall ? 'line-through' : 'none' }}><Wert alt={z.fachAlt} neu={z.fach} status={z.status} /></TableCell>
                    <TableCell sx={{ textDecoration: entfall ? 'line-through' : 'none' }}>{z.status === 'offen' ? <><Box component="s" sx={{ color: 'text.secondary', mr: 0.5 }}>{z.lehrerAlt}</Box><Box component="span" sx={{ color: 'status.entfall.main', fontWeight: 600 }}>???</Box></> : <Wert alt={z.lehrerAlt} neu={z.lehrer} status={z.status} ohneErsatz={z.ohneLehrer} trenn="|" />}</TableCell>
                    <TableCell sx={{ textDecoration: entfall ? 'line-through' : 'none' }}><Wert alt={z.raumAlt} neu={z.raum} status={z.status} /></TableCell>
                    <TableCell><Plakette ton={TON[z.status] ?? 'neutral'}>{z.art}</Plakette></TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{z.text}{z.vertrVon && <Typography variant="caption" color="text.secondary" component="div">Vertr. von {z.vertrVon}</Typography>}{z.nach && <Typography variant="caption" color="text.secondary" component="div">verlegt nach {z.nach}</Typography>}</TableCell>
                  </TableRow>
                );
              })}</TableBody>
            </Table>
          </Box>
        )}
    </Paper>
  );
}

export default function Vertretungen({ teile }: SeitenProps) {
  const { ich } = useSitzung();
  const datum = istIsoDatum(teile[0]) ? teile[0] : heuteIso();
  const [tage, setTage] = useState(() => lesen<number>('untplan:vt-tage', 2) || 2);
  const [filter, setFilter] = useState('');
  const g = useLaden(s => holen<{ tage: VTag[] }>(`/api/app/vertretungen?datum=${datum}&tage=${tage}`, s), [datum, tage]);
  return (
    <Seite titel="Vertretungsplan" untertitel={ich.kollegium ? 'Lehrerversion' : undefined} aktionen={<Stack direction="row" gap={1}>
      <Button variant="outlined" onClick={() => window.open(`/api/app/vertretungen.pdf?datum=${datum}&tage=${tage}`, '_blank', 'noopener')}>PDF</Button>
      <Button variant="outlined" title="Aushang für das Schwarze Brett: große Schrift, Querformat" onClick={() => window.open(`/api/app/vertretungen.pdf?datum=${datum}&tage=${tage}&gross=true`, '_blank', 'noopener')}>Aushang groß</Button>
    </Stack>}
      filter={<>
        <SuchFeld wert={filter} onWert={setFilter} platzhalter={ich.kollegium ? 'Klasse oder Lehrkraft filtern' : 'Klasse filtern'} breite={240} />
        <Box sx={{ flex: 1 }} />
        <ToggleButtonGroup exclusive size="small" value={tage} onChange={(_, v) => { if (v) { setTage(v); schreiben('untplan:vt-tage', v); } }}>
          {[1, 2, 5].map(n => <ToggleButton key={n} value={n}>{n === 1 ? '1 Tag' : `${n} Tage`}</ToggleButton>)}
        </ToggleButtonGroup>
        <ZeitNavi art="tag" datum={datum} onDatum={d => navigieren(`#/vertretungen/${d}`)} />
      </>}>
      <Geladen g={g}>{d => d.tage.length ? <>{d.tage.map(t => <VertretungsTag key={t.datum} t={t} kollegium={ich.kollegium} filter={filter} />)}</> : <Leer text="Keine Unterrichtstage im gewählten Zeitraum." />}</Geladen>
    </Seite>
  );
}
