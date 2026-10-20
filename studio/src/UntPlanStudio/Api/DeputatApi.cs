using System.Globalization;
using System.Security.Claims;
using System.Text;
using UntPlan.Core;
using UntPlan.Core.Austausch;
using UntPlan.Core.Model;
using UntPlan.Core.Module;
using UntPlanStudio.Dienste;
using UntPlanStudio.Grundlagen;

namespace UntPlanStudio.Api;

public sealed record DepWert(string Feld, string? Wert);
public sealed record DepPosten(string? Art, string? Grund, decimal Wert, string? Text);
public sealed record DepEinstellungen(string? Bundesland, decimal? Grundstellen, decimal? GrundstellenSekII, bool? OffenerGanztag, string? Anrechnungstopf, string? Leitungszeit,
    bool? AutomatischeErmaessigungen, decimal? Toleranz);
public sealed record DepZuweisung(int Unterricht, int Zeile, int? Lehrer);

/// <summary>
/// Deputat und Unterrichtsverteilung (Arbeitsplatz „Deputat“): Deputatsrechnung je Lehrkraft nach Landesprofil (NRW),
/// Summen der Schule, Verteilungsmatrix mit offenen Unterrichten und schneller Zuweisung, Stundentafel-/Kontingentprüfung,
/// Ausgabe als CSV (Deputat, UVD für SchILD-NRW) und PDF. Rechenregeln: UntPlan.Core/Module/Deputat.cs.
/// </summary>
public sealed class DeputatApi : IStudioModul
{
    public string Name => "deputat";

    private static readonly CultureInfo De = Format.De;
    private static string Z(decimal x) => Format.Zahl(x);

    private static decimal? Zahl(string? text, string feld)
    {
        text = (text ?? "").Trim().Replace(" ", "");
        if (text.Length == 0) return null;
        if (!decimal.TryParse(text.Replace('.', ','), NumberStyles.Number, De, out var w)) throw StudioFehler.Ungueltig($"{feld}: „{text}“ ist keine gültige Zahl.");
        return w;
    }

    /// <summary>Beschäftigungsumfang aus „Vollzeit“, „75 %“, „19,5“ oder „19,5/25,5“ (Stunden je Woche).</summary>
    public static decimal UmfangLesen(string? text, decimal pflicht)
    {
        var t = (text ?? "").Trim().ToLowerInvariant().Replace(" ", "");
        if (t is "" or "vz" or "vollzeit" or "voll") return pflicht;
        if (t.EndsWith('%')) return Math.Round(pflicht * (Zahl(t.TrimEnd('%'), "Umfang") ?? 0) / 100m, 2);
        var teil = t.Split('/');
        var w = Zahl(teil[0], "Umfang") ?? 0;
        if (w < 0 || w > 40) throw StudioFehler.Ungueltig("Der Beschäftigungsumfang muss zwischen 0 und 40 Stunden liegen.");
        return w;
    }

    private static string UmfangText(Deputat.LehrerDeputat x) =>
        x.Umfang <= 0 ? "–" : x.Umfang >= x.Pflichtstunden ? "Vollzeit" : $"{Math.Round(x.Anteil * 100, 1).ToString("0.#", De)} %";

    private static string Status(Deputat.LehrerDeputat x, decimal tol) => x.Differenz > tol ? "ueber" : x.Differenz < -tol && x.Soll > 0 ? "unter" : "";

    // ------------------------------------------------------------------------------------------ Übersicht

    public static object Uebersicht(Dokument doc)
    {
        var d = doc.Daten;
        var ix = doc.Index;
        var p = Deputat.Profil(d);
        var e = d.Einstellungen.Deputat ??= new DeputatEinstellungen();
        var cmp = StringComparer.Create(De, true);
        var liste = Deputat.Alle(d, ix).OrderBy(x => x.Lehrer.Kurzname, cmp).ToList();
        var s = Deputat.Summen(d, ix, liste);
        var warnungen = new List<object>();
        foreach (var x in liste)
        {
            if (x.Differenz > e.Toleranz) warnungen.Add(new { art = "ueber", lehrer = x.Lehrer.Id, text = $"{x.Lehrer.Kurzname}: {Z(x.Differenz)} Std. über dem Soll" });
            else if (x.Differenz < -e.Toleranz && x.Soll > 0) warnungen.Add(new { art = "unter", lehrer = x.Lehrer.Id, text = $"{x.Lehrer.Kurzname}: {Z(-x.Differenz)} Std. unter dem Soll" });
            foreach (var h in x.Hinweise) warnungen.Add(new { art = "hinweis", lehrer = x.Lehrer.Id, text = $"{x.Lehrer.Kurzname}: {h}" });
        }
        foreach (var (l, f, std) in Deputat.OhneFakultas(d, ix))
            warnungen.Add(new { art = "fakultas", lehrer = l.Id, text = $"{l.Kurzname}: {f.Kurzname} ({Z(std)} Std.) ohne eingetragene Lehrbefähigung" });
        if (s.AnrechnungVerwendet > s.AnrechnungVerfuegbar && s.AnrechnungVerfuegbar > 0)
            warnungen.Add(new { art = "topf", lehrer = (int?)null, text = $"Anrechnungstopf überzogen: {Z(s.AnrechnungVerwendet)} von {Z(s.AnrechnungVerfuegbar)} Std. vergeben" });
        if (s.LeitungVerwendet > s.LeitungVerfuegbar && s.LeitungVerfuegbar > 0)
            warnungen.Add(new { art = "topf", lehrer = (int?)null, text = $"Leitungszeit überzogen: {Z(s.LeitungVerwendet)} von {Z(s.LeitungVerfuegbar)} Std. vergeben" });

        return new
        {
            profil = new { kuerzel = p.Kuerzel, name = p.Name, rechtsgrundlage = p.Rechtsgrundlage, landesregeln = p.Landesregeln },
            profile = Deputat.Profile.Select(x => new { wert = x.Kuerzel, text = x.Name }),
            einstellungen = new
            {
                bundesland = p.Kuerzel, e.Grundstellen, e.GrundstellenSekII, e.OffenerGanztag,
                anrechnungstopf = e.Anrechnungstopf.HasValue ? Z(e.Anrechnungstopf.Value) : "", leitungszeit = e.Leitungszeit.HasValue ? Z(e.Leitungszeit.Value) : "",
                e.AutomatischeErmaessigungen, e.Toleranz,
            },
            schulform = d.Einstellungen.Schulform,
            schulformName = Nrw.Schulformen.GetValueOrDefault(d.Einstellungen.Schulform, d.Einstellungen.Schulform),
            pflichtstunden = s.Pflichtstunden,
            schuljahresbeginn = Deputat.Schuljahresbeginn(d.Einstellungen.SchuljahrVon),
            lehrer = liste.Select(x => new
            {
                id = x.Lehrer.Id, kurz = x.Lehrer.Kurzname, name = x.Lehrer.VollerName,
                pflichtstunden = x.Pflichtstunden, abweichend = x.Lehrer.PflichtstundenAbweichend, umfang = x.Umfang, anteil = x.Anteil, umfangText = UmfangText(x),
                alter = x.Alter, geburtsdatum = x.Lehrer.Geburtsdatum, geburtsjahr = x.Lehrer.Geburtsjahr, gdb = x.Lehrer.Gdb, ohneAlter = x.Lehrer.OhneAltersermaessigung,
                altersermaessigung = x.Altersermaessigung, schwerbehinderung = x.Schwerbehinderung, sonstige = x.SonstigeErmaessigung,
                anrechnung = x.Anrechnung, leitung = x.Leitung, mehrarbeit = x.Mehrarbeit, soll = x.Soll, ist = x.Ist, differenz = x.Differenz, status = Status(x, e.Toleranz),
                posten = x.Posten.Select(q => new { art = q.Art.ToString(), grund = q.Grund, stunden = q.Stunden, automatisch = q.Automatisch }),
                eintraege = x.Lehrer.Ermaessigungen.Select(q => new { art = Deputat.ArtVon(q).ToString(), grund = q.Grund, wert = q.Wert, text = q.Text }),
                hinweise = x.Hinweise,
                faecher = string.Join(", ", x.Lehrer.FaecherIds.Select(f => ix.KFach(f))),
            }),
            summen = s,
            warnungen,
        };
    }

    // ------------------------------------------------------------------------------------------ Verteilung

    public static object Verteilung(Dokument doc, bool nachFach, int? fach)
    {
        var d = doc.Daten;
        var ix = doc.Index;
        var e = d.Einstellungen.Deputat ??= new DeputatEinstellungen();
        var cmp = StringComparer.Create(De, true);
        var matrix = Deputat.Matrix(d, ix, nachFach);
        var liste = Deputat.Alle(d, ix).OrderBy(x => x.Lehrer.Kurzname, cmp).ToList();
        if (fach is int fid) liste = liste.Where(x => x.Lehrer.FaecherIds.Contains(fid) || matrix.Keys.Any(k => k.Lehrer == x.Lehrer.Id && (nachFach ? k.Spalte == fid : false))
                                                      || d.Unterrichte.Any(u => u.Zeilen.Any(z => z.LehrerId == x.Lehrer.Id && z.FachId == fid))).ToList();
        List<(int Id, string Kurz)> spalten;
        if (nachFach)
            spalten = Stammdaten.Sortiert(d.Faecher).Where(f => matrix.Keys.Any(k => k.Spalte == f.Id) || (fach == f.Id)).Select(f => (f.Id, f.Kurzname)).ToList();
        else
        {
            spalten = Stammdaten.Sortiert(d.Klassen).Select(k => (k.Id, k.Kurzname)).ToList();
            if (matrix.Keys.Any(k => k.Spalte == 0)) spalten.Add((0, "ohne Kl."));
        }
        // Fakultas je Zelle: Lehrkraft unterrichtet dort ein Fach ohne Lehrbefähigung
        var ohne = new HashSet<(int, int)>();
        foreach (var u in d.Unterrichte.Where(u => !u.Ignorieren))
            foreach (var z in u.Zeilen.Where(z => z.LehrerId.HasValue && z.FachId.HasValue))
            {
                if (!ix.Lehrer.TryGetValue(z.LehrerId!.Value, out var l) || l.FaecherIds.Count == 0 || l.FaecherIds.Contains(z.FachId!.Value)) continue;
                if (ix.Faecher.TryGetValue(z.FachId.Value, out var f) && f.Bereitschaft) continue;
                if (nachFach) ohne.Add((l.Id, z.FachId.Value));
                else foreach (var k in z.KlassenIds.DefaultIfEmpty(0)) ohne.Add((l.Id, k));
            }
        var offen = Deputat.Offen(d, ix)
            .Where(o => fach is null || o.Kz.FachId == fach)
            .OrderBy(o => o.Kz.KlassenIds.Select(k => ix.Klassen.GetValueOrDefault(k)?.Kurzname ?? "").DefaultIfEmpty("").First(), cmp).ThenBy(o => ix.KFach(o.Kz.FachId), cmp)
            .Select(o => new
            {
                unterricht = o.Unterricht.Id, zeile = o.Zeile, fachId = o.Kz.FachId, fach = ix.KFach(o.Kz.FachId), klassen = ix.KKlassen(o.Kz.KlassenIds), klassenIds = o.Kz.KlassenIds,
                wst = o.Unterricht.Wochenstunden, wert = o.Wert, kurs = o.Unterricht.Kursname,
                gekoppelt = o.Unterricht.Zeilen.Count > 1 ? string.Join(", ", o.Unterricht.Zeilen.Where((z, i) => i != o.Zeile).Select(z => $"{ix.KFach(z.FachId)} {ix.KLehrer(z.LehrerId)}".Trim())) : "",
            }).ToList();
        return new
        {
            nach = nachFach ? "fach" : "klasse",
            spalten = spalten.Select(x => new { id = x.Id, kurz = x.Kurz }),
            zeilen = liste.Select(x => new
            {
                id = x.Lehrer.Id, kurz = x.Lehrer.Kurzname, name = x.Lehrer.VollerName, soll = x.Soll, ist = x.Ist, differenz = x.Differenz, status = Status(x, e.Toleranz),
                faecherIds = x.Lehrer.FaecherIds,
                werte = spalten.Select(sp => matrix.GetValueOrDefault((x.Lehrer.Id, sp.Id))).ToArray(),
                ohneFakultas = spalten.Select(sp => ohne.Contains((x.Lehrer.Id, sp.Id))).ToArray(),
            }),
            summen = spalten.Select(sp => matrix.Where(m => m.Key.Spalte == sp.Id).Sum(m => m.Value)).ToArray(),
            offen,
            faecher = Stammdaten.Sortiert(d.Faecher).Where(f => !f.Bereitschaft).Select(f => new { id = f.Id, kurz = f.Kurzname, name = f.Langname }),
        };
    }

    public static object Vorschlag(Dokument doc, int unterricht, int zeile)
    {
        var d = doc.Daten;
        var ix = doc.Index;
        var u = d.Unterrichte.FirstOrDefault(x => x.Id == unterricht) ?? throw StudioFehler.NichtGefunden($"Der Unterricht Nr. {unterricht}");
        if (zeile < 0 || zeile >= u.Zeilen.Count) throw StudioFehler.Ungueltig("Die Zeile des Unterrichts existiert nicht.");
        var z = u.Zeilen[zeile];
        var wert = Wertrechnung.Wert(d, ix, u, z);
        var belegt = u.Zeilen.Where((x, i) => i != zeile && x.LehrerId.HasValue).Select(x => x.LehrerId!.Value).ToHashSet();
        var klassenlehrer = d.Klassen.Where(k => z.KlassenIds.Contains(k.Id)).SelectMany(k => k.KlassenlehrerIds).ToHashSet();
        return Deputat.Alle(d, ix).Where(x => !belegt.Contains(x.Lehrer.Id)).Select(x => new
        {
            id = x.Lehrer.Id, kurz = x.Lehrer.Kurzname, name = x.Lehrer.VollerName,
            frei = x.Soll - x.Ist, fakultas = z.FachId.HasValue && x.Lehrer.FaecherIds.Contains(z.FachId.Value),
            klassenlehrer = klassenlehrer.Contains(x.Lehrer.Id),
            kenntKlasse = d.Unterrichte.Any(v => v.Zeilen.Any(y => y.LehrerId == x.Lehrer.Id && y.KlassenIds.Intersect(z.KlassenIds).Any())),
            reicht = x.Soll - x.Ist >= wert,
        })
        .OrderByDescending(x => x.fakultas).ThenByDescending(x => x.reicht).ThenByDescending(x => x.klassenlehrer).ThenByDescending(x => x.kenntKlasse).ThenByDescending(x => x.frei)
        .ToList();
    }

    public static object Tafel(Dokument doc)
    {
        var d = doc.Daten;
        var cmp = StringComparer.Create(De, true);
        var abgleich = Wertrechnung.Stundentafel(d).OrderBy(a => a.Klasse.Kurzname, cmp).ThenBy(a => a.Fach.Kurzname, cmp).Select(a => new
        {
            klasse = a.Klasse.Kurzname, jahrgang = a.Klasse.Jahrgang, fach = a.Fach.Kurzname, soll = a.Soll, ist = a.Ist, differenz = a.Ist - a.Soll,
        }).ToList();
        var gy = d.Einstellungen.Schulform == "GY";
        decimal summe = 0;
        var kontingente = gy ? Deputat.KontingentePruefenG9(d, out summe) : new List<Deputat.KontingentPruefung>();
        var vollstaendig = new[] { "5", "6", "7", "8", "9", "10" }.All(j => d.Stundentafel.Any(z => z.Jahrgang == j));
        return new
        {
            jahrgaenge = d.Stundentafel.Select(z => z.Jahrgang).Distinct().OrderBy(Nrw.JahrgangRang).ToList(),
            abgleich,
            kontingentpruefung = gy && vollstaendig,
            kontingentGrundlage = gy ? "APO-S I, Anlage 3a (Gymnasium G9, ab 1.8.2021): 182 Stunden in 5–10, dazu bis zu 6 Ergänzungsstunden (höchstens 188)" : "",
            kontingente = kontingente.Select(k => new { lernbereich = k.Lernbereich, stufe = k.Stufe, soll = k.Soll, ist = k.Ist, differenz = k.Ist - k.Soll }),
            summe,
            summeOk = summe >= 182 && summe <= 188,
        };
    }

    // ------------------------------------------------------------------------------------------ Ändern

    private static void Feld(Schuldatei d, Lehrer l, string feld, string? wert)
    {
        var t = (wert ?? "").Trim();
        switch (feld)
        {
            case "umfang":
                l.Wochensoll = UmfangLesen(t, Deputat.Pflichtstunden(d, l));
                break;
            case "pflichtstunden":
                var p = Zahl(t, "Pflichtstunden");
                if (p is < 0 or > 40) throw StudioFehler.Ungueltig("Die Pflichtstunden müssen zwischen 0 und 40 liegen.");
                l.PflichtstundenAbweichend = p is > 0 ? p : null;
                break;
            case "geburtsdatum":
                if (t.Length == 0) { l.Geburtsdatum = null; break; }
                if (!DateOnly.TryParseExact(t, new[] { "yyyy-MM-dd", "d.M.yyyy", "dd.MM.yyyy" }, De, DateTimeStyles.None, out var g))
                    throw StudioFehler.Ungueltig($"„{t}“ ist kein Datum (TT.MM.JJJJ).");
                if (g.Year < 1930 || g > DateOnly.FromDateTime(DateTime.Today)) throw StudioFehler.Ungueltig("Das Geburtsdatum ist nicht plausibel.");
                l.Geburtsdatum = g;
                break;
            case "geburtsjahr":
                if (t.Length == 0) { l.Geburtsjahr = null; break; }
                if (!int.TryParse(t, out var j) || j < 1930 || j > DateTime.Today.Year - 16) throw StudioFehler.Ungueltig("Das Geburtsjahr ist nicht plausibel.");
                l.Geburtsjahr = j;
                break;
            case "alter":
                // Alter am Schuljahresbeginn → Geburtsjahr (ohne Tag)
                if (t.Length == 0) { l.Geburtsjahr = null; break; }
                if (!int.TryParse(t, out var a) || a < 16 || a > 80) throw StudioFehler.Ungueltig("Das Alter ist nicht plausibel.");
                l.Geburtsjahr = Deputat.Schuljahresbeginn(d.Einstellungen.SchuljahrVon).Year - a - 1;
                break;
            case "gdb":
                var gdb = (int)(Zahl(t, "GdB") ?? 0);
                if (gdb is < 0 or > 100) throw StudioFehler.Ungueltig("Der Grad der Behinderung liegt zwischen 0 und 100.");
                l.Gdb = gdb;
                break;
            case "mehrarbeit":
                var m = Zahl(t, "Mehrarbeit") ?? 0;
                if (Math.Abs(m) > 10) throw StudioFehler.Ungueltig("Mehrarbeit bzw. Ausgleich höchstens ±10 Stunden je Woche.");
                l.Mehrarbeit = m;
                break;
            case "ohnealter":
                l.OhneAltersermaessigung = t is "true" or "1" or "ja";
                break;
            default:
                throw StudioFehler.Ungueltig($"Das Feld „{feld}“ ist hier nicht änderbar.");
        }
    }

    private static Lehrer LehrerVon(Schuldatei d, int id) => d.Lehrer.FirstOrDefault(x => x.Id == id) ?? throw StudioFehler.NichtGefunden($"Die Lehrkraft Nr. {id}");

    public void EndpunkteRegistrieren(StudioRouten r)
    {
        var g = r.Dokument.MapGroup("/deputat");

        g.MapGet("", (Arbeitsdokument a) => a.LesenAsync(Uebersicht));

        g.MapPatch("/lehrer/{lehrer:int}", (Arbeitsdokument a, int lehrer, DepWert w, ClaimsPrincipal p) =>
        {
            var feld = (w.Feld ?? "").Trim().ToLowerInvariant();
            return a.AendernAsync(p.Benutzername(), $"Deputat ({feld})", AenderungsArt.Stammdaten, d => Feld(d, LehrerVon(d, lehrer), feld, w.Wert), Uebersicht);
        });

        g.MapPut("/lehrer/{lehrer:int}/posten", (Arbeitsdokument a, int lehrer, List<DepPosten> liste, ClaimsPrincipal p) =>
        {
            if (liste.Count > 30) throw StudioFehler.Ungueltig("Höchstens 30 Einträge.");
            var neu = liste.Where(x => !string.IsNullOrWhiteSpace(x.Grund) || x.Wert != 0).Select(x =>
            {
                if (x.Wert < -10 || x.Wert > 30) throw StudioFehler.Ungueltig("Ein Eintrag liegt außerhalb von −10 bis 30 Stunden.");
                var art = (x.Art ?? "").Trim() switch { "Anrechnung" => "Anrechnung", "Leitung" => "Leitung", _ => "Ermaessigung" };
                return new Ermaessigung { Grund = (x.Grund ?? "").Trim(), Wert = x.Wert, Text = (x.Text ?? "").Trim(), Art = art };
            }).ToList();
            return a.AendernAsync(p.Benutzername(), "Ermäßigungen und Anrechnungen", AenderungsArt.Stammdaten, d => LehrerVon(d, lehrer).Ermaessigungen = neu, Uebersicht);
        });

        g.MapPut("/einstellungen", (Arbeitsdokument a, DepEinstellungen w, ClaimsPrincipal p) =>
        {
            if (w.Bundesland is string b && Deputat.Profile.All(x => x.Kuerzel != b)) throw StudioFehler.Ungueltig("Unbekanntes Landesprofil.");
            if (w.Grundstellen is < 0 or > 500 || w.GrundstellenSekII is < 0 or > 500) throw StudioFehler.Ungueltig("Die Grundstellen müssen zwischen 0 und 500 liegen.");
            var topf = w.Anrechnungstopf is null ? (decimal?)null : Zahl(w.Anrechnungstopf, "Anrechnungstopf");
            var leit = w.Leitungszeit is null ? (decimal?)null : Zahl(w.Leitungszeit, "Leitungszeit");
            return a.AendernAsync(p.Benutzername(), "Deputat-Einstellungen", AenderungsArt.Einstellungen, d =>
            {
                var e = d.Einstellungen.Deputat ??= new DeputatEinstellungen();
                if (w.Bundesland is not null) e.Bundesland = w.Bundesland;
                if (w.Grundstellen is decimal gs) e.Grundstellen = gs;
                if (w.GrundstellenSekII is decimal g2) e.GrundstellenSekII = g2;
                if (w.OffenerGanztag is bool o) e.OffenerGanztag = o;
                if (w.Anrechnungstopf is not null) e.Anrechnungstopf = topf;
                if (w.Leitungszeit is not null) e.Leitungszeit = leit;
                if (w.AutomatischeErmaessigungen is bool au) e.AutomatischeErmaessigungen = au;
                if (w.Toleranz is decimal t) e.Toleranz = Math.Clamp(t, 0, 5);
            }, Uebersicht);
        });

        g.MapGet("/verteilung", (Arbeitsdokument a, string? nach, int? fach) => a.LesenAsync(doc => Verteilung(doc, nach == "fach", fach)));
        // Zeilen einer Matrixzelle (Lehrkraft × Klasse bzw. Fach) – zum Entfernen der Lehrkraft
        g.MapGet("/zelle", (Arbeitsdokument a, int lehrer, int spalte, string? nach) => a.LesenAsync(doc =>
        {
            var d = doc.Daten;
            var ix = doc.Index;
            var fach = nach == "fach";
            return d.Unterrichte.Where(u => !u.Ignorieren).SelectMany(u => u.Zeilen.Select((z, i) => (u, z, i)))
                .Where(x => x.z.LehrerId == lehrer && (fach ? (x.z.FachId ?? 0) == spalte : spalte == 0 ? x.z.KlassenIds.Count == 0 : x.z.KlassenIds.Contains(spalte)))
                .Select(x => new
                {
                    unterricht = x.u.Id, zeile = x.i, fach = ix.KFach(x.z.FachId), klassen = ix.KKlassen(x.z.KlassenIds), wst = x.u.Wochenstunden,
                    wert = Wertrechnung.Wert(d, ix, x.u, x.z), kurs = x.u.Kursname,
                }).ToList();
        }));
        g.MapGet("/vorschlag",(Arbeitsdokument a, int unterricht, int zeile) => a.LesenAsync(doc => Vorschlag(doc, unterricht, zeile)));
        g.MapPost("/zuweisen", (Arbeitsdokument a, DepZuweisung w, ClaimsPrincipal p) =>
            a.AendernAsync(p.Benutzername(), w.Lehrer is null ? "Lehrkraft entfernt (Verteilung)" : "Lehrkraft zugewiesen (Verteilung)", AenderungsArt.Unterricht, d =>
            {
                try { Deputat.Zuweisen(d, w.Unterricht, w.Zeile, w.Lehrer); }
                catch (InvalidOperationException ex) { throw StudioFehler.Ungueltig(ex.Message); }
            }, doc => new { ok = true }));

        g.MapGet("/tafel", (Arbeitsdokument a) => a.LesenAsync(Tafel));

        g.MapGet("/export.csv", (Arbeitsdokument a, string? art) => a.LesenAsync(doc =>
        {
            var d = doc.Daten;
            if (art == "uvd")
                return Results.File(Encoding.UTF8.GetBytes(Deputat.UvdText(d)), "text/plain; charset=utf-8", "UVD.TXT");
            var csv = Csv.Schreiben(Deputat.Tabelle(d), ';', true);
            return Results.File(Encoding.UTF8.GetBytes(csv), "text/csv; charset=utf-8", "Deputat.csv");
        }));

        g.MapGet("/bericht.pdf", (Arbeitsdokument a, ClaimsPrincipal p) => a.LesenAsync(doc =>
        {
            var d = doc.Daten;
            var t = Deputat.Tabelle(d);
            var s = Deputat.Summen(d, doc.Index, Deputat.Alle(d, doc.Index));
            var spalten = new[] { 0, 1, 3, 6, 7, 8, 9, 10, 11, 12, 13, 14 };
            var zeilen = t.Skip(1).Select(z => (IReadOnlyList<string>)spalten.Select(i => z[i]).ToList()).ToList();
            var arten = zeilen.Select(_ => "").ToList();
            var bericht = new Bericht("Deputat der Lehrkräfte", $"{Deputat.Profil(d).Name} · Pflichtstunden {Z(s.Pflichtstunden)} · Schuljahresbeginn {Format.Datum(Deputat.Schuljahresbeginn(d.Einstellungen.SchuljahrVon))}",
                spalten.Select(i => t[0][i] switch { "sonstige Ermäßigung" => "sonst. Erm.", "Mehrarbeit/Vorgriff" => "Mehrarb.", "Schwerbehinderung" => "SB", "Altersermäßigung" => "Alter", var x => x }).ToList(),
                zeilen, true, arten)
            {
                Hinweis = $"Stellen (Umfang/Pflichtstunden): {Z(Math.Round(s.Stellen, 2))} · Stellenbedarf: {Z(Math.Round(s.Stellenbedarf, 2))} · Soll {Z(s.Soll)} · Ist {Z(s.Ist)} · offen {Z(s.Offen)} · " +
                          $"Anrechnungstopf {Z(s.AnrechnungVerwendet)} von {Z(s.AnrechnungVerfuegbar)} · Leitungszeit {Z(s.LeitungVerwendet)} von {Z(s.LeitungVerfuegbar)}",
            };
            return Results.File(ListenPdf.Bericht(d, bericht, p.Benutzername()), "application/pdf", "Deputat.pdf");
        }));
    }
}
