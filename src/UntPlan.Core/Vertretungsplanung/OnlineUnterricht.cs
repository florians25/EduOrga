using UntPlan.Core.Model;

namespace UntPlan.Core.Vertretungsplanung;

/// <summary>Ergebnis „Findet online statt“ einer Stunde: Online, Link (nur bei Online) und ob eine Abweichung am Datum vorliegt.</summary>
public readonly record struct OnlineStand(bool Online, string Link, bool Abweichend)
{
    public static readonly OnlineStand Praesenz = new(false, "", false);
}

/// <summary>
/// „Findet online statt“: regelmäßig je Unterricht (<see cref="Unterricht.Online"/>, <see cref="Unterricht.OnlineLink"/>) und
/// abweichend für einzelne Stunden an einem Datum (<see cref="Schuldatei.OnlineStunden"/>). Wird in UntPlan Studio festgelegt und mit
/// dem Paket an UntPlanWeb übertragen (dort nur Anzeige).
/// </summary>
public static class OnlineUnterricht
{
    public const int MaxLinkLaenge = 1000;

    /// <summary>Link prüfen: leer oder eine absolute http-/https-Adresse (höchstens 1000 Zeichen, ohne Leerzeichen). Liefert den bereinigten Link.</summary>
    /// <exception cref="ArgumentException">ungültiger Link</exception>
    public static string LinkPruefen(string? link)
    {
        var t = (link ?? "").Trim();
        if (t.Length == 0) return "";
        if (t.Length > MaxLinkLaenge) throw new ArgumentException($"Der Link ist zu lang (höchstens {MaxLinkLaenge} Zeichen).");
        if (!LinkGueltig(t)) throw new ArgumentException("Bitte einen gültigen Link mit http:// oder https:// angeben.");
        return t;
    }

    /// <summary>Absolute http-/https-Adresse mit Host, ohne Leerzeichen.</summary>
    public static bool LinkGueltig(string? link) =>
        !string.IsNullOrWhiteSpace(link) && link.Length <= MaxLinkLaenge && !link.Any(char.IsWhiteSpace)
        && Uri.TryCreate(link, UriKind.Absolute, out var u) && (u.Scheme == Uri.UriSchemeHttp || u.Scheme == Uri.UriSchemeHttps) && !string.IsNullOrEmpty(u.Host);

    /// <summary>Regelmäßige Einstellung eines Unterrichts (Link nur bei Online).</summary>
    public static OnlineStand Regel(Unterricht? u) =>
        u is { Online: true } ? new OnlineStand(true, LinkGueltig(u.OnlineLink) ? u.OnlineLink : "", false) : OnlineStand.Praesenz;

    /// <summary>Abweichung einer Stunde am Datum oder null.</summary>
    public static OnlineStunde? Abweichung(Schuldatei d, DateOnly datum, int stunde, int unterrichtId) =>
        d.OnlineStunden.FirstOrDefault(o => o.Datum == datum && o.Stunde == stunde && o.UnterrichtId == unterrichtId);

    /// <summary>
    /// „Findet online statt“ einer Stunde am Datum: Abweichung am Datum, sonst die Einstellung des Unterrichts. Eine Online-Abweichung
    /// ohne eigenen Link übernimmt den Link des Unterrichts.
    /// </summary>
    public static OnlineStand Am(Schuldatei d, Unterricht? u, DateOnly datum, int stunde)
    {
        if (u is null) return OnlineStand.Praesenz;
        var regel = Regel(u);
        var ab = Abweichung(d, datum, stunde, u.Id);
        if (ab is null) return regel;
        if (!ab.Online) return new OnlineStand(false, "", regel.Online);
        var link = LinkGueltig(ab.Link) ? ab.Link : LinkGueltig(u.OnlineLink) ? u.OnlineLink : "";
        return new OnlineStand(true, link, !regel.Online || link != regel.Link);
    }

    /// <summary>„Findet online statt“ einer Stunde des Tagesplans (Unterricht laut Regel bzw. Vertretung, Periode am Datum).</summary>
    public static OnlineStand Am(Schuldatei d, Tagesplan tp, TagesEintrag e)
    {
        if (!e.Findetstatt) return OnlineStand.Praesenz;
        var u = e.Unterricht ?? (e.Vertretung?.UnterrichtId is int uid ? tp.Unterrichte.GetValueOrDefault(uid) : null);
        return Am(d, u, tp.Datum, e.Stunde);
    }

    /// <summary>Regelmäßige Einstellung eines Unterrichts setzen (Link wird geprüft; null = unverändert, "" = entfernen).</summary>
    public static void Setzen(Unterricht u, bool online, string? link)
    {
        var l = link is null ? null : LinkPruefen(link);
        u.Online = online;
        if (l is not null) u.OnlineLink = l;
    }

    /// <summary>
    /// Abweichung einer Stunde am Datum setzen. online = null entfernt die Abweichung (es gilt wieder der Unterricht). Entspricht die
    /// Angabe genau der Einstellung des Unterrichts, wird ebenfalls kein Eintrag gespeichert. Liefert den neuen Stand.
    /// </summary>
    public static OnlineStand StundeSetzen(Schuldatei d, Unterricht u, DateOnly datum, int stunde, bool? online, string? link, string benutzer = "")
    {
        var l = LinkPruefen(link);
        d.OnlineStunden.RemoveAll(o => o.Datum == datum && o.Stunde == stunde && o.UnterrichtId == u.Id);
        if (online is bool on)
        {
            var regel = Regel(u);
            var gleich = on == regel.Online && (!on || l.Length == 0 || l == regel.Link);
            if (!gleich)
                d.OnlineStunden.Add(new OnlineStunde { Datum = datum, Stunde = stunde, UnterrichtId = u.Id, Online = on, Link = on ? l : "", Benutzer = benutzer, Geaendert = DateTime.Now });
        }
        return Am(d, u, datum, stunde);
    }
}
