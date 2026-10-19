// Heute – Startseite: Datum, letzte Anmeldung und Planaktualisierung, Nachrichten zum Tag (formatierte Tagestexte, RSS, Bearbeiten),
// Hinweis auf offene Stunden, Sprechtag und „Mein nächster Unterricht“ als Zeitleiste (Uhrzeit, Fach in der Fachfarbe, Klasse, Raum,
// Lehrkraft, Status, Klassenbuch-Stand). Klick öffnet die Stundendetails.
import { useState } from 'react';
import { alpha, Alert, Box, Button, ButtonBase, Grid, IconButton, Link, Paper, Stack, Tooltip, Typography, useTheme } from '@mui/material';
import RssFeedRounded from '@mui/icons-material/RssFeedRounded';
import EditOutlined from '@mui/icons-material/EditOutlined';
import HourglassBottomRounded from '@mui/icons-material/HourglassBottomRounded';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import CheckRounded from '@mui/icons-material/CheckRounded';
import VideocamOutlined from '@mui/icons-material/VideocamOutlined';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import { holen } from '../api/client';
import type { Karte, Wert } from '../api/types';
import { useSitzung } from '../app/sitzung';
import { Abschnitt, Geladen, Leer, Seite } from '../components/Seite';
import { Plakette } from '../components/Bausteine';
import { WerteListe } from '../components/plan/Werte';
import { Stundendetails } from '../components/plan/Stundendetails';
import { FachMarke } from '../components/plan/darstellung';
import { gueltigeFarbe } from '../components/plan/logik';
import { datumDe, datumText, heuteIso, jetztMinuten, minuten, wochentag, zeitstempel } from '../lib/datum';
import { htmlBereinigt } from '../lib/html';
import { useLaden } from '../lib/useLaden';
import { SprechtagKarte } from './sprechtag/SprechtagKarte';
import { UpdateHinweis } from '../app/Update';

interface Nachricht { betreff?: string; text: string; textHtml?: string; aufgefaechert?: boolean }
interface Stunde {
  stunde: number; von: number; bis: number; beginn: string; ende: string; status: string; fach: string; fachAlt?: string | null; fachName?: string; farbe?: string;
  klassen: Wert[]; raeume: Wert[]; lehrer: Wert[]; art?: string; text?: string; unterricht?: number | null; gruppe?: string; zusaetzlich?: boolean; online?: boolean; onlineLink?: string;
  geprueft?: boolean; lehrstoff?: string; hausaufgabe?: string; hausaufgabeFaellig?: boolean; notizSchueler?: string; notizLehrer?: string; lehrerAbwesend?: boolean; vertretungOffen?: boolean;
}
interface Start { datum: string; tag?: string; letzteAnmeldung: string | null; planAktualisiert: string | null; nachrichten: Nachricht[]; rss: boolean; frei?: string | null; stunden: Stunde[]; keinPlan: boolean; offeneStunden: number; typ?: string }

export function Tagestext({ n }: { n: Nachricht }) {
  return n.textHtml ? <Box component="span" sx={{ whiteSpace: 'normal', '& p': { m: 0 } }} dangerouslySetInnerHTML={{ __html: htmlBereinigt(n.textHtml) }} /> : <Box component="span" sx={{ whiteSpace: 'pre-line' }}>{n.text}</Box>;
}

function NachrichtEintrag({ n }: { n: Nachricht }) {
  const [auf, setAuf] = useState(false);
  if (!n.betreff) return <Typography component="div" sx={{ py: 1.25, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}><Tagestext n={n} /></Typography>;
  return (
    <Box sx={{ py: 1.25, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}>
      {n.aufgefaechert ? <Typography sx={{ fontWeight: 600 }}>{n.betreff}</Typography>
        : <ButtonBase onClick={() => setAuf(!auf)} aria-expanded={auf} sx={{ fontWeight: 600, fontSize: 14, gap: 0.5 }}><ChevronRightRounded fontSize="small" sx={{ transform: auf ? 'rotate(90deg)' : 'none', transition: 'transform .12s' }} />{n.betreff}</ButtonBase>}
      {(n.aufgefaechert || auf) && <Typography component="div" variant="body2" sx={{ mt: 0.5, pl: n.aufgefaechert ? 0 : 3 }}><Tagestext n={n} /></Typography>}
    </Box>
  );
}

function statusPlaketten(s: Stunde) {
  const l: React.ReactNode[] = [];
  if (s.status === 'entfall') l.push(<Plakette key="e" ton="entfall" fest>Entfall</Plakette>);
  else if (s.status === 'offen' || s.vertretungOffen) l.push(<Plakette key="o" ton="aenderung">Vertretung offen</Plakette>);
  else if (s.status === 'abwesend') l.push(<Plakette key="a">vertreten</Plakette>);
  else if (s.status === 'klausur') l.push(<Plakette key="k" ton="pruefung" fest>Prüfung</Plakette>);
  else if (s.status === 'veranstaltung') l.push(<Plakette key="v" ton="termin">Termin</Plakette>);
  else if (s.status === 'buchung') l.push(<Plakette key="b">Raumbuchung</Plakette>);
  else if (s.status === 'vorgemerkt') l.push(<Plakette key="m">vorgemerkt</Plakette>);
  else if (s.status === 'geaendert') l.push(<Plakette key="g" ton="aenderung" fest title={s.art}>{s.zusaetzlich ? 'Zusätzlich' : 'Änderung'}</Plakette>);
  if (s.online && s.status !== 'entfall') l.push(<Plakette key="on" ton="primaer"><VideocamOutlined sx={{ fontSize: 14 }} />Online</Plakette>);
  return l;
}

export default function Heute() {
  const { ich, familie } = useSitzung();
  const t = useTheme();
  const g = useLaden(() => holen<Start>('/api/app/start'), []);
  const [details, setDetails] = useState<{ k: Karte; liste: Karte[] } | null>(null);
  return (
    <Seite dokumentTitel="Mein Tag">
      <UpdateHinweis />
      <Geladen g={g}>{d => {
        const stunden = (d.stunden ?? []).slice().sort((a, b) => a.stunde - b.stunde || (a.status === 'entfall' ? 0 : 1) - (b.status === 'entfall' ? 0 : 1));
        const mitStunden = !familie && !d.keinPlan && (stunden.length > 0 || ich.kollegium);
        const tag = d.tag ?? d.datum;
        const anderTag = tag !== d.datum;
        const karten: Karte[] = stunden.map(s => ({
          datum: tag, von: s.von, bis: s.bis, beginn: s.beginn, ende: s.ende, status: s.status, fach: s.fach, fachName: s.fachName ?? '', fachAlt: s.fachAlt ?? null, farbe: s.farbe ?? '',
          klassen: s.klassen, lehrer: s.lehrer, raeume: s.raeume, art: s.art ?? '', text: s.text ?? '', unterricht: s.unterricht ?? null, gruppe: s.gruppe ?? '', zusaetzlich: !!s.zusaetzlich,
          notizSchueler: s.notizSchueler ?? '', notizLehrer: s.notizLehrer ?? '', lehrerAbwesend: !!s.lehrerAbwesend, vertretungOffen: !!s.vertretungOffen, online: !!s.online, onlineLink: s.onlineLink ?? '',
          vertretung: null, hausaufgabeFaellig: !!s.hausaufgabeFaellig, verlegung: null, verlegungVon: null, verlegungNach: null, marker: [], abwesendeKlassen: [], abwesendText: '', bereitschaft: false, mitklassen: [],
        }));
        const eindeutig = karten.filter((x, i, a) => a.findIndex(y => y.von === x.von && y.unterricht === x.unterricht && y.status === x.status) === i);
        const jetzt = jetztMinuten();
        const mitLehrkraft = !ich.kollegium || stunden.some(s => s.lehrer.length > 1 || s.lehrer.some(w => w.alt || w.neu));
        return (
          <>
            <Stack direction="row" alignItems="baseline" gap={1.5} sx={{ mb: 2.5, pb: 1.5, borderBottom: '1px solid', borderColor: 'flaechen.rand' }} flexWrap="wrap">
              <Typography variant="h1">Mein Tag</Typography>
              <Typography sx={{ fontSize: 16, color: 'text.secondary' }}>{datumText(d.datum)}</Typography>
            </Stack>
            <Grid container spacing={2.5}>
              <Grid size={{ xs: 12, lg: mitStunden ? 7.5 : 12 }} sx={{ order: { xs: 2, lg: 1 } }}>
                {mitStunden ? (
                  <Abschnitt titel={<Box><Typography variant="h4" component="h2">{ich.kollegium ? 'Mein nächster Unterricht' : 'Nächster Unterricht'}</Typography>
                    {anderTag && <Typography variant="body2" color="text.secondary">{wochentag(tag)}, {datumDe(tag)}</Typography>}</Box>}
                    aktion={ich.element ? <Button size="small" href="#/plan/mein" endIcon={<ChevronRightRounded />}>Stundenplan</Button> : undefined}>
                    {stunden.length ? (
                      <Box sx={{ px: 1, pb: 1 }}>
                        {stunden.map((s, i) => {
                          const entfall = s.status === 'entfall';
                          const farbe = gueltigeFarbe(s.farbe) ?? t.palette.text.disabled;
                          const laeuft = tag === heuteIso() && minuten(s.beginn) <= jetzt && jetzt < minuten(s.ende);
                          const mitKb = ich.kollegium && !!s.unterricht && !entfall && s.status !== 'abwesend';
                          const info = [s.text && s.fach ? `Vertretungstext: ${s.text}` : '', s.notizLehrer ? `Notizen für Lehrkräfte: ${s.notizLehrer}` : '', s.notizSchueler ? `Notizen für Schüler*innen: ${s.notizSchueler}` : ''].filter(Boolean).join('\n');
                          return (
                            <ButtonBase key={i} onClick={() => setDetails({ k: karten[i], liste: eindeutig })} sx={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'stretch', gap: 1.5, px: 1.5, py: 1.25, borderRadius: '4px',
                              bgcolor: laeuft ? alpha(t.palette.primary.main, 0.04) : 'transparent', boxShadow: laeuft ? `inset 2px 0 0 ${t.palette.primary.main}` : 'none', '&:hover': { bgcolor: 'action.hover' } }}>
                              <Box sx={{ width: 48, flex: 'none', fontVariantNumeric: 'tabular-nums' }}>
                                <Typography sx={{ fontWeight: 600, fontSize: 13.5, lineHeight: '20px', color: laeuft ? 'primary.main' : 'text.primary' }}>{s.beginn}</Typography>
                                <Typography sx={{ fontSize: 12, lineHeight: '16px', color: 'text.secondary' }}>{s.ende}</Typography>
                              </Box>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                                  <FachMarke farbe={entfall ? null : farbe} />
                                  <Typography sx={{ fontWeight: 600, fontSize: 14, lineHeight: '20px', color: entfall ? 'status.entfall.main' : 'text.primary', textDecoration: entfall ? 'line-through' : 'none' }}>
                                    {s.fachAlt && !entfall ? <><s style={{ opacity: 0.6 }}>{s.fachAlt}</s> → {s.fach}</> : s.fach || s.text || s.art || '–'}
                                  </Typography>
                                  {s.fachName && s.fachName !== s.fach && !entfall && <Typography variant="body2" color="text.secondary">{s.fachName}</Typography>}
                                  <Typography variant="caption" color="text.secondary">{s.von === s.bis ? `${s.von}.` : `${s.von}.–${s.bis}.`} Std.</Typography>
                                  {laeuft && <Plakette ton="primaer" fest>Jetzt</Plakette>}
                                  {statusPlaketten(s)}
                                </Stack>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, textDecoration: entfall ? 'line-through' : 'none' }} component="div">
                                  {[s.klassen.length ? <WerteListe key="k" werte={s.klassen} entfall={entfall} /> : null,
                                    s.raeume.length ? <span key="r">Raum <WerteListe werte={s.raeume} entfall={entfall} /></span> : null,
                                    mitLehrkraft && s.lehrer.length ? <WerteListe key="l" werte={s.lehrer} entfall={entfall} /> : null].filter(Boolean).map((x, j) => <span key={j}>{j > 0 && ' · '}{x}</span>)}
                                </Typography>
                                {ich.kollegium && (mitKb || s.hausaufgabe || s.hausaufgabeFaellig) && (
                                  <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 0.75 }}>
                                    {mitKb && (s.geprueft ? <Plakette ton="ok"><CheckRounded sx={{ fontSize: 14 }} />Anwesenheit</Plakette> : <Plakette>Anwesenheit offen</Plakette>)}
                                    {s.unterricht && !entfall && s.status !== 'abwesend' && s.lehrstoff ? <Tooltip title={s.lehrstoff}><span><Plakette ton="primaer" sx={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.lehrstoff}</Plakette></span></Tooltip>
                                      : mitKb ? <Plakette ton="warnung">Kein Lehrstoff</Plakette> : null}
                                    {s.hausaufgabe && <Tooltip title={s.hausaufgabe}><span><Plakette>Hausaufgabe</Plakette></span></Tooltip>}
                                    {s.hausaufgabeFaellig && <Plakette ton="termin">HA fällig</Plakette>}
                                  </Stack>
                                )}
                              </Box>
                              {info && <Tooltip title={<Box sx={{ whiteSpace: 'pre-line' }}>{info}</Box>}><InfoOutlined fontSize="small" sx={{ color: 'text.secondary', alignSelf: 'center' }} /></Tooltip>}
                              <ChevronRightRounded sx={{ color: 'text.disabled', alignSelf: 'center' }} />
                            </ButtonBase>
                          );
                        })}
                      </Box>
                    ) : <Leer text={d.frei ? `Heute ist unterrichtsfrei (${d.frei}).` : 'In den nächsten Tagen ist kein Unterricht eingetragen.'} />}
                  </Abschnitt>
                ) : null}
              </Grid>
              <Grid size={{ xs: 12, lg: mitStunden ? 4.5 : 12 }} sx={{ order: { xs: 1, lg: 2 } }}>
                <Stack gap={2.5}>
                  {ich.kollegium && d.offeneStunden > 0 && (
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 1.5, display: 'flex', gap: 1.5, alignItems: 'center', bgcolor: 'status.pruefung.flaeche', borderColor: alpha(t.palette.status.pruefung.main, 0.3) }}>
                      <HourglassBottomRounded sx={{ color: 'status.pruefung.main' }} />
                      <Typography sx={{ flex: 1 }}><b>{d.offeneStunden}</b> {d.offeneStunden === 1 ? 'Stunde' : 'Stunden'} der letzten zwei Wochen ohne Lehrstoff.</Typography>
                      <Button href="#/offen" variant="contained" size="small">Offene Stunden</Button>
                    </Paper>
                  )}
                  <Abschnitt titel="Nachrichten" aktion={<Stack direction="row">
                    {d.rss && <Tooltip title="RSS-Feed der Nachrichten zum Tag"><IconButton size="small" href="/rss/nachrichten.xml" target="_blank" rel="noopener" aria-label="RSS-Feed"><RssFeedRounded fontSize="small" /></IconButton></Tooltip>}
                    {ich.nachrichten && <Tooltip title="Nachrichten zum Tag bearbeiten"><IconButton size="small" href="#/admin/nachrichten" aria-label="Nachrichten zum Tag bearbeiten"><EditOutlined fontSize="small" /></IconButton></Tooltip>}
                  </Stack>}>
                    <Box sx={{ px: 2, pb: 1.5 }}>
                      {d.nachrichten.length ? d.nachrichten.map((n, i) => <NachrichtEintrag key={i} n={n} />) : <Typography color="text.secondary" variant="body2" sx={{ py: 1 }}>Keine Tagesnachrichten</Typography>}
                    </Box>
                  </Abschnitt>
                  <SprechtagKarte />
                  {d.keinPlan && ich.admin && <Alert severity="info">Diesem Administrationskonto ist kein eigener Stundenplan zugewiesen.</Alert>}
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 1.5 }}>
                    <Typography variant="body2" color="text.secondary">Letzte Anmeldung</Typography>
                    <Typography sx={{ fontWeight: 500, mb: 1 }}>{d.letzteAnmeldung ? `${wochentag(d.letzteAnmeldung.slice(0, 10))}, ${zeitstempel(d.letzteAnmeldung)}` : '–'}</Typography>
                    <Typography variant="body2" color="text.secondary">Letzte Planaktualisierung aus EduOrga Studio</Typography>
                    <Typography sx={{ fontWeight: 500 }}>{d.planAktualisiert ? `${wochentag(d.planAktualisiert.slice(0, 10))}, ${zeitstempel(d.planAktualisiert)}` : '–'}</Typography>
                  </Paper>
                  {!ich.kollegium && <Link href="#/plan/mein" sx={{ display: ich.element ? 'block' : 'none' }}>Zum Stundenplan</Link>}
                </Stack>
              </Grid>
            </Grid>
            {details && <Stundendetails karte={details.k} liste={details.liste} typ={(d.typ as 'lehrer') ?? ich.typ ?? null} onClose={() => setDetails(null)} onGeaendert={() => void g.neu()} />}
          </>
        );
      }}</Geladen>
    </Seite>
  );
}
