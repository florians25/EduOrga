using UntPlan.Druck;

namespace UntPlan.Druck.Tests;

/// <summary>Grundbausteine der gemeinsamen PDF-Ausgabe: Schrift, Textebene, Seitenrahmen, Tabellen, Stundenraster, Aushang.</summary>
public class DruckTests
{
    private static Kopfdaten Kopf(string titel = "Testdruck") => new() { Schule = "Gesamtschule Musterstadt", Schulzusatz = "Schulweg 1", Titel = titel, Untertitel = "Zeitraum 01.10.–31.10.2026", RechtsOben = "Schuljahr 2026/27", Ersteller = "admin" };

    [Fact]
    public void Schrift_eingebettet_Text_lesbar_mit_Umlauten_und_Ersatzzeichen()
    {
        var f = new Formular(Kopf("Prüfung – „Größe“ äöüß €"), false);
        f.NeueSeite();
        f.Absatz("Pfeil → Haken ✓ Gedankenstrich – Auslassung …");
        var pdf = f.Erzeugen();
        Assert.Equal("%PDF-1.4", System.Text.Encoding.ASCII.GetString(pdf, 0, 8));
        Assert.EndsWith("%%EOF\n", System.Text.Encoding.Latin1.GetString(pdf));
        var text = PdfPruefung.Text(pdf);
        Assert.Contains("Prüfung – „Größe“ äöüß €", text);
        Assert.Contains("Pfeil -> Haken x Gedankenstrich – Auslassung …", text);
        Assert.Contains("Seite 1 von 1", text);
        Assert.Contains("Gedruckt am", text);
        Assert.Contains("Edu Orga", text);
        var roh = System.Text.Encoding.Latin1.GetString(pdf);
        Assert.Contains("/FontFile2", roh);
        Assert.Contains("/ToUnicode", roh);
        // nur Graustufen: keine RGB-Farboperatoren
        Assert.DoesNotContain(" rg", PdfInhalt(pdf));
        Assert.DoesNotContain(" RG", PdfInhalt(pdf));
    }

    private static string PdfInhalt(byte[] pdf)
    {
        var sb = new System.Text.StringBuilder();
        var t = System.Text.Encoding.Latin1.GetString(pdf);
        var i = 0;
        while ((i = t.IndexOf("/FlateDecode >>\nstream\n", i, StringComparison.Ordinal)) >= 0)
        {
            var start = i + 23;
            var ende = t.IndexOf("\nendstream", start, StringComparison.Ordinal);
            try
            {
                using var z = new System.IO.Compression.ZLibStream(new MemoryStream(pdf, start, ende - start), System.IO.Compression.CompressionMode.Decompress);
                using var ms = new MemoryStream();
                z.CopyTo(ms);
                var s = System.Text.Encoding.Latin1.GetString(ms.ToArray());
                if (s.Contains(" Tf ")) sb.Append(s);
            }
            catch (InvalidDataException) { }
            i = ende;
        }
        return sb.ToString();
    }

    [Fact]
    public void Tabelle_mit_Seitenumbruch_wiederholt_Kopf_und_Gruppe()
    {
        var f = new Formular(Kopf("Lange Liste"), false);
        f.NeueSeite();
        var t = new Tabelle("Nr.", "Name", "Betrag") { Anzahl = true };
        t.Gruppe("Gruppe A");
        for (var i = 1; i <= 120; i++) t.Zeile(i.ToString(), $"Eintrag {i}", $"{i * 1.5:0.0}".Replace('.', ','));
        t.Summe("", "Summe", "10.890,0");
        f.Tabelle(t);
        var pdf = f.Erzeugen();
        var seiten = PdfPruefung.Texte(pdf);
        Assert.True(seiten.Count >= 3);
        Assert.All(seiten, s => Assert.Contains("Nr. Name Betrag", s));
        Assert.Contains("Gruppe A (Fortsetzung)", seiten[1]);
        Assert.Contains("Lange Liste · Zeitraum 01.10.–31.10.2026", seiten[1]);
        Assert.Contains("120 Einträge", seiten[^1]);
        Assert.Contains($"Seite {seiten.Count} von {seiten.Count}", seiten[^1]);
    }

    [Fact]
    public void Spaltenbreiten_fuellen_die_Tabelle_ohne_Worte_zu_zerschneiden()
    {
        var t = new Tabelle { Schriftgroesse = 11 };
        foreach (var (n, a) in new[] { ("Std.", .07f), ("Fach", .09f), ("Vertretung für", .08f), ("Art", .08f), ("Bemerkung", .30f) }) t.Spalten.Add(new Spalte(n, null, a));
        t.Zeile("5", "SP", "RIC", "Lehrertausch", "");
        var w = t.Breiten(500);
        Assert.Equal(500, w.Sum(), 1f);
        Assert.True(w[3] >= Satz.Breite("Lehrertausch", 11, true), "Art breit genug");
        var auto = new Tabelle("Kürzel", "Name", "Soll");
        auto.Zeile("ABC", "Anna Beispiel", "25,5");
        Assert.Equal(700, auto.Breiten(700).Sum(), 1f);
    }

    [Fact]
    public void Stundenraster_mit_Aenderungen_und_Legende()
    {
        var r = new Stundenraster();
        r.Tage.AddRange(new[] { "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag" });
        for (var i = 1; i <= 6; i++) r.Stunden.Add(new Rasterstunde(i.ToString(), $"{7 + i}:00", $"{7 + i}:45", i == 2 ? "Pause" : null));
        r.Zelle(0, 0, 1).Eintraege.Add(new Rastereintrag { Fach = "D", Person = "MÜL", Raum = "R101" });
        r.Zelle(1, 0, 0).Eintraege.Add(new Rastereintrag { Fach = "M", Person = "SCH", PersonAlt = "WEB", Raum = "R102", Status = Stundenstatus.Aenderung });
        r.Zelle(2, 2, 2).Eintraege.Add(new Rastereintrag { Fach = "E", Person = "LAN", Raum = "R103", Status = Stundenstatus.Entfall });
        r.Zelle(3, 3, 4).Eintraege.Add(new Rastereintrag { Fach = "Klausur Bio", Person = "MEY", Raum = "R201", Status = Stundenstatus.Pruefung });
        r.FreieTage[4] = "Feiertag";
        var f = new Formular(Kopf("Stundenplan 7a"), true);
        var s = f.NeueSeite();
        var unten = r.Zeichnen(s, f.Links, f.Y, f.Breite, f.Unten - f.Y - 30);
        Stundenraster.Legende(s, f.Links, unten + 8, f.Breite, r.Status);
        var text = PdfPruefung.Text(f.Erzeugen());
        foreach (var t in new[] { "Montag", "8:00", "D", "MÜL", "WEB SCH", "entfällt", "Prüfung", "Feiertag", "Pause", "Zeichen:", "Entfall (schraffiert, durchgestrichen)" })
            Assert.Contains(t, text);
    }

    [Fact]
    public void Aushang_gruppiert_mit_Entfall_und_grosser_Schrift()
    {
        var tag = new Aushangtag { Datum = new DateOnly(2026, 10, 14) };
        tag.Nachrichten.Add("Schulversammlung in der Aula.");
        tag.Angaben.Add(("Abwesende Klassen", "9b"));
        foreach (var (k, std, entfall) in new[] { ("5a", "1", false), ("5a", "3", true), ("6b", "2", false) })
        {
            var z = new Aushangzeile { Gruppe = k, Entfall = entfall };
            z["Std"] = std; z["Klasse"] = k; z["Fach"] = "D"; z["Lehrer"] = "MÜL"; z["Vertretung"] = "SCH"; z["Raum"] = "R101"; z["Art"] = entfall ? "Entfall" : "Vertretung";
            if (entfall) z.Gestrichen.Add("Lehrer");
            tag.Zeilen.Add(z);
        }
        var spalten = new[] { "Std", "Klasse", "Fach", "Lehrer", "Vertretung", "Raum", "Art" }.Select(x => new Aushangspalte(x, x, 0.1f)).ToList();
        var o = new Aushangoptionen { Titel = "Vertretungsplan", GruppenSpalte = "Klasse", EntfallSpalte = "Vertretung", ArtSpalte = "Art" };
        var text = PdfPruefung.Text(Vertretungsaushang.Erzeugen(Kopf(), new[] { tag }, spalten, o));
        Assert.Contains("Mittwoch, 14. Oktober 2026", text);
        Assert.Contains("Mitteilungen", text);
        Assert.Contains("entfällt", text);
        Assert.Contains("5a", text);
        o.Schriftgroesse = 16;
        o.Quer = true;
        var gross = Vertretungsaushang.Erzeugen(Kopf(), new[] { tag }, spalten, o);
        Assert.All(PdfPruefung.Seitengroessen(gross), g => Assert.True(g.Breite > g.Hoehe));
        Assert.Contains("Keinen Unterrichtstag".ToLowerInvariant(), PdfPruefung.Text(Vertretungsaushang.Erzeugen(Kopf(), Array.Empty<Aushangtag>(), spalten, o)).ToLowerInvariant());
    }
}
