// Klassenbuch-Bereich: eigene Unternavigation für alle Klassenbuch-Seiten des Kollegiums – am Desktop als Spalte links neben dem Inhalt,
// auf Tablet und Telefon als waagerechte Reiterleiste. Gegliedert in „Unterricht“ (Wochenübersicht, Meine Stunden, Offene Stunden,
// Inhalte & Hausaufgaben, Hausaufgaben), „Schüler*innen“ (Abwesenheiten mit Meldungen der Eltern, Fehlzeiten, Fehlzeiten eigener Unterricht,
// Befreiungen, Einträge) und „Klasse“ (Klassendienste, Sitzplan, Auswertungen, Einstellungen). Angezeigt wird nur, was das Konto laut
// Menü (Rechte wie auf dem Server) aufrufen darf; die bisherigen Adressen bleiben unverändert. Die zuletzt gewählte Klasse gilt für die
// Links mit Klasse (Wochenübersicht, Fehlzeiten, Inhalte, Klassendienste, Sitzplan).
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Box, Link, Tab, Tabs, Typography, useMediaQuery, useTheme } from '@mui/material';
import { holen } from '../../api/client';
import { allePunkte, menue } from '../../app/menue';
import { useSitzung } from '../../app/sitzung';
import { lesen, schreiben } from '../../lib/speicher';

interface Eintrag { nav: string; text: string; href: (klasse: string) => string; zahl?: 'meldungen' }
const GRUPPEN: { titel: string; punkte: Eintrag[] }[] = [
  { titel: 'Unterricht', punkte: [
    { nav: 'klassenbuch-woche', text: 'Wochenübersicht', href: k => `#/klassenbuch/${encodeURIComponent(k || '-')}/woche` },
    { nav: 'klassenbuch', text: 'Meine Stunden', href: () => '#/klassenbuch' },
    { nav: 'offen', text: 'Offene Stunden', href: () => '#/offen' },
    { nav: 'klassenbuch-verlauf', text: 'Inhalte & Hausaufgaben', href: k => `#/klassenbuch/${encodeURIComponent(k || '-')}/verlauf` },
    { nav: 'hausaufgaben', text: 'Hausaufgaben', href: () => '#/hausaufgaben' },
  ] },
  { titel: 'Schüler*innen', punkte: [
    { nav: 'abwesenheiten', text: 'Abwesenheiten', href: () => '#/abwesenheiten', zahl: 'meldungen' },
    { nav: 'fehlzeiten', text: 'Fehlzeiten der Klasse', href: k => `#/klassenbuch/${encodeURIComponent(k || '-')}/fehlzeiten` },
    { nav: 'entschuldigen', text: 'Fehlzeiten eigener Unterricht', href: () => '#/entschuldigen' },
    { nav: 'befreiungen', text: 'Befreiungen', href: k => (k ? `#/befreiungen/${encodeURIComponent(k)}` : '#/befreiungen') },
    { nav: 'eintraege', text: 'Klassenbucheinträge', href: () => '#/eintraege' },
  ] },
  { titel: 'Klasse', punkte: [
    { nav: 'dienste', text: 'Klassendienste', href: k => (k ? `#/dienste/${encodeURIComponent(k)}` : '#/dienste') },
    { nav: 'sitzplan', text: 'Sitzplan', href: k => (k ? `#/sitzplan/${encodeURIComponent(k)}` : '#/sitzplan') },
    { nav: 'berichte', text: 'Auswertungen', href: () => '#/berichte' },
    { nav: 'kbeinstellungen', text: 'Einstellungen', href: () => '#/kbeinstellungen' },
  ] },
];

/** Menüpunkte (nav), die im Klassenbuch-Bereich mit Unternavigation erscheinen. */
export const KLASSENBUCH_NAVS = new Set(GRUPPEN.flatMap(g => g.punkte.map(p => p.nav)).concat(['klassenbuch-vermerke']));

const SCHLUESSEL = 'untplan:kb-klasse';
/** Zuletzt gewählte Klasse im Klassenbuch (für die Links der Unternavigation). */
export const kbKlasse = () => lesen<string>(SCHLUESSEL, '', true);
export const kbKlasseMerken = (k: string) => { if (k && k !== '-') schreiben(SCHLUESSEL, k, true); };

export function KlassenbuchRahmen({ nav, children }: { nav: string; children: ReactNode }) {
  const t = useTheme();
  const breit = useMediaQuery(t.breakpoints.up('lg'));
  const { ich } = useSitzung();
  const erlaubt = useMemo(() => new Set(allePunkte(menue(ich)).map(p => p.nav)), [ich]);
  const [meldungen, setMeldungen] = useState(0);
  const klasse = kbKlasse();
  useEffect(() => {
    if (!erlaubt.has('abwesenheiten')) return;
    let ok = true;
    holen<unknown[]>('/api/app/abwesenheiten/meldungen?status=gemeldet').then(l => ok && setMeldungen(l.length)).catch(() => undefined);
    return () => { ok = false; };
  }, [erlaubt, nav]);
  const gruppen = GRUPPEN.map(g => ({ ...g, punkte: g.punkte.filter(p => erlaubt.has(p.nav)) })).filter(g => g.punkte.length);
  const aktiv = nav === 'klassenbuch-vermerke' ? 'eintraege' : nav;
  const zahl = (p: Eintrag) => (p.zahl === 'meldungen' && meldungen > 0 ? meldungen : 0);
  const text = (p: Eintrag) => (p.nav === 'klassenbuch' && !ich.element ? 'Stunden suchen' : p.text);

  if (!breit) {
    const alle = gruppen.flatMap(g => g.punkte);
    return (
      <Box>
        <Box className="nicht-drucken" sx={{ mx: { xs: -1.5, sm: -2.5 }, mt: { xs: -1, sm: -0.5 }, mb: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Tabs value={alle.some(p => p.nav === aktiv) ? aktiv : false} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile aria-label="Klassenbuch"
            sx={{ minHeight: 44, '& .MuiTab-root': { minHeight: 44, px: 1.5, fontSize: 13.5 } }}>
            {alle.map(p => <Tab key={p.nav} value={p.nav} href={p.href(klasse)} component="a" label={zahl(p) ? `${text(p)} (${zahl(p)})` : text(p)} />)}
          </Tabs>
        </Box>
        {children}
      </Box>
    );
  }
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '212px minmax(0, 1fr)', gap: 3, alignItems: 'start' }}>
      <Box component="nav" aria-label="Klassenbuch" className="nicht-drucken" sx={{ position: 'sticky', top: 16, border: 1, borderColor: 'divider', borderRadius: 1.5, bgcolor: 'background.paper', overflow: 'hidden' }}>
        <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <Typography sx={{ fontWeight: 600, fontSize: 14 }}>Klassenbuch</Typography>
          {klasse && <Typography variant="caption" color="text.secondary">Zuletzt gewählt: Klasse {klasse}</Typography>}
        </Box>
        {gruppen.map(g => (
          <Box key={g.titel} sx={{ py: 0.75, borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
            <Typography sx={{ px: 2, pt: 0.5, pb: 0.25, fontSize: 12, color: 'text.secondary', fontWeight: 500 }}>{g.titel}</Typography>
            {g.punkte.map(p => {
              const an = p.nav === aktiv;
              return (
                <Link key={p.nav} href={p.href(klasse)} underline="none" aria-current={an ? 'page' : undefined}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 0.75, fontSize: 13.5, color: an ? 'primary.main' : 'text.primary', fontWeight: an ? 600 : 400,
                    bgcolor: an ? 'action.selected' : 'transparent', boxShadow: an ? `inset 3px 0 0 ${t.palette.secondary.main}` : 'none', '&:hover': { bgcolor: an ? 'action.selected' : 'action.hover' } }}>
                  <Box component="span" sx={{ flex: 1 }}>{text(p)}</Box>
                  {zahl(p) > 0 && <Box component="span" sx={{ color: 'secondary.main', fontSize: 12.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }} title="Abwesenheitsmeldungen zu bestätigen">{zahl(p)}</Box>}
                </Link>
              );
            })}
          </Box>
        ))}
      </Box>
      <Box sx={{ minWidth: 0 }}>{children}</Box>
    </Box>
  );
}
