using System.Text;
using static UntPlan.Druck.PdfDokument;

namespace UntPlan.Druck;

/// <summary>Waagerechte Ausrichtung von Text.</summary>
public enum Ausrichtung
{
    Links,
    Mitte,
    Rechts,
}

/// <summary>Textmaße in IBM Plex Sans: Breite, Kürzen mit „…“, Zeilenumbruch nach Wörtern.</summary>
public static class Satz
{
    public static float Breite(string? text, float groesse, bool fett = false) => Schrift.Von(fett ? Schnitt.Fett : Schnitt.Normal).Breite(text, groesse);

    /// <summary>Text auf eine Breite kürzen (mit „…“).</summary>
    public static string Kuerzen(string? text, float max, float groesse, bool fett = false)
    {
        var t = (text ?? "").Replace('\n', ' ').Replace('\r', ' ');
        if (Breite(t, groesse, fett) <= max) return t;
        var lo = 0;
        var hi = t.Length;
        while (lo < hi)
        {
            var mitte = (lo + hi + 1) / 2;
            if (Breite(t[..mitte].TrimEnd() + "…", groesse, fett) <= max) lo = mitte; else hi = mitte - 1;
        }
        return lo == 0 ? (Breite("…", groesse, fett) <= max ? "…" : "") : t[..lo].TrimEnd() + "…";
    }

    /// <summary>Zeilenumbruch nach Wörtern (harte Umbrüche bleiben erhalten); zu lange Wörter werden getrennt.</summary>
    public static List<string> Umbrechen(string? text, float max, float groesse, bool fett = false)
    {
        var res = new List<string>();
        foreach (var absatz in (text ?? "").Replace("\r", "").Split('\n'))
        {
            var zeile = "";
            foreach (var wortRoh in absatz.Split(' ', StringSplitOptions.RemoveEmptyEntries))
            {
                var wort = wortRoh;
                // Wort breiter als die Zeile: nach Bindestrich, Schrägstrich bzw. zeichenweise trennen
                while (Breite(wort, groesse, fett) > max && wort.Length > 1)
                {
                    if (zeile.Length > 0) { res.Add(zeile); zeile = ""; }
                    var n = wort.Length - 1;
                    while (n > 1 && Breite(wort[..n], groesse, fett) > max) n--;
                    var trenn = wort.LastIndexOfAny(new[] { '-', '/', ',', '.' }, Math.Max(0, n - 1), Math.Max(1, n - 1));
                    if (trenn > n / 2) n = trenn + 1;
                    res.Add(wort[..n]);
                    wort = wort[n..];
                }
                var neu = zeile.Length == 0 ? wort : zeile + " " + wort;
                if (Breite(neu, groesse, fett) > max && zeile.Length > 0) { res.Add(zeile); zeile = wort; }
                else zeile = neu;
            }
            res.Add(zeile);
        }
        return res;
    }
}

/// <summary>
/// Eine PDF-Seite mit Zeichenbefehlen; Koordinaten in Punkt, Ursprung oben links. Farben nur als Graustufe
/// (0 = schwarz, 1 = weiß) – der Druck ist für Schwarz-Weiß-Laserdrucker gedacht.
/// </summary>
public sealed class Seite
{
    private readonly PdfDokument _pdf;
    private readonly StringBuilder _sb = new();
    public float Breite { get; }
    public float Hoehe { get; }
    internal string Inhalt => _sb.ToString();

    internal Seite(PdfDokument pdf, float breite, float hoehe)
    {
        _pdf = pdf;
        Breite = breite;
        Hoehe = hoehe;
    }

    public bool Quer => Breite > Hoehe;

    private float Y(float y) => Hoehe - y;

    /// <summary>Text mit Grundlinie bei <paramref name="grundlinie"/>.</summary>
    public void Text(float x, float grundlinie, float groesse, string? text, bool fett = false, float grau = 0)
    {
        if (string.IsNullOrEmpty(text)) return;
        var schnitt = fett ? Schnitt.Fett : Schnitt.Normal;
        var glyphen = Schrift.Von(schnitt).Glyphen(text);
        if (glyphen.Count == 0) return;
        var genutzt = _pdf.Genutzt[schnitt];
        var hex = new StringBuilder(glyphen.Count * 4);
        foreach (var (g, z) in glyphen)
        {
            genutzt.TryAdd(g, z);
            hex.Append(g.ToString("X4"));
        }
        _sb.Append($"BT {F(grau)} g /{(fett ? "F2" : "F1")} {F(groesse)} Tf {F(x)} {F(Y(grundlinie))} Td <{hex}> Tj ET\n");
    }

    public void TextRechts(float rechts, float grundlinie, float groesse, string? text, bool fett = false, float grau = 0) =>
        Text(rechts - Satz.Breite(text, groesse, fett), grundlinie, groesse, text, fett, grau);

    public void TextMittig(float x, float b, float grundlinie, float groesse, string? text, bool fett = false, float grau = 0) =>
        Text(x + (b - Satz.Breite(text, groesse, fett)) / 2, grundlinie, groesse, text, fett, grau);

    /// <summary>Text an einer Stelle ausgerichtet (x ist die linke Kante bzw. die Mitte bzw. die rechte Kante).</summary>
    public void TextAusgerichtet(float x, float b, float grundlinie, float groesse, string? text, Ausrichtung a, bool fett = false, float grau = 0)
    {
        switch (a)
        {
            case Ausrichtung.Rechts: TextRechts(x + b, grundlinie, groesse, text, fett, grau); break;
            case Ausrichtung.Mitte: TextMittig(x, b, grundlinie, groesse, text, fett, grau); break;
            default: Text(x, grundlinie, groesse, text, fett, grau); break;
        }
    }

    /// <summary>Grundlinie für senkrecht zentrierten Text in einem Kasten (Versalhöhe mittig).</summary>
    public static float Mitte(float oben, float hoehe, float groesse) => oben + hoehe / 2 + groesse * 0.35f;

    /// <summary>Text in einem Kasten: senkrecht mittig, gekürzt auf die Breite.</summary>
    public void TextImKasten(float x, float y, float b, float h, float groesse, string? text, Ausrichtung a = Ausrichtung.Links, bool fett = false, float innen = 3, float grau = 0)
    {
        var t = Satz.Kuerzen(text, b - 2 * innen, groesse, fett);
        if (t.Length == 0) return;
        TextAusgerichtet(x + innen, b - 2 * innen, Mitte(y, h, groesse), groesse, t, a, fett, grau);
    }

    /// <summary>Durchgestrichener Text (Änderungen im Schwarz-Weiß-Druck: das Bisherige wird gestrichen).</summary>
    public void Durchgestrichen(float x, float grundlinie, float groesse, string? text, bool fett = false, float grau = 0)
    {
        if (string.IsNullOrEmpty(text)) return;
        Text(x, grundlinie, groesse, text, fett, grau);
        var y = grundlinie - groesse * 0.3f;
        Linie(x - 0.5f, y, x + Satz.Breite(text, groesse, fett) + 0.5f, y, Math.Max(0.6f, groesse * 0.07f), grau);
    }

    public void Unterstrichen(float x, float grundlinie, float groesse, string? text, bool fett = false)
    {
        if (string.IsNullOrEmpty(text)) return;
        Text(x, grundlinie, groesse, text, fett);
        var y = grundlinie + groesse * 0.14f;
        Linie(x, y, x + Satz.Breite(text, groesse, fett), y, Math.Max(0.4f, groesse * 0.05f));
    }

    public void Flaeche(float x, float y, float b, float h, float grau) =>
        _sb.Append($"{F(grau)} g {F(x)} {F(Y(y + h))} {F(b)} {F(h)} re f\n");

    /// <param name="strich">Strichmuster in Punkt (z. B. 2, 1.5 für gestrichelt); leer = durchgezogen.</param>
    public void Rahmen(float x, float y, float b, float h, float staerke = 0.5f, float grau = 0, params float[] strich) =>
        _sb.Append($"{Muster(strich)}{F(grau)} G {F(staerke)} w {F(x)} {F(Y(y + h))} {F(b)} {F(h)} re S{(strich.Length > 0 ? " [] 0 d" : "")}\n");

    public void Linie(float x1, float y1, float x2, float y2, float staerke = 0.5f, float grau = 0, params float[] strich) =>
        _sb.Append($"{Muster(strich)}{F(grau)} G {F(staerke)} w {F(x1)} {F(Y(y1))} m {F(x2)} {F(Y(y2))} l S{(strich.Length > 0 ? " [] 0 d" : "")}\n");

    private static string Muster(float[] strich) => strich.Length == 0 ? "" : $"[{string.Join(" ", strich.Select(F))}] 0 d ";

    /// <summary>Schräge Schraffur (45°) in einem Rechteck – Kennzeichen für Entfall im Stundenplan.</summary>
    public void Schraffur(float x, float y, float b, float h, float abstand = 4.5f, float staerke = 0.4f, float grau = 0.55f)
    {
        _sb.Append($"q {F(x)} {F(Y(y + h))} {F(b)} {F(h)} re W n {F(grau)} G {F(staerke)} w\n");
        for (var d = -h; d < b; d += abstand)
            _sb.Append($"{F(x + d)} {F(Y(y + h))} m {F(x + d + h)} {F(Y(y))} l\n");
        _sb.Append("S Q\n");
    }

    /// <summary>Rohe Zeichenbefehle (für Sonderfälle; Koordinaten im PDF-System).</summary>
    internal void Roh(string befehle) => _sb.Append(befehle).Append('\n');
}
