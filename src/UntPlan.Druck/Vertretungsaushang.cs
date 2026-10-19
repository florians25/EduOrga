namespace UntPlan.Druck;

/// <summary>Spalte des Vertretungsplan-Aushangs.</summary>
public sealed record Aushangspalte(string Schluessel, string Titel, float Anteil = 0, Ausrichtung? Ausrichtung = null);

/// <summary>Zeile des Aushangs: Gruppe (z. B. Klasse), Werte je Spaltenschlüssel, Entfall, durchgestrichene Spalten.</summary>
public sealed class Aushangzeile
{
    public string Gruppe { get; set; } = "";
    public Dictionary<string, string> Werte { get; } = new();
    /// <summary>Stunde entfällt: in der Spalte <see cref="Aushangoptionen.EntfallSpalte"/> steht halbfett „entfällt“.</summary>
    public bool Entfall { get; set; }
    /// <summary>Durchgestrichene Spalten (z. B. die abwesende Lehrkraft bei Entfall).</summary>
    public HashSet<string> Gestrichen { get; } = new();
    /// <summary>Halbfette Spalten (Neues bei Änderungen).</summary>
    public HashSet<string> Fett { get; } = new();

    public string this[string schluessel]
    {
        get => Werte.GetValueOrDefault(schluessel, "");
        set => Werte[schluessel] = value;
    }
}

/// <summary>Ein Tag des Aushangs.</summary>
public sealed class Aushangtag
{
    public DateOnly Datum { get; set; }
    /// <summary>Zusatz zum Tag, z. B. „A-Woche“.</summary>
    public string Zusatz { get; set; } = "";
    public List<string> Nachrichten { get; } = new();
    /// <summary>Kurzangaben über der Tabelle (Abwesende Klassen, Blockierte Räume …).</summary>
    public List<(string Titel, string Text)> Angaben { get; } = new();
    public List<Aushangzeile> Zeilen { get; } = new();
    /// <summary>Unterrichtsfrei (Ferien, Feiertag): Text statt Tabelle.</summary>
    public string? Frei { get; set; }
}

/// <summary>Einstellungen des Aushangs.</summary>
public sealed class Aushangoptionen
{
    /// <summary>„Vertretungsplan Klassen“ bzw. „Vertretungsplan Lehrkräfte“.</summary>
    public string Titel { get; set; } = "Vertretungsplan";
    /// <summary>Grundschrift der Tabelle (Aushang am Schwarzen Brett: 12–16 pt).</summary>
    public float Schriftgroesse { get; set; } = 9;
    public bool Quer { get; set; }
    /// <summary>Senkrechte Tabellenlinien.</summary>
    public bool Raster { get; set; }
    /// <summary>Gruppenkopf (z. B. „7a“) als eigene Zeile über die ganze Breite.</summary>
    public bool Gruppenkopf { get; set; } = true;
    /// <summary>Jede Gruppe auf einer eigenen Seite.</summary>
    public bool EineSeiteJeGruppe { get; set; }
    /// <summary>Spalte mit dem Gruppenwert (ohne Gruppenkopf nur in der ersten Zeile der Gruppe gefüllt, halbfett).</summary>
    public string GruppenSpalte { get; set; } = "";
    /// <summary>Gruppenwert auf jeder Seite in der ersten Zeile wiederholen.</summary>
    public bool GruppeJedeSeite { get; set; } = true;
    /// <summary>Spalte, in der bei Entfall „entfällt“ steht (z. B. Vertretung).</summary>
    public string EntfallSpalte { get; set; } = "";
    /// <summary>Spalte der Art (bei Entfall halbfett).</summary>
    public string ArtSpalte { get; set; } = "";
    public string LeerText { get; set; } = "Keine Vertretungen.";
    /// <summary>Wechselzeilen hellgrau.</summary>
    public bool Wechselzeilen { get; set; }
}

/// <summary>
/// Vertretungsplan als Aushang (gemeinsam für Studio und Web): je Tag eine neue Seite mit Titel „Vertretungsplan … – Montag,
/// 19. Oktober 2026“, Mitteilungen im Kasten, Kurzangaben (abwesende Klassen …), Tabelle gruppiert (z. B. nach Klasse) mit den
/// gewählten Spalten. Entfall: halbfett „entfällt“, die Lehrkraft durchgestrichen. Große Schrift für das Schwarze Brett möglich.
/// </summary>
public static class Vertretungsaushang
{
    private static readonly string[] Wochentage = { "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag" };
    private static readonly string[] Monate = { "Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember" };

    /// <summary>„Montag, 19. Oktober 2026“.</summary>
    public static string DatumLang(DateOnly d) => $"{Wochentage[((int)d.DayOfWeek + 6) % 7]}, {d.Day}. {Monate[d.Month - 1]} {d.Year}";

    public static byte[] Erzeugen(Kopfdaten kopf, IReadOnlyList<Aushangtag> tage, IReadOnlyList<Aushangspalte> spalten, Aushangoptionen o)
    {
        // mit Gruppenkopf steht der Gruppenwert (z. B. die Klasse) schon über den Zeilen – die Spalte entfällt
        if (o.Gruppenkopf && o.GruppenSpalte.Length > 0 && spalten.Count > 1 && tage.All(t => t.Zeilen.All(z => z[o.GruppenSpalte] == z.Gruppe)))
            spalten = spalten.Where(sp => sp.Schluessel != o.GruppenSpalte).ToList();
        var f = new Formular(kopf, o.Quer);
        var g = Math.Clamp(o.Schriftgroesse, 6, 24);
        if (g >= 11) f.Titelgroesse = Math.Min(30, g + 9);
        if (tage.Count == 0)
        {
            f.NeueSeite(o.Titel, kopf.Untertitel);
            f.Absatz("Im gewählten Zeitraum gibt es keinen Unterrichtstag.", Math.Max(9, g));
            return f.Erzeugen();
        }
        foreach (var tag in tage)
        {
            // Titel ist der Tag (am Schwarzen Brett das Wichtigste), darunter Art des Plans und Stand
            f.NeueSeite(DatumLang(tag.Datum), string.Join(" · ", new[] { o.Titel, tag.Zusatz, $"Stand {kopf.Druckzeit:dd.MM.yyyy, HH:mm} Uhr" }.Where(x => x.Length > 0)));
            var gText = Math.Max(Formular.GroesseText, g);
            if (tag.Frei is { Length: > 0 } frei)
            {
                f.Kasten(null, $"Unterrichtsfrei: {frei}", gText + 1);
                continue;
            }
            if (tag.Nachrichten.Count > 0) f.Kasten("Mitteilungen", string.Join("\n", tag.Nachrichten), gText);
            if (tag.Angaben.Count > 0)
            {
                f.Angaben(tag.Angaben.Select(a => (a.Titel, a.Text)).ToList(), 1, gText);
            }
            var t = new Tabelle { Schriftgroesse = g, Senkrechte = o.Raster, LeerText = o.LeerText, Wechselzeilen = o.Wechselzeilen };
            foreach (var sp in spalten) t.Spalten.Add(new Spalte(sp.Titel, sp.Ausrichtung, sp.Anteil) { Fett = sp.Schluessel == o.GruppenSpalte && !o.Gruppenkopf });
            string? letzte = null;
            var ersteAufSeite = true;
            foreach (var z in tag.Zeilen)
            {
                var neu = letzte == null || z.Gruppe != letzte;
                if (neu && o.Gruppenkopf && z.Gruppe.Length > 0)
                {
                    var gr = t.Gruppe(z.Gruppe);
                    gr.Seitenumbruch = o.EineSeiteJeGruppe && letzte != null;
                }
                var werte = spalten.Select(sp =>
                {
                    if (sp.Schluessel == o.EntfallSpalte && z.Entfall) return "entfällt";
                    if (sp.Schluessel == o.GruppenSpalte && !o.Gruppenkopf && !neu && !(ersteAufSeite && o.GruppeJedeSeite)) return "";
                    return z[sp.Schluessel];
                }).ToArray();
                var zeile = t.Zeile(werte);
                zeile.Stile = spalten.Select(sp =>
                    (z.Gestrichen.Contains(sp.Schluessel) ? Zellstil.Durchgestrichen : Zellstil.Normal)
                    | (z.Fett.Contains(sp.Schluessel) || (z.Entfall && (sp.Schluessel == o.EntfallSpalte || sp.Schluessel == o.ArtSpalte)) ? Zellstil.Fett : Zellstil.Normal)).ToArray();
                if (neu && !o.Gruppenkopf && letzte != null) { zeile.Trenner = true; zeile.Seitenumbruch = o.EineSeiteJeGruppe; }
                letzte = z.Gruppe;
                ersteAufSeite = false;
            }
            f.Tabelle(t);
        }
        return f.Erzeugen();
    }
}
