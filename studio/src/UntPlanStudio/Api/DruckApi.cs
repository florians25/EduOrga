using System.Globalization;
using System.IO.Compression;
using System.Net;
using System.Security.Claims;
using System.Text;
using UntPlan.Core;
using UntPlan.Core.Austausch;
using UntPlan.Core.Model;
using UntPlan.Core.Module;
using UntPlan.Core.Planung;
using UntPlan.Core.Vertretungsplanung;
using UntPlanStudio.Dienste;
using UntPlanStudio.Grundlagen;

namespace UntPlanStudio.Api;

/// <summary>
/// Druck und Ausgabe (serverseitig, ohne Fremdbibliothek): Stundenpläne als PDF im Schwarz-Weiß-Layout des Desktop-Drucks
/// (groß bzw. kompakt, optional nach einem eigenen Stundenplanformat), HTML-Stundenpläne und Info-Stundenplan (einzelne Seiten
/// oder ZIP), iCalendar je Lehrkraft (bzw. alle als ZIP), Vertretungsplan-Aushang nach dem Seitenlayout (PDF/HTML),
/// Übersichtspläne als PDF und Berichte (Lehrer Soll/Ist, Klassen, Unterricht, Räume, Stundentafel, Vertretungsstatistik …)
/// als PDF, HTML oder CSV. Endpunkte unter <c>/api/dokumente/{dok}/druck/…</c>.
/// </summary>
public sealed class DruckApi : IStudioModul
{
    public string Name => "druck";

    private static readonly CultureInfo De = CultureInfo.GetCultureInfo("de-DE");

    // ------------------------------------------------------------------------------------------ Antworten

    private static string Dateiname(string name) =>
        string.Concat(name.Replace("ä", "ae").Replace("ö", "oe").Replace("ü", "ue").Replace("Ä", "Ae").Replace("Ö", "Oe").Replace("Ü", "Ue").Replace("ß", "ss")
            .Select(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_' or '.' ? c : '_')).Trim('_') is { Length: > 0 } n ? n : "ausgabe";

    /// <summary>Datei-Antwort; PDF/HTML dürfen in der Druckvorschau des Studios (gleicher Ursprung) eingebettet werden.</summary>
    private static IResult Datei(HttpContext ctx, byte[] inhalt, string typ, string name, bool herunterladen)
    {
        var h = ctx.Response.Headers;
        h["X-Frame-Options"] = "SAMEORIGIN";
        h["Content-Security-Policy"] = "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'none'; frame-ancestors 'self'";
        h["Cache-Control"] = "no-store";
        h.ContentDisposition = $"{(herunterladen ? "attachment" : "inline")}; filename=\"{Dateiname(name)}\"; filename*=UTF-8''{Uri.EscapeDataString(name)}";
        return Results.Bytes(inhalt, typ);
    }

    private static IResult Html(HttpContext ctx, string html, string name, bool herunterladen) =>
        Datei(ctx, Encoding.UTF8.GetBytes(html), "text/html; charset=utf-8", name, herunterladen);

    private static List<int> Ids(Schuldatei d, ElementTyp typ, string? ids)
    {
        var alle = Stammdaten.Sortiert(d, typ).Select(e => e.Id).ToList();
        if (string.IsNullOrWhiteSpace(ids) || ids == "alle") return alle;
        var gewaehlt = ids.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(x => int.TryParse(x, out var i) ? i : throw StudioFehler.Ungueltig($"Ungültige Element-Nummer „{x}“.")).ToHashSet();
        // in der gewohnten Sortierung
        return alle.Where(gewaehlt.Contains).ToList();
    }

    private static ElementTyp PlanTyp(string? typ)
    {
        var t = Typnamen.Typ(typ ?? "klasse");
        return t is ElementTyp.Klasse or ElementTyp.Lehrer or ElementTyp.Raum or ElementTyp.Fach ? t : throw StudioFehler.Ungueltig("Stundenpläne gibt es für Klassen, Lehrkräfte, Räume und Fächer.");
    }

    private static string DateiTeil(string s) => new(s.Select(c => char.IsLetterOrDigit(c) ? c : '_').ToArray());

    /// <summary>Datei des Info-Stundenplans zu einem Element (wie <see cref="Export.InfoStundenplan"/>).</summary>
    private static string InfoDatei(ElementTyp t, Element e) => $"{t switch { ElementTyp.Lehrer => "le", ElementTyp.Raum => "ra", _ => "kl" }}_{DateiTeil(e.Kurzname)}.html";

    private static string HtmlTabelle(Bericht b)
    {
        var sb = new StringBuilder($"<h1>{WebUtility.HtmlEncode(b.Titel)}</h1>");
        if (b.Untertitel.Length > 0) sb.Append($"<div class=\"sub\">{WebUtility.HtmlEncode(b.Untertitel)}</div>");
        sb.Append("<table><tr>");
        foreach (var s in b.Spalten) sb.Append($"<th>{WebUtility.HtmlEncode(s)}</th>");
        sb.Append("</tr>");
        for (var r = 0; r < b.Zeilen.Count; r++)
        {
            var art = b.Arten != null && r < b.Arten.Count ? b.Arten[r] : "";
            if (art == "gruppe") { sb.Append($"<tr><th colspan=\"{b.Spalten.Count}\" style=\"text-align:left\">{WebUtility.HtmlEncode(b.Zeilen[r].FirstOrDefault())}</th></tr>"); continue; }
            sb.Append(art == "summe" ? "<tr class=\"f\">" : "<tr>");
            foreach (var w in b.Zeilen[r]) sb.Append($"<td>{WebUtility.HtmlEncode(w)}</td>");
            sb.Append("</tr>");
        }
        sb.Append("</table>");
        return Export.Seite(b.Titel, sb.ToString());
    }

    // ------------------------------------------------------------------------------------------ Berichte

    public sealed record BerichtInfo(string Id, string Titel, string Gruppe, bool Zeitraum, string Hinweis);

    public static readonly BerichtInfo[] Berichte =
    {
        new("lehrer-sollist", "Lehrkräfte Soll/Ist", "Stammdaten und Unterricht", false, "Wochensoll, Ermäßigungen, Ist-Stunden (Wertrechnung), Differenz"),
        new("klassen", "Klassenliste", "Stammdaten und Unterricht", false, "Klassen mit Wochenstunden, verplant und nicht verplant"),
        new("raeume", "Raumbelegung", "Stammdaten und Unterricht", false, "Räume mit belegten Stunden und Auslastung"),
        new("unterricht", "Unterrichtsliste", "Stammdaten und Unterricht", false, "Alle Unterrichte der aktiven Periode mit Kopplungszeilen"),
        new("nichtverplant", "Nicht verplante Stunden", "Stammdaten und Unterricht", false, "Unterrichte, die noch nicht vollständig verplant sind"),
        new("stundentafel", "Stundentafel Soll/Ist", "Stammdaten und Unterricht", false, "Abgleich der Stundentafel mit dem Unterricht je Klasse und Fach"),
        new("vertretungen", "Vertretungen im Zeitraum", "Vertretungsplanung", true, "Alle Vertretungen, Entfälle und Änderungen je Tag"),
        new("vertretungsstatistik", "Vertretungsstatistik je Lehrkraft", "Vertretungsplanung", true, "Vertretungen, Mehrarbeit, Entfälle und Saldo je Lehrkraft"),
        new("ausfall", "Unterrichtsausfall", "Vertretungsplanung", true, "Zusammenfassung: vertreten, Entfall, Freisetzung, Raumänderungen, offen"),
        new("entfalltage", "Entfalltage", "Vertretungsplanung", true, "Tage, an denen alle Stunden einer Lehrkraft entfallen sind"),
        new("abrechnung", "Vertretungsabrechnung", "Abrechnung", true, "Abrechnung aller Lehrkräfte im Zeitraum mit Unterschriftsfeld"),
        new("mehrarbeit", "Mehrarbeit NRW je Lehrkraft", "Abrechnung", true, "Mehrarbeit nach Monaten, gegliedert nach Lehrkraft"),
        new("vertretungsuebersicht", "Vertretungs-Übersicht", "Abrechnung", true, "Geplante und erteilte Stunden, Vertretungen nach Art und Grund"),
        new("pausenaufsicht", "Pausenaufsichtsplan", "Pausen und Prüfungen", false, "Aufsichten je Aufsichtsbereich: Pausen × Tage"),
        new("pausenaufsicht-lehrer", "Pausenaufsichten je Lehrkraft", "Pausen und Prüfungen", false, "Anzahl, Minuten (Ist/Max) und Termine je Lehrkraft"),
        new("klausuren", "Klausurplan", "Pausen und Prüfungen", true, "Klausuren und Prüfungen im Zeitraum mit Aufsicht und Raum"),
        new("kurse", "Kursliste", "Kurse", false, "Kurse je Klasse bzw. Jahrgang mit Band, Lehrkraft und Teilnehmerzahl"),
        new("kursteilnehmer", "Kursteilnehmer", "Kurse", false, "Teilnehmerlisten je Kurs (zum Abhaken)"),
    };

    private static string Z(decimal d) => Format.Zahl(d);

    internal static Bericht BerichtErzeugen(Schuldatei d, DatenIndex ix, string id, DateOnly von, DateOnly bis)
    {
        var zeitraum = $"{Format.Datum(von)} – {Format.Datum(bis)}";
        var periode = ListenPdf.PeriodeText(d);
        var cmp = StringComparer.Create(De, true);
        switch (id)
        {
            case "lehrer-sollist":
            {
                var l = Wertrechnung.Uebersicht(d).OrderBy(x => x.Lehrer.Kurzname, cmp).ToList();
                var zeilen = l.Select(x => (IReadOnlyList<string>)new[] { x.Lehrer.Kurzname, x.Lehrer.VollerName, Z(x.Wochensoll), Z(x.Ermaessigung), Z(x.Soll), Z(x.Ist), Z(x.Differenz), x.Wochenstunden.ToString(De), x.Verplant.ToString(De) }).ToList();
                var arten = zeilen.Select(_ => "").ToList();
                zeilen.Add(new[] { "Summe", $"{l.Count} Lehrkräfte", Z(l.Sum(x => x.Wochensoll)), Z(l.Sum(x => x.Ermaessigung)), Z(l.Sum(x => x.Soll)), Z(l.Sum(x => x.Ist)), Z(l.Sum(x => x.Differenz)), l.Sum(x => x.Wochenstunden).ToString(De), l.Sum(x => x.Verplant).ToString(De) });
                arten.Add("summe");
                return new Bericht("Lehrkräfte Soll/Ist", periode, new[] { "Kürzel", "Name", "Wochensoll", "Ermäßigung", "Soll", "Ist", "Differenz", "Wst", "Verplant" }, zeilen, true, arten);
            }
            case "klassen":
            {
                var zeilen = Stammdaten.Sortiert(d, ElementTyp.Klasse).Select(k =>
                {
                    var u = ix.UnterrichteVon(ElementTyp.Klasse, k.Id).ToList();
                    var verplant = ix.PlanVon(ElementTyp.Klasse, k.Id).Select(p => (p.Tag, p.Stunde)).Distinct().Count();
                    return (IReadOnlyList<string>)new[] { k.Kurzname, k.Langname, u.Count.ToString(De), u.Sum(x => x.Wochenstunden).ToString(De), verplant.ToString(De), u.Sum(ix.NichtVerplant).ToString(De) };
                }).ToList();
                return new Bericht("Klassenliste", periode, new[] { "Klasse", "Langname", "Unterrichte", "Wochenstunden", "Verplante Stunden", "Nicht verplant" }, zeilen);
            }
            case "raeume":
            {
                var slots = Math.Max(1, Enumerable.Range(0, d.Zeitraster.TageProWoche).Sum(t => Enumerable.Range(1, d.Zeitraster.StundenProTag).Count(s => d.Zeitraster.Verfuegbar(t, s))));
                var belegt = d.Stundenplan.SelectMany(p => p.Raeume.Where(r => r.HasValue).Select(r => (R: r!.Value, p.Tag, p.Stunde))).Distinct().GroupBy(x => x.R).ToDictionary(g => g.Key, g => g.Count());
                var zeilen = Stammdaten.Sortiert(d, ElementTyp.Raum).OfType<Raum>().Select(r =>
                {
                    var n = belegt.GetValueOrDefault(r.Id);
                    return (IReadOnlyList<string>)new[] { r.Kurzname, r.Langname, r.Kapazitaet > 0 ? r.Kapazitaet.ToString(De) : "", n.ToString(De), $"{100.0 * n / slots:0} %" };
                }).ToList();
                return new Bericht("Raumbelegung", $"{periode} · {slots} Stunden je Woche", new[] { "Raum", "Langname", "Kapazität", "Belegte Stunden", "Auslastung" }, zeilen);
            }
            case "unterricht":
            case "nichtverplant":
            {
                var nur = id == "nichtverplant";
                var zeilen = new List<IReadOnlyList<string>>();
                foreach (var u in d.Unterrichte.OrderBy(u => u.Id))
                {
                    var nv = ix.NichtVerplant(u);
                    if (nur && nv == 0) continue;
                    for (var i = 0; i < u.Zeilen.Count; i++)
                    {
                        var z = u.Zeilen[i];
                        zeilen.Add(new[] { i == 0 ? u.Id.ToString(De) : "", ix.KKlassen(z.KlassenIds), ix.KFach(z.FachId), ix.KLehrer(z.LehrerId), i == 0 ? u.Wochenstunden.ToString(De) : "",
                            i == 0 ? ix.Verplant(u).ToString(De) : "", i == 0 && nv > 0 ? nv.ToString(De) : "", ix.KRaum(z.FachraumId ?? z.StammraumId), i == 0 ? u.Text : "" });
                    }
                }
                return new Bericht(nur ? "Nicht verplante Stunden" : "Unterrichtsliste", periode, new[] { "U-Nr", "Klasse(n)", "Fach", "Lehrer", "Wst", "Verplant", "Nicht verplant", "Raum", "Text" }, zeilen, true);
            }
            case "stundentafel":
            {
                var zeilen = Wertrechnung.Stundentafel(d).OrderBy(x => x.Klasse.Kurzname, cmp).ThenBy(x => x.Fach.Kurzname, cmp)
                    .Select(x => (IReadOnlyList<string>)new[] { x.Klasse.Kurzname, x.Fach.Kurzname, Z(x.Soll), Z(x.Ist), Z(x.Ist - x.Soll) }).ToList();
                return new Bericht("Stundentafel Soll/Ist", periode, new[] { "Klasse", "Fach", "Soll", "Ist", "Differenz" }, zeilen);
            }
            case "vertretungen":
            {
                var zeilen = new List<IReadOnlyList<string>>();
                var arten = new List<string>();
                foreach (var tag in Kalender.Tage(von, bis).Where(t => Kalender.IstUnterrichtstag(d, t)))
                {
                    var l = Vertretungsplan.Zeilen(d, tag);
                    if (l.Count == 0) continue;
                    zeilen.Add(new[] { $"{Planungsdienst.TageLang[((int)tag.DayOfWeek + 6) % 7]}, {Format.Datum(tag)}" });
                    arten.Add("gruppe");
                    foreach (var z in l)
                    {
                        zeilen.Add(new[] { z.Stunde.ToString(De), z.Klassen, z.Lehrer, z.Vertreter, z.NeuesFach.Length > 0 ? z.NeuesFach : z.Fach, z.NeuerRaum.Length > 0 ? z.NeuerRaum : z.Raum, Vertretungsplan.ArtText(d, z.ArtWert), z.Bemerkung });
                        arten.Add("");
                    }
                }
                return new Bericht("Vertretungen im Zeitraum", zeitraum, new[] { "Std.", "Klasse(n)", "Lehrer", "Vertreter", "Fach", "Raum", "Art", "Bemerkung" }, zeilen, true, arten);
            }
            case "vertretungsstatistik":
            {
                var l = Statistik.Abrechnung(d, von, bis);
                var zeilen = l.Select(x => (IReadOnlyList<string>)new[] { x.Lehrer.Kurzname, x.Lehrer.VollerName, x.Vertretungen.ToString(De), x.Mehrarbeit.ToString(De), x.Betreuungen.ToString(De),
                    x.Sondereinsaetze.ToString(De), x.Aufsichten.ToString(De), x.Entfaelle.ToString(De), x.Freisetzungen.ToString(De), Z(x.Saldo), x.Verguetungsfaehig.ToString(De) }).ToList();
                var arten = zeilen.Select(_ => "").ToList();
                if (l.Count > 0)
                {
                    zeilen.Add(new[] { "Summe", $"{l.Count} Lehrkräfte", l.Sum(x => x.Vertretungen).ToString(De), l.Sum(x => x.Mehrarbeit).ToString(De), l.Sum(x => x.Betreuungen).ToString(De),
                        l.Sum(x => x.Sondereinsaetze).ToString(De), l.Sum(x => x.Aufsichten).ToString(De), l.Sum(x => x.Entfaelle).ToString(De), l.Sum(x => x.Freisetzungen).ToString(De), Z(l.Sum(x => x.Saldo)), l.Sum(x => x.Verguetungsfaehig).ToString(De) });
                    arten.Add("summe");
                }
                return new Bericht("Vertretungsstatistik je Lehrkraft", zeitraum, new[] { "Kürzel", "Name", "Vertretungen", "Mehrarbeit", "Betreuungen", "Sondereinsätze", "Aufsichten", "Entfälle", "Freisetzungen", "Saldo", "Vergütungsfähig" }, zeilen, true, arten);
            }
            case "ausfall":
            {
                var a = Statistik.Zusammenfassung(d, von, bis);
                var u = Statistik.VertretungsUebersicht(d, von, bis);
                var zeilen = new List<IReadOnlyList<string>>
                {
                    new[] { "Vertretungszeilen gesamt", a.Gesamt.ToString(De) }, new[] { "davon vertreten", a.Vertreten.ToString(De) }, new[] { "Entfall", a.Entfall.ToString(De) },
                    new[] { "Freisetzung", a.Freisetzung.ToString(De) }, new[] { "Raumänderung", a.Raum.ToString(De) }, new[] { "Verlegung/Tausch", a.Verlegung.ToString(De) }, new[] { "offen", a.Offen.ToString(De) },
                    new[] { "Geplante Stunden", u.Geplant.ToString(De) }, new[] { "Gemäß Plan erteilt", u.GemaessPlan.ToString(De) }, new[] { "Nicht erteilt", u.NichtErteilt.ToString(De) }, new[] { "Sondereinsätze", u.Sondereinsaetze.ToString(De) },
                };
                var arten = zeilen.Select(_ => "").ToList();
                void Gruppe(string titel, Dictionary<string, int> werte)
                {
                    if (werte.Count == 0) return;
                    zeilen.Add(new[] { titel }); arten.Add("gruppe");
                    foreach (var (k, v) in werte.OrderByDescending(x => x.Value)) { zeilen.Add(new[] { k, v.ToString(De) }); arten.Add(""); }
                }
                Gruppe("Nach Grund", u.NachGrund);
                Gruppe("Nach Art", u.NachArt);
                Gruppe("Entfall nach Grund", u.EntfallNachGrund);
                return new Bericht("Unterrichtsausfall", zeitraum, new[] { "Kennzahl", "Anzahl" }, zeilen, false, arten);
            }
            case "entfalltage":
            {
                var zeilen = Statistik.Entfalltage(d, von, bis).OrderBy(x => x.Datum).ThenBy(x => x.Lehrer.Kurzname, cmp)
                    .Select(x => (IReadOnlyList<string>)new[] { Format.Datum(x.Datum), x.Lehrer.Kurzname, x.Lehrer.VollerName, x.Stunden.ToString(De), x.Grund }).ToList();
                return new Bericht("Entfalltage", zeitraum, new[] { "Datum", "Kürzel", "Name", "Stunden", "Grund" }, zeilen);
            }
            case "abrechnung":
            case "vertretungsuebersicht":
            {
                var ab = AbrechnungApi.Bericht(d, id == "abrechnung" ? 0 : 5, von, bis, null);
                var zeilen = ab.Zeilen.Select(z => (IReadOnlyList<string>)(z.Markierung == "gruppe" ? new[] { z.Werte[0].Trim('—', ' ') is var g && g.Length > 0 ? char.ToUpper(g[0]) + g[1..] : g } : z.Werte.Select(w => w.Trim()).ToArray())).ToList();
                var arten = ab.Zeilen.Select(z => z.Markierung == "gruppe" ? "gruppe" : "").ToList();
                return new Bericht(id == "abrechnung" ? "Vertretungsabrechnung" : "Vertretungs-Übersicht", zeitraum, ab.Kopf, zeilen, ab.Kopf.Length > 7, arten.Contains("gruppe") ? arten : null)
                {
                    Hinweis = string.Join("\n", ab.Summe.Split('\n').Where(x => !x.Contains("Doppelklick"))), Wechselzeilen = zeilen.Count > 12,
                    Unterschriften = id == "abrechnung" ? new[] { "Ort, Datum", "Schulleitung" } : null,
                };
            }
            case "mehrarbeit":
            {
                var zeilen = new List<IReadOnlyList<string>>();
                var arten = new List<string>();
                string[] kopf = Array.Empty<string>();
                foreach (var l in Statistik.Abrechnung(d, von, bis).Select(x => x.Lehrer))
                {
                    var ab = AbrechnungApi.Bericht(d, 2, von, bis, l);
                    if (ab.Zeilen.Count == 0) continue;
                    kopf = ab.Kopf;
                    zeilen.Add(new[] { $"{l.Kurzname} – {l.VollerName}" }); arten.Add("gruppe");
                    foreach (var z in ab.Zeilen) { zeilen.Add(z.Werte); arten.Add(""); }
                    var summe = new string[ab.Kopf.Length];
                    for (var i = 0; i < summe.Length; i++) summe[i] = i == 0 ? $"Summe {l.Kurzname}" : int.TryParse(ab.Zeilen[0].Werte[i].TrimStart('+'), out _) ? ab.Zeilen.Sum(z => int.TryParse(z.Werte[i].TrimStart('+'), out var n) ? n : 0).ToString(De) : "";
                    zeilen.Add(summe); arten.Add("zwischensumme");
                }
                if (kopf.Length == 0) kopf = new[] { "Monat", "Mehrarbeit" };
                return new Bericht("Mehrarbeit NRW je Lehrkraft", zeitraum, kopf, zeilen, kopf.Length > 7, arten) { Unterschriften = new[] { "Ort, Datum", "Schulleitung" } };
            }
            case "pausenaufsicht":
            {
                var pausen = Pausenaufsichten.AufsichtsPausen(d).ToList();
                var tage = Enumerable.Range(0, d.Zeitraster.TageProWoche).ToList();
                var spalten = new[] { "Pause", "Zeit" }.Concat(tage.Select(t => Planungsdienst.Tagname(d, t, true))).ToList();
                var zeilen = new List<IReadOnlyList<string>>();
                var arten = new List<string>();
                foreach (var gang in Stammdaten.Sortiert(d.Gaenge))
                {
                    zeilen.Add(new[] { gang.Langname.Length > 0 && gang.Langname != gang.Kurzname ? $"{gang.Kurzname} – {gang.Langname}" : gang.Kurzname }); arten.Add("gruppe");
                    foreach (var p in pausen)
                    {
                        var zeile = new List<string> { Pausenaufsichten.PausenName(d, p.NachStunde), $"{d.Zeitraster.Zeit(p.NachStunde)?.Ende:H\\:mm}–{d.Zeitraster.Zeit(p.NachStunde + 1)?.Beginn:H\\:mm}" };
                        foreach (var t in tage)
                        {
                            var teile = Pausenaufsichten.Teile(d, gang.Id, t, p.NachStunde);
                            var liste = d.Pausenaufsichten.Where(a => a.GangId == gang.Id && a.Tag == t && a.NachStunde == p.NachStunde && a.Datum is null).ToList();
                            zeile.Add(teile == 0 ? "–" : string.Join(", ", Enumerable.Range(1, teile).Select(teil => liste.FirstOrDefault(a => a.Teil == teil) is { } a ? ix.KLehrer(a.LehrerId) : "???")));
                        }
                        zeilen.Add(zeile); arten.Add("");
                    }
                }
                return new Bericht("Pausenaufsichtsplan", $"{periode} · „???“ = noch nicht besetzt, „–“ = keine Aufsicht", spalten, zeilen, true, arten);
            }
            case "pausenaufsicht-lehrer":
            {
                var zeilen = Stammdaten.Sortiert(d.Lehrer).Where(l => !l.Ignorieren).Select(l =>
                {
                    var termine = d.Pausenaufsichten.Where(a => a.LehrerId == l.Id && a.Datum is null).OrderBy(a => a.Tag).ThenBy(a => a.NachStunde)
                        .Select(a => $"{Planungsdienst.Tagname(d, a.Tag)} {Pausenaufsichten.PausenName(d, a.NachStunde)} {ix.K(ElementTyp.Gang, a.GangId)}");
                    var ist = Pausenaufsichten.IstMinuten(d, l.Id);
                    return (IReadOnlyList<string>)new[] { l.Kurzname, l.VollerName, Pausenaufsichten.Anzahl(d, l.Id).ToString(De), ist.ToString(De), l.PausenaufsichtMaxMinuten.ToString(De),
                        (ist - l.PausenaufsichtMaxMinuten).ToString("+0;-0;0", De), string.Join(", ", termine) };
                }).ToList();
                return new Bericht("Pausenaufsichten je Lehrkraft", periode, new[] { "Kürzel", "Name", "Anzahl", "Minuten", "Max", "Differenz", "Aufsichten" }, zeilen, true) { Wechselzeilen = zeilen.Count > 15 };
            }
            case "klausuren":
            {
                var zeilen = new List<IReadOnlyList<string>>();
                var arten = new List<string>();
                foreach (var g in d.Klausuren.Where(k => k.Aktiv && k.Datum >= von && k.Datum <= bis).OrderBy(k => k.Datum).ThenBy(k => k.StundeVon).GroupBy(k => k.Datum))
                {
                    zeilen.Add(new[] { $"{Planungsdienst.TageLang[((int)g.Key.DayOfWeek + 6) % 7]}, {Format.Datum(g.Key)}" }); arten.Add("gruppe");
                    foreach (var k in g)
                    {
                        zeilen.Add(new[] { k.StundeVon == k.StundeBis ? $"{k.StundeVon}." : $"{k.StundeVon}.–{k.StundeBis}.", k.Name, ix.KKlassen(k.KlassenIds),
                            string.Join(", ", k.LehrerIds.Select(ix.KLehrer)), string.Join(", ", k.RaumIds.Select(ix.KRaum)), k.Text });
                        arten.Add("");
                    }
                }
                return new Bericht("Klausurplan", zeitraum, new[] { "Std.", "Klausur/Prüfung", "Klasse(n)", "Aufsicht", "Raum", "Bemerkung" }, zeilen, false, arten);
            }
            case "kurse":
            {
                var zeilen = new List<IReadOnlyList<string>>();
                var arten = new List<string>();
                foreach (var k in Stammdaten.Sortiert(d, ElementTyp.Klasse))
                {
                    var kurse = Kursplanung.Kurse(d, k.Id);
                    if (kurse.Count == 0) continue;
                    zeilen.Add(new[] { $"{k.Kurzname}{(k.Langname.Length > 0 && k.Langname != k.Kurzname ? " – " + k.Langname : "")}" }); arten.Add("gruppe");
                    foreach (var u in kurse.OrderBy(u => u.Band, cmp).ThenBy(u => u.Kursname, cmp))
                    {
                        var teil = d.Schueler.Where(x => x.KurswahlIds.Contains(u.Id)).ToList();
                        zeilen.Add(new[] { u.Kursname.Length > 0 ? u.Kursname : ix.KFach(u.HauptfachId), ix.KFach(u.HauptfachId), string.Join(", ", u.LehrerIds.Select(ix.KLehrer)), u.Band,
                            u.Wochenstunden.ToString(De), teil.Count.ToString(De), $"{teil.Count(x => x.Geschlecht == "m")}/{teil.Count(x => x.Geschlecht == "w")}" });
                        arten.Add("");
                    }
                }
                return new Bericht("Kursliste", periode, new[] { "Kurs", "Fach", "Lehrkraft", "Band", "Wst", "Teilnehmer", "m/w" }, zeilen, false, arten);
            }
            case "kursteilnehmer":
            {
                var zeilen = new List<IReadOnlyList<string>>();
                var arten = new List<string>();
                foreach (var u in Kursplanung.Kurse(d).OrderBy(u => ix.KKlassen(u.KlassenIds), cmp).ThenBy(u => u.Kursname, cmp))
                {
                    var teil = Stammdaten.Sortiert(d.Schueler.Where(x => x.KurswahlIds.Contains(u.Id))).ToList();
                    zeilen.Add(new[] { $"{(u.Kursname.Length > 0 ? u.Kursname : ix.KFach(u.HauptfachId))} · {ix.KKlassen(u.KlassenIds)} · {string.Join(", ", u.LehrerIds.Select(ix.KLehrer))} · {teil.Count} Teilnehmende" });
                    arten.Add("gruppe");
                    var nr = 0;
                    foreach (var x in teil)
                    {
                        zeilen.Add(new[] { (++nr).ToString(De), x.Langname.Length > 0 ? x.Langname : x.Kurzname, x.Vorname, ix.KKlassen(x.KlasseId is int kid ? new[] { kid } : Array.Empty<int>()), "" });
                        arten.Add("");
                    }
                }
                return new Bericht("Kursteilnehmer", periode, new[] { "Nr.", "Name", "Vorname", "Klasse", "Bemerkung" }, zeilen, false, arten) { Senkrechte = true };
            }
            default:
                throw StudioFehler.NichtGefunden($"Der Bericht „{id}“");
        }
    }

    // ------------------------------------------------------------------------------------------ Endpunkte

    public void EndpunkteRegistrieren(StudioRouten r)
    {
        var g = r.Dokument.MapGroup("/druck");

        // Auswahl für den Druckdialog: Elemente je Art, Formate, Berichte
        g.MapGet("/auswahl", (Arbeitsdokument a) => a.LesenAsync(doc =>
        {
            var d = doc.Daten;
            object Liste(ElementTyp t) => Stammdaten.Sortiert(d, t).Select(e => new { id = e.Id, k = e.Kurzname, l = e is Lehrer l ? l.VollerName : e.Langname }).ToList();
            return new
            {
                klasse = Liste(ElementTyp.Klasse), lehrer = Liste(ElementTyp.Lehrer), raum = Liste(ElementTyp.Raum), fach = Liste(ElementTyp.Fach),
                formate = d.Formate.Select(f => new { f.Name, typ = Typnamen.Schluessel(f.Typ), f.Gross, f.Grundform }).ToList(),
                berichte = Berichte,
                schuljahrVon = d.Einstellungen.SchuljahrVon, schuljahrBis = d.Einstellungen.SchuljahrBis,
                periode = d.AktivePeriode.Name,
            };
        }));

        // ---- Stundenpläne (PDF bzw. HTML) ----
        g.MapGet("/stundenplaene", async (HttpContext ctx, Arbeitsdokument a, ClaimsPrincipal p, string? typ, string? ids, string? format, bool? kompakt, bool? farbig, DateOnly? woche, string? ausgabe, bool? herunterladen) =>
        {
            var t = PlanTyp(typ);
            var html = string.Equals(ausgabe, "html", StringComparison.OrdinalIgnoreCase);
            var (inhalt, name) = await a.LesenAsync(doc =>
            {
                var d = doc.Daten;
                var liste = Ids(d, t, ids);
                if (liste.Count > 2000) throw StudioFehler.Ungueltig("Zu viele Elemente gewählt.");
                var f = string.IsNullOrWhiteSpace(format) ? null : d.Formate.FirstOrDefault(x => x.Name.Equals(format, StringComparison.CurrentCultureIgnoreCase))
                    ?? throw StudioFehler.NichtGefunden($"Das Stundenplanformat „{format}“");
                var titel = $"Stundenpläne {Typnamen.Name(t, true)}";
                if (html) return (Encoding.UTF8.GetBytes(Export.Seite(titel, string.Concat(liste.Select(id => Export.StundenplanHtml(d, t, id))))), titel + ".html");
                var o = StundenplanDruckOptionen.AusFormat(f, kompakt ?? (f is not null && !f.Gross), farbig ?? false) with { Woche = woche, Ersteller = p.Benutzername() };
                return (StundenplanPdf.Erzeugen(d, doc.Index, t, liste, o), titel + ".pdf");
            });
            return Datei(ctx, inhalt, html ? "text/html; charset=utf-8" : "application/pdf", name, herunterladen == true);
        });

        // ---- Info-Stundenplan: Seiten einzeln (für die Anzeige im Browser) und als ZIP ----
        g.MapGet("/info/{datei}", async (HttpContext ctx, Arbeitsdokument a, string datei) =>
        {
            var html = await a.LesenAsync(doc =>
            {
                var d = doc.Daten;
                if (datei is "index.html" or "") return InfoIndex(d);
                foreach (var t in new[] { ElementTyp.Klasse, ElementTyp.Lehrer, ElementTyp.Raum })
                    foreach (var e in d.AlleElemente(t))
                        if (InfoDatei(t, e) == datei)
                            return Export.Seite($"{ListenPdf.TypText(t)} {e.Kurzname}", "<nav><a href=\"index.html\">Übersicht</a></nav>" + Export.StundenplanHtml(d, t, e.Id));
                throw StudioFehler.NichtGefunden($"Die Seite „{datei}“");
            });
            return Html(ctx, html, datei, false);
        });
        g.MapGet("/infostundenplan.zip", async (HttpContext ctx, Arbeitsdokument a) =>
        {
            var (dateien, schule) = await a.LesenAsync(doc => (Export.InfoStundenplan(doc.Daten), doc.Daten.Einstellungen.Schulname));
            using var ms = new MemoryStream();
            using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, true))
                foreach (var (name, inhalt) in dateien)
                {
                    await using var s = zip.CreateEntry(name, CompressionLevel.Optimal).Open();
                    await s.WriteAsync(Encoding.UTF8.GetBytes(inhalt));
                }
            return Datei(ctx, ms.ToArray(), "application/zip", $"Aushang {schule}.zip", true);
        });

        // ---- iCalendar ----
        g.MapGet("/ical", async (HttpContext ctx, Arbeitsdokument a, int? lehrer, DateOnly? von, DateOnly? bis) =>
        {
            var heute = DateOnly.FromDateTime(DateTime.Today);
            var v = von ?? heute;
            var b = bis ?? v.AddDays(27);
            if (b < v) throw StudioFehler.Ungueltig("Das Ende liegt vor dem Beginn.");
            if (b.DayNumber - v.DayNumber > 400) throw StudioFehler.Ungueltig("Höchstens ein Jahr auf einmal.");
            if (lehrer is int lid)
            {
                var (ics, kurz) = await a.LesenAsync(doc =>
                {
                    var l = doc.Daten.Lehrer.FirstOrDefault(x => x.Id == lid) ?? throw StudioFehler.NichtGefunden($"Die Lehrkraft Nr. {lid}");
                    return (Export.ICal(doc.Daten, lid, v, b), l.Kurzname);
                });
                return Datei(ctx, Encoding.UTF8.GetBytes(ics), "text/calendar; charset=utf-8", $"Stundenplan_{DateiTeil(kurz)}.ics", true);
            }
            var alle = await a.LesenAsync(doc => doc.Daten.Lehrer.Select(l => (Name: $"Stundenplan_{DateiTeil(l.Kurzname)}.ics", Inhalt: Export.ICal(doc.Daten, l.Id, v, b))).ToList());
            using var ms = new MemoryStream();
            using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, true))
                foreach (var (name, inhalt) in alle)
                {
                    await using var s = zip.CreateEntry(name, CompressionLevel.Optimal).Open();
                    await s.WriteAsync(Encoding.UTF8.GetBytes(inhalt));
                }
            return Datei(ctx, ms.ToArray(), "application/zip", "Lehrer-Kalender.zip", true);
        });

        // ---- Vertretungsplan-Aushang ----
        g.MapGet("/aushang", (Arbeitsdokument a) => a.LesenAsync(doc => AushangDto(doc.Daten)));
        g.MapPut("/aushang", (Arbeitsdokument a, AushangLayout e, ClaimsPrincipal p) =>
        {
            e.Schriftgroesse = Math.Clamp(e.Schriftgroesse, 6, 20);
            if (e.Gruppierung is not ("Element" or "Stunde" or "Vertreter" or "Fach")) e.Gruppierung = "Element";
            VertretungsplanPdf.Felder(e);
            return a.AendernAsync(p.Benutzername(), "Seitenlayout Vertretungsplan", AenderungsArt.Einstellungen, d => AushangLayout.Schreiben(d, e), doc => AushangDto(doc.Daten));
        });
        g.MapGet("/vertretungsplan", async (HttpContext ctx, Arbeitsdokument a, ClaimsPrincipal p, DateOnly? von, DateOnly? bis, string? version, string? ausgabe, bool? gross, bool? herunterladen) =>
        {
            var v = von ?? DateOnly.FromDateTime(DateTime.Today);
            var b = bis ?? v;
            if (b < v) throw StudioFehler.Ungueltig("Das Ende liegt vor dem Beginn.");
            var lehrer = string.Equals(version, "lehrer", StringComparison.OrdinalIgnoreCase);
            var html = string.Equals(ausgabe, "html", StringComparison.OrdinalIgnoreCase);
            var monitor = string.Equals(ausgabe, "monitor", StringComparison.OrdinalIgnoreCase);
            var (inhalt, titel) = await a.LesenAsync(doc =>
            {
                var d = doc.Daten;
                var titel = $"{d.Einstellungen.Vertretungsplantitel} {(lehrer ? "Lehrer" : "Klassen")} {Format.Datum(v)}";
                if (html || monitor)
                    return (Encoding.UTF8.GetBytes(Export.VertretungsplanHtml(d, Kalender.Tage(v, b.DayNumber - v.DayNumber > 62 ? v.AddDays(62) : b).Where(t => Kalender.IstUnterrichtstag(d, t)), lehrer, monitor)), titel + ".html");
                return (VertretungsplanPdf.Erzeugen(doc, v, b, lehrer, AushangLayout.Lesen(d), p.Benutzername(), gross == true), titel + ".pdf");
            });
            return Datei(ctx, inhalt, html || monitor ? "text/html; charset=utf-8" : "application/pdf", titel, herunterladen == true);
        });

        // ---- Übersichtsplan (PDF) ----
        g.MapGet("/uebersicht", async (HttpContext ctx, Arbeitsdokument a, ClaimsPrincipal p, string? typ, string? inhalt, bool? herunterladen) =>
        {
            var t = PlanTyp(typ);
            var art = Enum.TryParse<UebersichtApi.Inhalt>(inhalt, true, out var i) ? i : UebersichtApi.Inhalt.Standard;
            var pdf = await a.LesenAsync(doc =>
            {
                var d = doc.Daten;
                var belegung = UebersichtApi.Belegung(d, doc.Index, t, art);
                return ListenPdf.Uebersicht(d, doc.Index, t, Stammdaten.Sortiert(d, t).ToList(), e => UebersichtApi.Zellen(belegung.GetValueOrDefault(e.Id)), p.Benutzername());
            });
            return Datei(ctx, pdf, "application/pdf", $"{ListenPdf.TypText(t)} Übersicht.pdf", herunterladen == true);
        });

        // ---- Berichte ----
        g.MapGet("/berichte", () => Berichte);
        g.MapGet("/bericht/{id}", async (HttpContext ctx, Arbeitsdokument a, ClaimsPrincipal p, string id, DateOnly? von, DateOnly? bis, string? ausgabe, bool? herunterladen) =>
        {
            var (bericht, pdf) = await a.LesenAsync(doc =>
            {
                var d = doc.Daten;
                var heute = DateOnly.FromDateTime(DateTime.Today);
                var v = von ?? d.Einstellungen.SchuljahrVon;
                var b = bis ?? (heute < d.Einstellungen.SchuljahrBis ? (heute < v ? v : heute) : d.Einstellungen.SchuljahrBis);
                if (b < v) throw StudioFehler.Ungueltig("Das Ende liegt vor dem Beginn.");
                if (b.DayNumber - v.DayNumber > 400) throw StudioFehler.Ungueltig("Höchstens ein Jahr auf einmal.");
                var ber = BerichtErzeugen(d, doc.Index, id, v, b);
                return (ber, (ausgabe ?? "pdf").ToLowerInvariant() == "pdf" ? ListenPdf.Bericht(d, ber, p.Benutzername()) : null);
            });
            switch ((ausgabe ?? "pdf").ToLowerInvariant())
            {
                case "json":
                    return Results.Ok(new { bericht.Titel, bericht.Untertitel, bericht.Spalten, bericht.Zeilen, bericht.Arten });
                case "csv":
                    var csv = Csv.Schreiben(new[] { (IEnumerable<object?>)bericht.Spalten }.Concat(bericht.Zeilen.Select(z => (IEnumerable<object?>)z)), ';', true);
                    return Datei(ctx, Encoding.UTF8.GetBytes(csv), "text/csv; charset=utf-8", bericht.Titel + ".csv", true);
                case "html":
                    return Html(ctx, HtmlTabelle(bericht), bericht.Titel + ".html", herunterladen == true);
                default:
                    return Datei(ctx, pdf!, "application/pdf", bericht.Titel + ".pdf", herunterladen == true);
            }
        });
    }

    private static string InfoIndex(Schuldatei d)
    {
        var sb = new StringBuilder($"<h1>{WebUtility.HtmlEncode(d.Einstellungen.Schulname)} – Stundenpläne</h1>");
        foreach (var (titel, t) in new[] { ("Klassen", ElementTyp.Klasse), ("Lehrer", ElementTyp.Lehrer), ("Räume", ElementTyp.Raum) })
        {
            sb.Append($"<h2>{titel}</h2><p>");
            foreach (var e in d.AlleElemente(t)) sb.Append($"<a href=\"{InfoDatei(t, e)}\">{WebUtility.HtmlEncode(e.Kurzname)}</a> ");
            sb.Append("</p>");
        }
        return Export.Seite("Stundenpläne", sb.ToString());
    }

    private static object AushangDto(Schuldatei d)
    {
        var e = AushangLayout.Lesen(d);
        return new
        {
            layout = e,
            felder = VertretungsplanPdf.AlleFelder.Select(f => new { schluessel = f.Schluessel, klassen = VertretungsplanPdf.StandardUeberschrift(f.Schluessel, false).Replace('\n', ' '), lehrer = VertretungsplanPdf.StandardUeberschrift(f.Schluessel, true).Replace('\n', ' ') }),
            gruppierungen = new[] { "Element", "Stunde", "Vertreter", "Fach" },
            titel = d.Einstellungen.Vertretungsplantitel,
        };
    }
}
