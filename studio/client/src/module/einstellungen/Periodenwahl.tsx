// Periodenwechsel in der Kopfleiste (Stundenplanung): aktive Periode mit Zeitraum, vorherige/nächste Periode mit einem Klick,
// aufklappbare Liste mit Suche und „Neue Periode ab …“ – ein Dialog mit Beginn (Kalender), optionalem Ende, Vorlage (Kopie von
// Unterricht, Stundenplan und Pausenaufsichten) und „gleich aktiv setzen“ (eine Rückgängig-Stufe; Server: POST /schule/perioden).
import {
  Button, Checkbox, Field, Input, Popover, PopoverSurface, PopoverTrigger, SearchBox, Tooltip, makeStyles, mergeClasses, tokens,
} from '@fluentui/react-components';
import { ChevronDown16Regular, ChevronLeft20Regular, ChevronRight20Regular } from '@fluentui/react-icons';
import { useMemo, useState } from 'react';
import { api } from '@/api/client';
import type { Periode } from '@/api/typen';
import { seiteOeffnen } from '@/kern/befehle';
import { rueckgaengig } from '@/kern/dokument';
import { useStudio, zustand } from '@/kern/zustand';
import { StandardDialog, dialogZeigen } from '@/komponenten/dialoge';
import { DatumFeld, alsIso } from '@/komponenten/eingaben';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { SuchAuswahl } from '@/komponenten/suchauswahl';
import { pfad } from './kern';

const kurz = (iso?: string | null) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.` : '');
const lang = (iso?: string | null) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');
export const zeitraumText = (p: Pick<Periode, 'von' | 'ende'>) => `${lang(p.von)} – ${lang(p.ende)}`;

function ebene(p: Periode, alle: Periode[]): number {
  let n = 0;
  for (let m = p.mutterId; m != null && n < 10; n++) m = alle.find((x) => x.id === m)?.mutterId ?? null;
  return n;
}

/** Aktive Periode wechseln (mit Hinweis und „Rückgängig“). */
export async function periodeAktivieren(p: Periode): Promise<void> {
  if (p.aktiv) return;
  await api.post(pfad(`/perioden/${p.id}/aktiv`), {});
  hinweis(`Aktive Periode: ${p.name} (${zeitraumText(p)})`, 'ok', 5000, { text: 'Rückgängig', aktion: rueckgaengig });
}

// ---- Dialog „Neue Periode“ ----
interface NeuWerte { name: string; von: string; bis: string; mutter: string; aktivieren: boolean }

function NeuDialog({ perioden, vorgabe, schliessen }: { perioden: Periode[]; vorgabe: NeuWerte; schliessen: (w: NeuWerte | null) => void }) {
  const [w, setW] = useState(vorgabe);
  const [geprueft, setGeprueft] = useState(false);
  const mutter = perioden.find((x) => String(x.id) === w.mutter);
  const fehlerVon = !w.von ? 'Bitte den Beginn wählen.' : mutter && w.von < mutter.von ? `Die neue Periode muss innerhalb von ${mutter.name} (ab ${lang(mutter.von)}) beginnen.` : undefined;
  const fehlerBis = w.bis && w.von && w.bis < w.von ? 'Das Ende liegt vor dem Beginn.' : undefined;
  const fehlerName = !w.name.trim() ? 'Bitte einen Namen angeben.' : perioden.some((x) => x.name.toLowerCase() === w.name.trim().toLowerCase()) ? 'Diesen Namen gibt es schon.' : undefined;
  const ok = !fehlerVon && !fehlerBis && !fehlerName;
  return (
    <StandardDialog<boolean> titel="Neue Periode" breite="460px"
      knoepfe={[{ text: 'Anlegen', wert: true, primaer: true }, { text: 'Abbrechen', wert: null }]}
      beiKnopf={(x) => { if (!x) { schliessen(null); return; } setGeprueft(true); if (ok) schliessen(w); }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} data-testid="periode-neu">
        <Field label="Beginn" required validationMessage={geprueft ? fehlerVon : undefined}
          hint="Ab diesem Tag gilt die neue Periode; die bisherige endet am Vortag.">
          <DatumFeld size="medium" aria-label="Beginn" autoFocus wert={w.von} beiAenderung={(von) => setW({ ...w, von })} />
        </Field>
        <Field label="Ende (optional)" validationMessage={fehlerBis} hint="Leer: bis zum Beginn der nächsten Periode bzw. zum Schuljahresende.">
          <DatumFeld size="medium" aria-label="Ende" leerErlaubt wert={w.bis} beiAenderung={(bis) => setW({ ...w, bis })} />
        </Field>
        <Field label="Kopie von" hint="Unterricht, Stundenplan und Pausenaufsichten werden aus dieser Periode übernommen.">
          <SuchAuswahl ariaLabel="Kopie von" wert={w.mutter} beiWahl={(mutter) => setW({ ...w, mutter })}
            optionen={perioden.map((x) => ({ wert: String(x.id), kurz: x.name, text: `${x.name} · ${zeitraumText(x)}${x.aktiv ? ' (aktiv)' : ''}` }))} />
        </Field>
        <Field label="Name" required validationMessage={geprueft || w.name !== vorgabe.name ? fehlerName : undefined}>
          <Input value={w.name} onChange={(_, d) => setW({ ...w, name: d.value })} aria-label="Name" />
        </Field>
        <Checkbox label="Danach als aktive Periode setzen" checked={w.aktivieren} onChange={(_, d) => setW({ ...w, aktivieren: !!d.checked })} />
      </div>
    </StandardDialog>
  );
}

/** Dialog „Neue Periode ab …“; true = angelegt. */
export async function neuePeriodeDialog(o: { mutterId?: number; von?: string } = {}): Promise<boolean> {
  const perioden = [...(zustand().grunddaten?.perioden || [])].sort((x, y) => x.von.localeCompare(y.von));
  if (!perioden.length) return false;
  const aktiv = perioden.find((x) => x.aktiv) || perioden[0]!;
  const mutter = perioden.find((x) => x.id === o.mutterId) || aktiv;
  const heute = alsIso(new Date());
  // Vorschlag: heute (falls in der Vorlage und nach deren Beginn), sonst der Tag nach dem Ende der Vorlage
  const von = o.von || (heute > mutter.von && heute <= mutter.ende ? heute : mutter.von);
  let n = perioden.length + 1;
  while (perioden.some((x) => x.name.toLowerCase() === `periode${n}`)) n++;
  const w = await dialogZeigen<NeuWerte>((zu) => (
    <NeuDialog perioden={perioden} schliessen={zu} vorgabe={{ name: `Periode${n}`, von, bis: '', mutter: String(mutter.id), aktivieren: true }} />
  ));
  if (!w) return false;
  try {
    await api.post(pfad('/perioden'), { mutterId: Number(w.mutter), name: w.name.trim(), von: w.von, bis: w.bis || null, aktivieren: w.aktivieren });
    hinweis(`Periode ${w.name.trim()} ab ${lang(w.von)} angelegt${w.aktivieren ? ' und aktiv gesetzt' : ''}.`, 'ok', 6000, { text: 'Rückgängig', aktion: rueckgaengig });
    return true;
  } catch (f) { fehlerMelden(f); return false; }
}

// ---- Kopfleiste ----
const useStile = makeStyles({
  rahmen: { display: 'inline-flex', alignItems: 'center', gap: '0', flexShrink: 0 },
  knopf: {
    minWidth: 0, height: '36px', padding: '0 6px 0 8px', fontWeight: tokens.fontWeightRegular, justifyContent: 'flex-start',
    border: `1px solid ${tokens.colorNeutralStroke1}`, backgroundColor: tokens.colorNeutralBackground1,
  },
  texte: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: '15px', textAlign: 'left' },
  titel: { fontSize: tokens.fontSizeBase100, color: tokens.colorNeutralForeground3 },
  name: { fontWeight: tokens.fontWeightSemibold, whiteSpace: 'nowrap', maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis' },
  zeit: { fontWeight: tokens.fontWeightRegular, color: tokens.colorNeutralForeground2, fontVariantNumeric: 'tabular-nums', marginLeft: '6px', '@media (max-width: 1400px)': { display: 'none' } },
  pfeil: { minWidth: '28px', width: '28px', padding: 0 },
  flaeche: { padding: '8px 0 0 0', width: '380px', display: 'flex', flexDirection: 'column' },
  suche: { margin: '0 10px 6px 10px' },
  liste: { maxHeight: '320px', overflowY: 'auto', borderTop: `1px solid ${tokens.colorNeutralStroke2}` },
  eintrag: {
    display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '0 8px', width: '100%', textAlign: 'left', border: 0, cursor: 'pointer',
    padding: '6px 12px', backgroundColor: 'transparent', color: tokens.colorNeutralForeground1, fontFamily: 'inherit', fontSize: tokens.fontSizeBase300,
    borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
    ':hover': { backgroundColor: tokens.colorNeutralBackground1Hover },
    ':focus-visible': { outline: `2px solid ${tokens.colorStrokeFocus2}`, outlineOffset: '-2px' },
  },
  eintragAktiv: { backgroundColor: tokens.colorBrandBackground2, boxShadow: 'inset 3px 0 0 var(--edo-modus)', ':hover': { backgroundColor: tokens.colorBrandBackground2Hover } },
  eName: { fontWeight: tokens.fontWeightSemibold },
  eZeit: { gridColumn: '1', fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground2, fontVariantNumeric: 'tabular-nums' },
  eStatus: { gridColumn: '2', gridRow: '1 / span 2', fontSize: '11px', fontWeight: tokens.fontWeightSemibold, letterSpacing: '0.04em', textTransform: 'uppercase', color: tokens.colorBrandForeground1 },
  eFix: { color: tokens.colorNeutralForeground3 },
  fuss: { display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '8px 10px' },
  leer: { padding: '16px', color: tokens.colorNeutralForeground3, textAlign: 'center' },
});

export default function PeriodenWahl() {
  const s = useStile();
  const perioden = useStudio((x) => x.grunddaten?.perioden);
  const schreiben = useStudio((x) => !!x.benutzer?.darfSchreiben);
  const [offen, setOffen] = useState(false);
  const [suche, setSuche] = useState('');
  const liste = useMemo(() => [...(perioden || [])].sort((x, y) => x.von.localeCompare(y.von) || x.id - y.id), [perioden]);
  if (!liste.length) return null;
  const i = Math.max(0, liste.findIndex((x) => x.aktiv));
  const aktiv = liste[i]!;
  const heute = alsIso(new Date());
  const los = (f: () => Promise<unknown>) => { Promise.resolve().then(f).catch(fehlerMelden); };
  const wechseln = (p: Periode | undefined) => { if (p) los(() => periodeAktivieren(p)); };
  const t = suche.trim().toLowerCase();
  const treffer = t ? liste.filter((x) => `${x.name} ${x.langname} ${zeitraumText(x)}`.toLowerCase().includes(t)) : liste;
  const einzig = liste.length === 1;
  return (
    <span className={s.rahmen} data-testid="periodenwahl">
      <Tooltip content={i > 0 ? `Vorherige Periode: ${liste[i - 1]!.name}` : 'Keine frühere Periode'} relationship="label">
        <Button appearance="subtle" className={s.pfeil} icon={<ChevronLeft20Regular />} disabled={i <= 0 || !schreiben} onClick={() => wechseln(liste[i - 1])} data-testid="periode-vorher" />
      </Tooltip>
      <Popover open={offen} onOpenChange={(_, d) => { setOffen(d.open); if (!d.open) setSuche(''); }} positioning="below-start" trapFocus>
        <PopoverTrigger disableButtonEnhancement>
          <Button appearance="secondary" className={s.knopf} title={`Aktive Periode ${aktiv.name}${aktiv.langname && aktiv.langname !== aktiv.name ? ` (${aktiv.langname})` : ''}: ${zeitraumText(aktiv)}${aktiv.fixiert ? ' · fixiert' : ''} – Periode wechseln oder neu anlegen`}
            data-testid="periode-knopf">
            <span className={s.texte}>
              <span className={s.titel}>Periode</span>
              <span><span className={s.name}>{aktiv.name}</span><span className={s.zeit}>{`${kurz(aktiv.von)}–${kurz(aktiv.ende)}`}</span></span>
            </span>
            <ChevronDown16Regular style={{ marginLeft: 6, flexShrink: 0 }} />
          </Button>
        </PopoverTrigger>
        <PopoverSurface className={s.flaeche} aria-label="Periode wählen">
          {liste.length > 6 ? <SearchBox size="small" className={s.suche} placeholder="Periode suchen" value={suche} onChange={(_, d) => setSuche(d.value)} aria-label="Periode suchen" /> : null}
          <div className={s.liste} role="listbox" aria-label="Perioden">
            {treffer.map((p) => (
              <button key={p.id} type="button" role="option" aria-selected={p.aktiv} disabled={!schreiben && !p.aktiv}
                className={mergeClasses(s.eintrag, p.aktiv && s.eintragAktiv)} style={{ paddingLeft: 12 + ebene(p, liste) * 14 }} data-periode={p.id}
                onClick={() => { setOffen(false); wechseln(p); }}>
                <span className={s.eName}>{p.name}{p.langname && p.langname !== p.name ? <span style={{ fontWeight: 400, color: tokens.colorNeutralForeground2 }}>{` · ${p.langname}`}</span> : null}</span>
                <span className={mergeClasses(s.eStatus, !p.aktiv && s.eFix)}>{p.aktiv ? 'Aktiv' : p.fixiert ? 'Fixiert' : heute >= p.von && heute <= p.ende ? 'Heute' : ''}</span>
                <span className={s.eZeit}>{zeitraumText(p)}</span>
              </button>
            ))}
            {!treffer.length ? <div className={s.leer}>Keine passende Periode.</div> : null}
          </div>
          <div className={s.fuss}>
            <Button size="small" appearance="primary" disabled={!schreiben} onClick={() => { setOffen(false); los(() => neuePeriodeDialog()); }} data-testid="periode-neu-knopf">Neue Periode ab …</Button>
            <Button size="small" appearance="subtle" onClick={() => { setOffen(false); seiteOeffnen('einstellungen.perioden'); }}>Perioden verwalten</Button>
          </div>
        </PopoverSurface>
      </Popover>
      <Tooltip content={i < liste.length - 1 ? `Nächste Periode: ${liste[i + 1]!.name}` : einzig ? 'Nur eine Periode' : 'Keine spätere Periode'} relationship="label">
        <Button appearance="subtle" className={s.pfeil} icon={<ChevronRight20Regular />} disabled={i >= liste.length - 1 || !schreiben} onClick={() => wechseln(liste[i + 1])} data-testid="periode-nachher" />
      </Tooltip>
    </span>
  );
}
