import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Checkbox,
  Dropdown,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Option,
  Radio,
  RadioGroup,
  Spinner,
  Textarea,
} from "@fluentui/react-components";
import { SearchRegular, SendRegular } from "@fluentui/react-icons";
import { Seitenkopf } from "../bausteine/Rahmen";
import { StatusMarke } from "../bausteine/Bausteine";
import { ApiFehler, api, datum, type OeffentlicherEintrag, type Status, type Typ } from "../api";
import { MODULE, STATUS, STATUS_HILFE, TYPEN, TYP_HILFE } from "../inhalt";

interface Formular {
  typ: Typ;
  titel: string;
  beschreibung: string;
  modul: string;
  email: string;
  einwilligung: boolean;
  website: string;
}

const LEER: Formular = { typ: "idee", titel: "", beschreibung: "", modul: "", email: "", einwilligung: false, website: "" };
const ABLAUF: Status[] = ["eingereicht", "in_pruefung", "backlog", "in_arbeit", "erledigt"];

export function Portal() {
  return (
    <>
      <Seitenkopf
        ueber="Ideenportal"
        titel="Ideen, Wünsche und Fehler"
        einleitung="Was fehlt Ihnen im Schulalltag, was funktioniert nicht wie erwartet? Jede Einreichung wird gelesen und geprüft. Angenommene Vorschläge erscheinen mit ihrem Stand in der Liste unten."
      />
      <div className="breite portal-raster">
        <Einreichung />
        <aside className="portal-seite">
          <div className="kasten">
            <h2>So geht es weiter</h2>
            <ol className="ablauf">
              {ABLAUF.map((s) => (
                <li key={s}>
                  <StatusMarke status={s} />
                  <span>{STATUS_HILFE[s]}</span>
                </li>
              ))}
            </ol>
            <p className="kasten-fuss">
              Nicht umsetzbare Vorschläge werden mit Begründung als <strong>{STATUS.abgelehnt}</strong> markiert.
            </p>
          </div>
          <div className="kasten">
            <h2>Fehler mit technischen Details</h2>
            <p>
              Für Fehlermeldungen mit Protokollauszügen oder Code eignen sich auch die{" "}
              <a href="https://github.com/florians25/UntPlanNext/issues" rel="noopener noreferrer">
                Issues auf GitHub
              </a>
              . Bitte keine personenbezogenen Daten von Schülerinnen, Schülern oder Lehrkräften einreichen.
            </p>
          </div>
        </aside>
      </div>
      <OeffentlicheListe />
    </>
  );
}

function Einreichung() {
  const [f, setF] = useState<Formular>(LEER);
  const [fehler, setFehler] = useState<Partial<Record<keyof Formular, string>>>({});
  const [senden, setSenden] = useState(false);
  const [ergebnis, setErgebnis] = useState<{ ok: boolean; text: string } | null>(null);
  const geladen = useRef(Date.now());
  const setze = <K extends keyof Formular>(k: K, v: Formular[K]) => {
    setF((alt) => ({ ...alt, [k]: v }));
    setFehler((alt) => ({ ...alt, [k]: undefined }));
  };

  const pruefen = () => {
    const e: Partial<Record<keyof Formular, string>> = {};
    if (f.titel.trim().length < 5) e.titel = "Bitte geben Sie einen Titel mit mindestens 5 Zeichen an.";
    if (f.beschreibung.trim().length < 20) e.beschreibung = "Bitte beschreiben Sie Ihr Anliegen mit mindestens 20 Zeichen.";
    if (!f.modul) e.modul = "Bitte wählen Sie den betroffenen Bereich.";
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = "Die E-Mail-Adresse ist ungültig.";
    if (!f.einwilligung) e.einwilligung = "Bitte bestätigen Sie die Datenschutzhinweise.";
    setFehler(e);
    return Object.keys(e).length === 0;
  };

  const absenden = async (ev: FormEvent) => {
    ev.preventDefault();
    setErgebnis(null);
    if (!pruefen()) return;
    setSenden(true);
    try {
      const r = await api<{ nummer: number | null; meldung: string }>("/api/einreichungen", {
        methode: "POST",
        daten: { ...f, email: f.email.trim() || null, bearbeitungsdauer: Date.now() - geladen.current },
      });
      setErgebnis({ ok: true, text: r.meldung });
      setF(LEER);
      geladen.current = Date.now();
    } catch (e) {
      setErgebnis({ ok: false, text: e instanceof ApiFehler ? e.message : "Die Einreichung konnte nicht gesendet werden." });
    } finally {
      setSenden(false);
    }
  };

  return (
    <form className="kasten formular" onSubmit={absenden} noValidate>
      <h2>Neue Einreichung</h2>
      {ergebnis && (
        <MessageBar intent={ergebnis.ok ? "success" : "error"} layout="multiline" className="hinweisbalken">
          <MessageBarBody>
            <MessageBarTitle>{ergebnis.ok ? "Gesendet" : "Nicht gesendet"}</MessageBarTitle>
            {ergebnis.text}
          </MessageBarBody>
        </MessageBar>
      )}
      <Field label="Art" required>
        <RadioGroup layout="horizontal" value={f.typ} onChange={(_, d) => setze("typ", d.value as Typ)}>
          {(Object.keys(TYPEN) as Typ[]).map((t) => (
            <Radio key={t} value={t} label={TYPEN[t]} />
          ))}
        </RadioGroup>
      </Field>
      <p className="feldhilfe">{TYP_HILFE[f.typ]}</p>
      <Field label="Bereich" required validationMessage={fehler.modul}>
        <Dropdown
          placeholder="Bitte wählen"
          value={f.modul ? MODULE[f.modul] : ""}
          selectedOptions={f.modul ? [f.modul] : []}
          onOptionSelect={(_, d) => setze("modul", d.optionValue ?? "")}
        >
          {Object.entries(MODULE).map(([k, v]) => (
            <Option key={k} value={k}>
              {v}
            </Option>
          ))}
        </Dropdown>
      </Field>
      <Field label="Titel" required validationMessage={fehler.titel} hint="Kurz und eindeutig, z. B. „Vertretungsplan als PDF exportieren“">
        <Input value={f.titel} maxLength={140} onChange={(_, d) => setze("titel", d.value)} />
      </Field>
      <Field
        label="Beschreibung"
        required
        validationMessage={fehler.beschreibung}
        hint={f.typ === "fehler" ? "Was haben Sie getan, was ist passiert, was hätten Sie erwartet? Mit Version und Gerät." : "Wofür brauchen Sie das, wie sollte es funktionieren?"}
      >
        <Textarea value={f.beschreibung} maxLength={5000} rows={7} resize="vertical" onChange={(_, d) => setze("beschreibung", d.value)} />
      </Field>
      <Field label="E-Mail für Rückfragen (freiwillig)" validationMessage={fehler.email} hint="Wird nicht veröffentlicht und nur für Rückfragen zu dieser Einreichung genutzt.">
        <Input type="email" value={f.email} maxLength={200} onChange={(_, d) => setze("email", d.value)} autoComplete="email" />
      </Field>
      {/* Honigtopf: für Menschen unsichtbar, Automaten füllen es aus */}
      <div className="honigtopf" aria-hidden="true">
        <label>
          Website
          <input type="text" tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => setze("website", e.target.value)} />
        </label>
      </div>
      <Field validationMessage={fehler.einwilligung}>
        <Checkbox
          checked={f.einwilligung}
          onChange={(_, d) => setze("einwilligung", d.checked === true)}
          label={
            <>
              Ich habe die <Link to="/datenschutz">Datenschutzhinweise</Link> gelesen und bin einverstanden, dass meine Angaben zur
              Bearbeitung der Einreichung gespeichert werden. Angenommene Einreichungen (ohne E-Mail-Adresse) können öffentlich
              angezeigt werden.
            </>
          }
        />
      </Field>
      <div className="formular-fuss">
        <Button type="submit" appearance="primary" icon={senden ? <Spinner size="tiny" /> : <SendRegular />} disabled={senden}>
          Einreichen
        </Button>
        <span className="feldhilfe">Pflichtfelder sind mit * markiert.</span>
      </div>
    </form>
  );
}

function OeffentlicheListe() {
  const [liste, setListe] = useState<OeffentlicherEintrag[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [modul, setModul] = useState<string>("");
  const [suche, setSuche] = useState("");

  useEffect(() => {
    api<OeffentlicherEintrag[]>("/api/eintraege")
      .then(setListe)
      .catch((e: Error) => setFehler(e.message));
  }, []);

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return (liste ?? []).filter(
      (e) =>
        (!status || e.status === status) &&
        (!modul || e.modul === modul) &&
        (!q || e.titel.toLowerCase().includes(q) || e.beschreibung.toLowerCase().includes(q) || `#${e.nummer}` === q),
    );
  }, [liste, status, modul, suche]);

  return (
    <section className="abschnitt abschnitt-flaeche" aria-labelledby="liste-titel">
      <div className="breite">
        <div className="liste-kopf">
          <div>
            <h2 id="liste-titel" className="abschnitt-titel">
              Angenommen und geplant
            </h2>
            <p className="abschnitt-text">Einträge im Backlog, in Arbeit und erledigt. Nummern helfen beim Wiederfinden der eigenen Einreichung.</p>
          </div>
          <div className="filterzeile">
            <Input contentBefore={<SearchRegular />} placeholder="Suchen" value={suche} onChange={(_, d) => setSuche(d.value)} aria-label="Suchen" />
            <Dropdown
              aria-label="Stand"
              value={status ? STATUS[status as Status] : "Alle Stände"}
              selectedOptions={[status]}
              onOptionSelect={(_, d) => setStatus(d.optionValue ?? "")}
            >
              <Option value="">Alle Stände</Option>
              <Option value="backlog">{STATUS.backlog}</Option>
              <Option value="in_arbeit">{STATUS.in_arbeit}</Option>
              <Option value="erledigt">{STATUS.erledigt}</Option>
            </Dropdown>
            <Dropdown
              aria-label="Bereich"
              value={modul ? MODULE[modul] : "Alle Bereiche"}
              selectedOptions={[modul]}
              onOptionSelect={(_, d) => setModul(d.optionValue ?? "")}
            >
              <Option value="">Alle Bereiche</Option>
              {Object.entries(MODULE).map(([k, v]) => (
                <Option key={k} value={k}>
                  {v}
                </Option>
              ))}
            </Dropdown>
          </div>
        </div>
        {fehler && (
          <MessageBar intent="error">
            <MessageBarBody>{fehler}</MessageBarBody>
          </MessageBar>
        )}
        {!liste && !fehler && <Spinner label="Wird geladen" />}
        {liste && gefiltert.length === 0 && (
          <p className="leer">{liste.length === 0 ? "Noch keine angenommenen Einträge." : "Keine Einträge für diese Auswahl."}</p>
        )}
        <ul className="eintragsliste">
          {gefiltert.map((e) => (
            <li key={e.nummer} className="eintrag">
              <div className="eintrag-kopf">
                <span className="eintrag-nummer">#{e.nummer}</span>
                <span className={`typmarke typ-${e.typ}`}>{TYPEN[e.typ]}</span>
                <span className="eintrag-modul">{MODULE[e.modul] ?? e.modul}</span>
                <StatusMarke status={e.status} text={e.statusText} />
              </div>
              <h3>{e.titel}</h3>
              <p className="eintrag-text">{e.beschreibung}</p>
              {e.oeffentlicheAntwort && (
                <div className="antwort">
                  <span className="antwort-titel">Antwort</span>
                  <p>{e.oeffentlicheAntwort}</p>
                </div>
              )}
              <p className="eintrag-fuss">
                Eingereicht am {datum(e.erstelltAm)} · zuletzt geändert am {datum(e.geaendertAm)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
