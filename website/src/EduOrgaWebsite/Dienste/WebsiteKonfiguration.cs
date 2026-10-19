namespace EduOrgaWebsite.Dienste;

/// <summary>
/// Einstellungen der Website, gelesen aus Umgebungsvariablen (bzw. appsettings.json). Alle Schlüssel beginnen mit WEBSITE_.
/// </summary>
public sealed class WebsiteKonfiguration
{
    /// <summary>Datenordner (Datenbank, Schlüssel, Sicherungen). Im Container /data.</summary>
    public required string Datenordner { get; init; }
    public string Datenbankpfad => Path.Combine(Datenordner, "website.db");
    public string Sicherungsordner => Path.Combine(Datenordner, "sicherungen");
    public string Schluesselordner => Path.Combine(Datenordner, "schluessel");

    /// <summary>Name des Administrators, der beim ersten Start angelegt wird.</summary>
    public string AdminBenutzer { get; init; } = "admin";
    /// <summary>Passwort für den ersten Start (leer = zufällig, wird im Protokoll ausgegeben).</summary>
    public string AdminPasswort { get; init; } = "";
    /// <summary>Cookie nur über HTTPS senden (hinter Caddy: 1).</summary>
    public bool SichereCookies { get; init; }
    /// <summary>X-Forwarded-For/-Proto eines vorgeschalteten Reverse-Proxys auswerten (Caddy im Compose-Netz).</summary>
    public bool HinterProxy { get; init; }

    /// <summary>Höchstzahl an Einreichungen je Absender (IP-Adresse) und Zeitfenster.</summary>
    public int EinreichungenJeFenster { get; init; } = 5;
    public TimeSpan EinreichungsFenster { get; init; } = TimeSpan.FromHours(1);
    /// <summary>Mindestzeit zwischen Laden des Formulars und Absenden (Schutz gegen Automaten); 0 = aus.</summary>
    public TimeSpan Mindestbearbeitungszeit { get; init; } = TimeSpan.FromSeconds(3);
    /// <summary>E-Mail-Adressen abgeschlossener Einträge (erledigt/abgelehnt) nach so vielen Tagen löschen.</summary>
    public int EmailAufbewahrungTage { get; init; } = 180;

    /// <summary>Angaben für Impressum und Datenschutz; leer = Platzhalter auf der Website.</summary>
    public string BetreiberName { get; init; } = "";
    public string BetreiberAnschrift { get; init; } = "";
    public string BetreiberEmail { get; init; } = "";

    public int SicherungenBehalten { get; init; } = 14;

    public static WebsiteKonfiguration Laden(IConfiguration c, string inhaltsordner)
    {
        string Text(string schluessel, string standard = "") => (c[schluessel] ?? standard).Trim();
        int Zahl(string schluessel, int standard) => int.TryParse(c[schluessel], out var z) ? z : standard;
        bool Schalter(string schluessel) => Text(schluessel) is "1" or "true" or "ja" or "yes";

        var daten = Text("WEBSITE_DATEN");
        if (daten.Length == 0) daten = Path.Combine(inhaltsordner, "daten");
        return new WebsiteKonfiguration
        {
            Datenordner = Path.GetFullPath(daten),
            AdminBenutzer = Text("WEBSITE_ADMIN_BENUTZER", "admin") is { Length: > 0 } b ? b : "admin",
            AdminPasswort = c["WEBSITE_ADMIN_PASSWORT"] ?? "",
            SichereCookies = Schalter("WEBSITE_SICHERE_COOKIES"),
            HinterProxy = Schalter("WEBSITE_HINTER_PROXY"),
            EinreichungenJeFenster = Math.Max(1, Zahl("WEBSITE_EINREICHUNGEN_JE_STUNDE", 5)),
            Mindestbearbeitungszeit = TimeSpan.FromSeconds(Math.Max(0, Zahl("WEBSITE_MINDESTZEIT_SEKUNDEN", 3))),
            EmailAufbewahrungTage = Math.Max(1, Zahl("WEBSITE_EMAIL_AUFBEWAHRUNG_TAGE", 180)),
            BetreiberName = Text("WEBSITE_BETREIBER_NAME"),
            BetreiberAnschrift = Text("WEBSITE_BETREIBER_ANSCHRIFT"),
            BetreiberEmail = Text("WEBSITE_BETREIBER_EMAIL"),
            SicherungenBehalten = Math.Max(1, Zahl("WEBSITE_SICHERUNGEN_BEHALTEN", 14)),
        };
    }
}
