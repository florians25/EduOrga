import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { DISCUSSIONS, ISSUE_FEHLER, ISSUE_WUNSCH, RECHTLICHER_HINWEIS, RELEASES, REPO, SLOGAN } from "../inhalt";
import { STAND, STAND_LINK } from "../stand";

const NAVIGATION = [
  { pfad: "/studio", text: "Studio" },
  { pfad: "/web", text: "Web" },
  { pfad: "/mobile", text: "Mobile und iOS" },
  { pfad: "/installation", text: "Installation" },
  { pfad: "/dokumentation", text: "Dokumentation" },
  { pfad: "/rueckmeldung", text: "Rückmeldung" },
];

/** Monogramm und Wortmarke – unverändert aus design/logo. */
export function Marke() {
  return (
    <span className="marke">
      <img src="/logo/edo-monogramm.svg" alt="" width={28} height={28} />
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
      const ziel = document.getElementById(decodeURIComponent(ort.hash.slice(1)));
      if (ziel) {
        ziel.scrollIntoView();
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [ort.pathname, ort.hash]);

  useEffect(() => {
    if (!offen) return;
    const taste = (e: KeyboardEvent) => e.key === "Escape" && setOffen(false);
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [offen]);

  return (
    <div className="seite">
      <a className="sprungmarke" href="#inhalt">
        Zum Inhalt springen
      </a>
      <header className={offen ? "kopf kopf-offen" : "kopf"}>
        <div className="kopf-innen breite">
          <Link to="/" className="kopf-marke" aria-label="EduOrga – Startseite">
            <Marke />
          </Link>
          <nav id="hauptnav" className="hauptnav" aria-label="Hauptnavigation">
            {NAVIGATION.map((n) => (
              <NavLink key={n.pfad} to={n.pfad} className={({ isActive }) => (isActive ? "aktiv" : undefined)}>
                {n.text}
              </NavLink>
            ))}
            <a href={REPO} className="hauptnav-mobil" rel="noopener noreferrer">
              Quellcode auf GitHub <span aria-hidden>↗</span>
            </a>
          </nav>
          <div className="kopf-rechts">
            <a href={REPO} className="kopf-extern" rel="noopener noreferrer">
              GitHub <span aria-hidden>↗</span>
            </a>
            <Link to="/installation" className="knopf knopf-primaer knopf-klein">
              Installieren
            </Link>
          </div>
          <button type="button" className="menueknopf" aria-expanded={offen} aria-controls="hauptnav" onClick={() => setOffen(!offen)}>
            {offen ? "Schließen" : "Menü"}
          </button>
        </div>
      </header>
      <main id="inhalt" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="fuss">
        <div className="breite fuss-raster">
          <div className="fuss-marke">
            <Marke />
            <p>{SLOGAN}</p>
            <p className="fuss-stand">
              Entwicklungsstand {STAND.version}
              {STAND.commit && <> · {STAND.commit}</>}
              <br />
              <a href={STAND_LINK} rel="noopener noreferrer">
                Projektstand und Änderungen
              </a>
            </p>
          </div>
          <FussSpalte titel="Anwendungen">
            <Link to="/studio">EduOrga Studio</Link>
            <Link to="/web">EduOrga Web</Link>
            <Link to="/mobile">EduOrga Mobile</Link>
            <Link to="/mobile#ios">App für iPhone und iPad</Link>
          </FussSpalte>
          <FussSpalte titel="Dokumentation">
            <Link to="/installation">Installation</Link>
            <Link to="/dokumentation">Dokumentation</Link>
            <Link to="/handbuch">Handbuch Studio</Link>
            <a href={RELEASES} rel="noopener noreferrer">Versionen</a>
          </FussSpalte>
          <FussSpalte titel="Rückmeldung">
            <a href={ISSUE_FEHLER} rel="noopener noreferrer">Fehler melden</a>
            <a href={ISSUE_WUNSCH} rel="noopener noreferrer">Idee oder Wunsch</a>
            <a href={DISCUSSIONS} rel="noopener noreferrer">Fragen und Austausch</a>
            <a href={REPO} rel="noopener noreferrer">Quellcode auf GitHub</a>
          </FussSpalte>
          <FussSpalte titel="Rechtliches">
            <Link to="/hinweis">Hinweis</Link>
            <Link to="/impressum">Impressum</Link>
            <Link to="/datenschutz">Datenschutz</Link>
          </FussSpalte>
        </div>
        <div className="breite fuss-unten">
          <p>{RECHTLICHER_HINWEIS}</p>
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

/** Kopfbereich einer Unterseite: Einordnung, Titel und Einleitung. */
export function Seitenkopf({ titel, einleitung, ueber, children }: { titel: ReactNode; einleitung?: ReactNode; ueber?: string; children?: ReactNode }) {
  return (
    <section className="seitenkopf">
      <div className="breite">
        {ueber && <p className="einordnung">{ueber}</p>}
        <h1>{titel}</h1>
        {einleitung && <p className="seitenkopf-text">{einleitung}</p>}
        {children}
      </div>
    </section>
  );
}
