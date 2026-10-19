import { Pfeillink } from "../bausteine/Bausteine";
import { Seitenkopf } from "../bausteine/Rahmen";
import { DATEI, DISCUSSIONS, ISSUES, RELEASES } from "../inhalt";
import { STAND } from "../stand";

const DOKUMENTE: [string, string, string][] = [
  ["EduOrga Studio", "Aufbau, Start, Einstellungen und Betrieb des Planungswerkzeugs", "studio/README.md"],
  ["EduOrga Web", "Portal, Rollen und Rechte, Verbindung mit Studio, Sicherung", "web/README.md"],
  ["EduOrga Mobile", "App fürs Telefon, Installation als App, Benachrichtigungen", "mobile/README.md"],
  ["App für iPhone und iPad", "Bauen mit Xcode, Aufbau der App", "ios/README.md"],
  ["Installation und Betrieb", "install.sh, Update, Sicherungen, Passwörter, Ports", "installation/README.md"],
  ["Datenaustausch Studio und Web", "Schnittstelle für die Übertragung der Pläne", "docs/SYNC_API.md"],
];

export function Handbuch() {
  const handbuch = DATEI("docs/HANDBUCH.md");
  return (
    <>
      <Seitenkopf
        ueber="Handbuch und Dokumentation"
        titel="Alles Wichtige, nachlesbar im Repository."
        einleitung="Das Benutzerhandbuch führt durch EduOrga Studio – von den ersten Schritten bis zur Vertretungsplanung. Die Beschreibungen der übrigen Anwendungen und der Installation liegen jeweils neben dem Quellcode und werden mit ihm aktualisiert."
      />
      <section className="abschnitt">
        <div className="breite zweispaltig">
          <div>
            <p className="marke-klein">Benutzerhandbuch</p>
            <h2 className="abschnitt-titel">EduOrga Studio</h2>
            <p className="abschnitt-text">{STAND.handbuch.length} Kapitel, mit Bildschirmfotos und Tastenkürzeln.</p>
            <Pfeillink zu={handbuch}>Handbuch öffnen</Pfeillink>
          </div>
          <ol className="kapitelliste kapitelliste-zweispaltig">
            {STAND.handbuch.map((k) => (
              <li key={k.nummer}>
                <a href={`${handbuch}#${k.anker}`} rel="noopener noreferrer">
                  <span className="kapitel-nummer">{String(k.nummer).padStart(2, "0")}</span>
                  {k.titel}
                </a>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="abschnitt abschnitt-linie">
        <div className="breite zweispaltig">
          <div>
            <p className="marke-klein">Weitere Dokumentation</p>
          </div>
          <ul className="dokumente">
            {DOKUMENTE.map(([titel, text, pfad]) => (
              <li key={pfad}>
                <a href={DATEI(pfad)} rel="noopener noreferrer">
                  <strong>
                    {titel} <span aria-hidden>↗</span>
                  </strong>
                  <span>{text}</span>
                </a>
              </li>
            ))}
            <li>
              <a href={RELEASES} rel="noopener noreferrer">
                <strong>
                  Versionen und Versionshinweise <span aria-hidden>↗</span>
                </strong>
                <span>Veröffentlichte Versionen auf GitHub</span>
              </a>
            </li>
          </ul>
        </div>
      </section>
      <section className="abschnitt abschnitt-linie" id="rueckmeldung">
        <div className="breite zweispaltig">
          <div>
            <p className="marke-klein">Rückmeldung</p>
            <h2 className="abschnitt-titel">Fehler, Wünsche und Fragen laufen über GitHub.</h2>
          </div>
          <div>
            <p className="abschnitt-text">
              Fehler und konkrete Wünsche bitte als Issue anlegen – mit kurzer Beschreibung, was erwartet wurde und was
              stattdessen passiert ist. Ideen, Fragen zum Einsatz und Erfahrungen gehören in die Discussions. Bitte keine
              personenbezogenen Daten von Schülerinnen, Schülern oder Lehrkräften einstellen.
            </p>
            <div className="linkzeile">
              <Pfeillink zu={ISSUES}>Issues</Pfeillink>
              <Pfeillink zu={DISCUSSIONS}>Discussions</Pfeillink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
