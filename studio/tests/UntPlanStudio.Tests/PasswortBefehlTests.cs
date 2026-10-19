using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.Configuration;

namespace UntPlanStudio.Tests;

/// <summary><c>dotnet UntPlanStudio.dll --passwort-setzen &lt;benutzer&gt;</c> gegen den Datenordner eines laufenden Servers.</summary>
public sealed class PasswortBefehlTests : IDisposable
{
    private readonly StudioFabrik _f = new();

    public void Dispose() => _f.Dispose();

    private (int Ergebnis, string Aus, string Fehler) Ausfuehren(string eingabe, params string[] args) => AusfuehrenIn(_f.Datenordner, eingabe, args);

    private static (int Ergebnis, string Aus, string Fehler) AusfuehrenIn(string ordner, string eingabe, params string[] args)
    {
        var konfig = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["STUDIO_DATEN"] = ordner }).Build();
        var aus = new StringWriter();
        var fehler = new StringWriter();
        var erg = Program.PasswortSetzen(args, konfig, ordner, new StringReader(eingabe), aus, fehler);
        return (erg, aus.ToString(), fehler.ToString());
    }

    private async Task<HttpStatusCode> AnmeldenAsync(string benutzer, string passwort) =>
        (await _f.Client().PostAsJsonAsync("/api/anmeldung", new { benutzer, passwort })).StatusCode;

    [Fact]
    public async Task SetztPasswortUndDerLaufendeServerSiehtEs()
    {
        await _f.AngemeldetAsync(); // Server läuft, Benutzer sind geladen
        var (erg, aus, fehler) = Ausfuehren("neues-passwort\n", "--passwort-setzen", "admin");
        Assert.True(erg == 0, fehler);
        Assert.Contains("Passwort für „admin“", aus);
        Assert.Equal(HttpStatusCode.OK, await AnmeldenAsync("admin", "neues-passwort"));
        Assert.Equal(HttpStatusCode.Unauthorized, await AnmeldenAsync("admin", StudioFabrik.AdminPasswort));
    }

    [Fact]
    public async Task PrueftPasswortUndUnbekannteBenutzer()
    {
        var c = await _f.AngemeldetAsync();
        var (erg, _, fehler) = Ausfuehren("kurz\n", "--passwort-setzen", "admin");
        Assert.Equal(1, erg);
        Assert.Contains("mindestens 8 Zeichen", fehler);
        (erg, _, fehler) = Ausfuehren("", "--passwort-setzen", "admin");
        Assert.Equal(1, erg);
        Assert.Contains("Kein Passwort", fehler);
        Assert.Equal(HttpStatusCode.OK, await AnmeldenAsync("admin", StudioFabrik.AdminPasswort));

        // unbekannter Benutzer: Fehler mit Liste der Administratoren; mit --anlegen als Administrator angelegt
        (erg, _, fehler) = Ausfuehren("chefin-passwort\n", "--passwort-setzen", "chefin");
        Assert.Equal(1, erg);
        Assert.Contains("Vorhandene Administratoren: admin", fehler);
        (erg, _, fehler) = Ausfuehren("chefin-passwort\n", "--passwort-setzen", "chefin", "--anlegen");
        Assert.True(erg == 0, fehler);
        // der laufende Server kennt den neuen Benutzer (Liste und Anmeldung)
        var liste = await c.GetJsonAsync("/api/benutzer");
        Assert.Contains(liste.AsArray(), b => b!["name"]!.GetValue<string>() == "chefin" && b["rolle"]!.GetValue<string>() == "Admin");
        Assert.Equal(HttpStatusCode.OK, await AnmeldenAsync("chefin", "chefin-passwort"));

        (erg, _, fehler) = Ausfuehren("x\n", "--passwort-setzen");
        Assert.Equal(1, erg);
        Assert.Contains("Aufruf", fehler);
    }

    [Fact]
    public void OhneDatenbankFehler()
    {
        var ordner = Path.Combine(Path.GetTempPath(), "untplanstudio-test-" + Guid.NewGuid().ToString("N"));
        try
        {
            var (erg, _, fehler) = AusfuehrenIn(ordner, "langes-passwort\n", "--passwort-setzen", "admin");
            Assert.Equal(1, erg);
            Assert.Contains("Keine Datenbank", fehler);
            Assert.False(File.Exists(Path.Combine(ordner, "studio.db")));
        }
        finally { try { Directory.Delete(ordner, true); } catch (IOException) { } }
    }
}
