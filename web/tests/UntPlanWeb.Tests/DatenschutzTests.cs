using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using UntPlanWeb.Daten;
using UntPlanWeb.Dienste;

namespace UntPlanWeb.Tests;

/// <summary>
/// Datenschutz: Aufbewahrungsfristen und Löschläufe (Probelauf, Löschprotokoll), Auskunft (Art. 15), Löschung bzw. Sperre von Personen
/// (Art. 17/18), Anonymisierung von Konten, Datenschutzhinweise mit Kenntnisnahme, Rollenbeschränkung, datensparsame Push-Nachrichten.
/// Feste Uhr der Tests: 14.10.2026.
/// </summary>
public class DatenschutzTests
{
    private static void Einfuegen(Testserver s, string sql, params (string, object?)[] p) => s.Dienst<Db>().Ausfuehren(sql, p);
    private static int Zahl(Testserver s, string sql, params (string, object?)[] p) => Convert.ToInt32(s.Dienst<Db>().Wert(sql, p));

    private static void Fehlzeit(Testserver s, int schueler, string datum, int stunde = 1) =>
        Einfuegen(s, "INSERT INTO fehlzeiten (datum, stunde, schueler_id, klasse, erstellt) VALUES (@d, @s, @id, '7a', @d)", Db.P("@d", datum), Db.P("@s", stunde), Db.P("@id", schueler));

    [Fact]
    public void Fristen_nach_VO_DV_I_beginnen_mit_Ablauf_des_Kalenderjahres()
    {
        var heute = new DateOnly(2026, 10, 14);
        // 10 Jahre: Schuljahr 2014/15 (Ende Juli 2015) → Frist 2016–2025 abgelaufen; 2015/16 (Ende 2016) läuft bis 31.12.2026
        Assert.Equal(new DateOnly(2015, 8, 1), Datenschutzdienst.Grenze("jahre", 10, heute));
        Assert.Equal(new DateOnly(2025, 12, 31), Datenschutzdienst.FristEnde(new DateOnly(2015, 3, 1), 10));
        Assert.Equal(new DateOnly(2026, 12, 31), Datenschutzdienst.FristEnde(new DateOnly(2015, 9, 1), 10));
        Assert.Equal(new DateOnly(2026, 9, 14), Datenschutzdienst.Grenze("tage", 30, heute));
        // Vorgaben: Klassenbuch 10 Jahre (zu prüfen, aus), Anmeldeprotokoll 30 Tage (an)
        var kb = Datenschutzdienst.Kategorie(Datenschutzdienst.Klassenbuch);
        Assert.Equal((10, false, true), (kb.Vorgabe, kb.VorgabeAktiv, kb.Pruefen));
        var an = Datenschutzdienst.Kategorie(Datenschutzdienst.Anmeldungen);
        Assert.Equal((30, true), (an.Vorgabe, an.VorgabeAktiv));
    }

    [Fact]
    public async Task Loeschlauf_loescht_nur_eingeschaltete_Kategorien_mit_Probelauf_und_Protokoll()
    {
        await using var s = await Testserver.StartenAsync();
        var admin = await s.AlsAsync("admin");
        var sid = s.Dienst<Paketdienst>().Aktuell!.Schueler.First().Id;
        var adminId = s.Dienst<Benutzerdienst>().NachLogin("admin")!.Id;
        Einfuegen(s, "INSERT INTO benutzer_anmeldungen (benutzer_id, zeit, ergebnis, adresse, geraet) VALUES (@b, '2026-08-01 10:00:00', 'ok', '203.0.113.7', 'Firefox')", Db.P("@b", adminId));
        Einfuegen(s, "INSERT INTO protokoll (zeit, benutzer, aktion) VALUES ('2024-01-01 10:00:00', 'admin', 'Anmeldung')");
        Fehlzeit(s, sid, "2015-06-01");          // Frist abgelaufen
        Fehlzeit(s, sid, "2016-06-01");          // Schuljahr 2015/16: Frist bis 31.12.2026
        Einfuegen(s, "INSERT INTO mitteilungen (absender_id, betreff, text, erstellt) VALUES (@b, 'alt', 'Text', '2020-01-01 08:00')", Db.P("@b", adminId));

        // Probelauf (auch für ausgeschaltete Kategorien)
        var vorschau = await Testserver.HolenAsync(admin, "/api/app/admin/datenschutz/aufbewahrung");
        JsonNode K(JsonNode v, string id) => v["kategorien"]!.AsArray().Single(k => k!["id"]!.GetValue<string>() == id)!;
        Assert.Equal(1, K(vorschau, "anmeldungen")["anzahl"]!.GetValue<int>());
        Assert.True(K(vorschau, "anmeldungen")["aktiv"]!.GetValue<bool>());
        Assert.Equal(1, K(vorschau, "klassenbuch")["anzahl"]!.GetValue<int>());
        Assert.False(K(vorschau, "klassenbuch")["aktiv"]!.GetValue<bool>());
        Assert.Equal("2015-08-01", K(vorschau, "klassenbuch")["grenze"]!.GetValue<string>());
        Assert.Equal(0, Zahl(s, "SELECT COUNT(*) FROM loeschprotokoll"));   // Probelauf ändert nichts
        Assert.Equal(2, Zahl(s, "SELECT COUNT(*) FROM fehlzeiten"));

        // automatischer Lauf: nur eingeschaltete Kategorien (Anmeldeprotokoll, Protokoll), Klassenbuch und Mitteilungen bleiben
        var res = s.Dienst<Datenschutzdienst>().Ausfuehren("automatisch");
        Assert.Equal(0, Zahl(s, "SELECT COUNT(*) FROM benutzer_anmeldungen WHERE zeit < '2026-09-01'"));
        Assert.Equal(0, Zahl(s, "SELECT COUNT(*) FROM protokoll WHERE zeit < '2025-01-01'"));
        Assert.Equal(2, Zahl(s, "SELECT COUNT(*) FROM fehlzeiten"));
        Assert.Equal(1, Zahl(s, "SELECT COUNT(*) FROM mitteilungen WHERE betreff = 'alt'"));
        Assert.DoesNotContain(res, r => r.Kategorie == "klassenbuch");

        // Klassenbuch und Mitteilungen einschalten (Fristen der Schule), außerhalb der Grenzen → 400
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PutAsJsonAsync("/api/app/admin/datenschutz/aufbewahrung",
            new { regeln = new[] { new { id = "klassenbuch", aktiv = true, wert = 0 } } })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync("/api/app/admin/datenschutz/aufbewahrung",
            new { regeln = new[] { new { id = "klassenbuch", aktiv = true, wert = 10 }, new { id = "mitteilungen", aktiv = true, wert = 365 } } })).StatusCode);
        var lauf = await Testserver.JsonAsync(await admin.PostAsJsonAsync("/api/app/admin/datenschutz/aufbewahrung/ausfuehren", new { }));
        Assert.True(lauf["anzahl"]!.GetValue<int>() >= 2);
        Assert.Equal("2016-06-01", Assert.Single(s.Dienst<Db>().Liste("SELECT datum FROM fehlzeiten", r => r.Text("datum"))));
        Assert.Equal(0, Zahl(s, "SELECT COUNT(*) FROM mitteilungen WHERE betreff = 'alt'"));

        // Löschprotokoll: Anzahl und Grenze, keine Inhalte
        var prot = (await Testserver.HolenAsync(admin, "/api/app/admin/datenschutz/loeschprotokoll")).AsArray();
        var kb = prot.First(e => e!["kategorie"]!.GetValue<string>() == "klassenbuch")!;
        Assert.Equal(1, kb["anzahl"]!.GetValue<int>());
        Assert.Equal("2015-08-01", kb["grenze"]!.GetValue<string>());
        Assert.Contains(prot, e => e!["kategorie"]!.GetValue<string>() == "anmeldungen" && e["ausgeloest"]!.GetValue<string>() == "automatisch");
        Assert.DoesNotContain("203.0.113.7", prot.ToJsonString());
    }

    [Fact]
    public async Task Auskunft_nur_fuer_die_Administration_mit_allen_Daten_der_Person()
    {
        await using var s = await Testserver.StartenAsync();
        var admin = await s.AlsAsync("admin");
        var stand = s.Dienst<Paketdienst>().Aktuell!;
        var a = stand.Schueler.First(x => x.Klasse == "7a");
        var b = stand.Schueler.First(x => x.Id != a.Id);
        Fehlzeit(s, a.Id, "2026-10-12", 2);
        Fehlzeit(s, b.Id, "2026-10-12", 3);
        Einfuegen(s, "INSERT INTO vermerke (datum, klasse, schueler_id, text, erstellt) VALUES ('2026-10-13', '7a', @s, 'Vermerk A', '2026-10-13')", Db.P("@s", a.Id));

        var j = await Testserver.HolenAsync(admin, $"/api/app/admin/datenschutz/auskunft?schueler={a.Id}");
        Assert.Equal(a.Id, j["stammdaten"]!["aktuell"]!["id"]!.GetValue<int>());
        Assert.Single(j["fehlzeiten"]!.AsArray());
        Assert.Equal(a.Id, j["fehlzeiten"]![0]!["schueler_id"]!.GetValue<int>());
        Assert.Equal("Vermerk A", j["vermerke"]![0]!["text"]!.GetValue<string>());

        // Konto: ohne Passwort-Hash und ohne iCal-Token
        var lan = await s.AlsAsync("lan", "lehrer", "LAN");
        var id = s.Dienst<Benutzerdienst>().NachLogin("lan")!.Id;
        var k = await admin.GetAsync($"/api/app/admin/datenschutz/auskunft?benutzer={id}");
        var text = await k.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.OK, k.StatusCode);
        Assert.Contains("\"anmeldungen\"", text);
        Assert.DoesNotContain("AQAAAA", text);                      // Hash von ASP.NET Identity
        Assert.DoesNotContain(s.Dienst<Benutzerdienst>().Holen(id)!.IcalToken, text);
        Assert.Equal("LAN", JsonNode.Parse(text)!["lehrkraft"]!["kuerzel"]!.GetValue<string>());

        var pdf = await admin.GetAsync($"/api/app/admin/datenschutz/auskunft?schueler={a.Id}&format=pdf");
        Assert.Equal("application/pdf", pdf.Content.Headers.ContentType!.MediaType);
        Assert.StartsWith("%PDF", System.Text.Encoding.ASCII.GetString((await pdf.Content.ReadAsByteArrayAsync())[..4]));
        Assert.Equal("no-store", pdf.Headers.CacheControl!.ToString());

        // keine Auskunft, Löschung oder Fristen für andere Rollen
        foreach (var url in new[] { $"/api/app/admin/datenschutz/auskunft?schueler={a.Id}", "/api/app/admin/datenschutz/aufbewahrung", "/api/app/admin/datenschutz/personen" })
            Assert.Equal(HttpStatusCode.Forbidden, (await lan.GetAsync(url)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await lan.PostAsJsonAsync($"/api/app/admin/datenschutz/schueler/{a.Id}/loeschen", new { bestaetigt = true })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await s.Client().GetAsync($"/api/app/admin/datenschutz/auskunft?schueler={a.Id}")).StatusCode);
    }

    [Fact]
    public async Task Loeschen_sperrt_bei_laufender_Aufbewahrungsfrist_und_loescht_sonst()
    {
        await using var s = await Testserver.StartenAsync();
        var admin = await s.AlsAsync("admin");
        var pakete = s.Dienst<Paketdienst>();
        var stand = pakete.Aktuell!;
        var mitFrist = stand.Schueler.First();
        var ohneFrist = stand.Schueler.Skip(1).First();
        Fehlzeit(s, mitFrist.Id, "2026-10-12");
        Fehlzeit(s, ohneFrist.Id, "2014-03-01");
        Einfuegen(s, "INSERT INTO sprechtage (id, name, datum, beginn, ende, anmeldung_von, anmeldung_bis) VALUES (1, 'Sprechtag', '2026-11-05', '15:00', '19:00', '2026-10-01', '2026-11-01')");
        foreach (var x in new[] { mitFrist.Id, ohneFrist.Id })
            Einfuegen(s, "INSERT INTO sprechtag_warteliste (sprechtag_id, lehrer, schueler_id) VALUES (1, 'LAN', @s)", Db.P("@s", x));
        var konto = s.Dienst<Benutzerdienst>().Anlegen("schueler-x", "familie-passwort", Rollen.Schueler);
        s.Dienst<Benutzerdienst>().SchuelerZuordnen(konto.Id, new[] { mitFrist.Id });

        // Vorschau: Fehlzeiten bleiben gesperrt bis 31.12.2037 (Schuljahr 2026/27 endet 2027, + 10 Jahre)
        var plan = await Testserver.HolenAsync(admin, $"/api/app/admin/datenschutz/schueler/{mitFrist.Id}/loeschen");
        Assert.True(plan["einschraenken"]!.GetValue<bool>());
        Assert.Equal("2037-12-31", plan["fristBis"]!.GetValue<string>());
        Assert.Equal(1, plan["aufbewahren"]!["fehlzeiten"]!.GetValue<int>());
        Assert.Equal(1, plan["loeschen"]!["sprechtag_warteliste"]!.GetValue<int>());
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync($"/api/app/admin/datenschutz/schueler/{mitFrist.Id}/loeschen", new { bestaetigt = false })).StatusCode);

        await Testserver.JsonAsync(await admin.PostAsJsonAsync($"/api/app/admin/datenschutz/schueler/{mitFrist.Id}/loeschen", new { bestaetigt = true, grund = "Antrag der Eltern" }));
        Assert.DoesNotContain(pakete.Aktuell!.Schueler, x => x.Id == mitFrist.Id);           // ausgeblendet (Einschränkung)
        Assert.Equal(1, Zahl(s, "SELECT COUNT(*) FROM fehlzeiten WHERE schueler_id = @s", Db.P("@s", mitFrist.Id)));
        Assert.Equal(0, Zahl(s, "SELECT COUNT(*) FROM sprechtag_warteliste WHERE schueler_id = @s", Db.P("@s", mitFrist.Id)));
        Assert.Equal(0, Zahl(s, "SELECT COUNT(*) FROM benutzer_schueler WHERE schueler_id = @s", Db.P("@s", mitFrist.Id)));
        Assert.True(s.Dienst<Benutzerdienst>().Holen(konto.Id)!.Gesperrt);
        var sperre = Assert.Single((await Testserver.HolenAsync(admin, "/api/app/admin/datenschutz/sperren")).AsArray());
        Assert.Equal("2037-12-31", sperre!["bis"]!.GetValue<string>());
        // gesperrte Personen bleiben für die Auskunft auffindbar
        var personen = await Testserver.HolenAsync(admin, $"/api/app/admin/datenschutz/personen?suche={Uri.EscapeDataString(mitFrist.Name)}");
        Assert.Contains(personen["schueler"]!.AsArray(), x => x!["id"]!.GetValue<int>() == mitFrist.Id && x["gesperrtBis"]!.GetValue<string>() == "2037-12-31");

        // ohne laufende Frist: alles gelöscht, Name im Overlay geleert
        var p2 = await Testserver.JsonAsync(await admin.PostAsJsonAsync($"/api/app/admin/datenschutz/schueler/{ohneFrist.Id}/loeschen", new { bestaetigt = true }));
        Assert.False(p2["einschraenken"]!.GetValue<bool>());
        Assert.Equal(0, Zahl(s, "SELECT COUNT(*) FROM fehlzeiten WHERE schueler_id = @s", Db.P("@s", ohneFrist.Id)));
        Assert.Equal("", s.Dienst<Db>().Wert("SELECT name FROM schueler_daten WHERE id = @s", Db.P("@s", ohneFrist.Id)));
        Assert.DoesNotContain(pakete.Aktuell!.Schueler, x => x.Id == ohneFrist.Id);

        // nach Ablauf der Sperre löscht der nächste Lauf den Rest
        s.Dienst<Uhr>().Fest = new DateTime(2038, 1, 2, 3, 0, 0);
        s.Dienst<Datenschutzdienst>().Ausfuehren("automatisch");
        Assert.Equal(0, Zahl(s, "SELECT COUNT(*) FROM fehlzeiten WHERE schueler_id = @s", Db.P("@s", mitFrist.Id)));
        Assert.Equal(0, Zahl(s, "SELECT COUNT(*) FROM datenschutz_sperren"));
        Assert.Contains(s.Dienst<Datenschutzdienst>().Loeschprotokoll(), e => e.Kategorie == "person-geloescht" && e.Details.Contains($"Nr. {mitFrist.Id}"));
        Assert.DoesNotContain(s.Dienst<Datenschutzdienst>().Loeschprotokoll(), e => e.Details.Contains(mitFrist.Name));
    }

    [Fact]
    public async Task Konto_anonymisieren_entfernt_persoenliche_Angaben()
    {
        await using var s = await Testserver.StartenAsync();
        var admin = await s.AlsAsync("admin");
        await s.AlsAsync("mueller", "eltern");
        var bd = s.Dienst<Benutzerdienst>();
        var id = bd.NachLogin("mueller")!.Id;
        bd.EmailSetzen(id, "mueller@example.org");
        Assert.True(Zahl(s, "SELECT COUNT(*) FROM benutzer_anmeldungen WHERE benutzer_id = @b", Db.P("@b", id)) > 0);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync($"/api/app/admin/datenschutz/benutzer/{bd.NachLogin("admin")!.Id}/anonymisieren", new { })).StatusCode);
        await Testserver.JsonAsync(await admin.PostAsJsonAsync($"/api/app/admin/datenschutz/benutzer/{id}/anonymisieren", new { }));
        var b = bd.Holen(id)!;
        Assert.Equal(($"geloescht-{id}", "Gelöschtes Konto", "", true), (b.Login, b.Anzeigename, b.Email, b.Gesperrt));
        Assert.Equal(0, Zahl(s, "SELECT COUNT(*) FROM benutzer_anmeldungen WHERE benutzer_id = @b", Db.P("@b", id)));
        Assert.Equal(HttpStatusCode.Unauthorized, (await s.Client().PostAsJsonAsync("/api/app/anmelden", new { login = "mueller", passwort = "test-passwort" })).StatusCode);
    }

    [Fact]
    public async Task Datenschutzhinweise_oeffentlich_mit_Platzhaltern_und_Kenntnisnahme_der_Familien()
    {
        await using var s = await Testserver.StartenAsync();
        var anonym = s.Client();
        var seite = await (await anonym.GetAsync("/datenschutz")).Content.ReadAsStringAsync();
        Assert.Contains("Datenschutzhinweise", seite);
        Assert.Contains("[bitte ergänzen: Name der bzw. des behördlichen Datenschutzbeauftragten]", seite);
        Assert.Contains("Vorlage:", seite);
        Assert.Contains("Anmeldeprotokoll", seite);   // Speicherdauer aus den Fristen
        Assert.DoesNotContain("<script", seite);

        var admin = await s.AlsAsync("admin");
        await Testserver.JsonAsync(await admin.PutAsJsonAsync("/api/app/admin/datenschutz/hinweise",
            new { verantwortlicher = "Gymnasium <b>Muster</b>", dsbName = "Frau Beispiel", dsbKontakt = "dsb@example.org", geprueft = true }));
        seite = await (await anonym.GetAsync("/datenschutz")).Content.ReadAsStringAsync();
        Assert.Contains("Gymnasium &lt;b&gt;Muster&lt;/b&gt;", seite);   // HTML wird maskiert
        Assert.Contains("Frau Beispiel", seite);
        Assert.DoesNotContain("Vorlage:", seite);
        Assert.Equal("Frau Beispiel", (await Testserver.HolenAsync(anonym, "/api/app/datenschutz"))["dsbName"]!.GetValue<string>());

        // Eltern: Hinweis nach der Anmeldung, bis zur Kenntnisnahme; Kollegium nie
        var eltern = await s.AlsAsync("eltern-b", "eltern");
        Assert.True((await Testserver.HolenAsync(eltern, "/api/app/sitzung"))["benutzer"]!["datenschutzHinweis"]!.GetValue<bool>());
        await Testserver.JsonAsync(await eltern.PostAsJsonAsync("/api/app/datenschutz/kenntnis", new { }));
        Assert.False((await Testserver.HolenAsync(eltern, "/api/app/sitzung"))["benutzer"]!["datenschutzHinweis"]!.GetValue<bool>());
        Assert.False((await Testserver.HolenAsync(admin, "/api/app/sitzung"))["benutzer"]!["datenschutzHinweis"]!.GetValue<bool>());
        // neue Fassung der Hinweise → erneut anzeigen
        s.Dienst<Uhr>().Fest = Testserver.Jetzt.AddDays(1);
        await Testserver.JsonAsync(await admin.PutAsJsonAsync("/api/app/admin/datenschutz/hinweise", new { verantwortlicher = "Gymnasium Muster", geprueft = true }));
        Assert.True((await Testserver.HolenAsync(eltern, "/api/app/sitzung"))["benutzer"]!["datenschutzHinweis"]!.GetValue<bool>());
        Assert.Equal("/datenschutz", (await Testserver.HolenAsync(eltern, "/api/app/sitzung"))["datenschutz"]!.GetValue<string>());
    }

    [Fact]
    public async Task Lehrkraefte_ohne_Klassenleitung_sehen_keine_persoenlichen_Schuelerangaben()
    {
        await using var s = await Testserver.StartenAsync();
        var stand = s.Dienst<Paketdienst>().Aktuell!;
        var x = stand.Schueler.First();
        var admin = await s.AlsAsync("admin");
        await Testserver.JsonAsync(await admin.PutAsJsonAsync($"/api/app/schueler/{x.Id}",
            new { vorname = x.Vorname, name = x.Name, klasse = x.Klasse, geburtsdatum = "2012-05-01", email = "kind@example.org", bemerkung = "vertraulich" }));
        // Lehrkraft, die in dieser Klasse nicht Klassenleitung ist
        var lehrer = stand.Lehrer.Keys.First(k => !Klassenbuchdienst.IstKlassenleitung(new Benutzer(0, k, k, Rollen.Lehrer, k, "", false, false, "", "", null), stand, x.Klasse));
        var c = await s.AlsAsync(lehrer.ToLowerInvariant(), "lehrer", lehrer);
        var text = await (await c.GetAsync($"/api/app/schueler?klasse={Uri.EscapeDataString(x.Klasse)}")).Content.ReadAsStringAsync();
        Assert.DoesNotContain("kind@example.org", text);
        Assert.DoesNotContain("2012-05-01", text);
        Assert.DoesNotContain("vertraulich", text);
        // Klassen- und Familienkonten: keine Schülerverwaltung
        var eltern = await s.AlsAsync("eltern-c", "eltern");
        Assert.Equal(HttpStatusCode.Forbidden, (await eltern.GetAsync("/api/app/schueler")).StatusCode);
    }

    [Fact]
    public void Push_Nachricht_ist_standardmaessig_datensparsam()
    {
        var liste = new List<PlanAenderung> { new("2026-10-15", 3, 3, "D", "7a", "entfall") };
        var (titel, text) = Pushdienst.Datensparsam(liste);
        Assert.Equal("Änderung im Stundenplan", titel);
        Assert.DoesNotContain("7a", text);
        Assert.DoesNotContain("D ", text);
        Assert.DoesNotContain("3.", text);
        Assert.Contains("7a", Pushdienst.Nachricht(liste).Text);   // nur mit ausdrücklich eingeschalteten Einzelheiten
    }

    [Fact]
    public async Task Push_nach_dem_Import_ohne_Einzelheiten_bis_zur_Freigabe()
    {
        await using var s = await Testserver.StartenAsync();
        var push = s.Dienst<Pushdienst>();
        Assert.False(push.MitDetails);
        var admin = await s.AlsAsync("admin");
        Assert.False((await Testserver.HolenAsync(admin, "/api/app/admin/push"))["details"]!.GetValue<bool>());
        await Testserver.JsonAsync(await admin.PutAsJsonAsync("/api/app/admin/push", new { details = true }));
        Assert.True(push.MitDetails);
        await Testserver.JsonAsync(await admin.PutAsJsonAsync("/api/app/admin/push", new { details = false }));
        Assert.False(push.MitDetails);
    }

    [Fact]
    public async Task Anmeldecookie_HttpOnly_SameSite_und_Sicherheitskoepfe()
    {
        await using var s = await Testserver.StartenAsync();
        var c = s.Client(cookies: false);
        c.DefaultRequestHeaders.Remove("X-UntPlanWeb");
        c.DefaultRequestHeaders.Add("X-UntPlanWeb", "1");
        var r = await c.PostAsJsonAsync("/api/app/anmelden", new { login = "admin", passwort = Testserver.AdminPasswort });
        var cookie = r.Headers.GetValues("Set-Cookie").First(x => x.StartsWith("untplanweb="));
        Assert.Contains("httponly", cookie.ToLowerInvariant());
        Assert.Contains("samesite=strict", cookie.ToLowerInvariant());
        var seite = await c.GetAsync("/datenschutz");
        Assert.Contains("frame-ancestors 'none'", seite.Headers.GetValues("Content-Security-Policy").Single());
        Assert.Equal("nosniff", seite.Headers.GetValues("X-Content-Type-Options").Single());
    }
}
