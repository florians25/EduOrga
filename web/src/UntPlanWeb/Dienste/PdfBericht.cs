using UntPlan.Druck;

namespace UntPlanWeb.Dienste;

/// <summary>
/// PDF-Formulare von UntPlan Web im gemeinsamen Druckdesign (UntPlan.Druck, auch in UntPlan Studio): A4 hoch oder quer in
/// Schwarz-Weiß, Kopf mit Schule und „Seite x von y“, Titel und Zeitraum, Tabelle mit wiederholtem Kopf, Gruppen und Summen, Hinweis,
/// Unterschriftsfelder, Fuß mit Druckdatum. Eigene Formulare: Entschuldigung, Zugangsdaten (Karten zum Ausschneiden), Sitzplan.
/// </summary>
public static partial class PdfBericht
{
    public const string Dienstgebrauch = "Nur für den Dienstgebrauch";

    /// <summary>Ausrichtung aus einer Anfrage: „hoch“ bzw. „quer“, sonst die Vorgabe des Formulars.</summary>
    public static bool Hochformat(string? ausrichtung, bool vorgabe) => ausrichtung?.Trim().ToLowerInvariant() switch
    {
        "hoch" or "hochformat" or "portrait" => true,
        "quer" or "querformat" or "landscape" => false,
        _ => vorgabe,
    };

    private static Kopfdaten Kopf(string schule, string titel, string untertitel, string? ersteller, string? vermerk) => new()
    {
        Schule = string.IsNullOrWhiteSpace(schule) ? "Schule" : schule,
        Titel = titel,
        Untertitel = untertitel,
        Ersteller = ersteller ?? "",
        Vermerk = vermerk ?? "",
    };

    /// <param name="hochformat">A4 hoch statt quer (schmalere Tabelle, mehr Zeilen je Seite).</param>
    public static byte[] Erzeugen(string schule, string titel, string untertitel, IReadOnlyList<string> spalten, IReadOnlyList<IReadOnlyList<string>> zeilen,
        string? hinweis, string? ersteller, bool unterschrift, bool hochformat, IReadOnlyList<string>? arten = null, string? vermerk = Dienstgebrauch, bool freieZeilen = false) =>
        Erstellen(schule, titel, untertitel, spalten, zeilen, hinweis, ersteller, unterschrift, hochformat, arten, vermerk, freieZeilen);

    /// <param name="arten">Optional je Zeile: <c>gruppe</c> (Gruppenkopf über die ganze Breite), <c>zwischensumme</c>, <c>summe</c>, <c>leer</c>
    /// (Zeile zum Ausfüllen) – gegliederte Berichte; ohne Angabe schlichte Tabelle mit Zahl der Einträge.</param>
    public static byte[] Erzeugen(string schule, string titel, string untertitel, IReadOnlyList<string> spalten, IReadOnlyList<IReadOnlyList<string>> zeilen,
        string? hinweis = null, string? ersteller = null, bool unterschrift = true, IReadOnlyList<string>? arten = null) =>
        Erstellen(schule, titel, untertitel, spalten, zeilen, hinweis, ersteller, unterschrift, false, arten, Dienstgebrauch, false);

    private static byte[] Erstellen(string schule, string titel, string untertitel, IReadOnlyList<string> spalten, IReadOnlyList<IReadOnlyList<string>> zeilen,
        string? hinweis, string? ersteller, bool unterschrift, bool hochformat, IReadOnlyList<string>? arten, string? vermerk, bool freieZeilen)
    {
        var f = new Formular(Kopf(schule, titel, untertitel, ersteller, vermerk), !hochformat);
        f.NeueSeite();
        var t = new Tabelle { Anzahl = arten == null && !freieZeilen, LeerText = "Keine Einträge im gewählten Zeitraum.", Wechselzeilen = arten == null && zeilen.Count > 15 && spalten.Count > 5 };
        for (var i = 0; i < spalten.Count; i++) t.Spalte(spalten[i], fett: i == 0);
        if (freieZeilen) t.Senkrechte = true;
        for (var r = 0; r < zeilen.Count; r++)
        {
            t.Hinzu(Tabelle.Art(arten != null && r < arten.Count ? arten[r] : ""), zeilen[r]);
        }
        // Formular zum Eintragen (z. B. freie Sprechtagstermine): höhere Zeilen mit senkrechten Linien, damit man von Hand schreiben kann
        if (freieZeilen) t.MinZeilenhoehe = 19;
        f.Tabelle(t);
        if (!string.IsNullOrWhiteSpace(hinweis)) f.Absatz(hinweis, Formular.GroesseText - 0.5f);
        if (unterschrift) f.Unterschriften("Ort, Datum", "Unterschrift");
        return f.Erzeugen();
    }

    // ------------------------------------------------------------------------------------------ Entschuldigung

    /// <summary>
    /// Entschuldigungsschreiben (Hochformat): Angaben zur Schülerin bzw. zum Schüler, Erklärung, Tabelle der Fehlzeiten, Grund zum
    /// Ausfüllen, Unterschrift der bzw. des Erziehungsberechtigten (bzw. volljährig), darunter ein Feld für den Vermerk der Schule.
    /// </summary>
    public static byte[] Entschuldigung(string schule, string name, string klasse, string zeitraum, IReadOnlyList<IReadOnlyList<string>> zeilen, bool erziehungsberechtigt,
        string? ersteller, bool hochformat = true)
    {
        var f = new Formular(Kopf(schule, "Entschuldigung", "für das Fehlen im Unterricht", ersteller, ""), !hochformat);
        f.NeueSeite();
        f.Angaben(new List<(string, string)> { ("Schüler*in", name), ("Klasse", klasse), ("Zeitraum", zeitraum), ("Fehlzeiten", zeilen.Count == 1 ? "1 Abwesenheit" : $"{zeilen.Count} Abwesenheiten") });
        f.Absatz($"Hiermit entschuldige ich das Fehlen von {name} (Klasse {klasse}) in den folgenden Zeiträumen:", Formular.GroesseText + 0.5f);
        var t = new Tabelle("Von", "Bis", "Fehlstunden", "Abwesenheitsgrund", "Status", "Bemerkung");
        t.Spalten[0].Fett = true;
        foreach (var z in zeilen) t.Zeile(z.ToArray());
        f.Tabelle(t);
        f.Abstand(4);
        f.Schreiblinien("Grund des Fehlens:", 2);
        f.Unterschriften("Ort, Datum", erziehungsberechtigt ? "Unterschrift einer bzw. eines Erziehungsberechtigten" : "Unterschrift (volljährige Schülerin bzw. volljähriger Schüler)");
        f.Abstand(10);
        // Vermerk der Schule (gestrichelt umrandet)
        f.Platz(64);
        var s = f.Seite;
        var y = f.Y;
        s.Rahmen(f.Links, y, f.Breite, 58, Formular.LinieNormal, 0, 3, 2);
        s.Text(f.Links + 8, y + 13, Formular.GroesseKlein + 0.5f, "Vermerk der Schule", true);
        var b = (f.Breite - 16 - 2 * 20) / 3;
        string[] felder = { "Eingegangen am", "Entschuldigt (ja/nein)", "Kürzel Klassenleitung" };
        for (var i = 0; i < 3; i++)
        {
            var x = f.Links + 8 + i * (b + 20);
            s.Linie(x, y + 42, x + b, y + 42, Formular.LinieNormal);
            s.Text(x, y + 51, Formular.GroesseKlein, felder[i], false, Formular.GrauText);
        }
        f.Y = y + 64;
        return f.Erzeugen();
    }

    // ------------------------------------------------------------------------------------------ Zugangsdaten

    public sealed record Zugang(string Name, string Zuordnung, string Rolle, string Login, string Passwort);

    /// <summary>
    /// Zugangsdaten als Karten zum Ausschneiden (Hochformat 2 × 5, Querformat 3 × 3 je Seite, Schnittlinien gestrichelt): Name, Klasse bzw.
    /// Kürzel, Rolle, Adresse, Benutzername und Startpasswort in gut lesbarer Schrift, Hinweis zur ersten Anmeldung.
    /// </summary>
    public static byte[] Zugangsdaten(string schule, string titel, string adresse, IReadOnlyList<Zugang> konten, string hinweis, string? ersteller, bool hochformat = true)
    {
        var f = new Formular(Kopf(schule, titel, $"Anmeldung unter {adresse} · {konten.Count} {(konten.Count == 1 ? "Zugang" : "Zugänge")}", ersteller, "Vertraulich"), !hochformat);
        var spalten = hochformat ? 2 : 3;
        var reihen = hochformat ? 5 : 3;
        for (var i = 0; i < konten.Count; i += spalten * reihen)
        {
            f.NeueSeite(titel);
            var s = f.Seite;
            f.Absatz(hinweis, Formular.GroesseKlein + 0.5f, false, Formular.GrauText, 6);
            var oben = f.Y;
            var kb = f.Breite / spalten;
            var kh = (f.Unten - oben) / reihen;
            // Schnittlinien
            for (var c = 1; c < spalten; c++) s.Linie(f.Links + c * kb, oben, f.Links + c * kb, oben + reihen * kh, 0.5f, 0.45f, 3, 2.5f);
            for (var r = 0; r <= reihen; r++) s.Linie(f.Links, oben + r * kh, f.Rechts, oben + r * kh, 0.5f, 0.45f, 3, 2.5f);
            var teil = konten.Skip(i).Take(spalten * reihen).ToList();
            for (var k = 0; k < teil.Count; k++)
            {
                var z = teil[k];
                var x = f.Links + (k % spalten) * kb + 10;
                var y = oben + (k / spalten) * kh + 8;
                var b = kb - 20;
                s.Text(x, y + 9, 7, Satz.Kuerzen(schule, b, 7), false, Formular.GrauText);
                s.Text(x, y + 23, 12, Satz.Kuerzen(z.Name, b, 12, true), true);
                var info = string.Join(" · ", new[] { z.Zuordnung, z.Rolle }.Where(t => t.Length > 0));
                s.Text(x, y + 34, 8, Satz.Kuerzen(info, b, 8), false, Formular.GrauText);
                var zeilenY = y + 50;
                foreach (var (n, w) in new[] { ("Adresse", adresse), ("Benutzername", z.Login), ("Startpasswort", z.Passwort) })
                {
                    if (zeilenY + 4 > y + kh - 10) break;
                    s.Text(x, zeilenY, 7.5f, n, false, Formular.GrauText);
                    s.Text(x + 64, zeilenY, n == "Adresse" ? 8 : 10.5f, Satz.Kuerzen(w, b - 64, n == "Adresse" ? 8 : 10.5f, n != "Adresse"), n != "Adresse");
                    zeilenY += 15;
                }
            }
            f.Y = oben + reihen * kh;
        }
        if (konten.Count == 0) { f.NeueSeite(); f.Absatz("Keine Zugangsdaten."); }
        return f.Erzeugen();
    }
}
