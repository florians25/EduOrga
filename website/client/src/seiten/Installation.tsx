import { OpenRegular } from "@fluentui/react-icons";
import { MessageBar, MessageBarBody, MessageBarTitle } from "@fluentui/react-components";
import { Befehle } from "../bausteine/Bausteine";
import { Seitenkopf } from "../bausteine/Rahmen";
import { CONTAINER, INSTALLATION, ISSUES, RELEASES, REPO } from "../inhalt";

const ABSCHNITTE = [
  ["voraussetzungen", "Voraussetzungen"],
  ["installation", "Installation"],
  ["container", "Container und Ports"],
  ["update", "Update"],
  ["passwort", "Passwort neu setzen"],
  ["einstellungen", "Einstellungen ändern"],
  ["links", "Versionen und Fehler"],
];

export function Installation() {
  return (
    <>
      <Seitenkopf
        ueber="Installation"
        titel="EduOrga auf dem eigenen Server installieren"
        einleitung="Alle Programme laufen als eigene Docker-Container. EduOrga Studio und EduOrga Web haben jeweils ihre eigene Datenbank in einem eigenen Volume – Studio kann ohne Web betrieben, gesichert und aktualisiert werden und umgekehrt."
      />
      <div className="breite modulseite">
        <nav className="unternav" aria-label="Abschnitte">
          <p className="unternav-titel">Auf dieser Seite</p>
          {ABSCHNITTE.map(([id, t]) => (
            <a key={id} href={`#${id}`}>
              {t}
            </a>
          ))}
        </nav>
        <div className="modulinhalt textseite">
          <section id="voraussetzungen">
            <h2>Voraussetzungen</h2>
            <ul className="aufzaehlung">
              {INSTALLATION.voraussetzungen.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
          </section>

          <section id="installation">
            <h2>Installation</h2>
            <p>Auf dem Server als root (oder als Mitglied der Gruppe „docker“) ausführen:</p>
            <Befehle text={INSTALLATION.installieren} />
            <p>
              Das Skript lädt <code>docker-compose.yml</code>, <code>update.sh</code> und <code>passwort.sh</code>, fragt ab,
              welche Programme installiert werden, welche Datenbank EduOrga Web nutzt (SQLite oder MariaDB) und ob HTTPS
              eingerichtet werden soll. Es erzeugt zufällige Passwörter, schreibt <code>.env</code> (nur für root lesbar) und{" "}
              <code>Caddyfile</code> und startet die Container. Am Ende stehen Adressen und Zugangsdaten auf dem Bildschirm.
            </p>
            <MessageBar intent="info" layout="multiline" className="hinweisbalken">
              <MessageBarBody>
                <MessageBarTitle>Ohne HTTPS</MessageBarTitle>
                Die Programme sind dann unter <code>http://&lt;server&gt;:8190</code> (Studio), <code>:8180</code> (Web) und{" "}
                <code>:8181</code> (Mobile) erreichbar – gedacht für einen vorhandenen Reverse-Proxy. Für die Installation von
                EduOrga Mobile als App ist HTTPS nötig.
              </MessageBarBody>
            </MessageBar>
          </section>

          <section id="container">
            <h2>Container und Ports</h2>
            <p>
              Welche Container laufen, steht in <code>.env</code> unter <code>COMPOSE_PROFILES</code>. Eigene Ports fragt das
              Skript auf Wunsch ab (<code>STUDIO_PORT</code>, <code>WEB_PORT</code>, <code>MOBILE_PORT</code>,{" "}
              <code>WEBSITE_PORT</code>, <code>HTTP_PORT</code>, <code>HTTPS_PORT</code>).
            </p>
            <div className="tabellenrahmen">
              <table className="tabelle">
                <thead>
                  <tr>
                    <th>Container</th>
                    <th>Aufgabe</th>
                    <th>Port</th>
                  </tr>
                </thead>
                <tbody>
                  {CONTAINER.map(([name, aufgabe, port]) => (
                    <tr key={name}>
                      <td>
                        <code>{name}</code>
                      </td>
                      <td>{aufgabe}</td>
                      <td className="zahl">{port}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="update">
            <h2>Update</h2>
            <Befehle text={INSTALLATION.aktualisieren} />
            <p>
              Vor jedem Update werden die Datenbanken gesichert; schlägt eine Sicherung fehl, bricht das Update ab.
              Datenbank-Migrationen laufen beim Start der Programme automatisch. Es bleiben jeweils die neuesten 14
              Sicherungen (<code>SICHERUNGEN_BEHALTEN</code> in <code>.env</code>).
            </p>
            <p>Automatisch, zum Beispiel jede Nacht per cron:</p>
            <Befehle titel="crontab" text={INSTALLATION.automatisch} />
            <p>
              Eine bestimmte Version: <code>UNTPLAN_VERSION=1.4.0</code> in <code>.env</code> statt <code>latest</code>, dann{" "}
              <code>./update.sh</code>. Studio und Web prüfen alle sechs Stunden die GitHub-Releases und zeigen Administratoren
              einen Hinweis auf neue Versionen.
            </p>
          </section>

          <section id="passwort">
            <h2>Passwort vergessen oder neu setzen</h2>
            <Befehle text={INSTALLATION.passwort} />
            <p>
              Das Skript fragt das Passwort verdeckt zweimal ab und gibt es an das jeweilige Programm weiter (
              <code>--passwort-setzen &lt;benutzer&gt;</code>). Die Passwörter in <code>.env</code> gelten nur beim allerersten
              Start.
            </p>
          </section>

          <section id="einstellungen">
            <h2>Einstellungen ändern</h2>
            <p>
              <code>.env</code> bearbeiten (zum Beispiel ein Programm in <code>COMPOSE_PROFILES</code> ergänzen oder
              entfernen), dann:
            </p>
            <Befehle text={INSTALLATION.einstellungen} />
            <p>Komplett neu fragen lassen – vorhandene Daten bleiben erhalten:</p>
            <Befehle text={INSTALLATION.neu} />
          </section>

          <section id="links">
            <h2>Versionen und Fehler</h2>
            <ul className="linkliste">
              <li>
                <a href={RELEASES} rel="noopener noreferrer">
                  Versionen und Versionshinweise (GitHub Releases) <OpenRegular aria-hidden />
                </a>
              </li>
              <li>
                <a href={ISSUES} rel="noopener noreferrer">
                  Bekannte Fehler und Aufgaben (GitHub Issues) <OpenRegular aria-hidden />
                </a>
              </li>
              <li>
                <a href={`${REPO}/blob/master/installation/README.md`} rel="noopener noreferrer">
                  Vollständige Installationsanleitung im Repository <OpenRegular aria-hidden />
                </a>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
