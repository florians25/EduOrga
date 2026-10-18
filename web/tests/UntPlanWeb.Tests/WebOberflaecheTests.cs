using System.Text.RegularExpressions;
using Xunit;

namespace UntPlanWeb.Tests;

/// <summary>
/// Quelltext der Oberfläche (web/client, React + TypeScript + MUI): Aufbau, Adressen und Gestaltungsregeln.
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
        Assert.Contains("UntPlan Studio", details);          // Hinweis: festgelegt wird es im Studio
        Assert.DoesNotContain("role=\"switch\"", details);
        foreach (var (pfad, inhalt) in Quellen())
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
    public void Ohne_Fremdnamen_ohne_Orange_und_ohne_fette_Schrift()
    {
        var fremd = new string(new[] { 'u', 'n', 't', 'i', 's' });
        foreach (var (pfad, inhalt) in Quellen())
        {
            Assert.False(inhalt.Contains(fremd, StringComparison.OrdinalIgnoreCase), pfad);
            Assert.False(Regex.IsMatch(inhalt, @"font-?weight:\s*['""]?(700|800|900|bold)", RegexOptions.IgnoreCase), pfad);
            Assert.False(Regex.IsMatch(inhalt, @"\borange\b", RegexOptions.IgnoreCase), pfad);
        }
        Assert.Contains("#234f96", Lesen("src", "theme.ts"));
    }
}
