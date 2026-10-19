namespace EduOrgaWebsite.Dienste;

/// <summary>
/// Einstellungen der Website, gelesen aus Umgebungsvariablen (bzw. appsettings.json). Alle Schlüssel beginnen mit WEBSITE_.
/// </summary>
public sealed class WebsiteKonfiguration
{
    /// <summary>Angaben für Impressum und Datenschutz; leer = Platzhalter auf der Website.</summary>
    public string BetreiberName { get; init; } = "";
    public string BetreiberAnschrift { get; init; } = "";
    public string BetreiberEmail { get; init; } = "";

    public static WebsiteKonfiguration Laden(IConfiguration c)
    {
        string Text(string schluessel) => (c[schluessel] ?? "").Trim();
        return new WebsiteKonfiguration
        {
            BetreiberName = Text("WEBSITE_BETREIBER_NAME"),
            BetreiberAnschrift = Text("WEBSITE_BETREIBER_ANSCHRIFT"),
            BetreiberEmail = Text("WEBSITE_BETREIBER_EMAIL"),
        };
    }
}
