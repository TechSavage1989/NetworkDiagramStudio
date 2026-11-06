using NetworkDiagramStudio;
using System.Security.Cryptography;
using System.Text.Json;

static void Test(bool ok) { if (!ok) throw new Exception("Policy test failed."); }
static void Reject(Action f) { try { f(); } catch (InvalidDataException) { return; } throw new Exception("Expected rejection."); }
var tag="v0.1.1-preview.1";
var hash=new string('a',64);
string Feed(string url,string digest,long size=10) => JsonSerializer.Serialize(new[]{new {draft=false,tag_name=tag,body="Test",assets=new[]{new{name=Policy.Asset,browser_download_url=url,digest,size}}}});
var good=Feed(Policy.AssetUri(tag).ToString(),"sha256:"+hash);
Test(Policy.Select(good,"0.1.0-preview.1")?.Tag==tag);
Test(Policy.Select(good,"0.1.1")==null && Policy.Select(good,"0.1.0")==null);
Test(Policy.Select(good,"0.1.1-preview.1")==null);
Test(Policy.LatestPublished(good,"0.1.2-preview.1")==tag);
Test(Policy.LatestPublished(good,"0.1.0")==null);
Test(Policy.Parse("v0.1.1-preview.2")!.Value.CompareTo(Policy.Parse("v0.1.1-preview.10")!.Value)<0);
Reject(()=>Policy.Select(Feed("https://example.com/app.exe","sha256:"+hash),"0.1.0-preview.1"));
Reject(()=>Policy.Select(Feed(Policy.AssetUri(tag).ToString(),"md5:"+hash),"0.1.0-preview.1"));
Reject(()=>Policy.Select(Feed(Policy.AssetUri(tag).ToString(),"sha256:"+hash,Policy.MaxExe+1),"0.1.0-preview.1"));
foreach(var candidate in new[]{"http://release-assets.githubusercontent.com/x","https://release-assets.githubusercontent.com.evil.test/x","https://user@objects.githubusercontent.com/x","https://objects.githubusercontent.com:8000/x"}) Test(!Policy.SafeRedirect(new Uri(candidate)));
Test(Policy.SafeRedirect(new Uri("https://release-assets.githubusercontent.com/file")));
if(args.Length==2){ var path=args[0];var release=new Release(args[1], Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(path))).ToLowerInvariant(),new FileInfo(path).Length,""); Policy.Verify(path,release); Reject(()=>Policy.Verify(path,release with{Digest=hash}));Reject(()=>Policy.Verify(path,release with{Tag="v9.9.9"})); }
Console.WriteLine("Release policy, version ordering, allowlists, digest, size and binary identity tests passed.");

var tmp=Path.Combine(Path.GetTempPath(),Guid.NewGuid().ToString("N"));
try {
    int calls=0;
    using var client=new Updater(new FakeHandler(req=>{
        calls++;
        if(calls==2){Test(req.Headers.IfNoneMatch.Single().Tag=="\"one\"");return new System.Net.Http.HttpResponseMessage(System.Net.HttpStatusCode.NotModified);}
        if(calls==3){var limited=new HttpResponseMessage(System.Net.HttpStatusCode.TooManyRequests);limited.Headers.RetryAfter=new System.Net.Http.Headers.RetryConditionHeaderValue(TimeSpan.FromSeconds(90));return limited;}
        var response=new HttpResponseMessage(System.Net.HttpStatusCode.OK){Content=new StringContent("[]")};response.Headers.ETag=new System.Net.Http.Headers.EntityTagHeaderValue("\"one\"");return response;
    }),tmp);
    Test((await client.Check(TimeSpan.Zero))!.Contains("No newer release"));
    Test(client.Report.Contains(Policy.Feed.ToString()) && client.Report.Contains(Policy.Current) && client.Report.Contains("200 OK") && File.ReadAllText(Path.Combine(tmp,"last-update-check.txt")).Contains("No newer release"));
    Test(await client.Check(TimeSpan.FromSeconds(30))==null && calls==1);
    Test((await client.Check(TimeSpan.Zero))!.Contains("No newer release"));
    Test((await client.Check(TimeSpan.Zero))!.Contains("limited"));
    Test((await client.Check(TimeSpan.Zero))!.Contains("paused") && calls==3);
    Test((await client.Check(TimeSpan.Zero,true))!.Contains("paused") && calls==3);
    using var fail=new Updater(new FakeHandler(_=>throw new HttpRequestException("offline")),Path.Combine(tmp,"offline"));
    Test((await fail.Check(TimeSpan.Zero))!.Contains("Could not check"));
    int retries=0;
    using var recover=new Updater(new FakeHandler(_=>{
        if(++retries==1)throw new HttpRequestException("offline");
        return new HttpResponseMessage(System.Net.HttpStatusCode.OK){Content=new StringContent("[]")};
    }),Path.Combine(tmp,"recover"));
    Test((await recover.Check(TimeSpan.Zero))!.Contains("Could not check"));
    Test((await recover.Check(TimeSpan.Zero))!.Contains("paused") && retries==1);
    Test((await recover.Check(TimeSpan.Zero,true))!.Contains("No newer release") && retries==2);
    using var ahead=new Updater(new FakeHandler(_=>new HttpResponseMessage(System.Net.HttpStatusCode.OK){Content=new StringContent(good.Replace(tag,"v0.0.1"))}),Path.Combine(tmp,"ahead"));
    Test((await ahead.Check(TimeSpan.Zero))!.Contains("ahead of the published feed") && ahead.Report.Contains("Latest published 0.0.1"));
    Console.WriteLine("ETag, 304 cache reuse, offline status, cooldown and Retry-After tests passed.");
} finally{if(Directory.Exists(tmp))Directory.Delete(tmp,true);}
sealed class FakeHandler(Func<HttpRequestMessage,HttpResponseMessage> send) : HttpMessageHandler {
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken token)=>Task.FromResult(send(request));
}
