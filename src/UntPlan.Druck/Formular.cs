using System.Globalization;

namespace UntPlan.Druck;

/// <summary>Kopf- und Fußangaben eines Ausdrucks (gleich auf jeder Seite).</summary>
public sealed class Kopfdaten
{
    /// <summary>Name der Schule (Kopf links, halbfett).</summary>
    public string Schule { get; set; } = "";
    /// <summary>Zweite Zeile unter dem Schulnamen (z. B. Anschrift); leer = keine.</summary>
    public string Schulzusatz { get; set; } = "";
    /// <summary>Titel des Dokuments (erste Seite groß, Folgeseiten klein mit „Fortsetzung“).</summary>
    public string Titel { get; set; } = "";
    /// <summary>Zeile unter dem Titel: Zeitraum, Periode, Klasse …</summary>
    public string Untertitel { get; set; } = "";
    /// <summary>Kopf rechts unter „Seite x von y“ (z. B. „Schuljahr 2026/27“).</summary>
    public string RechtsOben { get; set; } = "";
    /// <summary>Wer gedruckt hat (Fuß links, „von …“).</summary>
    public string Ersteller { get; set; } = "";
    /// <summary>Vermerk in der Mitte des Fußes, z. B. „Nur für den Dienstgebrauch“ bzw. „Vertraulich“.</summary>
    public string Vermerk { get; set; } = "";
    /// <summary>Zeitpunkt des Drucks (Fuß links).</summary>
    public DateTime Druckzeit { get; set; } = DateTime.Now;
}

/// <summary>
/// Gemeinsames Seitenlayout aller Ausdrucke (EduOrga Druck): A4 hoch oder quer, Rand 14 mm, Kopf mit Schule (links) und „Seite x von y“
/// (rechts) über einer Linie, auf der ersten Seite Titel und Untertitel, Fuß mit Druckdatum, Vermerk und „EduOrga“. Inhalte fließen von
/// oben nach unten (<see cref="Y"/>); reicht der Platz nicht, beginnt eine neue Seite. Kopf und Fuß werden erst beim Erzeugen gezeichnet,
/// wenn die Seitenzahl feststeht.
/// </summary>
public sealed class Formular
{
    // ------------------------------------------------------------------------------------------ Gestaltungswerte (Punkt)

    /// <summary>Seitenrand (14 mm).</summary>
    public const float Rand = 14 * PdfDokument.Mm;
    /// <summary>Höhe des Seitenkopfs bis unter die Kopflinie.</summary>
    public const float KopfHoehe = 26;
    /// <summary>Höhe des Fußes (Linie und eine Textzeile).</summary>
    public const float FussHoehe = 16;
    public const float GroesseTitel = 16, GroesseUntertitel = 9.5f, GroesseText = 9, GroesseKlein = 7.5f, GroesseUeberschrift = 11;
    /// <summary>Linienstärken: Struktur (Kopf, Tabellenkopf, Summen) und fein (Zeilen).</summary>
    public const float LinieStark = 0.8f, LinieNormal = 0.5f, LinieFein = 0.35f;
    /// <summary>Grautöne: Tabellenkopf, Gruppenzeile, Wechselzeile, feine Linien, Nebentext.</summary>
    public const float GrauKopf = 0.88f, GrauGruppe = 0.93f, GrauWechsel = 0.955f, GrauLinie = 0.55f, GrauText = 0.3f;

    public PdfDokument Pdf { get; } = new();
    public Kopfdaten Kopf { get; }
    public bool Quer { get; private set; }
    public Seite Seite { get; private set; } = null!;
    public int Seitennummer => Pdf.Seiten.Count;
    /// <summary>Aktuelle Schreibposition (oben).</summary>
    public float Y { get; set; }
    public float Links => Rand;
    public float Rechts => Seite.Breite - Rand;
    public float Breite => Rechts - Links;
    /// <summary>Untere Grenze des Inhalts (über dem Fuß).</summary>
    public float Unten => Seite.Hoehe - Rand - FussHoehe - 4;
    public float Rest => Unten - Y;
    private readonly List<(string Titel, string Untertitel)> _seitentitel = new();

    /// <summary>Wird zu Beginn jeder Folgeseite nach dem Titel aufgerufen (z. B. Tabellenkopf wiederholen).</summary>
    public Action? BeiNeuerSeite { get; set; }
    /// <summary>Schriftgröße des Seitentitels (Aushang mit großer Schrift: größer).</summary>
    public float Titelgroesse { get; set; } = GroesseTitel;

    public Formular(Kopfdaten kopf, bool quer)
    {
        Kopf = kopf;
        Quer = quer;
        Pdf.Titel = kopf.Titel;
        Pdf.Autor = kopf.Ersteller;
        Pdf.Thema = kopf.Schule;
    }

    /// <summary>Neue Seite mit eigenem Titel (z. B. ein Stundenplan je Seite); ohne Titel: Fortsetzung des Dokumenttitels.</summary>
    public Seite NeueSeite(string? titel = null, string? untertitel = null, bool? quer = null)
    {
        if (quer is bool q) Quer = q;
        var erste = Pdf.Seiten.Count == 0;
        Seite = Pdf.NeueSeite(Quer);
        Y = Rand + KopfHoehe;
        var t = titel ?? Kopf.Titel;
        var u = untertitel ?? Kopf.Untertitel;
        if (titel != null || erste)
        {
            _seitentitel.Add((t, u));
            Y += 14;
            var titelZeilen = Satz.Umbrechen(t, Breite, Titelgroesse, true);
            if (titelZeilen.Count > 2) titelZeilen = new List<string> { titelZeilen[0], Satz.Kuerzen(string.Join(" ", titelZeilen.Skip(1)), Breite, Titelgroesse, true) };
            for (var i = 0; i < titelZeilen.Count; i++)
            {
                if (i > 0) Y += Titelgroesse * 1.2f;
                Seite.Text(Links, Y + Titelgroesse * 0.75f, Titelgroesse, titelZeilen[i], true);
            }
            Y += Titelgroesse * 1.05f;
            if (u.Length > 0)
            {
                foreach (var z in Satz.Umbrechen(u, Breite, GroesseUntertitel).Take(2))
                {
                    Y += GroesseUntertitel * 1.3f;
                    Seite.Text(Links, Y, GroesseUntertitel, z, false, GrauText);
                }
            }
            Y += 10;
        }
        else
        {
            var letzte = _seitentitel.Count > 0 ? _seitentitel[^1] : (Titel: t, Untertitel: u);
            _seitentitel.Add(letzte);
            Y += 9;
            var text = $"{letzte.Titel}{(letzte.Untertitel.Length > 0 ? " · " + letzte.Untertitel : "")}";
            Seite.Text(Links, Y + 7, 9, Satz.Kuerzen(text, Breite - 70, 9, true), true);
            Seite.TextRechts(Rechts, Y + 7, GroesseKlein, "Fortsetzung", false, GrauText);
            Y += 18;
        }
        if (!erste && titel == null) BeiNeuerSeite?.Invoke();
        return Seite;
    }

    /// <summary>Sorgt für Platz (sonst neue Seite); true, wenn eine neue Seite begonnen wurde.</summary>
    public bool Platz(float hoehe)
    {
        if (Pdf.Seiten.Count == 0) { NeueSeite(); return true; }
        if (Y + hoehe <= Unten) return false;
        NeueSeite();
        return true;
    }

    private void Sicherstellen()
    {
        if (Pdf.Seiten.Count == 0) NeueSeite();
    }

    // ------------------------------------------------------------------------------------------ Bausteine

    /// <summary>Absatz mit Zeilenumbruch.</summary>
    public void Absatz(string? text, float groesse = GroesseText, bool fett = false, float grau = 0, float abstandNach = 6)
    {
        Sicherstellen();
        if (string.IsNullOrWhiteSpace(text)) return;
        var zh = groesse * 1.4f;
        foreach (var z in Satz.Umbrechen(text, Breite, groesse, fett))
        {
            Platz(zh);
            Y += zh;
            Seite.Text(Links, Y - zh * 0.28f, groesse, z, fett, grau);
        }
        Y += abstandNach;
    }

    /// <summary>Zwischenüberschrift (halbfett) mit feiner Linie darunter.</summary>
    public void Ueberschrift(string text, float groesse = GroesseUeberschrift)
    {
        Sicherstellen();
        Platz(groesse * 1.6f + 40);
        Y += groesse * 1.2f;
        Seite.Text(Links, Y, groesse, Satz.Kuerzen(text, Breite, groesse, true), true);
        Y += 4;
        Seite.Linie(Links, Y, Rechts, Y, LinieNormal);
        Y += 6;
    }

    /// <summary>Angaben als Schlüssel/Wert-Liste in einer oder mehreren Spalten (z. B. Schüler*in, Klasse, Zeitraum).</summary>
    public void Angaben(IReadOnlyList<(string Name, string Wert)> angaben, int spalten = 2, float groesse = GroesseText)
    {
        Sicherstellen();
        if (angaben.Count == 0) return;
        spalten = Math.Clamp(spalten, 1, 4);
        var sb = Breite / spalten;
        var nameB = Math.Min(sb * 0.45f, angaben.Max(a => Satz.Breite(a.Name + ":", groesse * 0.9f)) + 8);
        var zh = groesse * 1.65f;
        for (var i = 0; i < angaben.Count; i += spalten)
        {
            Platz(zh);
            for (var s = 0; s < spalten && i + s < angaben.Count; s++)
            {
                var (n, w) = angaben[i + s];
                var x = Links + s * sb;
                Seite.Text(x, Y + groesse * 1.15f, groesse * 0.9f, Satz.Kuerzen(n + ":", nameB - 4, groesse * 0.9f), false, GrauText);
                Seite.Text(x + nameB, Y + groesse * 1.15f, groesse, Satz.Kuerzen(w, sb - nameB - 10, groesse, true), true);
            }
            Y += zh;
        }
        Y += 6;
    }

    /// <summary>Umrandeter Hinweiskasten mit optionalem Titel (z. B. Nachrichten zum Tag).</summary>
    public void Kasten(string? titel, string text, float groesse = GroesseText)
    {
        Sicherstellen();
        var zh = groesse * 1.35f;
        var zeilen = Satz.Umbrechen(text, Breite - 16, groesse);
        var titelH = string.IsNullOrEmpty(titel) ? 0 : groesse * 1.5f;
        var h = titelH + zeilen.Count * zh + 10;
        if (h > Unten - Y && h < Unten - Rand - KopfHoehe - 60) Platz(h);
        var oben = Y;
        var y = Y + 5;
        if (titelH > 0) { Seite.Text(Links + 8, y + groesse, groesse, titel, true); y += titelH; }
        foreach (var z in zeilen)
        {
            if (y + zh > Unten) { Seite.Rahmen(Links, oben, Breite, y - oben + 3, LinieNormal); NeueSeite(); oben = Y; y = Y + 5; }
            Seite.Text(Links + 8, y + groesse, groesse, z);
            y += zh;
        }
        Seite.Rahmen(Links, oben, Breite, y - oben + 5, LinieNormal);
        Y = y + 5 + 8;
    }

    /// <summary>Linien zum Ausfüllen (mit Beschriftung links).</summary>
    public void Schreiblinien(string? beschriftung, int anzahl = 1, float abstand = 22)
    {
        Sicherstellen();
        var bx = string.IsNullOrEmpty(beschriftung) ? 0 : Satz.Breite(beschriftung, GroesseText) + 8;
        for (var i = 0; i < anzahl; i++)
        {
            Platz(abstand);
            Y += abstand;
            if (i == 0 && bx > 0) Seite.Text(Links, Y - 2, GroesseText, beschriftung);
            Seite.Linie(Links + (i == 0 ? bx : 0), Y, Rechts, Y, LinieNormal);
        }
        Y += 8;
    }

    /// <summary>Unterschriftenfelder nebeneinander (Linie, darunter klein die Beschriftung).</summary>
    public void Unterschriften(params string[] beschriftungen)
    {
        Sicherstellen();
        if (beschriftungen.Length == 0) return;
        Platz(56);
        Y += 38;
        const float luecke = 28;
        var b = (Breite - (beschriftungen.Length - 1) * luecke) / beschriftungen.Length;
        for (var i = 0; i < beschriftungen.Length; i++)
        {
            var x = Links + i * (b + luecke);
            Seite.Linie(x, Y, x + b, Y, LinieNormal);
            Seite.Text(x, Y + 10, GroesseKlein, beschriftungen[i], false, GrauText);
        }
        Y += 20;
    }

    /// <summary>Kleiner Text (z. B. Anzahl der Einträge, Fußnote).</summary>
    public void Notiz(string text)
    {
        Sicherstellen();
        Absatz(text, GroesseKlein + 0.5f, false, GrauText, 4);
    }

    public void Abstand(float h)
    {
        Sicherstellen();
        Y = Math.Min(Unten, Y + h);
    }

    /// <summary>Tabelle setzen (mit Seitenumbruch und wiederholtem Tabellenkopf).</summary>
    public void Tabelle(Tabelle t)
    {
        Sicherstellen();
        t.Setzen(this);
    }

    // ------------------------------------------------------------------------------------------ Kopf und Fuß

    private void KopfUndFuss()
    {
        var n = Pdf.Seiten.Count;
        var de = CultureInfo.GetCultureInfo("de-DE");
        for (var i = 0; i < n; i++)
        {
            var s = Pdf.Seiten[i];
            float l = Rand, r = s.Breite - Rand, o = Rand;
            var seite = $"Seite {i + 1} von {n}";
            var rechtsB = Math.Max(Satz.Breite(seite, 8), Satz.Breite(Kopf.RechtsOben, GroesseKlein)) + 12;
            s.Text(l, o + 8, 9.5f, Satz.Kuerzen(Kopf.Schule, r - l - rechtsB, 9.5f, true), true);
            if (Kopf.Schulzusatz.Length > 0) s.Text(l, o + 18.5f, GroesseKlein, Satz.Kuerzen(Kopf.Schulzusatz, r - l - rechtsB, GroesseKlein), false, GrauText);
            s.TextRechts(r, o + 8, 8, seite);
            if (Kopf.RechtsOben.Length > 0) s.TextRechts(r, o + 18.5f, GroesseKlein, Kopf.RechtsOben, false, GrauText);
            s.Linie(l, o + 23, r, o + 23, LinieStark);

            var fy = s.Hoehe - Rand;
            s.Linie(l, fy - 11, r, fy - 11, LinieFein, 0);
            var links = $"Gedruckt am {Kopf.Druckzeit.ToString("dd.MM.yyyy", de)} um {Kopf.Druckzeit:HH:mm} Uhr{(Kopf.Ersteller.Length > 0 ? " von " + Kopf.Ersteller : "")}";
            const float g = 7f;
            s.Text(l, fy - 2, g, Satz.Kuerzen(links, (r - l) * 0.42f, g), false, GrauText);
            if (Kopf.Vermerk.Length > 0) s.TextMittig(l, r - l, fy - 2, g, Kopf.Vermerk, true);
            // Wortmarke klein: „Edu“ halbfett, „Orga“ normal
            var wOrga = Satz.Breite("Orga", g);
            s.Text(r - wOrga - Satz.Breite("Edu", g, true), fy - 2, g, "Edu", true, GrauText);
            s.Text(r - wOrga, fy - 2, g, "Orga", false, GrauText);
        }
    }

    public byte[] Erzeugen()
    {
        Sicherstellen();
        KopfUndFuss();
        return Pdf.Erzeugen();
    }
}
