using System.Collections.Concurrent;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using EduOrgaWebsite.Daten;

namespace EduOrgaWebsite.Dienste;

/// <summary>Passwort-Hashes (PBKDF2-SHA256, 210 000 Runden, 16 Byte Salz). Format: pbkdf2-sha256$runden$salz$hash.</summary>
public static class Passwoerter
{
    private const int Runden = 210_000;
    public const int Mindestlaenge = 8;

    public static string Hashen(string passwort)
    {
        var salz = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(Encoding.UTF8.GetBytes(passwort), salz, Runden, HashAlgorithmName.SHA256, 32);
        return $"pbkdf2-sha256${Runden}${Convert.ToBase64String(salz)}${Convert.ToBase64String(hash)}";
    }

    public static bool Pruefen(string passwort, string gespeichert)
    {
        var teile = gespeichert.Split('$');
        if (teile.Length != 4 || teile[0] != "pbkdf2-sha256" || !int.TryParse(teile[1], out var runden)) return false;
        var salz = Convert.FromBase64String(teile[2]);
        var soll = Convert.FromBase64String(teile[3]);
        var ist = Rfc2898DeriveBytes.Pbkdf2(Encoding.UTF8.GetBytes(passwort), salz, runden, HashAlgorithmName.SHA256, soll.Length);
        return CryptographicOperations.FixedTimeEquals(ist, soll);
    }

    public static string? Fehler(string passwort) =>
        passwort.Length < Mindestlaenge ? $"Das Passwort muss mindestens {Mindestlaenge} Zeichen lang sein." : null;

    public static string Zufaellig()
    {
        const string zeichen = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
        return string.Create(20, 0, (s, _) => { for (var i = 0; i < s.Length; i++) s[i] = zeichen[RandomNumberGenerator.GetInt32(zeichen.Length)]; });
    }
}

/// <summary>Administratoren der Website (nur Verwaltung des Ideenportals).</summary>
public sealed class Benutzerdienst(Datenbank db, ILogger<Benutzerdienst> log)
{
    public bool Vorhanden(string name)
    {
        using var c = db.Oeffnen();
        return Datenbank.Skalar(c, "SELECT 1 FROM benutzer WHERE name = $n", null, ("$n", name)) is not null;
    }

    public List<string> Alle()
    {
        using var c = db.Oeffnen();
        using var cmd = Datenbank.Befehl(c, "SELECT name FROM benutzer ORDER BY name", null, []);
        using var r = cmd.ExecuteReader();
        var l = new List<string>();
        while (r.Read()) l.Add(r.GetString(0));
        return l;
    }

    /// <summary>Beim ersten Start (noch kein Benutzer) den Administrator anlegen – Passwort aus WEBSITE_ADMIN_PASSWORT oder zufällig.</summary>
    public void ErstenAdminSicherstellen(WebsiteKonfiguration k)
    {
        if (Alle().Count > 0) return;
        var passwort = k.AdminPasswort;
        var zufaellig = Passwoerter.Fehler(passwort) is not null;
        if (zufaellig)
        {
            if (passwort.Length > 0) log.LogWarning("WEBSITE_ADMIN_PASSWORT ist zu kurz (mindestens {N} Zeichen) – es wird ein zufälliges Passwort verwendet.", Passwoerter.Mindestlaenge);
            passwort = Passwoerter.Zufaellig();
        }
        Setzen(k.AdminBenutzer, passwort, anlegen: true);
        if (zufaellig)
            log.LogWarning("Administrator „{Benutzer}“ angelegt. Zufälliges Passwort: {Passwort} – bitte notieren oder mit --passwort-setzen ändern.", k.AdminBenutzer, passwort);
        else
            log.LogInformation("Administrator „{Benutzer}“ mit dem Passwort aus WEBSITE_ADMIN_PASSWORT angelegt.", k.AdminBenutzer);
    }

    public void Setzen(string name, string passwort, bool anlegen)
    {
        if (Passwoerter.Fehler(passwort) is { } f) throw new Fachfehler(f);
        if (name.Length is 0 or > 64 || name.Any(ch => !(char.IsLetterOrDigit(ch) || ch is '.' or '-' or '_')))
            throw new Fachfehler("Benutzername bitte nur aus Buchstaben, Ziffern, Punkt, Binde- und Unterstrich.");
        using var c = db.Oeffnen();
        var hash = Passwoerter.Hashen(passwort);
        var n = Datenbank.Ausfuehren(c, "UPDATE benutzer SET passwort = $p WHERE name = $n", null, ("$p", hash), ("$n", name));
        if (n == 0)
        {
            if (!anlegen) throw new Fachfehler($"Den Benutzer „{name}“ gibt es nicht.", 404);
            Datenbank.Ausfuehren(c, "INSERT INTO benutzer (name, passwort, erstellt_am) VALUES ($n, $p, $z)", null, ("$n", name), ("$p", hash), ("$z", db.Jetzt()));
        }
    }

    /// <summary>Anmeldedaten prüfen; liefert den gespeicherten Namen (Schreibweise aus der Datenbank) oder null.</summary>
    public string? Anmelden(string name, string passwort)
    {
        using var c = db.Oeffnen();
        using var cmd = Datenbank.Befehl(c, "SELECT name, passwort FROM benutzer WHERE name = $n", null, [("$n", name)]);
        using var r = cmd.ExecuteReader();
        if (!r.Read())
        {
            // gleiche Rechenzeit wie bei einem vorhandenen Benutzer
            Passwoerter.Pruefen(passwort, "pbkdf2-sha256$210000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
            return null;
        }
        return Passwoerter.Pruefen(passwort, r.GetString(1)) ? r.GetString(0) : null;
    }
}

/// <summary>
/// Einfache Begrenzung je Schlüssel (z. B. gehashte IP-Adresse) in einem gleitenden Zeitfenster. Nur im Arbeitsspeicher –
/// es werden keine IP-Adressen gespeichert.
/// </summary>
public sealed class Ratenbegrenzung(int hoechstzahl, TimeSpan fenster, TimeProvider zeit)
{
    private readonly ConcurrentDictionary<string, Queue<DateTimeOffset>> _zugriffe = new();

    /// <summary>Zählt einen Versuch; false, wenn die Höchstzahl im Zeitfenster schon erreicht ist.</summary>
    public bool Versuch(string schluessel)
    {
        var jetzt = zeit.GetUtcNow();
        var q = _zugriffe.GetOrAdd(Hash(schluessel), _ => new Queue<DateTimeOffset>());
        lock (q)
        {
            while (q.Count > 0 && jetzt - q.Peek() >= fenster) q.Dequeue();
            if (q.Count >= hoechstzahl) return false;
            q.Enqueue(jetzt);
        }
        if (_zugriffe.Count > 10_000) Aufraeumen(jetzt);
        return true;
    }

    /// <summary>Nur prüfen, ohne zu zählen (z. B. gesperrte Anmeldung).</summary>
    public bool Gesperrt(string schluessel)
    {
        if (!_zugriffe.TryGetValue(Hash(schluessel), out var q)) return false;
        var jetzt = zeit.GetUtcNow();
        lock (q)
        {
            while (q.Count > 0 && jetzt - q.Peek() >= fenster) q.Dequeue();
            return q.Count >= hoechstzahl;
        }
    }

    public void Zuruecksetzen(string schluessel) => _zugriffe.TryRemove(Hash(schluessel), out _);

    private void Aufraeumen(DateTimeOffset jetzt)
    {
        foreach (var (k, q) in _zugriffe)
            lock (q) if (q.Count == 0 || jetzt - q.Last() >= fenster) _zugriffe.TryRemove(k, out _);
    }

    private static string Hash(string s) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(s)), 0, 16).ToString(CultureInfo.InvariantCulture);
}
