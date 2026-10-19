using System.Globalization;
using System.IO.Compression;
using System.Text;

namespace UntPlan.Druck;

/// <summary>
/// Schlanker PDF-Schreiber (PDF 1.4, ohne Fremdbibliothek): A4 hoch oder quer, eingebettete Schrift IBM Plex Sans (Type0/CIDFontType2,
/// Identity-H, mit ToUnicode – Text lässt sich suchen und kopieren), komprimierte Seiteninhalte, Linien, Flächen und Graustufen.
/// Koordinaten in Punkt mit Ursprung oben links (<see cref="Seite"/>).
/// </summary>
public sealed class PdfDokument
{
    public const float A4Lang = 841.89f, A4Kurz = 595.28f;
    /// <summary>Millimeter in Punkt.</summary>
    public const float Mm = 72f / 25.4f;

    private readonly List<Seite> _seiten = new();
    internal readonly Dictionary<Schnitt, SortedDictionary<ushort, int>> Genutzt = new() { [Schnitt.Normal] = new(), [Schnitt.Fett] = new() };

    public string Titel { get; set; } = "";
    public string Autor { get; set; } = "";
    public string Thema { get; set; } = "";
    public IReadOnlyList<Seite> Seiten => _seiten;

    public Seite NeueSeite(bool quer)
    {
        var s = new Seite(this, quer ? A4Lang : A4Kurz, quer ? A4Kurz : A4Lang);
        _seiten.Add(s);
        return s;
    }

    internal static string F(float v) => float.IsFinite(v) ? v.ToString("0.###", CultureInfo.InvariantCulture) : "0";

    private static string Zeichenkette(string t)
    {
        // Textzeichenkette für das Info-Wörterbuch: UTF-16BE mit BOM (Umlaute, Gedankenstriche)
        var sb = new StringBuilder("<FEFF");
        foreach (var c in t) sb.Append(((int)c).ToString("X4"));
        return sb.Append('>').ToString();
    }

    private static byte[] Packen(byte[] roh)
    {
        using var ms = new MemoryStream();
        using (var z = new ZLibStream(ms, CompressionLevel.Optimal, leaveOpen: true)) z.Write(roh);
        return ms.ToArray();
    }

    public byte[] Erzeugen()
    {
        if (_seiten.Count == 0) NeueSeite(false);
        var objekte = new List<byte[]>();
        int Reservieren() { objekte.Add(Array.Empty<byte>()); return objekte.Count; }
        void Setzen(int nr, string s) => objekte[nr - 1] = Encoding.Latin1.GetBytes(s);
        void Strom(int nr, string kopf, byte[] inhalt)
        {
            var gepackt = Packen(inhalt);
            objekte[nr - 1] = Encoding.Latin1.GetBytes($"<< {kopf}/Length {gepackt.Length} /Filter /FlateDecode >>\nstream\n").Concat(gepackt).Concat(Encoding.Latin1.GetBytes("\nendstream")).ToArray();
        }

        // 1 Katalog, 2 Seitenbaum (als erstes /Count im Dokument), 3 Info
        var katalog = Reservieren();
        var baum = Reservieren();
        var info = Reservieren();
        Setzen(katalog, "<< /Type /Catalog /Pages 2 0 R /ViewerPreferences << /DisplayDocTitle true >> /Lang (de-DE) >>");
        var jetzt = DateTime.Now;
        var zone = TimeZoneInfo.Local.GetUtcOffset(jetzt);
        var datum = $"D:{jetzt:yyyyMMddHHmmss}{(zone < TimeSpan.Zero ? '-' : '+')}{Math.Abs(zone.Hours):00}'{Math.Abs(zone.Minutes):00}'";
        Setzen(info, $"<< /Title {Zeichenkette(Titel)} /Author {Zeichenkette(Autor)} /Subject {Zeichenkette(Thema)} /Creator (EduOrga) /Producer (EduOrga Druck) /CreationDate ({datum}) >>");

        // Schriften: nur die verwendeten Schnitte
        var schriftRef = new Dictionary<Schnitt, int>();
        foreach (var (schnitt, glyphen) in Genutzt)
        {
            if (glyphen.Count == 0) continue;
            var sch = Schrift.Von(schnitt);
            var type0 = Reservieren();
            var cid = Reservieren();
            var deskriptor = Reservieren();
            var datei = Reservieren();
            var unicode = Reservieren();
            schriftRef[schnitt] = type0;
            Setzen(type0, $"<< /Type /Font /Subtype /Type0 /BaseFont /{sch.PostScriptName} /Encoding /Identity-H /DescendantFonts [{cid} 0 R] /ToUnicode {unicode} 0 R >>");
            var w = new StringBuilder();
            foreach (var g in glyphen.Keys) w.Append(g).Append(" [").Append(F(sch.GlyphenBreite(g))).Append("] ");
            Setzen(cid, $"<< /Type /Font /Subtype /CIDFontType2 /BaseFont /{sch.PostScriptName} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> " +
                        $"/FontDescriptor {deskriptor} 0 R /DW 500 /W [{w}] /CIDToGIDMap /Identity >>");
            float E(int v) => v * 1000f / sch.EinheitenProEm;
            Setzen(deskriptor, $"<< /Type /FontDescriptor /FontName /{sch.PostScriptName} /Flags 32 /FontBBox [{F(E(sch.Box[0]))} {F(E(sch.Box[1]))} {F(E(sch.Box[2]))} {F(E(sch.Box[3]))}] " +
                               $"/ItalicAngle 0 /Ascent {F(E(sch.Oberlaenge))} /Descent {F(E(sch.Unterlaenge))} /CapHeight {F(E(sch.Versalhoehe))} /StemV {(sch.Gewicht >= 600 ? 120 : 80)} " +
                               $"/FontWeight {sch.Gewicht} /FontFile2 {datei} 0 R >>");
            Strom(datei, $"/Length1 {sch.Daten.Length} ", sch.Daten);
            var cmap = new StringBuilder("/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n" +
                                         "/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n");
            foreach (var block in glyphen.Chunk(100))
            {
                cmap.Append(block.Length).Append(" beginbfchar\n");
                foreach (var (g, z) in block)
                {
                    var utf16 = char.ConvertFromUtf32(z);
                    cmap.Append($"<{g:X4}> <{string.Concat(utf16.Select(c => ((int)c).ToString("X4")))}>\n");
                }
                cmap.Append("endbfchar\n");
            }
            cmap.Append("endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n");
            Strom(unicode, "", Encoding.ASCII.GetBytes(cmap.ToString()));
        }
        var ressourcen = "<< /Font << " + string.Concat(schriftRef.Select(x => $"/{(x.Key == Schnitt.Fett ? "F2" : "F1")} {x.Value} 0 R ")) + ">> /ProcSet [/PDF /Text] >>";

        var kinder = new List<int>();
        foreach (var s in _seiten)
        {
            var seite = Reservieren();
            var inhalt = Reservieren();
            kinder.Add(seite);
            Setzen(seite, $"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {F(s.Breite)} {F(s.Hoehe)}] /Resources {ressourcen} /Contents {inhalt} 0 R >>");
            Strom(inhalt, "", Encoding.ASCII.GetBytes(s.Inhalt));
        }
        Setzen(baum, $"<< /Type /Pages /Count {_seiten.Count} /Kids [{string.Join(" ", kinder.Select(k => $"{k} 0 R"))}] >>");

        using var aus = new MemoryStream();
        void Schreiben(byte[] b) => aus.Write(b, 0, b.Length);
        Schreiben(Encoding.Latin1.GetBytes("%PDF-1.4\n%âãÏÓ\n"));
        var offsets = new List<long>();
        for (var i = 0; i < objekte.Count; i++)
        {
            offsets.Add(aus.Position);
            Schreiben(Encoding.Latin1.GetBytes($"{i + 1} 0 obj\n"));
            Schreiben(objekte[i]);
            Schreiben(Encoding.Latin1.GetBytes("\nendobj\n"));
        }
        var xref = aus.Position;
        var sb = new StringBuilder($"xref\n0 {objekte.Count + 1}\n0000000000 65535 f \n");
        foreach (var o in offsets) sb.Append($"{o:D10} 00000 n \n");
        var id = Convert.ToHexString(System.Security.Cryptography.MD5.HashData(Encoding.UTF8.GetBytes($"{Titel}|{datum}|{_seiten.Count}|{Guid.NewGuid()}")));
        sb.Append($"trailer\n<< /Size {objekte.Count + 1} /Root 1 0 R /Info 3 0 R /ID [<{id}> <{id}>] >>\nstartxref\n{xref}\n%%EOF\n");
        Schreiben(Encoding.Latin1.GetBytes(sb.ToString()));
        return aus.ToArray();
    }
}
