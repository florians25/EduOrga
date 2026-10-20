import { Pfeillink } from "../bausteine/Bausteine";
import { Seitenkopf } from "../bausteine/Rahmen";
import { KAPITEL, type Block } from "../doku";
import { DATEI, ISSUE_WUNSCH } from "../inhalt";
import { STAND } from "../stand";

function Bloecke({ bloecke }: { bloecke: Block[] }) {
  return (
    <>
      {bloecke.map((b, i) => {
        switch (b.art) {
          case "text":
            return <p key={i}>{b.text}</p>;
          case "liste":
            return (
              <ul key={i} className="aufzaehlung">
                {b.punkte.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            );
          case "schritte":
            return (
              <ol key={i} className="aufzaehlung aufzaehlung-nummern">
                {b.punkte.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ol>
            );
          case "tabelle":
            return (
              <div key={i} className="tabellenrahmen">
                <table className="tabelle">
                  <thead>
                    <tr>
                      {b.kopf.map((k) => (
                        <th key={k} scope="col">
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.zeilen.map((z) => (
                      <tr key={z.join("|")}>
                        {z.map((zelle, j) => (j === 0 ? <th key={j} scope="row">{zelle}</th> : <td key={j}>{zelle}</td>))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "hinweis":
            return (
              <div key={i} className="hinweiskasten">
                <strong>{b.titel}</strong>
                <p>{b.text}</p>
              </div>
            );
        }
      })}
    </>
  );
}

export function Dokumentation() {
  const handbuch = DATEI("docs/HANDBUCH.md");
  return (
    <>
      <Seitenkopf
        ueber="Dokumentation"
        titel="EduOrga im Einzelnen"
        einleitung="Kapitel je Anwendung – von den ersten Schritten in EduOrga Studio bis zur App für iPhone und iPad. Die ausführlichen Beschreibungen liegen neben dem Quellcode im Repository und werden mit ihm aktualisiert."
      />
      <div className="breite dokuseite">
        <nav className="unternav" aria-label="Kapitel der Dokumentation">
          <p className="unternav-titel">Kapitel</p>
          <ol>
            {KAPITEL.map((k) => (
              <li key={k.id}>
                <a href={`#${k.id}`}>{k.titel}</a>
                {k.abschnitte.length > 1 && (
                  <ol>
                    {k.abschnitte.map((a) => (
                      <li key={a.id}>
                        <a href={`#${a.id}`}>{a.titel}</a>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
            <li>
              <a href="#handbuch">Handbuch Studio</a>
            </li>
          </ol>
        </nav>
        <div className="dokuinhalt textseite">
          {KAPITEL.map((k) => (
            <article key={k.id} id={k.id} className="kapitel" aria-labelledby={`${k.id}-titel`}>
              <header className="kapitel-kopf">
                <p className="einordnung">{k.kurz}</p>
                <h2 id={`${k.id}-titel`}>{k.titel}</h2>
                <p className="einleitung">{k.einleitung}</p>
              </header>
              {k.abschnitte.map((a) => (
                <section key={a.id} id={a.id} aria-labelledby={`${a.id}-titel`}>
                  <h3 id={`${a.id}-titel`}>{a.titel}</h3>
                  <Bloecke bloecke={a.bloecke} />
                </section>
              ))}
              <div className="kapitel-quellen">
                <span>Im Repository</span>
                {k.quellen.map((q) => (
                  <Pfeillink key={q.zu} zu={q.zu}>
                    {q.titel}
                  </Pfeillink>
                ))}
              </div>
            </article>
          ))}

          <article id="handbuch" className="kapitel" aria-labelledby="handbuch-titel">
            <header className="kapitel-kopf">
              <p className="einordnung">{STAND.handbuch.length} Kapitel mit Tastenkürzeln</p>
              <h2 id="handbuch-titel">Benutzerhandbuch EduOrga Studio</h2>
              <p className="einleitung">Das vollständige Handbuch folgt dem Arbeitsablauf der Planung. Jedes Kapitel öffnet sich auf GitHub.</p>
            </header>
            <ol className="kapitelliste">
              {STAND.handbuch.map((k) => (
                <li key={k.nummer}>
                  <a href={`${handbuch}#${k.anker}`} rel="noopener noreferrer">
                    <span className="kapitel-nummer">{String(k.nummer).padStart(2, "0")}</span>
                    <span>{k.titel}</span>
                    <span className="pfeil" aria-hidden>
                      ↗
                    </span>
                  </a>
                </li>
              ))}
            </ol>
            <p className="klein">
              Fehlt etwas in der Dokumentation? <a href={ISSUE_WUNSCH} rel="noopener noreferrer">Als Wunsch melden</a>.
            </p>
          </article>
        </div>
      </div>
    </>
  );
}
