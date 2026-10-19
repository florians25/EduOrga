// Modale Dialoge (Fluent Dialog) mit Promise-Schnittstelle, damit Abläufe wie „fragen → senden → neu laden“ gerade
// geschrieben werden können:
//   await frage('Löschen?', { gefahr: true })        → boolean
//   await meldung('Text')                            → void
//   await formular('Titel', [{ name, titel, art }])  → Werte oder null
//   await dialog({ titel, inhalt, knoepfe })         → Wert des gedrückten Knopfes oder null
//   await dialogZeigen((schliessen) => <MeinDialog schliessen={schliessen} />)  → eigener Inhalt (DialogSurface …)
import {
  Button, Checkbox, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Field, Input, Textarea,
  makeStyles, tokens,
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { create } from 'zustand';
import type { ElementOption } from '@/api/typen';
import { SuchAuswahl } from './suchauswahl';

type Render<T> = (schliessen: (wert: T | null) => void) => JSX.Element;

interface Eintrag { id: number; render: Render<any>; aufloesen: (w: any) => void }

const useDialoge = create<{ liste: Eintrag[] }>(() => ({ liste: [] }));
let zaehler = 0;

/** Eigenen Dialog zeigen: render(schliessen) liefert den Inhalt (in der Regel <StandardDialog …>). */
export function dialogZeigen<T>(render: Render<T>): Promise<T | null> {
  return new Promise((fertig) => {
    const id = ++zaehler;
    const aufloesen = (w: T | null) => {
      useDialoge.setState((s) => ({ liste: s.liste.filter((x) => x.id !== id) }));
      fertig(w);
    };
    useDialoge.setState((s) => ({ liste: [...s.liste, { id, render, aufloesen }] }));
  });
}

/** Ist gerade ein Dialog offen? (Tastenkürzel der Shell ruhen dann.) */
export const dialogOffen = () => useDialoge.getState().liste.length > 0;

export function DialogHost() {
  const liste = useDialoge((s) => s.liste);
  return (
    <>
      {liste.map((e) => (
        <Dialog key={e.id} open modalType="modal" onOpenChange={(_, d) => { if (!d.open) e.aufloesen(null); }}>
          {e.render(e.aufloesen)}
        </Dialog>
      ))}
    </>
  );
}

const useStile = makeStyles({
  gefahr: {
    color: tokens.colorPaletteRedForeground1,
    ':hover': { color: tokens.colorPaletteRedForeground1, backgroundColor: tokens.colorPaletteRedBackground1 },
  },
  gefahrPrimaer: {
    backgroundColor: tokens.colorPaletteRedBackground3,
    color: tokens.colorNeutralForegroundOnBrand,
    ':hover': { backgroundColor: tokens.colorPaletteRedForeground1, color: tokens.colorNeutralForegroundOnBrand },
    ':hover:active': { backgroundColor: tokens.colorPaletteRedForeground1, color: tokens.colorNeutralForegroundOnBrand },
  },
  absatz: { margin: '0 0 8px 0', whiteSpace: 'pre-wrap' },
  formular: { display: 'flex', flexDirection: 'column', rowGap: '12px' },
  inhalt: { display: 'flex', flexDirection: 'column' },
});

export interface Knopf<T = unknown> { text: string; wert: T | null; primaer?: boolean; gefahr?: boolean; deaktiviert?: boolean }

export interface StandardDialogProps<T> {
  titel: ReactNode;
  children: ReactNode;
  knoepfe?: Knopf<T>[];
  breite?: string;
  /** Knopf gedrückt (Wert des Knopfes; null = Schließen). */
  beiKnopf: (wert: T | null) => void;
  /** Weitere Elemente links in der Knopfleiste. */
  links?: ReactNode;
}

/** Dialog mit Titel, Schließen-Kreuz, Inhalt und Knopfleiste; Enter löst den Primärknopf aus. */
export function StandardDialog<T>({ titel, children, knoepfe = [{ text: 'OK', wert: true as unknown as T, primaer: true }], breite, beiKnopf, links }: StandardDialogProps<T>) {
  const s = useStile();
  const taste = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || e.defaultPrevented) return;
    const ziel = e.target as HTMLElement;
    if (ziel instanceof HTMLTextAreaElement || ziel instanceof HTMLButtonElement || ziel.closest('[role=listbox],[role=grid],[role=menu]')) return;
    const p = knoepfe.find((k) => k.primaer && !k.deaktiviert);
    if (p) { e.preventDefault(); beiKnopf(p.wert); }
  };
  return (
    <DialogSurface style={breite ? { width: breite, maxWidth: 'calc(100vw - 32px)' } : undefined} onKeyDown={taste}>
      <DialogBody>
        <DialogTitle action={<Button appearance="subtle" aria-label="Schließen" icon={<Dismiss24Regular />} onClick={() => beiKnopf(null)} />}>{titel}</DialogTitle>
        <DialogContent className={s.inhalt}>{children}</DialogContent>
        <DialogActions fluid={!!links} style={links ? { justifyContent: 'space-between' } : undefined}>
          {links ? <div>{links}</div> : null}
          <div style={{ display: 'flex', gap: 8 }}>
            {knoepfe.map((k, i) => (
              <Button key={i} appearance={k.primaer ? 'primary' : 'secondary'} disabled={k.deaktiviert}
                className={k.gefahr ? (k.primaer ? s.gefahrPrimaer : s.gefahr) : undefined} onClick={() => beiKnopf(k.wert)}>{k.text}</Button>
            ))}
          </div>
        </DialogActions>
      </DialogBody>
    </DialogSurface>
  );
}

function Absaetze({ text }: { text: string }) {
  const s = useStile();
  return <>{text.split('\n').map((z, i) => (z ? <p key={i} className={s.absatz}>{z}</p> : <br key={i} />))}</>;
}

/** Allgemeiner Dialog. inhalt: Text oder Element. pruefen(wert) kann false liefern, um offen zu bleiben. */
export function dialog<T = unknown>({ titel, inhalt, knoepfe, breite, pruefen }: {
  titel: string; inhalt: ReactNode; knoepfe?: Knopf<T>[]; breite?: string; pruefen?: (wert: T) => boolean | Promise<boolean>;
}): Promise<T | null> {
  return dialogZeigen<T>((schliessen) => (
    <StandardDialog<T> titel={titel} knoepfe={knoepfe} breite={breite} beiKnopf={async (w) => {
      if (pruefen && w !== null && (w as unknown) !== false && (await pruefen(w)) === false) return;
      schliessen(w);
    }}>
      {typeof inhalt === 'string' ? <Absaetze text={inhalt} /> : inhalt}
    </StandardDialog>
  ));
}

export const meldung = async (text: string, titel = 'Hinweis'): Promise<void> => { await dialog({ titel, inhalt: text }); };

export const frage = async (text: string, { titel = 'Bitte bestätigen', ja = 'Ja', nein = 'Nein', gefahr = false } = {}): Promise<boolean> =>
  (await dialog<boolean>({ titel, inhalt: text, knoepfe: [{ text: ja, wert: true, primaer: true, gefahr }, { text: nein, wert: false }] })) === true;

// ---------------------------------------------------------------------------------------------
// Formular-Dialog

export interface FormularFeld {
  name: string;
  titel: string;
  /** auswahl: durchsuchbare Liste (optionen); element/elemente: Element(e) aus `elemente` (Kurzname, keine freie Eingabe);
   *  datum: Kalender (Wert ISO yyyy-mm-dd) */
  art?: 'text' | 'zahl' | 'passwort' | 'auswahl' | 'bool' | 'textfeld' | 'datum' | 'element' | 'elemente';
  wert?: string | number | boolean | null;
  optionen?: { wert: string | number; text: string }[];
  elemente?: ElementOption[];
  pflicht?: boolean;
  hinweis?: string;
}

export type FormularWerte = Record<string, any>;

function FormularInhalt({ titel, felder, okText, breite, schliessen }: { titel: string; felder: FormularFeld[]; okText: string; breite?: string; schliessen: (w: FormularWerte | null) => void }) {
  const s = useStile();
  const [werte, setWerte] = useState<FormularWerte>(() => Object.fromEntries(felder.map((f) => [f.name, f.art === 'bool' ? !!f.wert : String(f.wert ?? '')])));
  const [geprueft, setGeprueft] = useState(false);
  const fehlt = (f: FormularFeld) => !!f.pflicht && !String(werte[f.name] ?? '').trim();
  const setzen = (n: string, w: unknown) => setWerte((x) => ({ ...x, [n]: w }));
  return (
    <StandardDialog<boolean> titel={titel} breite={breite} knoepfe={[{ text: okText, wert: true, primaer: true }, { text: 'Abbrechen', wert: null }]}
      beiKnopf={(w) => {
        if (!w) { schliessen(null); return; }
        setGeprueft(true);
        if (felder.some(fehlt)) return;
        schliessen(werte);
      }}>
      <div className={s.formular}>
        {felder.map((f, i) => {
          const fehler = geprueft && fehlt(f) ? 'Bitte ausfüllen.' : undefined;
          const autofokus = i === 0;
          if (f.art === 'bool') {
            return <Checkbox key={f.name} name={f.name} label={f.titel} checked={!!werte[f.name]} onChange={(_, d) => setzen(f.name, !!d.checked)} />;
          }
          return (
            <Field key={f.name} label={f.titel} required={f.pflicht} hint={f.hinweis} validationMessage={fehler}>
              {f.art === 'auswahl' ? (
                <SuchAuswahl name={f.name} wert={String(werte[f.name] ?? '')} beiWahl={(w) => setzen(f.name, w)} autoFocus={autofokus} ariaLabel={f.titel}
                  optionen={(f.optionen || []).map((o) => ({ wert: String(o.wert), text: o.text }))} />
              ) : f.art === 'element' || f.art === 'elemente' ? (
                <SuchAuswahl name={f.name} wert={String(werte[f.name] ?? '')} beiWahl={(w) => setzen(f.name, w)} autoFocus={autofokus} ariaLabel={f.titel}
                  mehrfach={f.art === 'elemente'} platzhalter="Suchen …"
                  optionen={(f.elemente || []).map((e) => ({ wert: e.k, kurz: e.k, text: e.l ? `${e.k} – ${e.l}` : e.k }))} />
              ) : f.art === 'textfeld' ? (
                <Textarea name={f.name} value={String(werte[f.name] ?? '')} onChange={(_, d) => setzen(f.name, d.value)} rows={4} autoFocus={autofokus} resize="vertical" />
              ) : (
                <Input name={f.name} value={String(werte[f.name] ?? '')} onChange={(_, d) => setzen(f.name, d.value)} autoFocus={autofokus}
                  type={f.art === 'passwort' ? 'password' : f.art === 'zahl' ? 'number' : f.art === 'datum' ? 'date' : 'text'}
                  autoComplete={f.art === 'passwort' ? 'new-password' : 'off'} />
              )}
            </Field>
          );
        })}
      </div>
    </StandardDialog>
  );
}

/** Formular-Dialog; liefert { name: wert } oder null. */
export function formular(titel: string, felder: FormularFeld[], { okText = 'OK', breite }: { okText?: string; breite?: string } = {}): Promise<FormularWerte | null> {
  return dialogZeigen<FormularWerte>((schliessen) => <FormularInhalt titel={titel} felder={felder} okText={okText} breite={breite} schliessen={schliessen} />);
}
