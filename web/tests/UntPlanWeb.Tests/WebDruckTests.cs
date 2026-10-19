using UntPlan.Druck;
using UntPlanWeb.Dienste;

namespace UntPlanWeb.Tests;

/// <summary>
/// Alle PDF-Formulare von UntPlan Web im gemeinsamen Druckdesign (UntPlan.Druck): Berichte (gegliedert und schlicht), Entschuldigung,
/// Zugangsdaten-Karten, Sitzplan (Pult vorne/hinten), Sprechtag (Terminplan mit freien Zeilen, Gesamtplan, Elternplan), Familienexport
/// und Vertretungsplan-Aushang (normal und groß, auch über die Schnittstelle). Mit EDUORGA_DRUCKMUSTER (Ordner) werden Muster gespeichert.
/// </summary>
public class WebDruckTests
{
    private const string Schule = "Städtisches Beispiel-Gymnasium";

    public static void Muster(string name, byte[] pdf)
    {
        var ordner = Environment.GetEnvironmentVariable("EDUORGA_DRUCKMUSTER");
        if (string.IsNullOrWhiteSpace(ordner)) return;
        Directory.CreateDirectory(ordner);
        File.WriteAllBytes(Path.Combine(ordner, name + ".pdf"), pdf);
    }

    private static string Pruefen(byte[] pdf, bool quer, int minSeiten, params string[] inhalt)
    {
        Assert.Equal("%PDF-1.4", System.Text.Encoding.ASCII.GetString(pdf, 0, 8));
        var seiten = PdfPruefung.Seitenzahl(pdf);
        Assert.True(seiten >= minSeiten, $"{seiten} Seiten statt mindestens {minSeiten}");
        Assert.All(PdfPruefung.Seitengroessen(pdf), g => Assert.Equal(quer ? 841.89f : 595.28f, g.Breite, 0.1f));
        var texte = PdfPruefung.Texte(pdf);
        for (var i = 0; i < texte.Count; i++)
        {
            Assert.Contains(Schule, texte[i]);
            Assert.Contains($"Seite {i + 1} von {seiten}", texte[i]);
            Assert.Contains("Gedruckt am", texte[i]);
        }
        var alles = string.Join("\n", texte);
        foreach (var t in inhalt) Assert.True(alles.Contains(t), $"„{t}“ fehlt:\n{alles}");
        return alles;
    }

    private static readonly string[] Namen = { "Bauer, Lea", "Vogel, Emilia", "Roth, Marie", "Frank, Paul", "Otto, Felix", "Sommer, Hanna", "Keller, Finn", "Jung, Noah", "Lorenz, Jonas", "Busch, Lina", "Engel, Ben", "Wolf, Mila" };

    [Fact]
    public void Bericht_gegliedert_und_schlicht()
    {
        var zeilen = new List<IReadOnlyList<string>>();
        var arten = new List<string>();
        zeilen.Add(new[] { "Klasse 7a" }); arten.Add("gruppe");
        for (var k = 0; k < 4; k++)
        {
            for (var t = 0; t < 2; t++) { zeilen.Add(new[] { Namen[k], $"1{2 + t}.10.2026", "1", "6", t == 0 ? "1" : "0", "0", t == 0 ? "0" : "1", "" }); arten.Add(""); }
            zeilen.Add(new[] { Namen[k], "Summe", "2", "12", "1", "0", "1", "3" }); arten.Add("zwischensumme");
        }
        zeilen.Add(new[] { "Summe 7a", "", "8", "48", "4", "0", "4", "" }); arten.Add("summe");
        var pdf = PdfBericht.Erzeugen(Schule, "Fehltage pro Klasse", "Klasse 7a · Zeitraum 12.10.2026 – 16.10.2026",
            new[] { "Schüler*in", "Datum", "Fehltage", "Fehlstunden", "entsch.", "unent.", "offen", "Schultage" }, zeilen, "Fehltage: Tage mit mindestens einer Fehlstunde.", "Frau Lange", true, false, arten);
        Muster("web-bericht-fehltage", pdf);
        Pruefen(pdf, true, 1, "Fehltage pro Klasse", "Klasse 7a", "Summe 7a", "Ort, Datum", "Unterschrift", "Nur für den Dienstgebrauch", "von Frau Lange");

        // schlicht, Hochformat, viele Zeilen: Kopf auf jeder Seite, Zahl der Einträge
        var liste = Enumerable.Range(1, 90).Select(i => (IReadOnlyList<string>)new[] { $"{i:00}.10.2026", Namen[i % Namen.Length], "D", "Hausaufgabe vergessen" }).ToList();
        pdf = PdfBericht.Erzeugen(Schule, "Klassenbucheinträge", "Klasse 7a", new[] { "Datum", "Schüler*in", "Fach", "Eintrag" }, liste, null, "Herr Fischer", false, true);
        Muster("web-bericht-klassenbucheintraege", pdf);
        var text = Pruefen(pdf, false, 2, "90 Einträge", "Klassenbucheinträge", "Fortsetzung");
        Assert.Equal(PdfPruefung.Seitenzahl(pdf), PdfPruefung.Texte(pdf).Count(t => t.Contains("Datum Schüler*in Fach Eintrag")));
    }

    [Fact]
    public void Entschuldigung_und_Familienexport()
    {
        var zeilen = new List<IReadOnlyList<string>>
        {
            new[] { "12.10.2026 07:55", "14.10.2026 13:20", "16", "Krankheit", "offen", "Arztbesuch am Dienstag" },
            new[] { "19.10.2026 09:50", "19.10.2026 11:25", "2", "", "offen", "" },
        };
        var pdf = PdfBericht.Entschuldigung(Schule, "Lea Bauer", "7a", "12.10.2026 – 19.10.2026", zeilen, true, "Familie Bauer");
        Muster("web-entschuldigung", pdf);
        Pruefen(pdf, false, 1, "Entschuldigung", "Lea Bauer", "Hiermit entschuldige ich das Fehlen von Lea Bauer", "Grund des Fehlens:", "Erziehungsberechtigten", "Vermerk der Schule", "Eingegangen am");
        Assert.Equal(1, PdfPruefung.Seitenzahl(pdf));

        pdf = PdfBericht.Erzeugen(Schule, "Abwesenheiten", "Lea Bauer · Klasse 7a · Zeitraum 01.10.2026 – 31.10.2026", new[] { "Von", "Bis", "Abwesenheitsgrund", "Status", "Fehlstunden", "Fehlminuten", "Text" },
            zeilen.Select(z => (IReadOnlyList<string>)new[] { z[0], z[1], z[3], z[4], z[2], "720", z[5] }).ToList(), null, "Familie Bauer", false, false, vermerk: "");
        Muster("web-familie-abwesenheiten", pdf);
        var text = Pruefen(pdf, true, 1, "Abwesenheiten", "2 Einträge");
        Assert.DoesNotContain("Dienstgebrauch", text);
    }

    [Fact]
    public void Zugangsdaten_als_Karten()
    {
        var konten = Enumerable.Range(0, 12).Select(i => new PdfBericht.Zugang(Namen[i].Split(", ") is var n ? $"{n[1]} {n[0]}" : "", "7a", "Schüler*in", $"s{i + 100}", $"Start-{i * 37 % 100:00}x")).ToList();
        var pdf = PdfBericht.Zugangsdaten(Schule, "Zugangsdaten 7a", "https://eduorga.beispiel.de", konten, "Startpasswort bei der ersten Anmeldung ändern.", "admin");
        Muster("web-zugangsdaten", pdf);
        Pruefen(pdf, false, 2, "Zugangsdaten 7a", "Lea Bauer", "Benutzername", "s100", "Startpasswort", "Start-00x", "Vertraulich");
        Assert.Equal(2, PdfPruefung.Seitenzahl(pdf));
        Pruefen(PdfBericht.Zugangsdaten(Schule, "Zugang", "https://x", konten.Take(3).ToList(), "", null, false), true, 1, "s102");
    }

    [Fact]
    public void Sitzplan_vorne_und_hinten()
    {
        var plaetze = new List<(int, int, string?, string?, bool)>();
        var i = 0;
        for (var r = 1; r <= 4; r++)
            for (var sp = 1; sp <= 6; sp++)
                plaetze.Add((r, sp, i < Namen.Length && (r + sp) % 5 != 0 ? Namen[i++] : null, null, !(r == 4 && sp > 4)));
        var pdf = PdfBericht.Sitzplan(Schule, "Sitzplan", "Klasse 7a · Raum R105", 4, 6, false, plaetze, new[] { "Busch, Lina", "Engel, Ben" }, "Frau Lange");
        Muster("web-sitzplan", pdf);
        Pruefen(pdf, true, 1, "Sitzplan", "Lehrerpult / Tafel", "Bauer, Lea", "Ohne Platz:", "Busch, Lina");
        Pruefen(PdfBericht.Sitzplan(Schule, "Sitzplan", "", 4, 6, true, plaetze, Array.Empty<string>(), null, true), false, 1, "Lehrerpult / Tafel");
    }

    [Fact]
    public void Sprechtag_Terminplaene()
    {
        var zeilen = new List<IReadOnlyList<string>>();
        var arten = new List<string>();
        zeilen.Add(new[] { "Frau Lange (LAN) · Raum R105 · 4 Termine" }); arten.Add("gruppe");
        for (var m = 0; m < 12; m++)
        {
            var b = new TimeOnly(15, 0).AddMinutes(10 * m);
            var gebucht = m % 3 != 2;
            zeilen.Add(new[] { $"{b:HH:mm}–{b.AddMinutes(10):HH:mm}", gebucht ? Namen[m] : "", gebucht ? "7a" : "", gebucht ? "Familie " + Namen[m].Split(',')[0] : "", m == 0 ? "Zeugnis" : "" });
            arten.Add("");
        }
        var pdf = PdfBericht.Erzeugen(Schule, "Terminplan Frau Lange", "Elternsprechtag · Mittwoch, 21.10.2026 · 15:00–17:00 Uhr", new[] { "Zeit", "Schüler*in", "Klasse", "Gebucht von", "Bemerkung" },
            zeilen, "Freie Zeilen: Erziehungsberechtigte ohne Termin können sich hier spontan eintragen.", "Frau Lange", false, true, arten, PdfBericht.Dienstgebrauch, true);
        Muster("web-sprechtag-lehrkraft", pdf);
        Pruefen(pdf, false, 1, "Terminplan Frau Lange", "15:00–15:10", "Raum R105", "Freie Zeilen");

        var eltern = new List<IReadOnlyList<string>>
        {
            new[] { "15:00–15:10", "Frau Lange", "R105", "Lea Bauer", "7a", "" },
            new[] { "15:30–15:40", "Herr Fischer", "online", "Lea Bauer", "7a", "Videokonferenz" },
            new[] { "16:10–16:20", "Frau Meyer", "R203", "Paul Bauer", "5b", "" },
        };
        pdf = PdfBericht.Erzeugen(Schule, "Meine Termine am Sprechtag", "Elternsprechtag · Mittwoch, 21.10.2026 · Hauptgebäude", new[] { "Zeit", "Lehrkraft", "Raum", "Kind", "Klasse", "Bemerkung" },
            eltern, "Bitte erscheinen Sie einige Minuten vor Ihrem Termin.", "Familie Bauer", false, true, vermerk: "");
        Muster("web-sprechtag-eltern", pdf);
        Pruefen(pdf, false, 1, "Meine Termine am Sprechtag", "Herr Fischer", "3 Einträge");
    }

    private static Vertretungstag Tag(string datum, string wochentag) => new(datum, wochentag, "A-Woche", false, null,
        new List<string> { "Ab der 6. Stunde Schulversammlung in der Aula." }, new List<string> { "9b (1–4)" }, new List<string> { "RIC", "BRA" }, new List<string> { "R105" },
        new List<string> { "Wandertag (ganztägig, 6a)" },
        new List<Vertretungszeile>
        {
            new("5a", "2", 2, "SP", null, "BEC", "RIC", "TH1", null, "Vertretung", "", "", "", "geaendert"),
            new("5a", "5–6", 5, "D", null, "", "RIC", "R101", null, "Entfall", "", "", "", "entfall"),
            new("6b", "3", 3, "E", "F", "MUE", "BRA", "R204", "R203", "Vertretung", "Aufgaben im Lernportal", "", "", "geaendert"),
            new("7a", "4", 4, "M", null, "???", "BRA", "R105", null, "Vertretung", "", "", "", "offen"),
        });

    [Fact]
    public void Vertretungsplan_Aushang()
    {
        var tage = new[] { Tag("2026-10-14", "Mittwoch"), Tag("2026-10-15", "Donnerstag") };
        var pdf = PdfBericht.Vertretungsplan(Schule, tage, true, false, "admin");
        Muster("web-vertretungsplan-lehrkraefte", pdf);
        var text = Pruefen(pdf, false, 2, "Mittwoch, 14. Oktober 2026", "Donnerstag, 15. Oktober 2026", "Vertretungsplan Lehrkräfte", "A-Woche", "Mitteilungen",
            "Abwesende Lehrkräfte", "entfällt", "E statt F", "R204 statt R203", "Std.", "Fach", "Lehrkraft", "Vertretung", "Raum", "Art", "Bemerkung");
        pdf = PdfBericht.Vertretungsplan(Schule, tage.Take(1).ToList(), false, true, "7a");
        Muster("web-vertretungsplan-aushang-gross", pdf);
        text = Pruefen(pdf, true, 1, "Vertretungsplan", "entfällt");
        Assert.DoesNotContain("Lehrkraft", text.Split("Std.")[1].Split('\n')[0]);
    }

    [Fact]
    public async Task Vertretungsplan_ueber_die_Schnittstelle()
    {
        await using var s = await Testserver.StartenAsync();
        var lan = await s.AlsAsync("lan", "lehrer", "LAN");
        var r = await lan.GetAsync("/api/app/vertretungen.pdf?tage=2");
        Assert.Equal("application/pdf", r.Content.Headers.ContentType!.MediaType);
        var pdf = await r.Content.ReadAsByteArrayAsync();
        Assert.Contains("Vertretungsplan", PdfPruefung.Text(pdf));
        Assert.True(PdfPruefung.Seitenzahl(pdf) >= 2);
        var gross = await lan.GetByteArrayAsync("/api/app/vertretungen.pdf?gross=true");
        Assert.True(PdfPruefung.Seitengroessen(gross).All(g => g.Breite > g.Hoehe));
    }
}
