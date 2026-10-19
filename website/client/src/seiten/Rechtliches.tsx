import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Seitenkopf } from "../bausteine/Rahmen";
import { DISCUSSIONS, ISSUES, RECHTLICHER_HINWEIS, REPO } from "../inhalt";

interface Info {
  version: string;
  betreiber: { name: string; anschrift: string; email: string };
}

/** Betreiberangaben vom Server (Umgebungsvariablen WEBSITE_BETREIBER_*). */
function useInfo() {
  const [info, setInfo] = useState<Info | null>(null);
  useEffect(() => {
    let aktiv = true;
    fetch("/api/info", { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? (r.json() as Promise<Info>) : null))
      .then((i) => aktiv && setInfo(i))
      .catch(() => aktiv && setInfo(null));
    return () => {
      aktiv = false;
    };
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
    <div className="hinweiskasten hinweiskasten-warnung">
      <strong>Vorlage</strong>
      <p>
        Die markierten Angaben sind Platzhalter. Der Betreiber trägt sie über die Umgebungsvariablen WEBSITE_BETREIBER_NAME,
        WEBSITE_BETREIBER_ANSCHRIFT und WEBSITE_BETREIBER_EMAIL ein und prüft die Texte vor der Veröffentlichung. Die Texte
        sind keine Rechtsberatung.
      </p>
    </div>
  );
}

export function Hinweis() {
  return (
    <>
      <Seitenkopf ueber="Hinweis" titel="Hinweis zum Projekt" />
      <div className="breite textseite">
        <p className="rechtskasten">{RECHTLICHER_HINWEIS}</p>
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
        <h2>Rückmeldungen</h2>
        <p>
          Fehler und Wünsche werden auf GitHub gesammelt: <a href={ISSUES} rel="noopener noreferrer">Issues</a> für Fehler und
          konkrete Wünsche, <a href={DISCUSSIONS} rel="noopener noreferrer">Discussions</a> für Ideen und Fragen.
        </p>
        <h2>Quellcode und Lizenzen von Drittbestandteilen</h2>
        <p>
          Der Quellcode liegt öffentlich auf <a href={REPO} rel="noopener noreferrer">GitHub</a>. Diese Website verwendet:
        </p>
        <ul className="aufzaehlung">
          <li>
            IBM Plex Sans – SIL Open Font License 1.1 (<a href="/fonts/OFL.txt">Lizenztext</a>), vom eigenen Server ausgeliefert
          </li>
          <li>React, React Router – MIT-Lizenz</li>
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
      <div className="breite textseite">
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
  return (
    <>
      <Seitenkopf ueber="Rechtliches" titel="Datenschutzerklärung" />
      <div className="breite textseite">
        <PlatzhalterHinweis info={info} />
        <h2>1. Verantwortlicher</h2>
        <p>
          <Angabe wert={b?.name} platzhalter="Vor- und Nachname" />, <Angabe wert={b?.anschrift} platzhalter="Anschrift" />, E-Mail:{" "}
          <Angabe wert={b?.email} platzhalter="E-Mail-Adresse" />.
        </p>

        <h2>2. Grundsätze</h2>
        <p>
          Diese Website ist eine reine Informationsseite. Sie lädt keine Inhalte von fremden Servern: Schriften, Bilder und
          Skripte werden vom eigenen Server ausgeliefert. Es gibt keine Formulare, keine Anmeldung, keine Analyse- oder
          Trackingdienste, keine Werbung und keine eingebetteten Inhalte Dritter. Die Website setzt keine Cookies und speichert
          nichts auf Ihrem Gerät.
        </p>

        <h2>3. Aufruf der Website</h2>
        <p>
          Beim Aufruf überträgt Ihr Browser technisch notwendige Daten (u. a. IP-Adresse, Zeitpunkt, aufgerufene Adresse,
          Browserkennung). Sie werden verarbeitet, um die Seiten auszuliefern und die Sicherheit des Betriebs zu gewährleisten
          (Art. 6 Abs. 1 lit. f DSGVO). Die Anwendung selbst speichert keine Zugriffsprotokolle mit IP-Adressen.{" "}
          <span className="platzhalter">
            [Falls ein vorgeschalteter Webserver oder Hoster Zugriffsprotokolle führt: Speicherdauer und Zweck hier ergänzen.]
          </span>
        </p>

        <h2>4. Rückmeldungen über GitHub</h2>
        <p>
          Fehlermeldungen, Wünsche und Fragen nimmt das Projekt ausschließlich über GitHub entgegen (Issues und Discussions).
          Diese Website überträgt dabei nichts; was Sie dort eintragen, verarbeitet die GitHub Inc. nach ihrer eigenen
          Datenschutzerklärung. Beiträge dort sind öffentlich – bitte keine personenbezogenen Daten von Schülerinnen, Schülern
          oder Lehrkräften angeben.
        </p>

        <h2>5. Ihre Rechte</h2>
        <p>
          Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der
          Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21). Wenden Sie sich dazu an die oben
          genannte Adresse. Außerdem können Sie sich bei einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77 DSGVO).
        </p>

        <h2>6. Links zu GitHub</h2>
        <p>
          Links zu GitHub öffnen die Seiten der GitHub Inc. Erst beim Anklicken werden Daten an GitHub übertragen; es gilt die
          Datenschutzerklärung von GitHub.
        </p>
      </div>
    </>
  );
}
