// Mitteilungstext mit Markdown als React-Elemente (kein HTML aus dem Text): Überschriften, **fett**, *kursiv*, ~~durchgestrichen~~,
// [Links](…), erkannte Adressen, Listen und Zitate („> “). Externe Links öffnen erst nach einer Rückfrage, interne (/heute, #/…) direkt.
import type { ReactNode } from 'react';
import { Box, Link } from '@mui/material';
import { bestaetigen } from '../../lib/meldungen';

async function externOeffnen(url: string) {
  let host = url;
  try { host = new URL(url).host; } catch { /* ungültig */ }
  if (await bestaetigen('Externer Link', `Sie verlassen UntPlanWeb und öffnen eine externe Seite (${host}). Bitte prüfen Sie, ob Sie der Zielseite vertrauen:\n${url}`, 'Link öffnen'))
    window.open(url, '_blank', 'noopener,noreferrer');
}

function verweis(url: string, inhalt: ReactNode, key: string): ReactNode {
  if (/^https?:\/\//i.test(url)) return <Link key={key} href={url} onClick={e => { e.preventDefault(); void externOeffnen(url); }}>{inhalt}</Link>;
  if (url.startsWith('/') && !url.startsWith('//')) return <Link key={key} href={'#' + url}>{inhalt}</Link>;
  if (url.startsWith('#/')) return <Link key={key} href={url}>{inhalt}</Link>;
  return <span key={key}>{inhalt}</span>;
}

const MUSTER: { re: RegExp; bau: (m: RegExpExecArray, key: string) => ReactNode }[] = [
  { re: /\[([^\]]+)\]\(([^)\s]+)\)/, bau: (m, k) => verweis(m[2], inline(m[1], k), k) },
  { re: /\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)]/i, bau: (m, k) => verweis(m[0], m[0], k) },
  { re: /\*\*(.+?)\*\*|__(.+?)__/, bau: (m, k) => <Box component="strong" key={k} sx={{ fontWeight: 600 }}>{inline(m[1] ?? m[2], k)}</Box> },
  { re: /~~(.+?)~~/, bau: (m, k) => <del key={k}>{inline(m[1], k)}</del> },
  { re: /\*(?!\s)(.+?)\*|(?<![\w])_(?!\s)(.+?)_(?![\w])/, bau: (m, k) => <em key={k}>{inline(m[1] ?? m[2], k)}</em> },
];

function inline(s: string, schluessel = 'i'): ReactNode[] {
  const aus: ReactNode[] = [];
  let rest = s, n = 0;
  while (rest) {
    let best: { m: RegExpExecArray; bau: (m: RegExpExecArray, key: string) => ReactNode } | null = null;
    for (const { re, bau } of MUSTER) {
      const m = re.exec(rest);
      if (m && (!best || m.index < best.m.index)) best = { m, bau };
    }
    if (!best) { aus.push(rest); break; }
    if (best.m.index > 0) aus.push(rest.slice(0, best.m.index));
    aus.push(best.bau(best.m, `${schluessel}-${n++}`));
    rest = rest.slice(best.m.index + best.m[0].length);
  }
  return aus;
}

/** Klartext für Vorschauzeilen (Markdown-Zeichen entfernt). */
export const klartext = (s: string) => s.replace(/[#*_~>`]/g, '').replace(/\s+/g, ' ').trim();

export function Markdown({ text }: { text: string }) {
  const bloecke: ReactNode[] = [];
  let liste: { art: 'ul' | 'ol'; punkte: string[] } | null = null;
  const listeZu = () => {
    if (!liste) return;
    const l = liste;
    bloecke.push(<Box component={l.art} key={bloecke.length} sx={{ my: 0.5, pl: 3 }}>{l.punkte.map((p, i) => <li key={i}>{inline(p)}</li>)}</Box>);
    liste = null;
  };
  for (const z of text.split('\n')) {
    let m: RegExpMatchArray | null;
    if ((m = z.match(/^(#{1,6})\s+(.*)$/))) {
      listeZu();
      const g = m[1].length;
      bloecke.push(<Box key={bloecke.length} sx={{ fontWeight: 600, fontSize: g === 1 ? 20 : g === 2 ? 17 : 15, mt: 1.25, mb: 0.5 }}>{inline(m[2])}</Box>);
      continue;
    }
    if ((m = z.match(/^\s*(?:[-*•])\s+(.*)$/)) || (m = z.match(/^\s*\d+[.)]\s+(.*)$/))) {
      const art = /^\s*\d/.test(z) ? 'ol' : 'ul';
      if (liste && liste.art !== art) listeZu();
      liste ??= { art, punkte: [] };
      liste.punkte.push(m[1]);
      continue;
    }
    listeZu();
    if ((m = z.match(/^>\s?(.*)$/))) {
      bloecke.push(<Box key={bloecke.length} sx={{ borderLeft: 3, borderColor: 'divider', pl: 1.5, color: 'text.secondary' }}>{inline(m[1]) }&nbsp;</Box>);
      continue;
    }
    bloecke.push(z.trim() ? <div key={bloecke.length}>{inline(z)}</div> : <Box key={bloecke.length} sx={{ height: '0.8em' }} />);
  }
  listeZu();
  return <Box sx={{ fontSize: 15, lineHeight: 1.6, overflowWrap: 'anywhere' }}>{bloecke}</Box>;
}
