using System.Text;
using System.Data.Common;
using Microsoft.Data.Sqlite;
using MySqlConnector;
using Microsoft.Extensions.Logging.Abstractions;
using UntPlanStudio.Dienste;
using UntPlanStudio.Grundlagen;

namespace UntPlanStudio;

public partial class Program
{
    public const string PasswortBefehl = "--passwort-setzen";
    /// <summary>Zusatz zu <see cref="PasswortBefehl"/>: fehlenden Benutzer als Administrator anlegen.</summary>
    public const string AnlegenSchalter = "--anlegen";

    /// <summary>
    /// <c>dotnet UntPlanStudio.dll --passwort-setzen &lt;benutzer&gt; [--anlegen]</c>: setzt das Passwort eines Studio-Benutzers
    /// (Datenordner aus STUDIO_DATEN wie beim Serverstart), ohne den Webserver zu starten. Das Passwort kommt als eine Zeile über
    /// die Standardeingabe; an einem Terminal wird es zweimal verdeckt abgefragt. Läuft auch, während der Server läuft (der
    /// Benutzerdienst liest die Benutzer bei jeder Anmeldung neu). Ergebnis 0 = gesetzt, 1 = Fehler.
    /// </summary>
    public static int PasswortSetzen(string[] args, IConfiguration konfiguration, string inhaltsordner, TextReader ein, TextWriter aus, TextWriter fehler, bool terminal = false)
    {
        var i = Array.IndexOf(args, PasswortBefehl);
        var name = i >= 0 && i + 1 < args.Length && !args[i + 1].StartsWith("--") ? args[i + 1].Trim() : "";
        if (name.Length == 0)
        {
            fehler.WriteLine($"Aufruf: dotnet UntPlanStudio.dll {PasswortBefehl} <benutzer> [{AnlegenSchalter}]  (Passwort über die Standardeingabe)");
            return 1;
        }
        var anlegen = args.Contains(AnlegenSchalter);
        try
        {
            var k = StudioKonfiguration.Laden(konfiguration, inhaltsordner);
            if (k.Datenbank == StudioDatenbankart.Sqlite && !File.Exists(k.Datenbankpfad))
            {
                fehler.WriteLine($"Keine Datenbank unter {k.Datenbankpfad} – EduOrga Studio bitte zuerst einmal starten (oder ist STUDIO_DATEN falsch?).");
                return 1;
            }
            var db = new StudioDatenbank(k, NullLogger<StudioDatenbank>.Instance);
            var benutzer = new Benutzerdienst(k, db, NullLogger<Benutzerdienst>.Instance);
            var vorhanden = benutzer.Holen(name);
            if (vorhanden is null && !anlegen)
            {
                var admins = benutzer.Alle().Where(b => b.Rolle == Rollen.Admin).Select(b => b.Name).ToList();
                fehler.WriteLine($"Den Benutzer „{name}“ gibt es nicht.");
                fehler.WriteLine("Vorhandene Administratoren: " + (admins.Count == 0 ? "(keine)" : string.Join(", ", admins)));
                fehler.WriteLine($"Mit {AnlegenSchalter} wird „{name}“ als Administrator angelegt.");
                return 1;
            }
            var passwort = Passworteingabe.Lesen(ein, fehler, terminal);
            if (passwort is null) return 1;
            if (vorhanden is null)
            {
                var neu = benutzer.Anlegen(name, "Administrator", Rollen.Admin, passwort);
                aus.WriteLine($"Administrator „{neu.Name}“ angelegt.");
            }
            else
            {
                benutzer.PasswortSetzen(vorhanden.Name, passwort);
                aus.WriteLine($"Passwort für „{vorhanden.Name}“ ({vorhanden.Rolle}) gesetzt.");
            }
            return 0;
        }
        catch (StudioFehler ex)
        {
            fehler.WriteLine("Fehler: " + ex.Message);
            return 1;
        }
        catch (Exception ex) when (ex is DbException or InvalidOperationException or IOException or UnauthorizedAccessException)
        {
            fehler.WriteLine("Passwort konnte nicht gesetzt werden: " + ex.Message);
            return 1;
        }
        finally
        {
            SqliteConnection.ClearAllPools();
            MySqlConnection.ClearAllPools();
        }
    }

    private static int PasswortSetzen(string[] args)
    {
        var konfiguration = new ConfigurationBuilder().SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: true).AddEnvironmentVariables().Build();
        return PasswortSetzen(args, konfiguration, Directory.GetCurrentDirectory(), Console.In, Console.Out, Console.Error, !Console.IsInputRedirected);
    }
}

/// <summary>Passwort für die Kommandozeile lesen: über eine Weiterleitung eine Zeile, am Terminal zweimal verdeckt.</summary>
internal static class Passworteingabe
{
    public static string? Lesen(TextReader ein, TextWriter meldungen, bool terminal)
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
