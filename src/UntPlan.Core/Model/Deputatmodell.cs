namespace UntPlan.Core.Model;

/// <summary>
/// Einstellungen der Deputatsrechnung (Lehrerarbeitszeit, Anrechnungstopf, Leitungszeit). Fehlt der Abschnitt in einer
/// älteren Datei, gelten diese Voreinstellungen (NRW).
/// </summary>
public sealed class DeputatEinstellungen
{
    /// <summary>Landesprofil: "NW" (Nordrhein-Westfalen) oder "Allgemein" (ohne Landesregeln, alles von Hand).</summary>
    public string Bundesland { get; set; } = "NW";
    /// <summary>Grundstellen der Schule (Sek I bzw. gesamt) laut Stellenberechnung; 0 = aus den Beschäftigungsumfängen geschätzt.</summary>
    public decimal Grundstellen { get; set; }
    /// <summary>Grundstellen der Sekundarstufe II (Gymnasium, Gesamtschule; Berufskolleg: Bildungsgänge mit Faktor 1,2).</summary>
    public decimal GrundstellenSekII { get; set; }
    /// <summary>Offene Ganztagsschule im Primarbereich (+1 Stunde Leitungszeit).</summary>
    public bool OffenerGanztag { get; set; }
    /// <summary>Anrechnungstopf von Hand (überschreibt die Berechnung); null = berechnet.</summary>
    public decimal? Anrechnungstopf { get; set; }
    /// <summary>Leitungszeit von Hand (überschreibt die Berechnung); null = berechnet.</summary>
    public decimal? Leitungszeit { get; set; }
    /// <summary>Alters- und Schwerbehindertenermäßigung aus Geburtsdatum und GdB berechnen.</summary>
    public bool AutomatischeErmaessigungen { get; set; } = true;
    /// <summary>Toleranz in Stunden, ab der eine Differenz Soll/Ist als Abweichung gilt.</summary>
    public decimal Toleranz { get; set; } = 0.5m;
}
