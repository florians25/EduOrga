import { Befehle, Pfeillink } from "../bausteine/Bausteine";
import { Seitenkopf } from "../bausteine/Rahmen";
import { CONTAINER, DATEI, FEHLERBEHEBUNG, FRAGEN, INSTALLATION, ISSUE_FEHLER, RELEASES } from "../inhalt";

const ABSCHNITTE = [
  ["ueberblick", "Was installiert wird"],
  ["voraussetzungen", "Voraussetzungen"],
  ["installieren", "Installieren"],
  ["https", "Domain und HTTPS"],
  ["erster-login", "Erster Login"],
  ["verbinden", "Studio mit Web verbinden"],
  ["datenbank", "SQLite oder MariaDB"],
  ["update", "Update"],
  ["sicherung", "Sicherung und Wiederherstellung"],
  ["einstellungen", "Einstellungen ändern"],
  ["fehlerbehebung", "Fehlerbehebung"],
  ["deinstallieren", "Deinstallieren"],
];

function Schritt({ id, nummer, titel, children }: { id: string; nummer: number; titel: string; children: React.ReactNode }) {
  return (
    <section id={id} className="anleitung-schritt" aria-labelledby={`${id}-titel`}>
      <h2 id={`${id}-titel`}>
        <span className="anleitung-nummer">{nummer}</span>
        {titel}
      </h2>
      {children}
    </section>
  );
}

export function Installation() {
  return (
    <>
      <Seitenkopf
        ueber="Installation"
        titel="EduOrga auf dem eigenen Server installieren"
        einleitung="Schritt für Schritt vom leeren Linux-Server bis zum ersten veröffentlichten Plan. Alle Programme laufen als eigene Docker-Container; EduOrga Studio und EduOrga Web haben jeweils eine eigene Datenbank und lassen sich getrennt betreiben, sichern und aktualisieren."
      >
        <p className="seitenkopf-fuer">
          Grundlage: <a href={DATEI("installation/README.md")} rel="noopener noreferrer">installation/README.md</a> und die Skripte{" "}
          <code>install.sh</code>, <code>update.sh</code>, <code>passwort.sh</code>.
        </p>
      </Seitenkopf>
      <div className="breite dokuseite">
        <nav className="unternav" aria-label="Abschnitte der Anleitung">
          <p className="unternav-titel">Auf dieser Seite</p>
          <ol>
            {ABSCHNITTE.map(([id, t]) => (
              <li key={id}>
                <a href={`#${id}`}>{t}</a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="dokuinhalt textseite">
          <Schritt id="ueberblick" nummer={1} titel="Was installiert wird">
            <p>
              Das Skript <code>install.sh</code> legt im Ordner <code>/opt/untplannext</code> die Dateien <code>docker-compose.yml</code>,{" "}
              <code>update.sh</code>, <code>passwort.sh</code>, <code>.env</code> (Einstellungen und Passwörter, nur für root lesbar) und{" "}
              <code>Caddyfile</code> an. Welche Container laufen, steht in <code>.env</code> unter <code>COMPOSE_PROFILES</code>.
            </p>
            <div className="tabellenrahmen">
              <table className="tabelle tabelle-breit">
                <thead>
                  <tr>
                    <th scope="col">Container</th>
                    <th scope="col">Aufgabe</th>
                    <th scope="col">Port</th>
                    <th scope="col">Daten</th>
                  </tr>
                </thead>
                <tbody>
                  {CONTAINER.map(([name, aufgabe, port, daten]) => (
                    <tr key={name}>
                      <td>
                        <code>{name}</code>
                      </td>
                      <td>{aufgabe}</td>
                      <td className="zahl">{port}</td>
                      <td>{daten}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="hinweiskasten">
              <strong>Vor dem Start mit echten Daten</strong>
              <p>
                Den <a href={DATEI("docs/datenschutz/README.md")} rel="noopener noreferrer">Leitfaden Datenschutz</a> durchgehen
                (AV-Vertrag, Verzeichnis, TOM, Fristen, Datenschutzhinweise) und die Sicherungen verschlüsseln.
              </p>
            </div>
          </Schritt>

          <Schritt id="voraussetzungen" nummer={2} titel="Voraussetzungen">
            <ul className="aufzaehlung">
              <li>Linux-Server mit Docker Engine und dem Compose-Plugin; Zugang als root oder als Mitglied der Gruppe „docker“.</li>
              <li>
                <code>curl</code> zum Laden der Skripte und Zugang zum Internet (GitHub und ghcr.io für die Images).
              </li>
              <li>
                Freie Ports: Studio <code>8190</code>, Web <code>8180</code>, Mobile <code>8181</code>; mit HTTPS über Caddy zusätzlich{" "}
                <code>80</code> und <code>443</code> aus dem Internet erreichbar.
              </li>
              <li>
                Für HTTPS je Programm eine Domain, die auf den Server zeigt, z. B. <code>studio.meine-schule.de</code>,{" "}
                <code>plan.meine-schule.de</code>, <code>app.meine-schule.de</code>. Ohne HTTPS lässt sich EduOrga Mobile nicht als App installieren.
              </li>
            </ul>
            <p>Docker prüfen – alle drei Befehle müssen ohne Fehler antworten:</p>
            <Befehle text={INSTALLATION.pruefen} />
          </Schritt>

          <Schritt id="installieren" nummer={3} titel="Installieren">
            <p>Auf dem Server als root ausführen:</p>
            <Befehle titel="Als root auf dem Server" text={INSTALLATION.laden} />
            <p>
              Das Skript lädt die aktuellen Dateien, stellt die folgenden Fragen (Eingabetaste übernimmt den Vorschlag in Klammern), schreibt{" "}
              <code>.env</code> und <code>Caddyfile</code>, lädt die Images und startet die Container. Sobald die Programme bereit sind, setzt es
              die gewählten Administrator-Passwörter. Am Ende stehen Adressen und Zugangsdaten auf dem Bildschirm.
            </p>
            <div className="tabellenrahmen">
              <table className="tabelle">
                <thead>
                  <tr>
                    <th scope="col">Frage</th>
                    <th scope="col">Antwort bzw. Vorschlag</th>
                  </tr>
                </thead>
                <tbody>
                  {FRAGEN.map(([f, a]) => (
                    <tr key={f}>
                      <td>{f}</td>
                      <td>{a}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Ein erneuter Aufruf von <code>sh install.sh</code> startet mit den vorhandenen Einstellungen. <code>./install.sh --neu</code> fragt
              alles neu ab – vorhandene Daten bleiben erhalten.
            </p>
          </Schritt>

          <Schritt id="https" nummer={4} titel="Domain und HTTPS">
            <h3>Variante A: HTTPS mit Caddy (empfohlen)</h3>
            <p>
              Auf die Frage nach HTTPS mit <code>j</code> antworten und die Domains eintragen. <code>install.sh</code> startet den Container{" "}
              <code>untplannext-caddy</code>, der die Zertifikate selbst holt und erneuert, und bindet die Programme nur an{" "}
              <code>127.0.0.1</code>. Die erzeugte <code>Caddyfile</code> sieht so aus:
            </p>
            <Befehle titel="Caddyfile" text={INSTALLATION.caddy} />
            <h3>Variante B: vorhandener Reverse-Proxy</h3>
            <p>
              Läuft auf dem Server schon ein Webserver mit Zertifikaten, HTTPS bei der Einrichtung ablehnen. Die Programme sind dann unter{" "}
              <code>http://&lt;server&gt;:8190</code>, <code>:8180</code> und <code>:8181</code> erreichbar. Damit sie nur über den Proxy
              erreichbar sind, in <code>.env</code> <code>BIND_ADRESSE=127.0.0.1</code> setzen und <code>docker compose up -d</code> aufrufen.
              Hinter HTTPS außerdem <code>UNTPLANWEB_SICHERE_COOKIES=1</code> und <code>STUDIO_SICHERE_COOKIES=1</code> setzen.
            </p>
            <Befehle titel="nginx, Beispiel" text={INSTALLATION.nginx} />
          </Schritt>

          <Schritt id="erster-login" nummer={5} titel="Erster Login">
            <ol className="aufzaehlung aufzaehlung-nummern">
              <li>
                EduOrga Studio öffnen und mit dem Administrator anmelden – Benutzername wie bei der Einrichtung gewählt (Vorschlag{" "}
                <code>admin</code>), Passwort wie angezeigt.
              </li>
              <li>
                EduOrga Web öffnen und mit dem Konto <code>admin</code> anmelden.
              </li>
              <li>
                Die Zugangsdaten stehen auch in <code>/opt/untplannext/.env</code> (<code>STUDIO_ADMIN_PASSWORT</code>,{" "}
                <code>UNTPLANWEB_ADMIN_PASSWORT</code>). Sie gelten nur beim allerersten Start – nach der ersten Anmeldung das Passwort ändern.
              </li>
            </ol>
            <p>Passwort vergessen oder Konto gesperrt? Auf dem Server neu setzen – die Container laufen weiter, die Änderung gilt sofort:</p>
            <Befehle text={INSTALLATION.passwort} />
            <p>
              Das Skript fragt das Passwort verdeckt zweimal ab (mindestens 8 Zeichen). Bei EduOrga Web hebt es zusätzlich die Sperre nach
              Fehlversuchen auf.
            </p>
          </Schritt>

          <Schritt id="verbinden" nummer={6} titel="Studio mit Web verbinden">
            <ol className="aufzaehlung aufzaehlung-nummern">
              <li>
                In EduOrga Web unter <em>Verwaltung → System &amp; Datenabgleich</em> Schul-ID und API-Schlüssel ablesen.
              </li>
              <li>
                In EduOrga Studio unter <em>EduOrga Web → Einstellungen</em> eintragen: Server <code>untplannext-web</code>, Port{" "}
                <code>8080</code>, ohne HTTPS (internes Netz der Container). Laufen Studio und Web auf verschiedenen Servern, die öffentliche
                Adresse von EduOrga Web mit HTTPS eintragen.
              </li>
              <li>
                <em>Verbindung prüfen</em>, dann <em>Exportieren</em>. Danach in EduOrga Web unter <em>Administration → Benutzer</em> „Konten
                aus Stammdaten“ anlegen.
              </li>
            </ol>
          </Schritt>

          <Schritt id="datenbank" nummer={7} titel="SQLite oder MariaDB">
            <div className="tabellenrahmen">
              <table className="tabelle">
                <thead>
                  <tr>
                    <th scope="col"></th>
                    <th scope="col">SQLite (Vorschlag)</th>
                    <th scope="col">MariaDB</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Geeignet für</th>
                    <td>die meisten Schulen</td>
                    <td>große Schulen, vorhandene Sicherungskonzepte</td>
                  </tr>
                  <tr>
                    <th scope="row">Ablage</th>
                    <td>Datei im Volume des Programms</td>
                    <td>
                      Container <code>untplannext-mariadb</code> mit den Datenbanken <code>untplanweb</code> und <code>eduorga_studio</code>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Sicherung vor dem Update</th>
                    <td>
                      <code>--sichern</code> des Programms nach <code>/data/sicherungen</code>
                    </td>
                    <td>
                      <code>mariadb-dump</code> nach <code>./sicherungen</code>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Einstellung in .env</th>
                    <td>
                      <code>UNTPLANWEB_DB=sqlite</code>, <code>STUDIO_DB=sqlite</code>
                    </td>
                    <td>
                      <code>UNTPLANWEB_DB=mysql</code>, <code>STUDIO_DB=mysql</code> mit Verbindungszeichenfolge
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              Die Wahl gilt je Programm. Umstellen einer bestehenden Installation: <code>./install.sh --neu</code> und <code>mariadb</code> wählen.
              Beim ersten Start mit der leeren MariaDB-Datenbank übernimmt Studio die vorhandene <code>studio.db</code> vollständig.
            </p>
          </Schritt>

          <Schritt id="update" nummer={8} titel="Update">
            <Befehle text={INSTALLATION.aktualisieren} />
            <p>
              Vor jedem Update werden die Datenbanken gesichert; schlägt eine Sicherung fehl, bricht das Update ab. Datenbank-Migrationen laufen
              beim Start der Programme automatisch. <code>update.sh</code> lädt außerdem die aktuelle <code>docker-compose.yml</code>; die eigene{" "}
              <code>.env</code> bleibt unverändert.
            </p>
            <h3>Automatisch</h3>
            <p>Zum Beispiel jede Nacht per cron:</p>
            <Befehle titel="crontab -e" text={INSTALLATION.automatisch} />
            <p>
              <strong>Aus der Oberfläche:</strong> Mit Watchtower (bei der Einrichtung wählbar) startet <em>Administration → Übersicht → Update
              installieren</em> in EduOrga Web das Update von Web und Mobile. Ohne Watchtower leistet das ein cron-Eintrag:
            </p>
            <Befehle titel="crontab -e" text={INSTALLATION.angefordert} />
            <p>
              <strong>Bestimmte Version:</strong> <code>UNTPLAN_VERSION=1.4.0</code> in <code>.env</code> statt <code>latest</code>, dann{" "}
              <code>./update.sh</code>. Studio und Web prüfen alle sechs Stunden die <a href={RELEASES} rel="noopener noreferrer">GitHub-Releases</a>{" "}
              und zeigen Administratoren einen Hinweis; abschalten mit <code>STUDIO_UPDATE_PRUEFEN=0</code> bzw. <code>UNTPLANWEB_UPDATE_PRUEFEN=0</code>.
            </p>
          </Schritt>

          <Schritt id="sicherung" nummer={9} titel="Sicherung und Wiederherstellung">
            <p>
              <code>./update.sh --nur-sichern</code> sichert ohne zu aktualisieren. Es bleiben jeweils die neuesten 14 Sicherungen (
              <code>SICHERUNGEN_BEHALTEN</code> in <code>.env</code>).
            </p>
            <Befehle titel="Sicherungen ansehen" text={INSTALLATION.sicherungenAnsehen} />
            <h3>Verschlüsseln</h3>
            <p>
              Empfohlen, sobald <code>./sicherungen</code> den Server verlässt. Mit <code>SICHERUNG_AGE_EMPFAENGER</code> (Programm age) bzw.{" "}
              <code>SICHERUNG_GPG_EMPFAENGER</code> (gpg) schreibt <code>update.sh</code> MariaDB-Abzüge nur verschlüsselt und legt von den
              SQLite-Sicherungen eine verschlüsselte Kopie in <code>./sicherungen</code> ab. Das Schlüsselpaar gehört nicht auf den Server.
            </p>
            <Befehle text={INSTALLATION.verschluesseln} />
            <h3>Wiederherstellen</h3>
            <Befehle titel="EduOrga Studio mit SQLite" text={INSTALLATION.wiederherstellenStudio} />
            <Befehle titel="Mit MariaDB" text={INSTALLATION.wiederherstellenMariadb} />
            <p>
              EduOrga Web mit SQLite: siehe <a href={DATEI("web/README.md")} rel="noopener noreferrer">web/README.md</a>, Abschnitt Sicherung.
            </p>
          </Schritt>

          <Schritt id="einstellungen" nummer={10} titel="Einstellungen ändern">
            <Befehle text={INSTALLATION.einstellungen} />
            <div className="tabellenrahmen">
              <table className="tabelle">
                <thead>
                  <tr>
                    <th scope="col">Variable in .env</th>
                    <th scope="col">Bedeutung</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td><code>COMPOSE_PROFILES</code></td><td>laufende Programme, z. B. <code>studio,web,mobile,https</code></td></tr>
                  <tr><td><code>STUDIO_PORT</code>, <code>WEB_PORT</code>, <code>MOBILE_PORT</code>, <code>HTTP_PORT</code>, <code>HTTPS_PORT</code></td><td>Ports der Programme bzw. von Caddy</td></tr>
                  <tr><td><code>BIND_ADRESSE</code></td><td><code>127.0.0.1</code> (nur lokal, hinter Proxy) oder <code>0.0.0.0</code></td></tr>
                  <tr><td><code>UNTPLAN_VERSION</code></td><td><code>latest</code> oder eine bestimmte Version</td></tr>
                  <tr><td><code>ZEITZONE</code></td><td>Standard <code>Europe/Berlin</code></td></tr>
                  <tr><td><code>SICHERUNGEN_BEHALTEN</code></td><td>Anzahl der Sicherungen je Programm (Standard 14)</td></tr>
                  <tr><td><code>UNTPLANWEB_SITZUNG_TAGE</code></td><td>Gültigkeit der Anmeldung in Tagen (Standard 14)</td></tr>
                  <tr><td><code>UNTPLANMOBILE_PUSH_DETAILS</code></td><td><code>1</code> = Einzelheiten in Benachrichtigungen (Standard aus)</td></tr>
                </tbody>
              </table>
            </div>
          </Schritt>

          <Schritt id="fehlerbehebung" nummer={11} titel="Fehlerbehebung">
            <p>Zuerst den Zustand der Container und das Protokoll ansehen:</p>
            <Befehle text={INSTALLATION.status} />
            <dl className="probleme">
              {FEHLERBEHEBUNG.map((f) => (
                <div key={f.problem}>
                  <dt>{f.problem}</dt>
                  <dd>
                    <p>{f.loesung}</p>
                    {f.befehl && <Befehle text={f.befehl} />}
                  </dd>
                </div>
              ))}
            </dl>
            <p>
              Nicht dabei? <a href={ISSUE_FEHLER} rel="noopener noreferrer">Fehler auf GitHub melden</a> – mit Distribution, Docker-Version und
              den letzten Zeilen des Protokolls, ohne Passwörter und ohne den Inhalt der <code>.env</code>.
            </p>
          </Schritt>

          <Schritt id="deinstallieren" nummer={12} titel="Deinstallieren">
            <Befehle text={INSTALLATION.deinstallieren} />
            <div className="linkzeile">
              <Pfeillink zu={DATEI("docs/INSTALLATION.md")}>Diese Anleitung im Repository</Pfeillink>
              <Pfeillink zu={DATEI("docs/BETRIEB.md")}>Betrieb im Repository</Pfeillink>
              <Pfeillink zu={DATEI("installation/README.md")}>installation/README.md</Pfeillink>
            </div>
          </Schritt>
        </div>
      </div>
    </>
  );
}
