using System.Diagnostics;
using System.IO.Compression;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using UntPlan.Core;
using UntPlan.Core.Model;
using UntPlanStudio.Dienste;
using UntPlanStudio.Grundlagen;
using Xunit.Abstractions;

namespace UntPlanStudio.Tests;

/// <summary>Sofortiges Speichern jeder Änderung (Verzögerung, Zusammenfassen, Rückgängig, Herunterfahren), Fassungen, große Schuldatei.</summary>
public sealed class AutospeichernTests
{
    private readonly ITestOutputHelper _aus;

    public AutospeichernTests(ITestOutputHelper aus) => _aus = aus;

    private static StudioFabrik Fabrik(int verzoegerungMs, string? ordner = null) => new()
    {
        Datenordner = ordner ?? Path.Combine(Path.GetTempPath(), "untplanstudio-auto-" + Guid.NewGuid().ToString("N")),
        OrdnerLoeschen = ordner is null,
        Einstellungen = new() { ["STUDIO_SPEICHERN_VERZOEGERUNG_MS"] = verzoegerungMs.ToString() },
    };

    private static string Schulname(byte[]? inhalt) => Dokument.Laden(inhalt!).Daten.Einstellungen.Schulname;

    private static async Task<T> WartenAufAsync<T>(Func<T> wert, Func<T, bool> bedingung, int ms = 8000)
    {
        var sw = Stopwatch.StartNew();
        while (true)
        {
            var w = wert();
            if (bedingung(w) || sw.ElapsedMilliseconds > ms) return w;
            await Task.Delay(50);
        }
    }

    [Fact]
    public async Task AenderungLandetOhneSpeichernInDerDatenbank_ZusammengefasstUndMitRueckgaengig()
    {
        using var f = Fabrik(400);
        var c = await f.AngemeldetAsync();
        var id = await c.BeispielHochladenAsync();
        var db = f.Services.GetRequiredService<StudioDatenbank>();
        var a = f.Services.GetRequiredService<Dokumentdienst>().Holen(id);
        var vorher = a.Speichervorgaenge;

        // fünf Änderungen schnell hintereinander → ein (höchstens zwei) Schreibvorgänge, ohne „speichern“
        for (var i = 1; i <= 5; i++)
            await (await c.PutAsJsonAsync($"/api/dokumente/{id}/schule/schuldaten", new { schulname = $"Autoschule {i}" })).JsonAsync();
        Assert.True((await c.GetJsonAsync($"/api/dokumente/{id}"))["geaendert"]!.GetValue<bool>() || a.Speichervorgaenge > vorher);
        var inhalt = await WartenAufAsync(() => db.DokumentInhalt(id), x => Schulname(x) == "Autoschule 5");
        Assert.Equal("Autoschule 5", Schulname(inhalt));
        await WartenAufAsync(() => a.IstGeaendert, x => !x);
        Assert.InRange(a.Speichervorgaenge - vorher, 1, 2);
        var stand = await c.GetJsonAsync($"/api/dokumente/{id}");
        Assert.False(stand["geaendert"]!.GetValue<bool>());
        Assert.Null(stand["speicherfehler"]?.GetValue<string>());
        Assert.NotNull(stand["gespeichert"]);

        // Rückgängig/Wiederholen werden ebenso sofort gespeichert
        await c.PostJsonAsync($"/api/dokumente/{id}/rueckgaengig");
        Assert.Equal("Autoschule 4", Schulname(await WartenAufAsync(() => db.DokumentInhalt(id), x => Schulname(x) == "Autoschule 4")));
        await c.PostJsonAsync($"/api/dokumente/{id}/wiederholen");
        Assert.Equal("Autoschule 5", Schulname(await WartenAufAsync(() => db.DokumentInhalt(id), x => Schulname(x) == "Autoschule 5")));

        // automatische Fassungen höchstens alle 10 Minuten: trotz vieler Speichervorgänge nur eine
        var fassungen = db.DokumentSicherungen(id);
        Assert.Single(fassungen);
        Assert.Equal(Fassungsarten.Automatisch, fassungen[0].Art);
        // Strg+S: Sicherungspunkt mit dem aktuellen Stand
        await c.PostJsonAsync($"/api/dokumente/{id}/sicherungspunkt");
        var punkt = db.DokumentSicherungen(id)[0];
        Assert.Equal(Fassungsarten.Sicherungspunkt, punkt.Art);
        Assert.Equal("admin", punkt.Benutzer);
        Assert.Equal("Autoschule 5", Schulname(db.DokumentSicherungInhalt(punkt.Nr)));
        var liste = (await c.GetJsonAsync($"/api/dokumente/{id}/fassungen")).AsArray();
        Assert.Equal(2, liste.Count);
        Assert.Equal("sicherungspunkt", liste[0]!["art"]!.GetValue<string>());
    }

    [Fact]
    public async Task VerzoegerungFasstZusammenUndHerunterfahrenSpeichertAlles()
    {
        var ordner = Path.Combine(Path.GetTempPath(), "untplanstudio-auto-" + Guid.NewGuid().ToString("N"));
        string id;
        try
        {
            // lange Verzögerung: bis zum Beenden wurde noch nicht gespeichert – das Herunterfahren holt es nach
            using (var f = Fabrik(60_000, ordner))
            {
                var c = await f.AngemeldetAsync();
                id = await c.BeispielHochladenAsync();
                await (await c.PutAsJsonAsync($"/api/dokumente/{id}/schule/schuldaten", new { schulname = "Vor dem Beenden" })).JsonAsync();
                var db = f.Services.GetRequiredService<StudioDatenbank>();
                await Task.Delay(300);
                Assert.NotEqual("Vor dem Beenden", Schulname(db.DokumentInhalt(id)));
                Assert.True(f.Services.GetRequiredService<Dokumentdienst>().IstVorgemerkt(id));
            }
            SqliteConnection.ClearAllPools();
            var k = new StudioKonfiguration { Datenordner = ordner };
            var neu = new StudioDatenbank(k, NullLogger<StudioDatenbank>.Instance);
            Assert.Equal("Vor dem Beenden", Schulname(neu.DokumentInhalt(id)));
        }
        finally
        {
            SqliteConnection.ClearAllPools();
            try { Directory.Delete(ordner, true); } catch (IOException) { }
        }
    }

    [Fact]
    public void WiederholabstandWaechstBisEineMinute()
    {
        Assert.Equal(TimeSpan.FromSeconds(2), Dokumentdienst.Wiederholabstand(1));
        Assert.Equal(TimeSpan.FromSeconds(8), Dokumentdienst.Wiederholabstand(3));
        Assert.Equal(TimeSpan.FromSeconds(60), Dokumentdienst.Wiederholabstand(20));
    }

    [Fact]
    public void InhaltWirdKomprimiertGespeichertUndUnveraendertGeliefert()
    {
        var ordner = Path.Combine(Path.GetTempPath(), "untplanstudio-gz-" + Guid.NewGuid().ToString("N"));
        try
        {
            var db = new StudioDatenbank(new StudioKonfiguration { Datenordner = ordner }, NullLogger<StudioDatenbank>.Instance);
            var info = new DokumentInfo { Id = "00aa00aa00aa00aa", Name = "Gz" };
            var up = Hilfen.AlsUp(Demo.Beispielschule());
            db.DokumentAnlegen(info, up);
            Assert.Equal(up, db.DokumentInhalt(info.Id));
            Assert.Equal(up.LongLength, db.Dokument(info.Id)!.Groesse);
            using var c = new SqliteConnection($"Data Source={db.Pfad};Mode=ReadOnly;Pooling=False");
            c.Open();
            using var cmd = c.CreateCommand();
            cmd.CommandText = "SELECT length(inhalt), format FROM dokumente";
            using var r = cmd.ExecuteReader();
            Assert.True(r.Read());
            Assert.Equal(1, r.GetInt32(1));
            Assert.True(r.GetInt64(0) < up.Length / 4, $"komprimiert {r.GetInt64(0)} von {up.Length} Bytes");
        }
        finally
        {
            SqliteConnection.ClearAllPools();
            try { Directory.Delete(ordner, true); } catch (IOException) { }
        }
    }

    /// <summary>Große Schule: 200 Lehrkräfte, 100 Klassen mit 3000 Schülerinnen und Schülern, 4000 Unterrichte, Plan, 3000 Vertretungen.</summary>
    public static Schuldatei GrosseSchule()
    {
        var d = Demo.NeueDatei("Große Gesamtschule", "GE");
        for (var i = 0; i < 200; i++) d.Lehrer.Add(new Lehrer { Id = d.NeueId(), Kurzname = $"L{i:000}", Langname = $"Lehrkraft Nachname {i:000}", Vorname = "Vorname" });
        for (var i = 0; i < 100; i++)
        {
            var raum = new Raum { Id = d.NeueId(), Kurzname = $"R{i:000}", Langname = $"Raum {i:000}" };
            d.Raeume.Add(raum);
            d.Klassen.Add(new Klasse { Id = d.NeueId(), Kurzname = $"{5 + i / 12}{(char)('a' + i % 12)}", Jahrgang = $"{5 + i / 12}", StammraumId = raum.Id });
        }
        foreach (var k in d.Klassen)
            for (var s = 0; s < 30; s++)
                d.Schueler.Add(new Schueler { Id = d.NeueId(), Kurzname = $"S{d.Schueler.Count:0000}", Langname = $"Nachname {d.Schueler.Count:0000}", Vorname = "Vorname", KlasseId = k.Id, Geschlecht = s % 2 == 0 ? "w" : "m" });
        var faecher = d.Faecher.Where(f => !f.Bereitschaft).Take(10).ToList();
        var p = d.AktivePeriode;
        for (var k = 0; k < 100; k++)
            for (var j = 0; j < 40; j++)
            {
                var u = new Unterricht { Id = d.NeueId(), Wochenstunden = 1, Zeilen = { new Kopplungszeile { LehrerId = d.Lehrer[(k * 2 + j) % 200].Id, FachId = faecher[j % 10].Id, KlassenIds = { d.Klassen[k].Id } } } };
                d.Unterrichte.Add(u);
                p.Plan.Add(new Planstunde { UnterrichtId = u.Id, Tag = j % 5, Stunde = 1 + (j / 5) % 8, Raeume = { d.Klassen[k].StammraumId } });
            }
        var tag = d.Einstellungen.SchuljahrVon;
        for (var i = 0; i < 3000; i++)
        {
            var u = d.Unterrichte[i];
            d.Vertretungen.Add(new Vertretung { Id = d.NeueId(), Datum = tag.AddDays(i % 150), Stunde = 1 + i % 8, UnterrichtId = u.Id, LehrerId = u.Zeilen[0].LehrerId, VertreterId = d.Lehrer[(i + 7) % 200].Id, FachId = u.Zeilen[0].FachId, KlassenIds = u.Zeilen[0].KlassenIds.ToList(), Text = "Vertretung " + i });
        }
        Dokument.Normalisieren(d);
        return d;
    }

    /// <summary>Messung: Schreiben einer großen Schuldatei in die Datenbank (Ziel typisch unter 200 ms; Schwelle großzügig für langsame CI).</summary>
    [Fact]
    public void GrosseSchuldateiWirdSchnellGespeichert()
    {
        var d = GrosseSchule();
        var dok = new Dokument(d);
        var sw = Stopwatch.StartNew();
        var inhalt = dok.Inhalt();
        var serialisieren = sw.Elapsed.TotalMilliseconds;
        sw.Restart();
        using (var ms = new MemoryStream())
        {
            using (var gz = new GZipStream(ms, CompressionLevel.Fastest, true)) gz.Write(inhalt);
            _aus.WriteLine($"gzip (Fastest): {ms.Length / 1024.0 / 1024:F2} MB in {sw.Elapsed.TotalMilliseconds:F0} ms");
        }
        var ergebnisse = new List<string>();
        foreach (var komprimieren in new[] { true, false })
        {
            var ordner = Path.Combine(Path.GetTempPath(), "untplanstudio-gross-" + Guid.NewGuid().ToString("N"));
            try
            {
                var db = new StudioDatenbank(new StudioKonfiguration { Datenordner = ordner, Komprimieren = komprimieren }, NullLogger<StudioDatenbank>.Instance);
                var info = new DokumentInfo { Id = "0123456789abcdef", Name = "Groß" };
                db.DokumentAnlegen(info, inhalt);
                var regel = new Fassungsregel(TimeSpan.FromMinutes(10));
                var zeiten = new List<double>();
                for (var i = 0; i < 8; i++)
                {
                    dok.Aendern("x", AenderungsArt.Vertretung, s => s.Vertretungen[i].Text = "geändert " + i);
                    var neu = dok.Inhalt();
                    sw.Restart();
                    Assert.True(db.DokumentSpeichern(info, neu, regel));
                    zeiten.Add(sw.Elapsed.TotalMilliseconds);
                }
                var typisch = zeiten.Skip(1).OrderBy(x => x).ElementAt(zeiten.Count / 2 - 1); // Median ohne ersten Lauf (JIT)
                var dateigroesse = new FileInfo(db.Pfad).Length + (File.Exists(db.Pfad + "-wal") ? new FileInfo(db.Pfad + "-wal").Length : 0);
                ergebnisse.Add($"{(komprimieren ? "komprimiert" : "unkomprimiert")}: Speichern typisch {typisch:F0} ms (alle: {string.Join(", ", zeiten.Select(z => z.ToString("F0")))}), Datenbank {dateigroesse / 1024.0 / 1024:F1} MB");
                Assert.Equal(dok.Inhalt(), db.DokumentInhalt(info.Id));
                Assert.Single(db.DokumentSicherungen(info.Id));
                Assert.True(typisch < 1500, $"Speichern zu langsam: {typisch:F0} ms");
            }
            finally
            {
                SqliteConnection.ClearAllPools();
                try { Directory.Delete(ordner, true); } catch (IOException) { }
            }
        }
        _aus.WriteLine($"Große Schule: {d.Lehrer.Count} Lehrkräfte, {d.Schueler.Count} Schüler, {d.Unterrichte.Count} Unterrichte, {d.Vertretungen.Count} Vertretungen; "
            + $"JSON {inhalt.Length / 1024.0 / 1024:F2} MB, Serialisieren {serialisieren:F0} ms");
        foreach (var e in ergebnisse) _aus.WriteLine(e);
    }

    /// <summary>Ende zu Ende: Änderung über die API → gespeichert (Server-Messung der ganzen Speicherung inkl. Serialisierung).</summary>
    [Fact]
    public async Task GrosseSchuldateiEndeZuEnde()
    {
        using var f = Fabrik(100);
        var c = await f.AngemeldetAsync();
        var id = await c.BeispielHochladenAsync(GrosseSchule());
        var a = f.Services.GetRequiredService<Dokumentdienst>().Holen(id);
        var db = f.Services.GetRequiredService<StudioDatenbank>();
        var zeiten = new List<double>();
        for (var i = 0; i < 4; i++)
        {
            await (await c.PutAsJsonAsync($"/api/dokumente/{id}/schule/schuldaten", new { schulname = $"Groß {i}" })).JsonAsync();
            await WartenAufAsync(() => a.IstGeaendert || a.Speichert, x => !x, 20000);
            var sw = Stopwatch.StartNew();
            await a.SpeichernAsync("test", immer: true);
            zeiten.Add(sw.Elapsed.TotalMilliseconds);
        }
        Assert.Equal("Groß 3", Schulname(db.DokumentInhalt(id)));
        _aus.WriteLine($"Speichern (Serialisieren + Komprimieren + Transaktion): {string.Join(", ", zeiten.Select(z => z.ToString("F0")))} ms");
        Assert.True(zeiten.Skip(1).Min() < 3000);
    }
}

/// <summary>„Vertretungen jetzt an EduOrga Web senden“ und automatische Übertragung gegen die UntPlanWeb-Attrappe.</summary>
public sealed class DirektUebertragungTests
{
    [Fact]
    public async Task EinKlickUndAutomatischNachAenderung()
    {
        await using var web = await UntPlanWebAttrappe.StartenAsync();
        using var f = new StudioFabrik { Einstellungen = new() { ["STUDIO_SPEICHERN_VERZOEGERUNG_MS"] = "200" } };
        var c = await f.AngemeldetAsync();
        var id = await c.BeispielHochladenAsync();
        var basis = $"/api/dokumente/{id}/untplanweb";

        // ohne Verbindung: verständlicher Fehler
        var ohne = await c.PostAsJsonAsync($"{basis}/vertretungen/senden", new { });
        Assert.Equal(HttpStatusCode.BadRequest, ohne.StatusCode);
        Assert.False((await c.GetJsonAsync($"{basis}/direkt"))["eingerichtet"]!.GetValue<bool>());

        await (await c.PutAsJsonAsync($"{basis}/einstellungen", new { schulId = "123456", server = "127.0.0.1", port = web.Port, https = false, apiSchluessel = "geheim", tageVoraus = 7 })).JsonAsync();

        // ein Klick: Paket mit Stammdaten + Vertretungen (an den Tagen nur Änderungen), Stand mit Zeit und Revision
        var stand = await c.PostJsonAsync($"{basis}/vertretungen/senden");
        Assert.True(stand["letzte"]!["ok"]!.GetValue<bool>(), stand.ToJsonString());
        Assert.False(stand["letzte"]!["automatisch"]!.GetValue<bool>());
        Assert.NotNull(stand["zuletztErfolgreich"]);
        Assert.True(web.Pakete.TryDequeue(out var paket));
        var teile = paket!["teile"]!.AsArray().Select(x => x!.GetValue<string>()).ToList();
        Assert.Contains("vertretungen", teile);
        Assert.Contains("stammdaten", teile);
        Assert.All(paket["tage"]!.AsArray(), t => Assert.True(t!["nurAenderungen"]!.GetValue<bool>()));
        Assert.Equal(paket["revision"]!.GetValue<int>(), stand["revision"]!.GetValue<int>());
        // die Übertragung ist keine eigene Rückgängig-Stufe
        Assert.Equal("UntPlanWeb-Einstellungen", (await c.GetJsonAsync($"/api/dokumente/{id}"))["rueckgaengigText"]?.GetValue<string>());

        // automatisch: nach einer Änderung der Vertretungen ohne Klick
        var direkt = await (await c.PutAsJsonAsync($"{basis}/direkt", new { automatisch = true, sekunden = 5 })).JsonAsync();
        Assert.True(direkt["automatisch"]!.GetValue<bool>());
        Assert.Equal(5, direkt["sekunden"]!.GetValue<int>());
        var heute = DateOnly.FromDateTime(DateTime.Today);
        await (await c.PutAsJsonAsync($"/api/dokumente/{id}/vertretung/tagestexte", new { datum = heute, texte = new[] { new { text = "Automatisch gesendet", portal = true } } })).JsonAsync();
        await (await c.PutAsJsonAsync($"/api/dokumente/{id}/vertretung/tagestexte", new { datum = heute, texte = new[] { new { text = "Automatisch gesendet 2", portal = true } } })).JsonAsync();
        Assert.NotNull((await c.GetJsonAsync($"{basis}/direkt"))["faellig"]);
        JsonNode? auto = null;
        for (var i = 0; i < 200 && !web.Pakete.TryDequeue(out auto); i++) await Task.Delay(100);
        Assert.NotNull(auto);
        Assert.Contains("Automatisch gesendet 2", auto!.ToJsonString());
        await Task.Delay(300);
        Assert.True(web.Pakete.IsEmpty); // zwei Änderungen → ein Paket
        var nachher = await c.GetJsonAsync($"{basis}/direkt");
        Assert.True(nachher["letzte"]!["automatisch"]!.GetValue<bool>());
        Assert.True(nachher["letzte"]!["ok"]!.GetValue<bool>());
        Assert.Null(nachher["faellig"]);
        // Stammdaten-Änderungen lösen keine automatische Übertragung aus
        await (await c.PutAsJsonAsync($"/api/dokumente/{id}/schule/schuldaten", new { schulname = "Andere Schule" })).JsonAsync();
        Assert.Null((await c.GetJsonAsync($"{basis}/direkt"))["faellig"]);

        // Einstellung liegt in der Studio-Datenbank (nicht in der Schuldatei) und wird mit dem Dokument gelöscht
        var db = f.Services.GetRequiredService<StudioDatenbank>();
        Assert.Contains("\"Automatisch\":true", db.AblageLesen(Ablagebereiche.UntPlanWebDirekt, id));
        await c.DeleteAsync($"/api/dokumente/{id}");
        Assert.Null(db.AblageLesen(Ablagebereiche.UntPlanWebDirekt, id));
    }
}
