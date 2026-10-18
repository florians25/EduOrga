using System.Text.Json;
using System.Text.Json.Nodes;
using UntPlanStudio.Grundlagen;

namespace UntPlanStudio.Dienste;

/// <summary>
/// Einstellungen je Benutzer (z. B. Fensteranordnungen, Tabellenspalten, zuletzt verwendete Dokumente) als JSON-Werte
/// unter frei wählbaren Schlüsseln. Ablage in der Datenbank (<see cref="Ablagebereiche.Einstellungen"/>, ein JSON-Objekt je Benutzer).
/// Module verwenden Schlüssel mit eigenem Präfix, z. B. <c>vertretung.ansicht</c>.
/// </summary>
public sealed class Benutzereinstellungen
{
    public const string SchluesselZuletzt = "zuletzt";
    private readonly StudioDatenbank _db;
    private readonly object _sperre = new();

    public Benutzereinstellungen(StudioDatenbank db) => _db = db;

    public static bool SchluesselGueltig(string s) => s.Length is > 0 and <= 80 && s.All(c => char.IsLetterOrDigit(c) || c is '.' or '-' or '_');

    private static string Schluessel(string benutzer) => benutzer.ToLowerInvariant();

    private JsonObject Laden(string benutzer)
    {
        var inhalt = _db.AblageLesen(Ablagebereiche.Einstellungen, Schluessel(benutzer));
        if (inhalt is null) return new JsonObject();
        try { return JsonNode.Parse(inhalt) as JsonObject ?? new JsonObject(); }
        catch (JsonException) { return new JsonObject(); }
    }

    public JsonNode? Lesen(string benutzer, string schluessel)
    {
        lock (_sperre) return Laden(benutzer)[schluessel]?.DeepClone();
    }

    public void Schreiben(string benutzer, string schluessel, JsonNode? wert)
    {
        if (!SchluesselGueltig(schluessel)) throw StudioFehler.Ungueltig("Ungültiger Schlüssel.");
        lock (_sperre)
        {
            var alle = Laden(benutzer);
            if (wert is null) alle.Remove(schluessel);
            else alle[schluessel] = wert.DeepClone();
            _db.AblageSchreiben(Ablagebereiche.Einstellungen, Schluessel(benutzer), alle.ToJsonString());
        }
    }

    /// <summary>Zuletzt verwendete Dokumente (Ids, neueste zuerst, höchstens 12).</summary>
    public List<string> Zuletzt(string benutzer) =>
        (Lesen(benutzer, SchluesselZuletzt) as JsonArray)?.Select(n => n?.GetValue<string>()).OfType<string>().ToList() ?? new();

    public void ZuletztMerken(string benutzer, string dokumentId)
    {
        var l = Zuletzt(benutzer);
        l.Remove(dokumentId);
        l.Insert(0, dokumentId);
        Schreiben(benutzer, SchluesselZuletzt, new JsonArray(l.Take(12).Select(x => (JsonNode)JsonValue.Create(x)!).ToArray()));
    }
}
