using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using UntPlanMobile.Api;

namespace UntPlanMobile.Tests;

/// <summary>
/// Sprint 26 (Gleichstand mit UntPlan für iOS): Kachelzeichen (Info, Online statt Raumlabel, Verlegung), vertretene
/// Aufsichten wie Stundenkarten mit abwesender Lehrkraft, Einzelstundenauswahl im Titel der Stundendetails, Ferien auf der
/// Startseite, gesperrte Woche im Stil der Startseiten-Kachel und Entschuldigungen der Klassenleitung (Vertrag Entschuldigungen).
/// </summary>
public class Sprint26Tests
{
    private static string Datei(params string[] teile) => File.ReadAllText(Path.Combine(new[] { Umgebung.Wurzel(), "mobile", "src", "UntPlanMobile" }.Concat(teile).ToArray()));
    private static string AppJs => Datei("wwwroot", "assets", "js", "app.js");
    private static string AppCss => Datei("wwwroot", "assets", "css", "app.css");

    private static string Abschnitt(string js, string name)
    {
        var beginn = js.IndexOf($"/* {name}-BEGINN", StringComparison.Ordinal);
        var ende = js.IndexOf($"/* {name}-ENDE */", StringComparison.Ordinal);
        Assert.True(beginn > 0 && ende > beginn, $"Abschnitt {name} fehlt");
        return js[beginn..ende];
    }

    private static string? Node()
    {
        foreach (var kandidat in new[] { "node", "/opt/node22/bin/node", "/usr/bin/node", "/usr/local/bin/node" })
        {
            try
            {
                using var p = Process.Start(new ProcessStartInfo(kandidat, "--version") { RedirectStandardOutput = true, UseShellExecute = false });
                p!.WaitForExit(5000);
                if (p.ExitCode == 0) return kandidat;
            }
            catch (System.ComponentModel.Win32Exception) { }
        }
        return null;
    }

    private static void MitNode(string abschnitt, string pruefungen)
    {
        var node = Node();
        if (node is null) return;
        var skript = Path.Combine(Path.GetTempPath(), "untplan-s26-" + Guid.NewGuid().ToString("N") + ".js");
        File.WriteAllText(skript, "const window = {};\nconst esc = s => String(s ?? '').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));\n" + abschnitt + """

            const pruefe = (ist, soll) => { const a = JSON.stringify(ist), b = JSON.stringify(soll); if (a !== b) { console.error(a + ' statt ' + b); process.exit(1); } };
            """ + pruefungen + "\nconsole.log('ok');\n");
        try
        {
            using var p = Process.Start(new ProcessStartInfo(node, skript) { RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false })!;
            var aus = p.StandardOutput.ReadToEnd() + p.StandardError.ReadToEnd();
            p.WaitForExit(10000);
            Assert.True(p.ExitCode == 0, aus);
        }
        finally { File.Delete(skript); }
    }

    [Fact]
    public void Vertretene_Aufsicht_zeigt_nur_den_Ort_und_das_Menuezeichen()
    {
        MitNode(Abschnitt(AppJs, "AUFSICHT"), """
            const { inhalt, klassen } = window.UntPlanAufsicht;
            const ort = '<span class="card__line">Hof</span>';
            const menu = '<span class="sup-menu" aria-hidden="true">' + AUFSICHT_DOTS + '</span>';
            // reguläre Aufsicht: nur der Ort
            pruefe(inhalt({ subject:'Hof' }), ort);
            pruefe(klassen({ subject:'Hof' }), []);
            // eingesprungen bzw. abgegeben: nur der Ort und ganz rechts „…“ – keine Kürzel, nichts Durchgestrichenes
            pruefe(inhalt({ subject:'Hof', _supSub:true, teacher:'LAN', teacherOrig:'SNE' }), ort + menu);
            pruefe(inhalt({ subject:'Hof', _supAbsent:true, teacher:'', teacherOrig:'LAN' }), ort + menu);
            pruefe(inhalt({ subject:'Hof', _supAbsent:true, teacher:'MEY', teacherOrig:'LAN' }), ort + menu);
            pruefe(klassen({ _supSub:true }), ['is-sub']);
            pruefe(klassen({ _supAbsent:true }), ['is-absent', 'is-abgegeben']);
            // entfallen: Entfall-Stil, kein Zeichen
            pruefe(inhalt({ subject:'Hof', _supCancelled:true }), ort);
            pruefe(klassen({ _supCancelled:true }), ['is-cancelled']);
            """);
        var js = AppJs;
        Assert.DoesNotContain("aufsichtKuerzel", js);
        Assert.DoesNotContain("sup-weg", js);
        Assert.Contains("cls.push(...aufsichtKlassen(card))", js);
        var css = AppCss;
        Assert.Contains(".card.card--supervision.is-past .card__line,", css);
        Assert.Contains(".card.card--supervision.is-abgegeben,", css);
        Assert.Contains(".card.card--supervision.is-sub .sup-menu,", css);
        Assert.Contains(".card.card--supervision.is-cancelled .card__line,", css);
    }

    [Fact]
    public void Kachelzeichen_Online_Verlegung_und_Balken()
    {
        var js = AppJs;
        // Online: Raumzeile entfällt, Kamerazeichen unten in der Zeichenecke, auch in den Details
        Assert.Contains("if (online) lines = lines.filter(l => l.key !== 'room');", js);
        Assert.Contains("const KACHEL_ONLINE = sym('video', 'ticon ticon--online');", js);
        Assert.Contains("dline--online", js);
        Assert.DoesNotContain("card__video", js);
        // Sprint 27: kein Verlegungszeichen auf der Kachel (wie iOS) – die Verlegung steht in den Details
        Assert.DoesNotContain("ticon--verlegt", js);
        Assert.DoesNotContain("card__ic--verlegt", js);
        var css = AppCss;
        Assert.DoesNotContain(".card .ticon--verlegt", css);
        // kein Seitenbalken; Zeilenabstand der Kachel in app.js wie in app.css (14 bzw. 16 px)
        // Fachfarbe als Streifen innen links (Standard „Klassisch“), nicht als Balken am Rand
        Assert.Contains(".card::before{\n  content:\"\"; position:absolute; z-index:0; pointer-events:none;\n  left:4px; top:4px; bottom:4px;", css);
        Assert.Contains("? 14 : 16;", js);
        Assert.Contains(".card__line{\n  display:block;\n  font-size:12px; line-height:14px;", css);
        Assert.Contains(".card__line{ font-size:13px; line-height:16px; }", css);
    }

    [Fact]
    public void Zusatzstunde_Einzelstunden_Ferien_und_Sperre()
    {
        var js = AppJs;
        // Zusatzstunde: Plakette statt Vertretungstext
        Assert.Contains("'Zusatzstunde'", js);
        // Sprint 27: manuelle Vertretungstexte stehen auch bei Zusatzstunden (Standardtexte filtert der Server)
        Assert.Contains("} else if (c.info){", js);
        // Einzelstunden über das Auswahlmenü im Titel, kein Segmentschalter mehr
        Assert.Contains("function detailTeilbar(ganz)", js);
        Assert.Contains("role=\"option\" data-l=", js);
        Assert.DoesNotContain("role=\"tab\" data-l=", js);
        // Ferien auf der Startseite (nächste 7 Tage, laufende und folgende Woche)
        Assert.Contains("nextnone--ferien", js);
        Assert.Contains("nextrow--ferien", js);
        Assert.Contains("const mo2 = iso(addDays(parseISO(mo), 7));", js);
        // gesperrte Woche als Karte über dem Raster
        Assert.Contains("<div class=\"sperre__karte\">", js);
        var css = AppCss;
        Assert.Contains(".sperre__karte{", css);
        Assert.Contains(".nextnone--ferien{ background:var(--up-frei-flaeche); }", css);
        // Ferien: Name und Zeitraum auf hellblauer Fläche
        Assert.Contains(".card--holiday .card__line.holiday-range{", css);
    }

    [Fact]
    public void Schrift_und_Groessen_nach_dem_Designsystem()
    {
        var css = AppCss;
        var tokens = File.ReadAllText(Path.Combine(Umgebung.Wurzel(), "mobile", "src", "UntPlanMobile", "wwwroot", "assets", "css", "tokens.css"));
        // IBM Plex Sans lokal (kein Netz), Grundgröße Mobile 15 px
        Assert.Contains("font-family:var(--up-schrift);", css);
        Assert.Contains("font-size:15px;", css);
        Assert.Contains("url(\"../fonts/plex-sans-400.woff2\")", tokens);
        foreach (var gewicht in new[] { 400, 500, 600 })
            Assert.True(File.Exists(Path.Combine(Umgebung.Wurzel(), "mobile", "src", "UntPlanMobile", "wwwroot", "assets", "fonts", $"plex-sans-{gewicht}.woff2")));
        // große Seitentitel 28 px/600, untere Leiste 11 px
        Assert.Contains(".grosstitel{\n  font-size:28px; font-weight:600;", css);
        Assert.Contains("font-size:11px; font-weight:500; line-height:13px;", css);
        // nur 400, 500 und 600 – nie fett
        Assert.DoesNotContain("font-weight:700", css);
        Assert.DoesNotContain("font-weight:bold", css);
        // keine Effekte: keine Verläufe, kein Glas
        Assert.DoesNotContain("linear-gradient(180deg", css.Replace("repeating-linear-gradient(180deg", ""));
        Assert.DoesNotContain("radial-gradient", css);
        Assert.DoesNotContain("backdrop-filter", css);
    }

    [Fact]
    public async Task Klassenleitung_erfasst_und_nimmt_Entschuldigungen_zurueck()
    {
        await using var u = await Umgebung.StartenAsync();
        // Abwesenheit in 5a (Klassenleitung FIS) anlegen – direkt in UntPlanWeb
        using var web = new HttpClient(new HttpClientHandler { CookieContainer = new CookieContainer() }) { BaseAddress = u.WebAdresse };
        web.DefaultRequestHeaders.Add("X-UntPlanWeb", "1");
        Assert.Equal(HttpStatusCode.OK, (await web.PostAsJsonAsync("/api/app/anmelden", new { login = "fis", passwort = Umgebung.Passwort })).StatusCode);
        var kind = (await Umgebung.HolenAsync(web, "/api/app/klassenbuch/schueler?klasse=5a")) is JsonObject o && o["schueler"] is JsonArray a1
            ? a1[0]!["id"]!.GetValue<int>()
            : (await Umgebung.HolenAsync(web, "/api/app/klassenbuch/schueler?klasse=5a")).AsArray()[0]!["id"]!.GetValue<int>();
        await Umgebung.JsonAsync(await web.PostAsJsonAsync("/api/app/abwesenheiten",
            new { schuelerId = kind, von = "2026-10-13", bis = "2026-10-13", stundeVon = 1, stundeBis = 3, status = "offen", bemerkung = "krank gemeldet" }));

        // über UntPlanMobile durchgereicht
        var mobil = await u.AngemeldetAsync("fis");
        var e = await Umgebung.HolenAsync(mobil, "/api/entschuldigungen/einstellungen");
        Assert.True(e["klassenleitung"]!.GetValue<bool>());
        var liste = (await Umgebung.HolenAsync(mobil, "/api/entschuldigungen/abwesenheiten?von=2026-10-01&bis=2026-10-14&klasse=5a")).AsArray();
        var abw = liste.First(x => x!["schuelerId"]!.GetValue<int>() == kind)!;
        Assert.Equal("offen", abw["status"]!.GetValue<string>());
        var ids = abw["ids"]!.AsArray().Select(x => x!.GetValue<int>()).ToArray();
        Assert.NotEmpty(ids);

        var r = await mobil.PostAsJsonAsync("/api/entschuldigungen/abwesenheit", new { ids, status = "entschuldigt", text = "Attest liegt vor.", datum = "2026-10-14", nachweis = "attest" });
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var detail = await Umgebung.HolenAsync(mobil, "/api/entschuldigungen/abwesenheit?ids=" + string.Join(",", ids));
        Assert.Equal("entschuldigt", detail["status"]!.GetValue<string>());

        r = await mobil.PostAsJsonAsync("/api/entschuldigungen/zuruecknehmen", new { ids });
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        detail = await Umgebung.HolenAsync(mobil, "/api/entschuldigungen/abwesenheit?ids=" + string.Join(",", ids));
        Assert.Equal("offen", detail["status"]!.GetValue<string>());

        // nur die Endpunkte des Vertrags
        Assert.Equal(HttpStatusCode.NotFound, (await mobil.GetAsync("/api/entschuldigungen/unbekannt")).StatusCode);
        Assert.Contains("zuruecknehmen", EntschuldigungenApi.Pfade);
    }

    [Fact]
    public void Entschuldigungen_in_der_Oberflaeche()
    {
        var js = AppJs;
        Assert.Contains("const ENT_URL = 'api/entschuldigungen/';", js);
        Assert.Contains("function entWischen(zeile, beimTippen, ausloesen)", js);
        Assert.Contains("entFetch('zuruecknehmen', { ids: a.ids })", js);
        Assert.Contains("id=\"sheetEnt\"", Datei("Vorlagen", "index.html"));
    }
}
