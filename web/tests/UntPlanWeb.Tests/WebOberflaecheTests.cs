using System.Text.RegularExpressions;
using Xunit;

namespace UntPlanWeb.Tests;

/// <summary>
/// Quelltext der Oberfläche (web/client, React + TypeScript + MUI): Aufbau, Adressen, Marke EduOrga und Gestaltungsregeln.
/// Die Tests lesen die Quellen, nicht die Build-Ausgabe – sie laufen also auch ohne „npm run build“.
/// </summary>
public class WebOberflaecheTests
{
    private static string Client(params string[] teile)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null && !File.Exists(Path.Combine(dir.FullName, "client", "package.json"))) dir = dir.Parent;
        Assert.NotNull(dir);
        return Path.Combine(new[] { dir!.FullName, "client" }.Concat(teile).ToArray());
    }

    private static string Lesen(params string[] teile) => File.ReadAllText(Client(teile));

    private static IEnumerable<(string Pfad, string Inhalt)> Quellen() =>
        Directory.EnumerateFiles(Client("src"), "*.*", SearchOption.AllDirectories)
            .Where(p => p.EndsWith(".ts") || p.EndsWith(".tsx") || p.EndsWith(".css"))
            .Select(p => (p, File.ReadAllText(p)))
            .Concat(new[] { (Client("index.html"), Lesen("index.html")), (Client("monitor.html"), Lesen("monitor.html")) });

    [Fact]
    public void Build_schreibt_nach_wwwroot_und_laesst_statische_Dateien_stehen()
    {
        var vite = Lesen("vite.config.ts");
        Assert.Contains("UntPlanWeb/wwwroot", vite);
        Assert.Contains("emptyOutDir: false", vite);        // Schriften, Bilder, Manifest und neuigkeiten.json bleiben in wwwroot
        Assert.Contains("monitor.html", vite);
        var paket = Lesen("package.json");
        Assert.Contains("\"build\": \"tsc --noEmit && vite build\"", paket);
        Assert.True(File.Exists(Client("package-lock.json")));
        var wwwroot = Path.Combine(Client(), "..", "src", "UntPlanWeb", "wwwroot");
        foreach (var datei in new[] { "neuigkeiten.json", "manifest.webmanifest", "img/logo.svg", "fonts/plex-sans-400.woff2" })
            Assert.True(File.Exists(Path.Combine(wwwroot, datei)), datei);
    }

    [Fact]
    public void Alle_Menuepunkte_haben_eine_Seite()
    {
        var menue = Lesen("src", "app", "menue.tsx");
        var register = Lesen("src", "pages", "register.ts");
        var seiten = Regex.Matches(register, @"^\s+(\w+): p\(", RegexOptions.Multiline).Select(m => m.Groups[1].Value).ToHashSet();
        var adressen = Regex.Matches(menue, @"href: '#/(\w+)").Select(m => m.Groups[1].Value).Distinct().ToList();
        Assert.NotEmpty(adressen);
        foreach (var name in adressen) Assert.True(seiten.Contains(name), $"Seite „{name}“ fehlt in pages/register.ts");
        // Adressen wie bisher (#/plan/<typ>/<name>/<datum>, #/tag/…, #/klassenbuch/…): Hash-Router bleibt
        Assert.Contains("location.hash", Lesen("src", "lib", "router.ts"));
    }

    [Fact]
    public void Online_wird_nur_angezeigt_nicht_umgeschaltet()
    {
        var details = Lesen("src", "components", "plan", "Stundendetails.tsx");
        Assert.Contains("Online-Unterricht beitreten", details);
        Assert.Contains("EduOrga Studio", details);          // Hinweis: festgelegt wird es im Studio
        Assert.DoesNotContain("role=\"switch\"", details);
        // Sprechtag hat eigene Online-Gespräche (Einstellung der Lehrkraft) – das ist kein Online-Unterricht.
        foreach (var (pfad, inhalt) in Quellen().Where(q => !q.Pfad.Contains($"{Path.DirectorySeparatorChar}sprechtag{Path.DirectorySeparatorChar}")))
        {
            Assert.False(Regex.IsMatch(inhalt, @"senden\([^)]*online", RegexOptions.IgnoreCase), pfad);
            Assert.False(Regex.IsMatch(inhalt, @"<Switch[^>]*online", RegexOptions.IgnoreCase), pfad);
        }
        Assert.Contains("istOnline", Lesen("src", "components", "plan", "Kachel.tsx"));
    }

    [Fact]
    public void Stundenplan_mit_Zeitachse_Jetzt_Linie_Legende_und_Tagesansicht()
    {
        var raster = Lesen("src", "components", "plan", "Wochenraster.tsx");
        Assert.Contains("zeitmassstab", raster);
        Assert.Contains("jetztMinuten", raster);
        Assert.Contains("nurTag", raster);
        var legende = Lesen("src", "components", "plan", "Legende.tsx");
        foreach (var art in new[] { "Änderung", "Entfall", "Prüfung", "Termin", "Vertreten", "Buchung" }) Assert.Contains(art, legende);
        var logik = Lesen("src", "components", "plan", "logik.ts");
        Assert.Contains("export function spuren", logik);
        Assert.Contains("istEntfall", logik);
    }

    [Fact]
    public void Stundenplan_klassisch_kompakt_mit_klarem_Status_und_ohne_Pillen()
    {
        // Kachel: gemeinsame Änderungsregeln (aenderung.ts) – grün mit schraffierter Kante und Feld „+neu (bisher)“, Entfall rot und durchgestrichen
        var kachel = Lesen("src", "components", "plan", "Kachel.tsx");
        Assert.Contains("FachQuadrat", kachel);
        Assert.Contains("kachel.flaeche", kachel);
        Assert.Contains("KACHEL_PLAKETTEN", kachel);
        Assert.Contains("mitToenung(d.fachfarbe)", kachel);
        Assert.Contains("data-fachbalken", kachel);
        Assert.Contains("s.aenderung.flaeche", kachel);
        Assert.Contains("s.entfall.flaeche", kachel);
        Assert.Contains("export const leiste", kachel);                 // durchgehende 3-px-Leiste in der Statusfarbe, offen grau gestrichelt
        Assert.Contains("data-kennzeichen", kachel);
        Assert.Contains("line-through", kachel);
        Assert.Contains("kartenbild(k, typ)", kachel);
        var aenderung = Lesen("src", "components", "plan", "aenderung.ts");
        foreach (var muster in new[] { "`${praefix}${k} statt ${alt}`", "`${alt} fehlt`", "'Vertretung folgt'", "'entfällt'", "`verlegt → ${ziel}`", "`verlegt ← ${von}`", "'zusätzlich'", "`${k.fach} statt ${k.fachAlt}`", "praefix: 'Raum '" })
            Assert.Contains(muster, aenderung);
        var darstellung = Lesen("src", "components", "plan", "darstellung.tsx");
        // Standard „EduOrga Standard“: helle Karte auf hellgrauem Raster, Kante links (Fachfarbe mit Tönung), Fach · Klasse · Lehrkraft · Raum
        Assert.Matches(@"STANDARD: Kartendarstellung = \{\s*fachfarbe: 'balken-flaeche', balkenbreite: 4,[^}]*flaeche: 'weiss', rahmen: 'schatten', eckenradius: 4, dichte: 'kompakt',[^}]*kuerzel: 'text', statuswoerter: false, statusflaeche: true,\s*reihenfolge: 'zeilen', raster: 'grau'", darstellung);
        Assert.Contains("data-fachbalken={innen && !bild.ton ? 'innen'", kachel);
        Assert.Contains("d.reihenfolge !== 'element'", kachel);
        Assert.Contains("d.raster === 'grau'", Lesen("src", "components", "plan", "Wochenraster.tsx"));
        Assert.Contains("'Fach · Klasse · Lehrkraft · Raum'", Lesen("src", "pages", "admin", "Stundenkarten.tsx"));
        Assert.Contains("{ id: 'standard', name: 'EduOrga Standard'", darstellung);
        foreach (var v in new[] { "'klassisch'", "'kompakt'", "'sachlich'", "'akzent'", "'flaeche'", "'minimal'" }) Assert.Contains($"id: {v}", darstellung);
        // Legende „Kennzeichnungen“ (eigene Gliederung)
        Assert.Contains("export function Kennzeichnungen", Lesen("src", "components", "plan", "Legende.tsx"));
        // kompakte Karten füllen die Rasterzelle (Abstand je Dichte)
        Assert.Contains("luecke: 1", darstellung);
        Assert.Contains("DICHTE[d.dichte].luecke", Lesen("src", "components", "plan", "Wochenraster.tsx"));
        var logik = Lesen("src", "components", "plan", "logik.ts");
        var erlaubt = Regex.Match(logik, @"KACHEL_PLAKETTEN = new Set\(\[([^\]]*)\]").Groups[1].Value;
        Assert.NotEmpty(erlaubt);
        foreach (var wort in new[] { "Entfall", "Offen", "Vertreten", "Zusatz" }) Assert.DoesNotContain($"'{wort}'", erlaubt);
        Assert.Contains("art=\"offen\"", Lesen("src", "components", "plan", "Werte.tsx"));
        // Thema: keine Pillenform, Karten höchstens 8 px
        var thema = Lesen("src", "theme.ts");
        Assert.DoesNotContain("999", thema);
        Assert.Contains("shape: { borderRadius: 4 }", thema);
        foreach (var datei in new[] { "Wochenraster.tsx", "Legende.tsx", "Kachel.tsx" })
            Assert.DoesNotContain("borderRadius: 999", Lesen("src", "components", "plan", datei));
    }

    [Fact]
    public void Ohne_Fremdnamen_ohne_Orange_und_ohne_fette_Schrift()
    {
        var fremd = new string(new[] { 'u', 'n', 't', 'i', 's' });
        foreach (var (pfad, inhalt) in Quellen())
        {
            Assert.False(inhalt.Contains(fremd, StringComparison.OrdinalIgnoreCase), pfad);
            Assert.False(Regex.IsMatch(inhalt, @"font-?weight:\s*['""]?(700|800|900|bold)", RegexOptions.IgnoreCase), pfad);
            Assert.False(Regex.IsMatch(inhalt, @"\borange\b", RegexOptions.IgnoreCase), pfad);
        }
        Assert.Contains("#164c55", Lesen("src", "theme.ts"));
    }

    [Fact]
    public void Marke_EduOrga_Web_mit_Slogan_Logo_und_Rechtshinweis()
    {
        // Seitentitel, Manifest, Symbole und Themenfarbe
        var index = Lesen("index.html");
        Assert.Contains("<title>EduOrga Web</title>", index);
        Assert.Contains("content=\"#164c55\"", index);
        var wwwroot = Path.Combine(Client(), "..", "src", "UntPlanWeb", "wwwroot");
        var manifest = File.ReadAllText(Path.Combine(wwwroot, "manifest.webmanifest"));
        Assert.Contains("\"name\": \"EduOrga Web\"", manifest);
        Assert.Contains("\"theme_color\": \"#164c55\"", manifest);
        Assert.Contains("#164c55", File.ReadAllText(Path.Combine(wwwroot, "img", "logo.svg")));
        foreach (var png in new[] { "icon-192.png", "icon-512.png", "maskable-192.png", "maskable-512.png", "apple-touch-icon.png" })
            Assert.True(File.Exists(Path.Combine(wwwroot, "img", png)), png);
        // Marke, Slogan und rechtlicher Hinweis (design/MARKE.md) – Anmeldeseite und „Über EduOrga“
        var marke = Lesen("src", "components", "Marke.tsx");
        Assert.Contains("Einfach mehr Schulalltag.", marke);
        Assert.Contains("privates Hobbyprojekt eines Auszubildenden zum Fachinformatiker für Systemintegration", marke);
        Assert.Contains("Unterstützung von Claude (Anthropic)", marke);
        var anmeldung = Lesen("src", "app", "Anmeldung.tsx");
        Assert.Contains("SLOGAN", anmeldung);
        Assert.Contains("UeberDialog", anmeldung);
        Assert.Contains("UeberDialog", Lesen("src", "app", "Shell.tsx"));
        Assert.Contains("Rechtshinweis", Lesen("src", "pages", "admin", "Wartung.tsx"));
        // in der Oberfläche heißt das Produkt EduOrga – technische Kennungen (Kopf X-UntPlanWeb, Feldnamen) bleiben
        foreach (var (pfad, inhalt) in Quellen())
        {
            var ohneTechnik = inhalt.Replace("X-UntPlanWeb", "").Replace("UntPlanNext", "").Replace("ausUntPlan", "").Replace("kapazitaetUntPlan", "");
            Assert.False(ohneTechnik.Contains("UntPlan"), pfad);
        }
        // Farben: Primär Petrol, Akzent, Hintergrund, Text; Statusfarbe Änderung grün, Termin magenta
        var thema = Lesen("src", "theme.ts");
        foreach (var f in new[] { "#28747a", "#f5f7f8", "#24363b", "#2f855a", "#a3347c" }) Assert.Contains(f, thema);
        Assert.Contains("nav: {", thema);                                // Seitenleiste in der Primärfarbe
        Assert.Contains("dark: {", thema);                               // Dunkelmodus mit eigener Petrol-Palette
        Assert.Contains("useColorScheme", Lesen("src", "app", "Shell.tsx"));
        Assert.Contains("defaultMode=\"system\"", Lesen("src", "main.tsx"));
    }

    [Fact]
    public void Navigation_klassisch_ohne_Pillen()
    {
        // aktive Zeile: volle Breite, eckig, leichte Tönung und 3-px-Kante links – keine abgerundete „Pille“ mit Einzug
        var shell = Lesen("src", "app", "Shell.tsx");
        Assert.Contains("borderRadius: 0", shell);
        Assert.Contains("inset 3px 0 0 var(--mui-palette-nav-marke)", shell);
        Assert.Contains("const zeile = { color: 'nav.text', borderRadius: 0", shell);
        Assert.Contains("inset 3px 0 0 ${theme.vars.palette.secondary.main}", Lesen("src", "theme.ts"));
    }

    [Fact]
    public void Eigene_Menuestruktur_mit_alten_Adressen_als_Alias()
    {
        var menue = Lesen("src", "app", "menue.tsx");
        foreach (var bereich in new[] { "'Start'", "'Mein Tag'", "'Stundenpläne'", "'Vertretungen'", "'Unterricht & Prüfungen'", "'Klassenbuch'", "'Kommunikation'", "'Termine & Buchungen'", "'Stammdaten'", "'Verwaltung'" })
            Assert.Contains($"text: {bereich}", menue);
        foreach (var punkt in new[] { "'Abwesenheit melden'", "'Raum buchen'", "'Geräte & Medien buchen'", "'Elternsprechtag'", "'Termin eintragen'", "'Raumbelegung'", "'Über EduOrga'" })
            Assert.Contains($"text: {punkt}", menue);
        // keine Bezeichnungen wie „Melden“, „Buchen“, „Übersicht“ oder „Sprechtag“ als Menüpunkt
        foreach (var alt in new[] { "'Melden'", "'Buchen'", "'Übersicht'", "'Sprechtag'", "'Ressource buchen'", "'Neue Aktivität'" })
            Assert.DoesNotContain($"text: {alt}", menue);
        // bisherige Adressen bleiben (Lesezeichen, Links aus Mitteilungen); neue sprechende Adressen als Alias
        foreach (var adresse in new[] { "#/heute", "#/uebersicht", "#/melden/abwesenheit", "#/buchen/raum", "#/buchen/ressource", "#/sprechtag", "#/mitteilungen", "#/admin/sync" })
            Assert.Contains($"'{adresse}'", menue);
        Assert.Contains("export const ALIASE", menue);
        Assert.Contains("elternsprechtag: ['sprechtag']", menue);
        Assert.Contains("ohneAlias(useHash())", Lesen("src", "app", "Shell.tsx"));
    }

    [Fact]
    public void Datumsfelder_mit_Beschriftung_oben_und_Mindestbreite()
    {
        // Datums- und Zeitfelder nur über die gemeinsamen MUI-Picker; Beschriftung immer oben, damit das Kalendersymbol keinen Text verdeckt
        var auswahl = Lesen("src", "components", "Auswahl.tsx");
        Assert.Contains("const label = { shrink: true }", auswahl);
        Assert.Equal(3, Regex.Matches(auswahl, "InputLabelProps: label").Count);
        Assert.Contains("FELD_MIN = { datum: 168, zeit: 112, datumZeit: 220 }", auswahl);
        Assert.Contains("deDE.components.MuiLocalizationProvider", Lesen("src", "main.tsx"));   // „TT.MM.JJJJ“ statt „DD.MM.YYYY“
        var nativ = new Regex("type=[\"'](date|time|datetime-local)[\"']");
        foreach (var (pfad, inhalt) in Quellen()) Assert.False(nativ.IsMatch(inhalt), pfad);
        // Sprechtag: die drei Zeitpunkte nebeneinander im Raster statt gequetscht
        Assert.Contains("minmax(220px, 1fr)", Lesen("src", "pages", "sprechtag", "SprechtagFormular.tsx"));
    }
    [Fact]
    public void Darstellung_der_Stundenkarten_mit_Editor_und_Live_Vorschau()
    {
        // Einstellung kommt mit der Sitzung und wirkt über den Kontext auf Kachel, Legende, Listen und Stundendetails
        Assert.Contains("DarstellungsAnbieter", Lesen("src", "app", "sitzung.tsx"));
        Assert.Contains("useDarstellung", Lesen("src", "components", "plan", "Kachel.tsx"));
        Assert.Contains("FachMarke", Lesen("src", "components", "plan", "Stundendetails.tsx"));
        Assert.Contains("FachMarke", Lesen("src", "pages", "Heute.tsx"));
        Assert.Contains("FachMarke", Lesen("src", "pages", "Uebersicht.tsx"));
        // Editor unter Administration: Vorlagen, Live-Vorschau mit dem echten Wochenraster, Speichern/Abbrechen/Zurücksetzen
        var editor = Lesen("src", "pages", "admin", "Stundenkarten.tsx");
        foreach (var x in new[] { "<Wochenraster", "VORLAGEN", "Speichern", "Abbrechen", "Zurücksetzen auf Standard", "/api/app/darstellung", "aria-label" }) Assert.Contains(x, editor);
        Assert.Contains("#/admin/stundenkarten", Lesen("src", "app", "menue.tsx"));
        Assert.Contains("'stundenkarten'", Lesen("src", "pages", "admin", "Admin.tsx"));
    }

    [Fact]
    public void Klassenbuch_Unterrichtsstunde_als_grosses_Fenster_mit_Reitern_und_Unternavigation()
    {
        // Stunde aus Plan, Klassenbuch und Offenen Stunden: großes zentriertes Fenster statt Seitenleiste, Reiter, Blättern, Tasten, Autospeichern
        var details = Lesen("src", "components", "plan", "Stundendetails.tsx");
        Assert.Contains("<Dialog open", details);
        Assert.DoesNotContain("<Drawer", details);
        Assert.Contains("min(1360px, 94vw)", details);
        foreach (var x in new[] { "'Stunde'", "'Anwesenheit'", "'Einträge'", "'Prüfungen'", "'Verlauf'", "ArrowLeft", "Alle Änderungen gespeichert", "Stand der Dokumentation" })
            Assert.Contains(x, details);
        var stunde = Lesen("src", "components", "klassenbuch", "stunde", "ReiterStunde.tsx");
        foreach (var x in new[] { "Thema und Inhalt", "Hausaufgaben", "Fällig am", "nächste Stunde", "vormerken(" }) Assert.Contains(x, stunde);
        var anw = Lesen("src", "components", "klassenbuch", "stunde", "ReiterAnwesenheit.tsx");
        foreach (var x in new[] { "'Anwesend'", "'Abwesend'", "'Verspätet'", "Sitzplan", "Gemeldet", "Befreit" }) Assert.Contains(x, anw);
        // Klassenbuch-Bereich: Unternavigation statt vieler Menüpunkte, alte Adressen bleiben (verborgene Punkte mit Rechteprüfung)
        var bereich = Lesen("src", "components", "klassenbuch", "Bereich.tsx");
        foreach (var x in new[] { "'Unterricht'", "'Schüler*innen'", "'Klasse'", "allePunkte(menue(ich))" }) Assert.Contains(x, bereich);
        Assert.Contains("KlassenbuchRahmen", Lesen("src", "app", "Shell.tsx"));
        var menue = Lesen("src", "app", "menue.tsx");
        foreach (var adresse in new[] { "'#/offen'", "'#/eintraege'", "'#/hausaufgaben'", "'#/befreiungen'", "'#/dienste'", "'#/berichte'", "'#/sitzplan'", "'#/klassenbuch/-/woche'" })
            Assert.Contains(adresse, menue);
        Assert.True(Regex.Matches(menue, "verborgen: true").Count >= 8);
        // Wochenübersicht mit Stand je Stunde; Eltern melden Abwesenheiten
        var kb = Lesen("src", "pages", "klassenbuch", "Klassenbuch.tsx");
        foreach (var x in new[] { "Dokumentiert", "Entfallen", "Geplant", "Nur offene" }) Assert.Contains(x, kb);
        Assert.Contains("/api/app/familie/meldungen", Lesen("src", "pages", "familie", "Meldungen.tsx"));
        Assert.Contains("/bestaetigen", Lesen("src", "pages", "klassenbuch", "Abwesenheitsmeldungen.tsx"));
    }

    [Fact]
    public void Stundenplan_grauer_Balken_ohne_Fachfarbe_und_gleichzeitige_Stunden_mit_Plus()
    {
        // ohne Fachfarbe grauer Balken – eigene Themenfarbe für hell und dunkel, nicht halbtransparent
        var theme = Lesen("src", "theme.ts");
        Assert.Equal(2, Regex.Matches(theme, @"balken: '#[0-9a-f]{6}'").Count);
        var kachel = Lesen("src", "components", "plan", "Kachel.tsx");
        Assert.Contains("palette.kachel.balken", kachel);
        Assert.Contains("farbe ?? pal.kachel.balken", kachel);
        Assert.DoesNotContain("farbe ? 1 : 0.5", kachel);
        // gleichzeitige Stunden: erste Stunde über die volle Breite, „+X“ rechts, Klick listet alle
        var raster = Lesen("src", "components", "plan", "Wochenraster.tsx");
        Assert.Contains("parallelGruppen", raster);
        Assert.Contains("+{versteckt.length}", raster);
        Assert.Contains("Stunden gleichzeitig", raster);
        Assert.Contains("<Popover", raster);
    }

    [Fact]
    public void Keine_KI_Anmutung_nach_Pruefliste()
    {
        // Prüfliste in design/DESIGN.md (Abschnitt 9) – gilt für alle Oberflächen
        var design = File.ReadAllText(Path.Combine(Directory.GetParent(Client())!.Parent!.FullName, "design", "DESIGN.md"));
        Assert.Contains("Keine KI-Anmutung – Prüfliste", design);
        var bausteine = Lesen("src", "components", "Bausteine.tsx");
        var seite = Lesen("src", "components", "Seite.tsx");
        foreach (var (pfad, inhalt) in Quellen())
        {
            var datei = Path.GetFileName(pfad);
            // Initialen-Avatare nur im Kontomenü der Seitenleiste
            if (datei != "Shell.tsx") Assert.False(Regex.IsMatch(inhalt, @"<Avatar\b|NamensAvatar|avatarFarbe"), pfad);
            // Knöpfe mit Text ohne Symbol (nur „Zurück“-Pfeil)
            foreach (Match m in Regex.Matches(inhalt, @"startIcon=\{<(\w+)")) Assert.True(m.Groups[1].Value == "ArrowBackRounded", $"{pfad}: startIcon {m.Groups[1].Value}");
            // keine dekorativen Symbole, keine Pillen, Radius höchstens 6 px (sx-Einheit 4 px → höchstens 1,5)
            Assert.False(Regex.IsMatch(inhalt, @"AutoAwesome|Celebration|LocalCafe|WbSunny|EmojiEvents"), pfad);
            Assert.False(Regex.IsMatch(inhalt, @"borderRadius: ?(2|2\.5|3|3\.5|4|5|8|10|12|16|24|999)[,\s}]") && datei != "theme.ts", pfad);
            Assert.False(Regex.IsMatch(inhalt, @"borderRadius: ?'([7-9]|\d\d+)px'"), pfad);
            // kein Marketington
            Assert.False(Regex.IsMatch(inhalt, @"Guten (Morgen|Tag|Abend)|Alles erledigt|Willkommen zurück"), pfad);
            Assert.False(Regex.IsMatch(inhalt, @"backdropFilter|blur\("), pfad);
        }
        // Thema: Karten, Dialoge, Menüs höchstens 6 px; Tooltip ohne Pfeil; Kopfzeilen ohne Tönung
        var thema = Lesen("src", "theme.ts");
        foreach (Match m in Regex.Matches(thema, @"borderRadius: (\d+)")) Assert.True(int.Parse(m.Groups[1].Value) <= 6, m.Value);
        Assert.DoesNotContain("arrow: true", thema);
        Assert.DoesNotContain("flaechen.band", Regex.Match(thema, @"MuiCardHeader: \{[^\n]*").Value);
        // Statuswort als Text ohne Fläche; Kennzahlen als Text statt Kacheln; Datum als Text; leere Zustände ohne Symbol
        Assert.DoesNotContain("alpha(", bausteine);
        Assert.DoesNotContain("<Paper", bausteine);
        Assert.Contains("export function Kennzahlen", bausteine);
        Assert.DoesNotContain("symbol", Regex.Match(seite, @"export function Leer[^\n]*").Value);
        Assert.DoesNotContain("flaechen.band", Regex.Match(seite, @"export function Abschnitt[\s\S]*?\n}").Value);
        // Übersicht: Seitentitel statt Begrüßung, keine Kennzahl-Kacheln, keine Symbole in den Kartenköpfen
        var start = Lesen("src", "pages", "Uebersicht.tsx");
        Assert.Contains("<Typography variant=\"h1\">Start</Typography>", start);
        Assert.DoesNotContain("aria-label=\"Kennzahlen\"", start);
        Assert.DoesNotContain("symbol=", start);
        // Stunde: Stand der Dokumentation als Text, Anwesend neutral, Löschsymbole erst beim Überfahren rot
        Assert.DoesNotContain("CheckCircle", Lesen("src", "components", "plan", "Stundendetails.tsx"));
        Assert.Contains("v === 'da' ? { bgcolor: 'action.selected', color: 'text.primary' }", Lesen("src", "components", "klassenbuch", "stunde", "ReiterAnwesenheit.tsx"));
        Assert.Contains("colorError:", thema);
    }
}
