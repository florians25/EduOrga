using System.Text;
using System.Text.Json;
using UntPlanWeb.Dienste;

namespace UntPlanWeb.Api;

/// <summary>
/// Datenschutz (siehe docs/datenschutz/README.md):
/// <list type="bullet">
/// <item><c>GET /datenschutz</c> (ohne Anmeldung) – Datenschutzhinweise der Schule als Seite (Vorlage mit den Angaben der Administration).</item>
/// <item><c>GET /api/app/datenschutz</c> (ohne Anmeldung) – Angaben und Adresse der Hinweise für Apps; <c>POST …/kenntnis</c> – Kenntnisnahme vermerken.</item>
/// <item>Administration (<c>/api/app/admin/datenschutz/…</c>): <c>GET|PUT aufbewahrung</c> (Fristen mit Vorschau), <c>POST aufbewahrung/ausfuehren</c>,
///   <c>GET loeschprotokoll</c>, <c>GET auskunft?benutzer=|schueler=&amp;format=json|pdf</c>, <c>GET|POST schueler/{id}/loeschen</c>,
///   <c>POST benutzer/{id}/anonymisieren</c>, <c>GET sperren</c>, <c>GET|PUT hinweise</c>.</item>
/// </list>
/// </summary>
public static class DatenschutzApi
{
    public sealed record RegelDaten(List<Aufbewahrungsregel>? Regeln);
    public sealed record AusfuehrenDaten(List<string>? Kategorien);
    public sealed record LoeschDaten(string? Grund, bool Bestaetigt);

    private static Benutzer Admin(HttpContext c)
    {
        var b = c.Ich() ?? throw new NichtAngemeldetException();
        return b.IstAdmin ? b : throw new UnauthorizedAccessException("Nur für die Administration.");
    }

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { WriteIndented = true };

    public static void Abbilden(WebApplication app)
    {
        app.MapGet("/datenschutz", (Datenschutzdienst ds, Einstellungen e, Paketdienst p) =>
            Results.Content(Seite(ds, e.Schulname.Length > 0 ? e.Schulname : p.Aktuell?.Paket.Schule.Name ?? ""), "text/html; charset=utf-8"));

        var api = app.MapGroup("/api/app");
        api.MapGet("/datenschutz", (HttpContext c, Datenschutzdienst ds) =>
        {
            var a = ds.Angaben();
            var b = c.Ich();
            return Results.Json(new
            {
                adresse = "/datenschutz", a.Verantwortlicher, a.DsbName, a.DsbKontakt, a.Geprueft, a.Stand,
                kenntnisOffen = b is not null && ds.KenntnisOffen(b),
            });
        });
        api.MapPost("/datenschutz/kenntnis", (HttpContext c, Datenschutzdienst ds) =>
        {
            ds.KenntnisVermerken(c.Ich() ?? throw new NichtAngemeldetException());
            return Results.Json(new { ok = true });
        });

        var admin = app.MapGroup("/api/app/admin/datenschutz");
        admin.MapGet("/aufbewahrung", (HttpContext c, Datenschutzdienst ds) =>
        {
            Admin(c);
            var r = ds.Regeln();
            var vorschau = ds.Vorschau().ToDictionary(v => v.Kategorie);
            return Results.Json(new
            {
                festgelegtVon = r.FestgelegtVon, festgelegtAm = r.FestgelegtAm,
                kategorien = Datenschutzdienst.Kategorien.Select(k => new
                {
                    k.Id, k.Name, k.Beschreibung, k.Einheit, k.Vorgabe, k.VorgabeAktiv, k.Grundlage, k.Pruefen, k.Minimum, k.Maximum,
                    aktiv = r.Regeln[k.Id].Aktiv, wert = r.Regeln[k.Id].Wert, grenze = vorschau[k.Id].Grenze, anzahl = vorschau[k.Id].Anzahl, tabellen = vorschau[k.Id].Tabellen,
                }),
                letzte = ds.Loeschprotokoll(20),
            });
        });
        admin.MapPut("/aufbewahrung", (RegelDaten d, HttpContext c, Datenschutzdienst ds) =>
        {
            var b = Admin(c);
            ds.RegelnSpeichern(d.Regeln ?? new(), b.Login);
            return Results.Json(new { ok = true });
        });
        admin.MapPost("/aufbewahrung/ausfuehren", (AusfuehrenDaten d, HttpContext c, Datenschutzdienst ds) =>
        {
            var b = Admin(c);
            var res = ds.Ausfuehren(b.Login, d.Kategorien is { Count: > 0 } k ? k : null);
            return Results.Json(new { ok = true, ergebnisse = res, anzahl = res.Sum(x => x.Anzahl) });
        });
        admin.MapGet("/loeschprotokoll", (HttpContext c, Datenschutzdienst ds) => { Admin(c); return Results.Json(ds.Loeschprotokoll(500)); });
        admin.MapGet("/sperren", (HttpContext c, Datenschutzdienst ds) => { Admin(c); return Results.Json(ds.Sperren()); });

        admin.MapGet("/auskunft", (int? benutzer, int? schueler, string? format, HttpContext c, Datenschutzdienst ds, Protokoll prot) =>
        {
            var b = Admin(c);
            if (benutzer is null == schueler is null) throw new ArgumentException("Bitte genau eine Person wählen (benutzer oder schueler).");
            var a = benutzer is int bid ? ds.AuskunftBenutzer(bid) : ds.AuskunftSchueler(schueler!.Value);
            var name = benutzer is int x ? $"auskunft-konto-{x}" : $"auskunft-schueler-{schueler}";
            prot.Schreiben(b.Login, "Auskunft erstellt (Art. 15 DSGVO)", benutzer is int y ? $"Konto Nr. {y}" : $"Schüler*in Nr. {schueler}");
            c.Response.Headers.CacheControl = "no-store";
            return format?.ToLowerInvariant() == "pdf"
                ? Results.File(ds.AuskunftPdf(a, b.Anzeigename.Length > 0 ? b.Anzeigename : b.Login), "application/pdf", name + ".pdf")
                : Results.File(JsonSerializer.SerializeToUtf8Bytes(a, Json), "application/json; charset=utf-8", name + ".json");
        });

        // Personensuche für Auskunft und Löschung (Konten und Schüler*innen, auch gesperrte)
        admin.MapGet("/personen", (string? suche, HttpContext c, Benutzerdienst bd, Paketdienst p, Datenschutzdienst ds) =>
        {
            Admin(c);
            var q = (suche ?? "").Trim();
            bool Passt(params string[] t) => q.Length == 0 || t.Any(x => x.Contains(q, StringComparison.OrdinalIgnoreCase));
            var gesperrt = ds.Sperren().Where(x => Convert.ToString(x["art"]) == "schueler").ToDictionary(x => Convert.ToInt32(x["ref_id"]), x => Convert.ToString(x["bis"]) ?? "");
            var aktuell = p.Aktuell?.Schueler ?? new();
            var schueler = aktuell.Select(x => new { x.Id, name = $"{x.Name}, {x.Vorname}".Trim(' ', ','), x.Klasse, gesperrtBis = (string?)null })
                .Concat((p.Aktuell?.Paket.Elemente.Schueler ?? new()).Where(x => gesperrt.ContainsKey(x.Id) && aktuell.All(a => a.Id != x.Id))
                    .Select(x => new { x.Id, name = $"{x.Name}, {x.Vorname}".Trim(' ', ','), x.Klasse, gesperrtBis = (string?)gesperrt[x.Id] }))
                .Where(x => Passt(x.name, x.Klasse, x.Id.ToString())).OrderBy(x => x.name).Take(50);
            var konten = bd.Alle().Where(b => Passt(b.Login, b.Anzeigename, b.Email)).Take(50)
                .Select(b => new { b.Id, b.Login, b.Anzeigename, b.Rolle, rollenname = Rollen.Name(b.Rolle), b.Gesperrt });
            return Results.Json(new { konten, schueler });
        });

        admin.MapGet("/schueler/{id:int}/loeschen", (int id, HttpContext c, Datenschutzdienst ds) => { Admin(c); return Results.Json(ds.SchuelerLoeschplan(id)); });
        admin.MapPost("/schueler/{id:int}/loeschen", (int id, LoeschDaten d, HttpContext c, Datenschutzdienst ds, Protokoll prot) =>
        {
            var b = Admin(c);
            if (!d.Bestaetigt) throw new ArgumentException("Bitte die Löschung ausdrücklich bestätigen.");
            var plan = ds.SchuelerLoeschen(id, b.Login, d.Grund);
            prot.Schreiben(b.Login, plan.Einschraenken ? "Schüler*in gesperrt (Art. 18 DSGVO)" : "Schüler*in gelöscht (Art. 17 DSGVO)", $"Nr. {id}");
            return Results.Json(plan);
        });
        admin.MapPost("/benutzer/{id:int}/anonymisieren", (int id, HttpContext c, Datenschutzdienst ds, Benutzerdienst bd, Protokoll prot) =>
        {
            var b = Admin(c);
            if (id == b.Id) throw new ArgumentException("Das eigene Konto kann nicht anonymisiert werden.");
            if (bd.Holen(id) is { IstAdmin: true } && bd.Alle().Count(x => x.IstAdmin && !x.Gesperrt) <= 1) throw new ArgumentException("Das letzte Administrationskonto kann nicht anonymisiert werden.");
            ds.BenutzerAnonymisieren(id, b.Login);
            prot.Schreiben(b.Login, "Konto anonymisiert (Art. 17 DSGVO)", $"Nr. {id}");
            return Results.Json(new { ok = true });
        });

        admin.MapGet("/hinweise", (HttpContext c, Datenschutzdienst ds) => { Admin(c); return Results.Json(ds.Angaben()); });
        admin.MapPut("/hinweise", (Datenschutzangaben d, HttpContext c, Datenschutzdienst ds) => { var b = Admin(c); return Results.Json(ds.AngabenSpeichern(d, b.Login)); });
    }

    // ------------------------------------------------------------------------------------------ Seite „Datenschutzhinweise“

    /// <summary>HTML maskieren (nur die Sonderzeichen; Umlaute bleiben lesbar, die Seite ist UTF-8).</summary>
    private static string H(string s) => s.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;").Replace("'", "&#39;");

    /// <summary>Angabe oder sichtbarer Platzhalter „[bitte ergänzen: …]“.</summary>
    private static string Wert(string wert, string platzhalter) =>
        wert.Trim().Length > 0 ? H(wert.Trim()).Replace("\n", "<br>") : $"<span class=\"lueck\">[bitte ergänzen: {H(platzhalter)}]</span>";

    private static string Frist(Aufbewahrungskategorie k, Aufbewahrungsregel r) =>
        !r.Aktiv ? "nach Festlegung der Schule" : k.Einheit == "jahre" ? $"{r.Wert} Jahre nach Ablauf des Kalenderjahres, in dem das Schuljahr endete" : $"{r.Wert} Tage";

    private const string Stil = """
            body{font-family:"IBM Plex Sans",system-ui,sans-serif;margin:0;background:#F5F7F8;color:#24363B;line-height:1.55}
            header{background:#164C55;color:#fff;padding:20px 24px}header h1{margin:0;font-size:22px;font-weight:600}header p{margin:4px 0 0;opacity:.85}
            main{max-width:860px;margin:0 auto;padding:16px 24px 48px}section{background:#fff;border:1px solid #d6dee1;border-radius:4px;padding:12px 20px;margin:14px 0}
            h2{font-size:17px;margin:6px 0 8px;color:#164C55}table{border-collapse:collapse;width:100%;font-size:14px}td,th{border-top:1px solid #e3e8ea;padding:6px 8px;text-align:left;vertical-align:top}
            th{background:#eef3f4}.lueck{background:#fff4d6;color:#7a4b00;padding:0 3px}.hinweis{background:#fff4d6;border:1px solid #e9c46a;padding:10px 14px;border-radius:4px}
            a{color:#28747A}small{color:#5b6b70}
            @media (prefers-color-scheme: dark){body{background:#0f1619;color:#e3eaec}section{background:#172126;border-color:#2b3a40}th{background:#1d2b31}td,th{border-color:#2b3a40}h2{color:#7fc4c8}a{color:#7fc4c8}.lueck,.hinweis{background:#3a2f12;color:#f3d58a;border-color:#6b5520}}
            
        """;

    /// <summary>Datenschutzhinweise als eigenständige Seite (ohne Skripte; Farben der Marke).</summary>
    public static string Seite(Datenschutzdienst ds, string schulname)
    {
        var a = ds.Angaben();
        var regeln = ds.Regeln().Regeln;
        var verantwortlich = a.Verantwortlicher.Length > 0 ? a.Verantwortlicher : schulname;
        var sb = new StringBuilder();
        sb.Append($$"""
            <!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Datenschutzhinweise – {{H(verantwortlich.Length > 0 ? verantwortlich : "EduOrga Web")}}</title>
            <style>{{Stil}}</style></head><body>
            <header><h1>Datenschutzhinweise</h1><p>{{H(verantwortlich.Length > 0 ? verantwortlich : "EduOrga Web")}} · Informationen nach Art. 13 und 14 DSGVO</p></header><main>
            """);
        if (!a.Geprueft)
            sb.Append("<p class=\"hinweis\"><strong>Vorlage:</strong> Diese Hinweise sind eine Vorlage von EduOrga und wurden von der Schule noch nicht als geprüft markiert. " +
                      "Gelb hinterlegte Stellen muss die Schule ergänzen (Administration → Verwaltung → Datenschutz).</p>");
        sb.Append($"""
            <section><h2>1. Verantwortlicher</h2><p>{Wert(verantwortlich, "Name der Schule")}<br>{Wert(a.Anschrift, "Anschrift")}</p>
            <p>Vertreten durch: {Wert(a.Vertretung, "Schulleiterin bzw. Schulleiter")}<br>Kontakt: {Wert(a.Kontakt, "E-Mail-Adresse, Telefon")}</p></section>
            <section><h2>2. Datenschutzbeauftragte bzw. Datenschutzbeauftragter</h2><p>{Wert(a.DsbName, "Name der bzw. des behördlichen Datenschutzbeauftragten")}<br>{Wert(a.DsbKontakt, "Kontakt (E-Mail, Telefon, Anschrift)")}</p></section>
            <section><h2>3. Zweck und Rechtsgrundlage</h2>
            <p>EduOrga Web ist das Schulportal der Schule: Stunden- und Vertretungsplan, digitales Klassenbuch (Unterrichtsinhalte, Hausaufgaben, Anwesenheit,
            Fehlzeiten und Entschuldigungen), Abwesenheitsmeldungen, Mitteilungen zwischen Schule und Familien, Elternsprechtag sowie Raum- und Gerätebuchungen.</p>
            <p>Die Schule verarbeitet die Daten zur Erfüllung ihres Bildungs- und Erziehungsauftrags (Art. 6 Abs. 1 Buchst. c und e DSGVO in Verbindung mit
            §§ 120 bis 122 Schulgesetz NRW und der Verordnung über die zur Verarbeitung zugelassenen Daten von Schülerinnen, Schülern und Eltern – VO-DV I – bzw.
            für Lehrkräfte der VO-DV II). Soweit Gesundheitsangaben (z. B. bei Krankmeldungen oder Befreiungen) verarbeitet werden, gilt zusätzlich Art. 9 DSGVO;
            die Einzelheiten <span class="lueck">[von der Schule bzw. dem/der Datenschutzbeauftragten zu prüfen und zu ergänzen]</span>.</p></section>
            <section><h2>4. Welche Daten?</h2><table>
            <tr><th>Personen</th><th>Daten</th></tr>
            <tr><td>Schüler*innen</td><td>Name, Klasse, Kurs- und Gruppenzugehörigkeit; Klassenbuch: Anwesenheit, Fehlzeiten, Verspätungen, Entschuldigungen, Befreiungen, Vermerke,
            Klassendienste, Sitzplatz; Termine am Elternsprechtag; je nach Schule Geburtsdatum, E-Mail-Adresse und Bemerkungen der Klassenleitung</td></tr>
            <tr><td>Eltern / Erziehungsberechtigte</td><td>Name, Benutzerkonto, E-Mail-Adresse (freiwillig), Zuordnung zu den eigenen Kindern, Abwesenheitsmeldungen, Mitteilungen, Sprechtagstermine</td></tr>
            <tr><td>Lehrkräfte und Personal</td><td>Name, Kürzel, Unterricht und Vertretungen, Klassenbucheinträge, Buchungen, Mitteilungen</td></tr>
            <tr><td>alle Konten</td><td>Benutzername, Rolle, Passwort (nur als Hash), Zeitpunkt der Anmeldungen mit IP-Adresse und Gerät (Missbrauchserkennung), Einstellungen</td></tr>
            </table></section>
            <section><h2>5. Wer erhält die Daten?</h2>
            <p>Nur Berechtigte in der Schule nach ihrer Rolle: Eltern und Schüler*innen sehen ausschließlich eigene Daten bzw. die der eigenen Kinder, Lehrkräfte die Daten
            ihres Unterrichts und ihrer Klassen, Klassenleitung und Schulleitung im Rahmen ihrer Aufgaben. Eine Übermittlung an Dritte findet nur statt, wenn eine
            Rechtsvorschrift dies erlaubt (z. B. an die Schulaufsicht).</p>
            <p>Betrieb und Wartung des Servers: {Wert(a.Betreiber, "Schulträger bzw. IT-Dienstleister als Auftragsverarbeiter nach Art. 28 DSGVO")}</p>
            <p>EduOrga lädt keine Inhalte von fremden Servern (keine externen Schriften, Skripte, Karten, Videos oder Analysewerkzeuge) und setzt kein Tracking ein.
            Sofort-Benachrichtigungen der Apps laufen über den Benachrichtigungsdienst des Geräteherstellers (Apple, Google, Mozilla); sie enthalten standardmäßig nur einen allgemeinen
            Hinweis (z. B. „Änderung im Stundenplan“), Inhalte werden in der App angezeigt.</p></section>
            <section><h2>6. Wie lange werden Daten gespeichert?</h2><table><tr><th>Daten</th><th>Löschung</th></tr>
            """);
        foreach (var k in Datenschutzdienst.Kategorien)
            sb.Append($"<tr><td>{H(k.Name)}<br><small>{H(k.Beschreibung)}</small></td><td>{H(Frist(k, regeln[k.Id]))}</td></tr>");
        sb.Append("""
            </table><p>Die Fristen für Schülerdaten richten sich nach § 9 VO-DV I. Läuft eine Aufbewahrungsfrist noch, werden Daten auf Verlangen gesperrt statt gelöscht
            (Einschränkung der Verarbeitung) und nach Fristablauf gelöscht. Sicherungskopien werden nach dem Sicherungszeitraum des Servers überschrieben.</p></section>
            <section><h2>7. Cookies und Speicher auf dem Gerät</h2><p>Technisch notwendig und ohne Einwilligung zulässig (§ 25 Abs. 2 TDDDG): das Anmeldecookie
            <code>untplanweb</code> (Sitzung), das Gerätecookie für „Konto wechseln“ sowie Einstellungen der Oberfläche im Speicher des Browsers (z. B. Hell/Dunkel).
            Die App EduOrga Mobile speichert zusätzlich den zuletzt geladenen Stundenplan für die Nutzung ohne Netz; beim Abmelden wird er gelöscht.</p></section>
            <section><h2>8. Ihre Rechte</h2><p>Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung
            (Art. 18) und Widerspruch (Art. 21 DSGVO). Wenden Sie sich dazu an die Schule oder die bzw. den Datenschutzbeauftragten. Sie haben außerdem das Recht,
            sich bei der Aufsichtsbehörde zu beschweren (Art. 77 DSGVO):
            """);
        sb.Append(Wert(a.Aufsichtsbehoerde.Length > 0 ? a.Aufsichtsbehoerde : "Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen (LDI NRW), www.ldi.nrw.de", ""));
        sb.Append(".</p></section>");
        if (a.Zusatz.Trim().Length > 0) sb.Append($"<section><h2>9. Weitere Hinweise der Schule</h2><p>{H(a.Zusatz.Trim()).Replace("\n", "<br>")}</p></section>");
        sb.Append($"<p><small>Stand: {H(a.Stand.Length > 0 ? a.Stand : "Vorlage")}. Software: EduOrga Web.</small></p></main></body></html>");
        return sb.ToString();
    }
}
