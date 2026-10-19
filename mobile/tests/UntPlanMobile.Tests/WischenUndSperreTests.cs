using System.Diagnostics;
using System.Text.RegularExpressions;

namespace UntPlanMobile.Tests;

/// <summary>
/// Gleichstand mit UntPlan für iOS: Wischen zwischen Wochen/Tagen sperrt die Richtung (waagerecht kein senkrechtes Rollen, senkrecht
/// kein Wochenwechsel), Sperrhinweis-Texte mit Standardsatz, vergangene Stunden und Plaketten.
/// </summary>
public class WischenUndSperreTests
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

    /// <summary>Führt einen Abschnitt aus app.js mit Prüfungen in Node aus (ohne Node: nur die statische Prüfung).</summary>
    private static void MitNode(string abschnitt, string pruefungen)
    {
        var node = Node();
        if (node is null) return;
        var skript = Path.Combine(Path.GetTempPath(), "untplan-wisch-" + Guid.NewGuid().ToString("N") + ".js");
        File.WriteAllText(skript, "const window = {};\n" + abschnitt + """

            const pruefe = (ist, soll) => { const a = JSON.stringify(ist), b = JSON.stringify(soll); if (a !== b) { console.error(a + ' statt ' + b); process.exit(1); } };
            """ + pruefungen + "\nconsole.log('ok');\n");
        try
        {
            using var p = Process.Start(new ProcessStartInfo(node, skript) { RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false })!;
            var aus = p.StandardOutput.ReadToEnd() + p.StandardError.ReadToEnd();
            p.WaitForExit(10000);
            Assert.True(p.ExitCode == 0, aus);
            Assert.Contains("ok", aus);
        }
        finally { File.Delete(skript); }
    }

    // ------------------------------------------------------------------------------------------ Wischen

    [Fact]
    public void Wischrichtung_wird_am_Anfang_erkannt()
    {
        MitNode(Abschnitt(AppJs, "WISCHRICHTUNG"), """
            const r = window.UntPlanWischen.richtung;
            pruefe(window.UntPlanWischen.schwelle, 8);
            pruefe(r(0, 0), null);
            pruefe(r(7, -7), null);          // unter der Schwelle: noch offen
            pruefe(r(-30, 6), 'x');          // deutlich waagerecht
            pruefe(r(40, -20), 'x');
            pruefe(r(12, 10), 'y');          // schräg: Rollen gewinnt
            pruefe(r(3, 40), 'y');
            pruefe(r(-9, 0), 'x');
            pruefe(r(0, -9), 'y');
            """);
    }

    [Fact]
    public void Waagerechte_Geste_sperrt_das_senkrechte_Rollen()
    {
        var js = AppJs;
        var beginn = js.IndexOf("Wischen zwischen Wochen und Tagen", StringComparison.Ordinal);
        var ende = js.IndexOf("function planBlaettern", beginn, StringComparison.Ordinal);
        Assert.True(beginn > 0 && ende > beginn);
        var teil = js[beginn..ende];

        // touchmove darf nicht passiv sein, sonst wirkt preventDefault in Safari nicht
        var move = teil.IndexOf("addEventListener('touchmove'", StringComparison.Ordinal);
        Assert.True(move > 0);
        var moveEnde = teil.IndexOf("}, {", teil.IndexOf("shiftBald(dx);", move, StringComparison.Ordinal), StringComparison.Ordinal);
        Assert.True(moveEnde > move);
        Assert.StartsWith("}, { passive:false });", teil[moveEnde..]);
        var rumpf = teil[move..moveEnde];
        Assert.Contains("wischRichtung(mx, my)", rumpf);
        Assert.Contains("if (lock !== 'x') return;", rumpf);
        Assert.Contains("e.preventDefault()", rumpf);
        // erst nach der Erkennung verhindern — ein senkrechter Anfang rollt ungehindert
        Assert.True(rumpf.IndexOf("if (lock !== 'x') return;", StringComparison.Ordinal) < rumpf.IndexOf("e.preventDefault()", StringComparison.Ordinal));

        // Wächter für Browser, die das Ereignis nicht mehr abbrechen lassen, und Klasse für den Safari-Schwung
        Assert.Contains("rollSperre(true)", teil);
        Assert.Contains("is-wischsperre", teil);
        Assert.Contains("addEventListener('scroll'", teil);
        Assert.Contains("if (gesperrt) rollSperre(false);", teil);
        Assert.Matches(new Regex(@"\.gridscroll\.is-wischsperre\{\s*overflow-y:hidden;\s*\}"), AppCss);
        Assert.Matches(new Regex(@"\.gridscroll\{[^}]*touch-action:pan-y;"), AppCss);
    }

    // ------------------------------------------------------------------------------------------ Sperrhinweis

    [Fact]
    public void Sperrhinweis_mit_Standardsatz()
    {
        var js = AppJs;
        MitNode(Abschnitt(js, "SPERRE"), """
            const s = window.UntPlanSperre;
            pruefe(s.titel, 'Für diesen Zeitraum ist kein Plan freigegeben.');
            pruefe(s.standard, 'Die Schule zeigt den Plan nur für einen begrenzten Zeitraum an.');
            pruefe(s.erklaerung(''), s.standard);
            pruefe(s.erklaerung('   '), s.standard);
            pruefe(s.erklaerung(null), s.standard);
            pruefe(s.erklaerung(undefined), s.standard);
            pruefe(s.erklaerung(' Der Plan ist nur 2 Wochen im Voraus sichtbar. '), 'Der Plan ist nur 2 Wochen im Voraus sichtbar.');
            """);
        // Raster: Titel immer, darunter der Hinweis (oder der Standardsatz); „Heute“: Sperrsatz statt „Kein Unterricht“
        Assert.Contains("<p class=\"sperre__text\">${SPERRE_TITEL}</p>", js);
        Assert.Contains("<p class=\"sperre__hinweis\">${esc(sperrErklaerung(w.sperrhinweis))}</p>", js);
        Assert.Contains("nextnone--sperre", js);
        Assert.Contains("<span>${SPERRE_TITEL}</span>", js);
    }

    // ------------------------------------------------------------------------------------------ Vergangene Stunden, Plaketten

    [Fact]
    public void Kacheln_nach_dem_Designsystem()
    {
        var css = AppCss;
        // Standard „Klassisch“: weiße Karte mit flachem Schatten auf grauem Raster, Fachfarbe als Streifen innen links;
        // Tönung nur in den Varianten „Farbfläche“ bzw. „Balken mit Tönung“ der Schule
        Assert.Contains("background-color:var(--karte);\n  box-shadow:var(--karte-rahmen);", css);
        Assert.Contains("--raster:           #edf1f2;", css);
        Assert.Contains("background-color:color-mix(in srgb, var(--fach) var(--toenung, 12%), var(--karte));", css);
        // vergangene Stunden: schwächer, Zustände bleiben erkennbar
        Assert.Contains(".card.is-past{ --anteil:var(--kachel-anteil-vorbei);", css);
        // Änderung: violette Linie und helle Statusfläche, geänderter Wert unterstrichen, offene Vertretung mit „?“
        Assert.Contains(".card--change{ box-shadow:inset 0 0 0 1px var(--st-aenderung); }", css);
        Assert.Contains(".mit-statusflaeche .card--change{ background-color:var(--up-aenderung-flaeche); }", css);
        Assert.Contains(".badge--frage{", css);
        Assert.Contains("text-decoration:underline;", css);
        Assert.Contains(".badge.badge--removed.badge--open{", css);
        // Entfall schraffiert, Prüfung bernstein, Veranstaltung gestrichelt violett, Ferien hellblau
        Assert.Contains("repeating-linear-gradient(-45deg, var(--schraffur) 0 1px, transparent 1px 6px)", css);
        Assert.Contains("background-color:var(--up-pruefung-flaeche);", css);
        Assert.Contains("border:1px dashed color-mix(in srgb, var(--up-text-2) 60%, transparent);", css);
        Assert.Contains("background-color:var(--up-frei-flaeche);", css);
        // „ohne mich“: gepunkteter Rahmen statt Eckklammern
        Assert.Contains("outline:1.5px dotted", css);
        Assert.DoesNotContain(".corners", css);
        Assert.DoesNotContain("corners", AppJs);
        // Statusfarben und Dunkelmodus kommen aus den Grundwerten (tokens.css)
        Assert.Contains(":root[data-thema=\"dunkel\"]{", css);
        Assert.Contains("--up-aenderung: #6d4fc2;", Datei("wwwroot", "assets", "css", "tokens.css"));
    }

    [Fact]
    public void Kein_fremder_Produktname_in_der_Oberflaeche()
    {
        foreach (var inhalt in new[] { AppJs, AppCss, Datei("Vorlagen", "index.html") })
            Assert.DoesNotMatch(new Regex("un" + "tis", RegexOptions.IgnoreCase), inhalt);
    }
}
