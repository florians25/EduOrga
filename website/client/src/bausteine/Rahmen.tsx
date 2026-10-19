import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Button } from "@fluentui/react-components";
import { DismissRegular, NavigationRegular, OpenRegular } from "@fluentui/react-icons";
import { ISSUES, RECHTLICHER_HINWEIS, RELEASES, REPO, SLOGAN } from "../inhalt";

const NAVIGATION = [
  { pfad: "/", text: "Start" },
  { pfad: "/module", text: "Module" },
  { pfad: "/installation", text: "Installation" },
  { pfad: "/portal", text: "Ideenportal" },
  { pfad: "/hinweis", text: "Hinweis" },
];

export function Marke({ hell = false }: { hell?: boolean }) {
  return (
    <span className={hell ? "marke marke-hell" : "marke"}>
      <img src="/logo/edo-monogramm.svg" alt="" width={32} height={32} />
      <span className="marke-wort">
        <b>Edu</b>Orga
      </span>
    </span>
  );
}

/** Seitengerüst der öffentlichen Website: Kopfzeile mit Navigation, Inhalt, Fußzeile. */
export function Rahmen() {
  const [offen, setOffen] = useState(false);
  const ort = useLocation();
  useEffect(() => {
    setOffen(false);
    if (!ort.hash) window.scrollTo(0, 0);
  }, [ort.pathname, ort.hash]);

  return (
    <div className="seite">
      <a className="sprungmarke" href="#inhalt">
        Zum Inhalt springen
      </a>
      <header className="kopf">
        <div className="kopf-innen breite">
          <Link to="/" className="kopf-marke" aria-label="EduOrga – Startseite">
            <Marke />
          </Link>
          <nav className={offen ? "hauptnav offen" : "hauptnav"} aria-label="Hauptnavigation">
            {NAVIGATION.map((n) => (
              <NavLink key={n.pfad} to={n.pfad} end={n.pfad === "/"} className={({ isActive }) => (isActive ? "aktiv" : undefined)}>
                {n.text}
              </NavLink>
            ))}
            <a href={REPO} className="hauptnav-extern" rel="noopener noreferrer">
              GitHub <OpenRegular aria-hidden />
            </a>
          </nav>
          <Button
            className="menueknopf"
            appearance="subtle"
            icon={offen ? <DismissRegular /> : <NavigationRegular />}
            aria-expanded={offen}
            aria-label={offen ? "Menü schließen" : "Menü öffnen"}
            onClick={() => setOffen(!offen)}
          />
        </div>
      </header>
      <main id="inhalt">
        <Outlet />
      </main>
      <footer className="fuss">
        <div className="breite fuss-raster">
          <div>
            <Marke hell />
            <p className="fuss-slogan">{SLOGAN}</p>
          </div>
          <div>
            <h2>Produkt</h2>
            <ul>
              <li><Link to="/module">Module</Link></li>
              <li><Link to="/installation">Installation</Link></li>
              <li><Link to="/portal">Ideen, Wünsche und Fehler</Link></li>
            </ul>
          </div>
          <div>
            <h2>Projekt</h2>
            <ul>
              <li><a href={REPO} rel="noopener noreferrer">Quellcode auf GitHub</a></li>
              <li><a href={RELEASES} rel="noopener noreferrer">Versionen (Releases)</a></li>
              <li><a href={ISSUES} rel="noopener noreferrer">Issues</a></li>
            </ul>
          </div>
          <div>
            <h2>Rechtliches</h2>
            <ul>
              <li><Link to="/hinweis">Hinweis</Link></li>
              <li><Link to="/impressum">Impressum</Link></li>
              <li><Link to="/datenschutz">Datenschutz</Link></li>
            </ul>
          </div>
        </div>
        <div className="breite fuss-hinweis">
          <p>{RECHTLICHER_HINWEIS}</p>
        </div>
      </footer>
    </div>
  );
}

/** Kopfbereich einer Unterseite: Brotkrumen-Zeile, Titel und Einleitung. */
export function Seitenkopf({ titel, einleitung, ueber }: { titel: string; einleitung?: string; ueber?: string }) {
  return (
    <section className="seitenkopf">
      <div className="breite">
        {ueber && <p className="seitenkopf-ueber">{ueber}</p>}
        <h1>{titel}</h1>
        {einleitung && <p className="seitenkopf-text">{einleitung}</p>}
      </div>
    </section>
  );
}
