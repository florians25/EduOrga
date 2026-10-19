import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { DISCUSSIONS, ISSUES, RECHTLICHER_HINWEIS, RELEASES, REPO, SLOGAN } from "../inhalt";
import { STAND } from "../stand";

const NAVIGATION = [
  { pfad: "/", text: "Überblick" },
  { pfad: "/studio", text: "Studio" },
  { pfad: "/web", text: "Web" },
  { pfad: "/mobile", text: "Mobile" },
  { pfad: "/handbuch", text: "Handbuch" },
];

export function Marke({ hell = false }: { hell?: boolean }) {
  return (
    <span className={hell ? "marke marke-hell" : "marke"}>
      <img src="/logo/edo-monogramm.svg" alt="" width={26} height={26} />
      <span className="marke-wort">
        <b>Edu</b>Orga
      </span>
    </span>
  );
}

/** Seitengerüst: Kopfzeile mit Navigation, Inhalt, Fußzeile. */
export function Rahmen() {
  const [offen, setOffen] = useState(false);
  const ort = useLocation();
  useEffect(() => {
    setOffen(false);
    if (ort.hash) {
      const ziel = document.getElementById(ort.hash.slice(1));
      if (ziel) {
        ziel.scrollIntoView();
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [ort.pathname, ort.hash]);

  return (
    <div className="seite">
      <a className="sprungmarke" href="#inhalt">
        Zum Inhalt springen
      </a>
      <header className="kopf">
        <div className="kopf-innen breite">
          <Link to="/" className="kopf-marke" aria-label="EduOrga – Überblick">
            <Marke />
          </Link>
          <nav id="hauptnav" className={offen ? "hauptnav offen" : "hauptnav"} aria-label="Hauptnavigation">
            {NAVIGATION.map((n) => (
              <NavLink key={n.pfad} to={n.pfad} end={n.pfad === "/"} className={({ isActive }) => (isActive ? "aktiv" : undefined)}>
                {n.text}
              </NavLink>
            ))}
            <a href={REPO} className="hauptnav-mobil-extern" rel="noopener noreferrer">
              Quellcode <span aria-hidden>↗</span>
            </a>
          </nav>
          <a href={REPO} className="kopf-extern" rel="noopener noreferrer">
            Quellcode <span aria-hidden>↗</span>
          </a>
          <button type="button" className="menueknopf" aria-expanded={offen} aria-controls="hauptnav" onClick={() => setOffen(!offen)}>
            {offen ? "Schließen" : "Menü"}
          </button>
        </div>
      </header>
      <main id="inhalt">
        <Outlet />
      </main>
      <footer className="fuss">
        <div className="breite fuss-raster">
          <div className="fuss-marke">
            <Marke />
            <p>{SLOGAN}</p>
          </div>
          <FussSpalte titel="Anwendungen">
            <Link to="/studio">EduOrga Studio</Link>
            <Link to="/web">EduOrga Web</Link>
            <Link to="/mobile">EduOrga Mobile</Link>
            <Link to="/mobile#ios">App für iPhone und iPad</Link>
          </FussSpalte>
          <FussSpalte titel="Projekt">
            <Link to="/installation">Installation</Link>
            <Link to="/handbuch">Handbuch</Link>
            <a href={REPO} rel="noopener noreferrer">Quellcode auf GitHub</a>
            <a href={RELEASES} rel="noopener noreferrer">Versionen</a>
          </FussSpalte>
          <FussSpalte titel="Rückmeldung">
            <a href={ISSUES} rel="noopener noreferrer">Fehler melden (Issues)</a>
            <a href={DISCUSSIONS} rel="noopener noreferrer">Ideen und Fragen (Discussions)</a>
          </FussSpalte>
          <FussSpalte titel="Rechtliches">
            <Link to="/hinweis">Hinweis</Link>
            <Link to="/impressum">Impressum</Link>
            <Link to="/datenschutz">Datenschutz</Link>
          </FussSpalte>
        </div>
        <div className="breite fuss-unten">
          <p>{RECHTLICHER_HINWEIS}</p>
          <p className="fuss-stand">
            Entwicklungsstand {STAND.version}
            {STAND.commit && <> · {STAND.commit}</>}
          </p>
        </div>
      </footer>
    </div>
  );
}

function FussSpalte({ titel, children }: { titel: string; children: ReactNode }) {
  const eintraege = Array.isArray(children) ? children : [children];
  return (
    <div>
      <h2>{titel}</h2>
      <ul>
        {eintraege.map((e, i) => (
          <li key={i}>{e}</li>
        ))}
      </ul>
    </div>
  );
}

/** Kopfbereich einer Unterseite: kleine Einordnung, Titel und Einleitung. */
export function Seitenkopf({ titel, einleitung, ueber, children }: { titel: ReactNode; einleitung?: ReactNode; ueber?: string; children?: ReactNode }) {
  return (
    <section className="seitenkopf">
      <div className="breite">
        {ueber && <p className="marke-klein">{ueber}</p>}
        <h1>{titel}</h1>
        {einleitung && <p className="seitenkopf-text">{einleitung}</p>}
        {children}
      </div>
    </section>
  );
}
