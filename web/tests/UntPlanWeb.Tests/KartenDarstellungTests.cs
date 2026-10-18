using System.Net;
using System.Text.Json.Nodes;
using UntPlanWeb.Dienste;

namespace UntPlanWeb.Tests;

/// <summary>
/// Stundenkarten (Sprint 26): Online-Unterricht ohne Raumlabel, Zusatzstunde mit Badge statt Vertretungstext, Verlegung mit
/// Richtung („von“/„nach“), Pausenaufsichten mit Label hinter dem Ort, Schalter „Findet online statt“, Pfeil beim Lehrerwechsel
/// und ohne Plattform-Sonderregeln (eine freie Schrift für alle Systeme).
/// </summary>
public class KartenDarstellungTests
{

    private static Karte K(string status, string art, bool lehrerAbwesend = false) =>
        new("2026-10-16", 1, 1, "08:00", "08:45", status, "M", null, "Mathematik", "", new(), new(), new(), art, "", null, null, "")
        { LehrerAbwesend = lehrerAbwesend };

    // ------------------------------------------------------------------ Verlegung: Richtung

    [Fact]
    public void Verlegung_ursprungliche_Stunde_von_Zielstunde_nach()
    {
        Assert.Equal("von", K("entfall", "Verlegung").Verlegung);
        Assert.Equal("von", K("abwesend", "Verlegung").Verlegung);          // Raumplan: Stunde findet woanders statt
        Assert.Equal("nach", K("geaendert", "Verlegung").Verlegung);
        Assert.Equal("nach", K("geaendert", "Statt-Vertretung").Verlegung);
        Assert.Equal("nach", K("abwesend", "Verlegung", lehrerAbwesend: true).Verlegung);
        Assert.Null(K("geaendert", "Vertretung").Verlegung);
        Assert.Null(K("entfall", "Entfall").Verlegung);
        Assert.Null(K("klausur", "Verlegung").Verlegung);
        Assert.Null(K("regulaer", "").Verlegung);
    }

    // ------------------------------------------------------------------ Server: Zusatzstunde und Verlegung über die App-API

    [Fact]
    public async Task Zusatzstunde_ohne_Vertretungstext_und_Verlegung_mit_Richtung_in_der_App_API()
    {
        await using var s = await Testserver.StartenAsync(false);
        var paket = Testserver.Beispielpaket();
        paket["revision"] = 60;
        var tag = paket["tage"]!.AsArray().First(t => t!["datum"]!.GetValue<string>() == "2026-10-16")!;
        JsonObject Stunde(int nr, string status, int vertretung, string text) => new()
        {
            ["stunde"] = nr, ["fach"] = "M", ["klassen"] = new JsonArray("6a"), ["lehrer"] = new JsonArray("MUE"), ["raeume"] = new JsonArray("R103"),
            ["status"] = status, ["vertretung"] = vertretung, ["text"] = text,
        };
        JsonObject Vertretung(int id, int nr, string art, string text) => new()
        {
            ["id"] = id, ["datum"] = "2026-10-16", ["stunde"] = nr, ["art"] = art, ["klassen"] = new JsonArray("6a"), ["lehrer"] = "MUE", ["vertreter"] = "MUE",
            ["fach"] = "M", ["neuesFach"] = "M", ["raum"] = "R103", ["neuerRaum"] = "R103", ["vertrVon"] = "", ["nach"] = "", ["text"] = text, ["nurLehrer"] = false,
        };
        tag["stunden"]!.AsArray().Add(Stunde(9, "zusaetzlich", 9101, "Zusatzstunde Förderung"));
        tag["stunden"]!.AsArray().Add(Stunde(10, "entfall", 9102, ""));
        tag["stunden"]!.AsArray().Add(Stunde(11, "zusaetzlich", 9103, ""));
        paket["vertretungen"]!.AsArray().Add(Vertretung(9101, 9, "Zusatzunterricht", "Zusatzstunde Förderung"));
        paket["vertretungen"]!.AsArray().Add(Vertretung(9102, 10, "Verlegung", ""));
        paket["vertretungen"]!.AsArray().Add(Vertretung(9103, 11, "Verlegung", ""));
        Assert.Equal(HttpStatusCode.OK, (await s.PaketSendenAsync(paket)).StatusCode);
        var c = await s.AlsAsync("admin");

        var plan = await Testserver.HolenAsync(c, "/api/app/plan?typ=klasse&element=6a&datum=2026-10-16");
        JsonNode Karte(int nr) => plan["karten"]!.AsArray().Single(k => k!["datum"]!.GetValue<string>() == "2026-10-16" && k["von"]!.GetValue<int>() == nr)!;

        var zusatz = Karte(9);
        Assert.True(zusatz["zusaetzlich"]!.GetValue<bool>());
        // Sprint 27: von Hand eingegebener Text bleibt (Info-Symbol), nur Standardtexte entfallen
        Assert.Equal("Zusatzstunde Förderung", zusatz["text"]!.GetValue<string>());
        Assert.Null(zusatz["verlegung"]);

        Assert.Equal("von", Karte(10)["verlegung"]!.GetValue<string>());        // ursprüngliche Stunde
        Assert.Equal("nach", Karte(11)["verlegung"]!.GetValue<string>());       // Zielstunde
        Assert.False(Karte(11)["zusaetzlich"]!.GetValue<bool>() && Karte(11)["text"]!.GetValue<string>().Length > 0);

        // reguläre Karten: kein Verlegungsfeld, Online-Feld vorhanden (kein künstliches Raumlabel)
        var regulaer = plan["karten"]!.AsArray().First(k => k!["status"]!.GetValue<string>() == "regulaer")!;
        Assert.Null(regulaer["verlegung"]);
        Assert.False(regulaer["online"]!.GetValue<bool>());
        Assert.DoesNotContain(plan["karten"]!.AsArray().SelectMany(k => k!["raeume"]!.AsArray()), r => r!["k"]!.GetValue<string>().Equals("online", StringComparison.OrdinalIgnoreCase));
    }

    // ------------------------------------------------------------------ Web: Karten

    // ------------------------------------------------------------------ Web: Stundendetails

    // ------------------------------------------------------------------ keine Plattform-Sonderregeln mehr (eine Schrift für alle Systeme)

}
