// Ansicht „Aktive Benutzer“: angemeldete Benutzer mit Tätigkeit, Exklusivbetrieb, Bereichssperren und Rechte, Nachrichten.
import { Badge, Button, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, mergeClasses } from '@fluentui/react-components';
import { useEffect } from 'react';
import { api } from '@/api/client';
import { seiteOeffnen } from '@/kern/befehle';
import { useStudio } from '@/kern/zustand';
import { AnsichtRahmen, Trenner, Werkzeug } from '@/komponenten/ansicht';
import { formular } from '@/komponenten/dialoge';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { abfragen, standSetzen, useMultiuser, verlaufLaden, type MultiuserStand } from './stand';
import { useMuStile } from './stile';

const uhr = (d: string, sek = false) => new Date(d).toLocaleTimeString('de-DE', sek ? undefined : { hour: '2-digit', minute: '2-digit' });

export async function nachrichtSenden(an = '') {
  const stand = useMultiuser.getState().stand;
  const andere = (stand?.aktive || []).filter((x) => x.benutzer !== stand?.ich);
  const w = await formular('Nachricht senden', [
    { name: 'an', titel: 'An', art: 'auswahl', wert: an, optionen: [{ wert: '', text: 'Alle Benutzer' }, ...andere.map((x) => ({ wert: x.benutzer, text: x.anzeigename }))] },
    { name: 'text', titel: 'Nachricht', art: 'textfeld', pflicht: true }], { okText: 'Senden' });
  if (!w) return;
  await api.post(api.dok('/multiuser/nachricht'), w).catch(fehlerMelden);
  void abfragen();
}

async function sperren(bereich: string, ein: boolean) {
  try {
    standSetzen(ein ? await api.post<MultiuserStand>(api.dok('/multiuser/sperren'), { bereich }) : await api.loeschen<MultiuserStand>(api.dok(`/multiuser/sperren/${bereich}`)));
  } catch (e) { fehlerMelden(e); }
}

async function exklusiv(ein: boolean) {
  try {
    standSetzen(await api.post<MultiuserStand>(api.dok('/multiuser/exklusiv'), { ein }));
    hinweis(ein ? 'Exklusivbetrieb eingeschaltet.' : 'Exklusivbetrieb beendet.', 'ok');
  } catch (e) { fehlerMelden(e); }
}

export default function MultiUser() {
  const s = useMuStile();
  const { stand, verlauf } = useMultiuser();
  const benutzer = useStudio((x) => x.benutzer);
  const admin = benutzer?.rolle === 'Admin';
  const schreiben = !!benutzer?.darfSchreiben;
  useEffect(() => { verlaufLaden().catch(fehlerMelden); }, []);

  const abschnitt = (titel: string, rechts: JSX.Element | null, inhalt: JSX.Element | (JSX.Element | null)[]) => (
    <section className={s.abschnitt} aria-label={titel}>
      <div className={s.kopf}><h3 className={s.h3}>{titel}</h3>{rechts}</div>
      {inhalt}
    </section>
  );

  return (
    <AnsichtRahmen titel="Aktive Benutzer" laden={!stand}
      werkzeuge={<>
        <Werkzeug text="Nachricht senden …" aktion={() => nachrichtSenden()} />
        <Werkzeug text="Aktualisieren" aktion={abfragen} />
        {admin ? <><Trenner /><Werkzeug text="Gruppen und Rechte" aktion={() => seiteOeffnen('multiuser.verwaltung')} /></> : null}
      </>}>
      {stand ? (
        <div className={s.flaeche}>
          {abschnitt('Angemeldete Benutzer', null, (
            <Table size="small" aria-label="Angemeldete Benutzer">
              <TableHeader><TableRow>{['Benutzer', 'Status', 'Tätigkeit', 'Seit', 'Zuletzt aktiv', ''].map((x, i) => <TableHeaderCell key={i}>{x}</TableHeaderCell>)}</TableRow></TableHeader>
              <TableBody>
                {stand.aktive.map((a) => (
                  <TableRow key={a.benutzer} className={a.aktiv ? undefined : s.inaktiv}>
                    <TableCell>{a.anzeigename}{a.benutzer === stand.ich ? <span className={s.leise}> (Sie)</span> : null}</TableCell>
                    <TableCell><Badge appearance="tint" color={a.aktiv ? 'success' : 'subtle'}>{a.aktiv ? 'Aktiv' : 'Inaktiv'}</Badge></TableCell>
                    <TableCell>{a.taetigkeit}</TableCell>
                    <TableCell className={s.zahl}>{uhr(a.seit)}</TableCell>
                    <TableCell className={s.zahl}>{uhr(a.aktivitaet, true)}</TableCell>
                    <TableCell className={s.aktion}>{a.benutzer !== stand.ich ? <Button size="small" onClick={() => nachrichtSenden(a.benutzer)}>Nachricht …</Button> : null}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ))}
          {abschnitt('Exklusivbetrieb',
            <Button size="small" disabled={!schreiben || (!!stand.exklusiv && !stand.exklusiv.eigen && !admin)} onClick={() => exklusiv(!stand.exklusiv)}>
              {stand.exklusiv ? 'Exklusivbetrieb beenden' : 'Exklusivbetrieb einschalten'}
            </Button>,
            stand.exklusiv
              ? <p className={mergeClasses(s.text, !stand.exklusiv.eigen && s.warnung)}>{`${stand.exklusiv.anzeigename} arbeitet seit ${uhr(stand.exklusiv.seit, true)} exklusiv; andere Benutzer können nicht ändern.`}</p>
              : <p className={mergeClasses(s.text, s.leise)}>Ausgeschaltet: Alle berechtigten Benutzer können gleichzeitig ändern, Änderungen erscheinen sofort bei allen.</p>)}
          {abschnitt('Bereiche und Ihre Rechte',
            <span className={s.kopfinfo}>{`Gruppe ${stand.rechte.gruppe}${stand.rechte.nurLesen ? ', nur lesen' : ''}`}</span>, [
              <Table key="t" size="small" aria-label="Bereiche">
                <TableHeader><TableRow>{['Bereich', 'Ihre Rechtestufe', 'Gesperrt', ''].map((x, i) => <TableHeaderCell key={i}>{x}</TableHeaderCell>)}</TableRow></TableHeader>
                <TableBody>
                  {stand.rechte.bereiche.map((b) => {
                    const sp = stand.sperren.find((x) => x.bereich === b.bereich);
                    const eigen = !!sp && sp.benutzer.toLowerCase() === stand.ich.toLowerCase();
                    return (
                      <TableRow key={b.bereich} className={sp && !eigen ? s.gesperrt : undefined}>
                        <TableCell>{b.text}</TableCell>
                        <TableCell>{b.stufeText}</TableCell>
                        <TableCell>{sp ? `${eigen ? 'Von Ihnen' : `Von ${sp.anzeigename}`} seit ${uhr(sp.seit)}` : <span className={s.leise}>Nein</span>}</TableCell>
                        <TableCell className={s.aktion}>
                          {sp
                            ? <Button size="small" disabled={!eigen && !admin} onClick={() => sperren(b.bereich, false)}>Freigeben</Button>
                            : <Button size="small" disabled={!b.bearbeiten || !schreiben} title="Bereich zur alleinigen Bearbeitung sperren" onClick={() => sperren(b.bereich, true)}>Sperren</Button>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>,
              <p key="p" className={mergeClasses(s.text, s.leise)}>Sperren verfallen automatisch, wenn ihr Inhaber einige Minuten nicht mehr aktiv ist.</p>,
            ])}
          {abschnitt('Nachrichten', null, verlauf.length ? (
            <div className={s.nachrichten}>
              {[...verlauf].reverse().map((n) => (
                <div key={n.id} className={s.nachricht}>
                  <span className={mergeClasses(s.zahl, s.leise)}>{uhr(n.zeit, true)}</span>
                  <b>{`${n.von}${n.an ? ` an ${n.an}` : ''}`}</b>
                  <span>{n.text}</span>
                </div>
              ))}
            </div>
          ) : <p className={mergeClasses(s.text, s.leise)}>Keine Nachrichten.</p>)}
        </div>
      ) : null}
    </AnsichtRahmen>
  );
}
