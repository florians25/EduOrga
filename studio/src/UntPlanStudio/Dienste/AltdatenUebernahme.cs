using System.Text.Json;
using System.Text.Json.Nodes;
using UntPlan.Core;
using UntPlanStudio.Grundlagen;

namespace UntPlanStudio.Dienste;

/// <summary>
/// Übernahme einer bestehenden Installation (Ablage in Dateien, bis zur Einführung von <c>studio.db</c>): Beim ersten Start mit leerer
/// Datenbank werden <c>benutzer.json</c>, <c>benutzer/*.json</c>, <c>multiuser.json</c>, <c>untplanweb/*.json</c> und
/// <c>dokumente/*.up</c> (+ <c>*.json</c>, <c>*.up.bak</c>) in einer Transaktion importiert und danach nach
/// <c>&lt;Datenordner&gt;/alt-dateien-&lt;datum&gt;/</c> verschoben (nicht gelöscht). Die Cookie-Schlüssel (<c>schluessel/</c>) bleiben Dateien.
/// </summary>
public static class AltdatenUebernahme
{
    public const string BenutzerDatei = "benutzer.json";
    public const string MultiUserDatei = "multiuser.json";
    public const string UntPlanWebOrdner = "untplanweb";

    /// <summary>Führt die Übernahme aus, wenn die Datenbank leer ist und alte Dateien vorhanden sind. Liefert den Ordner mit den verschobenen Dateien.</summary>
    public static string? Ausfuehren(StudioDatenbank db, StudioKonfiguration k, ILogger log)
    {
        var daten = k.Datenordner;
        var kandidaten = new[] { Path.Combine(daten, BenutzerDatei), Path.Combine(daten, MultiUserDatei), k.Benutzerordner, Path.Combine(daten, UntPlanWebOrdner), k.Dokumentordner }
            .Where(p => File.Exists(p) || Directory.Exists(p)).ToList();
        if (kandidaten.Count == 0 || !db.IstLeer) return null;

        int benutzer = 0, einstellungen = 0, abgleich = 0, dokumente = 0, sicherungen = 0;
        var multiuser = false;
        var uebersprungen = new List<string>();
        db.Schreiben((c, t) =>
        {
            // Benutzer (ohne gültige benutzer.json legt der Benutzerdienst wie bisher das Admin-Konto an)
            var datei = Path.Combine(daten, BenutzerDatei);
            if (File.Exists(datei))
            {
                var liste = JsonNode.Parse(File.ReadAllText(datei)) as JsonArray ?? throw new InvalidDataException($"{datei}: keine Benutzerliste.");
                foreach (var b in liste.OfType<JsonObject>())
                {
                    var name = b["Name"]?.GetValue<string>();
                    if (string.IsNullOrWhiteSpace(name)) continue;
                    StudioDatenbank.AblageSchreiben(c, t, Ablagebereiche.Benutzer, name.ToLowerInvariant(), b.ToJsonString());
                    benutzer++;
                }
            }

            // Einstellungen je Benutzer: benutzer/<name>.json (Name URL-codiert, Kleinbuchstaben)
            if (Directory.Exists(k.Benutzerordner))
                foreach (var d in Directory.EnumerateFiles(k.Benutzerordner, "*.json"))
                {
                    if (JsonLesen(d, uebersprungen, log) is not JsonObject o) continue;
                    var name = Uri.UnescapeDataString(Path.GetFileNameWithoutExtension(d)).ToLowerInvariant();
                    StudioDatenbank.AblageSchreiben(c, t, Ablagebereiche.Einstellungen, name, o.ToJsonString());
                    einstellungen++;
                }

            datei = Path.Combine(daten, MultiUserDatei);
            if (File.Exists(datei) && JsonLesen(datei, uebersprungen, log) is JsonObject mu)
            {
                StudioDatenbank.AblageSchreiben(c, t, Ablagebereiche.MultiUser, MultiUserDienst.Konfigurationsschluessel, mu.ToJsonString());
                multiuser = true;
            }

            var ordner = Path.Combine(daten, UntPlanWebOrdner);
            if (Directory.Exists(ordner))
                foreach (var d in Directory.EnumerateFiles(ordner, "*.json"))
                {
                    var id = Path.GetFileNameWithoutExtension(d);
                    if (!Dokumentdienst.IdGueltig(id) || JsonLesen(d, uebersprungen, log) is not JsonObject o) continue;
                    StudioDatenbank.AblageSchreiben(c, t, Ablagebereiche.UntPlanWeb, id, o.ToJsonString());
                    abgleich++;
                }

            // Dokumente: <id>.up (Inhalt unverändert) + <id>.json (Beschreibung) + <id>.up.bak (vorige Fassung)
            if (Directory.Exists(k.Dokumentordner))
                foreach (var up in Directory.EnumerateFiles(k.Dokumentordner, "*" + Dokument.Dateiendung))
                {
                    var id = Path.GetFileNameWithoutExtension(up);
                    if (!Dokumentdienst.IdGueltig(id)) continue;
                    var inhalt = File.ReadAllBytes(up);
                    try { Dokument.DatenLesen(inhalt); }
                    catch (Exception ex) when (ex is JsonException or InvalidDataException)
                    {
                        log.LogWarning("Übernahme: {Datei} ist keine lesbare Schuldatei und wird nicht übernommen ({Fehler})", up, ex.Message);
                        uebersprungen.Add(up);
                        continue;
                    }
                    var gespeichert = File.GetLastWriteTime(up);
                    DokumentInfo? info = null;
                    var infoDatei = Path.Combine(k.Dokumentordner, id + ".json");
                    if (File.Exists(infoDatei))
                        try { info = JsonSerializer.Deserialize<DokumentInfo>(File.ReadAllText(infoDatei)); }
                        catch (JsonException) { uebersprungen.Add(infoDatei); }
                    info ??= new DokumentInfo { Name = id, Erstellt = gespeichert, Geaendert = gespeichert };
                    info.Id = id;
                    StudioDatenbank.DokumentAnlegen(c, t, info, inhalt, gespeichert);
                    dokumente++;
                    var bak = up + ".bak";
                    if (File.Exists(bak))
                    {
                        StudioDatenbank.DokumentSicherungEinfuegen(c, t, id, File.GetLastWriteTime(bak), File.ReadAllBytes(bak));
                        sicherungen++;
                    }
                }
        });

        // alte Dateien aufheben (nicht löschen)
        var ziel = Path.Combine(daten, $"alt-dateien-{DateTime.Now:yyyy-MM-dd}");
        if (File.Exists(ziel) || Directory.Exists(ziel)) ziel += $"-{DateTime.Now:HHmmss}";
        try
        {
            Directory.CreateDirectory(ziel);
            foreach (var p in kandidaten)
            {
                var neu = Path.Combine(ziel, Path.GetFileName(p));
                if (File.Exists(p)) File.Move(p, neu);
                else Directory.Move(p, neu);
            }
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            log.LogWarning(ex, "Übernahme: die alten Dateien konnten nicht nach {Ordner} verschoben werden (sie werden nicht mehr verwendet)", ziel);
        }
        log.LogInformation("Dateien der bisherigen Ablage in die Datenbank {Datenbank} übernommen: {Dokumente} Dokumente ({Sicherungen} Sicherungsstände), {Benutzer} Benutzer, "
            + "{Einstellungen} Benutzereinstellungen, MultiUser-Konfiguration: {MultiUser}, {Abgleich} UntPlan-Web-Abgleiche. Die alten Dateien liegen in {Ordner}{Hinweis}.",
            db.Pfad, dokumente, sicherungen, benutzer, einstellungen, multiuser ? "ja" : "nein", abgleich, ziel,
            uebersprungen.Count > 0 ? $" (nicht übernommen: {string.Join(", ", uebersprungen.Select(Path.GetFileName))})" : "");
        return ziel;
    }

    private static JsonNode? JsonLesen(string datei, List<string> uebersprungen, ILogger log)
    {
        try { return JsonNode.Parse(File.ReadAllText(datei)); }
        catch (JsonException ex)
        {
            log.LogWarning("Übernahme: {Datei} ist kein gültiges JSON und wird nicht übernommen ({Fehler})", datei, ex.Message);
            uebersprungen.Add(datei);
            return null;
        }
    }
}
