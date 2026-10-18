using System.Diagnostics;
using System.Text.RegularExpressions;
using Xunit.Abstractions;

namespace UntPlanStudio.Tests;

/// <summary>
/// Prüfungen der Oberfläche ohne Browser: Quelle in studio/client (React + TypeScript + Fluent UI), Build-Ausgabe in
/// src/UntPlanStudio/wwwroot (entsteht beim Bauen des Studios bzw. mit „npm run build“). Geprüft werden Modulregister,
/// Verweise der Startseite (keine externen Quellen) und – wenn Node.js und die Pakete vorhanden sind – die Typprüfung.
/// </summary>
public sealed partial class OberflaecheTests
{
    private readonly ITestOutputHelper _aus;

    public OberflaecheTests(ITestOutputHelper aus) => _aus = aus;

    /// <summary>Ordner studio/ (enthält src/UntPlanStudio und client).</summary>
    private static string Studio()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null && !File.Exists(Path.Combine(dir.FullName, "src", "UntPlanStudio", "UntPlanStudio.csproj"))) dir = dir.Parent;
        Assert.NotNull(dir);
        return dir!.FullName;
    }

    private static string Client() => Path.Combine(Studio(), "client");
    private static string Wwwroot() => Path.Combine(Studio(), "src", "UntPlanStudio", "wwwroot");
    private static string Moduleordner() => Path.Combine(Client(), "src", "module");

    private static string? NodePfad()
    {
        foreach (var verz in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator).Append("/opt/node22/bin"))
        {
            var p = Path.Combine(verz, OperatingSystem.IsWindows() ? "node.exe" : "node");
            if (File.Exists(p)) return p;
        }
        return null;
    }

    [Fact]
    public void ViteBautInDasWwwrootDesStudios()
    {
        var konfig = File.ReadAllText(Path.Combine(Client(), "vite.config.ts"));
        Assert.Contains("../src/UntPlanStudio/wwwroot", konfig);
        var paket = File.ReadAllText(Path.Combine(Client(), "package.json"));
        Assert.Contains("\"build\"", paket);
        Assert.Contains("tsc --noEmit", paket);
        // strenge Typprüfung
        Assert.Matches(@"""strict""\s*:\s*true", File.ReadAllText(Path.Combine(Client(), "tsconfig.json")));
    }

    [GeneratedRegex(@"^import\s+(\w+)\s+from\s+'\./([\w-]+)';", RegexOptions.Multiline)]
    private static partial Regex RegisterImport();

    [Fact]
    public void JedesModulIstImRegisterEingetragenUndHatSeineId()
    {
        var register = File.ReadAllText(Path.Combine(Moduleordner(), "register.ts"));
        var importe = RegisterImport().Matches(register).ToDictionary(m => m.Groups[2].Value, m => m.Groups[1].Value);
        var liste = Regex.Match(register, @"export const module: StudioModul\[\] = \[(?<l>[^\]]*)\]").Groups["l"].Value;
        foreach (var ordner in Directory.EnumerateDirectories(Moduleordner()))
        {
            var name = Path.GetFileName(ordner);
            var index = Path.Combine(ordner, "index.ts");
            Assert.True(File.Exists(index), $"Modul {name}: index.ts fehlt.");
            Assert.True(importe.TryGetValue(name, out var bezeichner), $"Modul {name} ist nicht in module/register.ts importiert.");
            Assert.Matches($@"\b{bezeichner}\b", liste);
            Assert.Contains($"id: '{name}'", File.ReadAllText(index));
        }
        // keine Einträge im Register ohne Ordner
        foreach (var name in importe.Keys) Assert.True(Directory.Exists(Path.Combine(Moduleordner(), name)), $"register.ts importiert ./{name}, der Ordner fehlt.");
    }

    [Fact]
    public void AnsichtenSindLazyGeladenUndPfadeEindeutig()
    {
        var pfade = new Dictionary<string, string>();
        foreach (var index in Directory.EnumerateFiles(Moduleordner(), "index.ts", SearchOption.AllDirectories))
        {
            var text = File.ReadAllText(index);
            foreach (Match m in Regex.Matches(text, @"pfad:\s*'([^']+)'"))
            {
                var pfad = m.Groups[1].Value;
                Assert.False(pfade.TryGetValue(pfad, out var anderes), $"Der Seitenpfad /{pfad} ist doppelt vergeben ({anderes} und {index}).");
                pfade[pfad] = index;
            }
        }
        Assert.True(pfade.Count > 40, $"Nur {pfade.Count} Seiten gefunden.");
    }

    [Fact]
    public void QuellStartseiteBindetKeineExternenQuellenEin()
    {
        var html = File.ReadAllText(Path.Combine(Client(), "index.html"));
        Assert.DoesNotMatch(@"(?:href|src)=""https?://", html);
        Assert.Contains("lang=\"de\"", html);
    }

    [Fact]
    public void IndexHtmlBindetNurVorhandeneDateienEin()
    {
        var datei = Path.Combine(Wwwroot(), "index.html");
        // wird beim Bauen des Studios erzeugt (UntPlanStudio.csproj, Ziel StudioOberflaecheBauen)
        Assert.True(File.Exists(datei), "wwwroot/index.html fehlt – die Oberfläche wurde nicht gebaut (studio/client: npm run build).");
        var html = File.ReadAllText(datei);
        foreach (Match m in Regex.Matches(html, @"(?:href|src)=""/?([^""#:]+)"""))
            Assert.True(File.Exists(Path.Combine(Wwwroot(), m.Groups[1].Value)), $"index.html verweist auf fehlende Datei {m.Groups[1].Value}");
        // keine externen Quellen (kein CDN), Schriften liegen bei
        Assert.DoesNotMatch(@"(?:href|src)=""https?://", html);
        Assert.NotEmpty(Directory.EnumerateFiles(Path.Combine(Wwwroot(), "fonts"), "*.woff2"));
    }

    [Fact]
    public void TypescriptTyppruefungOhneFehler()
    {
        var node = NodePfad();
        var tsc = Path.Combine(Client(), "node_modules", "typescript", "bin", "tsc");
        if (node is null || !File.Exists(tsc))
        {
            _aus.WriteLine("Node.js oder die Pakete (npm ci) fehlen – Typprüfung übersprungen.");
            return;
        }
        var psi = new ProcessStartInfo(node) { RedirectStandardError = true, RedirectStandardOutput = true, UseShellExecute = false, WorkingDirectory = Client() };
        psi.ArgumentList.Add(tsc);
        psi.ArgumentList.Add("--noEmit");
        using var p = Process.Start(psi)!;
        var aus = p.StandardOutput.ReadToEndAsync();
        var err = p.StandardError.ReadToEnd();
        p.WaitForExit();
        Assert.True(p.ExitCode == 0, $"tsc --noEmit meldet Fehler:\n{aus.Result}{err}");
    }
}
