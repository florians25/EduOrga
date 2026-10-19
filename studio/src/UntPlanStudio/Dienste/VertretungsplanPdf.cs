using System.Text.Json;
using System.Text.Json.Nodes;
using UntPlan.Core;
using UntPlan.Core.Austausch;
using UntPlan.Core.Model;
using UntPlan.Core.Planung;
using UntPlan.Core.Vertretungsplanung;
using UntPlan.Druck;

namespace UntPlanStudio.Dienste;

/// <summary>
/// Seitenlayout des Vertretungsplan-Aushangs – dieselben Felder wie <c>Vertretungsdruck</c> der Desktop-Anwendung. Gespeichert in den
/// Ansichtseinstellungen der Schuldatei (<c>Ansichtseinstellungen.Vertretungsdruck</c>), damit Desktop und Studio dieselbe Vorlage nutzen.
/// </summary>
public sealed class AushangLayout
{
    public string Schriftart { get; set; } = "Comic Sans MS";
    public float Schriftgroesse { get; set; } = 11f;
    public bool Nachrichten { get; set; } = true;
    public bool BlockierteRaeume { get; set; } = true;
    public bool AbwesendeKlassen { get; set; } = true;
    public bool AbwesendeLehrer { get; set; } = true;
    public bool Querformat { get; set; }
    public bool NurNeue { get; set; }
    public List<AushangFeld> Felder { get; set; } = new();
    public List<string> KlassenAuswahl { get; set; } = new();
    public List<string> LehrerAuswahl { get; set; } = new();
    public DateTime? NurGeaendertNach { get; set; }
    public bool ErsteBeschriftungJedeSeite { get; set; } = true;
    public bool Raster { get; set; }
    public bool BeschraenkungSeitenbreite { get; set; } = true;
    public string Hintergrundbild { get; set; } = "";
    public string Ueberschrift { get; set; } = "";
    public bool AbwesendeNichtDrucken { get; set; }
    public bool AuchElementeOhneVertretung { get; set; }
    public bool UeberschriftJeElement { get; set; } = true;
    public bool EineSeiteJeElement { get; set; }
    public bool ElementueberschriftKomprimiert { get; set; }
    public string Gruppierung { get; set; } = "Element";
    public bool EntfallslehrerDurchstreichen { get; set; } = true;
    public bool KombinierteKlassen { get; set; }
    public bool Stundenbezeichnung { get; set; }
    public bool StammdatenEinzeln { get; set; } = true;
    public bool BlockvertretungenZusammenfassen { get; set; } = true;
    public bool KeinEntfallBeiErsatz { get; set; }
    public bool LehrerMitAbsenzgrund { get; set; }

    private const string Schluessel = "Vertretungsdruck";

    /// <summary>Seitenlayout aus der Schuldatei (fehlt es, gelten die Standardwerte).</summary>
    public static AushangLayout Lesen(Schuldatei d)
    {
        AushangLayout e = new();
        if (d.Ansichtseinstellungen?[Schluessel] is JsonNode n)
        {
            try { e = n.Deserialize<AushangLayout>() ?? new(); }
            catch (Exception ex) when (ex is JsonException or NotSupportedException or InvalidOperationException) { e = new(); }
        }
        VertretungsplanPdf.Felder(e);
        return e;
    }

    /// <summary>Seitenlayout in die Ansichtseinstellungen der Schuldatei schreiben (übrige Ansichtseinstellungen bleiben erhalten).</summary>
    public static void Schreiben(Schuldatei d, AushangLayout e)
    {
        d.Ansichtseinstellungen ??= new JsonObject();
        d.Ansichtseinstellungen[Schluessel] = JsonSerializer.SerializeToNode(e);
    }
}

/// <summary>Feld (Spalte) im Seitenlayout eines Ausdrucks.</summary>
public sealed class AushangFeld
{
    public string Schluessel { get; set; } = "";
    public string Ueberschrift { get; set; } = "";
    public bool Drucken { get; set; } = true;
    public float Anteil { get; set; } = 0.1f;
}

/// <summary>
/// Aushang des Vertretungsplans (Klassen- oder Lehrerversion) als PDF, je Tag eine neue Seite – Aufbau
/// (Druck/VertretungsplanDruck): Kopf, Titel „… am: 24.9. / Donnerstag“, Nachrichten zum Tag, Kästen (blockierte Räume,
/// abwesende Klassen/Lehrer), Tabelle mit den Feldern des Seitenlayouts, Gruppierung, Raster, kombinierte Klassen, Blockvertretungen.
/// </summary>
public static class VertretungsplanPdf
{
    public sealed record Zeile(string Element, string Stunde, int? StundeZahl, string Partner, string Abwesend, bool Durchgestrichen, string Fach, string StattFach,
        string Raum, string StattRaum, string Bemerkung, string Art, string VtrNr, bool Entfall = false);

    public sealed record Tag(DateOnly Datum, List<string> Nachrichten, List<(string Titel, string Text)> Kaesten, List<Zeile> Zeilen);

    public static readonly (string Schluessel, float Anteil, bool Standard)[] AlleFelder =
    {
        ("Stunde", 0.07f, true), ("Element", 0.11f, true), ("Fach", 0.09f, true), ("Abwesend", 0.11f, true), ("Partner", 0.11f, true),
        ("Raum", 0.09f, true), ("Art", 0.12f, true), ("Bemerkung", 0.30f, true), ("StattFach", 0.09f, false), ("StattRaum", 0.09f, false), ("VtrNr", 0.06f, false),
    };

    public static string StandardUeberschrift(string schluessel, bool lehrer) => schluessel switch
    {
        "Element" => lehrer ? "Lehrkraft" : "Klasse",
        "Stunde" => "Std.",
        "Partner" => lehrer ? "Klasse" : "Vertretung",
        "Abwesend" => lehrer ? "Vertretung für" : "Lehrkraft",
        "Fach" => "Fach",
        "Raum" => "Raum",
        "Bemerkung" => "Bemerkung",
        "Art" => "Art",
        "StattFach" => "statt Fach",
        "StattRaum" => "statt Raum",
        "VtrNr" => "Nr.",
        _ => schluessel,
    };

    public static List<AushangFeld> Felder(AushangLayout e)
    {
        if (e.Felder.Count == 0)
            e.Felder = AlleFelder.Select(f => new AushangFeld { Schluessel = f.Schluessel, Anteil = f.Anteil, Drucken = f.Standard }).ToList();
        foreach (var f in AlleFelder.Where(f => e.Felder.All(x => x.Schluessel != f.Schluessel)))
            e.Felder.Add(new AushangFeld { Schluessel = f.Schluessel, Anteil = f.Anteil, Drucken = false });
        e.Felder.RemoveAll(x => AlleFelder.All(f => f.Schluessel != x.Schluessel));
        return e.Felder;
    }

    private static string Ueberschrift(AushangFeld f, bool lehrer) => f.Ueberschrift.Length > 0 ? f.Ueberschrift : StandardUeberschrift(f.Schluessel, lehrer);

    private static string Wert(Zeile z, string schluessel) => schluessel switch
    {
        "Element" => z.Element,
        "Stunde" => z.Stunde,
        "Partner" => z.Partner,
        "Abwesend" => z.Abwesend,
        "Fach" => z.Fach,
        "Raum" => z.Raum,
        "Bemerkung" => z.Bemerkung,
        "Art" => z.Art,
        "StattFach" => z.StattFach,
        "StattRaum" => z.StattRaum,
        "VtrNr" => z.VtrNr,
        _ => "",
    };

    public static List<Tag> Tage(Dokument doc, DateOnly von, DateOnly bis, bool lehrer, AushangLayout e)
    {
        var d = doc.Daten;
        if ((bis.DayNumber - von.DayNumber) > 62) bis = von.AddDays(62);
        return Kalender.Tage(von, bis).Where(t => Kalender.IstUnterrichtstag(d, t)).Select(t => TagDaten(doc, t, lehrer, e)).ToList();
    }

    private static string Gruppe(Zeile x, AushangLayout e) => e.Gruppierung switch
    {
        "Stunde" => x.Stunde,
        "Vertreter" => x.Partner,
        "Fach" => x.Fach,
        _ => x.Element,
    };

    /// <param name="gross">Aushang am Schwarzen Brett: mindestens 14 pt im Querformat.</param>
    public static byte[] Erzeugen(Dokument doc, DateOnly von, DateOnly bis, bool lehrer, AushangLayout e, string? ersteller = null, bool gross = false)
    {
        var d = doc.Daten;
        var tage = Tage(doc, von, bis, lehrer, e);
        var felder = Felder(e).Where(f => f.Drucken).ToList();
        if (felder.Count == 0) felder = Felder(e).Take(1).ToList();
        var titel = e.Ueberschrift.Length > 0 ? e.Ueberschrift : $"{d.Einstellungen.Vertretungsplantitel} {(lehrer ? "Lehrkräfte" : "Klassen")}";
        var kopf = ListenPdf.Kopf(d, titel, tage.Count == 0 ? $"{Format.Datum(von)} – {Format.Datum(bis)}" : "", ersteller);
        if (lehrer) kopf.Vermerk = "Nur für den Dienstgebrauch";
        var o = new Aushangoptionen
        {
            Titel = titel,
            Schriftgroesse = gross ? Math.Max(14, e.Schriftgroesse) : Math.Clamp(e.Schriftgroesse, 6, 20),
            Quer = e.Querformat || gross,
            Raster = e.Raster,
            Gruppenkopf = e.UeberschriftJeElement,
            EineSeiteJeGruppe = e.EineSeiteJeElement,
            GruppenSpalte = e.Gruppierung switch { "Stunde" => "Stunde", "Vertreter" => "Partner", "Fach" => "Fach", _ => "Element" },
            GruppeJedeSeite = e.ErsteBeschriftungJedeSeite,
            EntfallSpalte = lehrer ? "Abwesend" : "Partner",
            ArtSpalte = "Art",
        };
        var spalten = felder.Select(f => new Aushangspalte(f.Schluessel, Ueberschrift(f, lehrer).Replace('\n', ' '), Math.Max(0.02f, f.Anteil),
            f.Schluessel is "Stunde" or "VtrNr" ? Ausrichtung.Links : null)).ToList();
        var aushang = tage.Select(t =>
        {
            var a = new Aushangtag { Datum = t.Datum };
            a.Nachrichten.AddRange(t.Nachrichten.Select(TagestextHtml.ZuText).Where(x => !string.IsNullOrWhiteSpace(x)));
            a.Angaben.AddRange(t.Kaesten);
            foreach (var z in t.Zeilen)
            {
                var zeile = new Aushangzeile { Gruppe = Gruppe(z, e), Entfall = z.Entfall };
                foreach (var f in AlleFelder) zeile[f.Schluessel] = Wert(z, f.Schluessel);
                // Bemerkung wiederholt nur die Art (z. B. „Entfall“): weglassen, wenn die Art gedruckt wird
                if (felder.Any(f => f.Schluessel == "Art") && string.Equals(zeile["Bemerkung"].Trim(), zeile["Art"].Trim(), StringComparison.CurrentCultureIgnoreCase)) zeile["Bemerkung"] = "";
                if (z.Durchgestrichen) zeile.Gestrichen.Add("Abwesend");
                if (!z.Entfall && z.Partner is "???") zeile.Fett.Add("Partner");
                a.Zeilen.Add(zeile);
            }
            return a;
        }).ToList();
        return Vertretungsaushang.Erzeugen(kopf, aushang, spalten, o);
    }

    /// <summary>„Alle Klassen“, „Alle Lehrkräfte außer A, B“ – gilt für jedes gewählte Element, das nicht hinter „außer“ steht.</summary>
    private static bool AlleTrifft(string element, ICollection<string> auswahl)
    {
        if (!element.StartsWith("Alle ", StringComparison.Ordinal)) return false;
        var i = element.IndexOf(" außer ", StringComparison.Ordinal);
        if (i < 0) return true;
        var ausser = element[(i + 7)..].Split(',').Select(x => x.Trim()).ToHashSet();
        return auswahl.Any(a => !ausser.Contains(a));
    }

    public static Tag TagDaten(Dokument doc, DateOnly datum, bool lehrer, AushangLayout e)
    {
        var d = doc.Daten;
        var ix = new DatenIndex(d);
        var plan = Vertretungsplan.Zeilen(d, datum);
        var vertretungen = d.Vertretungen.Where(v => v.Datum == datum).GroupBy(v => v.Id).ToDictionary(g => g.Key, g => g.First());
        if (e.NurNeue)
            plan = plan.Where(z => vertretungen.TryGetValue(z.Id, out var v) && Vertretungen.IstNeu(v, doc.Sitzungsbeginn)).ToList();
        if (e.NurGeaendertNach is DateTime ab)
            plan = plan.Where(z => vertretungen.TryGetValue(z.Id, out var v) && (v.Geaendert >= ab || v.Erstellt >= ab)).ToList();
        if (!lehrer) plan = plan.Where(z => z.ArtWert != VertretungsArt.Pausenaufsicht).ToList();
        if (e.KeinEntfallBeiErsatz)
        {
            var ersatz = plan.Where(z => z.ArtWert != VertretungsArt.Entfall).SelectMany(z => z.KlassenIds.Select(k => (k, z.Stunde))).ToHashSet();
            plan = plan.Where(z => z.ArtWert != VertretungsArt.Entfall || !z.KlassenIds.All(k => ersatz.Contains((k, z.Stunde)))).ToList();
        }
        string Klassen(string k) => e.KombinierteKlassen ? Druckaufbereitung.KlassenKombinieren(k) : k;
        string StundeText(int s) => e.Stundenbezeichnung ? d.Zeitraster.StundenLabel(s) + "." : s.ToString();
        var zeilen = plan.Select(z =>
        {
            var vertreter = z.Vertreter;
            var abwesend = z.Lehrer.Length > 0 && z.Lehrer != z.Vertreter ? z.Lehrer : "";
            var fach = string.IsNullOrWhiteSpace(z.Gruppe) ? z.NeuesFach : $"{z.NeuesFach} {z.Gruppe}";
            var raum = z.NeuerRaum.Length > 0 ? z.NeuerRaum : z.Raum;
            var stunde = z.ArtWert == VertretungsArt.Pausenaufsicht ? $"{z.Stunde}/{z.Stunde + 1}" : StundeText(z.Stunde);
            int? zahl = z.ArtWert == VertretungsArt.Pausenaufsicht ? null : z.Stunde;
            var art = Vertretungsplan.ArtText(z.ArtWert);
            var entfall = z.ArtWert is VertretungsArt.Entfall or VertretungsArt.Freisetzung or VertretungsArt.BereitschaftEntfaellt;
            var nr = z.Id > 0 ? z.Id.ToString() : "";
            if (e.AbwesendeNichtDrucken) abwesend = "";
            var streichen = e.EntfallslehrerDurchstreichen;
            if (!lehrer)
                return new Zeile(Klassen(z.Klassen), stunde, zahl, vertreter, abwesend, streichen && abwesend.Length > 0, fach, z.Fach, raum, z.Raum, z.Bemerkung, art, nr, entfall);
            var person = vertreter is "---" or "+" or "+++" or "???" || vertreter.Length == 0 ? z.Lehrer : vertreter;
            var weg = z.Lehrer.Length > 0 && z.Lehrer != person && !e.AbwesendeNichtDrucken ? z.Lehrer : "";
            return new Zeile(person, stunde, zahl, Klassen(z.Klassen), weg, streichen && weg.Length > 0, fach, z.Fach, raum, z.Raum, z.Bemerkung, art, nr, entfall);
        }).ToList();
        var auswahl = lehrer ? e.LehrerAuswahl : e.KlassenAuswahl;
        if (auswahl.Count > 0)
            zeilen = zeilen.Where(z => z.Element.Split(',').Any(x => auswahl.Contains(x.Trim())) || AlleTrifft(z.Element, auswahl)).ToList();
        if (e.AuchElementeOhneVertretung)
        {
            var alle = lehrer ? d.Lehrer.Select(x => x.Kurzname) : d.Klassen.Select(x => x.Kurzname);
            foreach (var name in alle.Where(n => (auswahl.Count == 0 || auswahl.Contains(n)) && !zeilen.Any(z => z.Element.Split(',').Contains(n) || AlleTrifft(z.Element, new[] { n }))).ToList())
                zeilen.Add(new Zeile(name, "", null, "", "", false, "", "", "", "", "keine Vertretung", "", ""));
        }
        var cmp = StringComparer.Create(Format.De, true);
        IOrderedEnumerable<Zeile> sortiert = e.Gruppierung switch
        {
            "Stunde" => zeilen.OrderBy(z => z.StundeZahl ?? int.MaxValue).ThenBy(z => z.Element, cmp),
            "Vertreter" => zeilen.OrderBy(z => z.Partner, cmp).ThenBy(z => z.StundeZahl ?? 0),
            "Fach" => zeilen.OrderBy(z => z.Fach, cmp).ThenBy(z => z.StundeZahl ?? 0),
            _ => zeilen.OrderBy(z => z.Element, cmp).ThenBy(z => z.StundeZahl ?? 0),
        };
        var liste = sortiert.ToList();
        if (e.BlockvertretungenZusammenfassen)
            liste = Druckaufbereitung.Zusammenfassen(liste, z => z.StundeZahl,
                z => string.Join("|", z.Element, z.Partner, z.Abwesend, z.Fach, z.StattFach, z.Raum, z.StattRaum, z.Bemerkung, z.Art),
                (z, s) => z with { Stunde = s });

        var nachrichten = e.Nachrichten
            ? d.Tagestexte.Where(t => t.GiltAm(datum) && (lehrer || !t.FuerLehrer)).Select(t => t.Text).Where(t => !string.IsNullOrWhiteSpace(t)).ToList()
            : new List<string>();
        var kaesten = new List<(string, string)>();
        string Stunden(Abwesenheit a) => $"({a.StundeVon}-{Math.Min(a.StundeBis, d.Zeitraster.StundenProTag)})";
        string Grund(Abwesenheit a) => e.LehrerMitAbsenzgrund && a.GrundId is int gid && d.Abwesenheitsgruende.FirstOrDefault(x => x.Id == gid) is { } gr ? $" {gr.Kurzname}" : "";
        var abw = d.Abwesenheiten.Where(a => datum >= a.Von && datum <= a.Bis).ToList();
        if (e.BlockierteRaeume && abw.Where(a => a.Art == AbwesenheitsArt.Raum).ToList() is { Count: > 0 } raeume)
            kaesten.Add(("Blockierte Räume", string.Join(", ", raeume.Select(a => $"{ix.KRaum(a.ElementId)} {Stunden(a)}"))));
        if (e.AbwesendeKlassen && abw.Where(a => a.Art == AbwesenheitsArt.Klasse).ToList() is { Count: > 0 } klassen)
            kaesten.Add(("Abwesende Klassen", string.Join(", ", klassen.Select(a => $"{ix.KKlassen(new[] { a.ElementId })} {Stunden(a)}"))));
        if (lehrer && e.AbwesendeLehrer && abw.Where(a => a.Art == AbwesenheitsArt.Lehrer).ToList() is { Count: > 0 } lehrerAbw)
            kaesten.Add(("Abwesende Lehrer", string.Join(", ", lehrerAbw.Select(a => $"{ix.KLehrer(a.ElementId)} {Stunden(a)}{Grund(a)}"))));
        return new Tag(datum, nachrichten, kaesten, liste);
    }
}
