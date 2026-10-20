import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Bild, Plattformstand } from "../inhalt";
import { STAND } from "../stand";

/** Befehlsblock mit Knopf „Kopieren“. */
export function Befehle({ text, titel }: { text: string; titel?: string }) {
  const [kopiert, setKopiert] = useState(false);
  const kopieren = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setKopiert(true);
      window.setTimeout(() => setKopiert(false), 1800);
    } catch {
      /* ohne Zwischenablage (z. B. ohne HTTPS) bleibt der Text markierbar */
    }
  };
  return (
    <div className="befehle">
      <div className="befehle-kopf">
        <span>{titel ?? "Shell"}</span>
        <button type="button" className="befehle-knopf" onClick={kopieren}>
          <span aria-live="polite">{kopiert ? "Kopiert" : "Kopieren"}</span>
        </button>
      </div>
      <pre tabIndex={0}>
        <code>{text}</code>
      </pre>
    </div>
  );
}

/** Schlichtes Browserfenster um ein Bildschirmfoto (Adresszeile als Orientierung, keine Bedienelemente). */
export function Browserfenster({ bild, adresse, laden = "lazy", klasse }: { bild: Bild; adresse?: string; laden?: "lazy" | "eager"; klasse?: string }) {
  return (
    <div className={klasse ? `fenster ${klasse}` : "fenster"}>
      <div className="fenster-leiste" aria-hidden>
        <span className="fenster-punkte">
          <i />
          <i />
          <i />
        </span>
        {adresse && <span className="fenster-adresse">{adresse}</span>}
      </div>
      <img src={bild.datei} alt={bild.titel} loading={laden} width={bild.breite ?? 1600} height={bild.hoehe ?? 950} />
    </div>
  );
}

/** Telefonrahmen um ein Bildschirmfoto im Hochformat. */
export function Telefon({ bild, laden = "lazy", klasse }: { bild: Bild; laden?: "lazy" | "eager"; klasse?: string }) {
  return (
    <div className={klasse ? `telefon ${klasse}` : "telefon"}>
      <img src={bild.datei} alt={bild.titel} loading={laden} width={bild.breite ?? 780} height={bild.hoehe ?? 1688} />
    </div>
  );
}

/** Bildschirmfotos der iPhone-App aus ios/docs/bilder – oder, solange sie fehlen, die gleich gestalteten von EduOrga Mobile. */
export type IosBild = "plan-woche-hell" | "plan-woche-dunkel" | "stunde-details" | "stunde-klassenbuch";
const IOS_TITEL: Record<IosBild, string> = {
  "plan-woche-hell": "Wochenplan als Raster, hell",
  "plan-woche-dunkel": "Wochenplan als Raster, dunkel",
  "stunde-details": "Stundendetails, Reiter Details",
  "stunde-klassenbuch": "Stundendetails, Reiter Klassenbuch mit Thema und Anwesenheitskontrolle",
};
export function iosBild(name: IosBild): Bild {
  const b = STAND.ios?.[name];
  const echt = b?.echt ?? false;
  return {
    datei: b?.datei ?? `/bilder/ios/${name}.png`,
    titel: `${IOS_TITEL[name]}${echt ? "" : " (Ansicht von EduOrga Mobile)"}`,
    telefon: true,
    breite: b?.breite,
    hoehe: b?.hoehe,
  };
}
export const IOS_BILDER_ECHT = Object.values(STAND.ios ?? {}).some((b) => b.echt);

/** Bildschirmfoto mit Bildunterschrift; Klick öffnet die große Ansicht (natives dialog-Element). */
export function Bildschirmfoto({ bild }: { bild: Bild }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [offen, setOffen] = useState(false);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (offen && !d.open) d.showModal();
    if (!offen && d.open) d.close();
  }, [offen]);
  return (
    <figure className={bild.telefon ? "foto foto-telefon" : "foto"}>
      <button type="button" className="foto-knopf" onClick={() => setOffen(true)} aria-label={`${bild.titel} – vergrößern`}>
        <img src={bild.datei} alt="" loading="lazy" width={bild.breite} height={bild.hoehe} />
      </button>
      <figcaption>{bild.titel}</figcaption>
      <dialog
        ref={dialog}
        className={bild.telefon ? "lupe lupe-telefon" : "lupe"}
        aria-label={bild.titel}
        onClose={() => setOffen(false)}
        onClick={(e) => e.target === e.currentTarget && setOffen(false)}
      >
        <div className="lupe-kopf">
          <span>{bild.titel}</span>
          <button type="button" className="textknopf" onClick={() => setOffen(false)}>
            Schließen
          </button>
        </div>
        {offen && <img src={bild.datei} alt={bild.titel} />}
      </dialog>
    </figure>
  );
}

const extern = (zu: string) => zu.startsWith("http");

/** Text-Link mit Pfeil; interne Adressen über den Router, externe als normaler Link mit ↗. */
export function Pfeillink({ zu, children, klasse }: { zu: string; children: ReactNode; klasse?: string }) {
  const k = klasse ? `pfeillink ${klasse}` : "pfeillink";
  if (extern(zu))
    return (
      <a href={zu} className={k} rel="noopener noreferrer">
        {children}
        <span className="pfeil" aria-hidden>
          ↗
        </span>
      </a>
    );
  return (
    <Link to={zu} className={k}>
      {children}
      <span className="pfeil" aria-hidden>
        →
      </span>
    </Link>
  );
}

/** Knopf in Linkgestalt. */
export function Knopf({ zu, children, art = "primaer" }: { zu: string; children: ReactNode; art?: "primaer" | "zweit" | "hell" }) {
  const k = `knopf knopf-${art}`;
  return extern(zu) ? (
    <a href={zu} className={k} rel="noopener noreferrer">
      {children}
    </a>
  ) : (
    <Link to={zu} className={k}>
      {children}
    </Link>
  );
}

/** Kopf eines Abschnitts: Einordnung (klein), Überschrift, Einleitung. */
export function Abschnittskopf({ id, ueber, titel, text, children }: { id: string; ueber?: string; titel: ReactNode; text?: ReactNode; children?: ReactNode }) {
  return (
    <header className="abschnittskopf">
      {ueber && <p className="einordnung">{ueber}</p>}
      <h2 id={id}>{titel}</h2>
      {text && <p className="einleitung">{text}</p>}
      {children}
    </header>
  );
}

/** Stand einer Plattform als Text (keine Plakette): verfügbar neutral, sonst Bernstein bzw. Grau. */
export function Standwort({ stand, children }: { stand: Plattformstand; children: ReactNode }) {
  return <span className={`standwort standwort-${stand}`}>{children}</span>;
}
