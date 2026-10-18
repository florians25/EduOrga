using System.Net.Http.Headers;
using System.Reflection;
using System.Text.Json;
using System.Text.RegularExpressions;

// Gemeinsame Update-Prüfung von UntPlanWeb, UntPlanMobile, UntPlan Studio und UntPlan Desktop: die anderen Programme binden diese
// Datei ein (siehe UntPlanMobile.csproj, UntPlanStudio.csproj bzw. UntPlan.App.csproj, Konstanten UNTPLANMOBILE / UNTPLANSTUDIO /
// UNTPLANDESKTOP), damit alle dieselbe Logik verwenden, die Typen aber getrennt bleiben.
#if UNTPLANMOBILE
namespace UntPlanMobile.Dienste;
#elif UNTPLANSTUDIO
namespace UntPlanStudio.Dienste;
#elif UNTPLANDESKTOP
namespace UntPlan.App.Update;
#else
namespace UntPlanWeb.Dienste;
#endif

/// <summary>
/// Ergebnis der Prüfung: laufende Version, neueste Version der Quelle und ob ein Update verfügbar ist; bei GitHub-Releases
/// zusätzlich Name, Veröffentlichungszeit und Versionshinweise (Markdown, gekürzt).
/// </summary>
public sealed record Updatestand(
    string Version,
    bool PruefungAktiv,
    string? Neueste,
    bool UpdateVerfuegbar,
    string? Hinweisurl,
    string Quelle,
    DateTime? Geprueft,
    string? Fehler,
    string? ReleaseName = null,
    DateTime? Veroeffentlicht = null,
    string? Hinweise = null);

/// <summary>Eine gefundene Version der Quelle (bei GitHub-Releases mit Name, Zeitpunkt und Versionshinweisen).</summary>
public sealed record Releaseinfo(string Version, string? Url, string? Name = null, DateTime? Veroeffentlicht = null, string? Hinweise = null);

/// <summary>
/// Fragt die neueste veröffentlichte Version ab und vergleicht sie mit der laufenden. Quellen (<c>…_UPDATE_URL</c>):
/// <list type="bullet">
/// <item>GitHub-API: <c>https://api.github.com/repos/florians25/UntPlanNext/releases/latest</c> (Standard), <c>…/releases</c> oder <c>…/tags</c>.</item>
/// <item>Container-Registry: <c>ghcr://florians25/untplannext-web</c> – Tags des (öffentlichen) Images, passt genau zu <c>docker compose pull</c>.</item>
/// <item>Eigene Adresse mit JSON <c>{"version":"1.2.3","url":"…"}</c> oder reinem Text <c>1.2.3</c>.</item>
/// </list>
/// Entwürfe und Vorabversionen (<c>draft</c>/<c>prerelease</c>) werden ignoriert; aus dem Tag zählt die erste Versionsnummer
/// (<c>v1.5.0</c>, <c>studio-v1.5.0</c> → 1.5.0). Ergebnisse werden zwischengespeichert (Standard 6 Stunden, Fehler 15 Minuten).
/// Netzwerk- und Formatfehler führen nie zu einer Ausnahme, sondern zu einem Stand ohne Updatehinweis (mit <c>Fehler</c>).
/// </summary>
public sealed class Updatepruefung
{
    public const string StandardUrl = "https://api.github.com/repos/florians25/UntPlanNext/releases/latest";
    /// <summary>Versionshinweise werden auf so viele Zeichen gekürzt.</summary>
    public const int HinweiseMaxLaenge = 4000;

    private readonly HttpClient _http;
    private readonly SemaphoreSlim _sperre = new(1, 1);
    private Updatestand? _letzter;
    private DateTime _gueltigBis;

    public string Version { get; }
    public string Url { get; }
    public bool Aktiv { get; }
    public string TagPraefix { get; }
    public TimeSpan Intervall { get; }

    public Updatepruefung(HttpClient http, Assembly programm, string? url, bool aktiv, string? tagPraefix = null, TimeSpan? intervall = null)
    {
        _http = http;
        Version = VersionVon(programm);
        Url = string.IsNullOrWhiteSpace(url) ? StandardUrl : url.Trim();
        Aktiv = aktiv;
        TagPraefix = tagPraefix?.Trim() ?? "";
        Intervall = intervall ?? TimeSpan.FromHours(6);
        // GitHub verlangt einen User-Agent; Proxy-Einstellungen (HTTPS_PROXY) übernimmt der Standard-Handler der HttpClientFactory
        if (!_http.DefaultRequestHeaders.UserAgent.Any())
            _http.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue(programm.GetName().Name ?? "UntPlan", Version));
    }

    /// <summary>Version des laufenden Programms (InformationalVersion ohne Commit-Anhang, z. B. 1.0.57).</summary>
    public static string VersionVon(Assembly a)
    {
        var info = a.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
        if (!string.IsNullOrEmpty(info)) return info.Split('+')[0];
        return a.GetName().Version?.ToString(3) ?? "0.0.0";
    }

    public static bool Schalter(string? wert, bool vorgabe) => (wert ?? "").Trim().ToLowerInvariant() switch
    {
        "" => vorgabe,
        "0" or "false" or "nein" or "aus" or "off" or "no" => false,
        _ => true,
    };

    public async Task<Updatestand> StandAsync(bool erzwingen = false, CancellationToken ct = default)
    {
        if (!Aktiv) return new Updatestand(Version, false, null, false, null, Url, null, null);
        if (!erzwingen && _letzter != null && DateTime.UtcNow < _gueltigBis) return _letzter;
        await _sperre.WaitAsync(ct);
        try
        {
            if (!erzwingen && _letzter != null && DateTime.UtcNow < _gueltigBis) return _letzter;
            try
            {
                var r = await AbfragenAsync(ct);
                var verfuegbar = r != null && Vergleichen(r.Version, Version) > 0;
                _letzter = new Updatestand(Version, true, r?.Version, verfuegbar, r?.Url, Url, DateTime.UtcNow, r == null ? "Keine Versionsangabe gefunden." : null,
                    r?.Name, r?.Veroeffentlicht, r?.Hinweise);
                _gueltigBis = DateTime.UtcNow + Intervall;
            }
            // jede Störung (Netz, Zeitüberschreitung, Proxy, unerwartete Antwort) nur melden – kein Hinweis, kein Absturz
            catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
            {
                _letzter = new Updatestand(Version, true, null, false, null, Url, DateTime.UtcNow, "Prüfung fehlgeschlagen: " + ex.Message);
                _gueltigBis = DateTime.UtcNow + TimeSpan.FromMinutes(15);
            }
            return _letzter;
        }
        finally { _sperre.Release(); }
    }

    private async Task<Releaseinfo?> AbfragenAsync(CancellationToken ct)
    {
        using var zeit = CancellationTokenSource.CreateLinkedTokenSource(ct);
        zeit.CancelAfter(TimeSpan.FromSeconds(10));
        if (Url.StartsWith("ghcr://", StringComparison.OrdinalIgnoreCase))
        {
            var repo = Url["ghcr://".Length..].Trim('/');
            using var tokenAntwort = await _http.GetAsync($"https://ghcr.io/token?scope=repository:{repo}:pull&service=ghcr.io", zeit.Token);
            tokenAntwort.EnsureSuccessStatusCode();
            using var tokenJson = JsonDocument.Parse(await tokenAntwort.Content.ReadAsStringAsync(zeit.Token));
            var token = tokenJson.RootElement.GetProperty("token").GetString();
            // Die Registry liefert ohne n= nur die ersten 100 Tags (lexikografisch) – neuere Versionen fehlten dann. Daher große
            // Seiten anfordern und dem Link-Kopf („rel=next“) folgen.
            var alle = new List<string>();
            var adresse = $"https://ghcr.io/v2/{repo}/tags/list?n=1000";
            for (var seite = 0; seite < 20 && adresse != null; seite++)
            {
                using var anfrage = new HttpRequestMessage(HttpMethod.Get, adresse);
                anfrage.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
                using var tags = await _http.SendAsync(anfrage, zeit.Token);
                tags.EnsureSuccessStatusCode();
                using var json = JsonDocument.Parse(await tags.Content.ReadAsStringAsync(zeit.Token));
                if (json.RootElement.TryGetProperty("tags", out var liste) && liste.ValueKind == JsonValueKind.Array)
                    alle.AddRange(liste.EnumerateArray().Where(t => t.ValueKind == JsonValueKind.String).Select(t => t.GetString()!));
                adresse = NaechsteSeite(tags.Headers.TryGetValues("Link", out var link) ? link.FirstOrDefault() : null);
            }
            var r = ReleaseAuswerten(JsonSerializer.Serialize(new { tags = alle }), TagPraefix);
            return r is null ? null : r with { Url = $"https://ghcr.io/{repo}" };
        }
        using var abfrage = new HttpRequestMessage(HttpMethod.Get, Url);
        if (abfrage.RequestUri!.Host.Equals("api.github.com", StringComparison.OrdinalIgnoreCase))
            abfrage.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
        using var antwort = await _http.SendAsync(abfrage, zeit.Token);
        antwort.EnsureSuccessStatusCode();
        return ReleaseAuswerten(await antwort.Content.ReadAsStringAsync(zeit.Token), TagPraefix);
    }

    /// <summary>Nächste Seite aus dem Link-Kopf der Registry (<c>&lt;/v2/…/tags/list?last=…&amp;n=…&gt;; rel="next"</c>), sonst null.</summary>
    public static string? NaechsteSeite(string? link)
    {
        if (string.IsNullOrEmpty(link)) return null;
        var m = Regex.Match(link, "<([^>]+)>\\s*;\\s*rel=\"?next\"?", RegexOptions.IgnoreCase);
        if (!m.Success) return null;
        var ziel = m.Groups[1].Value;
        return ziel.StartsWith("http", StringComparison.OrdinalIgnoreCase) ? ziel : "https://ghcr.io" + (ziel.StartsWith('/') ? "" : "/") + ziel;
    }

    private static readonly Regex VersionMuster = new(@"(\d+)\.(\d+)(?:\.(\d+))?(?:\.(\d+))?", RegexOptions.Compiled);

    /// <summary>Erste Versionsnummer in einem Text („v1.2.3“, „untplanweb-1.0.57“ → „1.2.3“, „1.0.57“).</summary>
    public static string? VersionAus(string? text) => text is null ? null : VersionMuster.Match(text) is { Success: true } m ? m.Value : null;

    /// <summary>Versionen vergleichen (fehlende Stellen zählen als 0).</summary>
    public static int Vergleichen(string a, string b)
    {
        static Version V(string s)
        {
            var t = (VersionAus(s) ?? "0.0").Split('.').Select(z => int.TryParse(z, out var n) ? n : int.MaxValue).Concat(new[] { 0, 0, 0 }).Take(4).ToArray();
            return new Version(t[0], t[1], t[2], t[3]);
        }
        return V(a).CompareTo(V(b));
    }

    /// <summary>Antwort der Quelle auswerten: GitHub-Release(s), Tags, Registry-Tags, eigenes JSON oder reiner Text.</summary>
    public static (string? Version, string? Url) Auswerten(string text, string praefix = "") =>
        ReleaseAuswerten(text, praefix) is { } r ? (r.Version, r.Url) : (null, null);

    /// <summary>Wie <see cref="Auswerten"/>, aber mit Name, Veröffentlichung und Versionshinweisen (<c>body</c>) eines GitHub-Releases.</summary>
    public static Releaseinfo? ReleaseAuswerten(string text, string praefix = "")
    {
        text = text.Trim();
        praefix ??= "";
        bool Passt(string? tag) => tag != null && (praefix.Length == 0 || tag.StartsWith(praefix, StringComparison.OrdinalIgnoreCase)) && VersionAus(tag[praefix.Length..]) != null;
        string? Ver(string tag) => VersionAus(tag[praefix.Length..]);
        if (!text.StartsWith('{') && !text.StartsWith('[')) return Passt(text) ? new Releaseinfo(Ver(text)!, null) : null;

        using var doc = JsonDocument.Parse(text);
        var r = doc.RootElement;
        var kandidaten = new List<Releaseinfo>();
        void Element(JsonElement e)
        {
            if (e.ValueKind == JsonValueKind.String) { if (Passt(e.GetString())) kandidaten.Add(new Releaseinfo(Ver(e.GetString()!)!, null)); return; }
            if (e.ValueKind != JsonValueKind.Object) return;
            if (e.TryGetProperty("draft", out var d) && d.ValueKind == JsonValueKind.True) return;
            if (e.TryGetProperty("prerelease", out var p) && p.ValueKind == JsonValueKind.True) return;
            var tag = Str(e, "tag_name") ?? Str(e, "version") ?? Str(e, "name");
            if (!Passt(tag)) return;
            DateTime? zeit = Str(e, "published_at") is { } z && DateTime.TryParse(z, System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.AdjustToUniversal | System.Globalization.DateTimeStyles.AssumeUniversal, out var t) ? t : null;
            var name = Str(e, "tag_name") != null ? Str(e, "name") : null;
            kandidaten.Add(new Releaseinfo(Ver(tag!)!, Str(e, "html_url") ?? Str(e, "url"), string.IsNullOrWhiteSpace(name) ? null : name.Trim(), zeit,
                Kuerzen(Str(e, "body") ?? Str(e, "hinweise"))));
        }
        if (r.ValueKind == JsonValueKind.Array) foreach (var e in r.EnumerateArray()) Element(e);
        else if (r.TryGetProperty("tags", out var tags) && tags.ValueKind == JsonValueKind.Array) foreach (var e in tags.EnumerateArray()) Element(e);
        else Element(r);
        return kandidaten.Count == 0 ? null : kandidaten.Aggregate((x, y) => Vergleichen(y.Version, x.Version) > 0 ? y : x);
    }

    /// <summary>Versionshinweise auf <see cref="HinweiseMaxLaenge"/> Zeichen kürzen (an einem Zeilenende, mit Auslassungszeichen).</summary>
    public static string? Kuerzen(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        text = text.Replace("\r\n", "\n").Trim();
        if (text.Length <= HinweiseMaxLaenge) return text;
        var schnitt = text.LastIndexOf('\n', HinweiseMaxLaenge);
        if (schnitt < HinweiseMaxLaenge / 2) schnitt = HinweiseMaxLaenge;
        return text[..schnitt].TrimEnd() + "\n\n…";
    }

    private static string? Str(JsonElement e, string name) => e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
}
