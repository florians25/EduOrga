using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using UntPlan.Core;
using UntPlan.Core.Austausch;
using UntPlan.Core.Model;
using UntPlan.Core.Optimierung;
using UntPlan.Web.Contracts;
using UntPlanWeb.Dienste;

namespace UntPlanWeb.Tests;

/// <summary>
/// Raumplan ohne weggenommene Stunden, Raumänderung aus einer Buchung ohne Vertretungstext (auch nach Im-/Export über UntPlan)
/// und „Findet online statt“ mit Link zum Online-Unterricht.
/// </summary>
public class PlanRaumOnlineTests
{
    private static IEnumerable<JsonNode> Karten(JsonNode plan, string datum, int stunde) =>
        plan["karten"]!.AsArray().Select(k => k!).Where(k => k["datum"]!.GetValue<string>() == datum && k["von"]!.GetValue<int>() <= stunde && k["bis"]!.GetValue<int>() >= stunde);

    private static readonly DateOnly Freitag = new(2026, 10, 16);

    // ------------------------------------------------------------------ Raumplan: aus dem Raum genommene Stunden

    [Fact]
    public async Task Raumaenderung_weg_aus_einem_Raum_erscheint_im_Raumplan_dieses_Raums_nicht_mehr()
    {
        await using var s = await Testserver.StartenAsync();
        var plan = s.Dienst<Plandienst>();
        var stand = s.Dienst<Paketdienst>().Aktuell!;
        var k = plan.Karten(stand, Freitag, Elementtyp.Klasse, "7a").First(x => x.Unterricht.HasValue && x.Status == "regulaer" && x.Lehrer.Count == 1 && x.Raeume.Count == 1);
        var lehrer = k.Lehrer[0].K;
        var alterRaum = k.Raeume[0].K;
        var c = await s.AlsAsync(lehrer.ToLowerInvariant(), "lehrer", lehrer);
        var frei = await Testserver.HolenAsync(c, $"/api/app/meldungen/freieraeume?datum=2026-10-16&von={k.Von}&bis={k.Von}");
        var neuerRaum = frei.AsArray().Select(x => x!["kurz"]!.GetValue<string>()).First(x => x != alterRaum);
        await Testserver.JsonAsync(await c.PostAsJsonAsync("/api/app/meldungen/raumaenderung",
            new { datum = "2026-10-16", stundeVon = k.Von, stundeBis = k.Von, unterricht = k.Unterricht, raeume = new[] { neuerRaum } }));

        // App-API (Web, PWA, iOS): im alten Raum weder Entfall noch „findet woanders statt“
        var alt = await Testserver.HolenAsync(c, $"/api/app/plan?typ=raum&element={alterRaum}&datum=2026-10-16");
        Assert.DoesNotContain(Karten(alt, "2026-10-16", k.Von), x => x["unterricht"]?.GetValue<int>() == k.Unterricht);
        Assert.DoesNotContain(plan.Karten(stand, Freitag, Elementtyp.Raum, alterRaum, s.Dienst<Rueckmeldungsdienst>().Vorgemerkt(Freitag, stand)),
            x => x.Unterricht == k.Unterricht && x.Von <= k.Von && x.Bis >= k.Von);
        // im neuen Raum steht die Stunde
        var neu = await Testserver.HolenAsync(c, $"/api/app/plan?typ=raum&element={neuerRaum}&datum=2026-10-16");
        Assert.Contains(Karten(neu, "2026-10-16", k.Von), x => x["unterricht"]?.GetValue<int>() == k.Unterricht);
        // Klassen- und Lehrerplan unverändert eine Karte mit „alt → neu“
        var kl = Karten(await Testserver.HolenAsync(c, "/api/app/plan?typ=klasse&element=7a&datum=2026-10-16"), "2026-10-16", k.Von)
            .Single(x => x["unterricht"]?.GetValue<int>() == k.Unterricht);
        Assert.Equal(neuerRaum, kl["raeume"]![0]!["k"]!.GetValue<string>());
        Assert.Equal(alterRaum, kl["raeume"]![0]!["alt"]!.GetValue<string>());
    }

    // ------------------------------------------------------------------ Raumänderung aus Buchung: Im-/Export ohne Vertretungstext

    [Fact]
    public void Automatischer_Raumaenderungs_Hinweis_aelterer_Versionen_ist_kein_Vertretungstext()
    {
        Assert.Equal("", Plandienst.TextNormal("(lan) Raumänderung"));
        Assert.Equal("", Plandienst.TextNormal(" (admin)  Raumänderung "));
        Assert.Equal("Arbeitsblatt", Plandienst.TextNormal("Arbeitsblatt · (lan) Raumänderung"));
        Assert.Equal("Raumänderung wegen Wasserschaden", Plandienst.TextNormal("Raumänderung wegen Wasserschaden"));
        Assert.Equal(Plandienst.OhneLehrkraftText, Plandienst.TextNormal("Vertr. o. Lehrkraft"));
    }

    [Fact]
    public async Task Raumaenderung_aus_Buchung_bleibt_nach_Im_und_Export_ohne_Vertretungstext()
    {
        await using var s = await Testserver.StartenAsync(mitPaket: false);
        var d = Demo.Beispielschule();
        d.AktivePeriode.Plan = Optimierer.Optimieren(d, new OptimierungsOptionen { Strategie = Strategie.A, AnzahlPlaene = 1, Seed = 3 })[0].Plan;
        var p = new PortalEinstellungen { Adresse = s.Adresse.ToString(), SchulId = Testserver.SchulId, ApiSchluessel = Testserver.ApiSchluessel };
        var optionen = new WebExportOptionen { TageVoraus = 7 };
        Assert.True((await UntPlanWebExport.HochladenAsync(p, UntPlanWebExport.PaketErstellen(d, new DateOnly(2026, 10, 12), optionen) with { Revision = 1 })).Ok);

        var plan = s.Dienst<Plandienst>();
        var stand = s.Dienst<Paketdienst>().Aktuell!;
        // eine reguläre Stunde mit einer Lehrkraft und einem Raum (Mo–Fr der exportierten Woche)
        var (tag, k) = Enumerable.Range(0, 5).Select(i => new DateOnly(2026, 10, 12).AddDays(i))
            .SelectMany(t => stand.Paket.Elemente.Klassen.SelectMany(kl => plan.Karten(stand, t, Elementtyp.Klasse, kl.Kurz)).Select(x => (t, x)))
            .First(x => x.x.Unterricht.HasValue && x.x.Status == "regulaer" && x.x.Lehrer.Count == 1 && x.x.Raeume.Count == 1 && x.t >= new DateOnly(2026, 10, 14));
        var iso = Plandienst.Iso(tag);
        var lehrer = k.Lehrer[0].K;
        var alterRaum = k.Raeume[0].K;
        var c = await s.AlsAsync(lehrer.ToLowerInvariant(), "lehrer", lehrer);
        var frei = await Testserver.HolenAsync(c, $"/api/app/meldungen/freieraeume?datum={iso}&von={k.Von}&bis={k.Von}");
        var neuerRaum = frei.AsArray().Select(x => x!["kurz"]!.GetValue<string>()).First(x => x != alterRaum);
        await Testserver.JsonAsync(await c.PostAsJsonAsync("/api/app/meldungen/raumaenderung",
            new { datum = iso, stundeVon = k.Von, stundeBis = k.Von, unterricht = k.Unterricht, raeume = new[] { neuerRaum } }));

        // UntPlan: „Stundenplanänderungen aus UntPlanWeb“ übernehmen → Raumvertretung ohne Vertretungstext
        var liste = await UntPlanWebExport.RueckmeldungenAsync(p);
        var zeilen = StundenplanAenderungen.Analysieren(d, liste, new DateOnly(2026, 10, 12), new DateOnly(2026, 10, 30), false);
        var z = Assert.Single(zeilen);
        Assert.Equal(StplAenderungsArt.Unterricht, z.Art);
        var (ok, nein) = StundenplanAenderungen.Uebernehmen(d, zeilen, "lan");
        Assert.Empty(nein);
        await UntPlanWebExport.QuittierenAsync(p, ok);
        var v = Assert.Single(d.Vertretungen, x => x.WebId == z.Id);
        Assert.Equal("", v.Text);

        // erneuter Export: weder Karte noch Vertretungsplan zeigen einen Vertretungstext; Räume „alt → neu“
        Assert.True((await UntPlanWebExport.HochladenAsync(p, UntPlanWebExport.PaketErstellen(d, new DateOnly(2026, 10, 12), optionen) with { Revision = 2 })).Ok);
        var karte = Karten(await Testserver.HolenAsync(c, $"/api/app/plan?typ=lehrer&element={lehrer}&datum={iso}"), iso, k.Von)
            .Single(x => x["unterricht"]?.GetValue<int>() == k.Unterricht);
        Assert.Equal("", karte["text"]!.GetValue<string>());
        Assert.Equal(neuerRaum, karte["raeume"]![0]!["k"]!.GetValue<string>());
        Assert.Equal(alterRaum, karte["raeume"]![0]!["alt"]!.GetValue<string>());
        var vp = await Testserver.HolenAsync(c, $"/api/app/vertretungen?datum={iso}");
        Assert.All(vp["tage"]![0]!["zeilen"]!.AsArray(), x => Assert.DoesNotContain("Raumänderung", x!.ToJsonString().Replace("\"art\":\"Raumänderung\"", "")));
        // Raumplan des alten Raums: die Stunde erscheint nicht mehr
        var altPlan = await Testserver.HolenAsync(c, $"/api/app/plan?typ=raum&element={alterRaum}&datum={iso}");
        Assert.DoesNotContain(Karten(altPlan, iso, k.Von), x => x["unterricht"]?.GetValue<int>() == k.Unterricht);

        // ältere Datei mit dem automatischen Hinweis „(lan) Raumänderung“: wird nicht exportiert
        v.Text = "(lan) Raumänderung";
        Assert.True((await UntPlanWebExport.HochladenAsync(p, UntPlanWebExport.PaketErstellen(d, new DateOnly(2026, 10, 12), optionen) with { Revision = 3 })).Ok);
        karte = Karten(await Testserver.HolenAsync(c, $"/api/app/plan?typ=lehrer&element={lehrer}&datum={iso}"), iso, k.Von)
            .Single(x => x["unterricht"]?.GetValue<int>() == k.Unterricht);
        Assert.Equal("", karte["text"]!.GetValue<string>());
    }

    // ------------------------------------------------------------------ Findet online statt + Link (aus UntPlan Studio, nur Anzeige)

    [Fact]
    public async Task Online_Unterricht_kommt_aus_dem_Paket_und_ist_in_UntPlanWeb_nicht_mehr_einstellbar()
    {
        await using var s = await Testserver.StartenAsync();
        var plan = s.Dienst<Plandienst>();
        var stand = s.Dienst<Paketdienst>().Aktuell!;
        var tag = new DateOnly(2026, 10, 14);
        var k = plan.Karten(stand, tag, Elementtyp.Klasse, "7a").First(x => x.Unterricht.HasValue && x.Status == "regulaer" && x.Lehrer.Count == 1);
        var lehrer = k.Lehrer[0].K;
        var c = await s.AlsAsync(lehrer.ToLowerInvariant(), "lehrer", lehrer);
        var stunde = $"/api/app/klassenbuch/stunde?datum=2026-10-14&stunde={k.Von}&unterricht={k.Unterricht}";
        const string link = "https://meet.example.org/7a-mathe?pwd=1";

        // ältere Apps: online/onlineLink werden angenommen, aber ignoriert (auch ungültige Links) – nichts wird gespeichert
        foreach (var l in new[] { link, "javascript:alert(1)" })
        {
            var r = await Testserver.JsonAsync(await c.PutAsJsonAsync("/api/app/klassenbuch/stunde", new { datum = "2026-10-14", stunde = k.Von, unterricht = k.Unterricht, online = true, onlineLink = l }));
            Assert.False(r["online"]!.GetValue<bool>());
        }
        var o = await Testserver.JsonAsync(await c.PutAsJsonAsync("/api/app/klassenbuch/online", new { datum = "2026-10-14", stunde = k.Von, unterricht = k.Unterricht, online = true, onlineLink = link }));
        Assert.False(o["online"]!.GetValue<bool>());
        Assert.False(o["geaendert"]!.GetValue<bool>());
        var g = await Testserver.HolenAsync(c, stunde);
        Assert.Null(g["eintrag"]);
        Assert.False(g["online"]!.GetValue<bool>());
        Assert.False(g["onlineBearbeitbar"]!.GetValue<bool>());

        // UntPlan Studio: die Stunde findet an diesem Datum online statt (Paket, WebStunde.online/onlineLink)
        await s.NeuesPaketAsync(Testserver.OnlineStunden(Testserver.Beispielpaket(), "2026-10-14", k.Unterricht!.Value, true, link, k.Von, k.Bis));
        g = await Testserver.HolenAsync(c, stunde);
        Assert.True(g["online"]!.GetValue<bool>());
        Assert.Equal(link, g["onlineLink"]!.GetValue<string>());
        foreach (var url in new[] { $"/api/app/plan?typ=lehrer&element={lehrer}&datum=2026-10-14", "/api/app/plan?typ=klasse&element=7a&datum=2026-10-14" })
        {
            var karte = Karten(await Testserver.HolenAsync(c, url), "2026-10-14", k.Von).Single(x => x["unterricht"]?.GetValue<int>() == k.Unterricht);
            Assert.True(karte["online"]!.GetValue<bool>());
            Assert.Equal(link, karte["onlineLink"]!.GetValue<string>());
        }
        // Lehrstoff speichern: Antwort und Eintrag zeigen den Stand aus dem Paket
        var e = await Testserver.JsonAsync(await c.PutAsJsonAsync("/api/app/klassenbuch/stunde", new { datum = "2026-10-14", stunde = k.Von, unterricht = k.Unterricht, thema = "Online-Stunde", online = false }));
        Assert.True(e["online"]!.GetValue<bool>());
        Assert.Equal(link, (await Testserver.HolenAsync(c, stunde))["eintrag"]!["onlineLink"]!.GetValue<string>());

        // Schüler*innen sehen den Link (Karte und Stundendetails), dürfen nichts ändern
        var sch = await s.AlsAsync("klasse-7a", "schueler", "7a");
        var sk = Karten(await Testserver.HolenAsync(sch, "/api/app/plan?typ=klasse&element=7a&datum=2026-10-14"), "2026-10-14", k.Von).Single(x => x["unterricht"]?.GetValue<int>() == k.Unterricht);
        Assert.Equal(link, sk["onlineLink"]!.GetValue<string>());
        var sg = await Testserver.HolenAsync(sch, stunde);
        Assert.Equal(link, sg["eintrag"]!["onlineLink"]!.GetValue<string>());
        Assert.False(sg["darf"]!.GetValue<bool>());
        Assert.NotEqual(HttpStatusCode.OK, (await sch.PutAsJsonAsync("/api/app/klassenbuch/online", new { datum = "2026-10-14", stunde = k.Von, unterricht = k.Unterricht, online = false })).StatusCode);

        // nicht online (z. B. Abweichung „findet nicht online statt“): kein Link – auch wenn das Paket einen nennt
        await s.NeuesPaketAsync(Testserver.OnlineStunden(Testserver.Beispielpaket(), "2026-10-14", k.Unterricht.Value, false, link));
        sk = Karten(await Testserver.HolenAsync(sch, "/api/app/plan?typ=klasse&element=7a&datum=2026-10-14"), "2026-10-14", k.Von).Single(x => x["unterricht"]?.GetValue<int>() == k.Unterricht);
        Assert.False(sk["online"]!.GetValue<bool>());
        Assert.Equal("", sk["onlineLink"]!.GetValue<string>());
        sg = await Testserver.HolenAsync(sch, stunde);
        Assert.Equal("", sg["eintrag"]!["onlineLink"]!.GetValue<string>());
        Assert.Equal("", sg["onlineLink"]!.GetValue<string>());
    }

    [Fact]
    public async Task Online_Unterricht_regelmaessig_gilt_im_Regelplan()
    {
        await using var s = await Testserver.StartenAsync();
        var plan = s.Dienst<Plandienst>();
        var stand = s.Dienst<Paketdienst>().Aktuell!;
        // Tag außerhalb der tagesaktuellen Daten (Regelplan aus dem Periodenstundenplan)
        var tag = Enumerable.Range(14, 60).Select(i => new DateOnly(2026, 10, 14).AddDays(i))
            .First(d => !plan.Frei(stand, d).Frei && plan.Karten(stand, d, Elementtyp.Klasse, "7a").Any(x => x.Unterricht.HasValue && x.Status == "regulaer"));
        var k = plan.Karten(stand, tag, Elementtyp.Klasse, "7a").First(x => x.Unterricht.HasValue && x.Status == "regulaer");
        Assert.False(k.Online);
        await s.NeuesPaketAsync(Testserver.OnlineUnterricht(Testserver.Beispielpaket(), k.Unterricht!.Value, true, "https://video.example.org/regel"));
        stand = s.Dienst<Paketdienst>().Aktuell!;
        var neu = plan.Karten(stand, tag, Elementtyp.Klasse, "7a").First(x => x.Unterricht == k.Unterricht && x.Von == k.Von);
        Assert.True(neu.Online);
        Assert.Equal("https://video.example.org/regel", neu.OnlineLink);
        Assert.Equal((true, "https://video.example.org/regel"), plan.OnlineAm(stand, tag, k.Unterricht.Value, k.Von, k.Bis));
    }

    [Fact]
    public async Task Online_Stunde_bei_nur_Aenderungen_liegt_ueber_dem_Stundenplan()
    {
        await using var s = await Testserver.StartenAsync();
        var plan = s.Dienst<Plandienst>();
        var stand = s.Dienst<Paketdienst>().Aktuell!;
        var tag = new DateOnly(2026, 10, 15);
        var k = plan.Karten(stand, tag, Elementtyp.Klasse, "7a").First(x => x.Unterricht.HasValue && x.Status == "regulaer" && x.Lehrer.Count == 1);
        // nur Vertretungen übertragen: der Tag enthält nur die geänderte (hier: online stattfindende) Stunde
        var paket = Testserver.OnlineStunden(Testserver.Beispielpaket(), "2026-10-15", k.Unterricht!.Value, true, "https://video.example.org/heute", k.Von, k.Von);
        paket["teile"] = new JsonArray("vertretungen");
        foreach (var t in paket["tage"]!.AsArray().Select(x => x!.AsObject()))
        {
            t["nurAenderungen"] = true;
            var nur = t["stunden"]!.AsArray().Where(x => x!["status"]!.GetValue<string>() != "regulaer" || x["online"]?.GetValue<bool>() == true).Select(x => x!.DeepClone()).ToList();
            t["stunden"] = new JsonArray(nur.ToArray());
        }
        await s.NeuesPaketAsync(paket);
        stand = s.Dienst<Paketdienst>().Aktuell!;
        var karten = plan.Karten(stand, tag, Elementtyp.Klasse, "7a");
        var on = karten.Single(x => x.Unterricht == k.Unterricht && x.Von <= k.Von && x.Bis >= k.Von && x.Lehrer.Any(l => l.K == k.Lehrer[0].K));
        Assert.True(on.Online);
        Assert.Equal("https://video.example.org/heute", on.OnlineLink);
        // die übrigen Stunden stehen weiter (aus dem Stundenplan), ohne online
        Assert.Contains(karten, x => x.Unterricht.HasValue && x.Unterricht != k.Unterricht && !x.Online);
    }
}
