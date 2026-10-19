import { useEffect, useState, type KeyboardEvent } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Divider,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerHeaderTitle,
  Dropdown,
  Field,
  Input,
  OverlayDrawer,
  Option,
  Switch,
  Tag,
  TagGroup,
  Textarea,
} from "@fluentui/react-components";
import { ArrowRightRegular, DeleteRegular, DismissRegular, MailRegular, SaveRegular } from "@fluentui/react-icons";
import { api, datumZeit, type AdminEintrag, type Prioritaet, type Status, type Typ, type Verlaufseintrag } from "../api";
import { StatusMarke } from "../bausteine/Bausteine";
import { MODULE, PRIORITAETEN, STATUS, TYPEN } from "../inhalt";

interface Props {
  eintrag: AdminEintrag;
  onSchliessen: () => void;
  onGeaendert: (e: AdminEintrag) => void;
  onGeloescht: (id: number) => void;
  onVerschieben: (status: Status, begruendung?: string) => Promise<void>;
  onMelden: (text: string, intent?: "success" | "error") => void;
}

type Entwurf = Pick<AdminEintrag, "titel" | "beschreibung" | "typ" | "modul" | "prioritaet" | "tags" | "interneNotiz" | "oeffentlicheAntwort" | "oeffentlich">;

const entwurfAus = (e: AdminEintrag): Entwurf => ({
  titel: e.titel,
  beschreibung: e.beschreibung,
  typ: e.typ,
  modul: e.modul,
  prioritaet: e.prioritaet,
  tags: e.tags,
  interneNotiz: e.interneNotiz,
  oeffentlicheAntwort: e.oeffentlicheAntwort,
  oeffentlich: e.oeffentlich,
});

/** Seitenbereich mit allen Angaben eines Eintrags: bearbeiten, Stand ändern, Verlauf. */
export function Detail({ eintrag, onSchliessen, onGeaendert, onGeloescht, onVerschieben, onMelden }: Props) {
  const [entwurf, setEntwurf] = useState<Entwurf>(() => entwurfAus(eintrag));
  const [verlauf, setVerlauf] = useState<Verlaufseintrag[]>([]);
  const [neuerTag, setNeuerTag] = useState("");
  const [grund, setGrund] = useState("");
  const [ablehnenOffen, setAblehnenOffen] = useState(false);
  const [loeschenOffen, setLoeschenOffen] = useState(false);
  const [speichert, setSpeichert] = useState(false);

  const verlaufLaden = () =>
    api<{ verlauf: Verlaufseintrag[] }>(`/api/admin/eintraege/${eintrag.id}`)
      .then((r) => setVerlauf(r.verlauf))
      .catch(() => undefined);
  useEffect(() => {
    void verlaufLaden();
    // Verlauf nach jeder Änderung am Eintrag neu laden
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eintrag.geaendertAm, eintrag.status]);

  const original = entwurfAus(eintrag);
  const geaendert = (Object.keys(entwurf) as (keyof Entwurf)[]).filter((k) => JSON.stringify(entwurf[k]) !== JSON.stringify(original[k]));
  const setze = <K extends keyof Entwurf>(k: K, v: Entwurf[K]) => setEntwurf((alt) => ({ ...alt, [k]: v }));

  const speichern = async (extra: Record<string, unknown> = {}) => {
    setSpeichert(true);
    try {
      const daten: Record<string, unknown> = { ...extra };
      for (const k of geaendert) daten[k] = entwurf[k];
      const r = await api<AdminEintrag>(`/api/admin/eintraege/${eintrag.id}`, { methode: "PATCH", daten });
      onGeaendert(r);
      setEntwurf(entwurfAus(r));
      onMelden("Gespeichert.", "success");
    } catch (e) {
      onMelden(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setSpeichert(false);
    }
  };

  const tagHinzu = (ev: KeyboardEvent<HTMLInputElement>) => {
    if (ev.key !== "Enter" && ev.key !== ",") return;
    ev.preventDefault();
    const t = neuerTag.trim().toLowerCase().replace(/,/g, "");
    if (t && !entwurf.tags.includes(t)) setze("tags", [...entwurf.tags, t]);
    setNeuerTag("");
  };

  const loeschen = async () => {
    try {
      await api(`/api/admin/eintraege/${eintrag.id}`, { methode: "DELETE" });
      onGeloescht(eintrag.id);
    } catch (e) {
      onMelden(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
    }
  };

  return (
    <OverlayDrawer open position="end" size="medium" onOpenChange={(_, d) => !d.open && onSchliessen()} className="detail">
      <DrawerHeader>
        <DrawerHeaderTitle action={<Button appearance="subtle" aria-label="Schließen" icon={<DismissRegular />} onClick={onSchliessen} />}>
          <span className="detail-nummer">#{eintrag.id}</span> {eintrag.titel}
        </DrawerHeaderTitle>
        <div className="detail-meta">
          <StatusMarke status={eintrag.status} />
          <span>Eingereicht {datumZeit(eintrag.erstelltAm)}</span>
        </div>
      </DrawerHeader>
      <DrawerBody className="detail-inhalt">
        <section className="detail-abschnitt">
          <h3>Stand ändern</h3>
          <div className="detail-uebergaenge">
            {eintrag.nachfolger.map((s) => (
              <Button
                key={s}
                size="small"
                icon={<ArrowRightRegular />}
                onClick={() => (s === "abgelehnt" ? setAblehnenOffen(true) : void onVerschieben(s))}
              >
                {STATUS[s]}
              </Button>
            ))}
          </div>
          {eintrag.status === "abgelehnt" && eintrag.ablehnungsgrund && (
            <p className="detail-grund">
              <strong>Begründung der Ablehnung:</strong> {eintrag.ablehnungsgrund}
            </p>
          )}
        </section>

        <section className="detail-abschnitt detail-felder">
          <h3>Angaben</h3>
          <Field label="Titel">
            <Input value={entwurf.titel} onChange={(_, d) => setze("titel", d.value)} maxLength={140} />
          </Field>
          <Field label="Beschreibung">
            <Textarea value={entwurf.beschreibung} onChange={(_, d) => setze("beschreibung", d.value)} rows={6} resize="vertical" />
          </Field>
          <div className="feldreihe">
            <Field label="Art">
              <Dropdown value={TYPEN[entwurf.typ]} selectedOptions={[entwurf.typ]} onOptionSelect={(_, d) => setze("typ", d.optionValue as Typ)}>
                {Object.entries(TYPEN).map(([k, v]) => (
                  <Option key={k} value={k}>
                    {v}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            <Field label="Priorität">
              <Dropdown
                value={PRIORITAETEN[entwurf.prioritaet]}
                selectedOptions={[entwurf.prioritaet]}
                onOptionSelect={(_, d) => setze("prioritaet", d.optionValue as Prioritaet)}
              >
                {Object.entries(PRIORITAETEN).map(([k, v]) => (
                  <Option key={k} value={k}>
                    {v}
                  </Option>
                ))}
              </Dropdown>
            </Field>
          </div>
          <Field label="Bereich">
            <Dropdown value={MODULE[entwurf.modul] ?? entwurf.modul} selectedOptions={[entwurf.modul]} onOptionSelect={(_, d) => setze("modul", d.optionValue ?? "allgemein")}>
              {Object.entries(MODULE).map(([k, v]) => (
                <Option key={k} value={k}>
                  {v}
                </Option>
              ))}
            </Dropdown>
          </Field>
          <Field label="Schlagwörter" hint="Eingabetaste oder Komma fügt hinzu">
            <div className="tagfeld">
              {entwurf.tags.length > 0 && (
                <TagGroup onDismiss={(_, d) => setze("tags", entwurf.tags.filter((t) => t !== d.value))} aria-label="Schlagwörter">
                  {entwurf.tags.map((t) => (
                    <Tag key={t} value={t} size="small" dismissible dismissIcon={{ "aria-label": `${t} entfernen` }}>
                      {t}
                    </Tag>
                  ))}
                </TagGroup>
              )}
              <Input value={neuerTag} onChange={(_, d) => setNeuerTag(d.value)} onKeyDown={tagHinzu} placeholder="z. B. export" size="small" />
            </div>
          </Field>
        </section>

        <section className="detail-abschnitt detail-felder">
          <h3>Antwort und Notizen</h3>
          <Field label="Öffentliche Antwort" hint="Erscheint in der öffentlichen Liste, sobald der Eintrag im Backlog, in Arbeit oder erledigt ist.">
            <Textarea value={entwurf.oeffentlicheAntwort} onChange={(_, d) => setze("oeffentlicheAntwort", d.value)} rows={3} resize="vertical" />
          </Field>
          <Field label="Interne Notiz" hint="Nur in der Verwaltung sichtbar.">
            <Textarea value={entwurf.interneNotiz} onChange={(_, d) => setze("interneNotiz", d.value)} rows={4} resize="vertical" />
          </Field>
          <Switch checked={entwurf.oeffentlich} onChange={(_, d) => setze("oeffentlich", d.checked)} label="In der öffentlichen Liste zeigen" />
        </section>

        <section className="detail-abschnitt">
          <h3>Kontakt</h3>
          {eintrag.email ? (
            <div className="detail-kontakt">
              <a href={`mailto:${eintrag.email}?subject=${encodeURIComponent(`EduOrga #${eintrag.id}: ${eintrag.titel}`)}`}>
                <MailRegular aria-hidden /> {eintrag.email}
              </a>
              <Button size="small" appearance="subtle" onClick={() => void speichern({ emailEntfernen: true })}>
                E-Mail-Adresse löschen
              </Button>
            </div>
          ) : (
            <p className="detail-leer">Keine E-Mail-Adresse angegeben.</p>
          )}
        </section>

        <section className="detail-abschnitt">
          <h3>Verlauf</h3>
          <ol className="verlauf">
            {verlauf.map((v) => (
              <li key={v.id}>
                <span className="verlauf-zeit">{datumZeit(v.zeit)}</span>
                <span className="verlauf-wer">{v.benutzer}</span>
                <span className="verlauf-was">
                  <strong>{v.aktion}</strong> {v.details}
                </span>
              </li>
            ))}
          </ol>
        </section>
        <Divider />
        <Button appearance="subtle" icon={<DeleteRegular />} className="detail-loeschen" onClick={() => setLoeschenOffen(true)}>
          Eintrag löschen
        </Button>
      </DrawerBody>
      <DrawerFooter className="detail-fuss">
        <Button appearance="primary" icon={<SaveRegular />} disabled={geaendert.length === 0 || speichert} onClick={() => void speichern()}>
          Speichern
        </Button>
        <Button onClick={() => setEntwurf(original)} disabled={geaendert.length === 0}>
          Verwerfen
        </Button>
        {geaendert.length > 0 && <span className="detail-ungespeichert">Ungespeicherte Änderungen</span>}
      </DrawerFooter>

      <Dialog open={ablehnenOffen} onOpenChange={(_, d) => setAblehnenOffen(d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>#{eintrag.id} ablehnen</DialogTitle>
            <DialogContent className="dialog-felder">
              <Field label="Begründung" required>
                <Textarea value={grund} onChange={(_, d) => setGrund(d.value)} rows={4} />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setAblehnenOffen(false)}>Abbrechen</Button>
              <Button
                appearance="primary"
                disabled={!grund.trim()}
                onClick={() => {
                  setAblehnenOffen(false);
                  void onVerschieben("abgelehnt", grund.trim());
                  setGrund("");
                }}
              >
                Ablehnen
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
      <Dialog open={loeschenOffen} onOpenChange={(_, d) => setLoeschenOffen(d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>#{eintrag.id} endgültig löschen?</DialogTitle>
            <DialogContent>Der Eintrag und sein Verlauf werden gelöscht. Das lässt sich nicht rückgängig machen.</DialogContent>
            <DialogActions>
              <Button onClick={() => setLoeschenOffen(false)}>Abbrechen</Button>
              <Button appearance="primary" onClick={() => void loeschen()}>
                Löschen
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </OverlayDrawer>
  );
}
