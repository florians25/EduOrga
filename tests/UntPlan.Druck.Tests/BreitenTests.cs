using UntPlan.Druck;

namespace UntPlan.Druck.Tests;

public class BreitenTests
{
    [Fact]
    public void Feste_Anteile_fuellen_die_Breite()
    {
        var t = new Tabelle { Schriftgroesse = 9 };
        foreach (var (n, a) in new[] { ("Std.", .07f), ("Klasse", .11f), ("Fach", .09f), ("Lehrkraft", .11f), ("Vertretung", .11f), ("Raum", .09f), ("Art", .12f), ("Bemerkung", .30f) })
            t.Spalten.Add(new Spalte(n, null, a));
        t.Zeile("5", "5a", "SP", "RIC", "BEC", "TH1", "Vertretung", "");
        t.Zeile("2", "5b", "SP", "BRA", "FIS", "TH2", "Lehrertausch", "Tausch");
        t.Zeile("3", "5b", "SP", "BRA", "entfällt", "TH2", "Entfall", "");
        var w = t.Breiten(500);
        Assert.True(Math.Abs(500 - w.Sum()) < 0.5f, string.Join(" ", w));
    }
}

public class AushangDebug
{
    [Fact]
    public void Aushang()
    {
        var tag = new Aushangtag { Datum = new DateOnly(2026, 10, 14) };
        var z = new Aushangzeile { Gruppe = "5a" };
        z["Stunde"] = "5"; z["Element"] = "5a"; z["Fach"] = "SP"; z["Abwesend"] = "RIC"; z["Partner"] = "BEC"; z["Raum"] = "TH1"; z["Art"] = "Vertretung"; z["Bemerkung"] = "";
        tag.Zeilen.Add(z);
        var sp = new[] { ("Stunde", "Std.", .07f), ("Element", "Klasse", .11f), ("Fach", "Fach", .09f), ("Abwesend", "Lehrkraft", .11f), ("Partner", "Vertretung", .11f), ("Raum", "Raum", .09f), ("Art", "Art", .12f), ("Bemerkung", "Bemerkung", .30f) }
            .Select(x => new Aushangspalte(x.Item1, x.Item2, x.Item3)).ToList();
        var pdf = Vertretungsaushang.Erzeugen(new Kopfdaten { Schule = "S" }, new[] { tag }, sp, new Aushangoptionen { Schriftgroesse = 11, GruppenSpalte = "Element" });
        File.WriteAllBytes("/tmp/claude-0/-home-user-UntPlanNext/29d0cf17-beea-5876-92ac-09400d8e97ed/scratchpad/dbg.pdf", pdf);
    }
}
