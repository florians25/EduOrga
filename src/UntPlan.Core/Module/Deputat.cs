using System.Text;
using UntPlan.Core.Model;

namespace UntPlan.Core.Module;

/// <summary>
/// Deputat und Unterrichtsverteilung: Pflichtstunden je Schulform × Beschäftigungsumfang, Ermäßigungen (Alter,
/// Schwerbehinderung, sonstige), Anrechnungsstunden und Leitungszeit, Mehrarbeit/Vorgriff → Soll; Ist aus der Wertrechnung;
/// Summen der Schule (Stellen, Anrechnungstopf, Leitungszeit) und die Verteilungsmatrix Lehrkräfte × Klassen bzw. Fächer.
/// Die Landesregeln stehen im <see cref="Landesprofil"/> (NRW: VO zu § 93 Abs. 2 SchulG, Quellen in
/// studio/docs/RECHERCHE-DEPUTAT-NRW.md). Alle Werte sind Voreinstellungen, die Schule kann jede Zahl von Hand überschreiben.
/// </summary>
public static class Deputat
{
    // ------------------------------------------------------------------------------------------ Landesprofile

    public sealed record Landesprofil(
        string Kuerzel,
        string Name,
        IReadOnlyDictionary<string, decimal> Pflichtstunden,
        IReadOnlyDictionary<string, decimal> AnrechnungJeStelle,
        decimal AnrechnungJeStelleSekII,
        bool Landesregeln,
        string Rechtsgrundlage);

    /// <summary>NRW, Schuljahr 2025/26 und 2026/27 (VO zu § 93 Abs. 2 SchulG – BASS 11-11 Nr. 1).</summary>
    public static readonly Landesprofil Nrw = new(
        "NW", "Nordrhein-Westfalen",
        new Dictionary<string, decimal>
        {
            ["GS"] = 28, ["HS"] = 28, ["RS"] = 28, ["SK"] = 25.5m, ["GE"] = 25.5m, ["GY"] = 25.5m, ["BK"] = 25.5m, ["FS"] = 27.5m,
            ["PS"] = 25.5m, ["WB"] = 25,
        },
        new Dictionary<string, decimal>
        {
            ["GS"] = 0.2m, ["HS"] = 0.6m, ["RS"] = 0.5m, ["SK"] = 0.5m, ["GE"] = 0.5m, ["GY"] = 0.5m, ["BK"] = 0.5m, ["FS"] = 0.4m,
            ["PS"] = 0.5m, ["WB"] = 1.0m,
        },
        1.2m, true,
        "VO zu § 93 Abs. 2 SchulG (BASS 11-11 Nr. 1): § 2 Pflichtstunden, Alters- und Schwerbehindertenermäßigung, Anrechnungsstunden; § 5 Leitungszeit");

    /// <summary>Ohne Landesregeln: Pflichtstunden nur aus dem Wochensoll, keine automatischen Ermäßigungen, Topf von Hand.</summary>
    public static readonly Landesprofil Allgemein = new(
        "Allgemein", "Allgemein (ohne Landesregeln)",
        new Dictionary<string, decimal>(), new Dictionary<string, decimal>(), 0, false,
        "Keine Landesregeln hinterlegt – Pflichtstunden, Ermäßigungen, Anrechnungstopf und Leitungszeit werden von Hand eingetragen.");

    public static readonly Landesprofil[] Profile = { Nrw, Allgemein };

    public static Landesprofil Profil(Schuldatei d) =>
        Profile.FirstOrDefault(p => string.Equals(p.Kuerzel, d.Einstellungen.Deputat?.Bundesland, StringComparison.OrdinalIgnoreCase)) ?? Nrw;

    private static DeputatEinstellungen E(Schuldatei d) => d.Einstellungen.Deputat ??= new DeputatEinstellungen();

    /// <summary>Pflichtstunden einer Vollzeitkraft der Schulform (Profil; ohne Eintrag: höchstes Wochensoll der Schule bzw. 25,5).</summary>
    public static decimal PflichtstundenSchulform(Schuldatei d)
    {
        var p = Profil(d);
        if (p.Pflichtstunden.TryGetValue(d.Einstellungen.Schulform, out var w)) return w;
        var max = d.Lehrer.Where(l => !l.Ignorieren).Select(l => l.Wochensoll).DefaultIfEmpty(0).Max();
        return max > 0 ? max : 25.5m;
    }

    public static decimal Pflichtstunden(Schuldatei d, Lehrer l) => l.PflichtstundenAbweichend is > 0 ? l.PflichtstundenAbweichend.Value : PflichtstundenSchulform(d);

    // ------------------------------------------------------------------------------------------ NRW-Regeln (rein, testbar)

    /// <summary>Beginn des Schuljahres (1. August, § 7 SchulG NRW), in dem das Datum liegt.</summary>
    public static DateOnly Schuljahresbeginn(DateOnly datum) => new(datum.Month >= 8 ? datum.Year : datum.Year - 1, 8, 1);

    /// <summary>
    /// Wurde das <paramref name="jahre"/>. Lebensjahr vor Beginn des Schuljahres vollendet? Die Ermäßigung gilt „vom Beginn
    /// des Schuljahres an, das auf die Vollendung folgt“; vollendet ist ein Lebensjahr mit Ablauf des Tages vor dem Geburtstag.
    /// Beispiele (Bezirksregierung Münster): geb. 25.07.1957 → ab 01.08.2012, geb. 02.08.1957 → ab 01.08.2013.
    /// </summary>
    public static bool Vollendet(DateOnly geburt, int jahre, DateOnly schuljahresbeginn) => geburt.AddYears(jahre) <= schuljahresbeginn;

    /// <summary>Altersermäßigung NRW (§ 2 Abs. 2 VO zu § 93 Abs. 2 SchulG) in Wochenstunden.</summary>
    /// <param name="ab55">55. Lebensjahr vor Schuljahresbeginn vollendet</param>
    /// <param name="ab60">60. Lebensjahr vor Schuljahresbeginn vollendet</param>
    /// <param name="anteil">Beschäftigungsumfang als Anteil der Pflichtstunden (1 = Vollzeit)</param>
    /// <param name="vollzeit">Vollzeit oder höchstens eine Stunde unter den Pflichtstunden</param>
    public static decimal AltersermaessigungNrw(bool ab55, bool ab60, decimal anteil, bool vollzeit)
    {
        if (ab60) return vollzeit ? 3m : anteil >= 0.75m ? 2m : anteil >= 0.5m ? 1.5m : 0m;
        if (ab55) return vollzeit ? 1m : anteil >= 0.5m ? 0.5m : 0m;
        return 0m;
    }

    /// <summary>Schwerbehindertenermäßigung NRW (§ 2 Abs. 3 VO zu § 93 Abs. 2 SchulG) nach Grad der Behinderung.</summary>
    public static decimal SchwerbehinderungNrw(int gdb, decimal anteil, bool vollzeit)
    {
        var (vz, d4, h) = gdb >= 90 ? (4m, 3m, 2m) : gdb >= 70 ? (3m, 2m, 1.5m) : gdb >= 50 ? (2m, 1.5m, 1m) : (0m, 0m, 0m);
        return vollzeit ? vz : anteil >= 0.75m ? d4 : anteil >= 0.5m ? h : 0m;
    }

    /// <summary>Kaufmännisch runden (Bruchteile unter 0,5 ab, sonst auf) – AVO-Rundung für Topf und Leitungszeit.</summary>
    public static decimal Runden(decimal x) => Math.Round(x, 0, MidpointRounding.AwayFromZero);

    /// <summary>Leitungszeit NRW (§ 5 VO zu § 93 Abs. 2 SchulG): 9 + 0,7 je Stelle bis zur 50. + 0,3 je weitere; Grundschule +2, offener Ganztag +1.</summary>
    public static decimal LeitungszeitNrw(decimal stellen, bool grundschule, bool offenerGanztag)
    {
        if (stellen <= 0) return 0;
        var x = 9m + 0.7m * Math.Min(stellen, 50m) + 0.3m * Math.Max(stellen - 50m, 0m);
        return Runden(x) + (grundschule ? 2m : 0m) + (grundschule && offenerGanztag ? 1m : 0m);
    }

    /// <summary>Allgemeine Anrechnungsstunden (§ 2 Abs. 5): Grundstellen × Faktor der Schulform (+ Sek II × 1,2), gerundet.</summary>
    public static decimal AnrechnungstopfNrw(string schulform, decimal grundstellen, decimal grundstellenSekII) =>
        Runden(grundstellen * Nrw.AnrechnungJeStelle.GetValueOrDefault(schulform, 0.5m) + grundstellenSekII * Nrw.AnrechnungJeStelleSekII);

    // ------------------------------------------------------------------------------------------ Lehrkraft

    public enum PostenArt { Ermaessigung, Anrechnung, Leitung }

    /// <summary>Art eines Ermäßigungs-Eintrags: ausdrücklich gesetzt oder am Grund erkannt.</summary>
    public static PostenArt ArtVon(Ermaessigung e)
    {
        switch ((e.Art ?? "").Trim().ToLowerInvariant())
        {
            case "anrechnung": return PostenArt.Anrechnung;
            case "leitung": case "leitungszeit": return PostenArt.Leitung;
            case "ermaessigung": case "ermäßigung": return PostenArt.Ermaessigung;
        }
        var g = (e.Grund ?? "").ToLowerInvariant();
        if (g.Contains("leitung") && !g.Contains("fachleitung") && !g.Contains("stufenleitung") && !g.Contains("fachbereichsleitung")) return PostenArt.Leitung;
        if (g.Contains("anrechnung") || g.Contains("topf")) return PostenArt.Anrechnung;
        return PostenArt.Ermaessigung;
    }

    private static bool IstAlter(Ermaessigung e) => (e.Grund ?? "").Contains("alter", StringComparison.OrdinalIgnoreCase);
    private static bool IstSchwerbehinderung(Ermaessigung e)
    {
        var g = (e.Grund ?? "").ToLowerInvariant();
        return g.Contains("schwerbehind") || g.Contains("gdb") || g == "sb";
    }

    public sealed record Posten(PostenArt Art, string Grund, decimal Stunden, bool Automatisch);

    public sealed record LehrerDeputat(
        Lehrer Lehrer,
        decimal Pflichtstunden,
        decimal Umfang,
        decimal Anteil,
        bool Vollzeit,
        int? Alter,
        decimal Altersermaessigung,
        decimal Schwerbehinderung,
        decimal SonstigeErmaessigung,
        decimal Anrechnung,
        decimal Leitung,
        decimal Mehrarbeit,
        decimal Soll,
        decimal Ist,
        decimal Differenz,
        List<Posten> Posten,
        List<string> Hinweise)
    {
        public decimal Ermaessigungen => Altersermaessigung + Schwerbehinderung + SonstigeErmaessigung;
    }

    /// <summary>Lebensalter am Stichtag (aus Geburtsdatum, sonst Geburtsjahr; null = unbekannt).</summary>
    public static int? Lebensalter(Lehrer l, DateOnly stichtag)
    {
        if (l.Geburtsdatum is DateOnly g)
        {
            var a = stichtag.Year - g.Year;
            if (g.AddYears(a) > stichtag) a--;
            return a;
        }
        return l.Geburtsjahr is int j and > 1900 ? stichtag.Year - j - 1 : null;
    }

    /// <summary>Deputatsrechnung einer Lehrkraft für das Schuljahr der Schuldatei.</summary>
    public static LehrerDeputat Berechnen(Schuldatei d, DatenIndex ix, Lehrer l, DateOnly? schuljahresbeginn = null, bool mitIst = true)
    {
        var p = Profil(d);
        var e = E(d);
        var beginn = schuljahresbeginn ?? Schuljahresbeginn(d.Einstellungen.SchuljahrVon);
        var hinweise = new List<string>();
        var posten = new List<Posten>();
        var pflicht = Pflichtstunden(d, l);
        var umfang = l.Wochensoll;
        var anteil = pflicht > 0 ? umfang / pflicht : 0;
        // „Wird die Zahl der Pflichtstunden um nicht mehr als eine Stunde verringert, wird die volle Ermäßigung gewährt.“
        var vollzeit = umfang >= pflicht - 1m && umfang > 0;
        if (umfang <= 0) hinweise.Add("Kein Beschäftigungsumfang (Wochensoll) eingetragen.");
        else if (umfang > pflicht) hinweise.Add($"Beschäftigungsumfang über den Pflichtstunden ({umfang:0.##} > {pflicht:0.##}).");

        decimal sonst = 0, anr = 0, leit = 0;
        foreach (var x in l.Ermaessigungen)
        {
            var art = ArtVon(x);
            posten.Add(new Posten(art, x.Grund, x.Wert, false));
            switch (art)
            {
                case PostenArt.Anrechnung: anr += x.Wert; break;
                case PostenArt.Leitung: leit += x.Wert; break;
                default: sonst += x.Wert; break;
            }
        }

        // Alter: Lebensalter am Schuljahresbeginn; Ermäßigung, wenn das 55./60. Lebensjahr davor vollendet wurde
        var alter = Lebensalter(l, beginn);
        decimal alt = 0, sb = 0;
        var manuellAlter = l.Ermaessigungen.Any(IstAlter);
        var manuellSb = l.Ermaessigungen.Any(IstSchwerbehinderung);
        if (p.Landesregeln && e.AutomatischeErmaessigungen && umfang > 0)
        {
            if (!l.OhneAltersermaessigung && !manuellAlter)
            {
                bool ab55, ab60;
                if (l.Geburtsdatum is DateOnly g) { ab55 = Vollendet(g, 55, beginn); ab60 = Vollendet(g, 60, beginn); }
                else if (l.Geburtsjahr is int j and > 1900)
                {
                    // nur das Jahr bekannt: sicher erst, wenn das Lebensjahr im Vorjahr vollendet wurde
                    ab55 = beginn.Year - j > 55; ab60 = beginn.Year - j > 60;
                    if (beginn.Year - j is 55 or 60) hinweise.Add("Nur das Geburtsjahr ist bekannt – ob die Altersermäßigung schon gilt, hängt vom Geburtstag ab (bis 1. August).");
                }
                else { ab55 = ab60 = false; }
                alt = AltersermaessigungNrw(ab55, ab60, anteil, vollzeit);
                if (alt > 0) posten.Add(new Posten(PostenArt.Ermaessigung, ab60 ? "Altersermäßigung ab 60" : "Altersermäßigung ab 55", alt, true));
                else if ((ab55 || ab60) && anteil < 0.5m) hinweise.Add("Keine Altersermäßigung: Beschäftigungsumfang unter 50 %.");
            }
            if (!manuellSb && l.Gdb >= 50)
            {
                sb = SchwerbehinderungNrw(l.Gdb, anteil, vollzeit);
                if (sb > 0) posten.Add(new Posten(PostenArt.Ermaessigung, $"Schwerbehinderung (GdB {l.Gdb})", sb, true));
                else hinweise.Add("Keine Schwerbehindertenermäßigung: Beschäftigungsumfang unter 50 %.");
            }
        }
        if (manuellAlter && l.Geburtsdatum.HasValue && p.Landesregeln) hinweise.Add("Altersermäßigung ist von Hand eingetragen (wird nicht berechnet).");

        var soll = umfang - alt - sb - sonst - anr - leit + l.Mehrarbeit;
        if (soll < 0) { hinweise.Add("Ermäßigungen und Anrechnungen übersteigen den Beschäftigungsumfang."); soll = 0; }
        var ist = mitIst ? Wertrechnung.Ist(d, ix, l) : 0;
        return new LehrerDeputat(l, pflicht, umfang, anteil, vollzeit, alter, alt, sb, sonst, anr, leit, l.Mehrarbeit, soll, ist, ist - soll, posten, hinweise);
    }

    /// <summary>Soll einer Lehrkraft (für Wertrechnung und Lehrervorschlag).</summary>
    public static decimal Soll(Schuldatei d, DatenIndex ix, Lehrer l) => Berechnen(d, ix, l, mitIst: false).Soll;

    // ------------------------------------------------------------------------------------------ Schule

    public sealed record Schulsummen(
        decimal Pflichtstunden,
        decimal Stellen,
        decimal Grundstellen,
        bool GrundstellenGeschaetzt,
        decimal Umfang,
        decimal Soll,
        decimal Ist,
        decimal Unterrichtsbedarf,
        decimal Offen,
        decimal Ermaessigungen,
        decimal Mehrarbeit,
        decimal Stellenbedarf,
        decimal AnrechnungVerfuegbar,
        decimal AnrechnungVerwendet,
        decimal LeitungVerfuegbar,
        decimal LeitungVerwendet,
        int Ueber,
        int Unter);

    /// <summary>Wert aller nicht ignorierten Kopplungszeilen (wie die Wertrechnung) – Unterrichtsbedarf; offen = ohne Lehrkraft.</summary>
    public static (decimal Bedarf, decimal Offen) Unterrichtsbedarf(Schuldatei d, DatenIndex ix)
    {
        decimal bedarf = 0, offen = 0;
        foreach (var u in d.Unterrichte.Where(u => !u.Ignorieren))
            foreach (var z in u.Zeilen.Where(z => z.FachId.HasValue || z.LehrerId.HasValue))
            {
                var w = Wertrechnung.Wert(d, ix, u, z);
                bedarf += w;
                if (z.LehrerId is null) offen += w;
            }
        return (bedarf, offen);
    }

    public static Schulsummen Summen(Schuldatei d, DatenIndex ix, IReadOnlyList<LehrerDeputat> liste)
    {
        var p = Profil(d);
        var e = E(d);
        var pflicht = PflichtstundenSchulform(d);
        var umfang = liste.Sum(x => x.Umfang);
        var stellen = liste.Sum(x => x.Pflichtstunden > 0 ? x.Umfang / x.Pflichtstunden : 0);
        var geschaetzt = e.Grundstellen <= 0;
        var grund = geschaetzt ? Math.Round(stellen * 2, MidpointRounding.AwayFromZero) / 2 : e.Grundstellen;
        var (bedarf, offen) = Unterrichtsbedarf(d, ix);
        var erm = liste.Sum(x => x.Ermaessigungen + x.Anrechnung + x.Leitung);
        var mehr = liste.Sum(x => x.Mehrarbeit);
        var topf = e.Anrechnungstopf ?? (p.Landesregeln ? AnrechnungstopfNrw(d.Einstellungen.Schulform, grund, e.GrundstellenSekII) : 0);
        var leitung = e.Leitungszeit ?? (p.Landesregeln ? LeitungszeitNrw(grund + e.GrundstellenSekII, d.Einstellungen.Schulform == "GS", e.OffenerGanztag) : 0);
        var tol = e.Toleranz;
        return new Schulsummen(pflicht, stellen, grund, geschaetzt, umfang, liste.Sum(x => x.Soll), liste.Sum(x => x.Ist), bedarf, offen, erm, mehr,
            pflicht > 0 ? (bedarf + erm - mehr) / pflicht : 0, topf, liste.Sum(x => x.Anrechnung), leitung, liste.Sum(x => x.Leitung),
            liste.Count(x => x.Differenz > tol), liste.Count(x => x.Differenz < -tol && x.Soll > 0));
    }

    public static List<LehrerDeputat> Alle(Schuldatei d, DatenIndex ix) =>
        d.Lehrer.Where(l => !l.Ignorieren).Select(l => Berechnen(d, ix, l)).ToList();

    // ------------------------------------------------------------------------------------------ Unterrichtsverteilung

    /// <summary>Eine offene Kopplungszeile (Fach ohne Lehrkraft).</summary>
    public sealed record OffeneZeile(Unterricht Unterricht, int Zeile, Kopplungszeile Kz, decimal Wert);

    public static List<OffeneZeile> Offen(Schuldatei d, DatenIndex ix) =>
        d.Unterrichte.Where(u => !u.Ignorieren)
            .SelectMany(u => u.Zeilen.Select((z, i) => (u, z, i)))
            .Where(x => x.z.LehrerId is null && x.z.FachId.HasValue)
            .Select(x => new OffeneZeile(x.u, x.i, x.z, Wertrechnung.Wert(d, ix, x.u, x.z)))
            .ToList();

    /// <summary>
    /// Matrix Lehrkraft × Spalte (Klasse bzw. Fach) mit Stunden (Wert). Ist eine Zeile mehreren Klassen zugeordnet
    /// (Kopplung, Kurs), wird ihr Wert gleichmäßig auf die Klassen verteilt; Spalte 0 = ohne Klasse.
    /// </summary>
    public static Dictionary<(int Lehrer, int Spalte), decimal> Matrix(Schuldatei d, DatenIndex ix, bool nachFach)
    {
        var m = new Dictionary<(int, int), decimal>();
        void Dazu(int l, int s, decimal w) => m[(l, s)] = m.GetValueOrDefault((l, s)) + w;
        foreach (var u in d.Unterrichte.Where(u => !u.Ignorieren))
            foreach (var z in u.Zeilen.Where(z => z.LehrerId.HasValue))
            {
                var w = Wertrechnung.Wert(d, ix, u, z);
                if (nachFach) Dazu(z.LehrerId!.Value, z.FachId ?? 0, w);
                else if (z.KlassenIds.Count == 0) Dazu(z.LehrerId!.Value, 0, w);
                else foreach (var k in z.KlassenIds) Dazu(z.LehrerId!.Value, k, w / z.KlassenIds.Count);
            }
        return m;
    }

    /// <summary>Unterricht in Fächern ohne eingetragene Lehrbefähigung (Lehrkraft, Fach, Stunden).</summary>
    public static List<(Lehrer Lehrer, Fach Fach, decimal Stunden)> OhneFakultas(Schuldatei d, DatenIndex ix)
    {
        var res = new List<(Lehrer, Fach, decimal)>();
        foreach (var g in d.Unterrichte.Where(u => !u.Ignorieren)
                     .SelectMany(u => u.Zeilen.Where(z => z.LehrerId.HasValue && z.FachId.HasValue).Select(z => (u, z)))
                     .GroupBy(x => (L: x.z.LehrerId!.Value, F: x.z.FachId!.Value)))
        {
            if (!ix.Lehrer.TryGetValue(g.Key.L, out var l) || !ix.Faecher.TryGetValue(g.Key.F, out var f)) continue;
            if (f.Bereitschaft || l.FaecherIds.Count == 0 || l.FaecherIds.Contains(f.Id)) continue;
            res.Add((l, f, g.Sum(x => Wertrechnung.Wert(d, ix, x.u, x.z))));
        }
        return res;
    }

    /// <summary>Lehrkraft einer Kopplungszeile setzen (null = entfernen). Prüft, dass die Lehrkraft nicht schon in einer anderen Zeile desselben Unterrichts steht.</summary>
    public static void Zuweisen(Schuldatei d, int unterrichtId, int zeile, int? lehrerId)
    {
        var u = d.Unterrichte.FirstOrDefault(x => x.Id == unterrichtId) ?? throw new InvalidOperationException($"Der Unterricht Nr. {unterrichtId} existiert nicht.");
        if (zeile < 0 || zeile >= u.Zeilen.Count) throw new InvalidOperationException("Die Zeile des Unterrichts existiert nicht.");
        if (lehrerId is int lid)
        {
            if (d.Lehrer.All(l => l.Id != lid)) throw new InvalidOperationException($"Die Lehrkraft Nr. {lid} existiert nicht.");
            if (u.Zeilen.Where((z, i) => i != zeile).Any(z => z.LehrerId == lid))
                throw new InvalidOperationException("Die Lehrkraft unterrichtet in diesem Unterricht bereits eine andere Gruppe.");
        }
        u.Zeilen[zeile].LehrerId = lehrerId;
    }

    // ------------------------------------------------------------------------------------------ Stundentafel (Kontingente)

    /// <summary>Lernbereich der Kontingentstundentafel mit den Fach-Kürzeln, die dazu zählen.</summary>
    public sealed record Kontingent(string Lernbereich, string[] Faecher, decimal? Jg56, decimal? Jg710, bool Hoechstwert);

    /// <summary>
    /// Kontingente der Stundentafel Gymnasium G9, Sekundarstufe I (APO-S I, Anlage 3a, gültig ab 1.8.2021 aufwachsend ab Klasse 5).
    /// Gesamt 182 Stunden zuzüglich bis zu 6 Ergänzungsstunden (höchstens 188). Zweite Fremdsprache: mehrere angebotene Sprachen
    /// zählen je Jahrgang einmal (Höchstwert).
    /// </summary>
    public static readonly Kontingent[] KontingenteGymnasiumG9 =
    {
        new("Deutsch", new[] { "D" }, 9, 13, false),
        new("Mathematik", new[] { "M" }, 9, 13, false),
        new("Englisch", new[] { "E" }, 9, 13, false),
        new("Zweite Fremdsprache", new[] { "F", "L", "S" }, null, 15, true),
        new("Gesellschaftslehre", new[] { "EK", "GE", "PK", "WI", "GL" }, 6, 17, false),
        new("Naturwissenschaften", new[] { "BI", "CH", "PH", "NW" }, 6, 17, false),
        new("Informatik", new[] { "IF" }, 2, null, false),
    };

    public sealed record KontingentPruefung(string Lernbereich, string Stufe, decimal Soll, decimal Ist);

    /// <summary>Schulinterne Stundentafel (Jahrgang × Fach) gegen die G9-Kontingente prüfen; nur Abweichungen. Leer, wenn Jahrgänge 5–10 fehlen.</summary>
    public static List<KontingentPruefung> KontingentePruefenG9(Schuldatei d, out decimal summe)
    {
        var ix = new DatenIndex(d);
        var res = new List<KontingentPruefung>();
        summe = 0;
        var jg = new[] { "5", "6", "7", "8", "9", "10" };
        if (!jg.All(j => d.Stundentafel.Any(z => z.Jahrgang == j))) return res;
        decimal Stunden(string[] faecher, IEnumerable<string> jahrgaenge, bool hoechst) => jahrgaenge.Sum(j =>
        {
            var w = d.Stundentafel.Where(z => z.Jahrgang == j && ix.Faecher.TryGetValue(z.FachId, out var f) && faecher.Contains(f.Kurzname, StringComparer.OrdinalIgnoreCase)).Select(z => z.Stunden).ToList();
            return w.Count == 0 ? 0 : hoechst ? w.Max() : w.Sum();
        });
        foreach (var k in KontingenteGymnasiumG9)
        {
            if (k.Jg56 is decimal a && Stunden(k.Faecher, jg[..2], k.Hoechstwert) is var i1 && i1 != a) res.Add(new(k.Lernbereich, "5/6", a, i1));
            if (k.Jg710 is decimal b && Stunden(k.Faecher, jg[2..], k.Hoechstwert) is var i2 && i2 != b) res.Add(new(k.Lernbereich, "7–10", b, i2));
        }
        summe = jg.Sum(j => d.Stundentafel.Where(z => z.Jahrgang == j).Sum(z => z.Stunden));
        return res;
    }

    // ------------------------------------------------------------------------------------------ Export

    /// <summary>
    /// Unterrichtsverteilung als Semikolon-Datei in der Spaltenfolge der UVD-Datei für den SchILD-NRW-Import
    /// („Unterrichts-Daten als UVD-TXT“: Klasse, Jahrgang, Kursart, Wochenstunden, Fach, Lehrkraft). Die Spaltenfolge ist
    /// nach Angaben aus dem SchILD-Forum gebildet, nicht nach einer amtlichen Schnittstellenbeschreibung – vor dem Import prüfen.
    /// </summary>
    public static string UvdText(Schuldatei d)
    {
        var ix = new DatenIndex(d);
        var sb = new StringBuilder();
        static string Q(string s) => "\"" + (s ?? "").Replace("\"", "\"\"") + "\"";
        sb.Append(string.Join(';', new[] { "Klasse", "Jahrgang", "Kursart", "WoStd", "Fach", "Lehrer", "Kurs" }.Select(Q))).Append("\r\n");
        foreach (var u in d.Unterrichte.Where(u => !u.Ignorieren).OrderBy(u => u.Id))
            foreach (var z in u.Zeilen.Where(z => z.FachId.HasValue))
            {
                var fach = ix.KFach(z.FachId);
                var lehrer = ix.KLehrer(z.LehrerId);
                var kursart = KursartVon(u);
                var klassen = z.KlassenIds.Count > 0 ? z.KlassenIds : new List<int> { 0 };
                foreach (var k in klassen)
                {
                    var kl = k == 0 ? null : ix.Klassen.GetValueOrDefault(k);
                    sb.Append(string.Join(';', new[] { kl?.Kurzname ?? "", kl?.Jahrgang ?? "", kursart, u.Wochenstunden.ToString(), fach, lehrer, u.Kursname }.Select(Q))).Append("\r\n");
                }
            }
        return sb.ToString();
    }

    /// <summary>Kursart aus Kursname bzw. Block (LK, GK, ZK, VTF, PJK); Sek I leer.</summary>
    public static string KursartVon(Unterricht u)
    {
        foreach (var k in UntPlan.Core.Nrw.Kursarten.Keys)
            if (u.Kursname.Contains(k, StringComparison.OrdinalIgnoreCase)) return k;
        return "";
    }

    /// <summary>Deputatsübersicht aller Lehrkräfte als Tabelle (Kopf + Zeilen) für CSV und Druck.</summary>
    public static List<string[]> Tabelle(Schuldatei d)
    {
        var ix = new DatenIndex(d);
        static string Z(decimal x) => x.ToString("0.##", Format.De);
        var res = new List<string[]>
        {
            new[] { "Kürzel", "Name", "Pflichtstunden", "Umfang", "Anteil %", "Alter", "Altersermäßigung", "Schwerbehinderung", "sonstige Ermäßigung", "Anrechnung", "Leitungszeit", "Mehrarbeit/Vorgriff", "Soll", "Ist", "Differenz", "Fächer" },
        };
        foreach (var x in Alle(d, ix).OrderBy(x => x.Lehrer.Kurzname, StringComparer.Create(Format.De, true)))
            res.Add(new[]
            {
                x.Lehrer.Kurzname, x.Lehrer.VollerName, Z(x.Pflichtstunden), Z(x.Umfang), Z(Math.Round(x.Anteil * 100, 1)), x.Alter?.ToString() ?? "",
                Z(x.Altersermaessigung), Z(x.Schwerbehinderung), Z(x.SonstigeErmaessigung), Z(x.Anrechnung), Z(x.Leitung), Z(x.Mehrarbeit),
                Z(x.Soll), Z(x.Ist), x.Differenz.ToString("+0.##;-0.##;0", Format.De), string.Join(",", x.Lehrer.FaecherIds.Select(f => ix.KFach(f))),
            });
        return res;
    }
}
