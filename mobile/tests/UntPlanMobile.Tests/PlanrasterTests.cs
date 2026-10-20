using System.Diagnostics;

namespace UntPlanMobile.Tests;

/// <summary>
/// EduOrga Mobile, Planraster (Referenz für iOS, siehe mobile/README.md „Planraster“): Kartendarstellung der Schule (Zeilenfolge,
/// Ausblenden, Name statt Kürzel), Zeilen auf den Bildschirm eingepasst, „+X“ statt Zählkarte mit Blatt der parallelen Stunden,
/// Tag/Woche als Segmentschalter, weiche Ecken, grauer Balken ohne Fachfarbe.
/// </summary>
public class PlanrasterTests
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

    [Fact]
    public void Kartendarstellung_der_Schule_steuert_die_Zeilen()
    {
        var node = Node();
        if (node is null) return;
        var skript = Path.Combine(Path.GetTempPath(), "edo-darstellung-" + Guid.NewGuid().ToString("N") + ".js");
        File.WriteAllText(skript, "const window = {};\nconst pruefe = (ist, soll) => { const a = JSON.stringify(ist), b = JSON.stringify(soll); if (a !== b) { console.error(a + ' statt ' + b); process.exit(1); } };\n"
            + Abschnitt(AppJs, "DARSTELLUNG") + """
            const D = window.EduOrgaDarstellung;
            const std = D.mitStandard(null);
            pruefe([std.fachfarbe, std.reihenfolge, std.raster, std.statusflaeche], ['balken-oben', 'zeilen', 'grau', true]);
            const zeilen = [{ key:'class', text:'5a', primary:true }, { key:'subject', text:'M' }, { key:'room', text:'R101' }];
            const txt = l => l.map(x => x.key + ':' + x.text + (x.primary ? '*' : ''));
            // Standard „EduOrga Standard“: Fach · Klasse · Lehrkraft · Raum, erste Zeile fett
            pruefe(txt(D.zeilen(zeilen, {}, 'teacher', std)), ['subject:M*', 'class:5a', 'room:R101']);
            // „Klassisch“: Lehrkraft bzw. Klasse oben
            pruefe(txt(D.zeilen(zeilen, {}, 'teacher', D.mitStandard({ reihenfolge:'element' }))), ['class:5a*', 'subject:M', 'room:R101']);
            // „Fach und Raum oben“ und Fach als Name
            pruefe(txt(D.zeilen(zeilen, {}, 'teacher', D.mitStandard({ reihenfolge:'fach', fach:'name' }), (a, c) => c === 'M' ? 'Mathematik' : c)),
                   ['subject:Mathematik*', 'class:5a', 'room:R101']);
            // Zeile 2 und Raum ausgeblendet – geänderte Werte bleiben
            pruefe(txt(D.zeilen(zeilen, {}, 'teacher', D.mitStandard({ zeile2:false, raum:false }))), ['subject:M*']);
            const geaendert = [{ key:'class', text:'5a' }, { key:'subject', text:'M' }, { key:'room', text:'R102', changed:true }];
            pruefe(txt(D.zeilen(geaendert, {}, 'teacher', D.mitStandard({ zeile2:false, raum:false }))), ['subject:M*', 'room:R102']);
            // Grenzen: Balken 2–6 px
            pruefe(D.mitStandard({ balkenbreite:12 }).balkenbreite, 6);
            """);
        try
        {
            using var p = Process.Start(new ProcessStartInfo(node, skript) { RedirectStandardError = true, UseShellExecute = false })!;
            var fehler = p.StandardError.ReadToEnd();
            p.WaitForExit(15000);
            Assert.True(p.ExitCode == 0, fehler);
        }
        finally { File.Delete(skript); }
    }

    [Fact]
    public void Aenderungstypen_wie_auf_allen_Plattformen()
    {
        var node = Node();
        if (node is null) return;
        var skript = Path.Combine(Path.GetTempPath(), "edo-aenderung-" + Guid.NewGuid().ToString("N") + ".js");
        File.WriteAllText(skript, "const window = {};\nconst pruefe = (ist, soll) => { const a = JSON.stringify(ist), b = JSON.stringify(soll); if (a !== b) { console.error(a + ' statt ' + b); process.exit(1); } };\n"
            + Abschnitt(AppJs, "AENDERUNG") + """
            const A = window.UntPlanAenderung;
            const f = c => { const x = A.statusFeld(c); return x ? x.text + ' ' + x.ton : null; };
            // Entfall, verlegt (Wochentag Datum, Stunde), zusätzlich – eigene Wortwahl
            pruefe(f({ blockType:'cancelled' }), 'entfällt entfall');
            pruefe(f({ blockType:'cancelled', moved:'von', movedTo:{ date:'2026-10-21', from:'12:20', lesson:6 } }), 'verlegt auf Mi 21.10., 6. Std entfall');
            pruefe(f({ blockType:'change', moved:'nach', movedFrom:{ date:'2026-10-19', from:'09:45', lesson:3 } }), 'verlegt von Mo 19.10., 3. Std aenderung');
            pruefe(f({ blockType:'change', extra:true }), 'zusätzlich aenderung');
            pruefe(f({ blockType:'change' }), null);
            pruefe(f({ blockType:'normal' }), null);
            // Tags: „neu (bisher)“ mit durchgestrichenem bisherigem Wert, „neu B070“, „bisher fehlt“
            pruefe(A.feldText('Gal', 'Gor'), 'Gal (Gor)');
            pruefe(A.feldHtml('105', '303'), '105 (<s>303</s>)');
            pruefe(A.feldHtml('Gal', ''), 'neu Gal');
            pruefe(A.feldText('B070', ''), 'neu B070');
            pruefe(A.feldText('', 'Abr', true), 'Abr fehlt');
            // Datenstand
            const st = A.studioStandText('2026-10-20 14:32:00', new Date(2026, 9, 20, 14, 37));
            pruefe([st.voll, st.rel, st.alt], ['Di 20.10.2026, 14:32', 'vor 5 Min.', false]);
            pruefe(A.studioStandText('2026-10-16 14:32:00', new Date(2026, 9, 20, 14, 37)).alt, true);
            // Kürzen: Fach bleibt, geänderte Zeile geht vor
            const z = [{ key:'subject' }, { key:'class' }, { key:'teacher' }, { key:'room', changed:true }];
            pruefe(A.zeilenKuerzen(z, 2).map(l => l.key), ['subject', 'room']);
            """);
        try
        {
            using var p = Process.Start(new ProcessStartInfo(node, skript) { RedirectStandardError = true, UseShellExecute = false })!;
            var fehler = p.StandardError.ReadToEnd();
            p.WaitForExit(15000);
            Assert.True(p.ExitCode == 0, fehler);
        }
        finally { File.Delete(skript); }
        // Stundenkarte: Tags, Statusleiste, rote Fläche beim Entfall, Legende „Kennzeichnungen“, Mitteilung
        Assert.Contains(".feld--entfall{ background:var(--up-entfall-feld);", AppCss);
        Assert.Contains("background-color:var(--up-entfall-flaeche);", AppCss);
        Assert.Contains(".card--change::before, .card--released::before{ background:var(--st-aenderung); width:3px; }", AppCss);
        // Stundenkarte v6: Leiste 5 px, Kontur 1,5 px, Radius 4 px (gleich in Web und iOS)
        Assert.Contains(".card--change::before, .card--released::before, .card--cancelled::before{ width:max(5px, var(--balken, 5px)); border-radius:0; }", AppCss);
        Assert.Contains("[data-rahmen=\"fein\"]{ --karte-rahmen:inset 0 0 0 1.5px var(--kachel-linie); }", AppCss);
        // Stundenkarte v7: Streifen oben (3 px) statt Leiste, Prüfung gelb, Tags als reiner Text, Radius höchstens 3 px
        Assert.Contains("[data-fachfarbe=\"balken-oben\"] .card.card--exam::before{ display:block; background:var(--up-pruefung-streifen, #b7791f); }", AppCss);
        Assert.Contains("border-radius:min(var(--kradius, 2px), 3px);", AppCss);
        Assert.Contains(".card--exam::before{ background:var(--up-pruefung-streifen, #b7791f); }", AppCss);
        Assert.Contains("background:none; box-shadow:none; outline:none; padding:0; border-radius:0; font-weight:600;", AppCss);
        Assert.Contains("<div class=\"kennz\" role=\"list\"", Datei("Vorlagen", "index.html"));
        Assert.Contains("class=\"notiz\"", AppJs);
    }

    [Fact]
    public void Raster_Plus_Badge_Segmentschalter_und_Ecken()
    {
        var js = AppJs;
        var css = AppCss;
        var html = Datei("Vorlagen", "index.html");
        // Zeilen statt Minuten, der Schultag passt auf den Bildschirm
        Assert.Contains("const RASTER = { zeile: 57, gross: 16, klein: 3 };", js);
        Assert.Contains("function rasterMasse(verfuegbar, letzte)", js);
        // parallele Stunden: „+X“ in der Rasterzelle, Blatt mit allen Stunden (keine Zählkarte mehr)
        Assert.Contains("class=\"plusbadge", js);
        Assert.Contains("function paralleleZeigen(datum, von, bis)", js);
        Assert.DoesNotContain("<button class=\"parcount", js);
        Assert.Contains(".plusbadge{", css);
        // Tag | Woche ohne Untermenü, Aufziehen/Zusammenziehen
        Assert.Contains("id=\"planSeg\"", html);
        Assert.Contains("setView('day', pickDefaultDay())", js);
        // Ecken 2–6 px (Standard 4), grauer Balken ohne Fachfarbe (hell und dunkel)
        Assert.Contains("Math.min(6, Math.max(2, d.eckenradius ?? 4))", js);
        Assert.Contains(".card.ohne-fach::before{ background:var(--balken-grau); }", css);
        Assert.Contains("--balken-grau:      #b4bec4;", css);
        Assert.Contains("--balken-grau:      #56626c;", css);
    }
}
