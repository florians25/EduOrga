import { Abschnittskopf, Knopf, Pfeillink } from "../bausteine/Bausteine";
import { Seitenkopf } from "../bausteine/Rahmen";
import { DATEI, DISCUSSIONS, ISSUE_FEHLER, ISSUE_NEU, ISSUE_WUNSCH, ISSUES } from "../inhalt";

export function Rueckmeldung() {
  return (
    <>
      <Seitenkopf
        ueber="Rückmeldung"
        titel="Ideen, Wünsche und Fehler direkt auf GitHub melden"
        einleitung="EduOrga hat kein eigenes Ticketsystem. Rückmeldungen laufen öffentlich über GitHub – so sieht jede Schule, was schon bekannt ist, was geplant ist und was gelöst wurde. Für eine Meldung genügt ein kostenloses GitHub-Konto."
      >
        <div className="aktionen">
          <Knopf zu={ISSUE_FEHLER}>Fehler melden</Knopf>
          <Knopf zu={ISSUE_WUNSCH} art="zweit">
            Idee oder Wunsch
          </Knopf>
        </div>
      </Seitenkopf>
      <section className="abschnitt" aria-labelledby="wege-titel">
        <div className="breite zweispaltig">
          <Abschnittskopf id="wege-titel" ueber="Wege" titel="Welches Formular passt?" />
          <dl className="funktionen">
            <div>
              <dt>
                <a href={ISSUE_FEHLER} rel="noopener noreferrer">Fehler melden</a>
              </dt>
              <dd>
                Etwas funktioniert nicht wie erwartet. Das Formular fragt nach der Anwendung (Studio, Web, Mobile, iOS, Installation),
                der Version, den Schritten zum Nachstellen, dem erwarteten und dem tatsächlichen Verhalten; Bildschirmfotos lassen sich
                hineinziehen.
              </dd>
            </div>
            <div>
              <dt>
                <a href={ISSUE_WUNSCH} rel="noopener noreferrer">Idee oder Wunsch</a>
              </dt>
              <dd>Eine neue Funktion oder Verbesserung. Am hilfreichsten: die Situation im Schulalltag und was heute umständlich ist.</dd>
            </div>
            <div>
              <dt>
                <a href={DISCUSSIONS} rel="noopener noreferrer">Fragen und Austausch</a>
              </dt>
              <dd>Fragen zum Einsatz, Erfahrungen anderer Schulen, offene Überlegungen – ohne dass gleich eine Aufgabe daraus wird.</dd>
            </div>
            <div>
              <dt>
                <a href={ISSUES} rel="noopener noreferrer">Bekannte Fehler und Wünsche</a>
              </dt>
              <dd>Vor einer neuen Meldung kurz suchen – vielleicht ist das Thema schon bekannt. Ein Daumen nach oben zeigt, dass es weitere Schulen betrifft.</dd>
            </div>
          </dl>
        </div>
      </section>
      <section className="abschnitt abschnitt-linie" aria-labelledby="regeln-titel">
        <div className="breite zweispaltig">
          <Abschnittskopf id="regeln-titel" ueber="Bitte beachten" titel="Keine personenbezogenen Daten." />
          <div className="textblock">
            <ul className="aufzaehlung">
              <li>Keine Namen, Kürzel oder E-Mail-Adressen echter Schülerinnen, Schüler, Eltern oder Lehrkräfte – weder im Text noch auf Bildschirmfotos.</li>
              <li>Keine Passwörter, API-Schlüssel und nie den Inhalt der Datei .env.</li>
              <li>Protokolle vor dem Einfügen durchsehen und Namen unkenntlich machen.</li>
              <li>Sicherheitslücken nicht öffentlich beschreiben, sondern zunächst nur kurz melden, dass es eine gibt.</li>
            </ul>
            <div className="linkzeile">
              <Pfeillink zu={ISSUE_NEU}>Alle Vorlagen</Pfeillink>
              <Pfeillink zu={DATEI(".github/ISSUE_TEMPLATE/fehler.yml")}>Formulare im Repository</Pfeillink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
