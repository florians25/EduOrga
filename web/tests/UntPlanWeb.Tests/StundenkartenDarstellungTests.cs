using System.Net;
using System.Net.Http.Json;
using UntPlanWeb.Daten;
using UntPlanWeb.Dienste;

namespace UntPlanWeb.Tests;

/// <summary>
/// Administration | Darstellung der Stundenkarten: Standard = Vorlage „EduOrga Standard“ (Kante links mit Tönung, Schatten, Fach · Klasse · Lehrkraft · Raum, graues Raster), Lesen für alle Angemeldeten (auch in der Sitzung),
/// Ändern und Zurücksetzen nur durch die Administration, Prüfung der Werte, Speicherung in der Tabelle einstellungen
/// (keine Schemaänderung; ältere bzw. unvollständige gespeicherte Angaben erhalten die Standardwerte).
/// </summary>
public class StundenkartenDarstellungTests
{
    private const string Url = "/api/app/darstellung";

    [Fact]
    public async Task Standard_ist_EduOrga_Standard_und_fuer_alle_lesbar()
    {
        await using var s = await Testserver.StartenAsync();
        var schueler = await s.AlsAsync("6a", "schueler", "6a");
        var d = await Testserver.HolenAsync(schueler, Url);
        Assert.Equal("balken-flaeche", d["fachfarbe"]!.GetValue<string>());
        Assert.Equal(5, d["balkenbreite"]!.GetValue<int>());
        Assert.Equal("weiss", d["flaeche"]!.GetValue<string>());
        Assert.Equal("fein", d["rahmen"]!.GetValue<string>());
        Assert.Equal("zeilen", d["reihenfolge"]!.GetValue<string>());
        Assert.Equal("grau", d["raster"]!.GetValue<string>());
        Assert.Equal(4, d["eckenradius"]!.GetValue<int>());
        Assert.Equal("kompakt", d["dichte"]!.GetValue<string>());
        Assert.Equal("kuerzel", d["fach"]!.GetValue<string>());
        Assert.True(d["raum"]!.GetValue<bool>());
        Assert.True(d["zeile2"]!.GetValue<bool>());
        Assert.Equal("text", d["kuerzel"]!.GetValue<string>());
        Assert.False(d["statuswoerter"]!.GetValue<bool>());
        Assert.True(d["statusflaeche"]!.GetValue<bool>());

        // in der Sitzung enthalten; ohne Anmeldung weder dort noch über den Endpunkt
        var sitzung = await Testserver.HolenAsync(schueler, "/api/app/sitzung");
        Assert.Equal("balken-flaeche", sitzung["darstellung"]!["fachfarbe"]!.GetValue<string>());
        var anonym = s.Client();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonym.GetAsync(Url)).StatusCode);
        Assert.Null((await Testserver.HolenAsync(anonym, "/api/app/sitzung"))["darstellung"]);
    }

    [Fact]
    public async Task Nur_die_Administration_aendert_und_alle_sehen_die_Aenderung()
    {
        await using var s = await Testserver.StartenAsync();
        var lehrer = await s.AlsAsync("sne", "lehrer", "SNE");
        var leitung = await s.AlsAsync("sl", "leitung");
        var akzent = new { fachfarbe = "balken-links", balkenbreite = 4, deckkraft = 12, flaeche = "weiss", rahmen = "fein", eckenradius = 4, dichte = "normal",
            fach = "kuerzel", raum = true, zeile2 = true, zeile2Text = "kuerzel", kuerzel = "text", statuswoerter = true, statusflaeche = false };
        Assert.Equal(HttpStatusCode.Forbidden, (await lehrer.PutAsJsonAsync(Url, akzent)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await leitung.PutAsJsonAsync(Url, akzent)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await lehrer.DeleteAsync(Url)).StatusCode);

        var admin = await s.AlsAsync("admin");
        var neu = await Testserver.JsonAsync(await admin.PutAsJsonAsync(Url, akzent));
        Assert.Equal(("balken-links", 4, "weiss", "text"), (neu["fachfarbe"]!.GetValue<string>(), neu["balkenbreite"]!.GetValue<int>(), neu["flaeche"]!.GetValue<string>(), neu["kuerzel"]!.GetValue<string>()));

        // gilt für alle Konten (Endpunkt und Sitzung)
        var l = await Testserver.HolenAsync(lehrer, Url);
        Assert.Equal("balken-links", l["fachfarbe"]!.GetValue<string>());
        Assert.True(l["statuswoerter"]!.GetValue<bool>());
        Assert.False(l["statusflaeche"]!.GetValue<bool>());
        Assert.Equal("weiss", (await Testserver.HolenAsync(lehrer, "/api/app/sitzung"))["darstellung"]!["flaeche"]!.GetValue<string>());

        // fehlende Angaben im PUT erhalten ihren Standard
        var teil = await Testserver.JsonAsync(await admin.PutAsJsonAsync(Url, new { fachfarbe = "flaeche", deckkraft = 20 }));
        Assert.Equal(("flaeche", 20, "weiss", 4), (teil["fachfarbe"]!.GetValue<string>(), teil["deckkraft"]!.GetValue<int>(), teil["flaeche"]!.GetValue<string>(), teil["eckenradius"]!.GetValue<int>()));

        // zurücksetzen
        var standard = await Testserver.JsonAsync(await admin.DeleteAsync(Url));
        Assert.Equal("balken-flaeche", standard["fachfarbe"]!.GetValue<string>());
        Assert.Equal("balken-flaeche", (await Testserver.HolenAsync(lehrer, Url))["fachfarbe"]!.GetValue<string>());
        Assert.Null(new Einstellungen(s.Dienst<Db>()).Lesen(Kartendarstellungen.Schluessel));
    }

    [Theory]
    [InlineData("{\"fachfarbe\":\"regenbogen\"}")]
    [InlineData("{\"balkenbreite\":1}")]
    [InlineData("{\"balkenbreite\":7}")]
    [InlineData("{\"deckkraft\":5}")]
    [InlineData("{\"deckkraft\":31}")]
    [InlineData("{\"flaeche\":\"bunt\"}")]
    [InlineData("{\"rahmen\":\"doppelt\"}")]
    [InlineData("{\"eckenradius\":-1}")]
    [InlineData("{\"eckenradius\":9}")]
    [InlineData("{\"dichte\":\"riesig\"}")]
    [InlineData("{\"fach\":\"lang\"}")]
    [InlineData("{\"zeile2Text\":\"\"}")]
    [InlineData("{\"kuerzel\":\"fett\"}")]
    [InlineData("{\"reihenfolge\":\"raum\"}")]
    [InlineData("{\"raster\":\"bunt\"}")]
    [InlineData("{\"fachfarbe\":null}")]
    [InlineData("{\"eckenradius\":\"drei\"}")]
    public async Task Ungueltige_Werte_werden_abgelehnt(string json)
    {
        await using var s = await Testserver.StartenAsync(false);
        var admin = await s.AlsAsync("admin");
        var r = await admin.PutAsync(Url, new StringContent(json, System.Text.Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Null(new Einstellungen(s.Dienst<Db>()).Lesen(Kartendarstellungen.Schluessel));
    }

    [Fact]
    public async Task Speicherung_in_SQLite_ohne_Schemaaenderung_und_robust_gegen_alte_Angaben()
    {
        await using var s = await Testserver.StartenAsync(false);
        var db = s.Dienst<Db>();
        // frische Datenbank: Schema vollständig migriert, kein gespeicherter Wert → Standard
        Assert.Equal(Db.Migrationsnummern.Max(), db.Version());
        Assert.Equal(new Kartendarstellung(), Kartendarstellungen.Laden(db));

        // Speichern und erneut laden (Tabelle einstellungen, Schlüssel einstellung:kartendarstellung)
        var gespeichert = Kartendarstellungen.Speichern(db, new Kartendarstellung { Fachfarbe = "balken-oben", Balkenbreite = 5, Dichte = "normal", Statusflaeche = false });
        Assert.Equal(gespeichert, Kartendarstellungen.Laden(db));
        Assert.Contains("\"fachfarbe\":\"balken-oben\"", new Einstellungen(db).Lesen(Kartendarstellungen.Schluessel));
        // die bisherige Grunddarstellung („Sachlich“) bleibt wählbar
        Assert.Equal("quadrat", Kartendarstellungen.Speichern(db, new Kartendarstellung { Fachfarbe = "quadrat", Flaeche = "neutral", Dichte = "normal", Eckenradius = 3, Kuerzel = "umrandet", Statusflaeche = false }).Fachfarbe);

        // ältere bzw. unvollständige Angaben: fehlende Felder erhalten ihren Standard
        new Einstellungen(db).Schreiben(Kartendarstellungen.Schluessel, "{\"fachfarbe\":\"keine\"}");
        Assert.Equal(new Kartendarstellung { Fachfarbe = "keine" }, Kartendarstellungen.Laden(db));
        // beschädigte bzw. ungültige Angaben: Standard statt Fehler
        new Einstellungen(db).Schreiben(Kartendarstellungen.Schluessel, "{kaputt");
        Assert.Equal(new Kartendarstellung(), Kartendarstellungen.Laden(db));
        new Einstellungen(db).Schreiben(Kartendarstellungen.Schluessel, "{\"rahmen\":\"doppelt\"}");
        Assert.Equal(new Kartendarstellung(), Kartendarstellungen.Laden(db));
    }
}
