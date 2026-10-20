using System.Security.Claims;
using UntPlan.Core;
using UntPlan.Core.Model;
using UntPlan.Core.Planung;
using UntPlanStudio.Dienste;
using UntPlanStudio.Grundlagen;

namespace UntPlanStudio.Api;

/// <summary>Kopplungszeile des Dialogs „Neuer Unterricht“: Fach, Lehrkraft, Klassen, Raum bzw. Raumgruppe (Ids).</summary>
public sealed record NeueKopplungszeile(int? Fach, int? Lehrer, List<int>? Klassen, int? Raum = null, int? Raumgruppe = null);
/// <summary>
/// Dialog „Neuer Unterricht“: Wochenstunden, Kopplungszeilen (je Lehrkraft eine Zeile), Doppelstunden als Bereich („1-1“),
/// Blockgrößen („3“ bzw. „3,3“), Woche ("" jede, "A", "B"), Unterrichtsgruppe, Band (gleichzeitig mit anderen Unterrichten), Text.
/// </summary>
public sealed record NeuerUnterrichtDialog(int Wochenstunden, List<NeueKopplungszeile>? Zeilen, string? Doppelstunden = null, string? Block = null,
    string? Woche = null, int? UGruppe = null, string? Band = null, string? Text = null);

/// <summary>
/// Plantafel der Stundenplanung: Steckbrett (alle Klassen, Lehrkräfte oder Räume × Tage und Stunden) mit dem Vorrat der nicht
/// verplanten Blöcke, Zielstufen beim Ziehen (frei, Tausch, weich, hart) mit Gründen und das Anlegen eines Unterrichts im Dialog.
/// Verschieben, Setzen, Entplanen und Fixieren laufen über die übrigen Endpunkte unter /planung.
/// </summary>
public sealed partial class PlanungApi
{
    /// <summary>Zeilenelement des Steckbretts mit Gruppe (Jahrgang der Klasse, Abteilung der Lehrkraft, Raumart).</summary>
    private static string Gruppe(Schuldatei d, Element e) => e switch
    {
        Klasse k => k.Jahrgang.Length > 0 ? k.Jahrgang : new string(k.Kurzname.TakeWhile(char.IsDigit).ToArray()),
        Lehrer l => l.AbteilungId is int ab ? d.AlleElemente(ElementTyp.Abteilung).FirstOrDefault(x => x.Id == ab)?.Kurzname ?? "" : "",
        Raum r => r.Raumart.Length > 0 ? r.Raumart : r.Stockwerk,
        _ => "",
    };

    /// <summary>
    /// Stufe eines Zielfeldes für die Plantafel: frei (grün), tausch (Tausch mit dem Unterricht am Ziel), weich (bernstein: negativer
    /// Zeitwunsch, kein Raum frei), hart (rot: Lehrkraft, Klasse belegt, Sperrzeit −3, außerhalb des Zeitrasters), eigen (aktuelle Lage).
    /// </summary>
    internal static string Stufe(Schuldatei d, DatenIndex ix, Unterricht u, int tag, int start, int laenge, Feldstatus fs)
    {
        switch (fs)
        {
            case Feldstatus.Frei: return "frei";
            case Feldstatus.TauschMoeglich: return "tausch";
            case Feldstatus.KeinRaum: return "weich";
            case Feldstatus.VorgabeVerletzt:
                for (var j = 0; j < laenge; j++)
                {
                    var s = start + j;
                    if (!d.Zeitraster.Verfuegbar(tag, s) || u.Zeitwuensche.Gesperrt(tag, s)) return "hart";
                    if (u.LehrerIds.Any(l => ix.Lehrer.TryGetValue(l, out var le) && le.Zeitwuensche.Gesperrt(tag, s))) return "hart";
                    if (u.KlassenIds.Any(k => ix.Klassen.TryGetValue(k, out var kl) && kl.Zeitwuensche.Gesperrt(tag, s))) return "hart";
                    if (u.FachIds.Any(f => ix.Faecher.TryGetValue(f, out var fa) && fa.Zeitwuensche.Gesperrt(tag, s))) return "hart";
                }
                return "weich";
            default: return "hart";
        }
    }

    private static object Plantafel(Dokument doc, ElementTyp typ)
    {
        var d = doc.Daten;
        var ix = doc.Index;
        var unterrichte = d.Unterrichte.Where(u => !u.Ignorieren).OrderBy(u => u.Id).ToList();
        var benutzt = unterrichte.Select(u => u.Id).ToHashSet();
        return new
        {
            typ = Typnamen.Schluessel(typ),
            periode = d.AktivePeriode.Name,
            zeitraster = DokumenteApi.Zeitraster(d),
            zeilen = Stammdaten.Sortiert(d, typ).Select(e => new { id = e.Id, kurz = e.Kurzname, lang = e is Lehrer l ? l.VollerName : e.Langname, gruppe = Gruppe(d, e) }),
            namen = new
            {
                klassen = d.Klassen.ToDictionary(k => k.Id.ToString(), k => k.Kurzname),
                lehrer = d.Lehrer.ToDictionary(l => l.Id.ToString(), l => l.Kurzname),
                raeume = d.Raeume.ToDictionary(r => r.Id.ToString(), r => r.Kurzname),
            },
            unterrichte = unterrichte.Select(u =>
            {
                var fach = u.HauptfachId is int f ? ix.Faecher.GetValueOrDefault(f) : null;
                return new
                {
                    u = u.Id,
                    fach = ix.KFach(u.HauptfachId),
                    fachLang = fach?.Langname ?? "",
                    farbe = StammdatenApi.Farbe(fach?.Hintergrund ?? 0),
                    zeilen = u.Zeilen.Select(z => new
                    {
                        fach = ix.KFach(z.FachId),
                        farbe = z.FachId is int zf && ix.Faecher.TryGetValue(zf, out var zfa) ? StammdatenApi.Farbe(zfa.Hintergrund) : null,
                        lehrer = z.LehrerId,
                        klassen = z.KlassenIds,
                    }),
                    lehrer = u.LehrerIds,
                    klassen = u.KlassenIds,
                    wst = u.Wochenstunden,
                    offen = Planungsdienst.OffeneBloecke(d, ix, u),
                    text = u.Text,
                    woche = StundenplanApi.Woche(d, u),
                    band = u.Band,
                    fix = u.Fix,
                };
            }),
            stunden = d.Stundenplan.Where(p => benutzt.Contains(p.UnterrichtId)).OrderBy(p => p.UnterrichtId).ThenBy(p => p.Tag).ThenBy(p => p.Stunde)
                .Select(p => new { u = p.UnterrichtId, tag = p.Tag, stunde = p.Stunde, fix = p.Fixiert, raeume = p.Raeume.Where(r => r.HasValue).Select(r => r!.Value).Distinct() }),
        };
    }

    private static void ZeileBelegen(Schuldatei d, DatenIndex ix, Kopplungszeile z, NeueKopplungszeile n, int nr)
    {
        if (n.Fach is int f)
        {
            var fa = ix.Faecher.GetValueOrDefault(f) ?? throw StudioFehler.Ungueltig($"Zeile {nr}: Das Fach Nr. {f} gibt es nicht.");
            z.FachId = fa.Id;
            z.FachraumId = fa.FachraumId;
            z.FachraumgruppeId = fa.FachraumgruppeId;
        }
        if (n.Lehrer is int l) z.LehrerId = (ix.Lehrer.GetValueOrDefault(l) ?? throw StudioFehler.Ungueltig($"Zeile {nr}: Die Lehrkraft Nr. {l} gibt es nicht.")).Id;
        foreach (var k in (n.Klassen ?? new()).Distinct())
            z.KlassenIds.Add((ix.Klassen.GetValueOrDefault(k) ?? throw StudioFehler.Ungueltig($"Zeile {nr}: Die Klasse Nr. {k} gibt es nicht.")).Id);
        if (n.Raum is int r)
        {
            z.FachraumId = (ix.Raeume.GetValueOrDefault(r) ?? throw StudioFehler.Ungueltig($"Zeile {nr}: Den Raum Nr. {r} gibt es nicht.")).Id;
            z.FachraumgruppeId = null;
        }
        else if (n.Raumgruppe is int g)
        {
            z.FachraumgruppeId = (ix.Raumgruppen.GetValueOrDefault(g) ?? throw StudioFehler.Ungueltig($"Zeile {nr}: Die Raumgruppe Nr. {g} gibt es nicht.")).Id;
            z.FachraumId = null;
        }
        // Stammraum wie bei der Eingabe in der Tabelle: aus der Klasse, sonst (ohne Klasse) aus der Lehrkraft
        if (z.KlassenIds.Count > 0) z.StammraumId = ix.Klassen[z.KlassenIds[0]].StammraumId;
        else if (z.LehrerId is int li) z.StammraumId = ix.Lehrer[li].StammraumId;
    }

    /// <summary>Prüft die Angaben des Dialogs „Neuer Unterricht“ und legt den Unterricht an (Fehler als verständlicher Hinweis).</summary>
    internal static Unterricht NeuerUnterricht(Schuldatei d, NeuerUnterrichtDialog n)
    {
        var ix = new DatenIndex(d);
        if (n.Wochenstunden < 1 || n.Wochenstunden > 60) throw StudioFehler.Ungueltig("Wochenstunden: bitte eine ganze Zahl von 1 bis 60 eingeben.");
        var zeilen = (n.Zeilen ?? new()).Where(z => z.Fach.HasValue || z.Lehrer.HasValue || (z.Klassen?.Count ?? 0) > 0).ToList();
        if (zeilen.Count == 0) throw StudioFehler.Ungueltig("Bitte mindestens Fach, Lehrkraft oder Klasse angeben.");
        var u = new Unterricht { Wochenstunden = n.Wochenstunden, Text = (n.Text ?? "").Trim(), Band = (n.Band ?? "").Trim() };
        for (var i = 0; i < zeilen.Count; i++)
        {
            var z = new Kopplungszeile();
            ZeileBelegen(d, ix, z, zeilen[i], i + 1);
            u.Zeilen.Add(z);
        }
        if (!u.FachIds.Any()) throw StudioFehler.Ungueltig("Bitte ein Fach wählen.");
        if (Unterrichtseingabe.KlasseNoetig(d, u)) throw StudioFehler.Ungueltig("Bitte mindestens eine Klasse wählen.");
        // Doppelstunden: Angabe, sonst aus den Fächer-Stammdaten
        var dopp = Unterrichtseingabe.Pruefen(d, "Dopp", n.Doppelstunden ?? "");
        if (!dopp.Gueltig) throw StudioFehler.Ungueltig(dopp.Hinweis);
        u.Doppelstunden = dopp.Wert.Length > 0 ? Bereich.Parse(dopp.Wert)
            : n.Doppelstunden is null && u.HauptfachId is int hf && ix.Faecher.TryGetValue(hf, out var fach) ? fach.Doppelstunden : default;
        var block = Unterrichtseingabe.Pruefen(d, "Block", n.Block ?? "");
        if (!block.Gueltig) throw StudioFehler.Ungueltig(block.Hinweis);
        u.Block = block.Wert;
        var blockSumme = u.Block.Split(',', StringSplitOptions.RemoveEmptyEntries).Sum(int.Parse);
        if (blockSumme > u.Wochenstunden) throw StudioFehler.Ungueltig($"Blöcke ({blockSumme} Stunden) sind länger als die {u.Wochenstunden} Wochenstunden.");
        if (blockSumme + 2 * u.Doppelstunden.Min > u.Wochenstunden)
            throw StudioFehler.Ungueltig($"{u.Doppelstunden.Min} Doppelstunden{(blockSumme > 0 ? " und die Blöcke" : "")} passen nicht in {u.Wochenstunden} Wochenstunden.");
        u.Periodizitaet = (n.Woche ?? "").Trim().ToUpperInvariant() switch { "A" => Periodizitaet.AWoche, "B" => Periodizitaet.BWoche, _ => Periodizitaet.JedeWoche };
        if (n.UGruppe is int ug) u.UGruppeId = d.UGruppen.FirstOrDefault(g => g.Id == ug)?.Id ?? throw StudioFehler.Ungueltig($"Die Unterrichtsgruppe Nr. {ug} gibt es nicht.");
        u.Id = d.NeueId();
        d.Unterrichte.Add(u);
        return u;
    }

    private static void PlantafelRegistrieren(RouteGroupBuilder g)
    {
        // Steckbrett: Zeilen (Klassen, Lehrkräfte oder Räume), Unterrichte mit offenen Blöcken und alle verplanten Stunden
        g.MapGet("/plantafel", (Arbeitsdokument a, string? typ) => a.LesenAsync(doc =>
        {
            var t = string.IsNullOrWhiteSpace(typ) ? ElementTyp.Klasse : Typnamen.Typ(typ);
            if (t is not (ElementTyp.Klasse or ElementTyp.Lehrer or ElementTyp.Raum)) throw StudioFehler.Ungueltig("Die Plantafel zeigt Klassen, Lehrkräfte oder Räume.");
            return Plantafel(doc, t);
        }));

        // Zielstufen beim Ziehen: frei, tausch, weich, hart, eigen – mit Grund je Feld (Zielstatus wie /planung/zielstatus)
        g.MapGet("/plantafel/ziele", (Arbeitsdokument a, int unterricht, int? tag, int? stunde, bool? einzeln, int? laenge) => a.LesenAsync(doc =>
        {
            var z = Ziele(doc, unterricht, tag, stunde, einzeln == true, laenge);
            var stufen = z.Werte.Select((zeile, t) => zeile.Select((fs, i) =>
            {
                var start = i + 1 - z.Versatz;
                if (z.Gruende[t][i] == "aktuelle Position") return "eigen";
                if (start < 1 || start + z.Laenge - 1 > doc.Daten.Zeitraster.StundenProTag) return "hart";
                return Stufe(doc.Daten, doc.Index, z.Unterricht, t, start, z.Laenge, fs);
            }).ToArray()).ToArray();
            return new { stufen, gruende = z.Gruende, laenge = z.Laenge, versatz = z.Versatz };
        }));

        // Dialog „Neuer Unterricht“: anlegen mit Kopplungszeilen, Doppelstunden, Block, Woche und Raum (eine Rückgängig-Stufe)
        g.MapPost("/neuer-unterricht", (Arbeitsdokument a, NeuerUnterrichtDialog n, ClaimsPrincipal p) =>
        {
            var id = 0;
            return a.AendernAsync(p.Benutzername(), "Neuer Unterricht", AenderungsArt.Unterricht, d => { id = NeuerUnterricht(d, n).Id; }, doc =>
            {
                var u = doc.Daten.Unterrichte.First(x => x.Id == id);
                return new { id, text = doc.Index.UnterrichtText(u), offen = Planungsdienst.OffeneBloecke(doc.Daten, doc.Index, u) };
            });
        });
    }
}
