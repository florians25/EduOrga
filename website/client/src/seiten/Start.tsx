import { Link } from "react-router-dom";
import { Abschnittskopf, Befehle, Browserfenster, iosBild, IOS_BILDER_ECHT, Knopf, Pfeillink, Standwort, Telefon } from "../bausteine/Bausteine";
import {
  DISCUSSIONS,
  FAQ,
  GRUNDSAETZE,
  INSTALLATION,
  ISSUE_FEHLER,
  ISSUE_NEU,
  ISSUE_WUNSCH,
  MORGEN,
  PLATTFORMEN,
  SCHRITTE,
  UEBERSICHT,
  UEBERSICHT_SPALTEN,
  VORTEILE,
  ZIELGRUPPEN,
  type Bild,
  type Vorteil,
} from "../inhalt";
import { datumLang, STAND, STAND_LINK } from "../stand";

const B = (datei: string, titel: string, telefon = false): Bild => ({ datei, titel, telefon });

export function Start() {
  return (
    <>
      <Buehne />
      <Morgen />
      <Plattformstand />
      <FuerWen />
      <VorteilZeile v={VORTEILE.planung} bild={<Browserfenster bild={B("/bilder/studio/vertretung.png", "EduOrga Studio: Tagesplanung mit offenen Stunden, Empfehlung und Miniplan der Lehrkraft")} adresse="studio.meine-schule.de" />} />
      <VorteilZeile
        v={VORTEILE.aktuell}
        gespiegelt
        bild={
          <div className="geraete">
            <Browserfenster bild={{ ...B("/bilder/web/stundenplan.png", "EduOrga Web: Klassenplan der Woche mit Änderungen, Entfall und Terminen"), breite: 2880, hoehe: 2000 }} adresse="plan.meine-schule.de" />
            <Telefon bild={iosBild("plan-woche-hell")} klasse="geraete-telefon" />
          </div>
        }
      />
      <VorteilZeile
        v={VORTEILE.klassenbuch}
        bild={
          <div className="telefonpaar">
            <Telefon bild={iosBild("stunde-klassenbuch")} />
            <Telefon bild={B("/bilder/mobile/schueler.png", "EduOrga Mobile: Anwesenheitskontrolle der Klasse", true)} klasse="telefon-versetzt" />
          </div>
        }
      />
      <VorteilZeile
        v={VORTEILE.kommunikation}
        gespiegelt
        bild={
          <div className="telefonpaar">
            <Telefon bild={B("/bilder/mobile/sprechtag-eltern.png", "EduOrga Mobile: Elternsprechtag aus Sicht der Eltern", true)} />
            <Telefon bild={B("/bilder/mobile/sprechtag-lehrkraft.png", "EduOrga Mobile: Elternsprechtag aus Sicht der Lehrkraft mit freien und gebuchten Zeiten", true)} klasse="telefon-versetzt" />
          </div>
        }
      />
      <Grundsaetze />
      <Uebersicht />
      <SoFunktioniert />
      <Rueckmeldung />
      <Fragen />
      <Schluss />
    </>
  );
}

function Buehne() {
  return (
    <section className="buehne" aria-labelledby="buehne-titel">
      <div className="breite">
        <div className="buehne-text">
          <p className="einordnung">Stundenplanung und Schulorganisation</p>
          <h1 id="buehne-titel">
            Stundenplan, Vertretung und Klassenbuch. <span>In einem System, das Ihrer Schule gehört.</span>
          </h1>
          <p className="buehne-einleitung">
            EduOrga plant Stunden- und Vertretungspläne im Browser und bringt jede Änderung in kurzer Zeit zu Kollegium,
            Schülerinnen, Schülern und Eltern – auf PC, Tablet und Telefon. Betrieben auf dem eigenen Server, ohne
            Cloud-Pflicht, mit offenem Quellcode.
          </p>
          <div className="aktionen">
            <Knopf zu="/installation">Installation ansehen</Knopf>
            <Knopf zu="/#funktionen" art="zweit">
              Alle Funktionen
            </Knopf>
          </div>
        </div>
        <ul className="buehne-fakten" aria-label="Kurz gesagt">
          <li>
            <strong>Eigener Server</strong>
            <span>Docker, SQLite oder MariaDB</span>
          </li>
          <li>
            <strong>Keine Cloud-Pflicht</strong>
            <span>keine Telemetrie, kein Tracking</span>
          </li>
          <li>
            <strong>Offener Quellcode</strong>
            <span>vollständig auf GitHub</span>
          </li>
          <li>
            <strong>WCAG 2.1 AA</strong>
            <span>Kontraste geprüft, Tastatur, Fokus</span>
          </li>
        </ul>
      </div>
      <div className="breite">
        <figure className="buehne-bild">
          <div className="buehne-flaeche">
            <Browserfenster
              bild={B("/bilder/studio/planen.png", "EduOrga Studio: Manuell planen mit Unterrichtsliste und Klassenplan der 5a")}
              adresse="studio.meine-schule.de"
              laden="eager"
              klasse="buehne-fenster"
            />
            <Telefon bild={iosBild("plan-woche-hell")} laden="eager" klasse="buehne-telefon" />
          </div>
          <figcaption>
            EduOrga Studio im Browser, daneben der Wochenplan {IOS_BILDER_ECHT ? "in der App für iPhone" : "auf dem Telefon"}. Originalansichten mit Beispieldaten.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

function Morgen() {
  return (
    <section className="abschnitt abschnitt-morgen" aria-labelledby="morgen-titel">
      <div className="breite">
        <Abschnittskopf
          id="morgen-titel"
          ueber="Ein Schulmorgen, Beispiel"
          titel="Sechs Minuten von der Krankmeldung bis zum Plan auf dem Telefon."
        />
        <ol className="zeitleiste">
          {MORGEN.map((m) => (
            <li key={m.zeit}>
              <time>{m.zeit}</time>
              <h3>{m.titel}</h3>
              <p>{m.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Plattformstand() {
  const v = STAND.veroeffentlichung;
  return (
    <section className="abschnitt abschnitt-linie" id="stand" aria-labelledby="stand-titel">
      <div className="breite zweispaltig">
        <Abschnittskopf
          id="stand-titel"
          ueber="Stand der Plattformen"
          titel="Was heute läuft – und was noch nicht."
          text={
            <>
              Entwicklungsstand {STAND.version}
              {v ? <> · Aktuelle Version {v.tag}{v.datum && <> vom {datumLang(v.datum)}</>}</> : " · noch keine Veröffentlichung"} · letzte Änderung{" "}
              <time dateTime={STAND.letzteAenderung}>{datumLang(STAND.letzteAenderung)}</time>.
            </>
          }
        >
          <Pfeillink zu={STAND_LINK}>Projektstand und Änderungen</Pfeillink>
        </Abschnittskopf>
        <ul className="plattformen">
          {PLATTFORMEN.map((p) => (
            <li key={p.name}>
              <div className="plattform-name">
                <Link to={p.pfad}>{p.name}</Link>
                <span>{p.art}</span>
              </div>
              <div className="plattform-stand">
                <Standwort stand={p.stand}>{p.standText}</Standwort>
                <span>{p.hinweis}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function FuerWen() {
  return (
    <section className="abschnitt abschnitt-flaeche" id="fuer-wen" aria-labelledby="fuer-wen-titel">
      <div className="breite">
        <Abschnittskopf id="fuer-wen-titel" ueber="Für wen" titel="Ein System für alle, die Schule organisieren – und alle, die davon erfahren müssen." />
        <div className="zielgruppen">
          {ZIELGRUPPEN.map((z) => (
            <article key={z.titel}>
              <h3>{z.titel}</h3>
              <p className="zielgruppe-satz">{z.satz}</p>
              <ul>
                {z.punkte.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function VorteilZeile({ v, bild, gespiegelt }: { v: Vorteil; bild: React.ReactNode; gespiegelt?: boolean }) {
  return (
    <section className="abschnitt vorteil-abschnitt" id={v.id} aria-labelledby={`${v.id}-titel`}>
      <div className={gespiegelt ? "breite vorteil vorteil-gespiegelt" : "breite vorteil"}>
        <div className="vorteil-text">
          <p className="einordnung">{v.ueber}</p>
          <h2 id={`${v.id}-titel`}>{v.titel}</h2>
          <p className="einleitung">{v.text}</p>
          <ul className="haken">
            {v.punkte.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <Pfeillink zu={v.link.zu}>{v.link.text}</Pfeillink>
        </div>
        <div className="vorteil-bild">{bild}</div>
      </div>
    </section>
  );
}

function Grundsaetze() {
  return (
    <section className="abschnitt abschnitt-dunkel" id="grundsaetze" aria-labelledby="grundsaetze-titel">
      <div className="breite">
        <Abschnittskopf
          id="grundsaetze-titel"
          ueber="Datenschutz und Betrieb"
          titel="Die Daten Ihrer Schule bleiben in Ihrer Schule."
          text="EduOrga ist für den Betrieb auf eigener Hardware gebaut. Was andere als Dienst aus der Cloud anbieten, läuft hier auf dem Server, den Sie kontrollieren."
        />
        <div className="grundsaetze">
          {GRUNDSAETZE.map((g) => (
            <article key={g.titel}>
              <h3>{g.titel}</h3>
              <p>{g.text}</p>
              {g.link && <Pfeillink zu={g.link.zu}>{g.link.text}</Pfeillink>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Uebersicht() {
  return (
    <section className="abschnitt" id="funktionen" aria-labelledby="funktionen-titel">
      <div className="breite zweispaltig zweispaltig-oben">
        <Abschnittskopf
          id="funktionen-titel"
          ueber="Funktionen im Überblick"
          titel="Was in welcher Anwendung steckt."
          text="Geplant wird in Studio. Web, Mobile und die App für iPhone und iPad bringen die Ergebnisse in den Schulalltag – mit denselben Daten und derselben Kennzeichnung."
        >
          <div className="linkspalte">
            <Pfeillink zu="/studio">EduOrga Studio</Pfeillink>
            <Pfeillink zu="/web">EduOrga Web</Pfeillink>
            <Pfeillink zu="/mobile">Mobile und iOS</Pfeillink>
          </div>
        </Abschnittskopf>
        <div className="tabellenrahmen">
          <table className="tabelle uebersicht">
            <caption className="unsichtbar">Funktionen je Anwendung</caption>
            <thead>
              <tr>
                <th scope="col">Funktion</th>
                {UEBERSICHT_SPALTEN.map((s) => (
                  <th key={s} scope="col" className="mitte">
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            {UEBERSICHT.map((g) => (
              <tbody key={g.gruppe}>
                <tr className="gruppe">
                  <th scope="rowgroup" colSpan={5}>
                    {g.gruppe}
                  </th>
                </tr>
                {g.zeilen.map(([name, ...werte]) => (
                  <tr key={name}>
                    <th scope="row">{name}</th>
                    {werte.map((w, i) => (
                      <td key={i} className="mitte">
                        {w ? (
                          <>
                            <span className="ja" aria-hidden />
                            <span className="unsichtbar">ja</span>
                          </>
                        ) : (
                          <>
                            <span className="nein" aria-hidden>
                              –
                            </span>
                            <span className="unsichtbar">nein</span>
                          </>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </div>
    </section>
  );
}

function SoFunktioniert() {
  return (
    <section className="abschnitt abschnitt-linie" id="so-gehts" aria-labelledby="so-gehts-titel">
      <div className="breite">
        <Abschnittskopf id="so-gehts-titel" ueber="So funktioniert’s" titel="In drei Schritten zum ersten veröffentlichten Plan." />
        <ol className="schritte">
          {SCHRITTE.map((s, i) => (
            <li key={s.titel}>
              <span className="schritt-nummer" aria-hidden>
                {i + 1}
              </span>
              <h3>{s.titel}</h3>
              <p>{s.text}</p>
              {s.befehl && <code className="schritt-befehl">{s.befehl}</code>}
              <Pfeillink zu={s.link.zu}>{s.link.text}</Pfeillink>
            </li>
          ))}
        </ol>
        <div className="schritte-befehl">
          <Befehle titel="Als root auf dem Server" text={INSTALLATION.laden} />
        </div>
      </div>
    </section>
  );
}

function Rueckmeldung() {
  return (
    <section className="abschnitt abschnitt-flaeche" id="rueckmeldung" aria-labelledby="rueckmeldung-titel">
      <div className="breite zweispaltig">
        <Abschnittskopf
          id="rueckmeldung-titel"
          ueber="Rückmeldung"
          titel="Ideen, Wünsche und Fehler direkt auf GitHub melden."
          text="EduOrga entsteht mit den Schulen, die es nutzen. Jede Meldung ist öffentlich nachvollziehbar – vom Eingang bis zur Lösung. Bitte keine personenbezogenen Daten einstellen."
        />
        <ul className="meldewege">
          <li>
            <a href={ISSUE_FEHLER} rel="noopener noreferrer">
              <strong>
                Fehler melden <span aria-hidden>↗</span>
              </strong>
              <span>Formular mit Anwendung, Version, Schritten und Bildschirmfotos</span>
            </a>
          </li>
          <li>
            <a href={ISSUE_WUNSCH} rel="noopener noreferrer">
              <strong>
                Idee oder Wunsch <span aria-hidden>↗</span>
              </strong>
              <span>Situation im Schulalltag beschreiben, Vorschlag machen</span>
            </a>
          </li>
          <li>
            <a href={DISCUSSIONS} rel="noopener noreferrer">
              <strong>
                Fragen und Austausch <span aria-hidden>↗</span>
              </strong>
              <span>Einsatz an der Schule, Erfahrungen, offene Fragen</span>
            </a>
          </li>
          <li>
            <a href={ISSUE_NEU} rel="noopener noreferrer">
              <strong>
                Alle Vorlagen <span aria-hidden>↗</span>
              </strong>
              <span>Auswahl der Formulare auf GitHub</span>
            </a>
          </li>
        </ul>
      </div>
    </section>
  );
}

function Fragen() {
  return (
    <section className="abschnitt" id="fragen" aria-labelledby="fragen-titel">
      <div className="breite zweispaltig zweispaltig-oben">
        <Abschnittskopf id="fragen-titel" ueber="Häufige Fragen" titel="Was Schulleitungen vorher wissen möchten." />
        <div className="fragen">
          {FAQ.map((f) => (
            <details key={f.frage}>
              <summary>{f.frage}</summary>
              <p>{f.antwort}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Schluss() {
  return (
    <section className="schluss" aria-labelledby="schluss-titel">
      <div className="breite schluss-innen">
        <div>
          <h2 id="schluss-titel">Einfach mehr Schulalltag.</h2>
          <p>Ein Skript richtet alles ein. Die Beispielschule in EduOrga Studio zeigt sofort, wie geplant wird.</p>
        </div>
        <div className="aktionen">
          <Knopf zu="/installation" art="hell">
            Installation ansehen
          </Knopf>
          <Pfeillink zu="/dokumentation" klasse="pfeillink-hell">
            Dokumentation
          </Pfeillink>
        </div>
      </div>
    </section>
  );
}
