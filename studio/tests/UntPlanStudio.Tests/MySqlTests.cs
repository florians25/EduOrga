using System.Net;
using System.Net.Http.Json;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;
using MySqlConnector;
using UntPlan.Core;
using UntPlanStudio.Dienste;
using UntPlanStudio.Grundlagen;

namespace UntPlanStudio.Tests;

/// <summary>
/// MySQL/MariaDB für das Studio. Die Tests mit Server laufen nur, wenn <c>STUDIO_TEST_MYSQL</c> (oder <c>UNTPLANWEB_TEST_MYSQL</c>)
/// eine Verbindung mit dem Recht zum Anlegen von Datenbanken nennt, z. B. <c>Server=127.0.0.1;Port=3306;User ID=root;Password=…</c>;
/// sonst werden sie übersprungen. Jeder Test legt eine eigene Datenbank an (das Studio legt sie selbst an) und löscht sie danach.
/// </summary>
public static class MySqlTestzusatz
{
    public static string? Admin =>
        Environment.GetEnvironmentVariable("STUDIO_TEST_MYSQL") is { Length: > 0 } v ? v
        : Environment.GetEnvironmentVariable("UNTPLANWEB_TEST_MYSQL") is { Length: > 0 } w ? w : null;

    public static string NeueDatenbank(out string name)
    {
        name = "studio_test_" + Guid.NewGuid().ToString("N")[..12];
        return new MySqlConnectionStringBuilder(Admin!) { Database = name }.ConnectionString;
    }

    public static void Loeschen(string name)
    {
        MySqlConnection.ClearAllPools();
        using var c = new MySqlConnection(Admin);
        c.Open();
        using var cmd = c.CreateCommand();
        cmd.CommandText = $"DROP DATABASE IF EXISTS `{name}`";
        cmd.ExecuteNonQuery();
    }
}

/// <summary>Test nur mit verfügbarer MySQL/MariaDB (STUDIO_TEST_MYSQL), sonst übersprungen.</summary>
public sealed class StudioMySqlFactAttribute : FactAttribute
{
    public StudioMySqlFactAttribute()
    {
        if (MySqlTestzusatz.Admin is null) Skip = "Keine MySQL/MariaDB konfiguriert (STUDIO_TEST_MYSQL).";
    }
}

public sealed class MySqlTests
{
    [Fact]
    public void KonfigurationUndVerbindungstext()
    {
        Assert.Equal(StudioDatenbankart.Sqlite, StudioKonfiguration.Datenbankart(null));
        Assert.Equal(StudioDatenbankart.MySql, StudioKonfiguration.Datenbankart("MariaDB"));
        Assert.Equal(StudioDatenbankart.MySql, StudioKonfiguration.Datenbankart("mysql"));
        Assert.Throws<InvalidOperationException>(() => StudioKonfiguration.Datenbankart("oracle"));
        var b = new MySqlConnectionStringBuilder(MySqlAnbieter.Verbindungstext("mysql://untplanweb:geheim%21@untplannext-mariadb:3307/eduorga_studio"));
        Assert.Equal("untplannext-mariadb", b.Server);
        Assert.Equal(3307u, b.Port);
        Assert.Equal("eduorga_studio", b.Database);
        Assert.Equal("geheim!", b.Password);
        Assert.Equal("utf8mb4", b.CharacterSet);
        var a = new MySqlAnbieter("Server=db;Database=eduorga_studio;User ID=x;Password=y");
        Assert.Equal("mysql://db:3306/eduorga_studio", a.Beschreibung);
        Assert.Throws<InvalidOperationException>(() => new MySqlAnbieter("Server=db;User ID=x"));
        Assert.Throws<InvalidOperationException>(() => Datenbankanbieter.Erstellen(new StudioKonfiguration { Datenordner = Path.GetTempPath(), Datenbank = StudioDatenbankart.MySql }));
        // gleiche Anzahl Migrationen für beide Datenbanken
        Assert.Equal(StudioDatenbank.SchemaVersion, new SqliteAnbieter(Path.Combine(Path.GetTempPath(), "x.db")).Migrationen.Count);
        Assert.Equal(StudioDatenbank.SchemaVersion, a.Migrationen.Count);
    }

    [StudioMySqlFact]
    public async Task StudioLaeuftMitMariaDb_SpeichertSofortUndUebersteht_Neustart()
    {
        var verbindung = MySqlTestzusatz.NeueDatenbank(out var name);
        var ordner = Path.Combine(Path.GetTempPath(), "untplanstudio-mysql-" + Guid.NewGuid().ToString("N"));
        var einstellungen = new Dictionary<string, string?> { ["STUDIO_DB"] = "mysql", ["STUDIO_DB_CONNECTION"] = verbindung, ["STUDIO_SPEICHERN_VERZOEGERUNG_MS"] = "200" };
        try
        {
            string id;
            using (var f = new StudioFabrik { Datenordner = ordner, OrdnerLoeschen = false, Einstellungen = einstellungen })
            {
                var c = await f.AngemeldetAsync();
                var db = f.Services.GetRequiredService<StudioDatenbank>();
                Assert.Equal(StudioDatenbankart.MySql, db.Art);
                Assert.True(db.Erreichbar());
                Assert.False(File.Exists(Path.Combine(ordner, "studio.db")));
                id = await c.BeispielHochladenAsync();
                await (await c.PutAsJsonAsync($"/api/dokumente/{id}/schule/schuldaten", new { schulname = "MariaDB-Schule" })).JsonAsync();
                for (var i = 0; i < 100 && Dokument.Laden(db.DokumentInhalt(id)!).Daten.Einstellungen.Schulname != "MariaDB-Schule"; i++) await Task.Delay(50);
                Assert.Equal("MariaDB-Schule", Dokument.Laden(db.DokumentInhalt(id)!).Daten.Einstellungen.Schulname);
                await c.PostJsonAsync($"/api/dokumente/{id}/sicherungspunkt");
                Assert.Contains(db.DokumentSicherungen(id), s => s.Art == Fassungsarten.Sicherungspunkt);
                await c.PostJsonAsync("/api/benutzer", new { name = "planer", anzeigename = "Planer", rolle = Rollen.Planer, passwort = "planer-pw" });
                db.AblageSchreiben("test", "b", "1");
                db.AblageSchreiben("test", "a", "2");
                db.AblageSchreiben("test", "b", "3");
                Assert.Equal(new[] { "b", "a" }, db.AblageSchluessel("test"));
                Assert.Equal("3", db.AblageLesen("test", "b"));
                // Sicherung übernimmt der Datenbankserver (update.sh)
                Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/sicherungen", new { })).StatusCode);
                Assert.Equal("ok", (await c.GetJsonAsync("/gesundheit"))["datenbank"]!.GetValue<string>());
            }
            MySqlConnection.ClearAllPools();
            using (var f = new StudioFabrik { Datenordner = ordner, OrdnerLoeschen = false, Einstellungen = einstellungen })
            {
                var c = await f.AngemeldetAsync("planer", "planer-pw");
                Assert.Equal("MariaDB-Schule", (await c.GetJsonAsync($"/api/dokumente/{id}"))["schulname"]!.GetValue<string>());
                await c.DeleteAsync($"/api/dokumente/{id}");
                Assert.Empty(f.Services.GetRequiredService<StudioDatenbank>().DokumentSicherungen(id));
            }
        }
        finally
        {
            MySqlTestzusatz.Loeschen(name);
            try { Directory.Delete(ordner, true); } catch (IOException) { }
        }
    }

    [StudioMySqlFact]
    public async Task VorhandeneSqliteDatenbankWirdBeimUmstellenUebernommen()
    {
        var verbindung = MySqlTestzusatz.NeueDatenbank(out var name);
        var ordner = Path.Combine(Path.GetTempPath(), "untplanstudio-umstellen-" + Guid.NewGuid().ToString("N"));
        try
        {
            string id;
            using (var f = new StudioFabrik { Datenordner = ordner, OrdnerLoeschen = false })
            {
                var c = await f.AngemeldetAsync();
                id = await c.BeispielHochladenAsync();
                await c.PostJsonAsync($"/api/dokumente/{id}/sicherungspunkt");
                await (await c.PutAsJsonAsync("/api/einstellungen/test.wert", new { a = 7 })).JsonAsync();
            }
            SqliteConnection.ClearAllPools();
            using (var f = new StudioFabrik { Datenordner = ordner, OrdnerLoeschen = false, Einstellungen = new() { ["STUDIO_DB"] = "mariadb", ["STUDIO_DB_CONNECTION"] = verbindung } })
            {
                var c = await f.AngemeldetAsync();
                var db = f.Services.GetRequiredService<StudioDatenbank>();
                Assert.Equal(StudioDatenbankart.MySql, db.Art);
                Assert.Contains((await c.GetJsonAsync("/api/dokumente"))["dokumente"]!.AsArray(), d => d!["id"]!.GetValue<string>() == id);
                Assert.Equal(7, (await c.GetJsonAsync("/api/einstellungen/test.wert"))["wert"]!["a"]!.GetValue<int>());
                Assert.Contains(db.DokumentSicherungen(id), s => s.Art == Fassungsarten.Sicherungspunkt);
                Assert.NotNull(db.DokumentInhalt(id));
            }
            Assert.True(File.Exists(Path.Combine(ordner, "studio.db"))); // bleibt liegen
        }
        finally
        {
            MySqlTestzusatz.Loeschen(name);
            SqliteConnection.ClearAllPools();
            try { Directory.Delete(ordner, true); } catch (IOException) { }
        }
    }
}
