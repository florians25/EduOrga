using System.Globalization;
using UntPlan.Core;
using UntPlan.Core.Model;
using UntPlan.Core.Planung;
using UntPlan.Druck;

namespace UntPlanStudio.Dienste;

/// <summary>Ein Bericht als Tabelle (Druck-Modul): Titel, Spalten und Zeilen als Text; optional Zeilenarten „gruppe“, „zwischensumme“, „summe“.</summary>
public sealed record Bericht(string Titel, string Untertitel, IReadOnlyList<string> Spalten, IReadOnlyList<IReadOnlyList<string>> Zeilen, bool Quer = false,
    IReadOnlyList<string>? Arten = null)
{
    /// <summary>Hinweis unter der Tabelle (optional).</summary>
    public string Hinweis { get; init; } = "";
    /// <summary>Jede zweite Zeile hellgrau (lange, breite Listen).</summary>
    public bool Wechselzeilen { get; init; }
    /// <summary>Senkrechte Linien (Listen zum Ausfüllen bzw. Abhaken).</summary>
    public bool Senkrechte { get; init; }
    /// <summary>Unterschriftsfelder unter dem Bericht (z. B. Abrechnung).</summary>
    public IReadOnlyList<string>? Unterschriften { get; init; }
}

/// <summary>
/// Listen- und Übersichtsdrucke des Studios im gemeinsamen Druckdesign (UntPlan.Druck): Berichte als Tabelle mit wiederholtem Kopf,
/// Gruppen und Summen; Übersichtspläne (Elemente × Tage/Stunden) im Querformat.
/// </summary>
public static class ListenPdf
{
    private static readonly CultureInfo De = CultureInfo.GetCultureInfo("de-DE");

    /// <summary>Kopf- und Fußangaben aus den Schuldaten (gleich für alle Ausdrucke des Studios).</summary>
    public static Kopfdaten Kopf(Schuldatei d, string titel, string untertitel = "", string? ersteller = null)
    {
        var e = d.Einstellungen;
        return new Kopfdaten
        {
            Schule = e.Schulname.Length > 0 ? e.Schulname : "Schule",
            Schulzusatz = e.Schulname2.Length > 0 ? e.Schulname2 : e.Adresse,
            Titel = titel,
            Untertitel = untertitel,
            RechtsOben = $"Schuljahr {Schuljahr(d)}",
            Ersteller = ersteller ?? "",
        };
    }

    /// <summary>„2026/27“.</summary>
    public static string Schuljahr(Schuldatei d) => $"{d.Einstellungen.SchuljahrVon.Year}/{(d.Einstellungen.SchuljahrVon.Year + 1) % 100:00}";

    public static byte[] Bericht(Schuldatei d, Bericht b, string? ersteller = null)
    {
        var f = new Formular(Kopf(d, b.Titel, b.Untertitel, ersteller), b.Quer);
        f.NeueSeite();
        f.Tabelle(BerichtTabelle(b));
        if (b.Hinweis.Length > 0) f.Absatz(b.Hinweis, Formular.GroesseKlein + 0.5f, false, Formular.GrauText);
        if (b.Unterschriften is { Count: > 0 } u) f.Unterschriften(u.ToArray());
        return f.Erzeugen();
    }

    /// <summary>Tabelle eines Berichts (erste Spalte halbfett; schlichte Listen mit Zahl der Einträge).</summary>
    public static Tabelle BerichtTabelle(Bericht b)
    {
        var t = new Tabelle { Anzahl = b.Arten is null, Wechselzeilen = b.Wechselzeilen, Senkrechte = b.Senkrechte, LeerText = "Keine Einträge im gewählten Zeitraum." };
        for (var i = 0; i < b.Spalten.Count; i++) t.Spalte(b.Spalten[i], fett: i == 0);
        for (var r = 0; r < b.Zeilen.Count; r++)
            t.Hinzu(Tabelle.Art(b.Arten != null && r < b.Arten.Count ? b.Arten[r] : ""), b.Zeilen[r]);
        return t;
    }

    // ------------------------------------------------------------------------------------------ Übersichtsplan

    /// <summary>Übersichtsplan im Querformat: je Element eine Zeile, Tage × Stunden als Spalten.</summary>
    public static byte[] Uebersicht(Schuldatei d, DatenIndex ix, ElementTyp typ, IReadOnlyList<Element> elemente, Func<Element, Dictionary<(int Tag, int Stunde), string>> inhalt,
        string? ersteller = null)
    {
        var zr = d.Zeitraster;
        var titel = $"Übersichtsplan {TypText(typ)}";
        var f = new Formular(Kopf(d, titel, $"{PeriodeText(d)} · gültig ab {Format.Datum(d.AktivePeriode.Von)} · {elemente.Count} {TypText(typ)}", ersteller), true);
        var tage = zr.TageProWoche;
        var stunden = zr.StundenProTag;
        var spalten = tage * stunden;
        var i = 0;
        do
        {
            var s = f.NeueSeite();
            var nameB = Math.Clamp(elemente.Skip(i).Take(60).Select(e => Satz.Breite(e.Kurzname, 7.5f, true)).DefaultIfEmpty(20).Max() + 8, 30, 70);
            var x0 = f.Links;
            var nutz = f.Breite;
            var cw = (nutz - nameB) / spalten;
            const float kopf = 24;
            var y0 = f.Y;
            var verfuegbar = f.Unten - y0 - kopf - 16;
            var rh = Math.Clamp(verfuegbar / Math.Max(1, elemente.Count - i), 11f, 20f);
            var platz = Math.Max(1, (int)(verfuegbar / rh));
            var teil = elemente.Skip(i).Take(platz).ToList();
            var g = Math.Clamp(cw / 4.4f, 4f, 6.5f);

            s.Flaeche(x0, y0, nutz, kopf, Formular.GrauKopf);
            for (var t = 0; t < tage; t++)
            {
                var x = x0 + nameB + t * stunden * cw;
                s.TextImKasten(x, y0, stunden * cw, 13, 8, Planungsdienst.Tagname(d, t, true), Ausrichtung.Mitte, true);
                for (var st = 1; st <= stunden; st++)
                    s.TextImKasten(x + (st - 1) * cw, y0 + 12, cw, 11, 6.5f, zr.StundenLabel(st), Ausrichtung.Mitte, false, 0.5f);
            }
            s.TextImKasten(x0, y0, nameB, kopf, 7.5f, TypText(typ), Ausrichtung.Links, true);
            var y = y0 + kopf;
            for (var k = 0; k < teil.Count; k++)
            {
                var e = teil[k];
                if (k % 2 == 1) s.Flaeche(x0, y, nutz, rh, Formular.GrauWechsel);
                s.TextImKasten(x0, y, nameB, rh, 7.5f, e.Kurzname, Ausrichtung.Links, true);
                foreach (var ((tag, st), text) in inhalt(e))
                {
                    if (tag < 0 || tag >= tage || st < 1 || st > stunden) continue;
                    var x = x0 + nameB + (tag * stunden + st - 1) * cw;
                    s.Flaeche(x + 0.4f, y + 0.4f, cw - 0.8f, rh - 0.8f, 0.86f);
                    s.TextImKasten(x, y, cw, rh, g, text, Ausrichtung.Mitte, false, 0.5f);
                }
                y += rh;
                s.Linie(x0, y, x0 + nutz, y, Formular.LinieFein, Formular.GrauLinie);
            }
            for (var t = 0; t < tage; t++)
                for (var st = 1; st < stunden; st++)
                {
                    var x = x0 + nameB + (t * stunden + st) * cw;
                    s.Linie(x, y0 + 12, x, y, 0.25f, 0.7f);
                }
            for (var t = 0; t <= tage; t++)
            {
                var x = x0 + nameB + t * stunden * cw;
                s.Linie(x, y0, x, y, t == 0 || t == tage ? Formular.LinieStark : Formular.LinieNormal);
            }
            s.Linie(x0 + nameB, y0 + 12, x0 + nutz, y0 + 12, Formular.LinieFein, Formular.GrauLinie);
            s.Linie(x0, y0 + kopf, x0 + nutz, y0 + kopf, Formular.LinieStark);
            s.Rahmen(x0, y0, nutz, y - y0, Formular.LinieStark);
            f.Y = y + 6;
            if (i + teil.Count >= elemente.Count)
                f.Notiz("Grau hinterlegt: belegte Stunde; mehrere Unterrichte in einer Stunde durch „/“ getrennt, fixierte Stunden mit „*“.");
            i += teil.Count;
        } while (i < elemente.Count);
        return f.Erzeugen();
    }

    /// <summary>„Periode 1“ bzw. „Periode Halbjahr 2“ (ohne doppeltes „Periode“).</summary>
    public static string PeriodeText(Schuldatei d) =>
        d.AktivePeriode.Name.StartsWith("Periode", StringComparison.CurrentCultureIgnoreCase) ? d.AktivePeriode.Name : $"Periode {d.AktivePeriode.Name}";

    public static string TypText(ElementTyp t) => t switch
    {
        ElementTyp.Klasse => "Klassen",
        ElementTyp.Lehrer => "Lehrer",
        ElementTyp.Raum => "Räume",
        ElementTyp.Fach => "Fächer",
        _ => t.ToString(),
    };
}
