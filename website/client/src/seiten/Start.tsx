import { useState } from "react";
import { Link } from "react-router-dom";
import { Tab, TabList } from "@fluentui/react-components";
import {
  ArrowRightRegular,
  BuildingRegular,
  CalendarLtrRegular,
  ChatBubblesQuestionRegular,
  LockClosedRegular,
  PhoneRegular,
  ServerRegular,
} from "@fluentui/react-icons";
import { Bildschirmfoto, KnopfLink } from "../bausteine/Bausteine";
import { MODUL_LISTE, REPO, SLOGAN } from "../inhalt";

const STAERKEN = [
  {
    symbol: <CalendarLtrRegular />,
    titel: "Planung und Alltag in einem System",
    text: "Stundenplan, Vertretungen, Pausenaufsichten, Klassenbuch und Mitteilungen greifen ineinander – ohne Export und Import zwischen Einzelprogrammen.",
  },
  {
    symbol: <BuildingRegular />,
    titel: "Für Schulen in Nordrhein-Westfalen",
    text: "NRW-Schulformen, Ferien und Feiertage, Mehrarbeitsregel und SchILD-NRW-Import sind eingebaut.",
  },
  {
    symbol: <ServerRegular />,
    titel: "Auf dem eigenen Server",
    text: "Jedes Programm läuft als eigener Docker-Container mit eigener Datenbank. Ein Skript richtet alles ein und aktualisiert mit vorheriger Sicherung.",
  },
  {
    symbol: <LockClosedRegular />,
    titel: "Datensparsam",
    text: "Keine Werbung, keine Analysedienste, keine Schriften oder Skripte von fremden Servern. Die Daten bleiben bei der Schule.",
  },
];

export function Start() {
  const [reiter, setReiter] = useState("studio");
  const modul = MODUL_LISTE.find((m) => m.kennung === reiter) ?? MODUL_LISTE[0];
  const titelbild = MODUL_LISTE[0].bilder[0];

  return (
    <>
      <section className="buehne">
        <div className="breite buehne-raster">
          <div className="buehne-text">
            <p className="buehne-ueber">Schulorganisation für Stunden- und Vertretungsplanung</p>
            <h1>
              EduOrga
              <span className="buehne-slogan">{SLOGAN}</span>
            </h1>
            <p className="buehne-wert">
              EduOrga verbindet die Planung im Sekretariat und in der Schulleitung mit dem Alltag von Lehrkräften,
              Schülerinnen, Schülern und Eltern: Studio für die Planung, Web als Portal, Mobile und die iPhone-App für
              unterwegs – auf dem eigenen Server betrieben.
            </p>
            <div className="knopfreihe">
              <KnopfLink zu="/installation" primaer gross>
                Installation
              </KnopfLink>
              <KnopfLink zu="/module" gross>
                Module ansehen
              </KnopfLink>
            </div>
            <p className="buehne-fakten">Open Source auf GitHub · Docker · SQLite oder MariaDB</p>
          </div>
          <div className="buehne-bild">
            <Bildschirmfoto bild={titelbild} laden="eager" />
          </div>
        </div>
      </section>

      <section className="abschnitt">
        <div className="breite">
          <h2 className="abschnitt-titel">Vier Oberflächen, eine gemeinsame Fachlogik</h2>
          <div className="modulraster">
            {MODUL_LISTE.map((m) => (
              <Link key={m.kennung} to={`/module#${m.kennung}`} className="modulkarte">
                <span className="modulkarte-symbol" aria-hidden>
                  {m.kennung === "studio" ? <CalendarLtrRegular /> : m.kennung === "web" ? <BuildingRegular /> : <PhoneRegular />}
                </span>
                <h3>{m.name}</h3>
                <p>{m.kurz}</p>
                <span className="modulkarte-fuer">Für {m.fuerWen}</span>
                <span className="modulkarte-mehr">
                  Mehr erfahren <ArrowRightRegular aria-hidden />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="abschnitt abschnitt-flaeche">
        <div className="breite">
          <h2 className="abschnitt-titel">Einblicke</h2>
          <TabList selectedValue={reiter} onTabSelect={(_, d) => setReiter(String(d.value))} className="reiterleiste">
            {MODUL_LISTE.filter((m) => m.bilder.length > 0).map((m) => (
              <Tab key={m.kennung} value={m.kennung}>
                {m.name}
              </Tab>
            ))}
          </TabList>
          <div className={modul.bilder.every((b) => b.telefon) ? "galerie galerie-telefon" : "galerie"}>
            {modul.bilder.filter((b) => !b.telefon || modul.bilder.every((x) => x.telefon)).slice(0, 4).map((b) => (
              <Bildschirmfoto key={b.datei} bild={b} />
            ))}
          </div>
        </div>
      </section>

      <section className="abschnitt">
        <div className="breite">
          <h2 className="abschnitt-titel">Warum EduOrga</h2>
          <div className="staerken">
            {STAERKEN.map((s) => (
              <div key={s.titel} className="staerke">
                <span className="staerke-symbol" aria-hidden>
                  {s.symbol}
                </span>
                <div>
                  <h3>{s.titel}</h3>
                  <p>{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="abschnitt abschnitt-band">
        <div className="breite band-raster">
          <div>
            <h2>Idee, Wunsch oder Fehler?</h2>
            <p>
              Rückmeldungen aus dem Schulalltag bestimmen, was als Nächstes entsteht. Im Ideenportal sehen Sie auch, was
              angenommen, geplant und bereits umgesetzt ist.
            </p>
          </div>
          <div className="knopfreihe">
            <KnopfLink zu="/portal" primaer gross symbol={<ChatBubblesQuestionRegular />}>
              Zum Ideenportal
            </KnopfLink>
            <KnopfLink zu={REPO} gross>
              Quellcode auf GitHub
            </KnopfLink>
          </div>
        </div>
      </section>
    </>
  );
}
