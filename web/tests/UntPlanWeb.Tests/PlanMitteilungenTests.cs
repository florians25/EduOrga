using System.Net;
using System.Text.Json.Nodes;

namespace UntPlanWeb.Tests;

/// <summary>
/// Mitteilungen im Plan (design/DESIGN.md, Abschnitt 10 „Stundenkarte (alle Plattformen)“): Tagestexte aus EduOrga Studio stehen als
/// Feld „mitteilungen“ im Tageskopf des Wochenplans (helle gelbe Notiz) – schulweite Texte für alle, Texte nur fürs Kollegium nur in der
/// Lehrerversion, Texte mit Elementen nur im Plan dieser Elemente. Abwärtskompatibel: zusätzliches Feld, sonst unverändert.
/// </summary>
public class PlanMitteilungenTests
{
    private static List<string> Mitteilungen(JsonNode plan, string datum) =>
        plan["tage"]!.AsArray().First(t => t!["datum"]!.GetValue<string>() == datum)!["mitteilungen"]!.AsArray().Select(x => x!.GetValue<string>()).ToList();

    [Fact]
    public async Task Tagestexte_erscheinen_als_Mitteilungen_im_Tageskopf_nach_Version_und_Element()
    {
        var paket = Testserver.Beispielpaket();
        paket["revision"] = 80;
        var texte = paket["tagestexte"]!.AsArray();
        texte.Add(new JsonObject { ["datum"] = "2026-10-13", ["gueltigTage"] = 2, ["text"] = "Aufbau der Bühne ab 16:00 Uhr", ["fuer"] = "klassen", ["elemente"] = new JsonArray("5a") });
        texte.Add(new JsonObject { ["datum"] = "2026-10-13", ["gueltigTage"] = 1, ["text"] = "Nur 6b", ["fuer"] = "klassen", ["elemente"] = new JsonArray("6b") });
        await using var s = await Testserver.StartenAsync(false);
        Assert.Equal(HttpStatusCode.OK, (await s.PaketSendenAsync(paket)).StatusCode);

        var schueler = await s.AlsAsync("5a", "schueler", "5a");
        var plan5a = await Testserver.HolenAsync(schueler, "/api/app/plan?typ=klasse&element=5a&datum=2026-10-12");
        // schulweit („alle“) ja, nur fürs Kollegium nein
        var mi = Mitteilungen(plan5a, "2026-10-14");
        Assert.Contains(mi, x => x.StartsWith("Heute 7. Stunde Lehrerkonferenz"));
        Assert.DoesNotContain(mi, x => x.StartsWith("Lehrerkonferenz um 14:15"));
        // Klassentext für 5a an beiden Tagen seiner Gültigkeit, der für 6b nicht
        Assert.Contains("Aufbau der Bühne ab 16:00 Uhr", Mitteilungen(plan5a, "2026-10-13"));
        Assert.Contains("Aufbau der Bühne ab 16:00 Uhr", mi);
        Assert.DoesNotContain("Nur 6b", Mitteilungen(plan5a, "2026-10-13"));
        Assert.Empty(Mitteilungen(plan5a, "2026-10-15"));

        var lehrer = await s.AlsAsync("sne", "lehrer", "SNE");
        var planSne = await Testserver.HolenAsync(lehrer, "/api/app/plan?typ=lehrer&element=SNE&datum=2026-10-12");
        var miL = Mitteilungen(planSne, "2026-10-14");
        Assert.Contains(miL, x => x.StartsWith("Lehrerkonferenz um 14:15"));
        Assert.DoesNotContain("Aufbau der Bühne ab 16:00 Uhr", miL);   // Klassentext gehört nicht in den Lehrerplan
    }
}
