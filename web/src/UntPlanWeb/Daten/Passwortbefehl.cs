using System.Text;
using Microsoft.Data.Sqlite;
using MySqlConnector;
using UntPlanWeb.Dienste;

namespace UntPlanWeb.Daten;

/// <summary>
/// <c>dotnet UntPlanWeb.dll --passwort-setzen &lt;login&gt; [--anlegen] [--aenderungspflicht]</c>: setzt das Passwort eines Kontos
/// direkt in der Datenbank (SQLite oder MySQL/MariaDB, Konfiguration wie beim Serverstart), ohne den Webserver zu starten. Das Passwort
/// kommt als eine Zeile über die Standardeingabe; an einem Terminal wird es zweimal verdeckt abgefragt. Es muss der Passwortrichtlinie
/// genügen. Die Sperre nach Fehlversuchen wird aufgehoben, ein gesperrtes Konto entsperrt. Ohne <c>--aenderungspflicht</c> muss das
/// Passwort bei der nächsten Anmeldung nicht geändert werden. Der laufende Server liest Konten bei jeder Anfrage aus der Datenbank.
/// </summary>
public static class Passwortbefehl
{
    public const string Befehlsname = "--passwort-setzen";
    /// <summary>Fehlendes Konto als Administrator anlegen.</summary>
    public const string Anlegen = "--anlegen";
    /// <summary>Bei der nächsten Anmeldung muss ein neues Passwort gewählt werden.</summary>
    public const string Aenderungspflicht = "--aenderungspflicht";

    public static int Befehl(string[] args, IConfiguration konfig) =>
        Befehl(args, konfig, Console.In, Console.Out, Console.Error, !Console.IsInputRedirected);

    public static int Befehl(string[] args, IConfiguration konfig, TextReader ein, TextWriter aus, TextWriter fehler, bool terminal = false)
    {
        var i = Array.IndexOf(args, Befehlsname);
        var login = i >= 0 && i + 1 < args.Length && !args[i + 1].StartsWith("--") ? args[i + 1].Trim() : "";
        if (login.Length == 0)
        {
            fehler.WriteLine($"Aufruf: dotnet UntPlanWeb.dll {Befehlsname} <login> [{Anlegen}] [{Aenderungspflicht}]  (Passwort über die Standardeingabe)");
            return 1;
        }
        var anlegen = args.Contains(Anlegen);
        var mussAendern = args.Contains(Aenderungspflicht);
        Db? db = null;
        try
        {
            var k = Konfiguration.Laden(konfig);
            var dbk = Datenbankkonfiguration.Laden(konfig);
            if (dbk.Art == Datenbankart.Sqlite && !File.Exists(Path.Combine(k.Datenordner, "untplanweb.db")))
            {
                fehler.WriteLine($"Keine Datenbank unter {Path.Combine(k.Datenordner, "untplanweb.db")} – UntPlan Web bitte zuerst einmal starten (oder ist UNTPLANWEB_DATEN falsch?).");
                return 1;
            }
            db = dbk.Oeffnen(k.Datenordner);
            var dienst = new Benutzerdienst(db, new Uhr(k));
            var konto = dienst.NachLogin(login);
            if (konto is null && !anlegen)
            {
                var admins = dienst.Alle().Where(b => b.IstAdmin).Select(b => b.Login).ToList();
                fehler.WriteLine($"Das Konto „{login}“ gibt es nicht.");
                fehler.WriteLine("Vorhandene Administratoren: " + (admins.Count == 0 ? "(keine)" : string.Join(", ", admins)));
                fehler.WriteLine($"Mit {Anlegen} wird „{login}“ als Administrator angelegt.");
                return 1;
            }
            var passwort = Lesen(ein, fehler, terminal);
            if (passwort is null) return 1;
            dienst.RegelPruefen(passwort);
            if (konto is null)
            {
                var neu = dienst.Anlegen(login, passwort, Rollen.Admin, "", "Administration", passwortAendern: mussAendern);
                aus.WriteLine($"Administrator „{neu.Login}“ angelegt.");
                return 0;
            }
            dienst.PasswortSetzen(konto.Id, passwort, mussAendern);
            if (konto.Gesperrt) dienst.Sperren(konto.Id, false);
            aus.WriteLine($"Passwort für „{konto.Login}“ ({Rollen.Name(konto.Rolle)}) gesetzt." + (konto.Gesperrt ? " Das Konto war gesperrt und wurde entsperrt." : "")
                + (mussAendern ? " Bei der nächsten Anmeldung muss es geändert werden." : ""));
            return 0;
        }
        catch (ArgumentException ex)
        {
            fehler.WriteLine("Fehler: " + ex.Message);
            return 1;
        }
        catch (Exception ex) when (ex is InvalidOperationException or SqliteException or MySqlException or IOException or UnauthorizedAccessException)
        {
            fehler.WriteLine("Passwort konnte nicht gesetzt werden: " + ex.Message);
            return 1;
        }
        finally
        {
            if (db?.Art == Datenbankart.Sqlite) SqliteConnection.ClearAllPools();
            else if (db is not null) MySqlConnection.ClearAllPools();
        }
    }

    /// <summary>Passwort lesen: über eine Weiterleitung eine Zeile, am Terminal zweimal verdeckt.</summary>
    private static string? Lesen(TextReader ein, TextWriter meldungen, bool terminal)
    {
        if (!terminal)
        {
            var zeile = ein.ReadLine();
            if (string.IsNullOrEmpty(zeile))
            {
                meldungen.WriteLine("Kein Passwort erhalten (erwartet: eine Zeile über die Standardeingabe).");
                return null;
            }
            return zeile;
        }
        var erstes = Verdeckt(meldungen, "Neues Passwort: ");
        var zweites = Verdeckt(meldungen, "Passwort wiederholen: ");
        if (erstes != zweites)
        {
            meldungen.WriteLine("Die Passwörter stimmen nicht überein.");
            return null;
        }
        if (erstes.Length == 0)
        {
            meldungen.WriteLine("Kein Passwort eingegeben.");
            return null;
        }
        return erstes;
    }

    private static string Verdeckt(TextWriter meldungen, string aufforderung)
    {
        meldungen.Write(aufforderung);
        meldungen.Flush();
        var sb = new StringBuilder();
        while (true)
        {
            var taste = Console.ReadKey(intercept: true);
            if (taste.Key == ConsoleKey.Enter) break;
            if (taste.Key == ConsoleKey.Backspace) { if (sb.Length > 0) sb.Length--; }
            else if (!char.IsControl(taste.KeyChar)) sb.Append(taste.KeyChar);
        }
        meldungen.WriteLine();
        return sb.ToString();
    }
}
