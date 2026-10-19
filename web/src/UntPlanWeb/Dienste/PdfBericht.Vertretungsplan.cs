using UntPlan.Druck;

namespace UntPlanWeb.Dienste;

public static partial class PdfBericht
{
    /// <summary>
    /// Vertretungsplan als Aushang (gemeinsames Layout mit UntPlan Studio): je Tag eine Seite, gruppiert nach Klasse, Spalten Std., Klasse,
    /// Fach, Lehrkraft (vertreten, nur Lehrerversion), Vertretung, Raum, Art, Bemerkung; Entfall halbfett „entfällt“, die Lehrkraft
    /// durchgestrichen; bisheriges Fach bzw. bisheriger Raum als „statt …“. <paramref name="gross"/>: Schrift 14 pt im Querformat.
    /// </summary>
    public static byte[] Vertretungsplan(string schule, IReadOnlyList<Vertretungstag> tage, bool kollegium, bool gross, string? ersteller, bool? hochformat = null)
    {
        var titel = kollegium ? "Vertretungsplan Lehrkräfte" : "Vertretungsplan";
        var kopf = Kopf(schule, titel, "", ersteller, kollegium ? Dienstgebrauch : "");
        var spalten = new List<Aushangspalte>
        {
            new("Stunde", "Std.", 0.07f, Ausrichtung.Links), new("Klasse", "Klasse", 0.10f), new("Fach", "Fach", 0.11f),
        };
        if (kollegium) spalten.Add(new("Lehrer", "Lehrkraft", 0.10f));
        spalten.AddRange(new Aushangspalte[] { new("Vertretung", "Vertretung", 0.11f), new("Raum", "Raum", 0.11f), new("Art", "Art", 0.12f), new("Bemerkung", "Bemerkung", kollegium ? 0.28f : 0.38f) });
        var o = new Aushangoptionen
        {
            Titel = titel,
            Schriftgroesse = gross ? 14 : 9.5f,
            Quer = hochformat is bool h ? !h : gross,
            Gruppenkopf = true,
            GruppenSpalte = "Klasse",
            EntfallSpalte = "Vertretung",
            ArtSpalte = "Art",
        };
        var aushang = tage.Select(t =>
        {
            var a = new Aushangtag { Datum = DateOnly.Parse(t.Datum), Zusatz = t.Woche, Frei = t.Frei ? (string.IsNullOrWhiteSpace(t.FreiGrund) ? "unterrichtsfrei" : t.FreiGrund) : null };
            a.Nachrichten.AddRange(t.Nachrichten.Where(n => !string.IsNullOrWhiteSpace(n)));
            void Angabe(string name, List<string> werte) { if (werte.Count > 0) a.Angaben.Add((name, string.Join(", ", werte))); }
            Angabe("Abwesende Klassen", t.AbwesendeKlassen);
            Angabe("Abwesende Lehrkräfte", t.AbwesendeLehrer);
            Angabe("Blockierte Räume", t.BlockierteRaeume);
            Angabe("Veranstaltungen", t.Veranstaltungen);
            foreach (var z in t.Zeilen)
            {
                var entfall = z.Status == "entfall";
                var zeile = new Aushangzeile { Gruppe = z.Klassen.Length > 0 ? z.Klassen : "ohne Klasse", Entfall = entfall };
                zeile["Stunde"] = z.Stunde;
                zeile["Klasse"] = z.Klassen;
                zeile["Fach"] = z.FachAlt is { Length: > 0 } fa ? $"{z.Fach} statt {fa}" : z.Fach;
                zeile["Lehrer"] = z.LehrerAlt ?? "";
                zeile["Vertretung"] = z.Status == "offen" ? "offen" : z.Lehrer;
                zeile["Raum"] = z.RaumAlt is { Length: > 0 } ra && z.Raum.Length > 0 ? $"{z.Raum} statt {ra}" : z.Raum.Length > 0 ? z.Raum : z.RaumAlt ?? "";
                zeile["Art"] = z.Art;
                var mehr = new[] { z.VertrVon.Length > 0 ? $"von {z.VertrVon}" : "", z.Nach.Length > 0 ? $"nach {z.Nach}" : "", z.Text }.Where(x => x.Length > 0);
                zeile["Bemerkung"] = string.Join(" · ", mehr);
                if (entfall || z.OhneLehrer) zeile.Gestrichen.Add("Lehrer");
                if (!entfall) zeile.Fett.Add("Vertretung");
                a.Zeilen.Add(zeile);
            }
            return a;
        }).ToList();
        return Vertretungsaushang.Erzeugen(kopf, aushang, spalten, o);
    }
}
