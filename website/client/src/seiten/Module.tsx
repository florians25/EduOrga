import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { CheckmarkRegular, OpenRegular } from "@fluentui/react-icons";
import { Bildschirmfoto } from "../bausteine/Bausteine";
import { Seitenkopf } from "../bausteine/Rahmen";
import { MODUL_LISTE } from "../inhalt";

export function ModuleSeite() {
  const ort = useLocation();
  useEffect(() => {
    if (ort.hash) document.getElementById(ort.hash.slice(1))?.scrollIntoView();
  }, [ort.hash]);

  return (
    <>
      <Seitenkopf
        ueber="Module"
        titel="Die Bausteine von EduOrga"
        einleitung="Vier Oberflächen auf einer gemeinsamen Fachlogik. Studio plant, Web veröffentlicht, Mobile und die iPhone-App bringen den Plan aufs Telefon. Jedes Programm läuft als eigener Container und lässt sich einzeln installieren und aktualisieren."
      />
      <div className="breite modulseite">
        <nav className="unternav" aria-label="Module">
          <p className="unternav-titel">Auf dieser Seite</p>
          {MODUL_LISTE.map((m) => (
            <a key={m.kennung} href={`#${m.kennung}`} className={ort.hash === `#${m.kennung}` ? "aktiv" : undefined}>
              {m.name}
            </a>
          ))}
        </nav>
        <div className="modulinhalt">
          {MODUL_LISTE.map((m) => (
            <section key={m.kennung} id={m.kennung} className="modul">
              <header className="modul-kopf">
                <p className="modul-ueber">{m.kurz}</p>
                <h2>{m.name}</h2>
                <p className="modul-fuer">Für {m.fuerWen}</p>
              </header>
              <p className="modul-text">{m.beschreibung}</p>

              <h3 className="modul-zwischentitel">Funktionen</h3>
              <ul className="funktionsliste">
                {m.funktionen.map((f) => (
                  <li key={f.titel}>
                    <CheckmarkRegular className="funktion-haken" aria-hidden />
                    <div>
                      <strong>{f.titel}</strong>
                      <span>{f.text}</span>
                    </div>
                  </li>
                ))}
              </ul>

              {m.bilder.length > 0 && (
                <>
                  <h3 className="modul-zwischentitel">Bildschirmfotos</h3>
                  <div className={m.bilder.every((b) => b.telefon) ? "galerie galerie-telefon" : "galerie galerie-modul"}>
                    {m.bilder.map((b) => (
                      <Bildschirmfoto key={b.datei} bild={b} />
                    ))}
                  </div>
                </>
              )}

              <h3 className="modul-zwischentitel">Technik</h3>
              <table className="faktentabelle">
                <tbody>
                  {m.technik.map(([k, v]) => (
                    <tr key={k}>
                      <th scope="row">{k}</th>
                      <td>{k === "Container" || k === "Projekt" ? <code>{v}</code> : v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                <a href={m.readme} rel="noopener noreferrer" className="textlink">
                  Ausführliche Beschreibung im Repository <OpenRegular aria-hidden />
                </a>
              </p>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
