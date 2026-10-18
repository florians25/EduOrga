using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.Configuration;
using UntPlanWeb.Daten;
using UntPlanWeb.Dienste;

namespace UntPlanWeb.Tests;

/// <summary><c>dotnet UntPlanWeb.dll --passwort-setzen &lt;login&gt;</c> gegen die Datenbank eines laufenden Servers (SQLite).</summary>
public class PasswortbefehlTests
{
    private static (int Ergebnis, string Aus, string Fehler) Ausfuehren(string ordner, string eingabe, params string[] args)
    {
        var konfig = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["UNTPLANWEB_DATEN"] = ordner }).Build();
        var aus = new StringWriter();
        var fehler = new StringWriter();
        var erg = Passwortbefehl.Befehl(args, konfig, new StringReader(eingabe), aus, fehler);
        return (erg, aus.ToString(), fehler.ToString());
    }

    private static async Task<HttpStatusCode> AnmeldenAsync(Testserver s, string login, string passwort) =>
        (await s.Client().PostAsJsonAsync("/api/app/anmelden", new { login, passwort })).StatusCode;

    [Fact]
    public async Task Setzt_Passwort_hebt_Sperre_auf_und_der_laufende_Server_sieht_es()
    {
        Testzusatz.OhneMySql();
        await using var s = await Testserver.StartenAsync(mitPaket: false);
        var bd = s.Dienst<Benutzerdienst>();
        // fünf Fehlversuche: vorübergehend gesperrt; zusätzlich Pflicht zur Änderung gesetzt
        for (var i = 0; i < Benutzerdienst.MaxFehlversuche; i++) await AnmeldenAsync(s, "admin", "falsch-falsch");
        Assert.NotEqual(HttpStatusCode.OK, await AnmeldenAsync(s, "admin", Testserver.AdminPasswort));
        bd.PasswortAendernErzwingen(bd.NachLogin("admin")!.Id);

        var (erg, aus, fehler) = Ausfuehren(s.Datenordner, "neues-passwort-1\n", "--passwort-setzen", "admin");
        Assert.True(erg == 0, fehler);
        Assert.Contains("Passwort für „admin“", aus);

        Assert.Equal(HttpStatusCode.OK, await AnmeldenAsync(s, "admin", "neues-passwort-1"));
        Assert.NotEqual(HttpStatusCode.OK, await AnmeldenAsync(s, "admin", Testserver.AdminPasswort));
        Assert.False(bd.NachLogin("admin")!.PasswortAendern);

        // mit --aenderungspflicht muss das Passwort bei der nächsten Anmeldung geändert werden; gesperrte Konten werden entsperrt
        bd.Sperren(bd.NachLogin("admin")!.Id, true);
        (erg, aus, fehler) = Ausfuehren(s.Datenordner, "neues-passwort-2\n", "--passwort-setzen", "admin", "--aenderungspflicht");
        Assert.True(erg == 0, fehler);
        Assert.Contains("entsperrt", aus);
        var admin = bd.NachLogin("admin")!;
        Assert.True(admin.PasswortAendern);
        Assert.False(admin.Gesperrt);
        Assert.Equal(HttpStatusCode.OK, await AnmeldenAsync(s, "admin", "neues-passwort-2"));
    }

    [Fact]
    public async Task Prueft_Richtlinie_und_unbekannte_Konten()
    {
        Testzusatz.OhneMySql();
        await using var s = await Testserver.StartenAsync(mitPaket: false);
        var bd = s.Dienst<Benutzerdienst>();

        var (erg, _, fehler) = Ausfuehren(s.Datenordner, "kurz\n", "--passwort-setzen", "admin");
        Assert.Equal(1, erg);
        Assert.Contains("mindestens 8 Zeichen", fehler);
        Assert.Equal(HttpStatusCode.OK, await AnmeldenAsync(s, "admin", Testserver.AdminPasswort));

        // Richtlinie (Administration → Rechte und Rollen) gilt auch hier
        s.Dienst<Einstellungen>().Schreiben("einstellung:passwort", """{"minLaenge":12,"ziffern":true}""");
        (erg, _, fehler) = Ausfuehren(s.Datenordner, "zehnzeichen\n", "--passwort-setzen", "admin");
        Assert.Equal(1, erg);
        Assert.Contains("mindestens 12 Zeichen", fehler);

        (erg, _, fehler) = Ausfuehren(s.Datenordner, "", "--passwort-setzen", "admin");
        Assert.Equal(1, erg);
        Assert.Contains("Kein Passwort", fehler);

        // unbekanntes Konto: Fehler mit Liste der Administratoren; mit --anlegen als Administrator angelegt
        (erg, _, fehler) = Ausfuehren(s.Datenordner, "langes-passwort-123\n", "--passwort-setzen", "chefin");
        Assert.Equal(1, erg);
        Assert.Contains("Vorhandene Administratoren: admin", fehler);
        Assert.Null(bd.NachLogin("chefin"));
        (erg, _, fehler) = Ausfuehren(s.Datenordner, "langes-passwort-123\n", "--passwort-setzen", "chefin", "--anlegen");
        Assert.True(erg == 0, fehler);
        Assert.True(bd.NachLogin("chefin")!.IstAdmin);
        Assert.Equal(HttpStatusCode.OK, await AnmeldenAsync(s, "chefin", "langes-passwort-123"));

        (erg, _, fehler) = Ausfuehren(s.Datenordner, "x\n", "--passwort-setzen");
        Assert.Equal(1, erg);
        Assert.Contains("Aufruf", fehler);
    }

    [Fact]
    public void Ohne_Datenbank_Fehler()
    {
        var ordner = Path.Combine(Path.GetTempPath(), "untplanweb-test-" + Guid.NewGuid().ToString("N"));
        var (erg, _, fehler) = Ausfuehren(ordner, "langes-passwort\n", "--passwort-setzen", "admin");
        Assert.Equal(1, erg);
        Assert.Contains("Keine Datenbank", fehler);
        Assert.False(File.Exists(Path.Combine(ordner, "untplanweb.db")));
    }
}
