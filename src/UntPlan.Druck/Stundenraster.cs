namespace UntPlan.Druck;

/// <summary>Status einer Stunde im Druck – abzulesen an Schraffur, Durchstreichung und Rahmenart, nie an Farbe.</summary>
public enum Stundenstatus
{
    Normal,
    /// <summary>Entfall: schräg schraffiert, Angaben durchgestrichen, „entfällt“.</summary>
    Entfall,
    /// <summary>Vertretung bzw. Änderung (Lehrkraft, Raum, Fach): Bisheriges durchgestrichen, Neues halbfett, Kennzeichen „»“.</summary>
    Aenderung,
    /// <summary>Zusätzliche bzw. verlegte Stunde: gestrichelter Rahmen, Kennzeichen „+“.</summary>
    Zusatz,
    /// <summary>Prüfung/Klausur: doppelter Rahmen, Wort „Prüfung“.</summary>
    Pruefung,
    /// <summary>Veranstaltung/Termin: gepunkteter Rahmen, Wort „Termin“.</summary>
    Termin,
}

/// <summary>Ein Unterricht in einer Zelle des Stundenplanrasters.</summary>
public sealed class Rastereintrag
{
    /// <summary>Fach (Kürzel bzw. Name) – halbfett.</summary>
    public string Fach { get; set; } = "";
    /// <summary>Lehrkraft (Klassenplan) bzw. Klasse(n) (Lehrer- und Raumplan).</summary>
    public string Person { get; set; } = "";
    public string Raum { get; set; } = "";
    /// <summary>Bisherige Werte bei Änderungen (werden durchgestrichen vor dem neuen Wert gezeigt).</summary>
    public string? FachAlt { get; set; }
    public string? PersonAlt { get; set; }
    public string? RaumAlt { get; set; }
    public Stundenstatus Status { get; set; }
    /// <summary>Kleiner Zusatz (z. B. Fußnote „1)“ zu einer Kopplung oder „verlegt“).</summary>
    public string Hinweis { get; set; } = "";
    /// <summary>Hinterlegung als Grauton (0 = schwarz, 1 = weiß), z. B. Fachfarbe in Graustufen; null = weiß.</summary>
    public float? Grau { get; set; }
}

/// <summary>Zelle des Rasters: Tag und Stunden (Index in <see cref="Stundenraster.Stunden"/>, von–bis für Doppelstunden).</summary>
public sealed class Rasterzelle
{
    public int Tag { get; set; }
    public int Von { get; set; }
    public int Bis { get; set; }
    public List<Rastereintrag> Eintraege { get; } = new();
}

/// <summary>Stunde des Rasters (Nummer, Zeit) und optional eine Pause danach.</summary>
public sealed record Rasterstunde(string Nummer, string Beginn = "", string Ende = "", string? PauseDanach = null);

/// <summary>
/// Klassisches Stundenplanraster für den Schwarz-Weiß-Druck: Tage als Spalten, Stunden als Zeilen mit Nummer und Zeiten, schmale
/// Pausenzeilen, Doppelstunden zusammengefasst; je Zelle Fach (halbfett), Lehrkraft bzw. Klasse und Raum. Änderungen mit
/// Durchstreichung und Kennzeichen statt Farbe, Legende über <see cref="Legende"/>.
/// </summary>
public sealed class Stundenraster
{
    public List<string> Tage { get; } = new();
    /// <summary>Optional Datum je Tag (z. B. „19.10.“) – Wochenplan mit Änderungen.</summary>
    public List<string> Daten { get; } = new();
    public List<Rasterstunde> Stunden { get; } = new();
    public List<Rasterzelle> Zellen { get; } = new();
    /// <summary>Kleinere Schrift (zwei Pläne je Seite).</summary>
    public bool Kompakt { get; set; }
    public bool ZeitenZeigen { get; set; } = true;
    /// <summary>Freie (unterrichtsfreie) Tage: Tag → Text, z. B. „Herbstferien“.</summary>
    public Dictionary<int, string> FreieTage { get; } = new();

    public Rasterzelle Zelle(int tag, int von, int bis)
    {
        var z = new Rasterzelle { Tag = tag, Von = von, Bis = Math.Max(von, bis) };
        Zellen.Add(z);
        return z;
    }

    /// <summary>Verwendete Status (für die Legende).</summary>
    public IEnumerable<Stundenstatus> Status => Zellen.SelectMany(z => z.Eintraege).Select(e => e.Status).Where(s => s != Stundenstatus.Normal).Distinct().OrderBy(s => s);

    private const float PauseH = 8;

    /// <summary>Raster in einen Bereich zeichnen; gibt die tatsächliche Unterkante zurück.</summary>
    public float Zeichnen(Seite s, float x, float y, float b, float h)
    {
        var tage = Math.Max(1, Tage.Count);
        var n = Math.Max(1, Stunden.Count);
        var pausen = Stunden.Take(Stunden.Count - 1).Count(st => st.PauseDanach != null);
        var kopfH = Kompakt ? 15f : 18f;
        var zeileH = Math.Clamp((h - kopfH - pausen * PauseH) / n, 13f, Kompakt ? 46f : 58f);
        var gNr = Kompakt ? 10f : 12f;
        var gZeit = Kompakt ? 5.8f : 6.5f;
        var nrB = Stunden.Count == 0 ? 10 : Stunden.Max(st => Satz.Breite(st.Nummer, gNr, true));
        var zeitB = ZeitenZeigen && Stunden.Any(st => st.Beginn.Length > 0) ? Stunden.Max(st => Math.Max(Satz.Breite(st.Beginn, gZeit), Satz.Breite(st.Ende, gZeit))) : 0;
        var stdB = MathF.Ceiling(Math.Max(Kompakt ? 26 : 30, nrB + (zeitB > 0 ? zeitB + 8 : 0) + 8));
        var tagB = (b - stdB) / tage;

        // senkrechte Lage der Stunden
        var lage = new (float Y, float H)[n];
        var pausenLage = new List<(float Y, string Text)>();
        var yy = y + kopfH;
        for (var i = 0; i < Stunden.Count; i++)
        {
            lage[i] = (yy, zeileH);
            yy += zeileH;
            if (i < Stunden.Count - 1 && Stunden[i].PauseDanach is { } p) { pausenLage.Add((yy, p)); yy += PauseH; }
        }
        var unten = yy;

        // Tageskopf
        s.Flaeche(x, y, b, kopfH, Formular.GrauKopf);
        for (var t = 0; t < tage; t++)
        {
            var tx = x + stdB + t * tagB;
            var name = t < Tage.Count ? Tage[t] : "";
            var datum = t < Daten.Count ? Daten[t] : "";
            var gT = Kompakt ? 8.5f : 9.5f;
            var name2 = Satz.Breite(name, gT, true) + (datum.Length > 0 ? Satz.Breite("  " + datum, gT - 1) : 0) > tagB - 6 && name.Length > 2 ? name[..2] : name;
            var wName = Satz.Breite(name2, gT, true);
            var wDatum = datum.Length > 0 ? Satz.Breite("  " + datum, gT - 1) : 0;
            var start = tx + (tagB - wName - wDatum) / 2;
            var gl = Seite.Mitte(y, kopfH, gT);
            s.Text(start, gl, gT, name2, true);
            if (datum.Length > 0) s.Text(start + wName + Satz.Breite("  ", gT - 1), gl, gT - 1, datum, false, Formular.GrauText);
        }

        // Stundenspalte
        s.Flaeche(x, y + kopfH, stdB, unten - y - kopfH, 0.96f);
        for (var i = 0; i < Stunden.Count; i++)
        {
            var (ly, lh) = lage[i];
            var st = Stunden[i];
            var mitZeit = zeitB > 0 && st.Beginn.Length > 0;
            if (mitZeit && lh >= gNr + 2 * gZeit + 4)
            {
                // Nummer links, Zeiten rechts untereinander
                s.Text(x + 4, Seite.Mitte(ly, lh, gNr), gNr, st.Nummer, true);
                var zx = x + stdB - 4 - zeitB;
                s.Text(zx, ly + lh / 2 - 1, gZeit, st.Beginn, false, Formular.GrauText);
                s.Text(zx, ly + lh / 2 + gZeit + 0.5f, gZeit, st.Ende, false, Formular.GrauText);
            }
            else if (mitZeit)
            {
                s.Text(x + 4, Seite.Mitte(ly, lh, gNr), gNr, st.Nummer, true);
                s.Text(x + stdB - 4 - zeitB, Seite.Mitte(ly, lh, gZeit), gZeit, st.Beginn, false, Formular.GrauText);
            }
            else s.TextMittig(x, stdB, Seite.Mitte(ly, lh, gNr), gNr, st.Nummer, true);
        }

        // Pausen: schmale graue Bänder mit kleiner Bezeichnung
        foreach (var (py, text) in pausenLage)
        {
            s.Flaeche(x + stdB, py, b - stdB, PauseH, 0.94f);
            if (text.Length > 0) s.TextMittig(x + stdB, b - stdB, Seite.Mitte(py, PauseH, 5.8f), 5.8f, Satz.Kuerzen(text, b - stdB - 10, 5.8f), false, Formular.GrauText);
        }

        // freie Tage
        foreach (var (t, text) in FreieTage)
        {
            if (t < 0 || t >= tage) continue;
            var tx = x + stdB + t * tagB;
            s.Flaeche(tx, y + kopfH, tagB, unten - y - kopfH, 0.94f);
            s.TextMittig(tx, tagB, (y + kopfH + unten) / 2, Kompakt ? 8 : 9, Satz.Kuerzen(text, tagB - 8, Kompakt ? 8 : 9, true), true, Formular.GrauText);
        }

        // feine Stundenlinien
        for (var i = 0; i < Stunden.Count; i++)
        {
            var (ly, lh) = lage[i];
            s.Linie(x, ly + lh, x + b, ly + lh, Formular.LinieFein, 0.35f);
        }
        foreach (var (py, _) in pausenLage) s.Linie(x + stdB, py, x + b, py, Formular.LinieFein, 0.35f);

        // Zellen
        foreach (var z in Zellen)
        {
            if (z.Tag < 0 || z.Tag >= tage || z.Von < 0 || z.Von >= Stunden.Count || z.Eintraege.Count == 0) continue;
            var bis = Math.Min(z.Bis, Stunden.Count - 1);
            var zx = x + stdB + z.Tag * tagB;
            var zy = lage[z.Von].Y;
            var zh = lage[bis].Y + lage[bis].H - zy;
            ZelleZeichnen(s, zx, zy, tagB, zh, z.Eintraege);
        }

        // Rahmen und Trennlinien
        for (var t = 1; t < tage; t++) s.Linie(x + stdB + t * tagB, y, x + stdB + t * tagB, unten, Formular.LinieNormal);
        s.Linie(x + stdB, y, x + stdB, unten, Formular.LinieStark);
        s.Linie(x, y + kopfH, x + b, y + kopfH, Formular.LinieStark);
        s.Rahmen(x, y, b, unten - y, Formular.LinieStark);
        return unten;
    }

    private void ZelleZeichnen(Seite s, float x, float y, float b, float h, List<Rastereintrag> eintraege)
    {
        // weiße Fläche über den feinen Stundenlinien (Doppelstunde als eine Zelle)
        var grau = eintraege.Count == 1 ? eintraege[0].Grau : null;
        s.Flaeche(x + 0.3f, y + 0.3f, b - 0.6f, h - 0.6f, grau ?? 1f);
        s.Linie(x, y, x + b, y, Formular.LinieFein, 0.35f);
        s.Linie(x, y + h, x + b, y + h, Formular.LinieFein, 0.35f);
        var alleEntfall = eintraege.All(e => e.Status == Stundenstatus.Entfall);
        if (alleEntfall) s.Schraffur(x + 0.3f, y + 0.3f, b - 0.6f, h - 0.6f, 5f, 0.35f, 0.7f);
        var status = eintraege.Select(e => e.Status).Where(st => st != Stundenstatus.Normal).DefaultIfEmpty(Stundenstatus.Normal).Max();
        var innen = 1.6f;
        switch (status)
        {
            case Stundenstatus.Zusatz:
                s.Rahmen(x + innen, y + innen, b - 2 * innen, h - 2 * innen, 0.7f, 0, 2.2f, 1.6f);
                break;
            case Stundenstatus.Termin:
                s.Rahmen(x + innen, y + innen, b - 2 * innen, h - 2 * innen, 0.8f, 0, 0.8f, 1.4f);
                break;
            case Stundenstatus.Pruefung:
                s.Rahmen(x + innen, y + innen, b - 2 * innen, h - 2 * innen, 0.6f);
                s.Rahmen(x + innen + 1.6f, y + innen + 1.6f, b - 2 * innen - 3.2f, h - 2 * innen - 3.2f, 0.6f);
                break;
        }
        // Kennzeichen oben links (Änderung »; Zusatz +)
        var kennzeichen = status switch { Stundenstatus.Aenderung => "»", Stundenstatus.Zusatz => "+", _ => "" };
        if (kennzeichen.Length > 0) s.Text(x + 3.2f, y + 7.2f, 7, kennzeichen, true);
        var wort = status switch { Stundenstatus.Pruefung => "Prüfung", Stundenstatus.Termin => "Termin", _ => alleEntfall ? "entfällt" : "" };

        if (eintraege.Count == 1) Einzeln(s, x, y, b, h, eintraege[0], wort);
        else Mehrere(s, x, y, b, h, eintraege, wort);
    }

    /// <summary>Teile einer Zeile: (Text, durchgestrichen, halbfett).</summary>
    private static List<(string Text, bool Alt, bool Fett)> Teile(string neu, string? alt, bool fett, bool entfall)
    {
        var res = new List<(string, bool, bool)>();
        if (!string.IsNullOrEmpty(alt) && alt != neu) res.Add((alt, true, false));
        if (neu.Length > 0) res.Add((neu, entfall, fett || (!string.IsNullOrEmpty(alt) && alt != neu)));
        return res;
    }

    private static float TeileBreite(List<(string Text, bool Alt, bool Fett)> teile, float g) =>
        teile.Sum(t => Satz.Breite(t.Text, g, t.Fett)) + Math.Max(0, teile.Count - 1) * Satz.Breite(" ", g);

    private static void TeileZeichnen(Seite s, float mitteX, float gl, float g, List<(string Text, bool Alt, bool Fett)> teile, float maxB)
    {
        var w = TeileBreite(teile, g);
        var faktor = w > maxB ? maxB / w : 1;
        var gg = g * Math.Max(0.6f, faktor);
        var cx = mitteX - TeileBreite(teile, gg) / 2;
        foreach (var (text, alt, fett) in teile)
        {
            var t = Satz.Kuerzen(text, maxB, gg, fett);
            if (alt) s.Durchgestrichen(cx, gl, gg, t, fett, alt && !fett ? Formular.GrauText : 0);
            else s.Text(cx, gl, gg, t, fett);
            cx += Satz.Breite(t, gg, fett) + Satz.Breite(" ", gg);
        }
    }

    private void Einzeln(Seite s, float x, float y, float b, float h, Rastereintrag e, string wort)
    {
        var entfall = e.Status == Stundenstatus.Entfall;
        var gFach = Kompakt ? 8.5f : 10f;
        var g = Kompakt ? 7f : 8f;
        var zeilen = new List<(List<(string, bool, bool)> Teile, float G)>();
        var fach = Teile(e.Fach, e.FachAlt, true, entfall);
        var person = Teile(e.Person, e.PersonAlt, false, entfall);
        var raum = Teile(e.Raum, e.RaumAlt, false, entfall);
        var platz = h - 4 - (wort.Length > 0 ? 6 : 0);
        if (fach.Count > 0) zeilen.Add((fach, gFach));
        if (platz >= gFach * 1.15f + 3 * g * 1.15f || (platz >= gFach * 1.15f + 2 * g * 1.15f && (person.Count == 0 || raum.Count == 0)))
        {
            if (person.Count > 0) zeilen.Add((person, g));
            if (raum.Count > 0) zeilen.Add((raum, g));
        }
        else if (person.Count + raum.Count > 0)
        {
            var beide = person.Concat(raum).ToList();
            if (platz >= gFach * 1.15f + g * 1.15f) zeilen.Add((beide, g));
            else if (zeilen.Count > 0) zeilen[0] = (fach.Concat(beide).ToList(), Math.Min(gFach, g + 1));
            else zeilen.Add((beide, g));
        }
        var hoehe = zeilen.Sum(z => z.G * 1.18f);
        var gl = y + (h - hoehe - (wort.Length > 0 ? 6 : 0)) / 2;
        foreach (var (teile, gz) in zeilen)
        {
            gl += gz * 1.18f;
            TeileZeichnen(s, x + b / 2, gl - gz * 0.22f, gz, teile, b - 8);
        }
        if (wort.Length > 0) s.TextMittig(x, b, y + h - 3.5f, 5.8f, wort, true);
        if (e.Hinweis.Length > 0) s.Text(x + 3, y + h - 3, 5.5f, e.Hinweis, false, Formular.GrauText);
    }

    private void Mehrere(Seite s, float x, float y, float b, float h, List<Rastereintrag> eintraege, string wort)
    {
        var platz = h - 3 - (wort.Length > 0 ? 6 : 0);
        var g = Math.Clamp(platz / (eintraege.Count * 1.2f), 4.8f, Kompakt ? 7f : 7.8f);
        var max = Math.Max(1, (int)(platz / (g * 1.2f)));
        var sichtbar = eintraege.Take(max).ToList();
        var gl = y + (platz - sichtbar.Count * g * 1.2f) / 2 + 1.5f;
        for (var i = 0; i < sichtbar.Count; i++)
        {
            var e = sichtbar[i];
            var entfall = e.Status == Stundenstatus.Entfall;
            var teile = Teile(e.Fach, e.FachAlt, true, entfall).Concat(Teile(e.Person, e.PersonAlt, false, entfall)).Concat(Teile(e.Raum, e.RaumAlt, false, entfall)).ToList();
            if (i == max - 1 && eintraege.Count > max) teile = new List<(string, bool, bool)> { ($"+ {eintraege.Count - max + 1} weitere", false, false) };
            gl += g * 1.2f;
            TeileZeichnen(s, x + b / 2, gl - g * 0.25f, g, teile, b - 6);
        }
        if (wort.Length > 0) s.TextMittig(x, b, y + h - 3.5f, 5.8f, wort, true);
        var hinweise = string.Join(" ", eintraege.Select(e => e.Hinweis).Where(t => t.Length > 0).Distinct());
        if (hinweise.Length > 0) s.Text(x + 3, y + h - 2.5f, 5.2f, Satz.Kuerzen(hinweise, b - 6, 5.2f), false, Formular.GrauText);
    }

    /// <summary>Legende der verwendeten Kennzeichen (kleine Muster mit Erklärung) in einer Zeile; gibt die Höhe zurück.</summary>
    public static float Legende(Seite s, float x, float y, float b, IEnumerable<Stundenstatus> status, float groesse = 7.5f)
    {
        var liste = status.Distinct().Where(st => st != Stundenstatus.Normal).OrderBy(st => st).ToList();
        if (liste.Count == 0) return 0;
        const float kw = 18, kh = 10;
        var y0 = y;
        var cx = x;
        var gl = y + kh / 2 + groesse * 0.35f;
        s.Text(cx, gl, groesse, "Zeichen:", true);
        cx += Satz.Breite("Zeichen:", groesse, true) + 8;
        foreach (var st in liste)
        {
            var text = st switch
            {
                Stundenstatus.Entfall => "Entfall (schraffiert, durchgestrichen)",
                Stundenstatus.Aenderung => "Vertretung/Änderung (» neu halbfett, bisher durchgestrichen)",
                Stundenstatus.Zusatz => "Zusätzliche bzw. verlegte Stunde (+, gestrichelt)",
                Stundenstatus.Pruefung => "Prüfung (doppelt umrandet)",
                Stundenstatus.Termin => "Termin/Veranstaltung (gepunktet)",
                _ => "",
            };
            var tb = Satz.Breite(text, groesse);
            if (cx + kw + 4 + tb > x + b) { cx = x + Satz.Breite("Zeichen:", groesse, true) + 8; y += kh + 4; gl += kh + 4; }
            s.Flaeche(cx, y, kw, kh, 1);
            switch (st)
            {
                case Stundenstatus.Entfall:
                    s.Schraffur(cx, y, kw, kh, 3f, 0.35f, 0.55f);
                    s.Rahmen(cx, y, kw, kh, Formular.LinieFein);
                    s.Linie(cx + 3, y + kh / 2, cx + kw - 3, y + kh / 2, 0.7f);
                    break;
                case Stundenstatus.Aenderung:
                    s.Rahmen(cx, y, kw, kh, Formular.LinieFein);
                    s.Text(cx + 2, y + kh - 2.3f, 7, "»", true);
                    break;
                case Stundenstatus.Zusatz:
                    s.Rahmen(cx, y, kw, kh, 0.7f, 0, 2.2f, 1.6f);
                    s.Text(cx + 2, y + kh - 2.3f, 7, "+", true);
                    break;
                case Stundenstatus.Pruefung:
                    s.Rahmen(cx, y, kw, kh, 0.6f);
                    s.Rahmen(cx + 1.6f, y + 1.6f, kw - 3.2f, kh - 3.2f, 0.6f);
                    break;
                case Stundenstatus.Termin:
                    s.Rahmen(cx, y, kw, kh, 0.8f, 0, 0.8f, 1.4f);
                    break;
            }
            cx += kw + 4;
            s.Text(cx, gl, groesse, text);
            cx += tb + 14;
        }
        return y - y0 + kh + 2;
    }
}
