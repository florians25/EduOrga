import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MailRegular, NoteRegular, EyeOffRegular } from "@fluentui/react-icons";
import type { AdminEintrag, Status } from "../api";
import { datum } from "../api";
import { MODULE, PRIORITAETEN, STATUS, STATUS_REIHENFOLGE, TYPEN } from "../inhalt";
import { sortieren, type Sortierung, type Verschiebung } from "./Verwaltung";

const SPALTE = "spalte:";

interface Props {
  eintraege: AdminEintrag[];
  alle: AdminEintrag[];
  sortierung: Sortierung;
  onOeffnen: (id: number) => void;
  onVerschieben: (v: Verschiebung) => void;
  onMelden: (text: string) => void;
}

/** Kanban-Board: eine Spalte je Stand, Karten per Drag & Drop (Maus, Touch, Tastatur) verschieben und ordnen. */
export function Board({ eintraege, alle, sortierung, onOeffnen, onVerschieben, onMelden }: Props) {
  const [aktiv, setAktiv] = useState<AdminEintrag | null>(null);
  const sensoren = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Leertaste greift und legt ab, Eingabetaste öffnet die Karte
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );
  const spalten = useMemo(() => {
    const m = new Map<Status, AdminEintrag[]>(STATUS_REIHENFOLGE.map((s) => [s, []]));
    for (const e of eintraege) m.get(e.status)?.push(e);
    for (const [s, l] of m) m.set(s, sortieren(l, sortierung));
    return m;
  }, [eintraege, sortierung]);

  const start = (e: DragStartEvent) => setAktiv(alle.find((x) => x.id === e.active.id) ?? null);

  const ende = ({ active, over }: DragEndEvent) => {
    setAktiv(null);
    const eintrag = alle.find((x) => x.id === active.id);
    if (!eintrag || !over) return;
    const ueberId = String(over.id);
    const ueberKarte = ueberId.startsWith(SPALTE) ? null : alle.find((x) => x.id === over.id);
    const ziel = (ueberId.startsWith(SPALTE) ? ueberId.slice(SPALTE.length) : ueberKarte?.status) as Status | undefined;
    if (!ziel) return;
    if (ziel !== eintrag.status && !eintrag.nachfolger.includes(ziel)) {
      onMelden(
        `Von „${STATUS[eintrag.status]}“ nach „${STATUS[ziel]}“ ist nicht vorgesehen. Möglich: ${eintrag.nachfolger.map((s) => STATUS[s]).join(", ")}.`,
      );
      return;
    }
    // Stelle in der vollständigen Spalte (auch ausgefilterte Einträge zählen mit)
    const spalte = sortieren(alle.filter((x) => x.status === ziel), "reihenfolge");
    let index: number | undefined;
    if (sortierung === "reihenfolge") {
      if (ueberKarte && ueberKarte.id !== eintrag.id) {
        const ohne = spalte.filter((x) => x.id !== eintrag.id);
        index = ohne.findIndex((x) => x.id === ueberKarte.id);
        // innerhalb der Spalte nach unten: hinter die Zielkarte
        const alt = spalte.findIndex((x) => x.id === eintrag.id);
        const neu = spalte.findIndex((x) => x.id === ueberKarte.id);
        if (ziel === eintrag.status && alt < neu) index += 1;
      } else if (ueberKarte?.id === eintrag.id) return;
    } else if (ziel === eintrag.status) return;
    onVerschieben({ eintrag, status: ziel, index });
  };

  return (
    <DndContext sensors={sensoren} collisionDetection={closestCorners} onDragStart={start} onDragEnd={ende} onDragCancel={() => setAktiv(null)}>
      <div className="board" role="region" aria-label="Backlog als Board">
        {STATUS_REIHENFOLGE.map((s) => (
          <Spalte
            key={s}
            status={s}
            eintraege={spalten.get(s) ?? []}
            anzahl={alle.filter((x) => x.status === s).length}
            zustand={!aktiv ? "" : s === aktiv.status ? "quelle" : aktiv.nachfolger.includes(s) ? "ziel" : "gesperrt"}
            onOeffnen={onOeffnen}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>{aktiv && <Karte eintrag={aktiv} schwebend />}</DragOverlay>
    </DndContext>
  );
}

function Spalte({ status, eintraege, anzahl, zustand, onOeffnen }: { status: Status; eintraege: AdminEintrag[]; anzahl: number; zustand: string; onOeffnen: (id: number) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: SPALTE + status });
  return (
    <section className={`spalte spalte-${status} ${zustand ? "spalte-" + zustand : ""} ${isOver ? "spalte-darueber" : ""}`} aria-label={STATUS[status]}>
      <header className="spalte-kopf">
        <span className={`status-punkt punkt-${status}`} aria-hidden />
        <h2>{STATUS[status]}</h2>
        <span className="spalte-zahl">{eintraege.length === anzahl ? anzahl : `${eintraege.length}/${anzahl}`}</span>
      </header>
      <SortableContext items={eintraege.map((e) => e.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="spalte-inhalt">
          {eintraege.map((e) => (
            <SortierbareKarte key={e.id} eintrag={e} onOeffnen={onOeffnen} />
          ))}
          {eintraege.length === 0 && <p className="spalte-leer">Keine Einträge</p>}
        </div>
      </SortableContext>
    </section>
  );
}

function SortierbareKarte({ eintrag, onOeffnen }: { eintrag: AdminEintrag; onOeffnen: (id: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: eintrag.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? "karte-huelle karte-platzhalter" : "karte-huelle"}
      {...attributes}
      {...listeners}
      aria-roledescription="verschiebbare Karte"
      aria-label={`#${eintrag.id} ${eintrag.titel}`}
      onClick={() => onOeffnen(eintrag.id)}
      onKeyDown={(ev) => {
        if (ev.key === "Enter") onOeffnen(eintrag.id);
        else listeners?.onKeyDown?.(ev);
      }}
    >
      <Karte eintrag={eintrag} />
    </div>
  );
}

export function Karte({ eintrag: e, schwebend }: { eintrag: AdminEintrag; schwebend?: boolean }) {
  return (
    <article className={schwebend ? "karte karte-schwebend" : "karte"}>
      <div className="karte-kopf">
        <span className="karte-nummer">#{e.id}</span>
        <span className={`typmarke typ-${e.typ}`}>{TYPEN[e.typ]}</span>
        {e.prioritaet !== "keine" && (
          <span className={`prio prio-${e.prioritaet}`} title={`Priorität: ${PRIORITAETEN[e.prioritaet]}`}>
            {PRIORITAETEN[e.prioritaet]}
          </span>
        )}
      </div>
      <h3 className="karte-titel">{e.titel}</h3>
      <div className="karte-modul">{MODULE[e.modul] ?? e.modul}</div>
      {e.tags.length > 0 && (
        <div className="karte-tags">
          {e.tags.slice(0, 4).map((t) => (
            <span key={t} className="schlagwort">
              {t}
            </span>
          ))}
          {e.tags.length > 4 && <span className="schlagwort">+{e.tags.length - 4}</span>}
        </div>
      )}
      <div className="karte-fuss">
        <span>{datum(e.erstelltAm)}</span>
        <span className="karte-symbole">
          {!e.oeffentlich && <EyeOffRegular title="Nicht öffentlich" />}
          {e.interneNotiz && <NoteRegular title="Interne Notiz vorhanden" />}
          {e.email && <MailRegular title="E-Mail für Rückfragen vorhanden" />}
        </span>
      </div>
    </article>
  );
}
