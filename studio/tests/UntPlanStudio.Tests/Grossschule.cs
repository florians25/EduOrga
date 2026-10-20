using UntPlan.Core;
using UntPlan.Core.Model;
using UntPlan.Core.Optimierung;

namespace UntPlanStudio.Tests;

/// <summary>
/// Große Schule für Last- und Oberflächentests der Tagesplanung: 60 Klassen (Jahrgänge 5–10, je a–j), 300 Lehrkräfte (90 mit voller
/// Stelle tragen den Unterricht der Sek. I, die übrigen haben nur wenige Stunden – Teilzeit bzw. überwiegend Oberstufe), Fachräume in
/// Gruppen, Doppelstunden in den Hauptfächern, 30 Lehrkräfte mit Bereitschaft. Der Stundenplan entsteht mit der Optimierung (fester
/// Startwert, etwa 10 s) und wird je Testlauf einmal erzeugt.
/// </summary>
public static class Grossschule
{
    static readonly Dictionary<string, Dictionary<string, int>> Tafel = new()
    {
        ["5"] = new() { ["D"] = 4, ["M"] = 4, ["E"] = 4, ["BI"] = 2, ["EK"] = 2, ["GE"] = 1, ["PK"] = 1, ["KR"] = 2, ["KU"] = 2, ["MU"] = 2, ["SP"] = 3, ["KL"] = 1 },
        ["6"] = new() { ["D"] = 4, ["M"] = 4, ["E"] = 4, ["F"] = 3, ["BI"] = 2, ["PH"] = 2, ["GE"] = 2, ["KR"] = 2, ["KU"] = 2, ["MU"] = 1, ["SP"] = 3 },
        ["7"] = new() { ["D"] = 4, ["M"] = 4, ["E"] = 3, ["F"] = 3, ["BI"] = 2, ["PH"] = 2, ["CH"] = 2, ["EK"] = 2, ["GE"] = 2, ["KR"] = 2, ["SP"] = 3 },
        ["8"] = new() { ["D"] = 4, ["M"] = 4, ["E"] = 4, ["F"] = 3, ["BI"] = 2, ["PH"] = 2, ["CH"] = 2, ["PK"] = 2, ["KR"] = 2, ["KU"] = 2, ["SP"] = 3 },
        ["9"] = new() { ["D"] = 4, ["M"] = 4, ["E"] = 3, ["F"] = 3, ["BI"] = 2, ["PH"] = 2, ["CH"] = 2, ["GE"] = 2, ["EK"] = 2, ["KR"] = 2, ["MU"] = 2, ["SP"] = 3 },
        ["10"] = new() { ["D"] = 4, ["M"] = 4, ["E"] = 4, ["F"] = 3, ["BI"] = 2, ["PH"] = 2, ["CH"] = 2, ["GE"] = 2, ["PK"] = 2, ["KR"] = 2, ["IF"] = 2, ["SP"] = 3 },
    };
    static readonly string[] Nachnamen = ("Müller Schmidt Schneider Fischer Weber Meyer Wagner Becker Schulz Hoffmann Koch Richter Klein Wolf Schröder Neumann Schwarz Braun Zimmermann Krüger " +
        "Hartmann Lange Werner Krause Lehmann Köhler Herrmann König Walter Mayer Huber Kaiser Fuchs Peters Lang Scholz Möller Weiß Jung Hahn Schubert Vogel Friedrich Keller Günther " +
        "Frank Berger Winkler Roth Beck Lorenz Baumann Franke Albrecht Schuster Simon Ludwig Böhm Winter Kraus Martin Schumacher Krämer Vogt Stein Jäger Otto Sommer Groß Seidel " +
        "Heinrich Brandt Haas Schreiber Graf Schulte Dietrich Ziegler Kuhn Kühn Pohl Engel Horn Busch Bergmann Thomas Voigt Sauer Arnold Wolff Pfeiffer Ernst Brinkmann Wendt " +
        "Lindner Ebert Kremer Dahl Ostermann Petersen Hansen Jansen Brockmann Overbeck").Split(' ');
    static readonly string[] Vornamen = ("Anna Thomas Julia Michael Sabine Andreas Katrin Stefan Nina Markus Laura Jan Claudia Tobias Sarah Frank Lena Daniel Petra Christian Miriam Jörg " +
        "Eva Martin Lisa Kai Sandra Oliver Ute Sven Ines Ralf Carla Timo Hanna Felix Marie Jonas Birgit Uwe").Split(' ');

    private static readonly Lazy<byte[]> Verplant = new(() =>
    {
        var d = Schule();
        var erg = Optimierer.Optimieren(d, new OptimierungsOptionen { AnzahlPlaene = 1, Schritte = 1, Seed = 1 });
        if (erg.Count > 0) d.AktivePeriode.Plan = erg[0].Plan;
        return Hilfen.AlsUp(d);
    });

    /// <summary>Verplante große Schule als Schuldatei (*.up, JSON).</summary>
    public static byte[] AlsUp() => Verplant.Value;

    /// <summary>Schuldatei ohne Stundenplan: 6 Jahrgänge × <paramref name="jeJahrgang"/> Klassen, <paramref name="anzahlLehrer"/> Lehrkräfte.</summary>
    public static Schuldatei Schule(int jeJahrgang = 10, int anzahlLehrer = 300)
    {
        var d = Demo.NeueDatei("Gesamtschule Großstadt", "GY");
        Fach F(string k) => d.Faecher.First(f => f.Kurzname == k);
        var hof = new Gang { Id = d.NeueId(), Kurzname = "Hof", Langname = "Schulhof", Bedarf = 4 };
        d.Gaenge.Add(hof);
        Raum R(string k, string l, string art = "", int kap = 30) { var r = new Raum { Id = d.NeueId(), Kurzname = k, Langname = l, Raumart = art, Kapazitaet = kap, Raumgewicht = 2, GangId = hof.Id, Sortierung = d.Raeume.Count }; d.Raeume.Add(r); return r; }
        Raumgruppe G(string k, string l, IEnumerable<Raum> r) { var g = new Raumgruppe { Id = d.NeueId(), Kurzname = k, Langname = l, RaumIds = r.Select(x => x.Id).ToList() }; d.Raumgruppen.Add(g); return g; }
        F("SP").FachraumgruppeId = G("TH", "Sporthallen", Enumerable.Range(1, 6).Select(i => R($"TH{i}", $"Sporthalle {i}", "Sporthalle", 60))).Id;
        F("SP").Doppelstunden = new Bereich(1, 1);
        foreach (var (f, k, n, z) in new[] { ("PH", "PH", "Physik", 4), ("CH", "CH", "Chemie", 4), ("BI", "BI", "Biologie", 5), ("KU", "KU", "Kunst", 4), ("MU", "MU", "Musik", 4), ("IF", "EDV", "Computerraum", 3) })
            F(f).FachraumgruppeId = G(k, $"{n}räume", Enumerable.Range(1, z).Select(i => R($"{k}{i}", $"{n} {i}", "Fachraum"))).Id;
        F("KU").Doppelstunden = new Bereich(1, 1);
        F("KR").Randstunde = true;

        var buchst = "abcdefghijklmnop";
        var klassen = new List<Klasse>();
        foreach (var jg in Tafel.Keys)
            for (var i = 0; i < jeJahrgang; i++)
            {
                var raum = R($"{jg}.{i + 1:00}", $"Klassenraum {jg}{buchst[i]}");
                var k = new Klasse { Id = d.NeueId(), Kurzname = jg + buchst[i], Langname = $"Klasse {jg}{buchst[i]}", Jahrgang = jg, StammraumId = raum.Id, HauptfaecherProTag = 3,
                    Mittagspause = new Bereich(1, 1), StundenProTag = new Bereich(4, 7), MaxNachmittage = 2, Sortierung = klassen.Count, SchuelerMaennlich = 13, SchuelerWeiblich = 14 };
                for (var t = 0; t < 5; t++) { for (var s = 1; s <= 5; s++) k.Zeitwuensche.Set(t, s, 3); k.Zeitwuensche.Set(t, 8, -2); k.Zeitwuensche.Set(t, 9, -3); k.Zeitwuensche.Set(t, 10, -3); }
                klassen.Add(k);
            }
        d.Klassen.AddRange(klassen);

        // Lehrkräfte: je zwei Fächer; ein Drittel mit wenigen Stunden in der Sek. I (Teilzeit bzw. überwiegend Oberstufe)
        string[] faecher = { "D", "M", "E", "F", "BI", "PH", "CH", "EK", "GE", "PK", "KR", "KU", "MU", "SP", "IF" };
        int[] gewicht = { 9, 9, 8, 4, 4, 3, 3, 2, 3, 2, 2, 2, 2, 5, 1 };
        var pool = faecher.SelectMany((f, i) => Enumerable.Repeat(f, gewicht[i])).ToArray();
        var rnd = new Random(11);
        var kurz = new HashSet<string>();
        for (var i = 0; i < anzahlLehrer; i++)
        {
            var n = Nachnamen[i % Nachnamen.Length];
            var v = Vornamen[(i * 7 + i / Nachnamen.Length) % Vornamen.Length];
            var k = Kuerzel(n, kurz);
            var f1 = pool[rnd.Next(pool.Length)];
            string f2; do f2 = pool[rnd.Next(pool.Length)]; while (f2 == f1);
            var soll = i % 10 < 3 ? 25.5m : 1.5m;
            d.Lehrer.Add(new Lehrer { Id = d.NeueId(), Kurzname = k, Langname = n, Vorname = v, Wochensoll = soll, FaecherIds = new() { F(f1).Id, F(f2).Id },
                Hohlstunden = new Bereich(0, 3), StundenProTag = new Bereich(1, 6), MaxNachmittage = 2, VertretungenMaxWoche = 3, Sortierung = i,
                Email = $"{k.ToLowerInvariant()}@grossstadt-gesamtschule.de" });
        }
        foreach (var (jg, zeilen) in Tafel)
            foreach (var (fk, std) in zeilen) d.Stundentafel.Add(new StundentafelZeile { Jahrgang = jg, FachId = F(fk).Id, Stunden = std });

        var last = new Dictionary<int, decimal>();
        Lehrer Waehle(string fach) => d.Lehrer.Where(l => l.FaecherIds.Contains(F(fach).Id)).DefaultIfEmpty(d.Lehrer[0])
            .OrderBy(l => (last.GetValueOrDefault(l.Id) + 0.01m) / Math.Max(1, l.Wochensoll)).First();
        foreach (var k in klassen)
        {
            foreach (var (fk, std) in Tafel[k.Jahrgang])
            {
                var l = Waehle(fk);
                last[l.Id] = last.GetValueOrDefault(l.Id) + std;
                var f = F(fk);
                d.Unterrichte.Add(new Unterricht
                {
                    Id = d.NeueId(), Wochenstunden = std, Doppelstunden = f.Doppelstunden.IstLeer ? (std >= 3 ? new Bereich(1, 1) : default) : f.Doppelstunden,
                    Zeilen = { new Kopplungszeile { LehrerId = l.Id, FachId = f.Id, KlassenIds = { k.Id }, FachraumgruppeId = f.FachraumgruppeId, StammraumId = k.StammraumId } },
                });
            }
            k.KlassenlehrerIds = d.Unterrichte.Where(u => u.KlassenIds.Contains(k.Id) && u.HauptfachId == F("D").Id).SelectMany(u => u.LehrerIds).Take(1).ToList();
        }
        // Bereitschaften: 30 Lehrkräfte mit je 2 Bereitschaftsstunden
        foreach (var l in d.Lehrer.Where((_, i) => i % 10 == 4))
            d.Unterrichte.Add(new Unterricht { Id = d.NeueId(), Wochenstunden = 2, MehrmalsProTag = true, Text = "Bereitschaft", Zeilen = { new Kopplungszeile { LehrerId = l.Id, FachId = F("BER").Id } } });
        Dokument.Normalisieren(d);
        return d;
    }

    static string Kuerzel(string name, HashSet<string> vergeben)
    {
        var b = new string(name.ToUpperInvariant().Replace("Ä", "AE").Replace("Ö", "OE").Replace("Ü", "UE").Replace("ß", "SS").Where(char.IsLetter).ToArray());
        for (var i = 1; i < b.Length; i++)
            for (var j = i + 1; j < b.Length; j++)
            {
                var k = $"{b[0]}{b[i]}{b[j]}";
                if (vergeben.Add(k)) return k;
            }
        for (var c = 'A'; c <= 'Z'; c++) { var k = $"{b[0]}{b[1]}{c}"; if (vergeben.Add(k)) return k; }
        throw new InvalidOperationException(name);
    }
}
