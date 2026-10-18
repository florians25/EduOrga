using System.Text.Json;
using UntPlan.Core;
using UntPlan.Core.Austausch;
using UntPlan.Core.Model;
using UntPlan.Core.Vertretungsplanung;
using UntPlan.Web.Contracts;
using Xunit;

namespace UntPlan.Core.Tests;

/// <summary>
/// „Findet online statt“ (in UntPlan Studio festgelegt): regelmäßig je Unterricht, abweichend je Stunde und Datum; Speichern in
/// der Schuldatei (ältere Dateien: nicht online), Rückgängig/Wiederholen und Übertragung an UntPlanWeb.
/// </summary>
public class OnlineUnterrichtTests
{
    private static TagesEintrag Stunde(Schuldatei d, DateOnly tag) =>
        Tagesplan.Berechnen(d, tag).Eintraege.First(e => e.Regel != null && e.Status == TagesStatus.Regulaer && e.Unterricht!.Zeilen.Count == 1);

    [Fact]
    public void Link_wird_geprueft()
    {
        Assert.Equal("", OnlineUnterricht.LinkPruefen("  "));
        Assert.Equal("https://meet.example.org/a?b=1", OnlineUnterricht.LinkPruefen(" https://meet.example.org/a?b=1 "));
        Assert.Equal("http://video.example.org", OnlineUnterricht.LinkPruefen("http://video.example.org"));
        foreach (var falsch in new[] { "javascript:alert(1)", "ftp://server/x", "meet.example.org/abc", "https://", "https://exa mple.org", "https://x.org/" + new string('a', 1000) })
            Assert.Throws<ArgumentException>(() => OnlineUnterricht.LinkPruefen(falsch));
    }

    [Fact]
    public void Unterricht_und_Abweichung_einer_Stunde()
    {
        var d = Testdaten.Verplant();
        var tag = Testdaten.Unterrichtstag(d);
        var e = Stunde(d, tag);
        var u = e.Unterricht!;
        Assert.Equal(OnlineStand.Praesenz, OnlineUnterricht.Am(d, u, tag, e.Stunde));

        // regelmäßig online mit Link
        OnlineUnterricht.Setzen(u, true, "https://meet.example.org/regel");
        Assert.Equal(new OnlineStand(true, "https://meet.example.org/regel", false), OnlineUnterricht.Am(d, u, tag, e.Stunde));
        Assert.Throws<ArgumentException>(() => OnlineUnterricht.Setzen(u, true, "ftp://x"));
        // Link null = unverändert
        OnlineUnterricht.Setzen(u, true, null);
        Assert.Equal("https://meet.example.org/regel", u.OnlineLink);

        // diese Stunde findet nicht online statt
        var st = OnlineUnterricht.StundeSetzen(d, u, tag, e.Stunde, false, null, "planer");
        Assert.Equal(new OnlineStand(false, "", true), st);
        Assert.Single(d.OnlineStunden);
        Assert.Equal("planer", d.OnlineStunden[0].Benutzer);
        // die anderen Tage bleiben online
        Assert.True(OnlineUnterricht.Am(d, u, tag.AddDays(7), e.Stunde).Online);

        // online mit eigenem Link bzw. ohne Link (dann der des Unterrichts)
        st = OnlineUnterricht.StundeSetzen(d, u, tag, e.Stunde, true, "https://meet.example.org/heute");
        Assert.Equal(new OnlineStand(true, "https://meet.example.org/heute", true), st);
        st = OnlineUnterricht.StundeSetzen(d, u, tag, e.Stunde, true, "");
        Assert.Equal(new OnlineStand(true, "https://meet.example.org/regel", false), st);
        Assert.Empty(d.OnlineStunden);   // entspricht dem Unterricht: kein Eintrag

        // nicht regelmäßig online: einzelne Stunde online; null entfernt die Abweichung
        OnlineUnterricht.Setzen(u, false, "");
        OnlineUnterricht.StundeSetzen(d, u, tag, e.Stunde, true, "https://meet.example.org/einmal");
        Assert.Equal(new OnlineStand(true, "https://meet.example.org/einmal", true), OnlineUnterricht.Am(d, u, tag, e.Stunde));
        Assert.Equal(OnlineStand.Praesenz, OnlineUnterricht.Am(d, u, tag, e.Stunde + 1));
        OnlineUnterricht.StundeSetzen(d, u, tag, e.Stunde, null, null);
        Assert.Empty(d.OnlineStunden);
        Assert.Throws<ArgumentException>(() => OnlineUnterricht.StundeSetzen(d, u, tag, e.Stunde, true, "javascript:x"));
    }

    [Fact]
    public void Speichern_aeltere_Dateien_und_Rueckgaengig()
    {
        var d = Testdaten.Verplant();
        var tag = Testdaten.Unterrichtstag(d);
        var e = Stunde(d, tag);
        var uid = e.Unterricht!.Id;
        var doc = new Dokument(d, null);

        doc.Aendern("online", AenderungsArt.Unterricht, x => OnlineUnterricht.Setzen(x.Unterrichte.Single(u => u.Id == uid), true, "https://meet.example.org/u"));
        doc.Aendern("Stunde", AenderungsArt.Vertretung, x => OnlineUnterricht.StundeSetzen(x, x.Unterrichte.Single(u => u.Id == uid), tag, e.Stunde, false, null));
        Assert.True(doc.Daten.Unterrichte.Single(u => u.Id == uid).Online);
        Assert.Single(doc.Daten.OnlineStunden);

        // JSON der Schuldatei
        var json = JsonSerializer.Serialize(doc.Daten, Dokument.JsonOptionen);
        var geladen = JsonSerializer.Deserialize<Schuldatei>(json, Dokument.JsonOptionen)!;
        var gu = geladen.Unterrichte.Single(u => u.Id == uid);
        Assert.True(gu.Online);
        Assert.Equal("https://meet.example.org/u", gu.OnlineLink);
        Assert.False(OnlineUnterricht.Am(geladen, gu, tag, e.Stunde).Online);

        // ältere Datei ohne die Felder: nicht online
        var alt = System.Text.Json.Nodes.JsonNode.Parse(json)!.AsObject();
        alt.Remove("OnlineStunden");
        foreach (var p in alt["Perioden"]!.AsArray())
            foreach (var u in p!["Unterrichte"]!.AsArray()) { u!.AsObject().Remove("Online"); u.AsObject().Remove("OnlineLink"); }
        var aelter = JsonSerializer.Deserialize<Schuldatei>(alt.ToJsonString(), Dokument.JsonOptionen)!;
        Assert.Empty(aelter.OnlineStunden);
        Assert.All(aelter.AlleUnterrichte, u => { Assert.False(u.Online); Assert.Equal("", u.OnlineLink); });

        // Rückgängig/Wiederholen
        doc.Rueckgaengig();
        Assert.Empty(doc.Daten.OnlineStunden);
        doc.Rueckgaengig();
        Assert.False(doc.Daten.Unterrichte.Single(u => u.Id == uid).Online);
        doc.Wiederholen();
        Assert.True(doc.Daten.Unterrichte.Single(u => u.Id == uid).Online);

        // Kopie (z. B. Unterricht kopieren, neue Periode) übernimmt die Einstellung
        var k = doc.Daten.Unterrichte.Single(u => u.Id == uid).Kopie(999);
        Assert.True(k.Online);
        Assert.Equal("https://meet.example.org/u", k.OnlineLink);
    }

    [Fact]
    public void Export_an_UntPlanWeb_je_Unterricht_und_Stunde()
    {
        var d = Testdaten.Verplant();
        var tag = Testdaten.Unterrichtstag(d);
        var e = Stunde(d, tag);
        var u = e.Unterricht!;
        var iso = tag.ToString("yyyy-MM-dd");
        OnlineUnterricht.Setzen(u, true, "https://meet.example.org/regel");
        OnlineUnterricht.StundeSetzen(d, u, tag, e.Stunde, false, null);
        var andere = Tagesplan.Berechnen(d, tag).Eintraege.First(x => x.Regel != null && x.Status == TagesStatus.Regulaer && x.Unterricht!.Id != u.Id);
        OnlineUnterricht.StundeSetzen(d, andere.Unterricht!, tag, andere.Stunde, true, "https://meet.example.org/einmal");

        var p = UntPlanWebExport.PaketErstellen(d, tag, new WebExportOptionen { TageVoraus = 7 });
        var wu = p.Perioden.SelectMany(x => x.Unterricht).First(x => x.Id == u.Id);
        Assert.True(wu.Online);
        Assert.Equal("https://meet.example.org/regel", wu.OnlineLink);
        Assert.False(p.Perioden.SelectMany(x => x.Unterricht).First(x => x.Id == andere.Unterricht!.Id).Online);

        WebStunde Ws(WebPaket pk, int unterricht, int stunde) => pk.Tage.Single(t => t.Datum == iso).Stunden.First(s => s.Unterricht == unterricht && s.Stunde == stunde);
        Assert.False(Ws(p, u.Id, e.Stunde).Online);
        Assert.Equal("", Ws(p, u.Id, e.Stunde).OnlineLink);
        Assert.True(Ws(p, andere.Unterricht!.Id, andere.Stunde).Online);
        Assert.Equal("https://meet.example.org/einmal", Ws(p, andere.Unterricht!.Id, andere.Stunde).OnlineLink);
        // an einem anderen Tag gilt der Unterricht
        var spaeter = p.Tage.Where(t => t.Datum != iso).SelectMany(t => t.Stunden).FirstOrDefault(s => s.Unterricht == u.Id && s.Status == "regulaer");
        if (spaeter != null) Assert.True(spaeter.Online);

        // nur Vertretungen: Stunden mit abweichendem Online-Stand stehen als geänderte Stunden im Tag
        var nur = UntPlanWebExport.PaketErstellen(d, tag, new WebExportOptionen { TageVoraus = 7, Teile = { WebTeile.Vertretungen } });
        var tagNur = nur.Tage.Single(t => t.Datum == iso);
        Assert.True(tagNur.NurAenderungen);
        Assert.Contains(tagNur.Stunden, s => s.Unterricht == u.Id && s.Stunde == e.Stunde && !s.Online && s.Status == "regulaer");
        Assert.Contains(tagNur.Stunden, s => s.Unterricht == andere.Unterricht!.Id && s.Stunde == andere.Stunde && s.Online);

        // JSON: Felder online/onlineLink (camelCase)
        var json = UntPlanWebExport.Json(p);
        Assert.Contains("\"online\":true", json);
        Assert.Contains("\"onlineLink\":\"https://meet.example.org/einmal\"", json);
        var gelesen = UntPlanWebExport.Lesen(json)!;
        Assert.True(gelesen.Perioden.SelectMany(x => x.Unterricht).First(x => x.Id == u.Id).Online);
        // ältere Pakete ohne die Felder: nicht online
        var aelter = UntPlanWebExport.Lesen(json.Replace("\"online\":true", "\"x\":true"))!;
        Assert.All(aelter.Tage.SelectMany(t => t.Stunden), s => Assert.False(s.Online));
    }

    [Fact]
    public void Geloeschter_Unterricht_entfernt_seine_Abweichungen()
    {
        var d = Testdaten.Verplant();
        var tag = Testdaten.Unterrichtstag(d);
        var e = Stunde(d, tag);
        OnlineUnterricht.StundeSetzen(d, e.Unterricht!, tag, e.Stunde, true, "https://meet.example.org/x");
        Assert.Single(d.OnlineStunden);
        foreach (var p in d.Perioden) p.Unterrichte?.RemoveAll(u => u.Id == e.Unterricht!.Id && p.Id != d.AktivePeriode.Id);
        Stammdaten.UnterrichtLoeschen(d, e.Unterricht!.Id);
        Assert.Empty(d.OnlineStunden);
    }
}
