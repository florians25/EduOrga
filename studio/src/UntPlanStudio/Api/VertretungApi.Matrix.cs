using UntPlan.Core;
using UntPlan.Core.Model;
using UntPlan.Core.Vertretungsplanung;
using UntPlanStudio.Dienste;
using UntPlanStudio.Grundlagen;

namespace UntPlanStudio.Api;

/// <summary>
/// Tagesübersicht der Tagesplanung als Matrix: Zeilen = Klassen (bzw. Lehrkräfte), Spalten = Stunden des Planungstags. Jede Zelle
/// nennt die Stunden des Elements in dieser Stunde kompakt (Fach, Lehrkraft bzw. Klasse, Raum) mit Status (regulär, offen, vertreten,
/// Raumänderung, ohne Lehrkraft, Entfall, zusätzlich/verlegt, Termin, Klausur, Bereitschaft); dazu je Zeile die Abwesenheiten
/// (Klasse auf Ausflug, Lehrkraft krank) und je Stunde die verfügbaren Lehrkräfte (Bereitschaft, freigesetzt, Hohlstunde).
/// </summary>
public sealed partial class VertretungApi
{
    private static void MatrixRegistrieren(RouteGroupBuilder g)
    {
        g.MapGet("/tagesablauf/matrix", (Arbeitsdokument a, DateOnly datum, string? art) =>
            a.LesenAsync(doc => Matrix(doc, datum, art == "lehrer" ? ElementTyp.Lehrer : ElementTyp.Klasse)));
    }

    /// <summary>Kurzer Status einer Stunde in der Matrix (n regulär, o offen, ro Raum fehlt, v vertreten, r Raumänderung, x ohne Lehrkraft,
    /// e Entfall, z zusätzlich/verlegt, t Termin, k Klausur, b Bereitschaft).</summary>
    private static string MatrixStatus(Schuldatei d, TagesEintrag e, bool durch, string lehrerAlt, string raumAlt)
    {
        var v = e.Vertretung;
        if (e.Status == TagesStatus.Entfall) return "e";
        if (e.Status == TagesStatus.Offen) return "o";
        // das Element nimmt nicht mehr teil (Lehrkraft vertreten, Klasse verlegt): aus seiner Sicht entfällt die Stunde, sonst „vertreten“
        if (durch) return e.Status == TagesStatus.Vertreten ? "v" : "e";
        if (v is { RaumOffen: true, Offen: false }) return "ro";
        switch (e.Status)
        {
            case TagesStatus.Zusaetzlich:
                return v?.Art switch
                {
                    VertretungsArt.Veranstaltung => "t",
                    VertretungsArt.Klausur => "k",
                    _ => "z",
                };
            case TagesStatus.Vertreten:
                if (v?.Art is VertretungsArt.VertretungOhneLehrer or VertretungsArt.EigenverantwortlichesArbeiten) return "x";
                if (lehrerAlt.Length > 0 || v?.Mitbetreuung == true) return "v";
                if (raumAlt.Length > 0) return "r";
                return "v";
            default:
                return Vertretungen.IstBereitschaftsfach(d, e.FachId) ? "b" : "n";
        }
    }

    internal static object Matrix(Dokument doc, DateOnly datum, ElementTyp typ)
    {
        var d = doc.Daten;
        var ix = doc.Index;
        var lehrerSicht = typ == ElementTyp.Lehrer;
        var stunden = d.Zeitraster.Zeiten.Select(z => z.Nr).Where(n => n >= 1).OrderBy(n => n).ToList();
        if (stunden.Count == 0) stunden = Enumerable.Range(1, d.Zeitraster.StundenProTag).ToList();
        var unterrichtstag = Kalender.IstUnterrichtstag(d, datum);
        var tp = unterrichtstag || d.Vertretungen.Any(v => v.Datum == datum) ? Tagesplan.Berechnen(d, datum) : null;
        var abwTag = d.Abwesenheiten.Where(x => x.Von <= datum && x.Bis >= datum).ToList();
        var vaTag = d.Veranstaltungen.Where(x => x.Von <= datum && x.Bis >= datum).ToList();

        // Einträge je Element (Zeile): alle Stunden, an denen das Element regulär oder durch eine Vertretung beteiligt ist
        var jeZeile = new Dictionary<int, List<(int Stunde, object E)>>();
        void Hinzu(int id, int stunde, object e)
        {
            if (!jeZeile.TryGetValue(id, out var l)) jeZeile[id] = l = new();
            l.Add((stunde, e));
        }
        foreach (var e in tp?.Eintraege ?? new List<TagesEintrag>())
        {
            var v = e.Vertretung;
            var r = e.Regel;
            var ids = lehrerSicht
                ? e.LehrerIds.Concat(new[] { r?.LehrerId, v?.LehrerId }.OfType<int>()).Distinct().ToList()
                : e.KlassenIds.Concat(r?.KlassenIds ?? (IEnumerable<int>)Array.Empty<int>()).Concat(v?.KlassenIds ?? (IEnumerable<int>)Array.Empty<int>()).Distinct().ToList();
            if (ids.Count == 0) continue;
            if (!lehrerSicht && Vertretungen.IstBereitschaftsfach(d, e.FachId)) continue;
            var lehrer = string.Join(",", e.LehrerIds.Select(ix.KLehrer));
            var raum = string.Join(",", e.RaumIds.Select(ix.KRaum));
            var lehrerAlt = r?.LehrerId is int rl && !e.LehrerIds.Contains(rl) ? ix.KLehrer(rl) : v?.LehrerId is int vl && !e.LehrerIds.Contains(vl) ? ix.KLehrer(vl) : "";
            var raumAlt = r?.RaumId is int rr && e.RaumIds.Count > 0 && !e.RaumIds.Contains(rr) ? ix.KRaum(rr) : "";
            var fachAlt = r?.FachId is int rf && rf != e.FachId ? ix.KFach(rf) : "";
            var urLehrer = r?.LehrerId ?? v?.LehrerId;
            foreach (var id in ids)
            {
                var durch = lehrerSicht ? !e.LehrerIds.Contains(id) : !e.KlassenIds.Contains(id);
                var status = MatrixStatus(d, e, durch, lehrerAlt, raumAlt);
                Hinzu(id, e.Stunde, new
                {
                    v = v?.Id, u = e.Unterricht?.Id ?? v?.UnterrichtId, s = status,
                    f = ix.KFach(e.FachId), fa = fachAlt, l = lehrer, la = lehrerAlt, r = raum, ra = raumAlt,
                    k = ix.KKlassen(e.KlassenIds.Count > 0 ? e.KlassenIds : r?.KlassenIds ?? (IEnumerable<int>)Array.Empty<int>()),
                    li = e.LehrerIds.Cast<int?>().FirstOrDefault(), lo = urLehrer, ri = e.RaumIds.Cast<int?>().FirstOrDefault(),
                    ki = (e.KlassenIds.Count > 0 ? e.KlassenIds : r?.KlassenIds ?? new List<int>()).Cast<int?>().FirstOrDefault(),
                    art = v is null ? "" : Vertretungsplan.ArtText(d, v.Art), t = v?.Text ?? "",
                    kl = v?.ArtVorKlassenabwesenheit.HasValue == true, w = durch,
                });
            }
        }

        // Abwesenheiten je Element und Stunde (Absenz oder Veranstaltung)
        List<object> Abwesend(int id)
        {
            var res = new List<object>();
            foreach (var s in stunden)
            {
                var abs = abwTag.Where(x => x.Deckt(datum, s) && (lehrerSicht
                    ? (x.Art == AbwesenheitsArt.Lehrer && x.ElementId == id) || (x.Art == AbwesenheitsArt.Klasse && x.BegleitLehrerIds.Contains(id))
                    : x.Art == AbwesenheitsArt.Klasse && x.ElementId == id)).OrderByDescending(x => x.Von).FirstOrDefault();
                if (abs is not null)
                {
                    var grund = abs.GrundId is int gid ? ix.K(ElementTyp.Abwesenheitsgrund, gid) : "";
                    var begleit = lehrerSicht && abs.Art == AbwesenheitsArt.Klasse ? $"begleitet {ix.KKlassen(new[] { abs.ElementId })}" : "";
                    res.Add(new { s, a = "absenz", id = abs.Id, t = string.Join(" · ", new[] { grund, abs.Text, begleit }.Where(x => x.Length > 0)) });
                    continue;
                }
                var va = vaTag.FirstOrDefault(x => x.Deckt(datum, s) && (lehrerSicht ? x.NimmtTeil(id, datum) : x.KlassenIds.Contains(id)));
                if (va is not null) res.Add(new { s, a = "termin", id = va.Id, t = va.Text });
            }
            return res;
        }

        // verfügbare Lehrkräfte je Stunde: Bereitschaft (noch frei), freigesetzt, Hohlstunde – und die Bereitschaften mit ihrem Stand
        var verfuegbar = stunden.ToDictionary(s => s, _ => (B: new List<string>(), X: new List<string>(), H: new List<string>()));
        var bereitschaften = stunden.ToDictionary(s => s, _ => new List<object>());
        if (tp is not null && unterrichtstag)
        {
            var jeStunde = stunden.ToDictionary(s => s, s => tp.Stunde(s).Where(e => e.Findetstatt).ToList());
            foreach (var l in d.Lehrer.Where(l => !l.Ignorieren).OrderBy(l => l.Kurzname, StringComparer.OrdinalIgnoreCase))
            {
                var eigene = tp.VonLehrer(l.Id).Where(e => !Vertretungen.IstBereitschaftsfach(d, e.FachId)).Select(e => e.Stunde).Distinct().ToList();
                foreach (var s in stunden)
                {
                    var bereit = Vertretungen.Bereitschaft(d, tp, l.Id, s);
                    var abwesend = Absenzen.LehrerAbwesend(d, l.Id, datum, s);
                    var unterricht = jeStunde[s].Any(x => x.LehrerIds.Contains(l.Id) && !(x.Status == TagesStatus.Regulaer && Vertretungen.IstBereitschaftsfach(d, x.FachId)));
                    var regelBereit = tp.Regel.Any(r => r.Stunde == s && r.LehrerId == l.Id && Vertretungen.IstBereitschaftsfach(d, r.FachId));
                    if (regelBereit) bereitschaften[s].Add(new { k = l.Kurzname, id = l.Id, stand = abwesend ? "abwesend" : unterricht ? "eingesetzt" : "frei" });
                    if (abwesend || unterricht) continue;
                    if (bereit is not null) verfuegbar[s].B.Add(l.Kurzname);
                    else if (Vertretungen.IstFreigesetzt(d, tp, l.Id, s)) verfuegbar[s].X.Add(l.Kurzname);
                    else if (eigene.Count > 0 && s > eigene.Min() && s < eigene.Max()) verfuegbar[s].H.Add(l.Kurzname);
                }
            }
        }

        IEnumerable<(Element E, string Gruppe, int Rang)> elemente = lehrerSicht
            ? d.Lehrer.Where(l => !l.Ignorieren).Select(l => ((Element)l, "", 0))
            : d.Klassen.Where(k => !k.Ignorieren).Select(k => ((Element)k, k.Jahrgang, Nrw.JahrgangRang(k.Jahrgang)));
        var zeilen = elemente.Select(x =>
        {
            var abw = Abwesend(x.E.Id);
            var gruppe = lehrerSicht ? (abw.Count > 0 ? "Abwesend" : "Anwesend") : x.Gruppe;
            var eintraege = jeZeile.GetValueOrDefault(x.E.Id) ?? new();
            return new
            {
                id = x.E.Id, k = x.E.Kurzname, name = x.E is Lehrer le ? le.VollerName : x.E.Langname, gruppe, rang = lehrerSicht ? (abw.Count > 0 ? 0 : 1) : x.Rang,
                abw, zellen = eintraege.GroupBy(z => z.Stunde).OrderBy(z => z.Key).Select(z => new { s = z.Key, e = z.Select(y => y.E).ToList() }).ToList(),
            };
        }).OrderBy(z => z.rang).ThenBy(z => System.Text.RegularExpressions.Regex.Replace(z.k, @"\d+", m => m.Value.PadLeft(4, '0')), StringComparer.OrdinalIgnoreCase).ToList();

        var ohneZeile = d.Vertretungen.Count(v => v.Datum == datum && v.OffenOderRaumOffen && !v.Fixiert && (lehrerSicht ? v.LehrerId is null : v.NeueKlassenIds.Count == 0 || v.Art == VertretungsArt.Pausenaufsicht));
        return new
        {
            datum, art = lehrerSicht ? "lehrer" : "klasse", unterrichtstag, frei = unterrichtstag ? "" : Kalender.FreiBezeichnung(d, datum),
            stunden = stunden.Select(s => new
            {
                nr = s, zeit = Zeit(d, s),
                bereit = verfuegbar[s].B, freigesetzt = verfuegbar[s].X, hohl = verfuegbar[s].H,
                bereitschaften = bereitschaften[s],
            }).ToList(),
            zeilen, ohneZeile,
        };
    }
}
