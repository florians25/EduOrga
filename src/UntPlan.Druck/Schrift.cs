using System.Buffers.Binary;
using System.Collections.Concurrent;

namespace UntPlan.Druck;

/// <summary>Schriftschnitt der Druckausgabe: IBM Plex Sans Regular (400) bzw. SemiBold (600).</summary>
public enum Schnitt
{
    Normal,
    Fett,
}

/// <summary>
/// Eingebettete TrueType-Schrift (IBM Plex Sans, SIL OFL 1.1): Glyphen-Zuordnung (cmap), Breiten (hmtx) und Kennwerte für den
/// Schriftdeskriptor. Die Schriftdatei wird vollständig eingebettet (Latin-Teilmenge, rund 57 KB, im PDF komprimiert).
/// Zeichen, die die Schrift nicht kennt, werden durch eine ähnliche Darstellung ersetzt (→ wird „->“, ✓ wird „x“).
/// </summary>
public sealed class Schrift
{
    private static readonly ConcurrentDictionary<Schnitt, Schrift> Cache = new();

    public static Schrift Von(Schnitt s) => Cache.GetOrAdd(s, x => Laden(x == Schnitt.Fett ? "IBMPlexSans-SemiBold" : "IBMPlexSans-Regular",
        x == Schnitt.Fett ? "IBMPlexSans-SemiBold" : "IBMPlexSans"));

    public static Schrift Normal => Von(Schnitt.Normal);
    public static Schrift Fett => Von(Schnitt.Fett);

    public string PostScriptName { get; }
    public byte[] Daten { get; }
    public int EinheitenProEm { get; }
    public short Oberlaenge { get; }
    public short Unterlaenge { get; }
    public short Versalhoehe { get; }
    public short[] Box { get; }
    public int Gewicht { get; }
    private readonly ushort[] _breiten;
    private readonly Dictionary<int, ushort> _cmap;

    private Schrift(string name, byte[] daten)
    {
        PostScriptName = name;
        Daten = daten;
        var tabellen = new Dictionary<string, (int Start, int Laenge)>();
        var anzahl = U16(daten, 4);
        for (var i = 0; i < anzahl; i++)
        {
            var o = 12 + 16 * i;
            tabellen[System.Text.Encoding.ASCII.GetString(daten, o, 4)] = ((int)U32(daten, o + 8), (int)U32(daten, o + 12));
        }
        var head = tabellen["head"].Start;
        EinheitenProEm = U16(daten, head + 18);
        Box = new[] { S16(daten, head + 36), S16(daten, head + 38), S16(daten, head + 40), S16(daten, head + 42) };
        var hhea = tabellen["hhea"].Start;
        Oberlaenge = S16(daten, hhea + 4);
        Unterlaenge = S16(daten, hhea + 6);
        var metriken = U16(daten, hhea + 34);
        var maxp = tabellen["maxp"].Start;
        var glyphen = U16(daten, maxp + 4);
        if (tabellen.TryGetValue("OS/2", out var os2))
        {
            Gewicht = U16(daten, os2.Start + 4);
            Versalhoehe = os2.Laenge >= 90 ? S16(daten, os2.Start + 88) : (short)(Oberlaenge * 0.7);
        }
        else { Gewicht = 400; Versalhoehe = (short)(Oberlaenge * 0.7); }
        var hmtx = tabellen["hmtx"].Start;
        _breiten = new ushort[glyphen];
        ushort letzte = 0;
        for (var g = 0; g < glyphen; g++)
        {
            if (g < metriken) letzte = U16(daten, hmtx + 4 * g);
            _breiten[g] = letzte;
        }
        _cmap = Cmap(daten, tabellen["cmap"].Start);
    }

    private static Schrift Laden(string ressource, string name)
    {
        using var s = typeof(Schrift).Assembly.GetManifestResourceStream($"UntPlan.Druck.{ressource}.ttf")
                      ?? throw new InvalidOperationException($"Schrift {ressource} fehlt in UntPlan.Druck.");
        using var ms = new MemoryStream();
        s.CopyTo(ms);
        return new Schrift(name, ms.ToArray());
    }

    private static ushort U16(byte[] b, int o) => BinaryPrimitives.ReadUInt16BigEndian(b.AsSpan(o));
    private static short S16(byte[] b, int o) => BinaryPrimitives.ReadInt16BigEndian(b.AsSpan(o));
    private static uint U32(byte[] b, int o) => BinaryPrimitives.ReadUInt32BigEndian(b.AsSpan(o));

    /// <summary>Unicode → Glyphe aus der cmap (Format 4 bzw. 12, Windows Unicode bevorzugt).</summary>
    private static Dictionary<int, ushort> Cmap(byte[] b, int start)
    {
        var res = new Dictionary<int, ushort>();
        var anzahl = U16(b, start + 2);
        var beste = -1;
        var besteWert = -1;
        for (var i = 0; i < anzahl; i++)
        {
            var o = start + 4 + 8 * i;
            var plattform = U16(b, o);
            var kodierung = U16(b, o + 2);
            var wert = (plattform, kodierung) switch { (3, 10) => 4, (3, 1) => 3, (0, _) => 2, _ => 0 };
            if (wert > besteWert) { besteWert = wert; beste = start + (int)U32(b, o + 4); }
        }
        if (beste < 0) return res;
        var format = U16(b, beste);
        if (format == 4)
        {
            var segmente = U16(b, beste + 6) / 2;
            var enden = beste + 14;
            var anfaenge = enden + 2 * segmente + 2;
            var deltas = anfaenge + 2 * segmente;
            var versaetze = deltas + 2 * segmente;
            for (var s = 0; s < segmente; s++)
            {
                int ende = U16(b, enden + 2 * s), anfang = U16(b, anfaenge + 2 * s);
                var delta = S16(b, deltas + 2 * s);
                var versatz = U16(b, versaetze + 2 * s);
                for (var c = anfang; c <= ende && c != 0xFFFF; c++)
                {
                    int g;
                    if (versatz == 0) g = (c + delta) & 0xFFFF;
                    else
                    {
                        var p = versaetze + 2 * s + versatz + 2 * (c - anfang);
                        g = U16(b, p);
                        if (g != 0) g = (g + delta) & 0xFFFF;
                    }
                    if (g != 0) res[c] = (ushort)g;
                }
            }
        }
        else if (format == 12)
        {
            var gruppen = U32(b, beste + 12);
            for (var i = 0; i < gruppen; i++)
            {
                var o = beste + 16 + 12 * i;
                uint von = U32(b, o), bis = U32(b, o + 4), g = U32(b, o + 8);
                for (var c = von; c <= bis; c++) res[(int)c] = (ushort)(g + c - von);
            }
        }
        return res;
    }

    public int Glyphenzahl => _breiten.Length;

    /// <summary>Glyphe eines Zeichens (0 = nicht vorhanden).</summary>
    public ushort Glyphe(int zeichen) => _cmap.TryGetValue(zeichen, out var g) ? g : (ushort)0;

    /// <summary>Breite einer Glyphe in 1/1000 em.</summary>
    public float GlyphenBreite(ushort glyphe) => glyphe < _breiten.Length ? _breiten[glyphe] * 1000f / EinheitenProEm : 0;

    /// <summary>Ersatz für Zeichen, die die Schrift nicht enthält (Pfeile, Haken, typografische Sonderzeichen).</summary>
    private static string Ersatz(char c) => c switch
    {
        '→' or '⇒' or '➔' => "->",
        '←' or '⇐' => "<-",
        '↔' or '⇄' => "<->",
        '✓' or '✔' => "x",
        '✗' or '✘' => "x",
        '≤' => "<=",
        '≥' => ">=",
        '≠' => "!=",
        '\t' => " ",
        ' ' or ' ' or ' ' => " ",
        '‑' => "-",
        _ => "?",
    };

    /// <summary>Text in Glyphen der Schrift (mit Ersatz fehlender Zeichen); Steuerzeichen werden zu Leerzeichen.</summary>
    public List<(ushort Glyphe, int Zeichen)> Glyphen(string? text)
    {
        var res = new List<(ushort, int)>(text?.Length ?? 0);
        if (string.IsNullOrEmpty(text)) return res;
        for (var i = 0; i < text.Length; i++)
        {
            int c = text[i];
            if (char.IsHighSurrogate(text[i]) && i + 1 < text.Length && char.IsLowSurrogate(text[i + 1])) { c = char.ConvertToUtf32(text[i], text[i + 1]); i++; }
            if (c is '\r' or '\n') c = ' ';
            if (c == '­') continue; // weiches Trennzeichen
            var g = Glyphe(c);
            if (g != 0) { res.Add((g, c)); continue; }
            if (c < 0x10000)
                foreach (var e in Ersatz((char)c))
                {
                    var ge = Glyphe(e);
                    if (ge != 0) res.Add((ge, e));
                }
        }
        return res;
    }

    /// <summary>Breite eines Textes in Punkt.</summary>
    public float Breite(string? text, float groesse)
    {
        if (string.IsNullOrEmpty(text)) return 0;
        float s = 0;
        foreach (var (g, _) in Glyphen(text)) s += GlyphenBreite(g);
        return s * groesse / 1000f;
    }
}
