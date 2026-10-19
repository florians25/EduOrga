import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageBar, MessageBarBody, MessageBarTitle } from "@fluentui/react-components";
import { Seitenkopf } from "../bausteine/Rahmen";
import { infoLaden, type Info } from "../api";
import { RECHTLICHER_HINWEIS, REPO } from "../inhalt";

function useInfo() {
  const [info, setInfo] = useState<Info | null>(null);
  useEffect(() => {
    infoLaden().then(setInfo).catch(() => setInfo(null));
  }, []);
  return info;
}

/** Wert aus der Konfiguration oder deutlich markierter Platzhalter. */
function Angabe({ wert, platzhalter }: { wert?: string; platzhalter: string }) {
  return wert ? <>{wert}</> : <span className="platzhalter">[{platzhalter}]</span>;
}

function PlatzhalterHinweis({ info }: { info: Info | null }) {
  if (info && info.betreiber.name && info.betreiber.anschrift && info.betreiber.email) return null;
  return (
    <MessageBar intent="warning" layout="multiline" className="hinweisbalken">
      <MessageBarBody>
        <MessageBarTitle>Vorlage</MessageBarTitle>
        Die markierten Angaben sind Platzhalter. Betreiber tragen sie über die Umgebungsvariablen WEBSITE_BETREIBER_NAME,
        WEBSITE_BETREIBER_ANSCHRIFT und WEBSITE_BETREIBER_EMAIL ein und prüfen die Texte vor der Veröffentlichung. Die Texte
        sind keine Rechtsberatung.
      </MessageBarBody>
    </MessageBar>
  );
}

export function Hinweis() {
  return (
    <>
      <Seitenkopf ueber="Hinweis" titel="Hinweis zum Projekt" />
      <div className="breite textseite schmal">
        <div className="rechtskasten">
          <p>{RECHTLICHER_HINWEIS}</p>
        </div>
        <h2>Eigenständiges Programm</h2>
        <p>
          EduOrga ist ein eigenständiges Programm und steht in keiner Verbindung zu Herstellern anderer Stundenplanprogramme.
          Import-Formate anderer Programme dienen ausschließlich der Datenübernahme beim Umstieg.
        </p>
        <h2>Keine Gewähr</h2>
        <p>
          Die Software wird ohne Gewähr bereitgestellt. Vor dem Einsatz mit echten Daten sollten Schulen bzw. Betreiber
          Funktion, Sicherheit, Datensicherung und die datenschutzrechtlichen Anforderungen (z. B. Verzeichnis von
          Verarbeitungstätigkeiten, Auftragsverarbeitung, technische und organisatorische Maßnahmen) eigenverantwortlich prüfen.
        </p>
        <h2>Quellcode und Lizenzen von Drittbestandteilen</h2>
        <p>
          Der Quellcode liegt öffentlich auf <a href={REPO} rel="noopener noreferrer">GitHub</a>. Verwendete Drittbestandteile:
        </p>
        <ul className="aufzaehlung">
          <li>IBM Plex Sans – SIL Open Font License 1.1 (<a href="/fonts/OFL.txt">Lizenztext</a>), lokal ausgeliefert</li>
          <li>Fluent UI React und Fluent UI System Icons – MIT-Lizenz</li>
          <li>React, React Router, dnd-kit – MIT-Lizenz</li>
        </ul>
        <p>
          Weitere Angaben: <Link to="/impressum">Impressum</Link> · <Link to="/datenschutz">Datenschutz</Link>
        </p>
      </div>
    </>
  );
}

export function Impressum() {
  const info = useInfo();
  const b = info?.betreiber;
  return (
    <>
      <Seitenkopf ueber="Rechtliches" titel="Impressum" />
      <div className="breite textseite schmal">
        <PlatzhalterHinweis info={info} />
        <h2>Angaben gemäß § 5 DDG</h2>
        <address className="anschrift">
          <Angabe wert={b?.name} platzhalter="Vor- und Nachname" />
          <br />
          {b?.anschrift ? (
            b.anschrift.split(/\s*[,;\n]\s*/).map((z, i) => (
              <span key={i}>
                {z}
                <br />
              </span>
            ))
          ) : (
            <>
              <span className="platzhalter">[Straße und Hausnummer]</span>
              <br />
              <span className="platzhalter">[Postleitzahl und Ort]</span>
              <br />
            </>
          )}
        </address>
        <h2>Kontakt</h2>
        <p>
          E-Mail: <Angabe wert={b?.email} platzhalter="E-Mail-Adresse" />
        </p>
        <h2>Verantwortlich für den Inhalt</h2>
        <p>
          <Angabe wert={b?.name} platzhalter="Vor- und Nachname" />, Anschrift wie oben.
        </p>
        <h2>Hinweis</h2>
        <p>{RECHTLICHER_HINWEIS}</p>
        <h2>Haftung für Links</h2>
        <p>
          Diese Website verweist auf GitHub. Für die Inhalte verlinkter Seiten sind ausschließlich deren Betreiber
          verantwortlich.
        </p>
      </div>
    </>
  );
}

export function Datenschutz() {
  const info = useInfo();
  const b = info?.betreiber;
  const tage = info?.emailAufbewahrungTage ?? 180;
  return (
    <>
      <Seitenkopf ueber="Rechtliches" titel="Datenschutzerklärung" />
      <div className="breite textseite schmal">
        <PlatzhalterHinweis info={info} />
        <h2>1. Verantwortlicher</h2>
        <p>
          <Angabe wert={b?.name} platzhalter="Vor- und Nachname" />, <Angabe wert={b?.anschrift} platzhalter="Anschrift" />, E-Mail:{" "}
          <Angabe wert={b?.email} platzhalter="E-Mail-Adresse" />.
        </p>

        <h2>2. Grundsätze</h2>
        <p>
          Diese Website lädt keine Inhalte von fremden Servern: Schriften, Bilder und Skripte werden vom eigenen Server
          ausgeliefert. Es gibt keine Analyse- oder Trackingdienste, keine Werbung und keine eingebetteten Inhalte Dritter.
          Beim Besuch der öffentlichen Seiten werden keine Cookies gesetzt.
        </p>

        <h2>3. Aufruf der Website</h2>
        <p>
          Beim Aufruf überträgt Ihr Browser technisch notwendige Daten (u. a. IP-Adresse, Zeitpunkt, aufgerufene Adresse,
          Browserkennung). Sie werden verarbeitet, um die Seiten auszuliefern und die Sicherheit des Betriebs zu gewährleisten
          (Art. 6 Abs. 1 lit. f DSGVO). Die Anwendung selbst speichert keine Zugriffsprotokolle mit IP-Adressen.{" "}
          <span className="platzhalter">[Falls ein vorgeschalteter Webserver oder Hoster Zugriffsprotokolle führt: Speicherdauer und Zweck hier ergänzen.]</span>
        </p>

        <h2>4. Ideen-, Wunsch- und Fehlerportal</h2>
        <p>
          Wenn Sie eine Einreichung senden, speichern wir die Art, den Bereich, Titel und Beschreibung sowie – falls angegeben –
          Ihre E-Mail-Adresse. Zweck ist die Bearbeitung und Weiterentwicklung von EduOrga; die E-Mail-Adresse wird
          ausschließlich für Rückfragen zu Ihrer Einreichung verwendet und nie veröffentlicht. Rechtsgrundlage ist Ihre
          Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die Sie jederzeit mit Wirkung für die Zukunft widerrufen können.
        </p>
        <p>
          Angenommene Einreichungen (Stand „Im Backlog“, „In Arbeit“ oder „Erledigt“) können mit Titel, Beschreibung und Stand
          öffentlich angezeigt werden – ohne E-Mail-Adresse. Bitte geben Sie in Titel und Beschreibung keine personenbezogenen
          Daten an.
        </p>
        <p>
          Zum Schutz vor automatisierten Einsendungen wird Ihre IP-Adresse kurzzeitig in gehashter Form im Arbeitsspeicher
          gezählt (höchstens eine Stunde, keine dauerhafte Speicherung; Art. 6 Abs. 1 lit. f DSGVO).
        </p>
        <p>
          Speicherdauer: Einreichungen bleiben gespeichert, solange sie für die Weiterentwicklung relevant sind. E-Mail-Adressen
          werden spätestens {tage} Tage nach Abschluss einer Einreichung („Erledigt“ oder „Abgelehnt“) automatisch gelöscht,
          auf Wunsch sofort.
        </p>

        <h2>5. Verwaltung</h2>
        <p>
          Für die Anmeldung der Administratoren setzt die Website ein technisch notwendiges Sitzungs-Cookie
          („edo_verwaltung“, nur für den Verwaltungsbereich, gültig bis zur Abmeldung bzw. höchstens acht Stunden).
        </p>

        <h2>6. Ihre Rechte</h2>
        <p>
          Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der
          Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20), Widerspruch (Art. 21) und Widerruf einer Einwilligung (Art. 7
          Abs. 3). Wenden Sie sich dazu an die oben genannte Adresse und nennen Sie nach Möglichkeit die Nummer Ihrer
          Einreichung. Außerdem können Sie sich bei einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77 DSGVO).
        </p>

        <h2>7. Links zu GitHub</h2>
        <p>
          Links zu GitHub öffnen die Seiten der GitHub Inc. Erst beim Anklicken werden Daten an GitHub übertragen; es gilt die
          Datenschutzerklärung von GitHub.
        </p>
      </div>
    </>
  );
}
