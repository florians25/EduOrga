using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using UntPlan.Core;
using UntPlanStudio.Dienste;
using UntPlanStudio.Grundlagen;

namespace UntPlanStudio.Tests;

/// <summary>Eigene Datenbank des Studios (studio.db): Schema, Ablage, Dokumente, Übernahme alter Dateien, Sicherung.</summary>
public sealed class DatenbankTests : IDisposable
{
    private readonly string _ordner = Path.Combine(Path.GetTempPath(), "untplanstudio-db-" + Guid.NewGuid().ToString("N"));

    public void Dispose()
    {
        SqliteConnection.ClearAllPools();
        try { Directory.Delete(_ordner, true); } catch (IOException) { } catch (UnauthorizedAccessException) { }
    }

    private StudioKonfiguration Konfiguration(int behalten = 14) => new() { Datenordner = _ordner, SicherungenBehalten = behalten };

    private StudioDatenbank Datenbank(int behalten = 14)
    {
        Directory.CreateDirectory(_ordner);
        return new StudioDatenbank(Konfiguration(behalten), NullLogger<StudioDatenbank>.Instance);
    }

    private static object? Abfrage(string pfad, string sql)
    {
        using var c = new SqliteConnection($"Data Source={pfad};Mode=ReadOnly;Pooling=False");
        c.Open();
        using var cmd = c.CreateCommand();
        cmd.CommandText = sql;
        return cmd.ExecuteScalar();
    }

    [Fact]
    public void SchemaWalUndAblage()
    {
        var db = Datenbank();
        Assert.True(File.Exists(Path.Combine(_ordner, "studio.db")));
        Assert.Equal((long)StudioDatenbank.SchemaVersion, Abfrage(db.Pfad, "PRAGMA user_version"));
        Assert.Equal("wal", Abfrage(db.Pfad, "PRAGMA journal_mode"));
        Assert.True(db.IstLeer);
        Assert.True(db.Erreichbar());

        db.AblageSchreiben("test", "b", "{\"x\":2}");
        db.AblageSchreiben("test", "a", "{\"x\":1}");
        db.AblageSchreiben("test", "b", "{\"x\":3}");
        Assert.Equal("{\"x\":3}", db.AblageLesen("test", "b"));
        Assert.Equal(new[] { "b", "a" }, db.AblageSchluessel("test")); // Reihenfolge des Anlegens bleibt
        db.AblageLoeschen("test", "b");
        Assert.Null(db.AblageLesen("test", "b"));
        Assert.False(db.IstLeer);

        // zweiter Start: keine erneute Migration, Daten bleiben
        var wieder = Datenbank();
        Assert.Equal("{\"x\":1}", wieder.AblageLesen("test", "a"));
    }

    [Fact]
    public async Task ParalleleSchreibvorgaengeSindSicher()
    {
        var db = Datenbank();
        await Task.WhenAll(Enumerable.Range(0, 8).Select(i => Task.Run(() =>
        {
            for (var j = 0; j < 25; j++) db.AblageSchreiben("parallel", $"{i}-{j}", "{}");
        })));
        Assert.Equal(200, db.AblageSchluessel("parallel").Count);
    }

    [Fact]
    public void DokumentSpeichernBehaeltZehnSicherungen()
    {
        var db = Datenbank();
        var info = new DokumentInfo { Id = "0123456789abcdef", Name = "Test", Besitzer = "admin", Herkunft = "neu" };
        var doc = new Dokument(Demo.NeueDatei("Testschule", "GY"));
        db.DokumentAnlegen(info, doc.Inhalt());
        Assert.True(db.DokumentExistiert(info.Id));
        for (var i = 0; i < 14; i++)
        {
            doc.Aendern("x", AenderungsArt.Einstellungen, d => d.Einstellungen.Schulname = "Schule " + i);
            doc.Speichern(inhalt => Assert.True(db.DokumentSpeichern(info, inhalt)));
        }
        // unveränderter Inhalt erzeugt keinen weiteren Sicherungsstand
        Assert.True(db.DokumentSpeichern(info, doc.Inhalt()));
        var sicherungen = db.DokumentSicherungen(info.Id);
        Assert.Equal(StudioDatenbank.DokumentSicherungenBehalten, sicherungen.Count);
        Assert.Equal("Schule 12", Dokument.Laden(db.DokumentSicherungInhalt(sicherungen[0].Nr)!).Daten.Einstellungen.Schulname);
        Assert.Equal("Schule 13", Dokument.Laden(db.DokumentInhalt(info.Id)!).Daten.Einstellungen.Schulname);

        info.Name = "Umbenannt";
        Assert.True(db.DokumentSpeichern(info, null));
        var zeile = Assert.Single(db.Dokumente());
        Assert.Equal("Umbenannt", zeile.Info.Name);
        Assert.Equal(db.DokumentInhalt(info.Id)!.LongLength, zeile.Groesse);

        db.DokumentLoeschen(info.Id);
        Assert.False(db.DokumentExistiert(info.Id));
        Assert.Empty(db.DokumentSicherungen(info.Id));
        Assert.False(db.DokumentSpeichern(info, doc.Inhalt()));
    }

    [Fact]
    public void SicherungIstKonsistentUndAlteWerdenAufgeraeumt()
    {
        var db = Datenbank(behalten: 3);
        db.AblageSchreiben("test", "a", "{\"x\":1}");
        var erste = db.Sichern();
        Assert.Matches(@"^studio-\d{8}-\d{6}(-\d+)?\.db$", erste.Datei);
        Assert.Equal(Path.Combine(_ordner, "sicherungen"), Path.GetDirectoryName(erste.Pfad));
        Assert.Equal("{\"x\":1}", Abfrage(erste.Pfad, "SELECT inhalt FROM ablage WHERE bereich = 'test' AND schluessel = 'a'"));
        for (var i = 0; i < 4; i++) db.Sichern();
        Assert.Equal(3, Directory.GetFiles(db.Sicherungsordner, "studio-*.db").Length);
        Assert.Empty(Directory.GetFiles(db.Sicherungsordner, "*.tmp"));
        Assert.DoesNotContain(db.Sicherungen(), s => s.Datei == erste.Datei);

        // Kommandozeile (--sichern) verwendet dieselbe Methode, ohne die Datenbank anzulegen
        Assert.Throws<FileNotFoundException>(() => StudioDatenbank.Sichern(Path.Combine(_ordner, "gibt-es-nicht.db"), db.Sicherungsordner, 3));
        Assert.False(File.Exists(Path.Combine(_ordner, "gibt-es-nicht.db")));
    }

    [Fact]
    public void TaeglicheSicherungUndSicherungVorUpdate()
    {
        var db = Datenbank();
        var dienst = new Sicherungsdienst(db, NullLogger<Sicherungsdienst>.Instance);
        Assert.NotNull(dienst.FaelligeSicherung());
        Assert.Null(dienst.FaelligeSicherung()); // heute schon gesichert
        Assert.Single(db.Sicherungen());

        // gleiche Programmversion: keine Sicherung beim Start
        Datenbank();
        Assert.Single(db.Sicherungen());

        // andere Programmversion (Update): beim Start wird vorher gesichert
        db.Schreiben((c, t) =>
        {
            using var cmd = c.CreateCommand();
            cmd.Transaction = t;
            cmd.CommandText = "UPDATE meta SET wert = '0.0.1' WHERE schluessel = 'anwendungsversion'";
            Assert.Equal(1, cmd.ExecuteNonQuery());
        });
        Datenbank();
        Assert.Equal(2, db.Sicherungen().Count);
    }

    [Fact]
    public async Task GesundheitPrueftDieDatenbank()
    {
        using var f = new StudioFabrik();
        var r = await f.Client().GetFromJsonAsync<JsonObject>("/gesundheit");
        Assert.Equal("ok", r!["status"]!.GetValue<string>());
        Assert.Equal("ok", r["datenbank"]!.GetValue<string>());
    }

    [Fact]
    public async Task SicherungUeberDieApiNurFuerAdministratoren()
    {
        using var f = new StudioFabrik();
        var admin = await f.AngemeldetAsync();
        await admin.PostJsonAsync("/api/benutzer", new { name = "leser", anzeigename = "Leser", rolle = Rollen.Leser, passwort = "leser-pw" });
        var s = await admin.PostJsonAsync("/api/sicherungen");
        var datei = s["datei"]!.GetValue<string>();
        Assert.True(File.Exists(Path.Combine(f.Datenordner, "sicherungen", datei)));
        Assert.Contains((await admin.GetJsonAsync("/api/sicherungen")).AsArray(), x => x!["datei"]!.GetValue<string>() == datei);

        var leser = await f.AngemeldetAsync("leser", "leser-pw");
        Assert.Equal(HttpStatusCode.Forbidden, (await leser.GetAsync("/api/sicherungen")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await leser.PostAsJsonAsync("/api/sicherungen", new { })).StatusCode);
    }

    [Fact]
    public async Task DatenBleibenNachNeustartErhalten()
    {
        string id;
        var ordner = Path.Combine(_ordner, "neustart");
        using (var f = new StudioFabrik { Datenordner = ordner, OrdnerLoeschen = false })
        {
            var c = await f.AngemeldetAsync();
            id = await c.BeispielHochladenAsync();
            await (await c.PutAsJsonAsync("/api/einstellungen/test.wert", new { a = 1 })).JsonAsync();
            await c.PostJsonAsync("/api/benutzer", new { name = "planer", anzeigename = "Planer", rolle = Rollen.Planer, passwort = "planer-pw" });
        }
        SqliteConnection.ClearAllPools();
        using (var f = new StudioFabrik { Datenordner = ordner, OrdnerLoeschen = false })
        {
            var c = await f.AngemeldetAsync("planer", "planer-pw");
            var liste = await c.GetJsonAsync("/api/dokumente");
            Assert.Contains(liste["dokumente"]!.AsArray(), d => d!["id"]!.GetValue<string>() == id);
            var admin = await f.AngemeldetAsync();
            Assert.Equal(1, (await admin.GetJsonAsync("/api/einstellungen/test.wert"))["wert"]!["a"]!.GetValue<int>());
            Assert.Empty(Directory.GetDirectories(ordner, "alt-dateien-*"));
        }
    }

    [Fact]
    public async Task AlteDateienWerdenBeimErstenStartUebernommenUndVerschoben()
    {
        // Datenordner einer bisherigen Installation (Ablage in Dateien)
        var ordner = Path.Combine(_ordner, "alt");
        var hasher = new PasswordHasher<string>();
        Directory.CreateDirectory(Path.Combine(ordner, "dokumente"));
        Directory.CreateDirectory(Path.Combine(ordner, "benutzer"));
        Directory.CreateDirectory(Path.Combine(ordner, "untplanweb"));
        Directory.CreateDirectory(Path.Combine(ordner, "schluessel"));
        var benutzer = new[]
        {
            new StudioBenutzer { Name = "chefin", Anzeigename = "Chefin", Rolle = Rollen.Admin, Hash = hasher.HashPassword("chefin", "chefin-pw") },
            new StudioBenutzer { Name = "PlanerIn", Anzeigename = "Planerin", Rolle = Rollen.Planer, Hash = hasher.HashPassword("PlanerIn", "planer-pw") },
        };
        File.WriteAllText(Path.Combine(ordner, "benutzer.json"), JsonSerializer.Serialize(benutzer, new JsonSerializerOptions { WriteIndented = true }));

        const string id = "00112233aabbccdd";
        var schule = Demo.Beispielschule();
        schule.Einstellungen.Schulname = "Altschule";
        var up = Hilfen.AlsUp(schule);
        File.WriteAllBytes(Path.Combine(ordner, "dokumente", id + ".up"), up);
        var vorher = Demo.NeueDatei("Vorige Fassung", "GY");
        File.WriteAllBytes(Path.Combine(ordner, "dokumente", id + ".up.bak"), Hilfen.AlsUp(vorher));
        var info = new DokumentInfo { Id = id, Name = "Plan 2025/26", Besitzer = "chefin", Herkunft = "hochgeladen: alt.up", Erstellt = new DateTime(2025, 8, 1, 9, 0, 0), Geaendert = new DateTime(2025, 9, 1, 10, 30, 0) };
        File.WriteAllText(Path.Combine(ordner, "dokumente", id + ".json"), JsonSerializer.Serialize(info));
        File.WriteAllText(Path.Combine(ordner, "dokumente", "kaputt12kaputt34.up"), "kein json"); // ungültige Id → ignoriert
        File.WriteAllText(Path.Combine(ordner, "benutzer", Uri.EscapeDataString("planerin") + ".json"),
            new JsonObject { ["zuletzt"] = new JsonArray(id), ["vertretung.ansicht"] = "Lehrer" }.ToJsonString());
        File.WriteAllText(Path.Combine(ordner, "untplanweb", id + ".json"), JsonSerializer.Serialize(new UpwAbgleich { Aktiv = false, Minuten = 45, Ergebnis = "alt" }));
        var mu = new MuKonfiguration { Gruppen = MultiUserDienst.StandardGruppen(), SperrTimeoutMinuten = 33 };
        mu.Gruppen[3].Name = "Info alt";
        File.WriteAllText(Path.Combine(ordner, "multiuser.json"), JsonSerializer.Serialize(mu, new JsonSerializerOptions { Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() } }));

        using var f = new StudioFabrik { Datenordner = ordner, OrdnerLoeschen = false };
        // die alte Anmeldung gilt (Admin-Konto aus STUDIO_ADMIN_PASSWORT wird nicht zusätzlich angelegt)
        var c = await f.AngemeldetAsync("planerin", "planer-pw");
        Assert.Equal(HttpStatusCode.Unauthorized, (await f.Client().PostAsJsonAsync("/api/anmeldung", new { benutzer = "admin", passwort = StudioFabrik.AdminPasswort })).StatusCode);

        var liste = await c.GetJsonAsync("/api/dokumente");
        var eintrag = Assert.Single(liste["dokumente"]!.AsArray())!;
        Assert.Equal(id, eintrag["id"]!.GetValue<string>());
        Assert.Equal("Plan 2025/26", eintrag["name"]!.GetValue<string>());
        Assert.Equal("chefin", eintrag["besitzer"]!.GetValue<string>());
        Assert.Equal(up.LongLength, eintrag["groesse"]!.GetValue<long>());
        Assert.Equal(id, liste["zuletzt"]![0]!.GetValue<string>());
        Assert.Equal("Lehrer", (await c.GetJsonAsync("/api/einstellungen/vertretung.ansicht"))["wert"]!.GetValue<string>());
        Assert.Equal("Altschule", (await c.GetJsonAsync($"/api/dokumente/{id}"))["schulname"]!.GetValue<string>());
        var abgleich = await c.GetJsonAsync($"/api/dokumente/{id}/untplanweb/abgleich");
        Assert.Equal(45, abgleich["minuten"]!.GetValue<int>());
        Assert.Equal("alt", abgleich["ergebnis"]!.GetValue<string>());

        // Inhalt unverändert übernommen, .bak als Sicherungsstand
        var db = f.Services.GetRequiredService<StudioDatenbank>();
        Assert.Equal(up, db.DokumentInhalt(id));
        var stand = Assert.Single(db.DokumentSicherungen(id));
        Assert.Equal("Vorige Fassung", Dokument.Laden(db.DokumentSicherungInhalt(stand.Nr)!).Daten.Einstellungen.Schulname);
        var konfig = f.Services.GetRequiredService<MultiUserDienst>().Konfiguration();
        Assert.Equal(33, konfig.SperrTimeoutMinuten);
        Assert.Equal("Info alt", konfig.Gruppen[3].Name);

        var chefin = await f.AngemeldetAsync("chefin", "chefin-pw");
        Assert.Equal(2, (await chefin.GetJsonAsync("/api/benutzer")).AsArray().Count);

        // alte Dateien verschoben (nicht gelöscht), Cookie-Schlüssel bleiben
        var alt = Assert.Single(Directory.GetDirectories(ordner, "alt-dateien-*"));
        Assert.Matches(@"alt-dateien-\d{4}-\d{2}-\d{2}", Path.GetFileName(alt));
        Assert.Equal(alt, db.Altdatenordner);
        foreach (var name in new[] { "benutzer.json", "multiuser.json", "benutzer", "untplanweb", "dokumente" })
        {
            Assert.False(File.Exists(Path.Combine(ordner, name)) || Directory.Exists(Path.Combine(ordner, name)), name + " liegt noch im Datenordner");
            Assert.True(File.Exists(Path.Combine(alt, name)) || Directory.Exists(Path.Combine(alt, name)), name + " fehlt in " + alt);
        }
        Assert.Equal(up, File.ReadAllBytes(Path.Combine(alt, "dokumente", id + ".up")));
        Assert.True(Directory.Exists(Path.Combine(ordner, "schluessel")));

        // Änderungen landen in der Datenbank, nicht in neuen Dateien
        await c.PostJsonAsync($"/api/dokumente/{id}/stammdaten/klasse", new { kurzname = "9z" });
        await c.PostJsonAsync($"/api/dokumente/{id}/speichern");
        Assert.False(Directory.Exists(Path.Combine(ordner, "dokumente")));
        Assert.Equal(2, db.DokumentSicherungen(id).Count);
        Assert.Equal(db.DokumentInhalt(id), await c.GetByteArrayAsync($"/api/dokumente/{id}/herunterladen"));
    }
}
