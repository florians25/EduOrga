using UntPlan.Core;
using UntPlan.Core.Model;
using UntPlan.Core.Module;
using UntPlan.Core.Optimierung;
using UntPlan.Core.Vertretungsplanung;
using UntPlan.Druck;
using UntPlanStudio.Api;
using UntPlanStudio.Dienste;

namespace UntPlanStudio.Tests;

/// <summary>
/// Alle PDF-Ausgaben des Studios im gemeinsamen Druckdesign (UntPlan.Druck): Stundenpläne (Klasse, Lehrkraft, Raum, Fach, kompakt,
/// Woche mit Änderungen, Grautöne), Übersichtsplan, Vertretungsplan-Aushang (Klassen, Lehrkräfte, große Schrift) und jeder Bericht.
/// Geprüft werden Aufbau (Kopf, Seitenzahl, Format) und Inhalt über die Textebene. Mit der Umgebungsvariablen EDUORGA_DRUCKMUSTER
/// (Ordner) werden die Dateien als Muster gespeichert (docs/bilder/druck).
/// </summary>
public sealed class DruckPdfTests
{
    private static readonly DateOnly Tag = new(2026, 10, 14);
    private static Dokument? _doc;

    /// <summary>Beispielschule mit Plan, Abwesenheiten und Vertretungen am 14.10.2026, einer Klausur und Pausenaufsichten.</summary>
    private static Dokument Beispiel()
    {
        lock (typeof(DruckPdfTests))
        {
            if (_doc != null) return _doc;
            var d = Demo.Beispielschule();
            var erg = Optimierer.Optimieren(d, new OptimierungsOptionen { AnzahlPlaene = 1, Schritte = 1, Seed = 1 });
            if (erg.Count > 0) d.AktivePeriode.Plan = erg[0].Plan;
            var ix = new DatenIndex(d);
            // zwei abwesende Lehrkräfte mit Unterricht am Tag
            var tagIndex = Kalender.TagIndex(d, Tag);
            var lehrer = d.AktivePeriode.Plan.Where(p => p.Tag == tagIndex).SelectMany(p => ix.Unterrichte[p.UnterrichtId].Zeilen.Select(z => z.LehrerId))
                .Where(x => x.HasValue).Select(x => x!.Value).Distinct().Take(2).ToList();
            foreach (var l in lehrer)
                d.Abwesenheiten.Add(new Abwesenheit { Id = d.NeueId(), Art = AbwesenheitsArt.Lehrer, ElementId = l, Von = Tag, Bis = Tag, Text = "Fortbildung" });
            Vertretungen.Aktualisieren(d, Tag);
            var am = Vertretungen.Am(d, Tag).Where(v => v.UnterrichtId.HasValue).ToList();
            var frei = d.Lehrer.Where(l => !lehrer.Contains(l.Id)).ToList();
            // je Klasse abwechselnd: Vertretung, Entfall, Vertretung mit Raumänderung
            var nr = new Dictionary<int, int>();
            for (var i = 0; i < am.Count; i++)
            {
                var v = am[i];
                var k = v.KlassenIds.FirstOrDefault();
                var j = nr[k] = nr.GetValueOrDefault(k, -1) + 1;
                if (j % 3 == 1) { v.Art = VertretungsArt.Entfall; v.VertreterId = null; continue; }
                Vertretungen.VertreterSetzen(d, v, frei[i % frei.Count].Id);
                if (j % 3 == 2) { v.VertretungsraumId = d.Raeume[(i + 3) % d.Raeume.Count].Id; v.Text = "Aufgaben im Lernportal"; }
            }
            var klasse = d.Klassen.First();
            d.Klausuren.Add(new Klausur { Id = d.NeueId(), Name = "Klausur Deutsch", Datum = Tag.AddDays(1), StundeVon = 3, StundeBis = 4, KlassenIds = { klasse.Id },
                LehrerIds = { d.Lehrer[0].Id }, RaumIds = { d.Raeume[0].Id }, Text = "Wörterbuch erlaubt" });
            // Pausenaufsichten: jede Aufsichtspause im ersten Bereich besetzen
            var lehrerListe = d.Lehrer.Where(l => !l.Ignorieren).ToList();
            var n = 0;
            foreach (var g in d.Gaenge)
                foreach (var p in Pausenaufsichten.AufsichtsPausen(d))
                    for (var t = 0; t < d.Zeitraster.TageProWoche; t++)
                        if (n++ % 4 != 3) d.Pausenaufsichten.Add(new Pausenaufsicht { GangId = g.Id, Tag = t, NachStunde = p.NachStunde, LehrerId = lehrerListe[n % lehrerListe.Count].Id });
            d.Tagestexte.Add(new Tagestext { Datum = Tag, Text = "Ab der 6. Stunde findet in der Aula die Schulversammlung statt. Bitte pünktlich erscheinen." });
            _doc = new Dokument(d);
            return _doc;
        }
    }

    private static void Muster(string name, byte[] pdf)
    {
        var ordner = Environment.GetEnvironmentVariable("EDUORGA_DRUCKMUSTER");
        if (string.IsNullOrWhiteSpace(ordner)) return;
        Directory.CreateDirectory(ordner);
        File.WriteAllBytes(Path.Combine(ordner, name + ".pdf"), pdf);
    }

    /// <summary>Gemeinsamer Aufbau: PDF 1.4, A4, Kopf mit Schule und „Seite x von y“, Fuß mit Druckdatum und „EduOrga“.</summary>
    private static string Pruefen(byte[] pdf, bool quer, int minSeiten = 1, params string[] inhalt)
    {
        Assert.Equal("%PDF-1.4", System.Text.Encoding.ASCII.GetString(pdf, 0, 8));
        var seiten = PdfPruefung.Seitenzahl(pdf);
        Assert.True(seiten >= minSeiten, $"{seiten} Seiten statt mindestens {minSeiten}");
        foreach (var (b, h) in PdfPruefung.Seitengroessen(pdf))
        {
            Assert.Equal(quer ? 841.89f : 595.28f, b, 0.1f);
            Assert.Equal(quer ? 595.28f : 841.89f, h, 0.1f);
        }
        var texte = PdfPruefung.Texte(pdf);
        Assert.Equal(seiten, texte.Count);
        var schule = Beispiel().Daten.Einstellungen.Schulname;
        for (var i = 0; i < texte.Count; i++)
        {
            Assert.Contains(schule, texte[i]);
            Assert.Contains($"Seite {i + 1} von {seiten}", texte[i]);
            Assert.Contains("Gedruckt am", texte[i]);
            Assert.Contains("Edu Orga", texte[i]);
        }
        var alles = string.Join("\n", texte);
        foreach (var t in inhalt) Assert.True(alles.Contains(t), $"„{t}“ fehlt im Text:\n{alles[..Math.Min(alles.Length, 3000)]}");
        // eingebettete Schrift, keine Farben (nur Graustufen-Operatoren)
        var roh = System.Text.Encoding.Latin1.GetString(pdf);
        Assert.Contains("/FontFile2", roh);
        Assert.Contains("/BaseFont /IBMPlexSans", roh);
        return alles;
    }

    [Fact]
    public void Stundenplaene_in_allen_Arten()
    {
        var doc = Beispiel();
        var d = doc.Daten;
        var ix = doc.Index;
        var klasse = Stammdaten.Sortiert(d, ElementTyp.Klasse).First();
        var lehrer = Stammdaten.Sortiert(d, ElementTyp.Lehrer).Where(l => ix.PlanVon(ElementTyp.Lehrer, l.Id).Any()).Take(4).ToList();
        var raum = Stammdaten.Sortiert(d, ElementTyp.Raum).First(r => ix.PlanVon(ElementTyp.Raum, r.Id).Any());
        var fach = Stammdaten.Sortiert(d, ElementTyp.Fach).First(f => ix.PlanVon(ElementTyp.Fach, f.Id).Any());

        var pdf = StundenplanPdf.Erzeugen(d, ix, ElementTyp.Klasse, new[] { klasse.Id }, new StundenplanDruckOptionen { Ersteller = "admin" });
        var text = Pruefen(pdf, true, 1, $"Stundenplan Klasse {klasse.Kurzname}", "Montag", "Freitag", "Unterricht", "Summe", "von admin");
        Assert.Equal(1, PdfPruefung.Seitenzahl(pdf));
        Assert.Contains(ix.KFach(ix.PlanVon(ElementTyp.Klasse, klasse.Id).Select(p => ix.Unterrichte[p.UnterrichtId].Zeilen[0].FachId).First()), text);
        Muster("stundenplan-klasse", pdf);

        pdf = StundenplanPdf.Erzeugen(d, ix, ElementTyp.Lehrer, new[] { lehrer[0].Id }, new StundenplanDruckOptionen());
        Muster("stundenplan-lehrkraft", pdf);
        Pruefen(pdf, true, 1, $"Stundenplan Lehrkraft {lehrer[0].Kurzname}", ((Lehrer)lehrer[0]).VollerName);

        pdf = StundenplanPdf.Erzeugen(d, ix, ElementTyp.Raum, new[] { raum.Id }, new StundenplanDruckOptionen { Farbig = true });
        Muster("stundenplan-raum-grautoene", pdf);
        Pruefen(pdf, true, 1, $"Stundenplan Raum {raum.Kurzname}");

        pdf = StundenplanPdf.Erzeugen(d, ix, ElementTyp.Fach, new[] { fach.Id }, new StundenplanDruckOptionen());
        Pruefen(pdf, true, 1, $"Stundenplan Fach {fach.Kurzname}");

        // kompakt: zwei Pläne je Seite
        pdf = StundenplanPdf.Erzeugen(d, ix, ElementTyp.Lehrer, lehrer.Select(l => l.Id).ToList(), new StundenplanDruckOptionen { Kompakt = true });
        Pruefen(pdf, true, 2, "Stundenpläne Lehrkräfte", $"Lehrkraft {lehrer[1].Kurzname}", $"Lehrkraft {lehrer[3].Kurzname}");
        Assert.Equal(2, PdfPruefung.Seitenzahl(pdf));
        Muster("stundenplan-kompakt", pdf);

        // Woche mit Änderungen: Entfall, Vertretung, Prüfung mit Legende
        var betroffen = Vertretungen.Am(d, Tag).Where(v => v.UnterrichtId.HasValue).SelectMany(v => v.KlassenIds).Distinct().ToList();
        var kw = Stammdaten.Sortiert(d, ElementTyp.Klasse).First(k => betroffen.Contains(k.Id));
        pdf = StundenplanPdf.Erzeugen(d, ix, ElementTyp.Klasse, new[] { kw.Id, klasse.Id }, new StundenplanDruckOptionen { Woche = Tag });
        text = Pruefen(pdf, true, 2, "Woche vom 12.10.2026 bis 16.10.2026", "14.10.", "Zeichen:");
        Assert.True(text.Contains("entfällt") || text.Contains("»"), "Änderungen gekennzeichnet");
        Assert.Contains("Prüfung", text);
        Muster("stundenplan-woche-aenderungen", pdf);

        // leere Auswahl
        Pruefen(StundenplanPdf.Erzeugen(d, ix, ElementTyp.Klasse, Array.Empty<int>(), new StundenplanDruckOptionen()), true, 1, "Keine Elemente gewählt.");
    }

    [Fact]
    public void Uebersichtsplan_und_Vertretungsplan()
    {
        var doc = Beispiel();
        var d = doc.Daten;
        var ix = doc.Index;
        var belegung = UebersichtApi.Belegung(d, ix, ElementTyp.Lehrer, UebersichtApi.Inhalt.Standard);
        var pdf = ListenPdf.Uebersicht(d, ix, ElementTyp.Lehrer, Stammdaten.Sortiert(d, ElementTyp.Lehrer).ToList(), e => UebersichtApi.Zellen(belegung.GetValueOrDefault(e.Id)), "admin");
        Muster("uebersichtsplan-lehrer", pdf);
        Pruefen(pdf, true, 1, "Übersichtsplan Lehrer", "Montag", d.Lehrer[0].Kurzname);

        var layout = AushangLayout.Lesen(d);
        pdf = VertretungsplanPdf.Erzeugen(doc, Tag, Tag, false, layout, "admin");
        var text = Pruefen(pdf, false, 1, "Mittwoch, 14. Oktober 2026", "Vertretungsplan Klassen", "Mitteilungen", "Schulversammlung", "Std.", "Klasse", "Fach", "Lehrkraft", "Vertretung", "Raum", "Art", "Bemerkung");
        Assert.Contains("entfällt", text);
        Muster("vertretungsplan-klassen", pdf);

        pdf = VertretungsplanPdf.Erzeugen(doc, Tag, Tag.AddDays(1), true, layout, "admin");
        Muster("vertretungsplan-lehrkraefte", pdf);
        text = Pruefen(pdf, false, 2, "Mittwoch, 14. Oktober 2026", "Vertretungsplan Lehrkräfte", "Donnerstag, 15. Oktober 2026", "Abwesende Lehrer", "Nur für den Dienstgebrauch");

        pdf = VertretungsplanPdf.Erzeugen(doc, Tag, Tag, false, layout, "admin", gross: true);
        Muster("vertretungsplan-aushang-gross", pdf);
        Pruefen(pdf, true, 1, "Mittwoch, 14. Oktober 2026", "Vertretungsplan Klassen", "entfällt");
    }

    [Fact]
    public void Alle_Berichte_als_Pdf()
    {
        var doc = Beispiel();
        var d = doc.Daten;
        foreach (var info in DruckApi.Berichte)
        {
            var b = DruckApi.BerichtErzeugen(d, doc.Index, info.Id, info.Zeitraum ? Tag.AddDays(-7) : d.Einstellungen.SchuljahrVon, info.Zeitraum ? Tag.AddDays(7) : d.Einstellungen.SchuljahrBis);
            var pdf = ListenPdf.Bericht(d, b, "admin");
            Muster($"bericht-{info.Id}", pdf);
            var text = Pruefen(pdf, b.Quer, 1, b.Titel);
            foreach (var sp in b.Spalten.Where(s => s.Length > 0 && !s.Contains(' ')).Take(3)) Assert.True(text.Contains(sp), $"Spalte „{sp}“ fehlt in {info.Id}:\n{text}");
        }
        // Inhalte einzelner Berichte
        var ber = DruckApi.BerichtErzeugen(d, doc.Index, "pausenaufsicht", d.Einstellungen.SchuljahrVon, d.Einstellungen.SchuljahrBis);
        Assert.Contains(ber.Zeilen, z => z.Count > 2 && z.Skip(2).Any(x => x.Length > 1 && x != "???" && x != "–"));
        var kl = DruckApi.BerichtErzeugen(d, doc.Index, "klausuren", Tag, Tag.AddDays(3));
        Assert.Contains(kl.Zeilen, z => z.Contains("Klausur Deutsch"));
        var pdf2 = ListenPdf.Bericht(d, kl);
        Assert.Contains("Wörterbuch erlaubt", PdfPruefung.Text(pdf2));
    }
}
