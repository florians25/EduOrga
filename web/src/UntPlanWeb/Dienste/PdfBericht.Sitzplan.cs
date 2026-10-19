using UntPlan.Druck;

namespace UntPlanWeb.Dienste;

public static partial class PdfBericht
{
    /// <summary>
    /// Sitzplan im gemeinsamen Druckdesign (A4 quer oder hoch, eine Seite): Titel, Pult als grau hinterlegter Kasten vorne (oben) oder
    /// hinten (unten, Sicht vom Pult – Reihen und Plätze gespiegelt), Tische als umrandete Kästen mit Name (und Klasse), Plätze ohne Tisch
    /// bleiben leer, freie Tische gestrichelt, darunter „Ohne Platz“.
    /// </summary>
    /// <param name="plaetze">Alle Plätze (Reihe 1 = am Pult) mit Name, optional Klasse, und ob dort ein Tisch steht.</param>
    public static byte[] Sitzplan(string schule, string titel, string untertitel, int zeilen, int spalten, bool pultHinten,
        IReadOnlyList<(int Reihe, int Spalte, string? Name, string? Klasse, bool Tisch)> plaetze, IReadOnlyList<string> ohnePlatz, string? ersteller, bool hochformat = false)
    {
        zeilen = Math.Max(1, zeilen);
        spalten = Math.Max(1, spalten);
        var f = new Formular(Kopf(schule, titel, untertitel, ersteller, Dienstgebrauch), !hochformat);
        f.NeueSeite();
        var s = f.Seite;
        var ohneText = ohnePlatz.Count == 0 ? "" : string.Join(", ", ohnePlatz);
        var ohneZeilen = ohneText.Length == 0 ? 0 : Satz.Umbrechen(ohneText, f.Breite - 70, 8.5f).Count;
        const float pultHoehe = 18, abstand = 12, luecke = 7;
        var unten = f.Unten - (ohneZeilen > 0 ? ohneZeilen * 11.5f + 14 : 0);
        var rasterHoehe = unten - f.Y - pultHoehe - abstand;
        var zh = Math.Min(58, (rasterHoehe - (zeilen - 1) * luecke) / zeilen);
        var sw = Math.Min(140, (f.Breite - (spalten - 1) * luecke) / spalten);
        var rasterBreite = spalten * sw + (spalten - 1) * luecke;
        var x0 = f.Links + (f.Breite - rasterBreite) / 2;
        var gesamt = zeilen * zh + (zeilen - 1) * luecke;

        void Pult(float py)
        {
            var pb = Math.Min(230, rasterBreite * .5f);
            var px = f.Links + (f.Breite - pb) / 2;
            s.Flaeche(px, py, pb, pultHoehe, Formular.GrauKopf);
            s.Rahmen(px, py, pb, pultHoehe, Formular.LinieStark);
            s.TextMittig(px, pb, Seite.Mitte(py, pultHoehe, 8.5f), 8.5f, "Lehrerpult / Tafel", true);
        }
        var oben = f.Y;
        if (!pultHinten) { Pult(oben); oben += pultHoehe + abstand; }
        foreach (var p in plaetze)
        {
            if (!p.Tisch) continue;
            // Darstellungsreihe/-spalte: Pult vorne → Reihe 1 oben, Platz 1 links; Pult hinten → um 180° gedreht
            var dr = pultHinten ? zeilen - p.Reihe : p.Reihe - 1;
            var ds = pultHinten ? spalten - p.Spalte : p.Spalte - 1;
            var bx = x0 + ds * (sw + luecke);
            var by = oben + dr * (zh + luecke);
            if (p.Name is null) { s.Rahmen(bx, by, sw, zh, Formular.LinieNormal, 0.5f, 2, 2); continue; }
            s.Rahmen(bx, by, sw, zh, Formular.LinieStark);
            var groesse = zh < 30 ? 7.5f : 9.5f;
            var teile = Satz.Umbrechen(p.Name, sw - 8, groesse, true);
            if (teile.Count > 2) teile = new List<string> { teile[0], Satz.Kuerzen(string.Join(" ", teile.Skip(1)), sw - 8, groesse, true) };
            var zeilenGesamt = teile.Count + (p.Klasse is null ? 0 : 1);
            var ty = by + zh / 2 - zeilenGesamt * (groesse + 2) / 2 + groesse;
            foreach (var t in teile)
            {
                s.TextMittig(bx, sw, ty, groesse, Satz.Kuerzen(t, sw - 8, groesse, true), true);
                ty += groesse + 2;
            }
            if (p.Klasse is not null) s.TextMittig(bx, sw, ty, 7.5f, p.Klasse, false, Formular.GrauText);
        }
        if (pultHinten) Pult(oben + gesamt + abstand);
        f.Y = (pultHinten ? oben + gesamt + abstand + pultHoehe : oben + gesamt) + 14;
        if (ohneZeilen > 0)
        {
            s.Text(f.Links, f.Y + 8, 8.5f, "Ohne Platz:", true);
            foreach (var t in Satz.Umbrechen(ohneText, f.Breite - 70, 8.5f))
            {
                s.Text(f.Links + 70, f.Y + 8, 8.5f, t);
                f.Y += 11.5f;
            }
        }
        return f.Erzeugen();
    }
}
