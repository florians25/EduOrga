using System.Net;
using System.Text.Json.Nodes;
using UntPlanWeb.Dienste;

namespace UntPlanWeb.Tests;

/// <summary>
/// Sprint 29: entfallene Pausenaufsicht (Status „entfall“ mit Grund – Abwesenheit, Veranstaltung ohne Vertretung, Vertretung „---“),
/// Aufsichtsvertretung im Web mit normalem Label und Hover hinter dem Ort, Zusatzstunden mit allen Lehrkräften als „+“-Label.
/// </summary>
public class AufsichtZusatzTests
{
    private static JsonObject Vertretung(int id, string datum, int stunde, string art, string lehrer, string vertreter, string raum = "", bool nurLehrer = false,
        string fach = "", params string[] klassen) => new()
    {
        ["id"] = id, ["datum"] = datum, ["stunde"] = stunde, ["art"] = art, ["klassen"] = new JsonArray(klassen.Select(k => (JsonNode)JsonValue.Create(k)!).ToArray()),
        ["lehrer"] = lehrer, ["vertreter"] = vertreter, ["fach"] = fach, ["neuesFach"] = fach, ["raum"] = raum, ["neuerRaum"] = raum,
        ["vertrVon"] = "", ["nach"] = "", ["text"] = "", ["nurLehrer"] = nurLehrer,
    };

    private static JsonObject Aufsicht(int tag, int nach, string gang = "Hof") => new()
    {
        ["gang"] = gang, ["tag"] = tag, ["nachStunde"] = nach, ["lehrer"] = "KLE", ["wochen"] = "",
    };

    private static async Task<JsonNode> PlanAsync(JsonObject paket, string typ, string element, string datum)
    {
        await using var s = await Testserver.StartenAsync(false);
        Assert.Equal(HttpStatusCode.OK, (await s.PaketSendenAsync(paket)).StatusCode);
        var c = await s.AlsAsync("admin");
        return await Testserver.HolenAsync(c, $"/api/app/plan?typ={typ}&element={element}&datum={datum}");
    }

    private static string S(JsonNode? n) => n?.GetValue<string>() ?? "";

    [Fact]
    public async Task Aufsicht_entfaellt_bei_Abwesenheit_Veranstaltung_und_Vertretung_ohne_Lehrkraft()
    {
        var paket = Testserver.Beispielpaket();
        paket["revision"] = 290;
        paket["pausenaufsichten"] = new JsonArray(
            Aufsicht(0, 2),                 // Mo: KLE abwesend, keine Vertretung → entfall (Abwesenheit)
            Aufsicht(1, 2),                 // Di: Vertretung „---“ → entfall
            Aufsicht(2, 2), Aufsicht(2, 5), // Mi: Exkursion 2.–4. Stunde → Pause nach 2 entfällt, nach 5 regulär
            Aufsicht(3, 2),                 // Do: Vertretung durch RIC → vertreten
            Aufsicht(4, 1));                // Fr: abwesend, Vertretung offen („???“) → vertreten (nicht entfall)
        var absenzen = paket["absenzen"]!.AsArray();
        foreach (var x in absenzen.Where(x => S(x!["element"]) == "KLE").ToList()) absenzen.Remove(x);
        absenzen.Add(new JsonObject { ["art"] = "lehrer", ["element"] = "KLE", ["von"] = "2026-10-12", ["bis"] = "2026-10-12", ["stundeVon"] = 1, ["stundeBis"] = 10, ["grund"] = "Krank" });
        absenzen.Add(new JsonObject { ["art"] = "lehrer", ["element"] = "KLE", ["von"] = "2026-10-16", ["bis"] = "2026-10-16", ["stundeVon"] = 1, ["stundeBis"] = 10 });
        paket["termine"]!.AsArray().Add(new JsonObject
        {
            ["art"] = "veranstaltung", ["titel"] = "Exkursion Bonn", ["von"] = "2026-10-14", ["bis"] = "2026-10-14", ["stundeVon"] = 2, ["stundeBis"] = 4,
            ["klassen"] = new JsonArray(), ["lehrer"] = new JsonArray("KLE"), ["raeume"] = new JsonArray(),
        });
        var vertretungen = paket["vertretungen"]!.AsArray();
        foreach (var v in vertretungen.Where(v => S(v!["art"]) == "Pausenaufsicht" && (S(v["lehrer"]) == "KLE" || S(v["vertreter"]) == "KLE")).ToList()) vertretungen.Remove(v);
        vertretungen.Add(Vertretung(9701, "2026-10-13", 2, "Pausenaufsicht", "KLE", "---", "Hof", true));
        vertretungen.Add(Vertretung(9702, "2026-10-15", 2, "Pausenaufsicht", "KLE", "RIC", "Hof", true));
        vertretungen.Add(Vertretung(9703, "2026-10-16", 1, "Pausenaufsicht", "KLE", "???", "Hof", true));

        var plan = await PlanAsync(paket, "lehrer", "KLE", "2026-10-12");
        var liste = plan["aufsichten"]!.AsArray().Select(x => x!).ToList();
        JsonNode Eine(string datum, int nach) => liste.Single(x => S(x["datum"]) == datum && x["nachStunde"]!.GetValue<int>() == nach);

        var mo = Eine("2026-10-12", 2);
        Assert.Equal("entfall", S(mo["status"]));
        Assert.Equal("KLE", S(mo["lehrer"]));
        Assert.Equal("Abwesenheit", S(mo["grund"]));     // der (vertrauliche) Absenzgrund erscheint nicht
        var di = Eine("2026-10-13", 2);
        Assert.Equal("entfall", S(di["status"]));
        Assert.Null(di["grund"]);
        var mi = Eine("2026-10-14", 2);
        Assert.Equal("entfall", S(mi["status"]));
        Assert.Equal("Exkursion Bonn", S(mi["grund"]));
        Assert.Equal("regulaer", S(Eine("2026-10-14", 5)["status"]));
        var don = Eine("2026-10-15", 2);
        Assert.Equal("vertreten", S(don["status"]));
        Assert.Equal("RIC", S(don["lehrer"]));
        Assert.Equal("KLE", S(don["alt"]));
        var fr = Eine("2026-10-16", 1);
        Assert.Equal("vertreten", S(fr["status"]));
        Assert.Equal("???", S(fr["lehrer"]));
    }

    [Fact]
    public async Task Zusatzstunde_zeigt_alle_Lehrkraefte_als_Plus_ohne_alt_neu()
    {
        var paket = Testserver.Beispielpaket();
        paket["revision"] = 291;
        paket["tage"]!.AsArray().First(t => S(t!["datum"]) == "2026-10-15")!["stunden"]!.AsArray().Add(new JsonObject
        {
            ["stunde"] = 9, ["fach"] = "M", ["klassen"] = new JsonArray("7a"), ["lehrer"] = new JsonArray("KLE", "LAN"), ["raeume"] = new JsonArray("R101"),
            ["status"] = "zusaetzlich", ["vertretung"] = 9710, ["text"] = "",
        });
        paket["vertretungen"]!.AsArray().Add(Vertretung(9710, "2026-10-15", 9, "Zusatzunterricht", "BEC", "KLE", "R101", false, "M", "7a"));
        var plan = await PlanAsync(paket, "klasse", "7a", "2026-10-12");
        var k = plan["karten"]!.AsArray().Single(x => S(x!["datum"]) == "2026-10-15" && x!["von"]!.GetValue<int>() == 9)!;
        Assert.True(k["zusaetzlich"]!.GetValue<bool>());
        var lehrer = k["lehrer"]!.AsArray().Select(w => w!).ToList();
        // vorher „KLE (statt BEC), LAN“ – jetzt jede beteiligte Lehrkraft genau einmal (die ersetzte gleich hinter ihrer Vertretung)
        Assert.Equal(new[] { "KLE", "BEC", "LAN" }, lehrer.Select(w => S(w["k"])));
        Assert.All(lehrer, w => { Assert.Null(w["alt"]); Assert.True(w["neu"]!.GetValue<bool>()); Assert.True(w["plus"]!.GetValue<bool>()); });
        // Marker nur „+“ – die „+“-Lehrkräfte sind keine Änderung eines Werts
        Assert.Equal(new[] { "plus" }, k["marker"]!.AsArray().Select(x => S(x)));
    }

    [Fact]
    public void ZusatzLehrer_ohne_Platzhalter_und_ohne_Doppelte()
    {
        var l = Plandienst.ZusatzLehrer(new[] { new Wert("CS"), new Wert("GA"), new Wert("CS", "SN", true), new Wert("---") });
        Assert.Equal(new[] { "CS", "GA", "SN" }, l.Select(w => w.K));
        Assert.All(l, w => Assert.True(w.Plus));
        Assert.Equal(new[] { Plandienst.OhneLehrkraftZusatz }, Plandienst.ZusatzLehrer(new[] { new Wert("---") }).Select(w => w.K));
    }

}
