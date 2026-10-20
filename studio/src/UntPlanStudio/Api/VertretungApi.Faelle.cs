using System.Security.Claims;
using UntPlan.Core;
using UntPlan.Core.Model;
using UntPlan.Core.Vertretungsplanung;
using UntPlanStudio.Dienste;
using UntPlanStudio.Grundlagen;

namespace UntPlanStudio.Api;

public sealed record FallVorschlaegeAnfrage(DateOnly Datum);

/// <summary>
/// „Fall für Fall“ (Standardansicht der Tagesplanung): die Arbeit des Tages als Fälle. Ein Fall ist eine Stunde bzw. ein Block
/// (Doppelstunde: aufeinanderfolgende Stunden desselben Unterrichts und derselben fehlenden Lehrkraft) – unabhängig davon, ob er
/// schon gelöst ist, damit sich die Liste beim Lösen nicht umordnet. Dazu die Kandidaten für den ganzen Block mit Begründung in
/// Worten und Vorschläge für alle offenen Fälle (Probe auf einer Kopie, blockweise, nichts wird geändert). Die Regeln stammen
/// unverändert aus dem Vertretungsvorschlag (<see cref="VertretungsVorschlag"/>).
/// </summary>
public sealed partial class VertretungApi
{
    private static void FaelleRegistrieren(RouteGroupBuilder g)
    {
        g.MapGet("/tagesablauf/faelle", (Arbeitsdokument a, DateOnly datum) => a.LesenAsync(doc => Faelle(doc, datum)));
        g.MapGet("/tagesablauf/fallkandidaten", (Arbeitsdokument a, string ids, int? anzahl) => a.LesenAsync(doc =>
        {
            var menge = IdListe(ids, 12);
            return FallKandidaten(doc.Daten, doc.Index, doc.Daten.Vertretungen.Where(v => menge.Contains(v.Id)).ToList(), Math.Clamp(anzahl ?? 5, 1, 40));
        }));
        // Verlegen: Stunden der Klasse, die sich in die Lücke vorziehen lassen (alle Möglichkeiten; Randstunden zuerst – dann entsteht keine neue Lücke)
        g.MapGet("/tagesablauf/fallverlegungen", (Arbeitsdokument a, int id) => a.LesenAsync(doc =>
        {
            var d = doc.Daten;
            var v = d.Vertretungen.FirstOrDefault(x => x.Id == id) ?? throw StudioFehler.NichtGefunden($"Die Vertretung Nr. {id}");
            if (!v.Offen || v.Art == VertretungsArt.Pausenaufsicht) return new List<object>();
            return VertretungsVorschlag.Vorziehungen(d, v, VorziehungsModus.AlleVerlegungen)
                .OrderBy(x => x.Datum == v.Datum ? 0 : 1).ThenBy(x => x.Randstunde ? 0 : 1).ThenBy(x => x.Datum).ThenByDescending(x => x.Stunde).Take(12)
                .Select(vz => (object)new
                {
                    lehrer = vz.Lehrer, tag = $"{VertretungPlan.TagKurz(vz.Datum)} {vz.Datum.Day}.{vz.Datum.Month}.", datum = vz.Datum, stunde = vz.Stunde, klassen = vz.Klassen,
                    fach = vz.Fach, raum = vz.Raum, art = vz.Randstunde ? "Randstunde" : "erzeugt neue Lücke", beschreibung = vz.Beschreibung, u = vz.Eintrag.Unterricht?.Id,
                }).ToList();
        }));
        g.MapPost("/tagesablauf/fallvorschlaege", (Arbeitsdokument a, FallVorschlaegeAnfrage z, ClaimsPrincipal p) => a.LesenAsync(doc => FallVorschlaege(doc, z.Datum, B(p))));
    }

    private static HashSet<int> IdListe(string ids, int hoechstens) =>
        ids.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(x => int.TryParse(x, out var n) ? n : 0).Where(n => n > 0).Distinct().Take(hoechstens).ToHashSet();

    /// <summary>Gehört die Vertretung zur Arbeit des Tages? Offen bzw. Raum offen, oder sie ersetzt Unterricht einer abwesenden Lehrkraft
    /// (auch nach dem Lösen – der Fall bleibt stehen), oder ein gelöster Raumbedarf.</summary>
    private static bool IstFallzeile(Schuldatei d, Vertretung v)
    {
        if (v.Art is VertretungsArt.Unterricht or VertretungsArt.Freisetzung or VertretungsArt.BereitschaftEntfaellt) return false;
        if (v.OffenOderRaumOffen && !v.Fixiert) return true;
        if (v.Art == VertretungsArt.Veranstaltung) return false;
        if (v.Art == VertretungsArt.Raumvertretung && v.Bearbeitet) return true;
        // Verlegungen (Ziel und Herkunft) sind Änderungen im Plan, keine Fälle – auch die Vorziehung einer anderen Stunde in die Lücke
        return v.LehrerId is int l && v.Art is not (VertretungsArt.Verlegung or VertretungsArt.Tausch) && Absenzen.LehrerAbwesend(d, l, v.Datum, v.Stunde);
    }

    /// <summary>Ergebnis einer Fallzeile in Worten („SRO“, „Entfall“, „mit ERN zusammengelegt“, „ohne Lehrkraft“ …).</summary>
    private static string FallErgebnis(Schuldatei d, DatenIndex ix, Vertretung v)
    {
        if (v.Offen) return "";
        if (v.RaumOffen) return "Raum fehlt";
        if (v.IstEntfall && v.Text == "Vorziehung")
            return d.Vertretungen.FirstOrDefault(x => x.Datum == v.Datum && x.Stunde == v.Stunde && x.Art == VertretungsArt.Verlegung && x.VonStunde.HasValue && x.KlassenIds.Intersect(v.KlassenIds).Any()) is { } z
                ? $"{ix.KFach(z.FachId)} aus der {(z.VonDatum is DateOnly vd && vd != v.Datum ? $"{VertretungPlan.TagKurz(vd)} " : "")}{z.VonStunde}. vorgezogen" : "vorgezogen";
        if (v.IstEntfall) return "Entfall";
        if (v.Art is VertretungsArt.VertretungOhneLehrer) return "ohne Lehrkraft";
        if (v.Art is VertretungsArt.EigenverantwortlichesArbeiten) return "EVA";
        if (v.VertreterId is int l && v.Mitbetreuung) return $"zusammengelegt, {ix.KLehrer(l)} betreut";
        return Ergebnis(d, ix, v);
    }

    /// <summary>Schlüssel eines Falls: Unterricht, Kopplungszeile, fehlende Lehrkraft und Klassen (Pausenaufsicht: Gang, Lehrkraft, Pause).</summary>
    private static string FallSchluessel(Vertretung v) => v.Art == VertretungsArt.Pausenaufsicht
        ? $"p:{v.GangId}:{v.LehrerId}:{v.Stunde}:{v.Id}"
        : v.UnterrichtId is int u ? $"u:{u}:{v.ZeilenIndex}:{v.LehrerId}:{string.Join(".", v.KlassenIds.OrderBy(x => x))}" : $"v:{v.Id}";

    /// <summary>Fälle des Tages: aufeinanderfolgende Stunden mit gleichem Schlüssel – unabhängig vom Stand, damit ein Block beim Lösen
    /// einzelner Stunden zusammenbleibt und die Liste sich nicht umordnet.</summary>
    internal static List<(string Schluessel, List<Vertretung> Zeilen)> FallGruppen(Schuldatei d, DateOnly datum)
    {
        var zeilen = d.Vertretungen.Where(v => v.Datum == datum && IstFallzeile(d, v)).OrderBy(v => v.Stunde).ThenBy(v => v.Id).ToList();
        var gruppen = new List<(string, List<Vertretung>)>();
        foreach (var gr in zeilen.GroupBy(FallSchluessel))
        {
            List<Vertretung>? lauf = null;
            foreach (var v in gr.OrderBy(x => x.Stunde).ThenBy(x => x.Id))
            {
                if (lauf is not null && v.Art != VertretungsArt.Pausenaufsicht && (v.Stunde == lauf[^1].Stunde + 1 || v.Stunde == lauf[^1].Stunde)) lauf.Add(v);
                else gruppen.Add(($"{gr.Key}:{v.Stunde}", lauf = new List<Vertretung> { v }));
            }
        }
        return gruppen.OrderBy(x => x.Item2[0].Stunde).ThenBy(x => x.Item2[0].Id).ToList();
    }

    internal static object Faelle(Dokument doc, DateOnly datum)
    {
        var d = doc.Daten;
        var ix = doc.Index;
        var stunden = d.Zeitraster.Zeiten.Select(z => z.Nr).Where(n => n >= 1).OrderBy(n => n).ToList();
        if (stunden.Count == 0) stunden = Enumerable.Range(1, d.Zeitraster.StundenProTag).ToList();
        var unterrichtstag = Kalender.IstUnterrichtstag(d, datum);
        var gruppen = FallGruppen(d, datum);
        var faelle = gruppen.Select(gr =>
        {
            var (schluessel, l) = gr;
            var v = l[0];
            var pause = v.Art == VertretungsArt.Pausenaufsicht;
            var offen = l.Where(x => x.OffenOderRaumOffen && !x.Fixiert).ToList();
            var std = l.Select(x => x.Stunde).Distinct().OrderBy(x => x).ToList();
            var klausur = !pause && l.Any(x => Klausuraufsicht(d, x));
            var teile = l.Select(x => new
            {
                id = x.Id, stunde = x.Stunde, offen = x.Offen, raumOffen = x.RaumOffen, ergebnis = FallErgebnis(d, ix, x), entfall = x.IstEntfall,
                vertreter = x.VertreterId, fix = x.Fixiert, text = x.Text,
            }).ToList();
            var ergebnisse = teile.Where(t => !t.offen && !t.raumOffen).Select(t => t.ergebnis).Distinct().ToList();
            var grund = v.GrundId is int gid ? ix.K(ElementTyp.Abwesenheitsgrund, gid) : v.Grund;
            if (v.LehrerId is int lid && grund.Length == 0 && Absenzen.Lehrer(d, lid, datum, v.Stunde) is { GrundId: int ag }) grund = ix.K(ElementTyp.Abwesenheitsgrund, ag);
            var grundLang = v.LehrerId is int lg && Absenzen.Lehrer(d, lg, datum, v.Stunde) is { GrundId: int gl } && d.Abwesenheitsgruende.FirstOrDefault(x => x.Id == gl) is { } ga ? ga.Langname : "";
            return new
            {
                schluessel, ids = l.Select(x => x.Id).ToList(), offeneIds = offen.Select(x => x.Id).ToList(),
                klassenIds = v.NeueKlassenIds, klassen = ix.KKlassen(v.NeueKlassenIds), stunden = std, zeit = std.Count > 1 ? $"{Zeit(d, std[0]).Split('–')[0]}–{Zeit(d, std[^1]).Split('–').Last()}" : Zeit(d, std[0]),
                fach = pause ? "Aufsicht" : ix.KFach(v.FachId), fachLang = pause ? $"Pausenaufsicht {ix.K(ElementTyp.Gang, v.GangId)}" : v.FachId is int f && ix.Faecher.GetValueOrDefault(f) is { } fa ? fa.Langname : "",
                lehrer = ix.KLehrer(v.LehrerId), lehrerId = v.LehrerId, lehrerName = v.LehrerId is int ln && ix.Lehrer.GetValueOrDefault(ln) is { } le ? le.VollerName : "",
                raum = pause ? ix.K(ElementTyp.Gang, v.GangId) : ix.KRaum(v.VertretungsraumId ?? v.RaumId), raumId = v.VertretungsraumId ?? v.RaumId,
                unterricht = v.UnterrichtId, pause, klausur, veranstaltung = v.Art == VertretungsArt.Veranstaltung || v.VeranstaltungOffen, grund, grundLang,
                zustand = offen.Count == 0 ? "erledigt" : offen.Count < l.Count ? "teilweise" : "offen",
                ergebnis = ergebnisse.Count == 1 && offen.Count == 0 ? ergebnisse[0] : string.Join(" · ", teile.Select(t => $"{t.stunde}. {(t.offen || t.raumOffen ? "offen" : t.ergebnis)}")),
                teile, text = string.Join(" ", l.Select(x => x.Text).Where(x => x.Length > 0 && x != "Vorziehung").Distinct()),
            };
        }).OrderBy(x => x.stunden[0]).ThenBy(x => x.klassen, StringComparer.Ordinal).ToList();

        // abwesende Lehrkräfte des Tages (Liste „nach Lehrkraft“) und Klassen mit Fällen in fester Reihenfolge (Jahrgang, Name)
        var abwesend = d.Abwesenheiten.Where(x => x.Art == AbwesenheitsArt.Lehrer && x.Von <= datum && x.Bis >= datum)
            .GroupBy(x => x.ElementId).Select(gr =>
            {
                var x = gr.OrderBy(y => y.StundeVon).First();
                var l = ix.Lehrer.GetValueOrDefault(gr.Key);
                var von = x.Von == datum ? x.StundeVon : 1;
                var bis = gr.Max(y => y.Bis == datum ? y.StundeBis : 99);
                return new
                {
                    id = gr.Key, k = l?.Kurzname ?? "?", name = l?.VollerName ?? "", grund = x.GrundId is int g ? ix.K(ElementTyp.Abwesenheitsgrund, g) : "",
                    zeit = von <= 1 && bis >= stunden[^1] ? "ganztägig" : bis >= stunden[^1] ? $"ab {von}. Std." : $"{von}.–{bis}. Std.", text = x.Text,
                };
            }).OrderBy(x => x.k, StringComparer.OrdinalIgnoreCase).ToList();
        var mitFall = faelle.SelectMany(f => f.klassenIds).ToHashSet();
        var klassen = d.Klassen.Where(k => !k.Ignorieren && mitFall.Contains(k.Id))
            .OrderBy(k => Nrw.JahrgangRang(k.Jahrgang)).ThenBy(k => System.Text.RegularExpressions.Regex.Replace(k.Kurzname, @"\d+", m => m.Value.PadLeft(4, '0')), StringComparer.OrdinalIgnoreCase)
            .Select(k => new { id = k.Id, k = k.Kurzname, name = k.Langname, jahrgang = k.Jahrgang, leitung = string.Join(", ", k.KlassenlehrerIds.Select(ix.KLehrer)) }).ToList();
        return new
        {
            datum, unterrichtstag, frei = unterrichtstag ? "" : Kalender.FreiBezeichnung(d, datum),
            stunden = stunden.Select(s => new { nr = s, zeit = Zeit(d, s) }).ToList(),
            klassen, abwesend, faelle,
        };
    }

    /// <summary>Gründe eines Kandidaten in Worten, wichtigste zuerst („frei 1.–2.“, „Bereitschaft“, „unterrichtet die 5a“, „Fach Englisch“, „heute 1 Vertretung“).</summary>
    private static List<string> KandidatGruende(Schuldatei d, DatenIndex ix, Kandidat k, IReadOnlyList<Vertretung> stunden, int heute)
    {
        var v = stunden[0];
        var std = stunden.Select(x => x.Stunde).Distinct().OrderBy(x => x).ToList();
        var res = new List<string>();
        if (std.Count > 1) res.Add($"frei {std[0]}.–{std[^1]}.");
        if (k.Freigesetzt) res.Add("freigesetzt");
        else if (k.Bereitschaft) res.Add("Bereitschaft");
        else res.Add(k.Lage switch
        {
            "Hohlstunde" => "Freistunde",
            "anschließend" => "schließt an Unterricht an",
            "sonst frei" => "heute sonst kein Unterricht",
            var x when x.StartsWith("Abstand ") => $"{x[8..]} Std. Abstand",
            _ => k.Lage,
        });
        var klassen = ix.KKlassen(v.NeueKlassenIds);
        if (k.Klassenlehrer) res.Add($"Klassenleitung {klassen}");
        else if (k.KenntKlasse) res.Add($"unterrichtet die {klassen}");
        if (k.Fachlehrer && v.FachId is int f) res.Add($"Fach {(ix.Faecher.GetValueOrDefault(f)?.Langname is { Length: > 0 } fl ? fl : ix.KFach(f))}");
        if (heute > 0) res.Add(heute == 1 ? "heute schon 1 Vertretung" : $"heute schon {heute} Vertretungen");
        if (k.Kriterien.Contains("Maximum erreicht")) res.Add("Höchstzahl erreicht");
        if (k.Zeitwunsch < 0) res.Add(k.Zeitwunsch <= -3 ? "Zeitwunsch: gesperrt" : "Zeitwunsch: lieber nicht");
        if (k.Kriterien.Contains("Std./Tag überschritten")) res.Add("mehr Stunden als gewünscht");
        if (k.Disloziert) res.Add("anderes Gebäude");
        return res;
    }

    /// <summary>
    /// Kandidaten, die in allen Stunden des Falls frei sind: eine Stunde bzw. der Block des Vorschlags (<see cref="VertretungsVorschlag.Block"/>,
    /// wenn er genau diese Stunden umfasst), sonst die Schnittmenge der Vorschläge je Stunde nach der Summe der Schlechtpunkte.
    /// </summary>
    internal static List<(Kandidat K, bool Rot, double Punkte)> FallReihung(Schuldatei d, IReadOnlyList<Vertretung> liste)
    {
        if (liste.Count == 0) return new();
        var erste = liste[0];
        if (liste.Count == 1) return VertretungsVorschlag.Berechnen(d, erste).Select(k => (k, k.Rot, k.Punkte)).ToList();
        var block = VertretungsVorschlag.Block(d, erste).Select(x => x.Id).ToHashSet();
        if (block.SetEquals(liste.Select(x => x.Id))) return VertretungsVorschlag.Berechnen(d, erste, true).Select(k => (k, k.Rot, k.Punkte)).ToList();
        var je = liste.Select(v => VertretungsVorschlag.Berechnen(d, v).ToDictionary(k => k.Lehrer.Id)).ToList();
        return je[0].Keys.Where(l => je.All(x => x.ContainsKey(l)))
            .Select(l => (je[0][l], je.Any(x => x[l].Rot), je.Sum(x => x[l].Punkte)))
            .OrderBy(x => x.Item3).ThenBy(x => x.Item1.Lehrer.Kurzname).ToList();
    }

    internal static object FallKandidaten(Schuldatei d, DatenIndex ix, List<Vertretung> alle, int anzahl)
    {
        var liste = alle.Where(v => v.Offen && v.Art != VertretungsArt.Pausenaufsicht).OrderBy(v => v.Stunde).ToList();
        var pausen = alle.Where(v => v.Offen && v.Art == VertretungsArt.Pausenaufsicht).ToList();
        if (liste.Count == 0 && pausen.Count > 0)
        {
            var v = pausen[0];
            var pa = new Pausenaufsicht { GangId = v.GangId ?? 0, Tag = Kalender.TagIndex(d, v.Datum), NachStunde = v.Stunde, LehrerId = v.LehrerId ?? 0 };
            var pk = UntPlan.Core.Module.Pausenaufsichten.Kandidaten(d, v.Datum, pa);
            return new
            {
                ids = new[] { v.Id }, kandidaten = pk.Take(anzahl).Select(l => new
                {
                    lehrer = l.Id, k = l.Kurzname, name = l.VollerName, rot = false,
                    gruende = new List<string> { $"frei nach der {v.Stunde}. Std.", $"{UntPlan.Core.Module.Pausenaufsichten.Anzahl(d, l.Id)} Aufsichten in der Woche" },
                }).ToList(),
                weitere = Math.Max(0, pk.Count - anzahl), betreuung = (object?)null, entfallSinnvoll = false, gleicheZeit = false,
            };
        }
        if (liste.Count == 0) return new { ids = Array.Empty<int>(), kandidaten = Array.Empty<object>(), weitere = 0, betreuung = (object?)null, entfallSinnvoll = false, gleicheZeit = false };
        var gleicheZeit = liste.GroupBy(v => v.Stunde).Any(x => x.Count() > 1);
        var reihe = gleicheZeit ? new List<(Kandidat K, bool Rot, double Punkte)>() : FallReihung(d, liste);
        // offener Platz einer Veranstaltung: wer schon teilnimmt, kommt als Ersatz nicht in Frage
        foreach (var v in liste.Where(v => v.VeranstaltungOffen && v.VeranstaltungId.HasValue))
            if (d.Veranstaltungen.FirstOrDefault(x => x.Id == v.VeranstaltungId) is { } va)
            {
                var dabei = va.LehrerAm(v.Datum).ToHashSet();
                reihe = reihe.Where(x => !dabei.Contains(x.K.Lehrer.Id)).ToList();
            }
        var datum = liste[0].Datum;
        var bet = liste.Select(v => VertretungsVorschlag.Betreuungen(d, v)).ToList();
        var gemeinsam = bet[0].FirstOrDefault(b => bet.All(x => x.Any(y => y.Lehrer.Id == b.Lehrer.Id)));
        return new
        {
            ids = liste.Select(v => v.Id).ToList(), gleicheZeit,
            kandidaten = reihe.Take(anzahl).Select(x => new
            {
                lehrer = x.K.Lehrer.Id, k = x.K.Lehrer.Kurzname, name = x.K.Lehrer.VollerName, rot = x.Rot, lage = x.K.Lage,
                gruende = KandidatGruende(d, ix, x.K, liste, Vertretungen.Zaehler(d, x.K.Lehrer.Id, datum, datum)),
                woche = x.K.ZaehlerWoche, maxWoche = x.K.Lehrer.VertretungenMaxWoche, mehrarbeit = x.K.Mehrarbeit,
            }).ToList(),
            weitere = Math.Max(0, reihe.Count - anzahl),
            betreuung = gemeinsam is null ? null : new { lehrer = gemeinsam.Lehrer.Id, k = gemeinsam.Lehrer.Kurzname, name = gemeinsam.Lehrer.VollerName, klassen = gemeinsam.Klassen, fach = gemeinsam.Fach, naehe = gemeinsam.NaeheText },
            entfallSinnvoll = liste.All(v => VertretungsVorschlag.EntfallSinnvoll(d, v)),
        };
    }

    /// <summary>
    /// Vorschläge für alle offenen Fälle des Tages: auf einer Kopie Fall für Fall (nach Uhrzeit) die beste Lehrkraft für den ganzen Block
    /// eintragen (wie die automatische Vertretung, aber blockweise), sonst Entfall, wo er sinnvoll ist. Nichts wird geändert; übernommen
    /// wird mit „/tagesablauf/anwenden“.
    /// </summary>
    internal static object FallVorschlaege(Dokument doc, DateOnly datum, string benutzer)
    {
        var d = doc.Daten;
        var ix = doc.Index;
        var probe = Dokument.VertretungsProbe(d, datum, datum);
        var res = new List<object>();
        var ohne = new List<string>();
        foreach (var (schluessel, zeilen) in FallGruppen(d, datum))
        {
            var ids = zeilen.Where(v => v.Offen && !v.Fixiert && v.Art != VertretungsArt.Pausenaufsicht).Select(v => v.Id).ToHashSet();
            var liste = probe.Vertretungen.Where(v => ids.Contains(v.Id) && v.Offen && !v.Fixiert && !v.VeranstaltungOffen).OrderBy(v => v.Stunde).ToList();
            if (liste.Count == 0) continue;
            var reihe = liste.GroupBy(v => v.Stunde).Any(x => x.Count() > 1) ? new() : FallReihung(probe, liste);
            var best = reihe.FirstOrDefault(x => !x.Rot);
            if (best.K is not null)
            {
                foreach (var v in liste) Vertretungen.VertreterSetzen(probe, v, best.K.Lehrer.Id, false, benutzer);
                res.Add(new
                {
                    schluessel, ids = liste.Select(v => v.Id).ToList(), art = "lehrer", lehrerId = (int?)best.K.Lehrer.Id, text = best.K.Lehrer.Kurzname,
                    grund = string.Join(" · ", KandidatGruende(probe, ix, best.K, liste, Vertretungen.Zaehler(d, best.K.Lehrer.Id, datum, datum)).Where(x => !x.StartsWith("frei ")).Take(3)),
                });
            }
            else if (liste.All(v => VertretungsVorschlag.EntfallSinnvoll(probe, v)))
            {
                foreach (var v in liste) Vertretungen.EntfallUmschalten(probe, v, benutzer);
                res.Add(new { schluessel, ids = liste.Select(v => v.Id).ToList(), art = "entfall", lehrerId = (int?)null, text = "Entfall", grund = "niemand frei, Randstunde" });
            }
            else ohne.Add(schluessel);
        }
        return new { datum, vorschlaege = res, ohne };
    }
}
