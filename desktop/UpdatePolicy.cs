using System.Diagnostics;
using System.Net;
using System.Reflection.PortableExecutable;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace NetworkDiagramStudio;

internal sealed record Release(string Tag, string Digest, long Size, string Notes);
internal sealed record FeedCache(string? ETag, string Body, DateTimeOffset Next);

internal static class Policy
{
    internal const string Repo = "TechSavage1989/NetworkDiagramStudio";
    internal const string Asset = "NetworkDiagramStudio.exe";
    internal const long MaxExe = 240L * 1024 * 1024;
    internal static readonly Uri Feed = new($"https://api.github.com/repos/{Repo}/releases?per_page=20");
    internal static readonly string Home = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "NetworkDiagramStudio");
    internal static readonly string Current = typeof(Policy).Assembly.GetCustomAttributes(typeof(System.Reflection.AssemblyInformationalVersionAttribute), false)
        .Cast<System.Reflection.AssemblyInformationalVersionAttribute>().Single().InformationalVersion.Split('+')[0];
    static readonly Regex Tag = new(@"^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-preview\.(0|[1-9]\d*))?$", RegexOptions.CultureInvariant);
    internal static (Version Core, int Preview)? Parse(string tag)
    {
        var m = Tag.Match(tag);
        if (!m.Success || !Version.TryParse($"{m.Groups[1]}.{m.Groups[2]}.{m.Groups[3]}", out var core)) return null;
        if (!m.Groups[4].Success) return (core, int.MaxValue);
        return int.TryParse(m.Groups[4].Value, out var n) && n < int.MaxValue ? (core, n) : null;
    }
    internal static Uri AssetUri(string tag)
    {
        if (Parse(tag) == null) throw new InvalidDataException("Invalid release tag.");
        return new Uri($"https://github.com/{Repo}/releases/download/{tag}/{Asset}");
    }
    internal static Release? Select(string json, string installed)
    {
        var current = Parse("v" + installed) ?? throw new InvalidDataException("Invalid installed version.");
        using var doc = JsonDocument.Parse(json);
        Release? best = null;
        foreach (var item in doc.RootElement.EnumerateArray())
        {
            if (item.GetProperty("draft").GetBoolean()) continue;
            var tag = item.GetProperty("tag_name").GetString() ?? "";
            var version = Parse(tag);
            if (version == null || version.Value.CompareTo(current) <= 0) continue;
            if (current.Preview == int.MaxValue && version.Value.Preview != int.MaxValue) continue;
            if (best != null && version.Value.CompareTo(Parse(best.Tag)!.Value) <= 0) continue;
            var assets = item.GetProperty("assets").EnumerateArray().Where(a => a.GetProperty("name").GetString() == Asset).ToArray();
            if (assets.Length != 1) continue;
            var a = assets[0];
            var digest = a.TryGetProperty("digest", out var d) ? d.GetString() : null;
            var size = a.GetProperty("size").GetInt64();
            if (a.GetProperty("browser_download_url").GetString() != AssetUri(tag).AbsoluteUri ||
                digest == null || !Regex.IsMatch(digest, "^sha256:[0-9a-f]{64}$") || size <= 0 || size > MaxExe)
                throw new InvalidDataException("The release contains an invalid Windows asset or lacks its GitHub SHA-256 digest.");
            best = new(tag, digest[7..], size, item.TryGetProperty("body", out var b) ? b.GetString() ?? "" : "");
        }
        return best;
    }
    internal static bool SafeRedirect(Uri url) => url.Scheme == "https" && url.IsDefaultPort && url.UserInfo == "" &&
        url.Host is "release-assets.githubusercontent.com" or "objects.githubusercontent.com" or "github-releases.githubusercontent.com";
    internal static void Verify(string file, Release release)
    {
        using var stream = File.OpenRead(file);
        if (stream.Length != release.Size || stream.Length > MaxExe || !Convert.ToHexString(SHA256.HashData(stream)).Equals(release.Digest, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("The download failed SHA-256 or size verification.");
        stream.Position = 0;
        using var pe = new PEReader(stream);
        if (pe.PEHeaders.CoffHeader.Machine != Machine.Amd64 || pe.PEHeaders.PEHeader?.Subsystem != Subsystem.WindowsGui)
            throw new InvalidDataException("This asset is not a Windows x64 desktop executable.");
        var vi = FileVersionInfo.GetVersionInfo(file);
        if (vi.ProductName != "NetworkDiagramStudio" || vi.CompanyName != "TechSavage1989" || vi.ProductVersion?.Split('+')[0] != release.Tag[1..])
            throw new InvalidDataException("The executable identity or version is incorrect.");
    }
}

internal sealed class Updater : IDisposable
{
    readonly HttpClient http;
    readonly string cachePath;
    internal readonly string Staged;
    FeedCache cache = new(null, "", DateTimeOffset.MinValue);
    DateTimeOffset lastAttempt;
    int active, failures;
    internal Release? Offered { get; private set; }
    internal bool Downloaded { get; private set; }
    internal Updater(HttpMessageHandler? handler = null, string? storage = null)
    {
        storage ??= Policy.Home; Directory.CreateDirectory(storage);
        cachePath = Path.Combine(storage, "release-cache.json");
        Staged = Path.Combine(storage, "updates", "candidate.exe");
        http = new HttpClient(handler ?? new HttpClientHandler { AllowAutoRedirect = false }) { Timeout = TimeSpan.FromMinutes(4) };
        http.DefaultRequestHeaders.UserAgent.ParseAdd("NetworkDiagramStudio/" + Policy.Current);
        http.DefaultRequestHeaders.Accept.ParseAdd("application/vnd.github+json");
        try { if (File.Exists(cachePath) && new FileInfo(cachePath).Length < 3_000_000) cache = JsonSerializer.Deserialize<FeedCache>(File.ReadAllText(cachePath)) ?? cache; } catch (Exception e) when (e is IOException or JsonException) { }
    }
    void Save() { File.WriteAllText(cachePath + ".tmp", JsonSerializer.Serialize(cache)); File.Move(cachePath + ".tmp", cachePath, true); }
    internal async Task<string?> Check(TimeSpan cooldown)
    {
        var now = DateTimeOffset.UtcNow;
        if (now < cache.Next) return $"Update checks paused until {cache.Next.LocalDateTime:t}.";
        if (now - lastAttempt < cooldown || Interlocked.Exchange(ref active, 1) != 0) return null;
        lastAttempt = now;
        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Get, Policy.Feed);
            if (cache.Body.Length > 0 && System.Net.Http.Headers.EntityTagHeaderValue.TryParse(cache.ETag, out var etag)) req.Headers.IfNoneMatch.Add(etag);
            using var response = await http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead);
            var next = DateTimeOffset.MinValue;
            if (response.Headers.RetryAfter is { } retry) next = retry.Date ?? now + (retry.Delta ?? TimeSpan.FromMinutes(5));
            if (response.Headers.TryGetValues("X-RateLimit-Remaining", out var remaining) && int.TryParse(remaining.FirstOrDefault(), out var n) && n <= 2 &&
                response.Headers.TryGetValues("X-RateLimit-Reset", out var reset) && long.TryParse(reset.FirstOrDefault(), out var unix))
                next = new[] { next, DateTimeOffset.FromUnixTimeSeconds(unix) }.Max();
            if (response.StatusCode is HttpStatusCode.TooManyRequests or HttpStatusCode.Forbidden) { cache = cache with { Next = next > now ? next : now.AddMinutes(15) }; Save(); return "GitHub limited this check. A later check will retry."; }
            string body = cache.Body;
            if (response.StatusCode != HttpStatusCode.NotModified)
            {
                response.EnsureSuccessStatusCode(); await response.Content.LoadIntoBufferAsync(2_000_000); body = await response.Content.ReadAsStringAsync();
            }
            var release = Policy.Select(body, Policy.Current);
            if (release?.Tag != Offered?.Tag || release?.Digest != Offered?.Digest) Downloaded = false;
            Offered = release;
            cache = new(response.Headers.ETag?.ToString() ?? (response.StatusCode == HttpStatusCode.NotModified ? cache.ETag : null), body, next);
            Save(); failures = 0;
            return release == null ? $"Installed {Policy.Current}. No newer release found." : $"Installed {Policy.Current}  |  Available {release.Tag[1..]}";
        }
        catch (Exception e) when (e is HttpRequestException or IOException or InvalidOperationException or JsonException or TaskCanceledException or KeyNotFoundException or ArgumentException)
        {
            cache = cache with { Next = now.AddMinutes(Math.Min(60, 1 << Math.Min(++failures, 6))) }; Save();
            return $"Could not check for updates. {e.Message}";
        }
        finally { Volatile.Write(ref active, 0); }
    }
    internal async Task Download(IProgress<int> progress)
    {
        var release = Offered ?? throw new InvalidOperationException("Check for updates first.");
        if (Interlocked.Exchange(ref active, 1) != 0) throw new InvalidOperationException("An update operation is already running.");
        Directory.CreateDirectory(Path.GetDirectoryName(Staged)!);
        string work = Staged + ".partial";
        try
        {
            Uri url = Policy.AssetUri(release.Tag);
            for (int hop = 0; hop < 4; hop++)
            {
                using var response = await http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead);
                if ((int)response.StatusCode is >= 300 and < 400)
                {
                    if (response.Headers.Location is not { IsAbsoluteUri:true } redir || !Policy.SafeRedirect(redir)) throw new InvalidDataException("Unexpected download redirect.");
                    url = redir; continue;
                }
                response.EnsureSuccessStatusCode();
                await using (var source = await response.Content.ReadAsStreamAsync())
                await using (var dest = new FileStream(work, FileMode.Create, FileAccess.Write, FileShare.None, 65536, true))
                {
                    byte[] buffer = new byte[65536]; long count = 0; int read;
                    using var deadline = new CancellationTokenSource(TimeSpan.FromMinutes(5));
                    while ((read = await source.ReadAsync(buffer, deadline.Token)) > 0)
                    {
                        count += read; if (count > release.Size) throw new InvalidDataException("Unexpected download size.");
                        await dest.WriteAsync(buffer.AsMemory(0, read), deadline.Token); progress.Report((int)(100 * count / release.Size));
                    }
                }
                await Task.Run(() => Policy.Verify(work, release)); File.Move(work, Staged, true); Downloaded = true; return;
            }
            throw new InvalidDataException("Too many download redirects.");
        }
        finally { if (File.Exists(work)) File.Delete(work); Volatile.Write(ref active, 0); }
    }
    public void Dispose() => http.Dispose();
}
