import { Link } from "react-router-dom";
import { Befehle, Browserfenster, Knopf, Pfeillink, Telefon } from "../bausteine/Bausteine";
import { DATEI, DISCUSSIONS, INSTALLATION, ISSUES, MODUL_LISTE, RELEASES, type Modul } from "../inhalt";
import { datumLang, STAND, STAND_LINK } from "../stand";

const [STUDIO, WEB, MOBILE, IOS] = MODUL_LISTE;
const bild = (m: Modul, datei: string) => m.bilder.find((b) => b.datei.endsWith(`/${datei}.png`)) ?? m.bilder[0];

export function Start() {
  return (
    <>
      <Buehne />
      <Statusleiste />
      <Anwendungen />
      <InstallationKurz />
      <HandbuchKurz />
    </>
  );
}

function Buehne() {
  return (
    <section className="buehne">
      <div className="breite buehne-raster">
        <div className="buehne-text">
          <p className="marke-klein">EduOrga · Stundenplanung und Schulorganisation</p>
          <h1 className="buehne-titel">
            <span>Einfach mehr</span>
            <span className="buehne-titel-akzent">Schulalltag.</span>
          </h1>
          <p className="buehne-wert">
            Stunden- und Vertretungsplanung, digitales Klassenbuch und Kommunikation. EduOrga verbindet die Planung im
            Schulbüro mit einem Portal für Kollegium, Klassen und Eltern.
          </p>
          <div className="buehne-aktionen">
            <Knopf zu="/installation">
              EduOrga installieren <span aria-hidden>→</span>
            </Knopf>
            <Pfeillink zu="/handbuch">Handbuch öffnen</Pfeillink>
          </div>
          <p className="buehne-fakten">Im Browser · Selbst hostbar · Quelloffen entwickelt</p>
        </div>
        <figure className="buehne-bild">
          <div className="buehne-flaeche">
            <Browserfenster bild={bild(STUDIO, "planen")} adresse="studio.meine-schule.de" laden="eager" />
            <Telefon bild={bild(WEB, "stundenplan-telefon")} laden="eager" klasse="buehne-telefon" />
          </div>
          <figcaption>
            <span>EduOrga Studio und Web</span>
            Originalansichten mit Beispieldaten
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

function Statusleiste() {
  const v = STAND.veroeffentlichung;
  return (
    <div className="statusleiste">
      <div className="breite statusleiste-innen">
        <p>
          <span>
            Entwicklungsstand <strong>{STAND.version}</strong>
          </span>
          <span className="trenner" aria-hidden>
            ·
          </span>
          <span>
            {v ? (
              <>
                Aktuelle Version <strong>{v.tag}</strong>
                {v.datum && <> vom {datumLang(v.datum)}</>}
              </>
            ) : (
              "Noch keine Veröffentlichung"
            )}
          </span>
          <span className="trenner" aria-hidden>
            ·
          </span>
          <span>
            Letzte Änderung <time dateTime={STAND.letzteAenderung}>{datumLang(STAND.letzteAenderung)}</time>
          </span>
        </p>
        <Pfeillink zu={STAND_LINK}>Projektstand &amp; Änderungen</Pfeillink>
      </div>
    </div>
  );
}

function Kernpunkte({ m }: { m: Modul }) {
  return (
    <ul className="kernpunkte">
      {m.kernpunkte.map((k) => (
        <li key={k}>{k}</li>
      ))}
    </ul>
  );
}

function Anwendungen() {
  return (
    <section className="abschnitt" id="anwendungen" aria-labelledby="anwendungen-titel">
      <div className="breite">
        <div className="abschnittskopf">
          <p className="marke-klein" id="anwendungen-titel">
            Die Anwendungen
          </p>
          <p className="abschnittskopf-satz">
            Studio übernimmt die Planung. <span>Web und Mobile stellen die Informationen im Schulalltag bereit.</span>
          </p>
        </div>

        <article className="anwendung">
          <div className="anwendung-text">
            <p className="anwendung-rolle">{STUDIO.rolle}</p>
            <h3>{STUDIO.name}</h3>
            <p>{STUDIO.kurz}. Stammdaten, Unterricht, automatische und manuelle Planung, Vertretungen und Pausenaufsichten in einer Oberfläche, mit mehreren Planenden gleichzeitig.</p>
            <Kernpunkte m={STUDIO} />
            <Pfeillink zu={STUDIO.pfad}>Mehr zu Studio</Pfeillink>
          </div>
          <div className="anwendung-bild">
            <Browserfenster bild={bild(STUDIO, "vertretung")} adresse="studio.meine-schule.de" />
          </div>
        </article>

        <article className="anwendung anwendung-gespiegelt">
          <div className="anwendung-text">
            <p className="anwendung-rolle">{WEB.rolle}</p>
            <h3>{WEB.name}</h3>
            <p>Pläne, Vertretungen und Klassenbuch für Lehrkräfte, Schulleitung, Klassen und Eltern – auf PC, Tablet und Telefon. Studio überträgt die Daten, Meldungen aus dem Portal gehen zurück.</p>
            <Kernpunkte m={WEB} />
            <Pfeillink zu={WEB.pfad}>Mehr zu Web</Pfeillink>
          </div>
          <div className="anwendung-bild">
            <Browserfenster bild={bild(WEB, "stundenplan")} adresse="plan.meine-schule.de" />
          </div>
        </article>

        <article className="anwendung">
          <div className="anwendung-text">
            <p className="anwendung-rolle">{MOBILE.rolle}</p>
            <h3>{MOBILE.name}</h3>
            <p>{MOBILE.kurz}. Holt alle Daten von EduOrga Web; angemeldet wird mit dem vorhandenen Konto.</p>
            <Kernpunkte m={MOBILE} />
            <Pfeillink zu={MOBILE.pfad}>Mehr zu Mobile</Pfeillink>
          </div>
          <div className="anwendung-bild">
            <div className="anwendung-telefone">
              <Telefon bild={bild(MOBILE, "heute")} />
              <Telefon bild={bild(MOBILE, "plan-woche")} />
              <Telefon bild={bild(MOBILE, "stundendetails")} klasse="telefon-dritt" />
            </div>
          </div>
        </article>

        <article className="anwendung anwendung-ios">
          <div className="anwendung-text">
            <p className="anwendung-rolle">{IOS.rolle}</p>
            <h3>App für iPhone und iPad</h3>
            <p>{IOS.kurz}. Heute, Plan, Postfach und Suche – mit der Gestaltung des Systems und deckenden, gut lesbaren Inhalten.</p>
            <Pfeillink zu={IOS.pfad}>Mehr zur App</Pfeillink>
          </div>
          <div className="anwendung-ios-fakten">
            <Kernpunkte m={IOS} />
            <dl className="fakten">
              {IOS.technik.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </article>
      </div>
    </section>
  );
}

function InstallationKurz() {
  return (
    <section className="abschnitt abschnitt-linie" id="installation" aria-labelledby="installation-titel">
      <div className="breite zweispaltig">
        <div>
          <p className="marke-klein">Installation</p>
          <h2 className="abschnitt-titel" id="installation-titel">
            Ein Skript richtet alles auf dem eigenen Server ein.
          </h2>
          <p className="abschnitt-text">
            Jedes Programm läuft als eigener Docker-Container mit eigener Datenbank. Das Skript fragt ab, was installiert
            wird, erzeugt Passwörter, richtet auf Wunsch HTTPS ein und startet die Container.
          </p>
          <p className="abschnitt-text klein">Voraussetzung: Linux-Server mit Docker Engine und dem Compose-Plugin.</p>
        </div>
        <div className="installation-befehle">
          <Befehle titel="Als root auf dem Server" text={INSTALLATION.installieren} />
          <Befehle titel="Später aktualisieren" text={"cd /opt/untplannext\n./update.sh"} />
          <div className="linkzeile">
            <Pfeillink zu="/installation">Update, Passwort, Ports</Pfeillink>
            <Pfeillink zu={DATEI("installation/README.md")}>Anleitung im Repository</Pfeillink>
          </div>
        </div>
      </div>
    </section>
  );
}

function HandbuchKurz() {
  const kapitel = STAND.handbuch.slice(0, 8);
  return (
    <section className="abschnitt abschnitt-linie" aria-labelledby="handbuch-titel">
      <div className="breite zweispaltig">
        <div>
          <p className="marke-klein">Handbuch</p>
          <h2 className="abschnitt-titel" id="handbuch-titel">
            Dokumentation, die mit dem Code entsteht.
          </h2>
          <p className="abschnitt-text">
            Das Benutzerhandbuch beschreibt EduOrga Studio Schritt für Schritt. Zu Web, Mobile, der App und der Installation
            gibt es eigene Beschreibungen im Repository.
          </p>
          <div className="linkzeile">
            <Pfeillink zu="/handbuch">Alle Kapitel</Pfeillink>
            <Pfeillink zu={RELEASES}>Versionshinweise</Pfeillink>
          </div>
        </div>
        <div>
          <ol className="kapitelliste">
            {kapitel.map((k) => (
              <li key={k.nummer}>
                <a href={`${DATEI("docs/HANDBUCH.md")}#${k.anker}`} rel="noopener noreferrer">
                  <span className="kapitel-nummer">{String(k.nummer).padStart(2, "0")}</span>
                  {k.titel}
                </a>
              </li>
            ))}
          </ol>
          <p className="rueckmeldung">
            Fehler gefunden oder eine Idee? <a href={ISSUES} rel="noopener noreferrer">Issue anlegen</a> oder in den{" "}
            <a href={DISCUSSIONS} rel="noopener noreferrer">Discussions</a> fragen. <Link to="/handbuch#rueckmeldung">Mehr dazu</Link>
          </p>
        </div>
      </div>
    </section>
  );
}
