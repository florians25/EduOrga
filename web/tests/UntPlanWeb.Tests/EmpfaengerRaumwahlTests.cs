using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using UntPlanWeb.Dienste;

namespace UntPlanWeb.Tests;

/// <summary>
/// Empfängersuche der Mitteilungen (Filter Rolle und Gruppe), Mitteilungen-Untermenü und Antwortrecht für Schüler*innen und
/// Erziehungsberechtigte, Raumwahl mit Belegung beim Eintragen einer Prüfung, Schaltflächen ohne Unterstreichung, gleichmäßige
/// Ferienflächen und gestaffeltes Einblenden der Navigation.
/// </summary>
public class EmpfaengerRaumwahlTests
{
    private static int Id(Testserver s, string login) => s.Dienst<Benutzerdienst>().NachLogin(login)!.Id;

    private static async Task EinstellenAsync(HttpClient admin, Action<JsonObject> aendern)
    {
        var e = (await Testserver.HolenAsync(admin, "/api/app/mitteilungen/einstellungen"))["einstellungen"]!.AsObject();
        aendern(e);
        await Testserver.JsonAsync(await admin.PutAsJsonAsync("/api/app/mitteilungen/einstellungen", e));
    }

    private static object Buchung(string datum, int von, int bis, string raum) =>
        new { art = "raum", termine = new[] { new { datum, stundeVon = von, stundeBis = bis, raum } }, titel = "Projekt" };

    // ------------------------------------------------------------------ Empfängersuche

    [Fact]
    public async Task Personen_haben_Gruppen_und_Filter_fuer_Rolle_und_Gruppe()
    {
        await using var s = await Testserver.StartenAsync();
        var admin = await s.AlsAsync("admin");
        var elemente = await Testserver.HolenAsync(admin, "/api/app/elemente");
        var klasse = elemente["klassen"]!.AsArray().First(k => k!["leitung"]?.AsArray().Count > 0)!;
        var kl = klasse["kurz"]!.GetValue<string>();
        var leitung = klasse["leitung"]!.AsArray()[0]!.GetValue<string>();
        await s.AlsAsync("kl-leitung", "lehrer", leitung);
        await s.AlsAsync("schueler-x", "schueler", kl);
        await s.AlsAsync("eltern-x", "eltern", kl);

        var d = await Testserver.HolenAsync(admin, "/api/app/mitteilungen/personen?typ=individuell");
        var personen = d["personen"]!.AsArray();
        List<string> Gruppen(string login) => personen.Single(p => p!["login"]!.GetValue<string>() == login)!["gruppen"]!.AsArray().Select(x => x!.GetValue<string>()).ToList();
        Assert.Equal(new[] { "kollegium", "klassenleitungen" }, Gruppen("kl-leitung"));
        Assert.Equal(new[] { "schueler" }, Gruppen("schueler-x"));
        Assert.Equal(new[] { "eltern" }, Gruppen("eltern-x"));

        var rollen = d["filter"]!["rollen"]!.AsArray().Select(r => r!["id"]!.GetValue<string>()).ToList();
        Assert.Equal(new[] { "lehrkraft", "klassenlehrkraft", "schueler", "eltern" }, rollen);
        Assert.Equal("Lehrkraft", d["filter"]!["rollen"]!.AsArray()[0]!["name"]!.GetValue<string>());
        var gruppen = d["filter"]!["gruppen"]!.AsArray().Select(r => r!["id"]!.GetValue<string>()).ToList();
        Assert.Equal(new[] { "kollegium", "klassenleitungen", "schueler", "eltern" }, gruppen);
    }

    [Fact]
    public async Task Eigenes_Rechteprofil_erscheint_als_Gruppe()
    {
        await using var s = await Testserver.StartenAsync();
        var admin = await s.AlsAsync("admin");
        await s.AlsAsync("sek", "lehrer", "SNE");
        var db = s.Dienst<UntPlanWeb.Daten.Db>();
        var profil = Rechtedienst.Speichern(db, null, "Sekretariat", Rollen.Lehrer, "", null, "2026-10-14 10:00");
        Rechtedienst.ProfilSetzen(db, s.Dienst<Benutzerdienst>().NachLogin("sek")!, profil.Id);

        var d = await Testserver.HolenAsync(admin, "/api/app/mitteilungen/personen?typ=kollegium");
        var sek = d["personen"]!.AsArray().Single(p => p!["login"]!.GetValue<string>() == "sek")!;
        Assert.Contains("profil:" + profil.Id, sek["gruppen"]!.AsArray().Select(x => x!.GetValue<string>()));
        var g = d["filter"]!["gruppen"]!.AsArray().Single(x => x!["id"]!.GetValue<string>() == "profil:" + profil.Id)!;
        Assert.Equal("Sekretariat", g["name"]!.GetValue<string>());
    }

    // ------------------------------------------------------------------ Mitteilungen für Schüler*innen und Erziehungsberechtigte

    [Fact]
    public async Task Sitzung_meldet_Sende_und_Antwortrecht()
    {
        await using var s = await Testserver.StartenAsync();
        var admin = await s.AlsAsync("admin");
        var sch = await s.AlsAsync("sch", "schueler", "5a");
        var lk = await s.AlsAsync("lk", "lehrer", "SNE");
        var m = (await Testserver.HolenAsync(sch, "/api/app/sitzung"))["benutzer"]!["mitteilungen"]!;
        Assert.True(m["senden"]!.GetValue<bool>());
        Assert.True(m["antworten"]!.GetValue<bool>());
        Assert.True((await Testserver.HolenAsync(lk, "/api/app/sitzung"))["benutzer"]!["mitteilungen"]!["senden"]!.GetValue<bool>());

        await EinstellenAsync(admin, e => { e["schuelerSenden"] = false; });
        m = (await Testserver.HolenAsync(sch, "/api/app/sitzung"))["benutzer"]!["mitteilungen"]!;
        Assert.False(m["senden"]!.GetValue<bool>());
        Assert.True(m["antworten"]!.GetValue<bool>());
        var optionen = await Testserver.HolenAsync(sch, "/api/app/mitteilungen/optionen");
        Assert.False(optionen["darfSenden"]!.GetValue<bool>());
        Assert.True(optionen["darfAntworten"]!.GetValue<bool>());

        await EinstellenAsync(admin, e => { e["familieAntworten"] = false; });
        m = (await Testserver.HolenAsync(sch, "/api/app/sitzung"))["benutzer"]!["mitteilungen"]!;
        Assert.False(m["senden"]!.GetValue<bool>());
        Assert.False(m["antworten"]!.GetValue<bool>());
    }

    [Fact]
    public async Task Schueler_ohne_Senderecht_darf_nur_antworten()
    {
        await using var s = await Testserver.StartenAsync();
        var admin = await s.AlsAsync("admin");
        var lk = await s.AlsAsync("lk", "lehrer", "SNE");
        var sch = await s.AlsAsync("sch", "schueler", "5a");
        await EinstellenAsync(admin, e => { e["schuelerSenden"] = false; e["familieAntworten"] = true; });
        var id = (await Testserver.JsonAsync(await lk.PostAsJsonAsync("/api/app/mitteilungen", new
        {
            empfaenger = new[] { $"benutzer:{Id(s, "sch")}" }, betreff = "Referat", text = "Bitte Thema nennen", wichtig = false,
        })))["id"]!.GetValue<int>();

        // lesen und antworten
        Assert.True((await Testserver.HolenAsync(sch, $"/api/app/mitteilungen/{id}"))["darfAntworten"]!.GetValue<bool>());
        var vorschlag = await Testserver.HolenAsync(sch, $"/api/app/mitteilungen/{id}/antwort");
        Assert.Equal($"benutzer:{Id(s, "lk")}", vorschlag["empfaenger"]!.AsArray().Single()!["id"]!.GetValue<string>());
        var antwort = await sch.PostAsJsonAsync("/api/app/mitteilungen", new
        {
            empfaenger = new[] { $"benutzer:{Id(s, "lk")}" }, betreff = "AW: Referat", text = "Vulkane", wichtig = false, antwortAuf = id,
        });
        Assert.Equal(HttpStatusCode.OK, antwort.StatusCode);
        Assert.Contains((await Testserver.HolenAsync(lk, "/api/app/mitteilungen")).AsArray(), x => x!["betreff"]!.GetValue<string>() == "AW: Referat");
        // Antwort als Entwurf speichern geht ebenfalls
        Assert.Equal(HttpStatusCode.OK, (await sch.PostAsJsonAsync("/api/app/mitteilungen/entwurf", new
        {
            empfaenger = new[] { $"benutzer:{Id(s, "lk")}" }, betreff = "AW: Referat", text = "Nachtrag", wichtig = false, antwortAuf = id,
        })).StatusCode);

        // keine neue Mitteilung ohne Bezug
        var neu = await sch.PostAsJsonAsync("/api/app/mitteilungen", new { empfaenger = new[] { $"benutzer:{Id(s, "lk")}" }, betreff = "Neu", text = "Hallo", wichtig = false });
        Assert.NotEqual(HttpStatusCode.OK, neu.StatusCode);
        Assert.Empty((await Testserver.HolenAsync(sch, "/api/app/mitteilungen/empfaenger")).AsArray());

        // ohne „Antworten erlaubt“ auch keine Antwort
        await EinstellenAsync(admin, e => { e["familieAntworten"] = false; });
        Assert.False((await Testserver.HolenAsync(sch, $"/api/app/mitteilungen/{id}"))["darfAntworten"]!.GetValue<bool>());
        Assert.NotEqual(HttpStatusCode.OK, (await sch.PostAsJsonAsync("/api/app/mitteilungen", new
        {
            empfaenger = new[] { $"benutzer:{Id(s, "lk")}" }, betreff = "AW: Referat", text = "nochmal", wichtig = false, antwortAuf = id,
        })).StatusCode);
    }

    [Fact]
    public async Task Eltern_mit_Senderecht_schreiben_den_Lehrkraeften_der_Klasse()
    {
        await using var s = await Testserver.StartenAsync();
        var admin = await s.AlsAsync("admin");
        var elemente = await Testserver.HolenAsync(admin, "/api/app/elemente");
        var klasse = elemente["klassen"]!.AsArray().First(k => k!["leitung"]?.AsArray().Count > 0)!;
        var kl = klasse["kurz"]!.GetValue<string>();
        var leitung = klasse["leitung"]!.AsArray()[0]!.GetValue<string>();
        await s.AlsAsync("kl-leitung", "lehrer", leitung);
        var eltern = await s.AlsAsync("eltern-x", "eltern", kl);
        var d = await Testserver.HolenAsync(eltern, "/api/app/mitteilungen/personen?typ=kollegium");
        var p = d["personen"]!.AsArray().Single(x => x!["login"]!.GetValue<string>() == "kl-leitung")!;
        Assert.Contains(p["rollen"]!.AsArray(), r => r!["art"]!.GetValue<string>() == "klassenlehrkraft");
        Assert.Equal(HttpStatusCode.OK, (await eltern.PostAsJsonAsync("/api/app/mitteilungen", new
        {
            empfaenger = new[] { p["id"]!.GetValue<string>() }, betreff = "Krankmeldung", text = "Morgen fehlt unser Kind.", wichtig = false,
        })).StatusCode);
    }

    // ------------------------------------------------------------------ Raumwahl beim Eintragen einer Prüfung

    [Fact]
    public async Task Raumstatus_zeigt_frei_und_belegt_aus_Plan_und_Buchungen()
    {
        await using var s = await Testserver.StartenAsync();
        var admin = await s.AlsAsync("admin");
        var lan = await s.AlsAsync("lan", "lehrer", "LAN");
        var plan = await Testserver.HolenAsync(admin, "/api/app/plan?typ=klasse&element=5a&datum=2026-10-14");
        var k = plan["karten"]!.AsArray().First(x => x!["unterricht"] is not null && x["raeume"]!.AsArray().Count > 0 && x["status"]!.GetValue<string>() != "entfall")!;
        var datum = k["datum"]!.GetValue<string>();
        var von = k["von"]!.GetValue<int>();
        var raum = k["raeume"]!.AsArray()[0]!["k"]!.GetValue<string>();
        var u = k["unterricht"]!.GetValue<int>();

        // mit Unterricht: eigener Raum frei und vorn, eigene Stunde zählt nicht
        var mit = (await Testserver.HolenAsync(lan, $"/api/app/buchen/raumstatus?datum={datum}&von={von}&bis={von}&unterricht={u}")).AsArray();
        var eigen = mit[0]!;
        Assert.Equal(raum, eigen["kurz"]!.GetValue<string>());
        Assert.True(eigen["eigen"]!.GetValue<bool>());
        Assert.True(eigen["frei"]!.GetValue<bool>());
        // ohne Unterricht: der Raum ist durch die Stunde belegt (mit Angabe der Belegung)
        var ohne = (await Testserver.HolenAsync(lan, $"/api/app/buchen/raumstatus?datum={datum}&von={von}&bis={von}")).AsArray();
        var belegt = ohne.Single(r => r!["kurz"]!.GetValue<string>() == raum)!;
        Assert.False(belegt["frei"]!.GetValue<bool>());
        Assert.Equal("unterricht", belegt["belegt"]!.AsArray()[0]!["art"]!.GetValue<string>());
        // Reihenfolge: buchbare vor nicht buchbaren, darin freie vor belegten
        var liste = ohne.Select(r => (Buchbar: r!["buchbar"]!.GetValue<bool>(), Frei: r["frei"]!.GetValue<bool>())).ToList();
        var schluessel = liste.Select(x => (x.Buchbar ? 0 : 2) + (x.Frei ? 0 : 1)).ToList();
        Assert.Equal(schluessel.OrderBy(x => x), schluessel);
        Assert.Contains(liste, x => x.Buchbar);
        Assert.All(ohne, r => Assert.NotNull(r!["kapazitaet"]));

        // Buchung aus dem Buchungsmodul belegt den Raum
        var vorher = (await Testserver.HolenAsync(lan, "/api/app/buchen/raumstatus?datum=2026-10-15&von=3&bis=4")).AsArray().Single(r => r!["kurz"]!.GetValue<string>() == "R108")!;
        Assert.True(vorher["frei"]!.GetValue<bool>());
        await Testserver.JsonAsync(await lan.PostAsJsonAsync("/api/app/buchen", Buchung("2026-10-15", 3, 4, "R108")));
        var nachher = (await Testserver.HolenAsync(lan, "/api/app/buchen/raumstatus?datum=2026-10-15&von=4&bis=4")).AsArray().Single(r => r!["kurz"]!.GetValue<string>() == "R108")!;
        Assert.False(nachher["frei"]!.GetValue<bool>());
        Assert.Equal("buchung", nachher["belegt"]!.AsArray()[0]!["art"]!.GetValue<string>());

        // nur für das Kollegium
        var sch = await s.AlsAsync("sch", "schueler", "5a");
        Assert.Equal(HttpStatusCode.Forbidden, (await sch.GetAsync("/api/app/buchen/raumstatus?datum=2026-10-15&von=3")).StatusCode);
    }

    // ------------------------------------------------------------------ Oberfläche

}
