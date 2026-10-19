using System.Globalization;

namespace UntPlan.Druck;

/// <summary>Auszeichnung einer Tabellenzelle (kombinierbar).</summary>
[Flags]
public enum Zellstil
{
    Normal = 0,
    Fett = 1,
    /// <summary>Durchgestrichen – Bisheriges bei Änderungen (statt Farbe).</summary>
    Durchgestrichen = 2,
    /// <summary>Grauer Nebentext.</summary>
    Grau = 4,
}

/// <summary>Art einer Tabellenzeile.</summary>
public enum Zeilenart
{
    Daten,
    /// <summary>Gruppenkopf über die ganze Breite (z. B. Klasse, Tag, Lehrkraft); wird nach einem Seitenumbruch wiederholt.</summary>
    Gruppe,
    /// <summary>Zwischensumme: halbfett mit Linie darüber.</summary>
    Zwischensumme,
    /// <summary>Summe: halbfett, grau hinterlegt, kräftige Linie darüber.</summary>
    Summe,
    /// <summary>Leere Zeile zum Ausfüllen (Höhe <see cref="Tabelle.Schreibzeile"/>).</summary>
    Leer,
}

/// <summary>Spalte einer Tabelle.</summary>
public sealed class Spalte
{
    public Spalte(string titel, Ausrichtung? ausrichtung = null, float anteil = 0)
    {
        Titel = titel;
        Ausrichtung = ausrichtung;
        Anteil = anteil;
    }

    public string Titel { get; set; }
    /// <summary>null = automatisch (Zahlenspalten rechtsbündig, sonst links).</summary>
    public Ausrichtung? Ausrichtung { get; set; }
    /// <summary>Feste Breite als Anteil der Tabellenbreite (0 = nach Inhalt).</summary>
    public float Anteil { get; set; }
    /// <summary>Langer Text bricht in mehrere Zeilen um (sonst gekürzt mit „…“).</summary>
    public bool Umbruch { get; set; } = true;
    /// <summary>Ganze Spalte halbfett (z. B. Kürzel, Stunde).</summary>
    public bool Fett { get; set; }
}

/// <summary>Zeile einer Tabelle.</summary>
public sealed class Tabellenzeile
{
    public Tabellenzeile(Zeilenart art, IReadOnlyList<string> werte)
    {
        Art = art;
        Werte = werte;
    }

    public Zeilenart Art { get; }
    public IReadOnlyList<string> Werte { get; }
    /// <summary>Auszeichnung je Zelle (optional).</summary>
    public Zellstil[]? Stile { get; set; }
    /// <summary>Auszeichnung der ganzen Zeile.</summary>
    public Zellstil Stil { get; set; }
    /// <summary>Kräftige Linie über der Zeile (z. B. Beginn einer neuen Klasse).</summary>
    public bool Trenner { get; set; }
    /// <summary>Vor dieser Zeile eine neue Seite beginnen (z. B. eine Seite je Klasse).</summary>
    public bool Seitenumbruch { get; set; }

    internal Zellstil StilVon(int i) => Stil | (Stile != null && i < Stile.Length ? Stile[i] : Zellstil.Normal);
}

/// <summary>
/// Tabelle im gemeinsamen Druckdesign: Kopf halbfett auf Grau zwischen kräftigen Linien (auf jeder Seite wiederholt), Zeilen mit feinen
/// Linien, Zahlenspalten rechtsbündig, Umbruch langer Texte, Gruppenköpfe (nach Seitenumbruch mit „Fortsetzung“ wiederholt), Zwischen-
/// und Gesamtsummen, wahlweise Wechselzeilen (hellgrau) und senkrechte Linien. Spaltenbreiten nach Inhalt bzw. fest als Anteil.
/// </summary>
public sealed class Tabelle
{
    public List<Spalte> Spalten { get; } = new();
    public List<Tabellenzeile> Zeilen { get; } = new();
    public float Schriftgroesse { get; set; } = 8.5f;
    /// <summary>Jede zweite Datenzeile hellgrau (bei langen, breiten Listen hilfreich).</summary>
    public bool Wechselzeilen { get; set; }
    /// <summary>Senkrechte Linien zwischen den Spalten (Formulare zum Ausfüllen).</summary>
    public bool Senkrechte { get; set; }
    public string LeerText { get; set; } = "Keine Einträge.";
    /// <summary>Unter der Tabelle „n Einträge“ ausgeben.</summary>
    public bool Anzahl { get; set; }
    /// <summary>Mindesthöhe einer Datenzeile (0 = nach Inhalt).</summary>
    public float MinZeilenhoehe { get; set; }
    /// <summary>Höhe einer Leerzeile zum Ausfüllen.</summary>
    public float Schreibzeile { get; set; } = 20;
    public int MaxZeilenJeZelle { get; set; } = 8;

    private static readonly CultureInfo De = CultureInfo.GetCultureInfo("de-DE");

    public Tabelle() { }

    public Tabelle(params string[] spalten)
    {
        foreach (var s in spalten) Spalten.Add(new Spalte(s));
    }

    public Spalte Spalte(string titel, Ausrichtung? ausrichtung = null, float anteil = 0, bool umbruch = true, bool fett = false)
    {
        var s = new Spalte(titel, ausrichtung, anteil) { Umbruch = umbruch, Fett = fett };
        Spalten.Add(s);
        return s;
    }

    public Tabellenzeile Zeile(params string[] werte) => Hinzu(Zeilenart.Daten, werte);
    public Tabellenzeile Gruppe(string text) => Hinzu(Zeilenart.Gruppe, new[] { text });
    public Tabellenzeile Zwischensumme(params string[] werte) => Hinzu(Zeilenart.Zwischensumme, werte);
    public Tabellenzeile Summe(params string[] werte) => Hinzu(Zeilenart.Summe, werte);
    public Tabellenzeile Leerzeile() => Hinzu(Zeilenart.Leer, Array.Empty<string>());

    public Tabellenzeile Hinzu(Zeilenart art, IReadOnlyList<string> werte)
    {
        var z = new Tabellenzeile(art, werte);
        Zeilen.Add(z);
        return z;
    }

    /// <summary>Zeilenart aus Text (gegliederte Berichte: „gruppe“, „zwischensumme“, „summe“).</summary>
    public static Zeilenart Art(string? art) => (art ?? "").ToLowerInvariant() switch
    {
        "gruppe" => Zeilenart.Gruppe,
        "zwischensumme" => Zeilenart.Zwischensumme,
        "summe" => Zeilenart.Summe,
        "leer" => Zeilenart.Leer,
        _ => Zeilenart.Daten,
    };

    // ------------------------------------------------------------------------------------------ Maße

    private float G => Schriftgroesse;
    private float GKopf => Schriftgroesse * 0.92f;
    private float Zeilenabstand => Schriftgroesse * 1.24f;
    private float InnenX => Math.Max(3f, Schriftgroesse * 0.42f);
    private float InnenY => Schriftgroesse * 0.42f;

    private string Wert(Tabellenzeile z, int i) => i < z.Werte.Count ? z.Werte[i] ?? "" : "";

    private static bool IstZahl(string s)
    {
        var t = s.Replace("%", "").Replace("+", "").Replace("−", "-").Replace(" ", "").Trim();
        return t.Length > 0 && double.TryParse(t, NumberStyles.Number, De, out _);
    }

    private Ausrichtung[] Ausrichtungen()
    {
        var daten = Zeilen.Where(z => z.Art == Zeilenart.Daten).ToList();
        return Spalten.Select((sp, i) => sp.Ausrichtung ?? (daten.Count > 0 && daten.All(z => Wert(z, i).Length == 0 || IstZahl(Wert(z, i))) && daten.Any(z => Wert(z, i).Length > 0)
            ? Druck.Ausrichtung.Rechts : Druck.Ausrichtung.Links)).ToArray();
    }

    private bool FettIn(Tabellenzeile? z, int i) => Spalten[i].Fett || z is null || z.Art is Zeilenart.Zwischensumme or Zeilenart.Summe || (z.StilVon(i) & Zellstil.Fett) != 0;

    /// <summary>Spaltenbreiten für eine Tabellenbreite.</summary>
    public float[] Breiten(float nutz)
    {
        var n = Spalten.Count;
        var w = new float[n];
        if (n == 0) return w;
        var natur = new float[n];
        var mindest = new float[n];
        var daten = Zeilen.Where(z => z.Art is not (Zeilenart.Gruppe or Zeilenart.Leer)).ToList();
        if (Spalten.All(s => s.Anteil > 0))
        {
            // feste Anteile – aber kein Wort (auch im Kopf) wird zerschnitten, solange Platz bei anderen Spalten ist
            var summe = Spalten.Sum(s => s.Anteil);
            for (var i = 0; i < n; i++)
            {
                w[i] = Spalten[i].Anteil / summe * nutz;
                var kopfWort = Spalten[i].Titel.Split(' ', '\n').Max(x => Satz.Breite(x, GKopf, true));
                var wort = daten.Select(z => Wert(z, i)).Where(t => t.Length > 0).Select(t => t.Split(' ', '\n').Max(x => Satz.Breite(x, G, FettIn(z: null, i)))).DefaultIfEmpty(0).Max();
                mindest[i] = Math.Min(Math.Max(kopfWort, wort) + 2 * InnenX, nutz * 0.4f);
            }
            for (var runde = 0; runde < 3; runde++)
            {
                var fehlt = Enumerable.Range(0, n).Sum(i => Math.Max(0, mindest[i] - w[i]));
                var ueber = Enumerable.Range(0, n).Sum(i => Math.Max(0, w[i] - mindest[i]));
                if (fehlt <= 0.5f || ueber <= 0) break;
                var faktor = Math.Min(1, fehlt / ueber);
                for (var i = 0; i < n; i++)
                    w[i] = w[i] < mindest[i] ? (fehlt <= ueber ? mindest[i] : w[i] + (mindest[i] - w[i]) * ueber / fehlt) : w[i] - (w[i] - mindest[i]) * faktor;
            }
            return w;
        }
        for (var i = 0; i < n; i++)
        {
            var kopf = Spalten[i].Titel.Split(' ', '\n');
            var kopfWort = kopf.Max(x => Satz.Breite(x, GKopf, true));
            var kopfGanz = Satz.Breite(Spalten[i].Titel, GKopf, true);
            float laengste = 0, wort = 0;
            foreach (var z in daten)
            {
                var t = Wert(z, i);
                if (t.Length == 0) continue;
                var fett = FettIn(z, i);
                laengste = Math.Max(laengste, t.Split('\n').Max(x => Satz.Breite(x, G, fett)));
                if (Spalten[i].Umbruch) wort = Math.Max(wort, t.Split(' ', '\n').Max(x => Satz.Breite(x, G, fett)));
            }
            natur[i] = Math.Max(Math.Max(kopfWort, Math.Min(kopfGanz, Math.Max(laengste, kopfWort * 1.6f))), laengste) + 2 * InnenX;
            // leere Spalte (zum Ausfüllen, z. B. Bemerkung): Platz zum Schreiben
            if (laengste == 0 && daten.Count > 0 && Spalten[i].Umbruch) natur[i] = Math.Max(natur[i], nutz * 0.22f);
            mindest[i] = Spalten[i].Umbruch ? Math.Min(natur[i], Math.Max(kopfWort, Math.Min(wort, 90)) + 2 * InnenX) : natur[i];
        }
        // feste Anteile zuerst
        var fest = 0f;
        for (var i = 0; i < n; i++) if (Spalten[i].Anteil > 0) { w[i] = Spalten[i].Anteil * nutz; fest += w[i]; }
        var frei = Math.Max(10, nutz - fest);
        var auto = Enumerable.Range(0, n).Where(i => Spalten[i].Anteil <= 0).ToList();
        var summeNatur = auto.Sum(i => natur[i]);
        if (summeNatur <= frei)
        {
            // Rest verhältnisgleich verteilen (die Tabelle füllt die Breite, Proportionen bleiben)
            foreach (var i in auto) w[i] = natur[i] * frei / Math.Max(1, summeNatur);
        }
        else
        {
            var spiel = auto.Sum(i => natur[i] - mindest[i]);
            var noetig = summeNatur - frei;
            if (spiel >= noetig && spiel > 0)
                foreach (var i in auto) w[i] = natur[i] - (natur[i] - mindest[i]) * noetig / spiel;
            else
            {
                var summeMin = auto.Sum(i => mindest[i]);
                foreach (var i in auto) w[i] = mindest[i] * frei / Math.Max(1, summeMin);
            }
        }
        return w;
    }

    private sealed record Satzzeile(Tabellenzeile Zeile, List<string>[] Zellen, float Hoehe);

    private List<string> Zelle(Tabellenzeile z, int i, float breite)
    {
        var t = Wert(z, i);
        var fett = FettIn(z, i);
        var max = Math.Max(4, breite - 2 * InnenX);
        if (!Spalten[i].Umbruch) return new List<string> { Satz.Kuerzen(t, max, G, fett) };
        var zeilen = Satz.Umbrechen(t, max, G, fett);
        if (zeilen.Count > MaxZeilenJeZelle)
        {
            zeilen = zeilen.Take(MaxZeilenJeZelle).ToList();
            zeilen[^1] = Satz.Kuerzen(zeilen[^1] + " …", max, G, fett);
        }
        return zeilen;
    }

    private Satzzeile Vorbereiten(Tabellenzeile z, float[] w)
    {
        if (z.Art == Zeilenart.Gruppe) return new Satzzeile(z, Array.Empty<List<string>>(), G * 1.08f * 1.25f + 2 * InnenY + 2);
        if (z.Art == Zeilenart.Leer) return new Satzzeile(z, Spalten.Select(_ => new List<string>()).ToArray(), Math.Max(Schreibzeile, MinZeilenhoehe));
        var zellen = Spalten.Select((_, i) => Zelle(z, i, w[i])).ToArray();
        var h = Math.Max(1, zellen.Max(c => c.Count)) * Zeilenabstand + 2 * InnenY - (Zeilenabstand - G * 1.05f);
        return new Satzzeile(z, zellen, Math.Max(h, MinZeilenhoehe));
    }

    private (List<string>[] Zeilen, float Hoehe) Kopfzeilen(float[] w)
    {
        var k = Spalten.Select((s, i) =>
        {
            var z = Satz.Umbrechen(s.Titel, Math.Max(4, w[i] - 2 * InnenX), GKopf, true);
            if (z.Count > 2) z = new List<string> { z[0], Satz.Kuerzen(string.Join(" ", z.Skip(1)), w[i] - 2 * InnenX, GKopf, true) };
            return z;
        }).ToArray();
        var zeilen = Math.Max(1, k.Max(x => x.Count));
        return (k, zeilen * GKopf * 1.2f + 2 * InnenY + 1);
    }

    // ------------------------------------------------------------------------------------------ Zeichnen

    private void KopfZeichnen(Seite s, float x, float y, float[] w, List<string>[] koepfe, float h, Ausrichtung[] ausr)
    {
        var b = w.Sum();
        s.Flaeche(x, y, b, h, Formular.GrauKopf);
        s.Linie(x, y, x + b, y, Formular.LinieStark);
        s.Linie(x, y + h, x + b, y + h, Formular.LinieStark);
        var cx = x;
        for (var i = 0; i < w.Length; i++)
        {
            var zeilen = koepfe[i];
            var gl = y + (h - zeilen.Count * GKopf * 1.2f) / 2 + GKopf * 0.95f;
            foreach (var t in zeilen)
            {
                s.TextAusgerichtet(cx + InnenX, w[i] - 2 * InnenX, gl, GKopf, t, ausr[i], true);
                gl += GKopf * 1.2f;
            }
            cx += w[i];
        }
    }

    private void ZeileZeichnen(Seite s, float x, float y, float[] w, Satzzeile sz, Ausrichtung[] ausr, bool wechsel, string? gruppenZusatz = null)
    {
        var b = w.Sum();
        var z = sz.Zeile;
        switch (z.Art)
        {
            case Zeilenart.Gruppe:
            {
                s.Flaeche(x, y, b, sz.Hoehe, Formular.GrauGruppe);
                var t = Wert(z, 0) + (gruppenZusatz ?? "");
                s.Text(x + InnenX, y + sz.Hoehe / 2 + G * 1.08f * 0.36f, G * 1.08f, Satz.Kuerzen(t, b - 2 * InnenX, G * 1.08f, true), true);
                s.Linie(x, y + sz.Hoehe, x + b, y + sz.Hoehe, Formular.LinieNormal);
                return;
            }
            case Zeilenart.Summe:
                s.Flaeche(x, y, b, sz.Hoehe, Formular.GrauGruppe);
                s.Linie(x, y, x + b, y, Formular.LinieStark);
                break;
            case Zeilenart.Zwischensumme:
                s.Linie(x, y, x + b, y, Formular.LinieNormal);
                break;
            default:
                if (wechsel) s.Flaeche(x, y, b, sz.Hoehe, Formular.GrauWechsel);
                if (z.Trenner) s.Linie(x, y, x + b, y, Formular.LinieNormal);
                break;
        }
        var cx = x;
        for (var i = 0; i < w.Length; i++)
        {
            var stil = z.StilVon(i);
            var fett = FettIn(z, i);
            var grau = (stil & Zellstil.Grau) != 0 ? Formular.GrauText : 0f;
            var gl = y + InnenY + G * 0.8f;
            foreach (var t in sz.Zellen[i])
            {
                var tx = ausr[i] switch
                {
                    Druck.Ausrichtung.Rechts => cx + w[i] - InnenX - Satz.Breite(t, G, fett),
                    Druck.Ausrichtung.Mitte => cx + (w[i] - Satz.Breite(t, G, fett)) / 2,
                    _ => cx + InnenX,
                };
                if ((stil & Zellstil.Durchgestrichen) != 0) s.Durchgestrichen(tx, gl, G, t, fett, grau);
                else s.Text(tx, gl, G, t, fett, grau);
                gl += Zeilenabstand;
            }
            cx += w[i];
        }
        if (z.Art is Zeilenart.Daten or Zeilenart.Leer)
            s.Linie(x, y + sz.Hoehe, x + b, y + sz.Hoehe, Formular.LinieFein, Senkrechte || z.Art == Zeilenart.Leer ? 0.25f : Formular.GrauLinie);
    }

    private void Senkrecht(Seite s, float x, float oben, float unten, float[] w)
    {
        if (!Senkrechte || unten <= oben) return;
        var cx = x;
        s.Linie(x, oben, x, unten, Formular.LinieNormal);
        for (var i = 0; i < w.Length; i++)
        {
            cx += w[i];
            s.Linie(cx, oben, cx, unten, i == w.Length - 1 ? Formular.LinieNormal : Formular.LinieFein, i == w.Length - 1 ? 0 : 0.25f);
        }
    }

    /// <summary>Tabelle im Fluss eines Formulars setzen (Seitenumbruch mit wiederholtem Kopf).</summary>
    internal void Setzen(Formular f)
    {
        var w = Breiten(f.Breite);
        var ausr = Ausrichtungen();
        var (koepfe, kopfH) = Kopfzeilen(w);
        var saetze = Zeilen.Select(z => Vorbereiten(z, w)).ToList();
        var x = f.Links;
        var b = w.Sum();

        float segmentOben = 0;
        void Beginnen(bool neueSeite)
        {
            if (neueSeite) f.NeueSeite();
            segmentOben = f.Y;
            KopfZeichnen(f.Seite, x, f.Y, w, koepfe, kopfH, ausr);
            f.Y += kopfH;
        }
        void Schliessen()
        {
            Senkrecht(f.Seite, x, segmentOben, f.Y, w);
            f.Seite.Linie(x, f.Y, x + b, f.Y, Formular.LinieNormal);
        }

        var erste = saetze.Count > 0 ? saetze[0].Hoehe : Zeilenabstand + 2 * InnenY;
        Beginnen(f.Y + kopfH + erste + (saetze.Count > 0 && saetze[0].Zeile.Art == Zeilenart.Gruppe && saetze.Count > 1 ? saetze[1].Hoehe : 0) > f.Unten);
        if (saetze.Count == 0)
        {
            var h = Zeilenabstand + 2 * InnenY;
            f.Seite.Text(x + InnenX, f.Y + InnenY + G * 0.8f, G, LeerText, false, Formular.GrauText);
            f.Y += h;
        }
        Satzzeile? gruppe = null;
        var nr = 0;
        for (var r = 0; r < saetze.Count; r++)
        {
            var sz = saetze[r];
            var bedarf = sz.Hoehe;
            // Gruppenkopf nicht allein am Seitenende; Summe nicht allein am Seitenanfang
            if (sz.Zeile.Art == Zeilenart.Gruppe && r + 1 < saetze.Count) bedarf += saetze[r + 1].Hoehe;
            if (f.Y + bedarf > f.Unten || (sz.Zeile.Seitenumbruch && r > 0))
            {
                Schliessen();
                Beginnen(true);
                if (gruppe != null && sz.Zeile.Art != Zeilenart.Gruppe)
                {
                    ZeileZeichnen(f.Seite, x, f.Y, w, gruppe, ausr, false, " (Fortsetzung)");
                    f.Y += gruppe.Hoehe;
                }
            }
            if (sz.Zeile.Art == Zeilenart.Gruppe) { gruppe = sz; nr = 0; }
            var wechsel = Wechselzeilen && sz.Zeile.Art == Zeilenart.Daten && nr++ % 2 == 1;
            ZeileZeichnen(f.Seite, x, f.Y, w, sz, ausr, wechsel);
            f.Y += sz.Hoehe;
        }
        Schliessen();
        f.Y += 6;
        if (Anzahl && Zeilen.Count > 0)
        {
            var n = Zeilen.Count(z => z.Art == Zeilenart.Daten);
            f.Notiz(n == 1 ? "1 Eintrag" : $"{n.ToString("N0", De)} Einträge");
        }
    }

    /// <summary>
    /// Tabelle in einen festen Bereich einer Seite setzen (ohne Seitenumbruch, z. B. neben einem Stundenplan). Gibt zurück, wie viele
    /// Zeilen Platz fanden, und die Unterkante.
    /// </summary>
    public (int Gesetzt, float Unten) SetzenIn(Seite s, float x, float y, float breite, float unten)
    {
        var w = Breiten(breite);
        var ausr = Ausrichtungen();
        var (koepfe, kopfH) = Kopfzeilen(w);
        KopfZeichnen(s, x, y, w, koepfe, kopfH, ausr);
        var oben = y;
        y += kopfH;
        var n = 0;
        var nr = 0;
        foreach (var z in Zeilen)
        {
            var sz = Vorbereiten(z, w);
            if (y + sz.Hoehe > unten) break;
            if (z.Art == Zeilenart.Gruppe) nr = 0;
            ZeileZeichnen(s, x, y, w, sz, ausr, Wechselzeilen && z.Art == Zeilenart.Daten && nr++ % 2 == 1);
            y += sz.Hoehe;
            n++;
        }
        if (Zeilen.Count == 0)
        {
            s.Text(x + InnenX, y + InnenY + G * 0.8f, G, LeerText, false, Formular.GrauText);
            y += Zeilenabstand + 2 * InnenY;
        }
        Senkrecht(s, x, oben, y, w);
        s.Linie(x, y, x + w.Sum(), y, Formular.LinieNormal);
        return (n, y);
    }
}
