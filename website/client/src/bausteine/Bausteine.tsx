import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button, Dialog, DialogBody, DialogSurface, DialogTitle, Tooltip } from "@fluentui/react-components";
import { CheckmarkRegular, CopyRegular, DismissRegular } from "@fluentui/react-icons";
import type { Bild } from "../inhalt";
import type { Status } from "../api";
import { STATUS } from "../inhalt";

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
        <Tooltip content={kopiert ? "Kopiert" : "In die Zwischenablage kopieren"} relationship="label">
          <Button size="small" appearance="subtle" icon={kopiert ? <CheckmarkRegular /> : <CopyRegular />} onClick={kopieren}>
            {kopiert ? "Kopiert" : "Kopieren"}
          </Button>
        </Tooltip>
      </div>
      <pre>
        <code>{text}</code>
      </pre>
    </div>
  );
}

/** Bildschirmfoto mit Rahmen und Bildunterschrift; Klick öffnet die große Ansicht. */
export function Bildschirmfoto({ bild, laden = "lazy" }: { bild: Bild; laden?: "lazy" | "eager" }) {
  const [gross, setGross] = useState(false);
  return (
    <figure className={bild.telefon ? "foto foto-telefon" : "foto"}>
      <button type="button" className="foto-knopf" onClick={() => setGross(true)} aria-label={`${bild.titel} – vergrößern`}>
        <img src={bild.datei} alt={bild.titel} loading={laden} />
      </button>
      <figcaption>{bild.titel}</figcaption>
      <Dialog open={gross} onOpenChange={(_, d) => setGross(d.open)}>
        <DialogSurface className={bild.telefon ? "foto-dialog foto-dialog-telefon" : "foto-dialog"}>
          <DialogBody>
            <DialogTitle
              action={<Button appearance="subtle" aria-label="Schließen" icon={<DismissRegular />} onClick={() => setGross(false)} />}
            >
              {bild.titel}
            </DialogTitle>
            <img className="foto-gross" src={bild.datei} alt={bild.titel} />
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </figure>
  );
}

/** Stand als kleine Plakette mit Farbmarke. */
export function StatusMarke({ status, text }: { status: Status; text?: string }) {
  return (
    <span className={`status status-${status}`}>
      <span className="status-punkt" aria-hidden />
      {text ?? STATUS[status]}
    </span>
  );
}

/** Link in Knopfgestalt (interne Adressen über den Router, externe als normaler Link). */
export function KnopfLink({ zu, primaer, gross, children, symbol }: { zu: string; primaer?: boolean; gross?: boolean; children: ReactNode; symbol?: ReactNode }) {
  const klasse = ["knopf", primaer ? "knopf-primaer" : "", gross ? "knopf-gross" : ""].join(" ").trim();
  const inhalt = (
    <>
      {symbol && <span className="knopf-symbol" aria-hidden>{symbol}</span>}
      {children}
    </>
  );
  return zu.startsWith("http") ? (
    <a href={zu} className={klasse} rel="noopener noreferrer">{inhalt}</a>
  ) : (
    <Link to={zu} className={klasse}>{inhalt}</Link>
  );
}
