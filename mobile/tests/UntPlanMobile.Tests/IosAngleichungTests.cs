using System.Net;
using System.Text.RegularExpressions;

namespace UntPlanMobile.Tests;

/// <summary>
/// EduOrga Mobile wie die iOS-App (ios/UntPlanNext/Neu/**): fünf Reiter, Plan mit Kopf „Mein Plan ▾ / KW · Monat · A-Woche“ und
/// Planleiste (Agenda | Woche | Tag, „Nur Änderungen“, „Auswahl und Filter“), Agenda, „Heute“ als Tagesbriefing mit Ferien
/// (api/web/heute → EduOrga Web /api/app/heute, Feld kalender) und Profil als eigener Reiter.
/// </summary>
public class IosAngleichungTests
{
    private static string Datei(params string[] teile) => File.ReadAllText(Path.Combine(new[] { Umgebung.Wurzel(), "mobile", "src", "UntPlanMobile" }.Concat(teile).ToArray()));
    private static string Js(string name) => Datei("wwwroot", "assets", "js", name);

    [Fact]
    public async Task Heute_kommt_mit_Kalender_ueber_die_Durchreichung()
    {
        await using var u = await Umgebung.StartenAsync();
        using var anonym = u.Client();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonym.GetAsync("/api/web/heute")).StatusCode);
        using var c = await u.AngemeldetAsync("sne");
        var h = await Umgebung.HolenAsync(c, "/api/web/heute");
        Assert.Equal("2026-10-14", h["datum"]!.GetValue<string>());
        var k = h["kalender"]!;
        Assert.Equal("2026-10-14", k["heute"]!.GetValue<string>());
        Assert.Null(k["frei"]);
        Assert.Equal("Herbstferien", k["naechsteFerien"]!["name"]!.GetValue<string>());
        Assert.Equal("2026-10-17", k["naechsteFerien"]!["von"]!.GetValue<string>());
        // nur lesen: schreibende Aufrufe sind nicht freigegeben
        Assert.False(UntPlanMobile.Api.WebApi.Erlaubt("POST", "heute"));
    }

    [Fact]
    public async Task Woche_nennt_den_Wochenbuchstaben_fuer_den_Untertitel()
    {
        await using var u = await Umgebung.StartenAsync();
        using var c = await u.AngemeldetAsync("sne");
        var w = await Umgebung.HolenAsync(c, "/api/mobile?action=week&date=2026-10-14&type=mine");
        Assert.Matches("^[A-Z]$", w["woche"]!.GetValue<string>());
    }

    [Fact]
    public void Fuenf_Reiter_Planleiste_Agenda_und_Profil()
    {
        var html = Datei("Vorlagen", "index.html");
        var leiste = html[html.IndexOf("<nav class=\"tabbar", StringComparison.Ordinal)..html.IndexOf("</nav>", html.IndexOf("<nav class=\"tabbar", StringComparison.Ordinal), StringComparison.Ordinal)];
        Assert.Equal(new[] { "start", "plan", "msg", "profile", "konto" }, Regex.Matches(leiste, "data-screen=\"([a-z]+)\"").Select(m => m.Groups[1].Value));
        foreach (var s in new[] { "#i-sun", "#i-calendar\"", "#i-inbox", "#i-layout-grid", "#i-circle-user" }) Assert.Contains(s, leiste);
        Assert.Contains("id=\"msgZahl\"", leiste);
        // Symbole stehen in der Sammlung
        var sprite = Datei("wwwroot", "assets", "icons", "symbole-sprite.svg");
        foreach (var s in new[] { "sun", "calendar", "layout-grid", "circle-user", "triangle", "sliders-horizontal", "list", "calendar-range", "rectangle-vertical" })
            Assert.Contains($"id=\"i-{s}\"", sprite);
        // Plan: Kopf mit Zeitraum und Kalenderknopf, Planleiste unten, Agenda
        Assert.Contains("id=\"planZeitraum\"", html);
        Assert.Contains("id=\"btnKalender\"", html);
        Assert.Contains("class=\"planleiste\"", html);
        Assert.Contains("data-v=\"agenda\"", html);
        Assert.Contains("id=\"btnNurAenderungen\"", html);
        Assert.Contains("id=\"agenda\"", html);
        Assert.Contains("aria-label=\"Auswahl und Filter\"", html);
        // Profil als eigener Bildschirm, Schule ohne Konto
        Assert.Contains("id=\"screenKonto\"", html);
        var schule = html[html.IndexOf("id=\"screenProfile\"", StringComparison.Ordinal)..html.IndexOf("id=\"screenKonto\"", StringComparison.Ordinal)];
        Assert.DoesNotContain("btnSwitchAccount", schule);
        Assert.Contains("id=\"btnProfilSeite\"", html);
        // Heute: Tagesbriefing aus ansichten.js, offline in der Hülle
        Assert.Contains("assets/js/ansichten.js?v=__FASSUNG__", html);
        Assert.Contains("ansichten.js?v=__FASSUNG__", Datei("Vorlagen", "sw.js"));
        Assert.Contains("id=\"heuteInhalt\"", html);
        var js = Js("app.js");
        Assert.Contains("['agenda', 'day', 'day2', 'day3', 'week']", js);
        Assert.Contains("function istAbweichung(c)", js);
        Assert.Contains("window.EDOAnsichten.agenda(gefiltert(state.week.byDate || {}))", js);
        Assert.Contains("function planZeitraumSetzen()", js);
        Assert.Contains("function tagesPunkt(d)", js);
        var a = Js("ansichten.js");
        foreach (var m in new[] { "function bandHtml(", "function fokusHtml(", "function zahlenHtml(", "function ferienHtml(", "function kalenderHtml(", "function agenda(",
                                  "fetch(API + 'heute'", "'Vertretung folgt'", "Klassenbuch erfassen", "Nächster Schultag", "Alle ${liste.length} Hinweise der Schule" })
            Assert.Contains(m, a);
        var css = Datei("wwwroot", "assets", "css", "app.css");
        Assert.Contains(".tabbar.tabbar--5{ grid-template-columns:repeat(5, 1fr);", css);
        Assert.Contains(".planleiste__kapsel button.is-on{ background:var(--up-akzent); color:#fff; }", css);
        Assert.Contains(".h-seg--pr{ background:var(--up-pruefung-streifen, #b7791f); }", css);
    }

    [Fact]
    public void Ansichten_js_ist_gueltiges_Skript_und_ohne_Fremdzugriffe()
    {
        var a = Js("ansichten.js");
        Assert.DoesNotContain("http://", a);
        Assert.DoesNotContain("https://", a);
        Assert.DoesNotContain("innerHTML = h.", a);
        // jede Zeile ein Knopf mit ganzem Satz für Bildschirmleser
        Assert.Contains("aria-label=\"${esc((laeuft ? 'Läuft gerade. ' : vorbei ? 'Vorbei. ' : '') + satz(c, z))}\"", a);
    }
}
