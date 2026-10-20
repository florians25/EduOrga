// Prüfen und veröffentlichen (Tagesplanung, Blatt „Veröffentlichen“): Stand des Tages (offene Stunden, Räume, Kollisionen von Lehrkräften und
// Räumen), Zahlen (Vertretungen, Zusammenlegungen, Aufsichten, Entfälle …), Nachrichten zum Tag (Tagestexte hinzufügen) und die
// Notiz des Vertretungsplaners, dann „An EduOrga Web senden“ und Drucken (Klassen- und Lehrerversion, Monitor).
// Daneben die Belastung der Lehrkräfte (Vertretungen heute, in der Woche und im Monat, Mehrarbeit nach NRW-Regel) als Balken.
import { Button, Select, Spinner, Textarea, makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import { CheckmarkCircle20Regular, CloudArrowUp20Regular, ErrorCircle20Regular, Warning20Regular } from '@fluentui/react-icons';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/api/client';
import { seiteOeffnen } from '@/kern/befehle';
import { useDaten } from '@/kern/laden';
import { useDarfSchreiben } from '@/kern/zustand';
import type { AnsichtProps } from '@/kern/ansichten';
import { AnsichtRahmen, Leer } from '@/komponenten/ansicht';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { direktLaden, useDirekt, vertretungenSenden } from '../../untplanweb/Senden';
import { tpBlattSetzen, usePlanungsdatum, vpfad } from '../kern';
import { QUELLE, bilanzLaden, mehrzahl } from './daten';
import './ablauf.css';

const useStile = makeStyles({
  inhalt: { flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', padding: '12px 14px 16px 14px' },
  zeile: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  leise: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  text: { width: '100%' },
});

interface Kalender {
  tagestexte: { start: string; bis: string; text: string; portal: boolean; art: string; elemente: string; formatiert: boolean }[];
  kalendertag: { art: string; grund: string; stunden: string; notiz: string };
  arten: string[];
}

function Status({ ok, warn, children }: { ok: boolean; warn?: boolean; children: React.ReactNode }) {
  return (
    <li className={mergeClasses('ta-status', ok ? 'ok' : warn ? 'warn' : 'fehler')}>
      {ok ? <CheckmarkCircle20Regular /> : warn ? <Warning20Regular /> : <ErrorCircle20Regular />}
      <span>{children}</span>
    </li>
  );
}

/** Im Blatt der Tagesplanung (p.eingebettet): ohne eigenen Rahmen und Titel. */
export default function Pruefen({ p }: AnsichtProps) {
  const s = useStile();
  const datum = usePlanungsdatum();
  const schreiben = useDarfSchreiben();
  const { daten: b } = useDaten(() => bilanzLaden(datum!), [datum], { bereiche: ['Vertretung', 'Stundenplan', 'Unterricht', 'Stammdaten'], aktiv: !!datum });
  const { daten: k, neuLaden } = useDaten(() => api.get<Kalender>(vpfad(`/kalender?datum=${datum}`)), [datum], { bereiche: ['Vertretung', 'Einstellungen'], quelle: QUELLE, aktiv: !!datum });
  const [neuText, setNeuText] = useState('');
  const [neuArt, setNeuArt] = useState('Alle');
  const [notiz, setNotiz] = useState('');
  const sendet = useDirekt((x) => x.sendet);
  const direkt = useDirekt((x) => x.stand);
  useEffect(() => { void direktLaden(); }, []);
  const gesendetText = !direkt ? '' : !direkt.eingerichtet ? 'EduOrga Web ist nicht verbunden'
    : direkt.zuletztErfolgreich ? `Zuletzt gesendet ${new Date(direkt.zuletztErfolgreich).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}${direkt.automatisch ? ' (automatische Übertragung an)' : ''}` : 'Noch nicht gesendet';
  useEffect(() => { setNotiz(k?.kalendertag.notiz || ''); }, [k?.kalendertag.notiz]);

  const z = b?.zahlen;
  const koll = (b?.kollisionen.lehrer.length || 0) + (b?.kollisionen.raeume.length || 0);
  const bereit = !!z && z.offen === 0 && z.raumOffen === 0 && koll === 0;
  const druck = (version: string, ausgabe: string) => window.open(api.dok(`/druck/vertretungsplan?von=${datum}&bis=${datum}&version=${version}&ausgabe=${ausgabe}`), '_blank', 'noopener');

  async function textHinzufuegen() {
    if (!k || !datum || !neuText.trim()) return;
    const texte = [...k.tagestexte.map((t) => ({ start: t.start, bis: t.bis, text: t.text, portal: t.portal, art: t.art, elemente: t.elemente })), { start: datum, bis: datum, text: neuText.trim(), portal: true, art: neuArt, elemente: '' }];
    try { await api.put(vpfad('/tagestexte'), { datum, texte }, { quelle: QUELLE }); setNeuText(''); await neuLaden(true); hinweis('Nachricht zum Tag gespeichert.', 'ok', 2000); } catch (e) { fehlerMelden(e); }
  }
  async function textEntfernen(i: number) {
    if (!k || !datum) return;
    const texte = k.tagestexte.filter((_, j) => j !== i).map((t) => ({ start: t.start, bis: t.bis, text: t.text, portal: t.portal, art: t.art, elemente: t.elemente }));
    try { await api.put(vpfad('/tagestexte'), { datum, texte }, { quelle: QUELLE }); await neuLaden(true); } catch (e) { fehlerMelden(e); }
  }
  async function notizSpeichern() {
    if (!k || !datum || notiz === (k.kalendertag.notiz || '')) return;
    const kt = k.kalendertag;
    try { await api.post(vpfad('/kalendertag'), { datum, art: kt.art, grund: kt.grund, stunden: kt.stunden, notiz }, { quelle: QUELLE }); await neuLaden(true); hinweis('Notiz gespeichert.', 'ok', 1500); } catch (e) { fehlerMelden(e); }
  }

  const inhalt = (
    <>
      {!b || !z ? null : (
        <div className={s.inhalt} data-testid="pruefen">
          <section className="ta-karte-flach" aria-label="Stand des Tages">
            <div className="ta-abschnitt-titel">Stand des Tages</div>
            <ul className="ta-statusliste">
              <Status ok={z.offen === 0}>{z.offen ? <>{`${mehrzahl(z.offen, 'Stunde ist', 'Stunden sind')} noch offen – `}<button type="button" className="ta-link" onClick={() => tpBlattSetzen(null)}>lösen</button></> : 'Alle Stunden sind besetzt'}</Status>
              <Status ok={z.raumOffen === 0} warn>{z.raumOffen ? `${mehrzahl(z.raumOffen, 'Stunde', 'Stunden')} ohne Raum` : 'Alle Stunden haben einen Raum'}</Status>
              <Status ok={b.kollisionen.lehrer.length === 0}>{b.kollisionen.lehrer.length ? `${mehrzahl(b.kollisionen.lehrer.length, 'Kollision', 'Kollisionen')} von Lehrkräften` : 'Keine Lehrkraft ist doppelt eingeplant'}</Status>
              {b.kollisionen.lehrer.map((x) => <li key={x} className="ta-status-detail">{x}</li>)}
              <Status ok={b.kollisionen.raeume.length === 0} warn>{b.kollisionen.raeume.length ? `${mehrzahl(b.kollisionen.raeume.length, 'Raum ist', 'Räume sind')} doppelt belegt` : 'Kein Raum ist doppelt belegt'}</Status>
              {b.kollisionen.raeume.map((x) => <li key={x} className="ta-status-detail">{x}</li>)}
            </ul>
          </section>

          <section className={mergeClasses('ta-karte-flach', 'ta-veroeffentlichen')} aria-label="Veröffentlichen">
            <div className="ta-abschnitt-titel">Veröffentlichen</div>
            <div className={s.leise} style={{ marginBottom: 8 }}>{gesendetText ? `${gesendetText} · ` : ''}{bereit ? 'Der Tag ist vollständig geplant.' : 'Offene Stunden und Kollisionen erscheinen so auch im Aushang – trotzdem veröffentlichen ist möglich.'}</div>
            <div className={s.zeile}>
              <Button size="small" appearance="primary" icon={sendet ? <Spinner size="extra-tiny" /> : <CloudArrowUp20Regular />} disabled={!schreiben || sendet} onClick={() => void vertretungenSenden()} data-testid="pruefen-senden"
                title="Vertretungen des Tages jetzt an EduOrga Web übertragen (Befehl „Vertretungen jetzt an EduOrga Web senden“)">An EduOrga Web senden</Button>
              <Button size="small" onClick={() => druck('klassen', 'pdf')} title="Vertretungsplan (Klassenversion) als PDF in neuem Tab">Drucken: Klassen</Button>
              <Button size="small" onClick={() => druck('lehrer', 'pdf')} title="Vertretungsplan (Lehrerversion) als PDF in neuem Tab">Drucken: Lehrkräfte</Button>
              <Button size="small" appearance="subtle" onClick={() => druck('klassen', 'monitor')} title="Vollbild für Info-Bildschirme">Monitor</Button>
              <Button size="small" appearance="subtle" onClick={() => seiteOeffnen('druck.vertretung')}>Seitenlayout …</Button>
            </div>
          </section>

          <section className="ta-karte-flach" aria-label="Zahlen des Tages">
            <div className="ta-abschnitt-titel">Zahlen des Tages</div>
            <dl className="ta-zahlen">
              {([['Vertretungen', z.vertreten], ['Zusammenlegungen', z.betreuung], ['Pausenaufsichten', z.aufsicht], ['Entfälle', z.entfall], ['Ohne Lehrkraft', z.ohneLehrkraft],
                ['Raumänderungen', z.raum], ['Verlegungen', z.verlegung], ['Freisetzungen', z.freisetzung], ['Offen', z.offen + z.raumOffen]] as [string, number][]).map(([t, n]) => (
                <div key={t} className={t === 'Offen' && n ? 'offen' : undefined}><dt>{t}</dt><dd>{n}</dd></div>
              ))}
            </dl>
          </section>

          <section className="ta-karte-flach" aria-label="Nachrichten zum Tag">
            <div className="ta-abschnitt-titel">Nachrichten zum Tag</div>
            {k?.tagestexte.length ? (
              <ul className="ta-texte">
                {k.tagestexte.map((t, i) => (
                  <li key={`${t.start}-${i}`}>
                    <span className="ta-texte-art">{t.art}</span><span className="ta-texte-text">{t.text}</span>
                    {t.bis !== t.start ? <span className={s.leise}>{`bis ${t.bis.slice(8, 10)}.${t.bis.slice(5, 7)}.`}</span> : null}
                    {schreiben ? <Button size="small" appearance="subtle" onClick={() => void textEntfernen(i)}>Entfernen</Button> : null}
                  </li>
                ))}
              </ul>
            ) : <span className={s.leise}>Keine Nachrichten für diesen Tag.</span>}
            {schreiben ? (
              <div className={s.zeile} style={{ marginTop: 6 }}>
                <Textarea className={s.text} resize="vertical" value={neuText} onChange={(_, d) => setNeuText(d.value)} placeholder="Neue Nachricht zum Tag (erscheint im Aushang und in EduOrga Web)" aria-label="Neue Nachricht zum Tag" />
                <Select size="small" value={neuArt} onChange={(_, d) => setNeuArt(d.value)} aria-label="Für">
                  {(k?.arten || ['Alle']).map((x) => <option key={x} value={x}>{x === 'Alle' ? 'für alle' : x === 'Klassen' ? 'für Klassen' : x === 'Lehrer' ? 'für Lehrkräfte' : 'nur Lehrkräfte'}</option>)}
                </Select>
                <Button size="small" disabled={!neuText.trim()} onClick={() => void textHinzufuegen()}>Hinzufügen</Button>
                <Button size="small" appearance="subtle" onClick={() => seiteOeffnen('vertretung.kalender')}>Kalender und Tagestexte …</Button>
              </div>
            ) : null}
            <div className="ta-abschnitt-titel" style={{ marginTop: 12 }}>Notiz (wird nicht gedruckt)</div>
            <Textarea className={s.text} resize="vertical" value={notiz} disabled={!schreiben} onChange={(_, d) => setNotiz(d.value)} onBlur={() => void notizSpeichern()} aria-label="Notiz des Vertretungsplaners" />
          </section>

        </div>
      )}
    </>
  );
  if (p.eingebettet) return <div className="ta-eingebettet" data-ansicht="vertretung.tagesbilanz">{inhalt}</div>;
  return <AnsichtRahmen titel="Prüfen und veröffentlichen">{inhalt}</AnsichtRahmen>;
}

/** Belastung der Lehrkräfte: Vertretungen heute, in der Woche und im Monat (Balken), Mehrarbeit im Monat nach NRW-Regel. */
export function Belastung() {
  const datum = usePlanungsdatum();
  const [sort, setSort] = useState<'woche' | 'monat' | 'ma'>('woche');
  const { daten: b, laedt } = useDaten(() => bilanzLaden(datum!), [datum], { bereiche: ['Vertretung', 'Stundenplan', 'Stammdaten'], aktiv: !!datum });
  const liste = useMemo(() => {
    const l = [...(b?.lehrer || [])];
    if (sort === 'monat') l.sort((x, y) => y.monat - x.monat || y.woche - x.woche);
    if (sort === 'ma') l.sort((x, y) => y.mehrarbeit - x.mehrarbeit || y.monat - x.monat);
    return l;
  }, [b, sort]);
  const maxW = Math.max(3, ...liste.map((x) => Math.max(x.woche, x.maxWoche)));
  const maxM = Math.max(6, ...liste.map((x) => Math.max(x.monat, x.maxMonat)));
  const monat = datum ? new Date(`${datum}T12:00:00`).toLocaleDateString('de-DE', { month: 'long' }) : '';
  return (
    <AnsichtRahmen titel="Belastung der Lehrkräfte" laden={laedt && !b}
      werkzeuge={<>
        <span className="ta-werkzeugtext">Sortieren</span>
        <Select size="small" value={sort} onChange={(_, d) => setSort(d.value as typeof sort)} aria-label="Sortieren">
          <option value="woche">Woche</option><option value="monat">Monat</option><option value="ma">Mehrarbeit</option>
        </Select>
      </>}
      fuss={<span>{`${mehrzahl(liste.length, 'Lehrkraft', 'Lehrkräfte')} mit Vertretungen · Mehrarbeit NRW: ab mehr als 3 Std. im Monat vergütungsfähig`}</span>}>
      {!b ? null : !liste.length ? <Leer text="In dieser Woche und diesem Monat hat noch niemand vertreten." /> : (
        <div className="ta-belastung" data-testid="belastung">
          <div className="ta-bzeile kopf"><span>Lehrkraft</span><span>Heute</span><span>Woche</span><span>{monat}</span><span>Mehrarbeit</span></div>
          {liste.map((l) => (
            <div key={l.id} className="ta-bzeile" title={l.name}>
              <span className="ta-bname"><b>{l.k}</b> {l.name}</span>
              <span className="ta-bzahl">{l.heute || ''}</span>
              <span className="ta-bbalken" title={`${l.woche} Vertretungen diese Woche${l.maxWoche ? ` (höchstens ${l.maxWoche})` : ''}`}>
                <span className={mergeClasses('ta-balken', 'breit', l.maxWoche > 0 && l.woche >= l.maxWoche && 'voll')}><i style={{ width: `${Math.round((l.woche / maxW) * 100)}%` }} />{l.maxWoche ? <em style={{ left: `${Math.round((l.maxWoche / maxW) * 100)}%` }} /> : null}</span>
                <span className="ta-bzahl">{l.woche}</span>
              </span>
              <span className="ta-bbalken" title={`${l.monat} Vertretungen im ${monat}${l.maxMonat ? ` (höchstens ${l.maxMonat})` : ''}`}>
                <span className={mergeClasses('ta-balken', 'breit', l.maxMonat > 0 && l.monat >= l.maxMonat && 'voll')}><i style={{ width: `${Math.round((l.monat / maxM) * 100)}%` }} />{l.maxMonat ? <em style={{ left: `${Math.round((l.maxMonat / maxM) * 100)}%` }} /> : null}</span>
                <span className="ta-bzahl">{l.monat}</span>
              </span>
              <span className={mergeClasses('ta-bzahl', l.mehrarbeit > l.grenze && 'ueber')} title={`Mehrarbeit im ${monat}: ${l.mehrarbeit} Std., vergütungsfähig ${l.verguetung} (Grenze ${l.grenze})`}>
                {l.mehrarbeit ? `${l.mehrarbeit}${l.verguetung ? ` · ${l.verguetung} verg.` : ''}` : '–'}
              </span>
            </div>
          ))}
        </div>
      )}
    </AnsichtRahmen>
  );
}
