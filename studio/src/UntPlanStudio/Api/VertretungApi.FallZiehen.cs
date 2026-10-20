using UntPlan.Core;
using UntPlan.Core.Model;
using UntPlan.Core.Vertretungsplanung;
using UntPlanStudio.Dienste;

namespace UntPlanStudio.Api;

/// <summary>
/// „Fall für Fall“, Verlegen per Ziehen: Beim Ziehen einer Stunde (bzw. eines Blocks) in der Leiste der Klasse liefert der Server für
/// jede Stunde des Tages, ob die Stunde dort stattfinden kann – frei, füllt eine Lücke (fehlende Lehrkraft), Tausch möglich, Lehrkraft
/// fehlt oder Kollision – mit dem Grund in Worten („KER unterrichtet 7b“, „5a hat D (MUE)“), dazu die beteiligten Lehrkräfte und den
/// Raum, deren Tag die Oberfläche neben der Leiste einblendet. Die Prüfung ist dieselbe wie beim Ablegen im tagesaktuellen Plan
/// (<see cref="Tagesverlegung"/>); abgelegt wird über „/plan/verlegen“ bzw. – in eine Lücke – über die Vorziehung.
/// </summary>
public sealed partial class VertretungApi
{
    private static void FallZiehenRegistrieren(RouteGroupBuilder g)
    {
        g.MapGet("/tagesablauf/fallziele", (Arbeitsdokument a, DateOnly datum, DateOnly? von, int stunde, int unterricht, int? laenge) =>
            a.LesenAsync(doc => FallZiele(doc, datum, von ?? datum, stunde, unterricht, Math.Clamp(laenge ?? 1, 1, 6))));
    }

    private static bool GehoertZu(TagesEintrag e, int unterricht) => (e.Regel?.Unterricht.Id ?? e.Vertretung?.UnterrichtId) == unterricht;

    /// <summary>Lehrkräfte der gezogenen Stunde – bei einer offenen Stunde auch die fehlende (sie unterrichtet am Ziel wieder selbst).</summary>
    private static List<int> LehrerDerStunde(IEnumerable<TagesEintrag> q) =>
        q.SelectMany(e => e.Status == TagesStatus.Vertreten ? e.LehrerIds : e.LehrerIds.Concat(new[] { e.Regel?.LehrerId ?? e.Vertretung?.LehrerId }.OfType<int>())).Distinct().ToList();

    internal static object FallZiele(Dokument doc, DateOnly datum, DateOnly von, int stunde, int unterricht, int laenge)
    {
        var d = doc.Daten;
        var ix = doc.Index;
        var tpVon = Tagesplan.Berechnen(d, von);
        var tp = von == datum ? tpVon : Tagesplan.Berechnen(d, datum);
        var quelle = Enumerable.Range(stunde, laenge).SelectMany(s => tpVon.Stunde(s).Where(e => e.Findetstatt && GehoertZu(e, unterricht))).ToList();
        var lehrer = LehrerDerStunde(quelle);
        var klassen = quelle.SelectMany(e => e.KlassenIds).Distinct().ToList();
        var raeume = quelle.SelectMany(e => e.RaumIds).Distinct().ToList();
        var stunden = d.Zeitraster.Zeiten.Select(z => z.Nr).Where(n => n >= 1).OrderBy(n => n).ToList();
        if (stunden.Count == 0) stunden = Enumerable.Range(1, d.Zeitraster.StundenProTag).ToList();

        string Hindernis(TagesEintrag h)
        {
            var hl = string.Join(",", h.LehrerIds.Select(ix.KLehrer));
            var gleicheLehrer = h.LehrerIds.Intersect(lehrer).ToList();
            if (gleicheLehrer.Count > 0)
                return $"{string.Join(",", gleicheLehrer.Select(ix.KLehrer))} {(h.Status == TagesStatus.Regulaer ? "unterrichtet" : "vertritt in")} {ix.KKlassen(h.KlassenIds)} {ix.KFach(h.FachId)}".Trim();
            var k = ix.KKlassen(h.KlassenIds.Intersect(klassen));
            return $"{k} hat {ix.KFach(h.FachId)}{(hl.Length > 0 ? $" ({hl})" : "")}";
        }

        var ziele = new List<object>();
        foreach (var s in stunden)
        {
            if (von == datum && s == stunde) { ziele.Add(new { s, status = "quelle", grund = laenge > 1 ? $"{laenge} Stunden" : "", luecke = (int?)null }); continue; }
            if (quelle.Count == 0 || s + laenge - 1 > d.Zeitraster.StundenProTag || !Kalender.IstUnterrichtstag(d, datum) ||
                Enumerable.Range(s, laenge).Any(x => !d.Zeitraster.Verfuegbar(tp.Tag, x)))
            { ziele.Add(new { s, status = "kollision", grund = "passt nicht in den Tag", luecke = (int?)null }); continue; }
            var an = Tagesverlegung.Analysieren(d, tpVon, stunde, unterricht, null, laenge, tp, s);
            if (an.Schritte.Count == 0) { ziele.Add(new { s, status = "kollision", grund = "", luecke = (int?)null }); continue; }
            var hindernisse = an.Schritte.SelectMany(x => x.Hindernisse).ToList();
            if (an.TauschMoeglich)
            {
                var h = hindernisse[0];
                ziele.Add(new { s, status = "tausch", grund = $"Tausch mit {ix.KFach(h.FachId)} ({string.Join(",", h.LehrerIds.Select(ix.KLehrer))})", luecke = (int?)null });
                continue;
            }
            if (an.Kollision)
            {
                ziele.Add(new { s, status = "kollision", grund = string.Join(" · ", hindernisse.Select(Hindernis).Distinct().Take(2)), luecke = (int?)null });
                continue;
            }
            var fehlt = lehrer.Where(l => Enumerable.Range(s, laenge).Any(x => Absenzen.LehrerAbwesend(d, l, datum, x))).ToList();
            if (fehlt.Count > 0) { ziele.Add(new { s, status = "abwesend", grund = $"{string.Join(",", fehlt.Select(ix.KLehrer))} fehlt", luecke = (int?)null }); continue; }
            var luecken = Enumerable.Range(s, laenge).SelectMany(x => Tagesverlegung.GefuellteLuecken(tp, x, unterricht, klassen)).ToList();
            var raumBelegt = raeume.Where(r => Enumerable.Range(s, laenge).Any(x => tp.Stunde(x).Any(e => e.Findetstatt && !Tagesverlegung.IstLuecke(e) && !GehoertZu(e, unterricht) && e.RaumIds.Contains(r)))).ToList();
            var raumText = raumBelegt.Count > 0 ? $"Raum {string.Join(",", raumBelegt.Select(ix.KRaum))} belegt – anderer Raum" : "";
            if (luecken.Count > 0)
            {
                var fehlende = string.Join(",", luecken.Select(v => ix.KLehrer(v.LehrerId)).Where(x => x.Length > 0).Distinct());
                // eine Stunde in genau eine Lücke: wie „Vorziehen“ (die Lücke wird zur Vorziehung)
                int? vz = laenge == 1 && luecken.Count == 1 && VertretungsVorschlag.Vorziehungen(d, luecken[0], VorziehungsModus.AlleVerlegungen)
                    .Any(x => x.Datum == von && x.Stunde == stunde && x.Eintrag.Unterricht?.Id == unterricht) ? luecken[0].Id : null;
                ziele.Add(new { s, status = "luecke", grund = string.Join(" · ", new[] { fehlende.Length > 0 ? $"statt Vertretung ({fehlende} fehlt)" : "füllt die Lücke", raumText }.Where(x => x.Length > 0)), luecke = vz });
                continue;
            }
            ziele.Add(new { s, status = "frei", grund = raumText, luecke = (int?)null });
        }
        var erste = quelle.FirstOrDefault();
        return new
        {
            datum, von, stunde, unterricht, laenge,
            fach = ix.KFach(erste?.FachId), klassen = ix.KKlassen(klassen),
            lehrer = lehrer.Select(l => new { id = l, k = ix.KLehrer(l), name = ix.Lehrer.GetValueOrDefault(l)?.VollerName ?? "", fehlt = Absenzen.LehrerAbwesend(d, l, von, stunde) }).ToList(),
            raeume = raeume.Select(r => new { id = r, k = ix.KRaum(r) }).ToList(),
            ziele,
        };
    }
}
