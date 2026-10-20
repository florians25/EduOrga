using System.Security.Claims;
using UntPlan.Core;
using UntPlan.Core.Model;
using UntPlan.Core.Vertretungsplanung;
using UntPlanStudio.Dienste;
using UntPlanStudio.Grundlagen;

namespace UntPlanStudio.Api;

public sealed record ProbeAnfrage(DateOnly Datum);
/// <param name="Mit">Die Lehrkraft betreut mit (parallele Gruppe zusammengelegt).</param>
public sealed record AnwendenEintrag(int Id, int? Lehrer, int? Raum, bool Entfall = false, bool Mit = false);
public sealed record AnwendenAnfrage(List<AnwendenEintrag> Eintraege);

/// <summary>
/// Tagesablauf der Vertretungsplanung (Arbeitsplatz „Tagesplanung“): Arbeitsliste der offenen Stunden nach Dringlichkeit,
/// die besten Kandidaten je Stunde (gebündelt für die sichtbaren Karten), „Wer ist frei?“ (Lehrkräfte × Stunden des Tages),
/// Tagesbilanz mit Belastung der Lehrkräfte (Tag, Woche, Monat, Mehrarbeit NRW) und Kollisionen sowie die Probe der
/// automatischen Vertretung (Vorschau ohne Änderung) mit Übernahme ausgewählter Vorschläge in einer Rückgängig-Stufe.
/// </summary>
public sealed partial class VertretungApi
{
    /// <summary>Vertretungsarten, bei denen eine Lehrkraft eine fremde Stunde hält (Belastung).</summary>
    private static bool HaeltStunde(Vertretung v) =>
        v.VertreterId is int l && l != v.LehrerId && !v.IstEntfall &&
        v.Art is VertretungsArt.Vertretung or VertretungsArt.StattVertretung or VertretungsArt.Teilvertretung or VertretungsArt.Lehrertausch
            or VertretungsArt.Bereitschaftsvertretung or VertretungsArt.Betreuung or VertretungsArt.Pausenaufsicht or VertretungsArt.Klausur or VertretungsArt.Sondereinsatz;

    private static string Zeit(Schuldatei d, int stunde) => d.Zeitraster.Zeit(stunde) is { } z ? $"{z.Beginn:HH\\:mm}–{z.Ende:HH\\:mm}" : "";

    /// <summary>Kleinster Jahrgangsrang der Klassen (5 … 13, 99 = unbekannt) – jüngere Klassen sind dringlicher.</summary>
    private static int Jahrgang(DatenIndex ix, IEnumerable<int> klassen) =>
        klassen.Select(k => ix.Klassen.GetValueOrDefault(k)?.Jahrgang ?? "").Select(Nrw.JahrgangRang).DefaultIfEmpty(99).Min();

    /// <summary>Schreibt die Klasse in dieser Stunde eine Klausur (Aufsicht nötig)?</summary>
    private static bool Klausuraufsicht(Schuldatei d, Vertretung v) =>
        v.Art == VertretungsArt.Klausur || v.Quelle == VertretungsQuelle.Klausur || v.KlausurId.HasValue ||
        d.Vertretungen.Any(x => x.Art == VertretungsArt.Klausur && x.Datum == v.Datum && x.Stunde == v.Stunde && x.KlassenIds.Intersect(v.KlassenIds).Any());

    private static string Ergebnis(Schuldatei d, DatenIndex ix, Vertretung v)
    {
        if (v.Art == VertretungsArt.Freisetzung) return "Freisetzung";
        if (v.IstEntfall) return "Entfall";
        if (v.Art is VertretungsArt.VertretungOhneLehrer) return "ohne Lehrkraft";
        if (v.Art is VertretungsArt.EigenverantwortlichesArbeiten) return "EVA";
        if (v.Art is VertretungsArt.Verlegung or VertretungsArt.Tausch or VertretungsArt.Verlegt) return "Verlegung";
        if (v.Art == VertretungsArt.Raumvertretung) return $"Raum {ix.KRaum(v.VertretungsraumId)}";
        if (v.VertreterId is int l) return v.Mitbetreuung ? $"Betreuung {ix.KLehrer(l)}" : ix.KLehrer(l);
        return Vertretungsplan.ArtText(d, v.Art);
    }

    private static void TagesablaufRegistrieren(RouteGroupBuilder g)
    {
        // Arbeitsliste: offene Stunden des Tages nach Dringlichkeit (Klausuraufsicht zuerst, dann Uhrzeit, dann jüngere Klassen) und bearbeitete
        g.MapGet("/tagesablauf", (Arbeitsdokument a, DateOnly datum) => a.LesenAsync(doc =>
        {
            var d = doc.Daten;
            var ix = doc.Index;
            var tag = d.Vertretungen.Where(v => v.Datum == datum).ToList();
            var offen = tag.Where(v => v.OffenOderRaumOffen && !v.Fixiert).Select(v =>
            {
                var pause = v.Art == VertretungsArt.Pausenaufsicht;
                var block = pause ? new List<Vertretung>() : VertretungsVorschlag.Block(d, v);
                var klausur = !pause && Klausuraufsicht(d, v);
                var kl = v.NeueKlassenIds.Select(k => ix.Klassen.GetValueOrDefault(k)).FirstOrDefault(x => x is not null);
                return new
                {
                    id = v.Id, stunde = v.Stunde, stundeText = Vertretungsplan.StundeText(v), zeit = Zeit(d, v.Stunde),
                    klassen = ix.KKlassen(v.NeueKlassenIds), klasse = v.NeueKlassenIds.Cast<int?>().FirstOrDefault(),
                    fach = pause ? "" : ix.KFach(v.FachId), lehrer = ix.KLehrer(v.LehrerId), lehrerId = v.LehrerId,
                    raum = pause ? ix.K(ElementTyp.Gang, v.GangId) : ix.KRaum(v.VertretungsraumId ?? v.RaumId),
                    offen = v.Offen, raumOffen = v.RaumOffen, pause, klausur, veranstaltung = v.Art == VertretungsArt.Veranstaltung,
                    art = Vertretungsplan.ArtText(d, v.Art), grund = v.GrundId is int gid ? ix.K(ElementTyp.Abwesenheitsgrund, gid) : v.Grund, text = v.Text,
                    jahrgang = Jahrgang(ix, v.NeueKlassenIds), jahrgangText = kl?.Jahrgang ?? "", abteilung = ix.K(ElementTyp.Abteilung, kl?.AbteilungId),
                    block = block.Count > 1 ? block.Select(x => x.Stunde).OrderBy(x => x).ToList() : null,
                    blockIds = block.Count > 1 ? block.Where(x => x.Offen).Select(x => x.Id).ToList() : null,
                };
            }).OrderBy(x => x.klausur ? 0 : 1).ThenBy(x => x.stunde).ThenBy(x => x.pause ? 1 : 0).ThenBy(x => x.jahrgang).ThenBy(x => x.klassen, StringComparer.Ordinal).ToList();
            var bearbeitet = tag.Where(v => !v.OffenOderRaumOffen && v.Art is not (VertretungsArt.Unterricht or VertretungsArt.Freisetzung or VertretungsArt.Veranstaltung) && (v.Bearbeitet || v.VertreterId.HasValue || v.IstEntfall))
                .OrderBy(v => v.Stunde).ThenBy(v => v.Id).Select(v => new
                {
                    id = v.Id, stunde = v.Stunde, stundeText = Vertretungsplan.StundeText(v), zeit = Zeit(d, v.Stunde), klassen = ix.KKlassen(v.NeueKlassenIds),
                    klasse = v.NeueKlassenIds.Cast<int?>().FirstOrDefault(), fach = ix.KFach(v.FachId), lehrer = ix.KLehrer(v.LehrerId), lehrerId = v.LehrerId,
                    raum = ix.KRaum(v.VertretungsraumId ?? v.RaumId), ergebnis = Ergebnis(d, ix, v), art = Vertretungsplan.ArtText(d, v.Art),
                    vertreter = v.VertreterId, entfall = v.IstEntfall, fix = v.Fixiert, abgeleitet = Vertretungen.IstAbgeleitet(v),
                }).ToList();
            return new { datum, offen, bearbeitet, unterrichtstag = Kalender.IstUnterrichtstag(d, datum) };
        }));

        // Die besten Kandidaten je offener Stunde (für die sichtbaren Karten der Arbeitsliste, gebündelt)
        g.MapGet("/tagesablauf/kandidaten", (Arbeitsdokument a, string ids, bool? block) => a.LesenAsync(doc =>
        {
            var d = doc.Daten;
            var ix = doc.Index;
            var liste = ids.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(x => int.TryParse(x, out var n) ? n : 0).Where(n => n > 0).Distinct().Take(40).ToHashSet();
            var res = new Dictionary<string, object>();
            foreach (var v in d.Vertretungen.Where(x => liste.Contains(x.Id)))
            {
                var monat = new DateOnly(v.Datum.Year, v.Datum.Month, 1);
                var montag = Kalender.Montag(v.Datum);
                object Mehrarbeit(Lehrer l)
                {
                    var m = Statistik.MehrarbeitNrw(d, l, monat, monat.AddMonths(1).AddDays(-1)).FirstOrDefault();
                    return new { geleistet = m?.Geleistet ?? 0, grenze = m?.Grenze ?? 3, verguetung = m?.Verguetungsfaehig ?? 0 };
                }
                if (v.RaumOffen && !v.Offen)
                {
                    var raeume = Raumvertretungen.MoeglicheRaeume(d, v, false, false).Where(r => !r.Besetzt).Take(3).Select(r => new
                    {
                        raum = r.Raum.Id, k = r.Raum.Kurzname, name = r.Raum.Langname,
                        gruende = new[] { r.Ausweichraum ? "Ausweichraum" : "", r.AusweichStammraum ? "Ausweich-Fachraum" : "", r.KapazitaetDiff is int kd ? (kd >= 0 ? "Plätze reichen" : $"{-kd} Plätze zu wenig") : "" }.Where(x => x.Length > 0).ToList(),
                    }).ToList();
                    res[v.Id.ToString()] = new { art = "raum", raeume, kandidaten = Array.Empty<object>(), weitere = 0 };
                    continue;
                }
                if (v.Art == VertretungsArt.Pausenaufsicht)
                {
                    var pa = new Pausenaufsicht { GangId = v.GangId ?? 0, Tag = Kalender.TagIndex(d, v.Datum), NachStunde = v.Stunde, LehrerId = v.LehrerId ?? 0 };
                    var pk = UntPlan.Core.Module.Pausenaufsichten.Kandidaten(d, v.Datum, pa);
                    res[v.Id.ToString()] = new
                    {
                        art = "lehrer", weitere = Math.Max(0, pk.Count - 3), betreuung = (object?)null, entfallSinnvoll = false,
                        kandidaten = pk.Take(3).Select(l => new
                        {
                            lehrer = l.Id, k = l.Kurzname, name = l.VollerName, lage = "Aufsicht", gruende = new List<string> { $"{UntPlan.Core.Module.Pausenaufsichten.Anzahl(d, l.Id)} Aufsichten" },
                            woche = Vertretungen.Zaehler(d, l.Id, montag, montag.AddDays(6)), monat = Vertretungen.Zaehler(d, l.Id, monat, monat.AddMonths(1).AddDays(-1)),
                            maxWoche = l.VertretungenMaxWoche, maxMonat = l.VertretungenMaxMonat, mehrarbeit = false, mehrarbeitMonat = Mehrarbeit(l), rot = false,
                        }).ToList(),
                    };
                    continue;
                }
                var bl = block == true && VertretungsVorschlag.Block(d, v).Count > 1;
                var alle = VertretungsVorschlag.Berechnen(d, v, bl);
                // offener Platz einer Veranstaltung: wer schon teilnimmt, kommt als Ersatz nicht in Frage
                if (v.VeranstaltungOffen && v.VeranstaltungId is int vid && d.Veranstaltungen.FirstOrDefault(x => x.Id == vid) is { } vaz)
                {
                    var dabei = vaz.LehrerAm(v.Datum).ToHashSet();
                    alle = alle.Where(k => !dabei.Contains(k.Lehrer.Id)).ToList();
                }
                var betreuung = VertretungsVorschlag.Betreuungen(d, v).FirstOrDefault();
                res[v.Id.ToString()] = new
                {
                    art = "lehrer", weitere = Math.Max(0, alle.Count - 3), entfallSinnvoll = VertretungsVorschlag.EntfallSinnvoll(d, v), block = bl,
                    betreuung = betreuung is null ? null : new { lehrer = betreuung.Lehrer.Id, k = betreuung.Lehrer.Kurzname, naehe = betreuung.NaeheText, kopplung = betreuung.Kopplung, klassen = betreuung.Klassen },
                    kandidaten = alle.Take(3).Select(k => new
                    {
                        lehrer = k.Lehrer.Id, k = k.Lehrer.Kurzname, name = k.Lehrer.VollerName, lage = k.Lage, gruende = k.Kriterien.ToList(),
                        woche = k.ZaehlerWoche, monat = k.ZaehlerMonat, maxWoche = k.Lehrer.VertretungenMaxWoche, maxMonat = k.Lehrer.VertretungenMaxMonat,
                        mehrarbeit = k.Mehrarbeit, mehrarbeitMonat = Mehrarbeit(k.Lehrer), rot = k.Rot,
                        s = k.Zellen.Select(z => new { text = z.Text, entfallen = z.Entfallen, ziel = z.Ziel }).ToList(),
                    }).ToList(),
                };
            }
            return res;
        }));

        // Gemeinsame Kandidaten für mehrere markierte Stunden: Lehrkräfte, die in allen Stunden frei sind (Schnittmenge), gereiht nach
        // der Summe der Schlechtpunkte; dazu die gemeinsame Betreuung und ob Entfall in allen Stunden sinnvoll ist
        g.MapGet("/tagesablauf/gemeinsam", (Arbeitsdokument a, string ids) => a.LesenAsync(doc =>
        {
            var d = doc.Daten;
            var menge = ids.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(x => int.TryParse(x, out var n) ? n : 0).Where(n => n > 0).Distinct().Take(30).ToHashSet();
            var liste = d.Vertretungen.Where(v => menge.Contains(v.Id) && v.Offen && v.Art != VertretungsArt.Pausenaufsicht).OrderBy(v => v.Datum).ThenBy(v => v.Stunde).ToList();
            var gleicheZeit = liste.GroupBy(v => (v.Datum, v.Stunde)).Any(x => x.Count() > 1);
            var kandidaten = new List<object>();
            object? betreuung = null;
            if (liste.Count > 0 && !gleicheZeit)
            {
                var je = liste.Select(v => VertretungsVorschlag.Berechnen(d, v).ToDictionary(k => k.Lehrer.Id)).ToList();
                var gemeinsam = je[0].Keys.Where(l => je.All(x => x.ContainsKey(l)))
                    .Select(l => (l, punkte: je.Sum(x => x[l].Punkte), rot: je.Any(x => x[l].Rot), k: je[0][l]))
                    .OrderBy(x => x.punkte).ThenBy(x => x.k.Lehrer.Kurzname).Take(8).ToList();
                foreach (var (l, _, rot, k) in gemeinsam)
                    kandidaten.Add(new
                    {
                        lehrer = l, k = k.Lehrer.Kurzname, name = k.Lehrer.VollerName, lage = string.Join(" / ", je.Select(x => x[l].Lage).Distinct()),
                        gruende = je.SelectMany(x => x[l].Kriterien).Distinct().ToList(), woche = k.ZaehlerWoche, monat = k.ZaehlerMonat,
                        maxWoche = k.Lehrer.VertretungenMaxWoche, maxMonat = k.Lehrer.VertretungenMaxMonat, mehrarbeit = je.Any(x => x[l].Mehrarbeit), rot,
                        mehrarbeitMonat = new { geleistet = 0, grenze = 3, verguetung = 0 },
                    });
                var bet = liste.Select(v => VertretungsVorschlag.Betreuungen(d, v).Select(b => b.Lehrer.Id).ToList()).ToList();
                if (bet.Count > 0 && bet[0].FirstOrDefault(l => bet.All(x => x.Contains(l))) is int bl && bl > 0)
                    betreuung = new { lehrer = bl, k = doc.Index.KLehrer(bl), naehe = "", kopplung = false, klassen = "" };
            }
            return new
            {
                ids = liste.Select(v => v.Id).ToList(), stunden = liste.Select(v => v.Stunde).ToList(), gleicheZeit, kandidaten, betreuung,
                entfallSinnvoll = liste.Count > 0 && liste.All(v => VertretungsVorschlag.EntfallSinnvoll(d, v)),
            };
        }));

        // „Wer ist frei?“: Lehrkräfte × Stunden des Tages (U Unterricht, V vertritt, A abwesend, B Bereitschaft, X freigesetzt, H Hohlstunde, leer frei)
        g.MapGet("/tagesablauf/frei", (Arbeitsdokument a, DateOnly datum) => a.LesenAsync(doc =>
        {
            var d = doc.Daten;
            var ix = doc.Index;
            var stunden = d.Zeitraster.Zeiten.Select(z => z.Nr).Where(n => n >= 1).OrderBy(n => n).ToList();
            if (stunden.Count == 0) stunden = Enumerable.Range(1, d.Zeitraster.StundenProTag).ToList();
            var unterrichtstag = Kalender.IstUnterrichtstag(d, datum);
            var tp = unterrichtstag ? Tagesplan.Berechnen(d, datum) : null;
            var montag = Kalender.Montag(datum);
            var monat = new DateOnly(datum.Year, datum.Month, 1);
            var tagV = d.Vertretungen.Where(v => v.Datum >= monat && v.Datum < monat.AddMonths(1) || (v.Datum >= montag && v.Datum <= montag.AddDays(6))).Where(HaeltStunde).ToList();
            var jeStunde = stunden.ToDictionary(s => s, s => tp?.Stunde(s).Where(e => e.Findetstatt).ToList() ?? new List<TagesEintrag>());
            var lehrer = d.Lehrer.Where(l => !l.Ignorieren).OrderBy(l => l.Kurzname, StringComparer.OrdinalIgnoreCase).Select(l =>
            {
                var eigene = tp?.VonLehrer(l.Id).Where(e => !Vertretungen.IstBereitschaftsfach(d, e.FachId)).Select(e => e.Stunde).Distinct().ToList() ?? new List<int>();
                var zellen = stunden.Select(s =>
                {
                    if (tp is null) return new[] { "", "" };
                    if (Absenzen.LehrerAbwesend(d, l.Id, datum, s)) return new[] { "A", "" };
                    var e = jeStunde[s].FirstOrDefault(x => x.LehrerIds.Contains(l.Id) && !(x.Status == TagesStatus.Regulaer && Vertretungen.IstBereitschaftsfach(d, x.FachId)));
                    if (e != null)
                    {
                        var text = $"{ix.KKlassen(e.KlassenIds)} {ix.KFach(e.FachId)}".Trim();
                        return new[] { e.Vertretung is { } vv && vv.VertreterId == l.Id && vv.LehrerId != l.Id ? "V" : "U", text };
                    }
                    if (Vertretungen.Bereitschaft(d, tp, l.Id, s) is { } b) return new[] { "B", b.Kurzname };
                    if (Vertretungen.IstFreigesetzt(d, tp, l.Id, s)) return new[] { "X", "" };
                    if (eigene.Count > 0 && s > eigene.Min() && s < eigene.Max()) return new[] { "H", "" };
                    return new[] { "", "" };
                }).ToList();
                return new
                {
                    id = l.Id, k = l.Kurzname, name = l.VollerName, zellen,
                    heute = tagV.Count(v => v.VertreterId == l.Id && v.Datum == datum),
                    woche = tagV.Count(v => v.VertreterId == l.Id && v.Datum >= montag && v.Datum <= montag.AddDays(6)),
                    monat = tagV.Count(v => v.VertreterId == l.Id && v.Datum >= monat && v.Datum < monat.AddMonths(1)),
                    maxWoche = l.VertretungenMaxWoche, maxMonat = l.VertretungenMaxMonat, unterricht = eigene.Count,
                };
            }).ToList();
            return new { datum, stunden = stunden.Select(s => new { nr = s, zeit = Zeit(d, s) }).ToList(), lehrer, unterrichtstag };
        }));

        // Tagesbilanz: Zahlen des Tages, Belastung der Lehrkräfte (Tag, Woche, Monat, Mehrarbeit NRW), Kollisionen von Lehrkräften und Räumen
        g.MapGet("/tagesablauf/bilanz", (Arbeitsdokument a, DateOnly datum) => a.LesenAsync(doc =>
        {
            var d = doc.Daten;
            var ix = doc.Index;
            var tag = d.Vertretungen.Where(v => v.Datum == datum && v.Art != VertretungsArt.Unterricht).ToList();
            var montag = Kalender.Montag(datum);
            var monat = new DateOnly(datum.Year, datum.Month, 1);
            var zahlen = new
            {
                gesamt = tag.Count,
                vertreten = tag.Count(v => HaeltStunde(v) && !v.Mitbetreuung && v.Art != VertretungsArt.Betreuung && v.Art != VertretungsArt.Pausenaufsicht),
                betreuung = tag.Count(v => HaeltStunde(v) && (v.Mitbetreuung || v.Art == VertretungsArt.Betreuung)),
                aufsicht = tag.Count(v => v.Art == VertretungsArt.Pausenaufsicht && v.VertreterId.HasValue),
                entfall = tag.Count(v => v.IstEntfall && v.Art != VertretungsArt.Freisetzung),
                freisetzung = tag.Count(v => v.Art == VertretungsArt.Freisetzung),
                ohneLehrkraft = tag.Count(v => v.Art is VertretungsArt.VertretungOhneLehrer or VertretungsArt.EigenverantwortlichesArbeiten),
                raum = tag.Count(v => v.Art == VertretungsArt.Raumvertretung && v.VertretungsraumId.HasValue),
                verlegung = tag.Count(v => v.Art is VertretungsArt.Verlegung or VertretungsArt.Tausch),
                offen = tag.Count(v => v.Offen),
                raumOffen = tag.Count(v => v.RaumOffen),
            };
            var kollLehrer = new List<string>();
            var kollRaum = new List<string>();
            if (Kalender.IstUnterrichtstag(d, datum) && tag.Count > 0)
            {
                var tp = Tagesplan.Berechnen(d, datum);
                foreach (var v in tag.Where(v => v.VertreterId is int && !v.IstEntfall && !v.Mitbetreuung && v.Art != VertretungsArt.TrotzAbsenz).OrderBy(v => v.Stunde))
                    if (Vertretungen.LehrerBelegt(d, tp, v.VertreterId!.Value, v.Stunde, v) is { } grund)
                        kollLehrer.Add($"{v.Stunde}. Std. {ix.KLehrer(v.VertreterId)} – {grund} (Nr. {v.Id}, {ix.KKlassen(v.NeueKlassenIds)} {ix.KFach(v.FachId)})".Trim());
                foreach (var gr in tp.Eintraege.Where(e => e.Findetstatt).SelectMany(e => e.RaumIds.Select(r => (e.Stunde, r, e))).GroupBy(x => (x.Stunde, x.r)).Where(x => x.Count() > 1).OrderBy(x => x.Key.Stunde))
                    kollRaum.Add($"{gr.Key.Stunde}. Std. {ix.KRaum(gr.Key.r)} – {string.Join(", ", gr.Select(x => $"{ix.KKlassen(x.e.KlassenIds)} {ix.KFach(x.e.FachId)}".Trim()))}");
            }
            var zeitraum = d.Vertretungen.Where(v => (v.Datum >= monat && v.Datum < monat.AddMonths(1)) || (v.Datum >= montag && v.Datum <= montag.AddDays(6))).Where(HaeltStunde).ToList();
            var ids = zeitraum.Select(v => v.VertreterId!.Value).Distinct().ToHashSet();
            var lehrer = d.Lehrer.Where(l => ids.Contains(l.Id)).Select(l =>
            {
                var m = Statistik.MehrarbeitNrw(d, l, monat, monat.AddMonths(1).AddDays(-1)).FirstOrDefault();
                return new
                {
                    id = l.Id, k = l.Kurzname, name = l.VollerName,
                    heute = zeitraum.Count(v => v.VertreterId == l.Id && v.Datum == datum),
                    woche = zeitraum.Count(v => v.VertreterId == l.Id && v.Datum >= montag && v.Datum <= montag.AddDays(6)),
                    monat = zeitraum.Count(v => v.VertreterId == l.Id && v.Datum >= monat && v.Datum < monat.AddMonths(1)),
                    maxWoche = l.VertretungenMaxWoche, maxMonat = l.VertretungenMaxMonat,
                    mehrarbeit = m?.Geleistet ?? 0, grenze = m?.Grenze ?? 3, verguetung = m?.Verguetungsfaehig ?? 0,
                };
            }).OrderByDescending(x => x.woche).ThenByDescending(x => x.monat).ThenBy(x => x.k, StringComparer.OrdinalIgnoreCase).ToList();
            return new { datum, zahlen, kollisionen = new { lehrer = kollLehrer, raeume = kollRaum }, lehrer };
        }));

        // Probe der automatischen Vertretung (bester Vorschlag): rechnet auf einer Kopie und liefert die Vorschläge – nichts wird geändert
        g.MapPost("/tagesablauf/probe", (Arbeitsdokument a, ProbeAnfrage z, ClaimsPrincipal p) => a.LesenAsync(doc =>
        {
            var d = doc.Daten;
            var ix = doc.Index;
            var vorher = d.Vertretungen.Where(v => v.Datum == z.Datum && v.OffenOderRaumOffen && !v.Fixiert).ToList();
            var probe = Dokument.VertretungsProbe(d, z.Datum, z.Datum);
            Vertretungsautomatik.Ausfuehren(probe, z.Datum, z.Datum, AutomatikMethode.BesterVorschlag, null, B(p));
            var jeId = probe.Vertretungen.Where(v => v.Datum == z.Datum).GroupBy(v => v.Id).ToDictionary(x => x.Key, x => x.First());
            var vorschlaege = new List<object>();
            var ohne = new List<object>();
            foreach (var v in vorher.OrderBy(v => v.Stunde).ThenBy(v => v.Id))
            {
                var basis = new { id = v.Id, stunde = v.Stunde, stundeText = Vertretungsplan.StundeText(v), klassen = ix.KKlassen(v.NeueKlassenIds), fach = v.Art == VertretungsArt.Pausenaufsicht ? ix.K(ElementTyp.Gang, v.GangId) : ix.KFach(v.FachId), lehrer = ix.KLehrer(v.LehrerId) };
                if (!jeId.TryGetValue(v.Id, out var n)) { ohne.Add(basis); continue; }
                string art; int? lehrer = null, raum = null; string text, grund = "";
                if (v.VeranstaltungOffen && n.VertreterId is int vl && v.VeranstaltungId is int pvid && d.Veranstaltungen.FirstOrDefault(x => x.Id == pvid)?.LehrerAm(v.Datum).Contains(vl) == true)
                { ohne.Add(basis); continue; }
                if (v.Offen && n.VertreterId is int l)
                {
                    art = "lehrer"; lehrer = l; text = ix.KLehrer(l);
                    var k = v.Art == VertretungsArt.Pausenaufsicht ? null : VertretungsVorschlag.Berechnen(d, v).FirstOrDefault(x => x.Lehrer.Id == l);
                    grund = k is null ? (v.Art == VertretungsArt.Pausenaufsicht ? "Aufsicht" : "") : string.Join(" · ", new[] { k.Lage }.Concat(k.Kriterien).Where(x => x.Length > 0).Distinct());
                }
                else if (v.Offen && n.IstEntfall) { art = "entfall"; text = "Entfall"; grund = "kein freier Vertreter, Randstunde"; }
                else if (v.RaumOffen && n.VertretungsraumId is int r) { art = "raum"; raum = r; text = $"Raum {ix.KRaum(r)}"; }
                else { ohne.Add(basis); continue; }
                vorschlaege.Add(new { basis.id, basis.stunde, basis.stundeText, basis.klassen, basis.fach, basis.lehrer, art, lehrerId = lehrer, raumId = raum, text, grund });
            }
            return new { datum = z.Datum, vorschlaege, ohne };
        }));

        // Ausgewählte Vorschläge übernehmen (eine Rückgängig-Stufe): Lehrkraft, Raum oder Entfall je Vertretung
        g.MapPost("/tagesablauf/anwenden", (Arbeitsdokument a, AnwendenAnfrage z, ClaimsPrincipal p) =>
        {
            var liste = z.Eintraege.Where(e => e.Id > 0).GroupBy(e => e.Id).Select(x => x.First()).ToList();
            if (liste.Count == 0) return Task.FromResult<object>(new { ok = true, anzahl = 0 });
            return a.AendernAsync(B(p), $"Vorschläge übernommen ({liste.Count})", V, d =>
            {
                foreach (var e in liste)
                {
                    var v = d.Vertretungen.FirstOrDefault(x => x.Id == e.Id);
                    if (v is null || v.Fixiert || !v.OffenOderRaumOffen) continue;
                    if (e.Lehrer is int lv && v.VeranstaltungOffen && v.VeranstaltungId is int vaId)
                    {
                        if (d.Veranstaltungen.FirstOrDefault(x => x.Id == vaId) is { } va && !va.LehrerAm(v.Datum).Contains(lv)) VeranstaltungsLogik.ErsatzSetzen(d, vaId, v.Datum, v.ErsatzFuerLehrerId, lv);
                        continue;
                    }
                    if (e.Lehrer is int l && v.Offen) Vertretungen.VertreterSetzen(d, v, l, e.Mit, B(p));
                    else if (e.Entfall && v.Offen) Vertretungen.EntfallUmschalten(d, v, B(p));
                    else if (e.Raum is int r && v.RaumOffen) Raumvertretungen.Zuordnen(d, v, r, false, RaumKollisionsLoesung.MitKollision, B(p));
                    else continue;
                    Vertretungen.AlsGeaendertMarkieren(v, B(p));
                }
            }, doc => (object)new { ok = true, anzahl = liste.Count });
        });
    }
}
