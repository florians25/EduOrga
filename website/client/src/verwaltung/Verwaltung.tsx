import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  Tab,
  TabList,
  Toast,
  ToastTitle,
  useToastController,
} from "@fluentui/react-components";
import {
  ArrowClockwiseRegular,
  BoardRegular,
  KeyRegular,
  PersonRegular,
  SearchRegular,
  SignOutRegular,
  TextBulletListLtrRegular,
} from "@fluentui/react-icons";
import { ApiFehler, api, type AdminEintrag, type Prioritaet, type Status, type Typ } from "../api";
import { Marke } from "../bausteine/Rahmen";
import { TOASTER } from "../bausteine/meldungen";
import { MODULE, PRIORITAETEN, PRIORITAET_RANG, TYPEN } from "../inhalt";
import { Board } from "./Board";
import { Liste } from "./Liste";
import { Detail } from "./Detail";
import { AblehnenDialog } from "./AblehnenDialog";

export type Sortierung = "reihenfolge" | "prioritaet" | "neueste" | "geaendert";
export const SORTIERUNGEN: Record<Sortierung, string> = {
  reihenfolge: "Eigene Reihenfolge",
  prioritaet: "Priorität",
  neueste: "Neueste zuerst",
  geaendert: "Zuletzt geändert",
};

export function sortieren(liste: AdminEintrag[], s: Sortierung): AdminEintrag[] {
  const l = [...liste];
  switch (s) {
    case "prioritaet":
      return l.sort((a, b) => PRIORITAET_RANG[a.prioritaet] - PRIORITAET_RANG[b.prioritaet] || a.position - b.position);
    case "neueste":
      return l.sort((a, b) => b.erstelltAm.localeCompare(a.erstelltAm));
    case "geaendert":
      return l.sort((a, b) => b.geaendertAm.localeCompare(a.geaendertAm));
    default:
      return l.sort((a, b) => a.position - b.position || a.id - b.id);
  }
}

function lesen(schluessel: string, standard: string) {
  try {
    return window.localStorage.getItem(schluessel) ?? standard;
  } catch {
    return standard;
  }
}
function merken(schluessel: string, wert: string) {
  try {
    window.localStorage.setItem(schluessel, wert);
  } catch {
    /* ohne Speicher */
  }
}

/** Verwaltungsbereich: Anmeldung, dann Backlog als Board oder Liste. */
export function Verwaltung() {
  const [benutzer, setBenutzer] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    document.title = "Verwaltung – EduOrga";
    api<{ benutzer: string }>("/api/admin/ich")
      .then((r) => setBenutzer(r.benutzer))
      .catch(() => setBenutzer(null));
    return () => {
      document.title = "EduOrga – Einfach mehr Schulalltag.";
    };
  }, []);

  if (benutzer === undefined) return <div className="verwaltung-laden"><Spinner label="Wird geladen" /></div>;
  if (benutzer === null) return <Anmeldung onAngemeldet={setBenutzer} />;
  return <Arbeitsbereich benutzer={benutzer} onAbgemeldet={() => setBenutzer(null)} />;
}

function Anmeldung({ onAngemeldet }: { onAngemeldet: (b: string) => void }) {
  const [name, setName] = useState("admin");
  const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const anmelden = async (e: FormEvent) => {
    e.preventDefault();
    setLaeuft(true);
    setFehler(null);
    try {
      const r = await api<{ benutzer: string }>("/api/admin/anmelden", { methode: "POST", daten: { benutzer: name, passwort } });
      onAngemeldet(r.benutzer);
    } catch (x) {
      setFehler(x instanceof Error ? x.message : "Anmeldung fehlgeschlagen.");
    } finally {
      setLaeuft(false);
    }
  };
  return (
    <div className="anmeldung">
      <form className="anmeldung-kasten" onSubmit={anmelden}>
        <Marke />
        <h1>Verwaltung des Ideenportals</h1>
        {fehler && (
          <MessageBar intent="error">
            <MessageBarBody>{fehler}</MessageBarBody>
          </MessageBar>
        )}
        <Field label="Benutzername" required>
          <Input value={name} onChange={(_, d) => setName(d.value)} autoComplete="username" />
        </Field>
        <Field label="Passwort" required>
          <Input type="password" value={passwort} onChange={(_, d) => setPasswort(d.value)} autoComplete="current-password" autoFocus />
        </Field>
        <Button type="submit" appearance="primary" disabled={laeuft || !passwort}>
          Anmelden
        </Button>
        <Link to="/" className="anmeldung-zurueck">
          Zur Website
        </Link>
      </form>
    </div>
  );
}

export interface Verschiebung {
  eintrag: AdminEintrag;
  status: Status;
  index?: number;
}

function Arbeitsbereich({ benutzer, onAbgemeldet }: { benutzer: string; onAbgemeldet: () => void }) {
  const { dispatchToast } = useToastController(TOASTER);
  const melden = useCallback(
    (text: string, intent: "success" | "error" | "info" = "error") =>
      dispatchToast(
        <Toast>
          <ToastTitle>{text}</ToastTitle>
        </Toast>,
        { intent, timeout: intent === "error" ? 6000 : 3000 },
      ),
    [dispatchToast],
  );

  const [eintraege, setEintraege] = useState<AdminEintrag[] | null>(null);
  const [ansicht, setAnsicht] = useState<"board" | "liste">(() => (lesen("edo.ansicht", "board") === "liste" ? "liste" : "board"));
  const [suche, setSuche] = useState("");
  const [modul, setModul] = useState("");
  const [typ, setTyp] = useState("");
  const [prio, setPrio] = useState("");
  const [tag, setTag] = useState("");
  const [sortierung, setSortierung] = useState<Sortierung>("reihenfolge");
  const [offen, setOffen] = useState<number | null>(null);
  const [ablehnen, setAblehnen] = useState<Verschiebung | null>(null);
  const [passwortOffen, setPasswortOffen] = useState(false);

  const laden = useCallback(async () => {
    try {
      setEintraege(await api<AdminEintrag[]>("/api/admin/eintraege"));
    } catch (e) {
      if (e instanceof ApiFehler && e.status === 401) onAbgemeldet();
      else melden(e instanceof Error ? e.message : "Laden fehlgeschlagen.");
    }
  }, [melden, onAbgemeldet]);
  useEffect(() => {
    void laden();
  }, [laden]);

  const ersetzen = (e: AdminEintrag) => setEintraege((alt) => (alt ?? []).map((x) => (x.id === e.id ? e : x)));

  const alleTags = useMemo(() => [...new Set((eintraege ?? []).flatMap((e) => e.tags))].sort(), [eintraege]);
  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return (eintraege ?? []).filter(
      (e) =>
        (!modul || e.modul === modul) &&
        (!typ || e.typ === typ) &&
        (!prio || e.prioritaet === prio) &&
        (!tag || e.tags.includes(tag)) &&
        (!q ||
          `#${e.id}` === q ||
          e.titel.toLowerCase().includes(q) ||
          e.beschreibung.toLowerCase().includes(q) ||
          e.interneNotiz.toLowerCase().includes(q) ||
          e.tags.some((t) => t.includes(q))),
    );
  }, [eintraege, suche, modul, typ, prio, tag]);

  /** Verschieben mit sofortiger Anzeige; bei Fehler wird neu geladen. */
  const verschieben = async (v: Verschiebung, begruendung?: string) => {
    if (v.status === "abgelehnt" && v.eintrag.status !== "abgelehnt" && begruendung === undefined) {
      setAblehnen(v);
      return;
    }
    setEintraege((alt) => {
      if (!alt) return alt;
      const spalte = sortieren(alt.filter((x) => x.status === v.status && x.id !== v.eintrag.id), "reihenfolge");
      const stelle = Math.min(Math.max(v.index ?? spalte.length, 0), spalte.length);
      spalte.splice(stelle, 0, { ...v.eintrag, status: v.status });
      const neu = new Map(spalte.map((x, i) => [x.id, { ...x, position: i + 1 }]));
      return alt.map((x) => neu.get(x.id) ?? x);
    });
    try {
      const r = await api<AdminEintrag>(`/api/admin/eintraege/${v.eintrag.id}/verschieben`, {
        methode: "POST",
        daten: { status: v.status, index: v.index, begruendung },
      });
      ersetzen(r);
    } catch (e) {
      melden(e instanceof Error ? e.message : "Verschieben fehlgeschlagen.");
      await laden();
    }
  };

  const abmelden = async () => {
    await api("/api/admin/abmelden", { methode: "POST" }).catch(() => undefined);
    onAbgemeldet();
  };

  const offenerEintrag = eintraege?.find((e) => e.id === offen) ?? null;
  const filterAktiv = !!(suche || modul || typ || prio || tag);

  return (
    <div className="verwaltung">
      <header className="vkopf">
        <Link to="/" className="vkopf-marke" aria-label="Zur Website">
          <Marke />
        </Link>
        <span className="vkopf-titel">Ideenportal · Backlog</span>
        <span className="vkopf-luecke" />
        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <Button appearance="subtle" icon={<PersonRegular />}>
              {benutzer}
            </Button>
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              <MenuItem icon={<KeyRegular />} onClick={() => setPasswortOffen(true)}>
                Passwort ändern
              </MenuItem>
              <MenuItem icon={<SignOutRegular />} onClick={abmelden}>
                Abmelden
              </MenuItem>
            </MenuList>
          </MenuPopover>
        </Menu>
      </header>

      <div className="werkzeuge">
        <TabList
          size="small"
          selectedValue={ansicht}
          onTabSelect={(_, d) => {
            const a = d.value === "liste" ? "liste" : "board";
            setAnsicht(a);
            merken("edo.ansicht", a);
          }}
        >
          <Tab value="board" icon={<BoardRegular />}>
            Board
          </Tab>
          <Tab value="liste" icon={<TextBulletListLtrRegular />}>
            Liste
          </Tab>
        </TabList>
        <Input
          className="werkzeuge-suche"
          contentBefore={<SearchRegular />}
          placeholder="Suchen (Titel, Text, Notiz, #Nummer)"
          value={suche}
          onChange={(_, d) => setSuche(d.value)}
          aria-label="Suchen"
        />
        <Auswahl leer="Alle Bereiche" wert={modul} setzen={setModul} optionen={MODULE} />
        <Auswahl leer="Alle Arten" wert={typ} setzen={setTyp} optionen={TYPEN as Record<Typ, string>} />
        <Auswahl leer="Alle Prioritäten" wert={prio} setzen={setPrio} optionen={PRIORITAETEN as Record<Prioritaet, string>} />
        <Auswahl leer="Alle Schlagwörter" wert={tag} setzen={setTag} optionen={Object.fromEntries(alleTags.map((t) => [t, t]))} />
        <Dropdown
          aria-label="Sortierung"
          className="werkzeuge-auswahl"
          value={`Sortierung: ${SORTIERUNGEN[sortierung]}`}
          selectedOptions={[sortierung]}
          onOptionSelect={(_, d) => setSortierung((d.optionValue as Sortierung) ?? "reihenfolge")}
        >
          {Object.entries(SORTIERUNGEN).map(([k, v]) => (
            <Option key={k} value={k}>
              {v}
            </Option>
          ))}
        </Dropdown>
        {filterAktiv && (
          <Button
            appearance="subtle"
            onClick={() => {
              setSuche("");
              setModul("");
              setTyp("");
              setPrio("");
              setTag("");
            }}
          >
            Filter zurücksetzen
          </Button>
        )}
        <span className="werkzeuge-luecke" />
        <span className="werkzeuge-zahl">
          {eintraege ? (filterAktiv ? `${gefiltert.length} von ${eintraege.length}` : `${eintraege.length} Einträge`) : ""}
        </span>
        <Button appearance="subtle" icon={<ArrowClockwiseRegular />} onClick={() => void laden()} aria-label="Neu laden" title="Neu laden" />
      </div>

      {!eintraege ? (
        <div className="verwaltung-laden">
          <Spinner label="Einträge werden geladen" />
        </div>
      ) : ansicht === "board" ? (
        <Board eintraege={gefiltert} alle={eintraege} sortierung={sortierung} onOeffnen={setOffen} onVerschieben={verschieben} onMelden={melden} />
      ) : (
        <Liste eintraege={gefiltert} onOeffnen={setOffen} />
      )}

      {offenerEintrag && (
        <Detail
          key={offenerEintrag.id}
          eintrag={offenerEintrag}
          onSchliessen={() => setOffen(null)}
          onGeaendert={ersetzen}
          onGeloescht={(id) => {
            setEintraege((alt) => (alt ?? []).filter((x) => x.id !== id));
            setOffen(null);
            melden(`#${id} gelöscht.`, "success");
          }}
          onVerschieben={(status, begruendung) => verschieben({ eintrag: offenerEintrag, status }, begruendung)}
          onMelden={melden}
        />
      )}
      <AblehnenDialog
        eintrag={ablehnen?.eintrag ?? null}
        onAbbrechen={() => setAblehnen(null)}
        onAblehnen={(grund) => {
          const v = ablehnen;
          setAblehnen(null);
          if (v) void verschieben(v, grund);
        }}
      />
      <PasswortDialog offen={passwortOffen} onSchliessen={() => setPasswortOffen(false)} onMelden={melden} />
    </div>
  );
}

function Auswahl({ leer, wert, setzen, optionen }: { leer: string; wert: string; setzen: (v: string) => void; optionen: Record<string, string> }) {
  return (
    <Dropdown
      aria-label={leer}
      className="werkzeuge-auswahl"
      value={wert ? optionen[wert] ?? wert : leer}
      selectedOptions={[wert]}
      onOptionSelect={(_, d) => setzen(d.optionValue ?? "")}
    >
      <Option value="">{leer}</Option>
      {Object.entries(optionen).map(([k, v]) => (
        <Option key={k} value={k}>
          {v}
        </Option>
      ))}
    </Dropdown>
  );
}

function PasswortDialog({ offen, onSchliessen, onMelden }: { offen: boolean; onSchliessen: () => void; onMelden: (t: string, i?: "success" | "error") => void }) {
  const [bisher, setBisher] = useState("");
  const [neu, setNeu] = useState("");
  const [wdh, setWdh] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const speichern = async (e: FormEvent) => {
    e.preventDefault();
    if (neu !== wdh) return setFehler("Die neuen Passwörter stimmen nicht überein.");
    try {
      await api("/api/admin/passwort", { methode: "POST", daten: { bisher, neu } });
      onMelden("Passwort geändert.", "success");
      setBisher("");
      setNeu("");
      setWdh("");
      setFehler(null);
      onSchliessen();
    } catch (x) {
      setFehler(x instanceof Error ? x.message : "Fehler");
    }
  };
  return (
    <Dialog open={offen} onOpenChange={(_, d) => !d.open && onSchliessen()}>
      <DialogSurface>
        <form onSubmit={speichern}>
          <DialogBody>
            <DialogTitle>Passwort ändern</DialogTitle>
            <DialogContent className="dialog-felder">
              {fehler && (
                <MessageBar intent="error">
                  <MessageBarBody>{fehler}</MessageBarBody>
                </MessageBar>
              )}
              <Field label="Bisheriges Passwort" required>
                <Input type="password" value={bisher} onChange={(_, d) => setBisher(d.value)} autoComplete="current-password" />
              </Field>
              <Field label="Neues Passwort" required hint="Mindestens 8 Zeichen">
                <Input type="password" value={neu} onChange={(_, d) => setNeu(d.value)} autoComplete="new-password" />
              </Field>
              <Field label="Neues Passwort wiederholen" required>
                <Input type="password" value={wdh} onChange={(_, d) => setWdh(d.value)} autoComplete="new-password" />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button onClick={onSchliessen}>Abbrechen</Button>
              <Button type="submit" appearance="primary" disabled={!bisher || neu.length < 8}>
                Speichern
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}
