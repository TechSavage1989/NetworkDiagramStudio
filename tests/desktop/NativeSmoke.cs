// Compiled into the test host only. Release binaries cannot redirect their feed.
using System.Diagnostics;
using System.Net;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text.Json;

namespace NetworkDiagramStudio;
internal static class NativeSmoke
{
    sealed class ReleaseFixture(string? path=null) : HttpMessageHandler
    {
        internal List<DateTimeOffset> Checks = [];
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            if (request.RequestUri == Policy.Feed)
            {
                Checks.Add(DateTimeOffset.UtcNow);
                if (path == null) return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK){Content=new StringContent("[]")});
                var ver=FileVersionInfo.GetVersionInfo(path).ProductVersion!.Split('+')[0];
                var tag="v"+ver;using var f=File.OpenRead(path);var digest=Convert.ToHexString(SHA256.HashData(f)).ToLowerInvariant();
                var json=JsonSerializer.Serialize(new[]{new {draft=false,tag_name=tag,body="Native test release",assets=new[]{new{name=Policy.Asset,browser_download_url=Policy.AssetUri(tag).AbsoluteUri,digest="sha256:"+digest,size=f.Length}}}});
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK){Content=new StringContent(json)});
            }
            if (path != null && request.RequestUri == Policy.AssetUri("v"+FileVersionInfo.GetVersionInfo(path).ProductVersion!.Split('+')[0]))
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK){Content=new StreamContent(File.OpenRead(path))});
            throw new InvalidOperationException("Unexpected test URL.");
        }
    }
    internal static int Run(string[] args)
    {
        if (args is ["--test-install", var path])
        {
            using var updater = new Updater(new ReleaseFixture(path));
            updater.Check(TimeSpan.Zero).GetAwaiter().GetResult();
            updater.Download(new Progress<int>()).GetAwaiter().GetResult();
            Installer.Begin(updater.Offered!); return 0;
        }
        if (args is not ["--test-timer", var result]) return 2;
        var fixture = new ReleaseFixture();
        using var ui = new Studio(null,new Updater(fixture,Path.Combine(Path.GetTempPath(),Guid.NewGuid().ToString("N"))));
        int exit = 1;
        ui.Shown += async (_,_) => {
            try {
                // The first eligible activation is >= two minutes after startup;
                // a second immediate activation must not trigger a new request.
                for (int i=0; i<60 && !ui.IsEditorHealthy; i++) await Task.Delay(500);
                if(!ui.IsEditorHealthy) throw new Exception("WebView did not initialize.");
                await ui.ExportAndPrint(Path.GetDirectoryName(result)!);
                var pause=fixture.Checks[0].AddSeconds(125)-DateTimeOffset.UtcNow;
                if(pause>TimeSpan.Zero) await Task.Delay(pause);
                if (!ui.IsEditorHealthy || fixture.Checks.Count != 1) throw new Exception("Startup or WebView health failed.");
                using var other = new Form {Text="Focus test"}; other.Show(); other.Activate(); await Task.Delay(700); ui.Activate(); await Task.Delay(1000);
                if (fixture.Checks.Count != 2) throw new Exception("Returning to focus did not check.");
                other.Activate(); await Task.Delay(500); ui.Activate(); await Task.Delay(500);
                if (fixture.Checks.Count != 2) throw new Exception("Focus cooldown failed.");
                await Task.Delay(183000);
                if(fixture.Checks.Count!=3 || (fixture.Checks[2]-fixture.Checks[0]).TotalSeconds < 294) throw new Exception("Five-minute WinForms timer failed.");
                File.WriteAllText(result,"Native window, local editor, startup, focus, cooldown and five-minute timer passed."); exit=0;
            } catch(Exception e){File.WriteAllText(result,e.ToString());} finally{ui.Close();}
        };
        Application.Run(ui); return exit;
    }
}

internal sealed partial class Studio
{
    internal string? TestOutputFolder;
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr FindWindow(string cls,string caption);
    [DllImport("user32.dll")] static extern bool PostMessage(IntPtr hwnd,uint msg,IntPtr w,IntPtr l);
    internal async Task ExportAndPrint(string folder)
    {
        TestOutputFolder=folder;
        var chooser=Task.Run(async()=>{
            for(int attempt=0; attempt<100; attempt++) {
                var hwnd=FindWindow("#32770","Save exported file");
                if(hwnd!=IntPtr.Zero) { await Task.Delay(400); PostMessage(hwnd,0x0111,(IntPtr)1,IntPtr.Zero); return; }
                await Task.Delay(100);
            }
            throw new Exception("The real Save As dialog was not displayed.");
        });
        await browser.CoreWebView2.ExecuteScriptAsync("document.getElementById('sample').click();document.getElementById('svg').click()");
        await chooser;
        string? saved=null;
        for(int i=0;i<80;i++) { saved=Directory.EnumerateFiles(folder,"*.svg").FirstOrDefault(); if(saved!=null) break; await Task.Delay(125); }
        if(saved==null || !File.ReadAllText(saved).Contains("<svg")) throw new Exception("The selected sample SVG page was not saved.");
        var editorCheck=await browser.CoreWebView2.ExecuteScriptAsync("""
            (() => {
                try {
                    document.querySelector('[aria-label="Up SW-1"]').click();
                    if(document.querySelector('#devices .device-row').dataset.deviceId!=='sw-1') throw Error('Device ordering failed');
                    document.getElementById('arrange').click();
                    [...document.querySelectorAll('#dialog button')].find(b=>b.textContent==='Add core page').click();
                    const name=document.querySelector('[aria-label="Core page name"]');
                    name.value='Native test rack';name.dispatchEvent(new Event('change'));
                    const target=document.querySelector('[aria-label="Core page for SW-1"]');
                    target.value=target.options[target.options.length-1].value;target.dispatchEvent(new Event('change'));
                    if(![...document.querySelectorAll('#tabs button')].some(b=>b.textContent==='Native test rack')) throw Error('Core assignment failed');
                    document.getElementById('close').click();
                    document.getElementById('evidence').click();
                    if(document.getElementById('dialog-title').textContent!=='Imported data') throw Error('Import controls missing');
                    document.getElementById('close').click();
                    return 'ok';
                } catch(e) { return e.message; }
            })()
            """);
        if(editorCheck!="\"ok\"") throw new Exception("Native editor controls: "+editorCheck);
        await browser.CoreWebView2.ExecuteScriptAsync("document.getElementById('print').click()");
        await Printed.Task.WaitAsync(TimeSpan.FromSeconds(30));
    }
    readonly TaskCompletionSource Printed=new(TaskCreationOptions.RunContinuationsAsynchronously);
    async Task PrintTestPages()
    {
        try {
            var sheets=await browser.CoreWebView2.ExecuteScriptAsync("document.querySelectorAll('#print-set section svg').length");
            if(!int.TryParse(sheets,out int count) || count<5) throw new Exception("The sample print set is incomplete.");
            var pdf=Path.Combine(TestOutputFolder!,"native-print.pdf");
            if(!await browser.CoreWebView2.PrintToPdfAsync(pdf) || new FileInfo(pdf).Length<4000) throw new Exception("WebView print-to-PDF failed.");
            Printed.TrySetResult();
        } catch(Exception e) { Printed.TrySetException(e); }
    }
}
