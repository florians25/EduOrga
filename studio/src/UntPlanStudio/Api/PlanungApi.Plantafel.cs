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
                raumgruppen = d.Raumgruppen.ToDictionary(g => g.Id.ToString(), g => g.Kurzname),
            },
            raumgruppen = d.Raumgruppen.ToDictionary(g => g.Id.ToString(), g => g.RaumIds),
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
                    // bevorzugte Räume bzw. Raumgruppen (Fachraum vor Stammraum) je Kopplungszeile, ohne Doppelte
                    wunsch = u.Zeilen.SelectMany(z => new[]
                    {
                        (art: "Fachraum", raum: z.FachraumId, gruppe: z.FachraumgruppeId),
                        (art: "Stammraum", raum: z.StammraumId, gruppe: z.StammraumgruppeId),
                    }).Where(w => w.raum.HasValue || w.gruppe.HasValue).Distinct().Select(w => new { w.art, w.raum, w.gruppe }),
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

    /// <summary>Unterrichte desselben Bandes (gleichzeitige Kurse einer Schiene), der Unterricht selbst zuerst; ohne Band nur er.</summary>
    internal static List<Unterricht> BandVon(Schuldatei d, Unterricht u) =>
        string.IsNullOrWhiteSpace(u.Band) ? new List<Unterricht> { u }
        : new[] { u }.Concat(d.Unterrichte.Where(x => x.Id != u.Id && !x.Ignorieren && x.Band == u.Band).OrderBy(x => x.Id)).ToList();

    internal sealed record BandTeil(Unterricht Unterricht, List<Planstunde> Stunden);

    /// <summary>
    /// Mitziehende Stunden eines Bandes: die gezogenen Stunden des Unterrichts und die Stunden der übrigen Kurse des Bandes am selben Tag
    /// in denselben Stunden (parallel liegende Kurse wandern mit, Kurse an anderer Stelle bleiben).
    /// </summary>
    internal static List<BandTeil> BandTeile(Schuldatei d, Unterricht u, List<Planstunde> gezogen)
    {
        var tag = gezogen[0].Tag;
        var stunden = gezogen.Select(p => p.Stunde).ToHashSet();
        var erg = new List<BandTeil> { new(u, gezogen) };
        foreach (var m in BandVon(d, u).Skip(1))
        {
            var l = d.Stundenplan.Where(p => p.UnterrichtId == m.Id && p.Tag == tag && stunden.Contains(p.Stunde)).OrderBy(p => p.Stunde).ToList();
            if (l.Count > 0) erg.Add(new BandTeil(m, l));
        }
        return erg;
    }

    /// <summary>Kurse des Bandes, die einen offenen Block dieser Länge haben (werden aus dem Vorrat gemeinsam gesetzt).</summary>
    internal static List<Unterricht> BandOffen(Schuldatei d, DatenIndex ix, Unterricht u, int laenge) =>
        BandVon(d, u).Where((m, i) => i == 0 || Planungsdienst.OffeneBloecke(d, ix, m).Contains(laenge)).ToList();

    private static readonly Dictionary<string, int> Rang = new() { ["frei"] = 0, ["tausch"] = 1, ["weich"] = 2, ["hart"] = 3, ["eigen"] = -1 };

    /// <summary>
    /// Zielstufen für einen Unterricht mit Band: je Feld die schlechteste Stufe aller mitziehenden Kurse, der Grund nennt die Kurse
    /// („U-Nr. 230 M EF: Kollision …“). Tausch nur, wenn der geprüfte Tausch das ganze Band umfasst.
    /// </summary>
    internal static object BandZiele(Dokument doc, Unterricht u, int? tag, int? stunde, bool einzeln, int? laenge)
    {
        var d = doc.Daten;
        var ix = doc.Index;
        var z = d.Zeitraster;
        List<Planstunde>? gezogen = null;
        List<BandTeil> teile;
        var versatz = 0;
        var n = Math.Clamp(laenge ?? 1, 1, z.StundenProTag);
        if (tag is int tg && stunde is int st)
        {
            var p = Stunde(d, u.Id, tg, st);
            gezogen = Gezogen(d, p, einzeln).OrderBy(x => x.Stunde).ToList();
            versatz = p.Stunde - gezogen[0].Stunde;
            n = gezogen.Count;
            teile = BandTeile(d, u, gezogen);
        }
        else teile = BandOffen(d, ix, u, n).Select(m => new BandTeil(m, new List<Planstunde>())).ToList();
        var stufen = new string[z.TageProWoche][];
        var gruende = new string[z.TageProWoche][];
        for (var t = 0; t < z.TageProWoche; t++)
        {
            stufen[t] = new string[z.StundenProTag];
            gruende[t] = new string[z.StundenProTag];
            for (var s = 1; s <= z.StundenProTag; s++)
            {
                var start = s - versatz;
                if (start < 1 || start + n - 1 > z.StundenProTag) { stufen[t][s - 1] = "hart"; gruende[t][s - 1] = "passt nicht in das Zeitraster"; continue; }
                if (gezogen != null && gezogen[0].Tag == t && gezogen[0].Stunde == start) { stufen[t][s - 1] = "eigen"; gruende[t][s - 1] = "aktuelle Position"; continue; }
                var schlecht = "frei";
                var texte = new List<string>();
                foreach (var teil in teile)
                {
                    var m = teil.Unterricht;
                    var mStart = gezogen is null ? start : teil.Stunden[0].Stunde - gezogen[0].Stunde + start;
                    var mn = gezogen is null ? n : teil.Stunden.Count;
                    Feldstatus fs;
                    if (mStart < 1 || mStart + mn - 1 > z.StundenProTag) fs = Feldstatus.Kollision;
                    else fs = gezogen is null ? Planungsdienst.Status(d, ix, m, t, mStart, mn) : Planungsdienst.Zielstatus(d, ix, teil.Stunden, t, mStart);
                    var stufe = mStart < 1 || mStart + mn - 1 > z.StundenProTag ? "hart" : Stufe(d, ix, m, t, mStart, mn, fs);
                    if (Rang[stufe] > Rang[schlecht]) schlecht = stufe;
                    if (stufe != "frei")
                    {
                        var g = Grund(d, ix, m, t, mStart, mn, gezogen is null ? null : teil.Stunden, fs, gezogen is null ? null : teil.Stunden);
                        texte.Add($"U-Nr. {m.Id} {ix.UnterrichtText(m)}: {(g.Length > 0 ? g : stufe == "tausch" ? "Tausch" : "belegt")}");
                    }
                }
                // Tausch für das ganze Band nur, wenn der geprüfte Tausch der gezogenen Stunden gelingt (er nimmt das Band mit)
                if (schlecht == "tausch" && (gezogen is null || Planungsdienst.TauschPruefen(d, ix, gezogen, t, start, out _) is null)) schlecht = "hart";
                stufen[t][s - 1] = schlecht;
                gruende[t][s - 1] = texte.Count == 0 ? $"frei für alle {teile.Count} Kurse des Bandes {u.Band}" : $"Band {u.Band}: " + string.Join("; ", texte);
            }
        }
        return new { stufen, gruende, laenge = n, versatz, band = teile.Select(x => x.Unterricht.Id) };
    }

    private static List<(int Tag, int Stunde)> Stellen(int tag, int start, int n) => Enumerable.Range(start, n).Select(s => (tag, s)).ToList();

    private static void BandRegistrieren(RouteGroupBuilder g)
    {
        // Band verschieben: die gezogenen Stunden und die parallelen Kurse des Bandes um denselben Versatz (Tausch, sonst Rückfrage)
        g.MapPost("/band/verschieben", async (Arbeitsdokument a, BlockBewegung b, ClaimsPrincipal p) =>
        {
            var aktion = (b.Aktion ?? "auto").ToLowerInvariant();
            var pruefung = await a.LesenAsync(doc =>
            {
                var d = doc.Daten;
                var ix = doc.Index;
                var u = Unt(d, b.Unterricht);
                var pl = Stunde(d, b.Unterricht, b.Tag, b.Stunde);
                var block = Gezogen(d, pl, b.Einzeln).OrderBy(x => x.Stunde).ToList();
                var start = b.ZielStunde - (pl.Stunde - block[0].Stunde);
                if (b.ZielTag < 0 || b.ZielTag >= d.Zeitraster.TageProWoche || start < 1 || start + block.Count - 1 > d.Zeitraster.StundenProTag)
                    throw StudioFehler.Ungueltig("Die Stunden passen an dieser Position nicht in das Zeitraster.");
                var teile = BandTeile(d, u, block);
                if (teile.Any(t => t.Stunden.Any(x => x.Fixiert))) throw StudioFehler.Ungueltig("Eine Stunde des Bandes ist fixiert.");
                if (block[0].Tag == b.ZielTag && block[0].Stunde == start) return new Pruefung("nichts", new { ok = true, unveraendert = true }, start);
                var alle = teile.SelectMany(t => t.Stunden).ToList();
                var hind = teile.SelectMany(t => Behinderung.AnStellen(d, ix, t.Unterricht, Stellen(b.ZielTag, t.Stunden[0].Stunde - block[0].Stunde + start, t.Stunden.Count), alle))
                    .GroupBy(h => h.Planstunde).Select(x => x.First()).ToList();
                if (hind.Count == 0) return new Pruefung("frei", null, start);
                if (aktion == "auto" && Planungsdienst.TauschPruefen(d, ix, block, b.ZielTag, start, out _) != null) return new Pruefung("tausch", null, start);
                if (aktion == "auto") return new Pruefung("frage", Frage(d, ix, hind, $"Band {u.Band} ({teile.Count} Kurse) nach {Planungsdienst.Tagname(d, b.ZielTag)}-{start} verschieben"), start);
                return new Pruefung(aktion == "entplanen" ? "entplanen" : "kollision", null, start);
            });
            if (pruefung.Art is "nichts" or "frage") return pruefung.Antwort!;
            return await a.AendernAsync(p.Benutzername(), pruefung.Art == "tausch" ? $"Band von U-Nr. {b.Unterricht} getauscht" : $"Band von U-Nr. {b.Unterricht} verschoben", AenderungsArt.Stundenplan, d =>
            {
                var ix = new DatenIndex(d);
                var u = Unt(d, b.Unterricht);
                var pl = Stunde(d, b.Unterricht, b.Tag, b.Stunde);
                var block = Gezogen(d, pl, b.Einzeln).OrderBy(x => x.Stunde).ToList();
                if (pruefung.Art == "tausch")
                {
                    var t = Planungsdienst.TauschPruefen(d, ix, block, b.ZielTag, pruefung.Start, out var grund) ?? throw StudioFehler.Ungueltig(grund);
                    Planungsdienst.Tauschen(d, t);
                    return;
                }
                var teile = BandTeile(d, u, block);
                var alle = teile.SelectMany(t => t.Stunden).ToList();
                var von = block[0].Stunde;
                if (pruefung.Art == "entplanen")
                    Behinderung.Entplanen(d, teile.SelectMany(t => Behinderung.AnStellen(d, ix, t.Unterricht, Stellen(b.ZielTag, t.Stunden[0].Stunde - von + pruefung.Start, t.Stunden.Count), alle)).ToList());
                foreach (var x in alle) { x.Tag = b.ZielTag; x.Stunde = x.Stunde - von + pruefung.Start; }
                ix = new DatenIndex(d);
                foreach (var t in teile)
                    foreach (var x in t.Stunden) x.Raeume = Planungsdienst.RaeumeSuchen(d, ix, t.Unterricht, x.Tag, x.Stunde, alle);
            }, _ => (object)new { ok = true, art = pruefung.Art });
        });

        // Band aus dem Vorrat setzen: alle Kurse des Bandes mit einem offenen Block dieser Länge gleichzeitig
        g.MapPost("/band/verplanen", async (Arbeitsdokument a, BlockSetzen s, ClaimsPrincipal p) =>
        {
            var aktion = (s.Aktion ?? "auto").ToLowerInvariant();
            var frage = await a.LesenAsync(doc =>
            {
                var d = doc.Daten;
                var ix = doc.Index;
                var u = Unt(d, s.Unterricht);
                var n = Math.Clamp(s.Laenge, 1, d.Zeitraster.StundenProTag);
                if (s.Tag < 0 || s.Tag >= d.Zeitraster.TageProWoche || s.Stunde < 1 || s.Stunde + n - 1 > d.Zeitraster.StundenProTag)
                    throw StudioFehler.Ungueltig("Die Stunden passen an dieser Position nicht in das Zeitraster.");
                if (ix.NichtVerplant(u) < n) throw StudioFehler.Ungueltig($"Von U-Nr. {u.Id} sind nur noch {ix.NichtVerplant(u)} Stunden nicht verplant.");
                var kurse = BandOffen(d, ix, u, n);
                if (kurse.Any(m => d.Stundenplan.Any(x => x.UnterrichtId == m.Id && x.Tag == s.Tag && x.Stunde >= s.Stunde && x.Stunde < s.Stunde + n)))
                    throw StudioFehler.Ungueltig("Ein Kurs des Bandes liegt zu dieser Zeit schon im Plan.");
                if (aktion != "auto") return null;
                var hind = kurse.SelectMany(m => Behinderung.AnStellen(d, ix, m, Stellen(s.Tag, s.Stunde, n))).GroupBy(h => h.Planstunde).Select(x => x.First()).ToList();
                return hind.Count == 0 ? null : Frage(d, ix, hind, $"Band {u.Band} ({kurse.Count} Kurse) an {Planungsdienst.Tagname(d, s.Tag)}-{s.Stunde} setzen");
            });
            if (frage != null) return frage;
            return await a.AendernAsync(p.Benutzername(), $"Band von U-Nr. {s.Unterricht} verplant", AenderungsArt.Stundenplan, d =>
            {
                var ix = new DatenIndex(d);
                var u = Unt(d, s.Unterricht);
                var n = Math.Clamp(s.Laenge, 1, d.Zeitraster.StundenProTag);
                var kurse = BandOffen(d, ix, u, n);
                if (aktion == "entplanen")
                    Behinderung.Entplanen(d, kurse.SelectMany(m => Behinderung.AnStellen(d, ix, m, Stellen(s.Tag, s.Stunde, n))).ToList());
                foreach (var m in kurse)
                    for (var i = 0; i < n; i++) Planungsdienst.Verplanen(d, m, s.Tag, s.Stunde + i, behinderndeEntplanen: false, s.Fixieren);
            }, _ => (object)new { ok = true });
        });
    }

    private static void PlantafelRegistrieren(RouteGroupBuilder g)
    {
        BandRegistrieren(g);

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
            var bu = doc.Index.Unterrichte.GetValueOrDefault(unterricht) ?? throw StudioFehler.NichtGefunden($"Der Unterricht U-Nr. {unterricht}");
            if (BandVon(doc.Daten, bu).Count > 1) return BandZiele(doc, bu, tag, stunde, einzeln == true, laenge);
            var z = Ziele(doc, unterricht, tag, stunde, einzeln == true, laenge);
            var stufen = z.Werte.Select((zeile, t) => zeile.Select((fs, i) =>
            {
                var start = i + 1 - z.Versatz;
                if (z.Gruende[t][i] == "aktuelle Position") return "eigen";
                if (start < 1 || start + z.Laenge - 1 > doc.Daten.Zeitraster.StundenProTag) return "hart";
                return Stufe(doc.Daten, doc.Index, z.Unterricht, t, start, z.Laenge, fs);
            }).ToArray()).ToArray();
            return (object)new { stufen, gruende = z.Gruende, laenge = z.Laenge, versatz = z.Versatz, band = new[] { unterricht } };
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
