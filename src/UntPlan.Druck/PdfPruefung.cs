using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Text.RegularExpressions;

namespace UntPlan.Druck;

/// <summary>
/// Prüfhilfe für Tests: liest PDF-Dateien von <see cref="PdfDokument"/> (Seitenzahl, Seitengröße, Text je Seite über die
/// ToUnicode-Tabellen der eingebetteten Schriften). Kein allgemeiner PDF-Leser.
/// </summary>
public static partial class PdfPruefung
{
    private sealed record Objekt(int Nr, string Kopf, byte[]? Strom);

    [GeneratedRegex(@"(\d+) 0 obj\n", RegexOptions.CultureInvariant)]
    private static partial Regex ObjRegex();

    private static List<Objekt> Objekte(byte[] pdf)
    {
        var text = Encoding.Latin1.GetString(pdf);
        var res = new List<Objekt>();
        foreach (Match m in ObjRegex().Matches(text))
        {
            var start = m.Index + m.Length;
            var ende = text.IndexOf("\nendobj", start, StringComparison.Ordinal);
            if (ende < 0) continue;
            var inhalt = text[start..ende];
            var si = inhalt.IndexOf(">>\nstream\n", StringComparison.Ordinal);
            if (si < 0) { res.Add(new Objekt(int.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture), inhalt, null)); continue; }
            var kopf = inhalt[..(si + 2)];
            var laenge = int.Parse(Regex.Match(kopf, @"/Length (\d+)").Groups[1].Value, CultureInfo.InvariantCulture);
            var daten = pdf.AsSpan(start + si + 10, laenge).ToArray();
            if (kopf.Contains("/FlateDecode"))
            {
                using var z = new ZLibStream(new MemoryStream(daten), CompressionMode.Decompress);
                using var ms = new MemoryStream();
                z.CopyTo(ms);
                daten = ms.ToArray();
            }
            res.Add(new Objekt(int.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture), kopf, daten));
        }
        return res;
    }

    public static int Seitenzahl(byte[] pdf) =>
        int.Parse(Regex.Match(Encoding.Latin1.GetString(pdf), @"/Type /Pages /Count (\d+)").Groups[1].Value, CultureInfo.InvariantCulture);

    /// <summary>Seitengrößen in Punkt (Breite, Höhe).</summary>
    public static List<(float Breite, float Hoehe)> Seitengroessen(byte[] pdf) =>
        Regex.Matches(Encoding.Latin1.GetString(pdf), @"/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]")
            .Select(m => (float.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture), float.Parse(m.Groups[2].Value, CultureInfo.InvariantCulture))).ToList();

    /// <summary>Text je Seite (Zeilen nach Grundlinie sortiert, Textstücke einer Zeile mit Leerzeichen getrennt).</summary>
    public static List<string> Texte(byte[] pdf)
    {
        var objekte = Objekte(pdf).ToDictionary(o => o.Nr);
        // Schrift-Ressource → Glyphe → Text
        var schriften = new Dictionary<string, Dictionary<string, string>>();
        foreach (var o in objekte.Values.Where(o => o.Kopf.Contains("/Subtype /Type0")))
        {
            var tu = Regex.Match(o.Kopf, @"/ToUnicode (\d+) 0 R");
            if (!tu.Success || !objekte.TryGetValue(int.Parse(tu.Groups[1].Value, CultureInfo.InvariantCulture), out var cmap) || cmap.Strom is null) continue;
            var map = new Dictionary<string, string>();
            foreach (Match m in Regex.Matches(Encoding.ASCII.GetString(cmap.Strom), @"<([0-9A-F]{4})> <([0-9A-F]+)>"))
            {
                var hex = m.Groups[2].Value;
                var sb = new StringBuilder();
                for (var i = 0; i + 4 <= hex.Length; i += 4) sb.Append((char)Convert.ToInt32(hex.Substring(i, 4), 16));
                map[m.Groups[1].Value] = sb.ToString();
            }
            schriften[o.Nr.ToString(CultureInfo.InvariantCulture)] = map;
        }
        var res = new List<string>();
        foreach (var seite in objekte.Values.Where(o => o.Kopf.Contains("/Type /Page ")).OrderBy(o => o.Nr))
        {
            var fonts = Regex.Matches(seite.Kopf, @"/(F\d) (\d+) 0 R").ToDictionary(m => m.Groups[1].Value, m => m.Groups[2].Value);
            var inhalt = objekte[int.Parse(Regex.Match(seite.Kopf, @"/Contents (\d+) 0 R").Groups[1].Value, CultureInfo.InvariantCulture)];
            var stuecke = new List<(float X, float Y, string Text)>();
            foreach (Match m in Regex.Matches(Encoding.ASCII.GetString(inhalt.Strom!), @"/(F\d) [\d.]+ Tf ([\d.-]+) ([\d.-]+) Td <([0-9A-F]*)> Tj"))
            {
                var map = fonts.TryGetValue(m.Groups[1].Value, out var nr) && schriften.TryGetValue(nr, out var mm) ? mm : new();
                var hex = m.Groups[4].Value;
                var sb = new StringBuilder();
                for (var i = 0; i + 4 <= hex.Length; i += 4) sb.Append(map.GetValueOrDefault(hex.Substring(i, 4), "?"));
                stuecke.Add((float.Parse(m.Groups[2].Value, CultureInfo.InvariantCulture), float.Parse(m.Groups[3].Value, CultureInfo.InvariantCulture), sb.ToString()));
            }
            var zeilen = stuecke.GroupBy(s => MathF.Round(s.Y / 2)).OrderByDescending(g => g.Key).Select(g => string.Join(" ", g.OrderBy(s => s.X).Select(s => s.Text)));
            res.Add(string.Join("\n", zeilen));
        }
        return res;
    }

    /// <summary>Gesamter Text aller Seiten.</summary>
    public static string Text(byte[] pdf) => string.Join("\n\f\n", Texte(pdf));
}
