import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Bild } from "../inhalt";

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
        <button type="button" className="befehle-knopf" onClick={kopieren} aria-live="polite">
          {kopiert ? "Kopiert" : "Kopieren"}
        </button>
      </div>
      <pre>
        <code>{text}</code>
      </pre>
    </div>
  );
}

/** Schlichtes Browserfenster um ein Bildschirmfoto (Adresszeile als Orientierung, keine Bedienelemente). */
export function Browserfenster({ bild, adresse, laden = "lazy" }: { bild: Bild; adresse?: string; laden?: "lazy" | "eager" }) {
  return (
    <div className="fenster">
      <div className="fenster-leiste" aria-hidden>
        <span className="fenster-punkte">
          <i />
          <i />
          <i />
        </span>
        {adresse && <span className="fenster-adresse">{adresse}</span>}
      </div>
      <img src={bild.datei} alt={bild.titel} loading={laden} width={1600} height={950} />
    </div>
  );
}

/** Telefonrahmen um ein Bildschirmfoto im Hochformat. */
export function Telefon({ bild, laden = "lazy", klasse }: { bild: Bild; laden?: "lazy" | "eager"; klasse?: string }) {
  return (
    <div className={klasse ? `telefon ${klasse}` : "telefon"}>
      <img src={bild.datei} alt={bild.titel} loading={laden} width={390} height={844} />
    </div>
  );
}

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
        <img src={bild.datei} alt={bild.titel} loading="lazy" />
      </button>
      <figcaption>{bild.titel}</figcaption>
      <dialog
        ref={dialog}
        className={bild.telefon ? "lupe lupe-telefon" : "lupe"}
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

/** Text-Link mit Pfeil; interne Adressen über den Router, externe als normaler Link mit ↗. */
export function Pfeillink({ zu, children, klasse }: { zu: string; children: ReactNode; klasse?: string }) {
  const k = klasse ? `pfeillink ${klasse}` : "pfeillink";
  if (zu.startsWith("http"))
    return (
      <a href={zu} className={k} rel="noopener noreferrer">
        {children} <span aria-hidden>↗</span>
      </a>
    );
  return (
    <Link to={zu} className={k}>
      {children} <span aria-hidden>→</span>
    </Link>
  );
}

/** Knopf in Linkgestalt. */
export function Knopf({ zu, children, zweitrangig }: { zu: string; children: ReactNode; zweitrangig?: boolean }) {
  const k = zweitrangig ? "knopf knopf-zweit" : "knopf";
  return zu.startsWith("http") ? (
    <a href={zu} className={k} rel="noopener noreferrer">
      {children}
    </a>
  ) : (
    <Link to={zu} className={k}>
      {children}
    </Link>
  );
}
