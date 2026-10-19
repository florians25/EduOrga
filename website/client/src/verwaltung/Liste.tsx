import { useMemo, useState } from "react";
import { ArrowSortDownRegular, ArrowSortUpRegular } from "@fluentui/react-icons";
import type { AdminEintrag } from "../api";
import { datum } from "../api";
import { StatusMarke } from "../bausteine/Bausteine";
import { MODULE, PRIORITAETEN, PRIORITAET_RANG, STATUS_REIHENFOLGE, TYPEN } from "../inhalt";

type Spalte = "id" | "titel" | "typ" | "modul" | "status" | "prioritaet" | "erstelltAm" | "geaendertAm";

const SPALTEN: { id: Spalte; titel: string; klasse?: string }[] = [
  { id: "id", titel: "Nr.", klasse: "zahl" },
  { id: "titel", titel: "Titel" },
  { id: "typ", titel: "Art" },
  { id: "modul", titel: "Bereich" },
  { id: "status", titel: "Stand" },
  { id: "prioritaet", titel: "Priorität" },
  { id: "erstelltAm", titel: "Eingereicht" },
  { id: "geaendertAm", titel: "Geändert" },
];

function vergleich(a: AdminEintrag, b: AdminEintrag, s: Spalte): number {
  switch (s) {
    case "id":
      return a.id - b.id;
    case "status":
      return STATUS_REIHENFOLGE.indexOf(a.status) - STATUS_REIHENFOLGE.indexOf(b.status);
    case "prioritaet":
      return PRIORITAET_RANG[a.prioritaet] - PRIORITAET_RANG[b.prioritaet];
    case "modul":
      return (MODULE[a.modul] ?? a.modul).localeCompare(MODULE[b.modul] ?? b.modul, "de");
    default:
      return String(a[s]).localeCompare(String(b[s]), "de");
  }
}

/** Tabellenansicht mit Sortierung per Klick auf die Spaltenköpfe. */
export function Liste({ eintraege, onOeffnen }: { eintraege: AdminEintrag[]; onOeffnen: (id: number) => void }) {
  const [sort, setSort] = useState<{ spalte: Spalte; ab: boolean }>({ spalte: "id", ab: true });
  const sortiert = useMemo(() => {
    const l = [...eintraege].sort((a, b) => vergleich(a, b, sort.spalte) || a.id - b.id);
    return sort.ab ? l.reverse() : l;
  }, [eintraege, sort]);

  return (
    <div className="liste-rahmen">
      <table className="tabelle tabelle-verwaltung">
        <thead>
          <tr>
            {SPALTEN.map((s) => (
              <th key={s.id} className={s.klasse} aria-sort={sort.spalte === s.id ? (sort.ab ? "descending" : "ascending") : "none"}>
                <button type="button" className="sortierknopf" onClick={() => setSort((alt) => ({ spalte: s.id, ab: alt.spalte === s.id ? !alt.ab : false }))}>
                  {s.titel}
                  {sort.spalte === s.id && (sort.ab ? <ArrowSortDownRegular aria-hidden /> : <ArrowSortUpRegular aria-hidden />)}
                </button>
              </th>
            ))}
            <th>Schlagwörter</th>
          </tr>
        </thead>
        <tbody>
          {sortiert.map((e) => (
            <tr key={e.id} onClick={() => onOeffnen(e.id)} className="zeile-klickbar">
              <td className="zahl">#{e.id}</td>
              <td className="spalte-titel">
                <button type="button" className="zeilenlink" onClick={() => onOeffnen(e.id)}>
                  {e.titel}
                </button>
              </td>
              <td>
                <span className={`typmarke typ-${e.typ}`}>{TYPEN[e.typ]}</span>
              </td>
              <td>{MODULE[e.modul] ?? e.modul}</td>
              <td>
                <StatusMarke status={e.status} />
              </td>
              <td>{e.prioritaet === "keine" ? "–" : <span className={`prio prio-${e.prioritaet}`}>{PRIORITAETEN[e.prioritaet]}</span>}</td>
              <td>{datum(e.erstelltAm)}</td>
              <td>{datum(e.geaendertAm)}</td>
              <td>
                {e.tags.map((t) => (
                  <span key={t} className="schlagwort">
                    {t}
                  </span>
                ))}
              </td>
            </tr>
          ))}
          {sortiert.length === 0 && (
            <tr>
              <td colSpan={9} className="leer">
                Keine Einträge für diese Auswahl.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
