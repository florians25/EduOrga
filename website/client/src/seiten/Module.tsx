import { Bildschirmfoto, Browserfenster, Pfeillink, Telefon } from "../bausteine/Bausteine";
import { Seitenkopf } from "../bausteine/Rahmen";
import { MODUL_LISTE, type Modul } from "../inhalt";

const finden = (kennung: string) => MODUL_LISTE.find((m) => m.kennung === kennung) ?? MODUL_LISTE[0];

const ADRESSE: Record<string, string> = { studio: "studio.meine-schule.de", web: "plan.meine-schule.de" };

/** Seite eines Moduls: /studio, /web, /mobile (mit der App für iPhone und iPad). */
export function ModulSeite({ kennung }: { kennung: "studio" | "web" | "mobile" }) {
  const m = finden(kennung);
  const desktop = m.bilder.filter((b) => !b.telefon);
  const telefon = m.bilder.filter((b) => b.telefon);
  return (
    <>
      <Seitenkopf ueber={`${m.name} · ${m.rolle}`} titel={m.kurz} einleitung={m.beschreibung}>
        <p className="seitenkopf-fuer">Für {m.fuerWen}</p>
      </Seitenkopf>

      {desktop.length > 0 && (
        <div className="breite">
          <div className="buehne-flaeche modul-titelbild">
            <Browserfenster bild={desktop[0]} adresse={ADRESSE[m.kennung]} laden="eager" />
            {telefon[0] && <Telefon bild={telefon[0]} laden="eager" klasse="buehne-telefon" />}
          </div>
        </div>
      )}
      {desktop.length === 0 && telefon.length > 0 && (
        <div className="breite">
          <div className="buehne-flaeche telefonreihe">
            {telefon.map((b) => (
              <Telefon key={b.datei} bild={b} laden="eager" />
            ))}
          </div>
        </div>
      )}

      <Modulinhalt m={m} weitere={desktop.length > 0 ? m.bilder.slice(1) : []} />
      {kennung === "mobile" && <Modulinhalt m={finden("ios")} id="ios" mitKopf />}
    </>
  );
}

function Modulinhalt({ m, weitere = [], id, mitKopf }: { m: Modul; weitere?: Modul["bilder"]; id?: string; mitKopf?: boolean }) {
  return (
    <section className="abschnitt modul" id={id}>
      <div className="breite">
        {mitKopf && (
          <header className="modul-kopf">
            <p className="marke-klein">{m.rolle}</p>
            <h2 className="abschnitt-titel">{m.name}</h2>
            <p className="abschnitt-text">{m.beschreibung}</p>
            <p className="seitenkopf-fuer">Für {m.fuerWen}</p>
          </header>
        )}
        <div className="zweispaltig">
          <div>
            <p className="marke-klein">Funktionen</p>
          </div>
          <dl className="funktionen">
            {m.funktionen.map((f) => (
              <div key={f.titel}>
                <dt>{f.titel}</dt>
                <dd>{f.text}</dd>
              </div>
            ))}
          </dl>
        </div>

        {weitere.length > 0 && (
          <div className="zweispaltig">
            <div>
              <p className="marke-klein">Weitere Ansichten</p>
            </div>
            <div className={weitere.every((b) => b.telefon) ? "galerie galerie-telefon" : "galerie"}>
              {weitere.map((b) => (
                <Bildschirmfoto key={b.datei} bild={b} />
              ))}
            </div>
          </div>
        )}

        <div className="zweispaltig">
          <div>
            <p className="marke-klein">Technik</p>
          </div>
          <div>
            <dl className="fakten fakten-breit">
              {m.technik.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{k === "Container" || k === "Projekt" ? <code>{v}</code> : v}</dd>
                </div>
              ))}
            </dl>
            <Pfeillink zu={m.readme}>Ausführliche Beschreibung im Repository</Pfeillink>
          </div>
        </div>
      </div>
    </section>
  );
}
