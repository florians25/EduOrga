import { KnopfLink } from "../bausteine/Bausteine";
import { Seitenkopf } from "../bausteine/Rahmen";

export function NichtGefunden() {
  return (
    <>
      <Seitenkopf ueber="Fehler 404" titel="Seite nicht gefunden" einleitung="Die aufgerufene Adresse gibt es auf dieser Website nicht." />
      <div className="breite textseite">
        <KnopfLink zu="/" primaer>
          Zur Startseite
        </KnopfLink>
      </div>
    </>
  );
}
