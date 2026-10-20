using System.Text.Json;
using UntPlanWeb.Daten;

namespace UntPlanWeb.Dienste;

/// <summary>
/// Darstellung der Stundenkarten (Administration | Darstellung der Stundenkarten): schulweit gültig für Wochenraster, Tagesansicht,
/// Tagesseiten, Startseite und Stundendetails. Gespeichert als JSON in der Tabelle einstellungen (Schlüssel
/// <see cref="Kartendarstellungen.Schluessel"/>); fehlende Angaben erhalten ihren Standard. Standard ist die Vorlage „EduOrga Standard“
/// (design/DESIGN.md, Abschnitt 10, gleich auf allen Plattformen): kompakte helle Karten mit flachem Schatten auf hellgrauem Raster,
/// 4-px-Kante links (grau, mit Fachfarbe in der Fachfarbe samt leichter Tönung), je eine Zeile Fach · Klasse · Lehrkraft · Raum,
/// Radius 4 px, Änderungen grün und Prüfungen bernstein in der hellen Statusfläche, Entfall rot. Die Statusdarstellung (Linie, Schraffur,
/// Durchstreichung, Kürzel-Plaketten) bleibt in jeder Variante erhalten; optional stehen zusätzlich die Statuswörter auf den Kacheln.
/// </summary>
public sealed record Kartendarstellung
{
    /// <summary>Fachfarbe: balken-innen (Streifen innen links, grau ohne Fachfarbe) | balken-flaeche (Balken links und Tönung) | balken-links |
    /// balken-oben | quadrat | flaeche | keine.</summary>
    public string Fachfarbe { get; init; } = "balken-flaeche";
    /// <summary>Breite des Fachfarbbalkens in px (2–6).</summary>
    public int Balkenbreite { get; init; } = 4;
    /// <summary>Deckkraft der Fachfarb-Tönung in Prozent (6–30), bei <see cref="Fachfarbe"/> = flaeche bzw. balken-flaeche.</summary>
    public int Deckkraft { get; init; } = 12;
    /// <summary>Kartenfläche: neutral (#f6f8fa) | weiss | getoent (leichte Marine-Tönung).</summary>
    public string Flaeche { get; init; } = "weiss";
    /// <summary>Rahmen: schatten (keine Linie, leicht abgehoben) | fein | kraeftig | keiner.</summary>
    public string Rahmen { get; init; } = "schatten";
    /// <summary>Eckenradius in px (0–8).</summary>
    public int Eckenradius { get; init; } = 4;
    /// <summary>Dichte: kompakt | normal | grosszuegig (Innenabstand, Schriftgrößen).</summary>
    public string Dichte { get; init; } = "kompakt";
    /// <summary>Zeile 1: Fach als kuerzel | name.</summary>
    public string Fach { get; init; } = "kuerzel";
    /// <summary>Raum rechts in Zeile 1 anzeigen.</summary>
    public bool Raum { get; init; } = true;
    /// <summary>Zeile 2 (Lehrkraft bzw. Klasse) anzeigen.</summary>
    public bool Zeile2 { get; init; } = true;
    /// <summary>Zeile 2 als kuerzel | name.</summary>
    public string Zeile2Text { get; init; } = "kuerzel";
    /// <summary>Unveränderte Kürzel als Plakette: gefuellt | umrandet | text.</summary>
    public string Kuerzel { get; init; } = "text";
    /// <summary>Statuswörter (Entfall, Offen, Vertreten …) zusätzlich auf den Kacheln anzeigen.</summary>
    public bool Statuswoerter { get; init; }
    /// <summary>Geänderte Stunden und Prüfungen zusätzlich in der hellen Statusfläche (Änderung grün, Prüfung bernstein).</summary>
    public bool Statusflaeche { get; init; } = true;
    /// <summary>Zeilenfolge: zeilen (Fach · Klasse · Lehrkraft · Raum je eine Zeile) | element (Lehrkraft bzw. Klasse · Fach · Raum
    /// untereinander) | fach (Fach und Raum oben, darunter Lehrkraft/Klasse).</summary>
    public string Reihenfolge { get; init; } = "zeilen";
    /// <summary>Fläche des Stundenrasters: grau | weiss.</summary>
    public string Raster { get; init; } = "grau";
}

/// <summary>Laden, Prüfen und Speichern der <see cref="Kartendarstellung"/>.</summary>
public static class Kartendarstellungen
{
    public const string Schluessel = "einstellung:kartendarstellung";
    public static readonly string[] Fachfarben = { "balken-innen", "balken-flaeche", "balken-links", "balken-oben", "quadrat", "flaeche", "keine" };
    public static readonly string[] Flaechen = { "neutral", "weiss", "getoent" };
    public static readonly string[] Rahmenarten = { "schatten", "fein", "kraeftig", "keiner" };
    public static readonly string[] Reihenfolgen = { "zeilen", "element", "fach" };
    public static readonly string[] Rasterarten = { "grau", "weiss" };
    public static readonly string[] Dichten = { "kompakt", "normal", "grosszuegig" };
    public static readonly string[] Texte = { "kuerzel", "name" };
    public static readonly string[] Kuerzelstile = { "gefuellt", "umrandet", "text" };
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    /// <summary>Gespeicherte Darstellung; fehlende Felder erhalten ihren Standard, ungültige Angaben ergeben den Standard insgesamt.</summary>
    public static Kartendarstellung Laden(Db db)
    {
        var json = new Einstellungen(db).Lesen(Schluessel);
        if (string.IsNullOrEmpty(json)) return new Kartendarstellung();
        try { return Pruefen(JsonSerializer.Deserialize<Kartendarstellung>(json, Json) ?? new Kartendarstellung()); }
        catch (Exception e) when (e is JsonException or ArgumentException) { return new Kartendarstellung(); }
    }

    public static Kartendarstellung Speichern(Db db, Kartendarstellung d)
    {
        var p = Pruefen(d);
        new Einstellungen(db).Schreiben(Schluessel, JsonSerializer.Serialize(p, Json));
        return p;
    }

    /// <summary>Zurück zum Standard (gespeicherter Wert wird entfernt).</summary>
    public static Kartendarstellung Zuruecksetzen(Db db)
    {
        db.Ausfuehren("DELETE FROM einstellungen WHERE schluessel = @s", Db.P("@s", Schluessel));
        return new Kartendarstellung();
    }

    private static string Wahl(string? wert, string feld, string[] erlaubt) =>
        erlaubt.Contains(wert ?? "") ? wert! : throw new ArgumentException($"Ungültiger Wert bei „{feld}“: erlaubt sind {string.Join(", ", erlaubt)}.");

    private static int Bereich(int wert, int min, int max, string feld) =>
        wert >= min && wert <= max ? wert : throw new ArgumentException($"„{feld}“ muss zwischen {min} und {max} liegen.");

    /// <summary>Prüft alle Angaben (ArgumentException bei ungültigen Werten).</summary>
    public static Kartendarstellung Pruefen(Kartendarstellung d) => d with
    {
        Fachfarbe = Wahl(d.Fachfarbe, "Fachfarbe", Fachfarben),
        Balkenbreite = Bereich(d.Balkenbreite, 2, 6, "Balkenbreite"),
        Deckkraft = Bereich(d.Deckkraft, 6, 30, "Deckkraft der Fachfarbe"),
        Flaeche = Wahl(d.Flaeche, "Kartenfläche", Flaechen),
        Rahmen = Wahl(d.Rahmen, "Rahmen", Rahmenarten),
        Eckenradius = Bereich(d.Eckenradius, 0, 8, "Eckenradius"),
        Dichte = Wahl(d.Dichte, "Dichte", Dichten),
        Fach = Wahl(d.Fach, "Fach", Texte),
        Zeile2Text = Wahl(d.Zeile2Text, "Zeile 2", Texte),
        Kuerzel = Wahl(d.Kuerzel, "Kürzel", Kuerzelstile),
        Reihenfolge = Wahl(d.Reihenfolge, "Reihenfolge", Reihenfolgen),
        Raster = Wahl(d.Raster, "Raster", Rasterarten),
    };
}
