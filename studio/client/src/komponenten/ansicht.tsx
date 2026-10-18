// Rahmen einer Ansicht: Seitenkopf (Bereich + Titel, auf Seiten) bzw. schmale Kopfzeile (im Nebenbereich und im
// Arbeitsplatz), Werkzeugleiste, Filterleiste, Inhalt und Fußzeile. Dazu kleine Bausteine der Werkzeugleisten.
import {
  Button, Label, Select, Spinner, Switch, Text, Toolbar, ToolbarButton, ToolbarDivider, Tooltip, makeStyles, mergeClasses, tokens,
} from '@fluentui/react-components';
import { ChevronLeft20Regular, ChevronRight20Regular, Dismiss20Regular, Open20Regular } from '@fluentui/react-icons';
import { useEffect, useId, type ReactNode, type KeyboardEvent } from 'react';
import { useAnsicht } from '@/kern/ansichten';
import { useStudio } from '@/kern/zustand';
import { bereichVon } from '@/shell/navigation';
import { useSeitenort } from '@/shell/seitenort';
import type { ElementOption } from '@/api/typen';
import { fehlerMelden } from './hinweise';

const useStile = makeStyles({
  rahmen: { display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, height: '100%', backgroundColor: tokens.colorNeutralBackground1, position: 'relative' },
  seitenkopf: { padding: '14px 20px 6px 20px', display: 'flex', alignItems: 'flex-end', gap: '16px', flexShrink: 0 },
  kopfText: { display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 },
  pfad: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200, lineHeight: tokens.lineHeightBase200 },
  titel: { margin: 0, fontSize: '20px', lineHeight: '28px', fontWeight: tokens.fontWeightSemibold, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  bereichKopf: {
    display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 4px 4px 12px', minHeight: '36px', flexShrink: 0,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, backgroundColor: tokens.colorNeutralBackground2,
  },
  bereichTitel: { flex: 1, fontWeight: tokens.fontWeightSemibold, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: tokens.fontSizeBase300 },
  werkzeuge: { padding: '2px 12px', flexShrink: 0, flexWrap: 'wrap', rowGap: '2px', borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, minHeight: '40px' },
  werkzeugeSeite: { padding: '2px 16px' },
  filter: {
    display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px 16px', padding: '8px 16px', flexShrink: 0,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  inhalt: { flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' },
  inhaltRollen: { overflow: 'auto' },
  fuss: {
    display: 'flex', alignItems: 'center', gap: '16px', padding: '4px 16px', minHeight: '28px', flexShrink: 0, flexWrap: 'wrap',
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`, color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  feld: { display: 'inline-flex', alignItems: 'center', gap: '6px' },
  feldTitel: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200, whiteSpace: 'nowrap' },
  rechts: { marginLeft: 'auto' },
  laden: {
    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5,
    backgroundColor: 'rgba(255,255,255,0.35)', pointerEvents: 'none',
  },
  leer: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '48px 16px', color: tokens.colorNeutralForeground3, textAlign: 'center', flex: 1 },
  elementwahl: { display: 'inline-flex', alignItems: 'center', gap: '2px' },
  auswahl: { minWidth: '160px', maxWidth: '280px' },
});

export interface AnsichtRahmenProps {
  titel: string;
  /** Knöpfe rechts im Seitenkopf */
  aktionen?: ReactNode;
  werkzeuge?: ReactNode;
  filter?: ReactNode;
  fuss?: ReactNode;
  children?: ReactNode;
  /** Inhalt rollt selbst (Standard: der Inhalt sorgt selbst fürs Rollen, z. B. Tabellen) */
  rollen?: boolean;
  laden?: boolean;
  className?: string;
}

export function AnsichtRahmen({ titel, aktionen, werkzeuge, filter, fuss, children, rollen, laden, className }: AnsichtRahmenProps) {
  const s = useStile();
  const a = useAnsicht();
  const modus = useStudio((x) => x.modus);
  const ort = useSeitenort();
  const dokName = useStudio((x) => x.dokument?.name);
  const seite = a.lage === 'seite';
  useEffect(() => {
    if (seite) document.title = `${titel}${dokName ? ` – ${dokName}` : ''} – UntPlan Studio`;
  }, [seite, titel, dokName]);
  const bereich = seite ? (bereichVon(ort, modus) || (modus === 'vertretung' ? 'Vertretungsplanung' : 'Stundenplanung')) : null;
  return (
    <section className={mergeClasses(s.rahmen, className)} aria-label={titel} data-ansicht={a.typ} data-lage={a.lage}>
      {seite ? (
        <header className={s.seitenkopf}>
          <div className={s.kopfText}>
            <span className={s.pfad}>{bereich}</span>
            <h1 className={s.titel}>{titel}</h1>
          </div>
          {aktionen}
        </header>
      ) : (
        <div className={s.bereichKopf}>
          <span className={s.bereichTitel} title={titel}>{titel}</span>
          {aktionen}
          {a.alsSeite ? <Tooltip content="Als eigene Seite öffnen" relationship="label"><Button size="small" appearance="subtle" icon={<Open20Regular />} onClick={a.alsSeite} /></Tooltip> : null}
          {a.schliessen ? <Tooltip content="Bereich schließen" relationship="label"><Button size="small" appearance="subtle" icon={<Dismiss20Regular />} onClick={a.schliessen} /></Tooltip> : null}
        </div>
      )}
      {werkzeuge ? <Toolbar size="small" className={mergeClasses(s.werkzeuge, seite && s.werkzeugeSeite)} aria-label="Werkzeuge">{werkzeuge}</Toolbar> : null}
      {filter ? <div className={s.filter}>{filter}</div> : null}
      <div className={mergeClasses(s.inhalt, rollen && s.inhaltRollen)}>
        {children}
        {laden ? <div className={s.laden}><Spinner size="small" /></div> : null}
      </div>
      {fuss ? <footer className={s.fuss}>{fuss}</footer> : null}
    </section>
  );
}

/** Textknopf der Werkzeugleiste (Fehler der Aktion werden gemeldet). */
export function Werkzeug({ text, titel, aktion, icon, deaktiviert, gedrueckt }: { text?: string; titel?: string; aktion: () => unknown; icon?: JSX.Element; deaktiviert?: boolean; gedrueckt?: boolean }) {
  const knopf = (
    <ToolbarButton icon={icon} disabled={deaktiviert} aria-pressed={gedrueckt === undefined ? undefined : gedrueckt}
      appearance={gedrueckt ? 'primary' : 'subtle'} aria-label={text ? undefined : titel}
      onClick={() => { Promise.resolve().then(aktion).catch(fehlerMelden); }}>{text}</ToolbarButton>
  );
  return titel && titel !== text ? <Tooltip content={titel} relationship={text ? 'description' : 'label'}>{knopf}</Tooltip> : knopf;
}

export const Trenner = () => <ToolbarDivider />;

/** Schiebt die folgenden Elemente der Werkzeugleiste nach rechts. */
export function Rechts({ children }: { children?: ReactNode }) {
  const s = useStile();
  return <div className={s.rechts} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{children}</div>;
}

/** Beschriftetes Feld in Werkzeug- oder Filterleiste: „Klasse [Auswahl]“. */
export function Feld({ titel, children }: { titel?: string; children: ReactNode }) {
  const s = useStile();
  return <span className={s.feld}>{titel ? <span className={s.feldTitel}>{titel}</span> : null}{children}</span>;
}

/** Schalter mit Text. */
export function Schalter({ text, an, beiAenderung, titel, deaktiviert }: { text: string; an: boolean; beiAenderung: (an: boolean) => void; titel?: string; deaktiviert?: boolean }) {
  const sw = <Switch checked={an} disabled={deaktiviert} label={text} onChange={(_, d) => beiAenderung(d.checked)} />;
  return titel ? <Tooltip content={titel} relationship="description">{sw}</Tooltip> : sw;
}

export function Ladeanzeige() {
  const s = useStile();
  return <div className={s.laden}><Spinner size="small" /></div>;
}

/** Leerer Zustand: ein Satz, optional ein Knopf. */
export function Leer({ text, children }: { text: string; children?: ReactNode }) {
  const s = useStile();
  return <div className={s.leer}><Text>{text}</Text>{children}</div>;
}

export function FussText({ children, rechts }: { children: ReactNode; rechts?: boolean }) {
  const s = useStile();
  return <span className={rechts ? s.rechts : undefined}>{children}</span>;
}

const NAME: Record<string, string> = { klasse: 'Klasse', lehrer: 'Lehrkraft', raum: 'Raum', fach: 'Fach' };

/** Elementwahl mit Blättern: „Klasse [‹][5a – Klasse 5a][›]“; Bild auf/ab blättert. */
export function ElementAuswahl({ typ, liste, wert, beiWahl, titel }: { typ: string; liste: ElementOption[]; wert: number | null | undefined; beiWahl: (id: number) => void; titel?: string }) {
  const s = useStile();
  const id = useId();
  const i = liste.findIndex((e) => e.id === wert);
  const blaettern = (d: number) => {
    const n = liste[Math.max(0, Math.min(liste.length - 1, (i < 0 ? 0 : i) + d))];
    if (n && n.id !== wert) beiWahl(n.id);
  };
  const taste = (e: KeyboardEvent) => {
    if (e.key === 'PageUp' || e.key === 'PageDown') { e.preventDefault(); blaettern(e.key === 'PageUp' ? -1 : 1); }
  };
  return (
    <span className={s.feld}>
      <Label htmlFor={id} className={s.feldTitel}>{titel || NAME[typ] || 'Element'}</Label>
      <span className={s.elementwahl}>
        <Tooltip content="Vorheriges Element (Bild auf)" relationship="label"><Button size="small" appearance="subtle" icon={<ChevronLeft20Regular />} onClick={() => blaettern(-1)} disabled={i <= 0} /></Tooltip>
        <Select id={id} size="small" className={s.auswahl} value={wert != null ? String(wert) : ''} onKeyDown={taste} onChange={(_, d) => beiWahl(Number(d.value))}>
          {wert == null ? <option value="">–</option> : null}
          {liste.map((e) => <option key={e.id} value={e.id}>{e.l ? `${e.k} – ${e.l}` : e.k}</option>)}
        </Select>
        <Tooltip content="Nächstes Element (Bild ab)" relationship="label"><Button size="small" appearance="subtle" icon={<ChevronRight20Regular />} onClick={() => blaettern(1)} disabled={i >= liste.length - 1} /></Tooltip>
      </span>
    </span>
  );
}
