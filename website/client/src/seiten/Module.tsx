import { Abschnittskopf, Bildschirmfoto, Browserfenster, iosBild, IOS_BILDER_ECHT, Knopf, Pfeillink, Standwort, Telefon } from "../bausteine/Bausteine";
import { Seitenkopf } from "../bausteine/Rahmen";
import { DATEI, ISSUE_FEHLER, ISSUE_WUNSCH, MODUL_LISTE, PLATTFORMEN, type Bild, type Modul } from "../inhalt";

const finden = (kennung: string) => MODUL_LISTE.find((m) => m.kennung === kennung) ?? MODUL_LISTE[0];

const ADRESSE: Record<string, string> = { studio: "studio.meine-schule.de", web: "plan.meine-schule.de" };
const GROESSE: Record<string, { breite: number; hoehe: number }> = {
  studio: { breite: 1600, hoehe: 950 },
  web: { breite: 1440, hoehe: 900 },
};

/** Seite einer Anwendung: /studio, /web und /mobile (mit der App für iPhone und iPad und dem Stand von Android). */
export function ModulSeite({ kennung }: { kennung: "studio" | "web" | "mobile" }) {
  const m = finden(kennung);
  const groesse = (b: Bild): Bild => (b.telefon ? b : { ...b, ...(b.datei.endsWith("stundenplan.png") ? { breite: 2880, hoehe: 2000 } : GROESSE[m.kennung]) });
  const desktop = m.bilder.filter((b) => !b.telefon).map(groesse);
  const telefon = m.bilder.filter((b) => b.telefon);

  return (
    <>
      <Seitenkopf ueber={`${m.name} · ${m.rolle}`} titel={m.kurz} einleitung={m.beschreibung}>
        <p className="seitenkopf-fuer">Für {m.fuerWen}</p>
        {kennung === "mobile" && <Plattformen />}
      </Seitenkopf>

      {desktop.length > 0 && (
        <div className="breite">
          <div className="buehne-flaeche modul-titelbild">
            <Browserfenster bild={desktop[0]} adresse={ADRESSE[m.kennung]} laden="eager" klasse="buehne-fenster" />
            {telefon[0] && <Telefon bild={telefon[0]} laden="eager" klasse="buehne-telefon" />}
          </div>
        </div>
      )}
      {kennung === "mobile" && (
        <div className="breite">
          <div className="buehne-flaeche telefonreihe">
            {telefon.slice(0, 4).map((b, i) => (
              <Telefon key={b.datei} bild={b} laden="eager" klasse={i % 2 ? "telefon-versetzt" : undefined} />
            ))}
          </div>
        </div>
      )}

      <Modulinhalt m={m} weitere={kennung === "mobile" ? telefon.slice(4) : [...desktop.slice(1), ...telefon.slice(1)]} />
      {kennung === "mobile" && <IosAbschnitt />}
      {kennung === "mobile" && <AndroidAbschnitt />}
    </>
  );
}

function Plattformen() {
  const liste = PLATTFORMEN.filter((p) => p.name !== "EduOrga Studio" && p.name !== "EduOrga Web");
  return (
    <ul className="plattformen plattformen-kopf" aria-label="Stand der Apps">
      {liste.map((p) => (
        <li key={p.name}>
          <div className="plattform-name">
            <strong>{p.name}</strong>
            <span>{p.art}</span>
          </div>
          <div className="plattform-stand">
            <Standwort stand={p.stand}>{p.standText}</Standwort>
            <span>{p.hinweis}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Funktionen({ m }: { m: Modul }) {
  return (
    <dl className="funktionen">
      {m.funktionen.map((f) => (
        <div key={f.titel}>
          <dt>{f.titel}</dt>
          <dd>{f.text}</dd>
        </div>
      ))}
    </dl>
  );
}

function Technik({ m }: { m: Modul }) {
  return (
    <div className="zweispaltig">
      <Abschnittskopf id={`${m.kennung}-technik`} ueber="Technik" titel="Betrieb und Aufbau" />
      <div>
        <dl className="fakten">
          {m.technik.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{k === "Container" || k === "Projekt" ? <code>{v}</code> : v}</dd>
            </div>
          ))}
        </dl>
        <div className="linkzeile">
          <Pfeillink zu={m.readme}>Ausführliche Beschreibung im Repository</Pfeillink>
          <Pfeillink zu={ISSUE_FEHLER}>Fehler melden</Pfeillink>
        </div>
      </div>
    </div>
  );
}

function Modulinhalt({ m, weitere }: { m: Modul; weitere: Bild[] }) {
  return (
    <section className="abschnitt modul" aria-labelledby={`${m.kennung}-funktionen`}>
      <div className="breite">
        <div className="zweispaltig">
          <Abschnittskopf id={`${m.kennung}-funktionen`} ueber="Funktionen" titel={`Was ${m.name} kann`} />
          <Funktionen m={m} />
        </div>
        {weitere.length > 0 && (
          <div className="zweispaltig">
            <Abschnittskopf id={`${m.kennung}-ansichten`} ueber="Ansichten" titel="Weitere Bildschirmfotos" text="Mit Beispieldaten. Anklicken vergrößert." />
            <div className={weitere.every((b) => b.telefon) ? "galerie galerie-telefon" : "galerie"}>
              {weitere.map((b) => (
                <Bildschirmfoto key={b.datei} bild={b} />
              ))}
            </div>
          </div>
        )}
        <Technik m={m} />
      </div>
    </section>
  );
}

function IosAbschnitt() {
  const ios = finden("ios");
  const bilder = [iosBild("plan-woche-hell"), iosBild("plan-woche-dunkel"), iosBild("stunde-details"), iosBild("stunde-klassenbuch")];
  return (
    <section className="abschnitt abschnitt-flaeche modul" id="ios" aria-labelledby="ios-titel">
      <div className="breite">
        <div className="zweispaltig">
          <Abschnittskopf id="ios-titel" ueber="iPhone und iPad" titel={ios.name} text={ios.beschreibung}>
            <p className="standzeile">
              <Standwort stand="unveroeffentlicht">Noch nicht im App Store veröffentlicht.</Standwort> Bauen mit Xcode 26 aus{" "}
              <code>ios/UntPlanNext.xcodeproj</code>.
            </p>
          </Abschnittskopf>
          <Funktionen m={ios} />
        </div>
        <div className="telefonreihe telefonreihe-offen">
          {bilder.map((b) => (
            <figure key={b.datei} className="telefon-figur">
              <Telefon bild={b} />
              <figcaption>{b.titel}</figcaption>
            </figure>
          ))}
        </div>
        {!IOS_BILDER_ECHT && (
          <p className="bildhinweis">
            Solange die Bildschirmfotos der App nicht im Repository liegen, zeigt diese Seite die gleich gestalteten Ansichten von EduOrga
            Mobile.
          </p>
        )}
        <Technik m={ios} />
      </div>
    </section>
  );
}

function AndroidAbschnitt() {
  return (
    <section className="abschnitt abschnitt-linie" id="android" aria-labelledby="android-titel">
      <div className="breite zweispaltig">
        <Abschnittskopf id="android-titel" ueber="Android" titel="EduOrga für Android" />
        <div className="textblock">
          <p className="standzeile">
            <Standwort stand="arbeit">In Arbeit.</Standwort>
          </p>
          <p>
            Eine eigene Android-App ist in Arbeit. Bis dahin läuft EduOrga Mobile auf Android-Telefonen im Browser und lässt sich
            über „App installieren“ bzw. „Zum Startbildschirm hinzufügen“ wie eine App ablegen – mit Plan, Klassenbuch, Postfach,
            Sprechtag und Benachrichtigungen bei Planänderungen.
          </p>
          <div className="linkzeile">
            <Pfeillink zu={ISSUE_WUNSCH}>Wünsche für die Android-App</Pfeillink>
            <Pfeillink zu={DATEI("mobile/README.md")}>EduOrga Mobile im Repository</Pfeillink>
          </div>
          <div className="aktionen">
            <Knopf zu="/installation" art="zweit">
              EduOrga Mobile installieren
            </Knopf>
          </div>
        </div>
      </div>
    </section>
  );
}
