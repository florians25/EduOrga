namespace EduOrgaWebsite.Daten;

/// <summary>Art einer Einreichung.</summary>
public static class Typen
{
    public const string Idee = "idee", Wunsch = "wunsch", Fehler = "fehler";
    public static readonly string[] Alle = [Idee, Wunsch, Fehler];
}

/// <summary>Produktbereiche, auf die sich eine Einreichung beziehen kann.</summary>
public static class Module
{
    public static readonly string[] Alle = ["studio", "web", "mobile", "ios", "installation", "website", "allgemein"];
}

public static class Prioritaeten
{
    public const string Keine = "keine";
    public static readonly string[] Alle = [Keine, "niedrig", "mittel", "hoch", "kritisch"];
}

/// <summary>
/// Bearbeitungsstand und erlaubte Übergänge:
/// Eingereicht → In Prüfung → Abgelehnt (mit Begründung) oder Im Backlog → In Arbeit → Erledigt.
/// Rückwege (wieder prüfen, zurück ins Backlog, wieder öffnen) sind erlaubt; Abkürzungen über mehrere Stufen nicht.
/// </summary>
public static class Status
{
    public const string Eingereicht = "eingereicht", InPruefung = "in_pruefung", Abgelehnt = "abgelehnt",
        Backlog = "backlog", InArbeit = "in_arbeit", Erledigt = "erledigt";

    public static readonly string[] Alle = [Eingereicht, InPruefung, Abgelehnt, Backlog, InArbeit, Erledigt];

    /// <summary>Stände, die in der öffentlichen Liste erscheinen (angenommen bzw. geplant).</summary>
    public static readonly string[] Oeffentlich = [Backlog, InArbeit, Erledigt];

    private static readonly Dictionary<string, string[]> Uebergaenge = new()
    {
        [Eingereicht] = [InPruefung],
        [InPruefung] = [Eingereicht, Abgelehnt, Backlog],
        [Abgelehnt] = [InPruefung],
        [Backlog] = [InPruefung, InArbeit],
        [InArbeit] = [Backlog, Erledigt],
        [Erledigt] = [InArbeit],
    };

    public static IReadOnlyList<string> Nachfolger(string von) => Uebergaenge.TryGetValue(von, out var n) ? n : [];

    public static bool Erlaubt(string von, string nach) => von == nach || Nachfolger(von).Contains(nach);

    public static string Bezeichnung(string s) => s switch
    {
        Eingereicht => "Eingereicht",
        InPruefung => "In Prüfung",
        Abgelehnt => "Abgelehnt",
        Backlog => "Im Backlog",
        InArbeit => "In Arbeit",
        Erledigt => "Erledigt",
        _ => s,
    };
}

public sealed class Eintrag
{
    public long Id { get; set; }
    public string Typ { get; set; } = Typen.Idee;
    public string Titel { get; set; } = "";
    public string Beschreibung { get; set; } = "";
    public string Modul { get; set; } = "allgemein";
    public string? Email { get; set; }
    public string Status { get; set; } = Daten.Status.Eingereicht;
    public string Prioritaet { get; set; } = Prioritaeten.Keine;
    public List<string> Tags { get; set; } = [];
    public double Position { get; set; }
    public string InterneNotiz { get; set; } = "";
    public string OeffentlicheAntwort { get; set; } = "";
    public string Ablehnungsgrund { get; set; } = "";
    /// <summary>In der öffentlichen Liste zeigen (sofern der Stand öffentlich ist).</summary>
    public bool Oeffentlich { get; set; } = true;
    public DateTimeOffset ErstelltAm { get; set; }
    public DateTimeOffset GeaendertAm { get; set; }
}

public sealed record Verlaufseintrag(long Id, long EintragId, DateTimeOffset Zeit, string Benutzer, string Aktion, string Details);
