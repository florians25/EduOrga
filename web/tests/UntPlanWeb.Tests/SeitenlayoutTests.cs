using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using UntPlanWeb.Dienste;

namespace UntPlanWeb.Tests;

/// <summary>
/// Sprint 27 – Seiten und Bausteine: Detaildialog der Klassenbucheinträge (Liste mit Stunde, Zeitstempel und Rechten, Bearbeiten),
/// einheitliches Seitenlayout und Suchfeld, Segment-Auswahl (Rechte-Stufen, Art bei Offene Stunden), Rechteverwaltung mit automatisch
/// angezeigten neuen Rechten und das Infocenter auf kleinen Geräten.
/// </summary>
public class SeitenlayoutTests
{

    // ------------------------------------------------------------------ Klassenbucheinträge: Detaildialog

    [Fact]
    public async Task Eintraege_liefern_Stunde_Zeitstempel_und_Rechte()
    {
        await using var s = await Testserver.StartenAsync();
        var stand = s.Dienst<Paketdienst>().Aktuell!;
        var sid = stand.Paket.Elemente.Schueler.First(x => x.Klasse == "7a").Id;
        var erste = stand.Paket.Zeitraster.Stunden.OrderBy(z => z.Nr).First();
        var autor = await s.AlsAsync("autor", "lehrer", "AUT");
        var v = await Testserver.JsonAsync(await autor.PostAsJsonAsync("/api/app/klassenbuch/vermerke",
            new { datum = "2026-10-14", klasse = "7a", schuelerId = sid, art = "Lob", text = "Sehr gutes Referat", zeit = erste.Beginn }));
        var id = v["id"]!.GetValue<int>();

        var liste = await Testserver.HolenAsync(autor, "/api/app/klassenbucheintraege?von=2026-10-01&bis=2026-10-20&klasse=7a");
        var x = liste["eintraege"]!.AsArray().First(e => e!["id"]!.GetValue<int>() == id)!;
        Assert.Equal(erste.Beginn, x["zeit"]!.GetValue<string>());
        Assert.Equal(erste.Nr, x["stunde"]!.GetValue<int>());
        Assert.False(string.IsNullOrEmpty(x["erstellt"]!.GetValue<string>()));
        Assert.True(x["bearbeiten"]!.GetValue<bool>());
        Assert.True(x["loeschen"]!.GetValue<bool>());

        // andere Lehrkraft ohne Klassenleitung: nur lesen
        var fremd = await s.AlsAsync("fremd", "lehrer", "XYZ");
        var y = (await Testserver.HolenAsync(fremd, "/api/app/klassenbucheintraege?von=2026-10-01&bis=2026-10-20&klasse=7a"))["eintraege"]!.AsArray()
            .First(e => e!["id"]!.GetValue<int>() == id)!;
        Assert.False(y["bearbeiten"]!.GetValue<bool>());
        Assert.False(y["loeschen"]!.GetValue<bool>());
        Assert.Equal(HttpStatusCode.Forbidden, (await fremd.PutAsJsonAsync($"/api/app/klassenbuch/vermerke/{id}",
            new { datum = "2026-10-14", klasse = "7a", art = "Lob", text = "geändert" })).StatusCode);
    }

    [Fact]
    public async Task Eintrag_bearbeiten_durch_Verfasser_und_Administration()
    {
        await using var s = await Testserver.StartenAsync();
        var autor = await s.AlsAsync("autor", "lehrer", "AUT");
        var id = (await Testserver.JsonAsync(await autor.PostAsJsonAsync("/api/app/klassenbuch/vermerke",
            new { datum = "2026-10-14", klasse = "7a", art = "Vermerk", text = "Erst", zeit = "08:00" })))["id"]!.GetValue<int>();
        var neu = await Testserver.JsonAsync(await autor.PutAsJsonAsync($"/api/app/klassenbuch/vermerke/{id}",
            new { datum = "2026-10-13", klasse = "7a", art = "Elterngespräch", text = "  Gespräch geführt  " }));
        Assert.Equal("2026-10-13", neu["datum"]!.GetValue<string>());
        Assert.Equal("Elterngespräch", neu["art"]!.GetValue<string>());
        Assert.Equal("Gespräch geführt", neu["text"]!.GetValue<string>());
        Assert.Equal("08:00", neu["zeit"]!.GetValue<string>());            // ohne Angabe bleibt die Uhrzeit
        Assert.Equal("7a", neu["klasse"]!.GetValue<string>());

        // leerer Text und Schüler einer anderen Klasse werden abgelehnt
        Assert.Equal(HttpStatusCode.BadRequest, (await autor.PutAsJsonAsync($"/api/app/klassenbuch/vermerke/{id}", new { datum = "2026-10-13", klasse = "7a", art = "Vermerk", text = " " })).StatusCode);
        var stand = s.Dienst<Paketdienst>().Aktuell!;
        var andere = stand.Paket.Elemente.Schueler.First(x => x.Klasse != "7a").Id;
        Assert.Equal(HttpStatusCode.BadRequest, (await autor.PutAsJsonAsync($"/api/app/klassenbuch/vermerke/{id}", new { datum = "2026-10-13", klasse = "7a", schuelerId = andere, art = "Vermerk", text = "x" })).StatusCode);

        var admin = await s.AlsAsync("admin");
        var a = await Testserver.JsonAsync(await admin.PutAsJsonAsync($"/api/app/klassenbuch/vermerke/{id}", new { datum = "2026-10-13", klasse = "7a", art = "Lob", text = "Admin" }));
        Assert.Equal("Lob", a["art"]!.GetValue<string>());
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PutAsJsonAsync("/api/app/klassenbuch/vermerke/999999", new { datum = "2026-10-13", klasse = "7a", art = "Lob", text = "x" })).StatusCode);
    }

    // ------------------------------------------------------------------ Gemeinsame Bausteine

    // ------------------------------------------------------------------ Sprint 28: weißer Kopf der Klassenbuch-Verwaltungsseiten

    // ------------------------------------------------------------------ Sprint 28: eigene Abwesenheit im Stundenplan

    [Fact]
    public async Task Eigener_Plan_liefert_eigene_Abwesenheiten_der_Lehrkraft()
    {
        await using var s = await Testserver.StartenAsync();
        var stand = s.Dienst<Paketdienst>().Aktuell!;
        var stunden = stand.Paket.Zeitraster.Stunden.Where(z => z.Beginn.Length > 0).OrderBy(z => z.Nr).ToList();
        // Beispielpaket: WAG abwesend am 14.10. in der 1.–3. Stunde
        var wag = await s.AlsAsync("wag", "lehrer", "WAG");
        var a = (await Testserver.HolenAsync(wag, "/api/app/plan?typ=lehrer&element=WAG&datum=2026-10-14"))["abwesenheiten"]!.AsArray();
        var tag = a.Single(x => x!["datum"]!.GetValue<string>() == "2026-10-14")!;
        Assert.Equal(stunden.First().Beginn, tag["von"]!.GetValue<string>());
        Assert.Equal(stunden.First(z => z.Nr == 3).Ende, tag["bis"]!.GetValue<string>());
        Assert.Equal("fehlt", tag["art"]!.GetValue<string>());
        // nur im eigenen Plan: andere Lehrkraft bzw. Administration sehen im Plan von WAG keine Abwesenheitsfläche
        Assert.Empty((await Testserver.HolenAsync(await s.AlsAsync("mue", "lehrer", "MUE"), "/api/app/plan?typ=lehrer&element=WAG&datum=2026-10-14"))["abwesenheiten"]!.AsArray());
        Assert.Empty((await Testserver.HolenAsync(await s.AlsAsync("admin"), "/api/app/plan?typ=lehrer&element=WAG&datum=2026-10-14"))["abwesenheiten"]!.AsArray());
        // ganztägig (bis zur letzten Stunde) über zwei Tage: HOF 12.–13.10.
        var hof = (await Testserver.HolenAsync(await s.AlsAsync("hof", "lehrer", "HOF"), "/api/app/plan?typ=lehrer&element=HOF&datum=2026-10-13"))["abwesenheiten"]!.AsArray();
        Assert.Equal(new[] { "2026-10-12", "2026-10-13" }, hof.Select(x => x!["datum"]!.GetValue<string>()).ToArray());
        Assert.All(hof, x => Assert.Equal(stunden.Last().Ende, x!["bis"]!.GetValue<string>()));
    }

    [Fact]
    public async Task Eigener_Plan_liefert_eigene_Abwesenheiten_der_Schuelerin()
    {
        await using var s = await Testserver.StartenAsync();
        var stand = s.Dienst<Paketdienst>().Aktuell!;
        var kind = stand.Schueler.First(x => x.Klasse == "7a");
        var admin = await s.AlsAsync("admin");
        await Testserver.JsonAsync(await admin.PostAsJsonAsync("/api/app/admin/benutzer", new { login = "kind-7a", passwort = "familie-passwort", rolle = "schueler", anzeigename = "Kind", gesperrt = false, schuelerIds = new[] { kind.Id } }));
        var neu = await Testserver.JsonAsync(await admin.PostAsJsonAsync("/api/app/abwesenheiten", new { schuelerId = kind.Id, von = "2026-10-15", bis = "2026-10-15", status = "offen", grund = "K" }));
        Assert.True(neu["stunden"]!.GetValue<int>() > 0);
        var c = s.Client();
        Assert.Equal(HttpStatusCode.OK, (await c.PostAsJsonAsync("/api/app/anmelden", new { login = "kind-7a", passwort = "familie-passwort" })).StatusCode);
        var a = (await Testserver.HolenAsync(c, "/api/app/plan?typ=klasse&element=7a&datum=2026-10-15"))["abwesenheiten"]!.AsArray();
        var tag = Assert.Single(a)!;
        Assert.Equal("2026-10-15", tag["datum"]!.GetValue<string>());
        Assert.False(string.IsNullOrEmpty(tag["von"]!.GetValue<string>()));
        Assert.True(string.CompareOrdinal(tag["von"]!.GetValue<string>(), tag["bis"]!.GetValue<string>()) < 0);
        // Klassenkonto bzw. Lehrkraft sehen im Klassenplan keine Abwesenheit einzelner Schüler*innen
        Assert.Empty((await Testserver.HolenAsync(await s.AlsAsync("mue", "lehrer", "MUE"), "/api/app/plan?typ=klasse&element=7a&datum=2026-10-15"))["abwesenheiten"]!.AsArray());
    }

    [Fact]
    public async Task Rechtekatalog_enthaelt_Standard_je_Basisrolle_fuer_jedes_Recht()
    {
        await using var s = await Testserver.StartenAsync();
        var admin = await s.AlsAsync("admin");
        var k = await Testserver.HolenAsync(admin, "/api/app/admin/rechte/katalog");
        var gruppen = k["gruppen"]!.AsArray().Select(g => g!.GetValue<string>()).ToHashSet();
        foreach (var r in k["rechte"]!.AsArray())
        {
            Assert.Contains(r!["gruppe"]!.GetValue<string>(), gruppen);
            foreach (var basis in new[] { "admin", "leitung", "lehrer", "schueler", "eltern" }) Assert.NotNull(r["standard"]![basis]);
        }
    }

}
