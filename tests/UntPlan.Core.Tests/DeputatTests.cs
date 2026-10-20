using UntPlan.Core;
using UntPlan.Core.Model;
using UntPlan.Core.Module;
using Xunit;

namespace UntPlan.Core.Tests;

/// <summary>Deputatsrechnung nach NRW-Regeln (VO zu § 93 Abs. 2 SchulG) und Unterrichtsverteilung.</summary>
public class DeputatTests
{
    private static readonly DateOnly Sj2026 = new(2026, 8, 1);

    [Theory]
    [InlineData(1957, 7, 25, 2012, true)]   // Beispiel Bezirksregierung Münster: ab 01.08.2012
    [InlineData(1957, 8, 2, 2012, false)]   // … geb. 02.08.1957: erst ab 01.08.2013
    [InlineData(1957, 8, 2, 2013, true)]
    [InlineData(1957, 8, 1, 2012, true)]    // Vollendung mit Ablauf des 31.07. → schon ab 01.08.2012
    public void Altersgrenze_gilt_ab_dem_Schuljahr_nach_Vollendung(int j, int m, int t, int sjJahr, bool erwartet)
    {
        Assert.Equal(erwartet, Deputat.Vollendet(new DateOnly(j, m, t), 55, new DateOnly(sjJahr, 8, 1)));
    }

    [Theory]
    [InlineData(false, false, 1.0, true, 0)]
    [InlineData(true, false, 1.0, true, 1)]
    [InlineData(true, false, 0.6, false, 0.5)]
    [InlineData(true, false, 0.4, false, 0)]
    [InlineData(true, true, 1.0, true, 3)]
    [InlineData(true, true, 0.8, false, 2)]
    [InlineData(true, true, 0.75, false, 2)]
    [InlineData(true, true, 0.74, false, 1.5)]
    [InlineData(true, true, 0.5, false, 1.5)]
    [InlineData(true, true, 0.49, false, 0)]
    public void Altersermaessigung_NRW(bool ab55, bool ab60, double anteil, bool vollzeit, double erwartet)
    {
        Assert.Equal((decimal)erwartet, Deputat.AltersermaessigungNrw(ab55, ab60, (decimal)anteil, vollzeit));
    }

    [Theory]
    [InlineData(40, 1.0, true, 0)]
    [InlineData(50, 1.0, true, 2)]
    [InlineData(50, 0.5, false, 1)]
    [InlineData(70, 1.0, true, 3)]
    [InlineData(70, 0.8, false, 2)]
    [InlineData(70, 0.6, false, 1.5)]
    [InlineData(90, 1.0, true, 4)]
    [InlineData(100, 0.75, false, 3)]
    [InlineData(90, 0.5, false, 2)]
    [InlineData(90, 0.3, false, 0)]
    public void Schwerbehindertenermaessigung_NRW(int gdb, double anteil, bool vollzeit, double erwartet)
    {
        Assert.Equal((decimal)erwartet, Deputat.SchwerbehinderungNrw(gdb, (decimal)anteil, vollzeit));
    }

    [Theory]
    [InlineData(0, false, false, 0)]
    [InlineData(12, true, false, 19)]     // 9 + 8,4 = 17,4 → 17, Grundschule + 2
    [InlineData(12, true, true, 20)]      // offener Ganztag + 1
    [InlineData(40, false, false, 37)]
    [InlineData(60, false, false, 47)]    // 9 + 35 + 3
    [InlineData(10.5, false, false, 16)]  // 9 + 7,35 = 16,35 → 16
    [InlineData(15, false, true, 20)]     // 9 + 10,5 = 19,5 → 20 (offener Ganztag nur Grundschule)
    public void Leitungszeit_NRW(double stellen, bool gs, bool ogs, double erwartet)
    {
        Assert.Equal((decimal)erwartet, Deputat.LeitungszeitNrw((decimal)stellen, gs, ogs));
    }

    [Fact]
    public void Anrechnungstopf_NRW_je_Schulform()
    {
        Assert.Equal(14, Deputat.AnrechnungstopfNrw("RS", 28.5m, 0));      // 14,25 → 14
        Assert.Equal(3, Deputat.AnrechnungstopfNrw("GS", 15, 0));         // 0,2 je Stelle
        Assert.Equal(20 + 18, Deputat.AnrechnungstopfNrw("GY", 40, 15));  // 0,5 Sek I + 1,2 Sek II
        Assert.Equal(6, Deputat.AnrechnungstopfNrw("HS", 10, 0));         // 0,6
    }

    private static (Schuldatei d, Lehrer l) Schule(decimal wochensoll, string schulform = "GY")
    {
        var d = Demo.NeueDatei("Test", schulform);
        d.Einstellungen.SchuljahrVon = new DateOnly(2026, 9, 2);
        var l = new Lehrer { Id = d.NeueId(), Kurzname = "ABC", Wochensoll = wochensoll };
        d.Lehrer.Add(l);
        return (d, l);
    }

    [Fact]
    public void Vollzeit_mit_Alter_60_und_GdB_50()
    {
        var (d, l) = Schule(25.5m);
        l.Geburtsdatum = new DateOnly(1965, 3, 1); // 60 vollendet am 28.02.2025
        l.Gdb = 50;
        var x = Deputat.Berechnen(d, new DatenIndex(d), l);
        Assert.Equal(25.5m, x.Pflichtstunden);
        Assert.True(x.Vollzeit);
        Assert.Equal(3, x.Altersermaessigung);
        Assert.Equal(2, x.Schwerbehinderung);
        Assert.Equal(20.5m, x.Soll);
        Assert.Equal(61, x.Alter);
    }

    [Fact]
    public void Teilzeit_eine_Stunde_unter_Pflichtstunden_gilt_als_voll()
    {
        var (d, l) = Schule(24.5m);
        l.Geburtsdatum = new DateOnly(1970, 1, 1); // 56
        var x = Deputat.Berechnen(d, new DatenIndex(d), l);
        Assert.True(x.Vollzeit);
        Assert.Equal(1, x.Altersermaessigung);
        Assert.Equal(23.5m, x.Soll);
    }

    [Fact]
    public void Teilzeit_halbe_Stelle_ab_55()
    {
        var (d, l) = Schule(14m, "GS"); // 14/28 = 50 %
        l.Geburtsdatum = new DateOnly(1970, 6, 1);
        var x = Deputat.Berechnen(d, new DatenIndex(d), l);
        Assert.Equal(28, x.Pflichtstunden);
        Assert.False(x.Vollzeit);
        Assert.Equal(0.5m, x.Altersermaessigung);
        Assert.Equal(13.5m, x.Soll);
    }

    [Fact]
    public void Manuelle_Altersermaessigung_wird_nicht_doppelt_gezaehlt()
    {
        var (d, l) = Schule(25.5m);
        l.Geburtsdatum = new DateOnly(1960, 1, 1);
        l.Ermaessigungen.Add(new Ermaessigung { Grund = "Altersermäßigung", Wert = 3 });
        var x = Deputat.Berechnen(d, new DatenIndex(d), l);
        Assert.Equal(0, x.Altersermaessigung);
        Assert.Equal(3, x.SonstigeErmaessigung);
        Assert.Equal(22.5m, x.Soll);
    }

    [Fact]
    public void Verzicht_Profil_Allgemein_und_Geburtsjahr()
    {
        var (d, l) = Schule(25.5m);
        l.Geburtsjahr = 1971; // 2026 − 1971 = 55: Geburtstag unbekannt → noch nicht sicher
        var x = Deputat.Berechnen(d, new DatenIndex(d), l);
        Assert.Equal(0, x.Altersermaessigung);
        Assert.Contains(x.Hinweise, h => h.Contains("Geburtsjahr"));
        l.Geburtsjahr = 1970;
        Assert.Equal(1, Deputat.Berechnen(d, new DatenIndex(d), l).Altersermaessigung);
        l.OhneAltersermaessigung = true;
        Assert.Equal(0, Deputat.Berechnen(d, new DatenIndex(d), l).Altersermaessigung);
        l.OhneAltersermaessigung = false;
        d.Einstellungen.Deputat.Bundesland = "Allgemein";
        Assert.Equal(0, Deputat.Berechnen(d, new DatenIndex(d), l).Altersermaessigung);
    }

    [Fact]
    public void Anrechnung_Leitung_Mehrarbeit_und_Untergrenze()
    {
        var (d, l) = Schule(25.5m);
        l.Ermaessigungen.Add(new Ermaessigung { Grund = "Schulleitung", Wert = 18 });
        l.Ermaessigungen.Add(new Ermaessigung { Grund = "Oberstufenkoordination", Wert = 3, Art = "Anrechnung" });
        l.Mehrarbeit = 1;
        var x = Deputat.Berechnen(d, new DatenIndex(d), l);
        Assert.Equal(18, x.Leitung);
        Assert.Equal(3, x.Anrechnung);
        Assert.Equal(5.5m, x.Soll);
        l.Ermaessigungen.Add(new Ermaessigung { Grund = "Sonderaufgabe", Wert = 10 });
        x = Deputat.Berechnen(d, new DatenIndex(d), l);
        Assert.Equal(0, x.Soll);
        Assert.Contains(x.Hinweise, h => h.Contains("übersteigen"));
    }

    [Fact]
    public void Abweichende_Pflichtstunden_und_Teilzeitanteil()
    {
        var (d, l) = Schule(22.5m, "BK");
        l.PflichtstundenAbweichend = 30; // Werkstattlehrkraft
        var x = Deputat.Berechnen(d, new DatenIndex(d), l);
        Assert.Equal(30, x.Pflichtstunden);
        Assert.Equal(0.75m, x.Anteil);
        Assert.False(x.Vollzeit);
    }

    [Fact]
    public void Wertrechnung_bleibt_ohne_neue_Angaben_gleich()
    {
        var d = Demo.Beispielschule();
        foreach (var w in Wertrechnung.Uebersicht(d))
            Assert.Equal(Math.Max(0, w.Lehrer.Wochensoll - w.Lehrer.SummeErmaessigungen), w.Soll);
    }

    [Fact]
    public void Verteilung_Matrix_Kopplung_Zuweisen_und_Summen()
    {
        var d = Demo.Beispielschule();
        var ix = new DatenIndex(d);
        var matrix = Deputat.Matrix(d, ix, nachFach: false);
        foreach (var l in d.Lehrer.Where(l => !l.Ignorieren))
        {
            var zeile = matrix.Where(m => m.Key.Lehrer == l.Id).Sum(m => m.Value);
            Assert.Equal(Wertrechnung.Ist(d, ix, l) - l.Wertkorrektur, zeile, 6);
        }
        // offene Zeile anlegen und zuweisen
        var u = d.Unterrichte.First(u => u.Zeilen.Count == 1 && u.Zeilen[0].LehrerId.HasValue);
        var lehrer = u.Zeilen[0].LehrerId!.Value;
        u.Zeilen.Add(new Kopplungszeile { FachId = u.Zeilen[0].FachId, KlassenIds = u.Zeilen[0].KlassenIds.ToList() });
        ix = new DatenIndex(d);
        Assert.Contains(Deputat.Offen(d, ix), o => o.Unterricht == u && o.Zeile == 1);
        Assert.Throws<InvalidOperationException>(() => Deputat.Zuweisen(d, u.Id, 1, lehrer));
        var anderer = d.Lehrer.First(l => l.Id != lehrer).Id;
        Deputat.Zuweisen(d, u.Id, 1, anderer);
        Assert.Equal(anderer, u.Zeilen[1].LehrerId);
        Deputat.Zuweisen(d, u.Id, 1, null);
        Assert.Null(u.Zeilen[1].LehrerId);

        var liste = Deputat.Alle(d, new DatenIndex(d));
        var s = Deputat.Summen(d, new DatenIndex(d), liste);
        Assert.True(s.GrundstellenGeschaetzt);
        Assert.True(s.Offen > 0);
        Assert.Equal(liste.Sum(x => x.Soll), s.Soll);
        Assert.True(s.LeitungVerfuegbar >= 9);
    }

    [Fact]
    public void Kontingente_G9_und_UVD_Export()
    {
        var d = Demo.Beispielschule();
        var deutsch = d.Faecher.First(f => f.Kurzname == "D");
        d.Stundentafel.Clear();
        foreach (var j in new[] { "5", "6", "7", "8", "9", "10" })
            d.Stundentafel.Add(new StundentafelZeile { Jahrgang = j, FachId = deutsch.Id, Stunden = j is "5" or "6" ? 4.5m : 3.25m });
        var p = Deputat.KontingentePruefenG9(d, out var summe);
        Assert.DoesNotContain(p, x => x.Lernbereich == "Deutsch");
        Assert.Contains(p, x => x.Lernbereich == "Mathematik" && x.Stufe == "5/6" && x.Soll == 9 && x.Ist == 0);
        Assert.Equal(22, summe);

        var uvd = Deputat.UvdText(d);
        Assert.StartsWith("\"Klasse\";\"Jahrgang\";\"Kursart\";\"WoStd\";\"Fach\";\"Lehrer\";\"Kurs\"", uvd);
        Assert.True(uvd.Split("\r\n", StringSplitOptions.RemoveEmptyEntries).Length > 10);
        Assert.Equal(16, Deputat.Tabelle(d)[0].Length);
    }

    [Fact]
    public void Altdatei_ohne_Deputatsabschnitt_wird_gelesen()
    {
        var json = "{\"Version\":1,\"Einstellungen\":{\"Schulform\":\"GS\"},\"Lehrer\":[{\"Id\":1,\"Kurzname\":\"A\",\"Wochensoll\":28,\"Ermaessigungen\":[{\"Grund\":\"x\",\"Wert\":1}]}]}";
        var doc = Dokument.Laden(System.Text.Encoding.UTF8.GetBytes(json));
        Assert.Equal("NW", doc.Daten.Einstellungen.Deputat.Bundesland);
        Assert.Equal(0, doc.Daten.Lehrer[0].Gdb);
        Assert.Equal("", doc.Daten.Lehrer[0].Ermaessigungen[0].Art);
        Assert.Equal(27, Deputat.Soll(doc.Daten, new DatenIndex(doc.Daten), doc.Daten.Lehrer[0]));
    }
}
