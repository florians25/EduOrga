using System.Globalization;
using UntPlan.Core;
using UntPlan.Core.Model;
using UntPlan.Core.Planung;
using UntPlan.Core.Vertretungsplanung;
using UntPlan.Druck;

namespace UntPlanStudio.Dienste;

/// <summary>Einstellungen eines Stundenplandrucks (aus der Druckauswahl und dem gewählten Stundenplanformat).</summary>
public sealed record StundenplanDruckOptionen
{
    /// <summary>Kompaktes Format: zwei Pläne je Seite ohne Unterrichtsliste (Desktop: „Format groß“ aus).</summary>
    public bool Kompakt { get; init; }
    /// <summary>Fachfarben als Grautöne hinterlegen (der Druck bleibt schwarz-weiß).</summary>
    public bool Farbig { get; init; }
    /// <summary>Doppelstunden/Blöcke nicht zusammenfassen.</summary>
    public bool Einzelstunden { get; init; }
    public bool PausenZeigen { get; init; } = true;
    public bool ZeitenZeigen { get; init; } = true;
    /// <summary>Langnamen der Fächer in den Zellen.</summary>
    public bool Langname { get; init; }
    public int VonStunde { get; init; } = 1;
    /// <summary>0 = bis zur letzten Stunde.</summary>
    public int BisStunde { get; init; }
    public int VonTag { get; init; }
    /// <summary>-1 = bis zum letzten Tag.</summary>
    public int BisTag { get; init; } = -1;
    /// <summary>Name des verwendeten Stundenplanformats (Anzeige im Untertitel).</summary>
    public string Format { get; init; } = "";
    /// <summary>Wochenplan mit Vertretungen, Entfällen, Raumänderungen und Prüfungen der Woche, in der dieser Tag liegt (null = Regelplan).</summary>
    public DateOnly? Woche { get; init; }
    /// <summary>Wer druckt (Fuß).</summary>
    public string Ersteller { get; init; } = "";

    public static StundenplanDruckOptionen AusFormat(StundenplanFormat? f, bool kompakt, bool farbig) => f is null
        ? new StundenplanDruckOptionen { Kompakt = kompakt, Farbig = farbig }
        : new StundenplanDruckOptionen
        {
            Kompakt = kompakt, Farbig = farbig && !f.SchwarzWeissDruck, Einzelstunden = f.Einzelstunden, PausenZeigen = f.Pausenbezeichnung,
            ZeitenZeigen = f.ZeitenAnzeigen, Langname = f.Langname, VonStunde = Math.Max(1, f.VonStunde), BisStunde = f.BisStunde,
            VonTag = Math.Max(0, f.VonTag), BisTag = f.BisTag, Format = f.Name,
        };
}

/// <summary>
/// Stundenpläne (Klasse, Lehrkraft, Raum, Fach) im gemeinsamen Druckdesign: A4 quer, je Plan eine Seite mit Titel, links das klassische
/// Raster (Stundennummern mit Zeiten, Pausenbänder, Doppelstunden zusammengefasst; je Zelle Fach halbfett, Lehrkraft bzw. Klasse, Raum),
/// rechts die Unterrichtsliste mit Wochenstunden, unten Kopplungen und Fächer. Kompakt: zwei Pläne je Seite. Wochenplan mit Änderungen:
/// Entfall schraffiert und durchgestrichen, Vertretung mit „»“ und durchgestrichenem Bisherigen, Zusatzstunden gestrichelt, Prüfungen
/// doppelt umrandet – mit Legende. Fachfarben nur auf Wunsch als Grautöne.
/// </summary>
public static class StundenplanPdf
{
    private static readonly CultureInfo De = CultureInfo.GetCultureInfo("de-DE");

    public static string TypName(ElementTyp t) => t switch
    {
        ElementTyp.Klasse => "Klasse",
        ElementTyp.Lehrer => "Lehrkraft",
        ElementTyp.Raum => "Raum",
        ElementTyp.Fach => "Fach",
        _ => t.ToString(),
    };

    private static string TypMehrzahl(ElementTyp t) => t switch
    {
        ElementTyp.Klasse => "Klassen",
        ElementTyp.Lehrer => "Lehrkräfte",
        ElementTyp.Raum => "Räume",
        ElementTyp.Fach => "Fächer",
        _ => t.ToString(),
    };

    public static byte[] Erzeugen(Schuldatei d, DatenIndex ix, ElementTyp typ, IReadOnlyList<int> ids, StundenplanDruckOptionen o)
    {
        var periode = d.AktivePeriode;
        var zeitraum = o.Woche is DateOnly w
            ? $"Woche vom {Format.Datum(TagDatum(d, w, 0))} bis {Format.Datum(TagDatum(d, w, d.Zeitraster.TageProWoche - 1))} mit Vertretungen und Änderungen"
            : $"{ListenPdf.PeriodeText(d)} · gültig ab {periode.Von.ToString("d. MMMM yyyy", De)}";
        if (o.Format.Length > 0) zeitraum += $" · Format „{o.Format}“";
        var kopf = ListenPdf.Kopf(d, $"Stundenpläne {TypMehrzahl(typ)}", zeitraum, o.Ersteller);
        var f = new Formular(kopf, true);
        if (ids.Count == 0)
        {
            f.NeueSeite();
            f.Absatz("Keine Elemente gewählt.");
            return f.Erzeugen();
        }
        if (o.Kompakt && ids.Count > 1)
        {
            for (var i = 0; i < ids.Count; i += 2)
            {
                f.NeueSeite(kopf.Titel, zeitraum);
                const float abstand = 22;
                var teil = ids.Skip(i).Take(2).ToList();
                var b = (f.Breite - abstand) / 2;
                for (var k = 0; k < teil.Count; k++)
                    Kompakt(f, d, ix, typ, teil[k], o, f.Links + k * (b + abstand), f.Y, b, f.Unten - f.Y);
            }
            return f.Erzeugen();
        }
        foreach (var id in ids)
        {
            var el = ix.Element(typ, id);
            f.NeueSeite($"Stundenplan {TypName(typ)} {el?.Kurzname}", Untertitel(d, ix, typ, el, zeitraum));
            Gross(f, d, ix, typ, id, o);
        }
        return f.Erzeugen();
    }

    private static string Langname(Element? el) => el is Lehrer l ? l.VollerName : el?.Langname ?? "";

    private static string Untertitel(Schuldatei d, DatenIndex ix, ElementTyp typ, Element? el, string zeitraum)
    {
        var teile = new List<string>();
        var lang = Langname(el);
        if (lang.Length > 0 && lang != el?.Kurzname) teile.Add(lang);
        if (el is Klasse k && k.KlassenlehrerIds.Count > 0) teile.Add("Klassenleitung " + string.Join(", ", k.KlassenlehrerIds.Select(ix.KLehrer)));
        teile.Add(zeitraum);
        return string.Join(" · ", teile);
    }

    // ------------------------------------------------------------------------------------------ Seitenaufbau

    private static void Gross(Formular f, Schuldatei d, DatenIndex ix, ElementTyp typ, int id, StundenplanDruckOptionen o)
    {
        var s = f.Seite;
        var fussnoten = new List<Fussnote>();
        var faecher = new SortedSet<string>(StringComparer.Create(De, true));
        var raster = Raster(d, ix, typ, id, o, fussnoten, faecher, false);

        // Unterrichtsliste rechts, Raster links
        var listeB = Math.Min(250, f.Breite * 0.31f);
        var rasterB = f.Breite - listeB - 16;
        var unten = Unterteil(f, d, ix, fussnoten, faecher, raster.Status.ToList(), measureOnly: true);
        var rasterUnten = raster.Zeichnen(s, f.Links, f.Y, rasterB, f.Unten - f.Y - unten);
        var liste = Unterrichtsliste(d, ix, typ, id);
        var lx = f.Links + rasterB + 16;
        s.Text(lx, f.Y + 8, 8.5f, "Unterricht", true);
        var (gesetzt, _) = liste.SetzenIn(s, lx, f.Y + 12, listeB, rasterUnten);
        var daten = liste.Zeilen.Count(z => z.Art == Zeilenart.Daten);
        if (gesetzt < liste.Zeilen.Count) s.TextRechts(lx + listeB, rasterUnten + 9, 6.5f, $"Liste gekürzt ({daten} Unterrichte)", false, Formular.GrauText);
        f.Y = rasterUnten + 8;
        Unterteil(f, d, ix, fussnoten, faecher, raster.Status.ToList(), measureOnly: false);
    }

    private static void Kompakt(Formular f, Schuldatei d, DatenIndex ix, ElementTyp typ, int id, StundenplanDruckOptionen o, float x, float y, float b, float h)
    {
        var s = f.Seite;
        var el = ix.Element(typ, id);
        var name = $"{TypName(typ)} {el?.Kurzname}";
        s.Text(x, y + 10, 12, name, true);
        var lang = Langname(el);
        if (lang.Length > 0 && lang != el?.Kurzname)
            s.Text(x + Satz.Breite(name, 12, true) + 8, y + 10, 8.5f, Satz.Kuerzen(lang, b - Satz.Breite(name, 12, true) - 10, 8.5f), false, Formular.GrauText);
        var fussnoten = new List<Fussnote>();
        var faecher = new SortedSet<string>(StringComparer.Create(De, true));
        var raster = Raster(d, ix, typ, id, o, fussnoten, faecher, true);
        var noten = fussnoten.Count > 0 ? string.Join("   ", fussnoten.Select(n => $"{n.Nr}) {n.Text}")) : "";
        var notenZeilen = noten.Length > 0 ? Satz.Umbrechen(noten, b, 6.5f).Take(3).ToList() : new List<string>();
        var status = raster.Status.ToList();
        var legendeH = status.Count > 0 ? 14f : 0;
        var unten = raster.Zeichnen(s, x, y + 16, b, h - 18 - notenZeilen.Count * 8.5f - legendeH);
        var yy = unten + 3;
        foreach (var z in notenZeilen) { yy += 8.5f; s.Text(x, yy, 6.5f, z, false, Formular.GrauText); }
        if (status.Count > 0) Stundenraster.Legende(s, x, yy + 4, b, status, 6.5f);
    }

    /// <summary>Kopplungen, Fächer und Zeichenerklärung unter dem Plan; gibt die benötigte Höhe zurück.</summary>
    private static float Unterteil(Formular f, Schuldatei d, DatenIndex ix, List<Fussnote> fussnoten, ISet<string> faecher, List<Stundenstatus> status, bool measureOnly)
    {
        const float g = 7.5f, zh = 10;
        var zeilen = new List<(string Titel, string Text)>();
        if (fussnoten.Count > 0) zeilen.Add(("Kopplungen", string.Join("   ", fussnoten.Select(n => $"{n.Nr}) {n.Text}"))));
        var fl = faecher.Select(k => ix.Faecher.Values.FirstOrDefault(x => x.Kurzname == k)).Where(x => x is { Langname.Length: > 0 } && x.Langname != x.Kurzname)
            .Select(x => $"{x!.Kurzname} {x.Langname}").ToList();
        if (fl.Count > 0) zeilen.Add(("Fächer", string.Join(" · ", fl)));
        float h = 0;
        var titelB = 52f;
        foreach (var (titel, text) in zeilen)
        {
            var teile = Satz.Umbrechen(text, f.Breite - titelB, g).Take(4).ToList();
            if (!measureOnly)
                for (var i = 0; i < teile.Count; i++)
                {
                    if (i == 0) f.Seite.Text(f.Links, f.Y + h + 8, g, titel, true);
                    f.Seite.Text(f.Links + titelB, f.Y + h + 8, g, teile[i]);
                    h += zh;
                }
            else h += teile.Count * zh;
        }
        if (status.Count > 0)
        {
            if (!measureOnly) h += Stundenraster.Legende(f.Seite, f.Links, f.Y + h + 2, f.Breite, status, g) + 2;
            else h += 16;
        }
        return h + 6;
    }

    // ------------------------------------------------------------------------------------------ Raster

    private sealed record Teil(Kopplungszeile Zeile, int Index, int? Raum);
    private sealed record Fussnote(int Nr, string Text);

    internal static DateOnly TagDatum(Schuldatei d, DateOnly woche, int tag) => Kalender.Montag(woche).AddDays(d.Zeitraster.ErsterSchultag + tag);

    private static List<Teil> Teile(Unterricht u, Planstunde p, ElementTyp typ, int id)
    {
        var res = new List<Teil>();
        for (var i = 0; i < u.Zeilen.Count; i++)
        {
            var z = u.Zeilen[i];
            var raum = i < p.Raeume.Count ? p.Raeume[i] : null;
            var dabei = typ switch
            {
                ElementTyp.Klasse => z.KlassenIds.Contains(id),
                ElementTyp.Lehrer => z.LehrerId == id,
                ElementTyp.Raum => raum == id,
                ElementTyp.Fach => z.FachId == id,
                _ => true,
            };
            if (dabei) res.Add(new Teil(z, i, raum ?? z.FachraumId ?? z.StammraumId));
        }
        return res.Count > 0 ? res : u.Zeilen.Take(1).Select(z => new Teil(z, 0, null)).ToList();
    }

    /// <summary>Fach, Person (Lehrkraft bzw. Klasse) und dritte Angabe (Raum bzw. Lehrkraft) je Planart.</summary>
    private static (string Fach, string Person, string Raum) Angaben(ElementTyp typ, string fach, string lehrer, string klassen, string raum) => typ switch
    {
        ElementTyp.Klasse => (fach, lehrer, raum),
        ElementTyp.Lehrer => (fach, klassen, raum),
        ElementTyp.Raum => (fach, klassen, lehrer),
        _ => (klassen, lehrer, raum),
    };

    private static float? Grau(DatenIndex ix, int? fachId, StundenplanDruckOptionen o)
    {
        if (!o.Farbig || fachId is not int f || ix.Faecher.GetValueOrDefault(f) is not { Hintergrund: not 0 } fa) return null;
        var c = fa.Hintergrund;
        var hell = (0.299f * ((c >> 16) & 0xFF) + 0.587f * ((c >> 8) & 0xFF) + 0.114f * (c & 0xFF)) / 255f;
        return 0.80f + 0.17f * hell;
    }

    private static Stundenraster Raster(Schuldatei d, DatenIndex ix, ElementTyp typ, int id, StundenplanDruckOptionen o, List<Fussnote> fussnoten, ISet<string> faecher, bool kompakt)
    {
        var zr = d.Zeitraster;
        var tagVon = Math.Clamp(o.VonTag, 0, Math.Max(0, zr.TageProWoche - 1));
        var tagBis = o.BisTag < 0 ? zr.TageProWoche - 1 : Math.Clamp(o.BisTag, tagVon, zr.TageProWoche - 1);
        var stVon = Math.Clamp(o.VonStunde, 1, Math.Max(1, zr.StundenProTag));
        var stBis = o.BisStunde <= 0 ? zr.StundenProTag : Math.Clamp(o.BisStunde, stVon, zr.StundenProTag);
        var tage = Enumerable.Range(tagVon, Math.Max(0, tagBis - tagVon + 1)).ToList();
        var r = new Stundenraster { Kompakt = kompakt, ZeitenZeigen = o.ZeitenZeigen };
        foreach (var t in tage)
        {
            r.Tage.Add(Planungsdienst.Tagname(d, t, true));
            if (o.Woche is DateOnly w)
            {
                var datum = TagDatum(d, w, t);
                r.Daten.Add($"{datum:d.M.}");
                if (!Kalender.IstUnterrichtstag(d, datum)) r.FreieTage[r.Tage.Count - 1] = Kalender.FreiBezeichnung(d, datum) is { Length: > 0 } fb ? fb : "unterrichtsfrei";
            }
        }
        for (var st = stVon; st <= stBis; st++)
        {
            var zeit = zr.Zeit(st);
            var pause = o.PausenZeigen && st < stBis ? zr.Pausen.FirstOrDefault(p => p.NachStunde == st) : null;
            r.Stunden.Add(new Rasterstunde(zr.StundenLabel(st), zeit is null ? "" : $"{zeit.Beginn:H\\:mm}", zeit is null ? "" : $"{zeit.Ende:H\\:mm}",
                pause is null ? null : pause.Bezeichnung.Length > 0 ? pause.Bezeichnung : ""));
        }

        var plan = ix.PlanVon(typ, id).Where(p => p.Stunde >= stVon && p.Stunde <= stBis).ToList();
        // Einträge je Tag und Stunde (Wochenplan: mit Änderungen)
        var eintraege = new Dictionary<(int Tag, int Stunde), List<Rastereintrag>>();
        foreach (var t in tage)
        {
            var datum = o.Woche is DateOnly wo ? TagDatum(d, wo, t) : (DateOnly?)null;
            var frei = datum is DateOnly df && !Kalender.IstUnterrichtstag(d, df);
            var vertretungen = datum is DateOnly dv && !frei ? Vertretungen.Am(d, dv).Where(v => !v.NichtDrucken && v.Art != VertretungsArt.Pausenaufsicht).ToList() : new List<Vertretung>();
            var benutzt = new HashSet<Vertretung>();
            for (var st = stVon; st <= stBis; st++)
            {
                var liste = new List<Rastereintrag>();
                if (frei) continue;
                foreach (var p in plan.Where(p => p.Tag == t && p.Stunde == st))
                {
                    if (!ix.Unterrichte.TryGetValue(p.UnterrichtId, out var u)) continue;
                    var teile = Teile(u, p, typ, id);
                    string hinweis = "";
                    if (u.Zeilen.Count > 1)
                    {
                        var text = string.Join("; ", u.Zeilen.Select((z, i) =>
                        {
                            var raum = i < p.Raeume.Count && p.Raeume[i] is int rr ? ix.KRaum(rr) : z.FachraumId is int fr ? ix.KRaum(fr) : "";
                            return $"{ix.KFach(z.FachId)} {ix.KLehrer(z.LehrerId)}{(raum.Length > 0 ? " " + raum : "")} ({ix.KKlassen(z.KlassenIds)})";
                        }));
                        var nr = fussnoten.FirstOrDefault(n => n.Text == text)?.Nr;
                        if (nr is null) { nr = fussnoten.Count + 1; fussnoten.Add(new Fussnote(nr.Value, text)); }
                        hinweis = $"{nr})";
                    }
                    foreach (var tl in teile.Take(u.Zeilen.Count > 1 && teile.Count > 3 ? 3 : 99))
                    {
                        var fachEl = tl.Zeile.FachId is int fid ? ix.Faecher.GetValueOrDefault(fid) : null;
                        if (fachEl != null) faecher.Add(fachEl.Kurzname);
                        var fach = o.Langname && fachEl is { Langname.Length: > 0 } ? fachEl.Langname : ix.KFach(tl.Zeile.FachId);
                        var (a, b, c) = Angaben(typ, fach, ix.KLehrer(tl.Zeile.LehrerId), ix.KKlassen(tl.Zeile.KlassenIds), tl.Raum is int rr ? ix.KRaum(rr) : "");
                        var e = new Rastereintrag { Fach = a, Person = b, Raum = c, Hinweis = hinweis, Grau = Grau(ix, tl.Zeile.FachId, o) };
                        if (datum is not null)
                        {
                            var v = vertretungen.FirstOrDefault(x => !benutzt.Contains(x) && x.UnterrichtId == u.Id && x.Stunde == st && (x.ZeilenIndex == tl.Index || u.Zeilen.Count == 1))
                                    ?? vertretungen.FirstOrDefault(x => !benutzt.Contains(x) && x.UnterrichtId == u.Id && x.Stunde == st);
                            if (v != null) { benutzt.Add(v); Aendern(e, v, typ, id, ix, tl); }
                        }
                        liste.Add(e);
                    }
                }
                if (datum is DateOnly dt)
                {
                    // zusätzliche Stunden (Vertretung durch die Lehrkraft, verlegte Stunden, Raum neu belegt)
                    foreach (var v in vertretungen.Where(x => x.Stunde == st && !benutzt.Contains(x) && !x.IstEntfall && Betrifft(x, typ, id)))
                    {
                        benutzt.Add(v);
                        var (a, b, c) = Angaben(typ, ix.KFach(v.VertretungsfachId ?? v.FachId), ix.KLehrer(v.VertreterId), ix.KKlassen(v.NeueKlassenIds), ix.KRaum(v.VertretungsraumId ?? v.RaumId));
                        liste.Add(new Rastereintrag { Fach = a, Person = b, Raum = c, Status = Stundenstatus.Zusatz, Hinweis = v.Art == VertretungsArt.Verlegung || v.VonDatum.HasValue ? "verlegt" : "" });
                    }
                    foreach (var k in d.Klausuren.Where(k => k.Aktiv && k.Datum == dt && st >= k.StundeVon && st <= k.StundeBis && KlausurBetrifft(k, typ, id)))
                    {
                        var (a, b, c) = Angaben(typ, k.Name.Length > 0 ? k.Name : "Prüfung", string.Join(",", k.LehrerIds.Select(ix.KLehrer)), ix.KKlassen(k.KlassenIds),
                            string.Join(",", k.RaumIds.Select(ix.KRaum)));
                        liste.RemoveAll(x => x.Status == Stundenstatus.Normal && k.UnterrichtEntfaellt && typ == ElementTyp.Klasse);
                        liste.Add(new Rastereintrag { Fach = a, Person = b, Raum = c, Status = Stundenstatus.Pruefung });
                    }
                }
                if (liste.Count > 0) eintraege[(t, st)] = liste;
            }
        }

        string Schluessel(int t, int st) => eintraege.TryGetValue((t, st), out var l)
            ? string.Join("|", l.Select(e => $"{e.Fach}/{e.Person}/{e.Raum}/{e.FachAlt}/{e.PersonAlt}/{e.RaumAlt}/{e.Status}/{e.Hinweis}/{e.Grau}"))
            : "";
        for (var ti = 0; ti < tage.Count; ti++)
        {
            var t = tage[ti];
            var st = stVon;
            while (st <= stBis)
            {
                var sch = Schluessel(t, st);
                var bis = st;
                while (!o.Einzelstunden && sch.Length > 0 && bis < stBis && !(o.PausenZeigen && zr.Pausen.Any(p => p.NachStunde == bis)) && Schluessel(t, bis + 1) == sch) bis++;
                if (sch.Length > 0) r.Zelle(ti, st - stVon, bis - stVon).Eintraege.AddRange(eintraege[(t, st)]);
                st = bis + 1;
            }
        }
        return r;
    }

    private static bool Betrifft(Vertretung v, ElementTyp typ, int id) => typ switch
    {
        ElementTyp.Klasse => v.NeueKlassenIds.Contains(id) && v.Art is not (VertretungsArt.Raumbuchung or VertretungsArt.Vormerkung),
        ElementTyp.Lehrer => v.VertreterId == id,
        ElementTyp.Raum => (v.VertretungsraumId ?? v.RaumId) == id,
        ElementTyp.Fach => (v.VertretungsfachId ?? v.FachId) == id,
        _ => false,
    };

    private static bool KlausurBetrifft(Klausur k, ElementTyp typ, int id) => typ switch
    {
        ElementTyp.Klasse => k.KlassenIds.Contains(id),
        ElementTyp.Lehrer => k.LehrerIds.Contains(id),
        ElementTyp.Raum => k.RaumIds.Contains(id),
        _ => false,
    };

    /// <summary>Änderung durch eine Vertretung an einem Planeintrag: Entfall, neue Lehrkraft, neuer Raum, neues Fach.</summary>
    private static void Aendern(Rastereintrag e, Vertretung v, ElementTyp typ, int id, DatenIndex ix, Teil tl)
    {
        if (v.IstEntfall || (v.NachDatum.HasValue && v.Art is VertretungsArt.Verlegung or VertretungsArt.Tausch or VertretungsArt.Lehrertausch))
        {
            e.Status = Stundenstatus.Entfall;
            if (v.NachDatum is DateOnly nach) e.Hinweis = $"verlegt auf {nach:d.M.}";
            return;
        }
        if (v.Art is VertretungsArt.Raumbuchung or VertretungsArt.Vormerkung or VertretungsArt.Unterricht) return;
        var geaendert = false;
        // Lehrkraft
        var alt = ix.KLehrer(v.LehrerId ?? tl.Zeile.LehrerId);
        var neu = v.VertreterId is int vid ? ix.KLehrer(vid) : v.Art is VertretungsArt.VertretungOhneLehrer or VertretungsArt.EigenverantwortlichesArbeiten ? "" : "???";
        if (typ == ElementTyp.Lehrer)
        {
            if (v.VertreterId != id && v.LehrerId == id)
            {
                e.Status = Stundenstatus.Entfall;
                e.Hinweis = neu.Length > 0 ? $"vertreten: {neu}" : "vertreten";
                return;
            }
        }
        else if (neu != alt && (v.VertreterId.HasValue || v.Art is VertretungsArt.Vertretung or VertretungsArt.VertretungOhneLehrer or VertretungsArt.EigenverantwortlichesArbeiten))
        {
            if (typ == ElementTyp.Klasse || typ == ElementTyp.Fach) { e.PersonAlt = alt; e.Person = neu.Length > 0 ? neu : "EVA"; }
            else { e.RaumAlt = alt; e.Raum = neu.Length > 0 ? neu : "EVA"; }
            geaendert = true;
        }
        // Raum
        if (v.VertretungsraumId is int nr && nr != (tl.Raum ?? -1))
        {
            var altRaum = tl.Raum is int rr ? ix.KRaum(rr) : "";
            if (typ == ElementTyp.Raum) { e.Status = Stundenstatus.Entfall; e.Hinweis = $"in {ix.KRaum(nr)}"; return; }
            e.RaumAlt = altRaum;
            e.Raum = ix.KRaum(nr);
            geaendert = true;
        }
        // Fach
        if (v.VertretungsfachId is int nf && nf != tl.Zeile.FachId)
        {
            e.FachAlt = e.Fach;
            e.Fach = ix.KFach(nf);
            geaendert = true;
        }
        if (geaendert) e.Status = Stundenstatus.Aenderung;
    }

    // ------------------------------------------------------------------------------------------ Unterrichtsliste

    private static Tabelle Unterrichtsliste(Schuldatei d, DatenIndex ix, ElementTyp typ, int id)
    {
        var t = new Tabelle { Schriftgroesse = 7.2f, LeerText = "Kein Unterricht." };
        t.Spalte("U-Nr", Ausrichtung.Rechts, 0, false);
        t.Spalte("Fach", null, 0, false, true);
        switch (typ)
        {
            case ElementTyp.Klasse: t.Spalte("Lehrkraft"); break;
            case ElementTyp.Lehrer: t.Spalte("Klasse(n)"); break;
            default: t.Spalte("Klasse(n)"); t.Spalte("Lehrkraft"); break;
        }
        t.Spalte("Wst", Ausrichtung.Rechts, 0, false);
        decimal summe = 0;
        foreach (var u in ix.UnterrichteVon(typ, id).OrderBy(u => u.Id))
        {
            var zeilen = typ switch
            {
                ElementTyp.Lehrer => u.Zeilen.Where(z => z.LehrerId == id).ToList(),
                ElementTyp.Klasse => u.Zeilen.Where(z => z.KlassenIds.Contains(id)).ToList(),
                ElementTyp.Fach => u.Zeilen.Where(z => z.FachId == id).ToList(),
                _ => u.Zeilen.ToList(),
            };
            if (zeilen.Count == 0) zeilen = u.Zeilen.Take(1).ToList();
            var fach = string.Join(", ", zeilen.Select(z => ix.KFach(z.FachId)).Distinct());
            var lehrer = string.Join(", ", zeilen.Select(z => ix.KLehrer(z.LehrerId)).Where(x => x.Length > 0).Distinct());
            var klassen = string.Join(", ", zeilen.Select(z => ix.KKlassen(z.KlassenIds)).Where(x => x.Length > 0).Distinct());
            var wst = u.Wochenstunden.ToString(De) + (u.Zeilen.Count > 1 ? "*" : "");
            var werte = typ switch
            {
                ElementTyp.Klasse => new[] { u.Id.ToString(De), fach, lehrer, wst },
                ElementTyp.Lehrer => new[] { u.Id.ToString(De), fach, klassen, wst },
                _ => new[] { u.Id.ToString(De), fach, klassen, lehrer, wst },
            };
            t.Zeile(werte);
            summe += u.Wochenstunden;
        }
        if (t.Zeilen.Count > 0)
        {
            var werte = Enumerable.Repeat("", t.Spalten.Count).ToArray();
            werte[1] = "Summe";
            werte[^1] = summe.ToString("0.##", De);
            t.Summe(werte);
        }
        return t;
    }
}
