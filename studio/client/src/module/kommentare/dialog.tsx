// Kommentar-Dialog (Element, Feld, Kategorie, Text) und Anlegen – auch für andere Module (Befehl kommentare.neu).
import { Field, Select, Input, Textarea, makeStyles } from '@fluentui/react-components';
import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import type { ElementOption } from '@/api/typen';
import { elemente, zustand } from '@/kern/zustand';
import { StandardDialog, dialogZeigen } from '@/komponenten/dialoge';
import { hinweis } from '@/komponenten/hinweise';

export const TYPEN: [string, string][] = [['lehrer', 'Lehrkraft'], ['klasse', 'Klasse'], ['raum', 'Raum'], ['fach', 'Fach'], ['schueler', 'Schüler'], ['gang', 'Gang'], ['abteilung', 'Abteilung']];

export interface Kommentar { id: number; typ: string; element: number; feld: string; kategorie: number; text: string; kategorieName?: string; typName?: string; elementName?: string; erstellt?: string; farbe?: string | null }
type Eingabe = Pick<Kommentar, 'typ' | 'element' | 'feld' | 'kategorie' | 'text'>;

const useStile = makeStyles({ formular: { display: 'flex', flexDirection: 'column', gap: '12px' }, zeile: { display: 'flex', gap: '8px' } });

function Inhalt({ vorgabe, titel, kategorien, schliessen }: { vorgabe: Partial<Kommentar>; titel: string; kategorien: { nr: number; name: string }[]; schliessen: (e: Eingabe | null) => void }) {
  const s = useStile();
  const [typ, setTyp] = useState(vorgabe.typ || 'lehrer');
  const [liste, setListe] = useState<ElementOption[]>([]);
  const [element, setElement] = useState<number | null>(vorgabe.element ?? null);
  const [feld, setFeld] = useState(vorgabe.feld || '');
  const [kategorie, setKategorie] = useState(vorgabe.kategorie || 1);
  const [text, setText] = useState(vorgabe.text || '');
  const [geprueft, setGeprueft] = useState(false);
  useEffect(() => { void elemente(typ).then((l) => { setListe(l); setElement((x) => (x && l.some((e) => e.id === x) ? x : l[0]?.id ?? null)); }); }, [typ]);
  return (
    <StandardDialog<boolean> titel={titel} breite="540px" knoepfe={[{ text: vorgabe.id ? 'Speichern' : 'Anlegen', wert: true, primaer: true }, { text: 'Abbrechen', wert: null }]}
      beiKnopf={(w) => {
        if (!w) { schliessen(null); return; }
        setGeprueft(true);
        if (!text.trim() || !element) return;
        schliessen({ typ, element, feld, kategorie, text });
      }}>
      <div className={s.formular}>
        <Field label="Element">
          <div className={s.zeile}>
            <Select value={typ} disabled={!!vorgabe.id} onChange={(_, d) => setTyp(d.value)} aria-label="Art des Elements">{TYPEN.map(([w, t]) => <option key={w} value={w}>{t}</option>)}</Select>
            <Select value={element ? String(element) : ''} disabled={!!vorgabe.id} onChange={(_, d) => setElement(Number(d.value))} aria-label="Element" style={{ flex: 1 }}>
              {liste.map((e) => <option key={e.id} value={e.id}>{e.l ? `${e.k} – ${e.l}` : e.k}</option>)}
            </Select>
          </div>
        </Field>
        <Field label="Feld"><Input value={feld} onChange={(_, d) => setFeld(d.value)} placeholder="Optional, z. B. Wochensoll" /></Field>
        <Field label="Kategorie"><Select value={String(kategorie)} onChange={(_, d) => setKategorie(Number(d.value))}>{kategorien.map((k) => <option key={k.nr} value={k.nr}>{k.name}</option>)}</Select></Field>
        <Field label="Kommentar" required validationMessage={geprueft && !text.trim() ? 'Bitte ausfüllen.' : undefined}><Textarea rows={6} value={text} onChange={(_, d) => setText(d.value)} autoFocus /></Field>
      </div>
    </StandardDialog>
  );
}

export async function kommentarDialog(vorgabe: Partial<Kommentar> = {}, titel = 'Kommentar'): Promise<Eingabe | null> {
  const kategorien = await api.get<{ nr: number; name: string }[]>(api.dok('/kommentare/kategorien'));
  return dialogZeigen<Eingabe>((zu) => <Inhalt vorgabe={vorgabe} titel={titel} kategorien={kategorien} schliessen={zu} />);
}

export async function kommentarNeu(vorgabe: Partial<Kommentar> = {}): Promise<Kommentar[] | null> {
  if (!zustand().dokument) return null;
  const e = await kommentarDialog(vorgabe, 'Kommentar anlegen');
  if (!e) return null;
  const liste = await api.post<Kommentar[]>(api.dok('/kommentare'), e);
  hinweis('Kommentar angelegt.', 'ok', 2000);
  return liste;
}
