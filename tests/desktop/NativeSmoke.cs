// Compiled into the test host only. Release binaries cannot redirect their feed.
using System.Diagnostics;
using System.Net;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text.Json;
using System.IO.Compression;
using System.Xml.Linq;
using Microsoft.Web.WebView2.Core;

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
                if(!ui.IsEditorHealthy) throw new Exception("WebView did not initialize.\n"+await ui.EditorStartupDiagnostics());
                await ui.ExportAndPrint(Path.GetDirectoryName(result)!);
                var pause=fixture.Checks[0].AddSeconds(125)-DateTimeOffset.UtcNow;
                if(pause>TimeSpan.Zero) await Task.Delay(pause);
                if (!ui.IsEditorHealthy || fixture.Checks.Count != 1) throw new Exception("Startup or WebView health failed.");
                using var other = new Form {Text="Focus test"}; other.Show(); other.Activate(); await Task.Delay(700); ui.Activate(); await Task.Delay(1000);
                if (fixture.Checks.Count != 2) throw new Exception("Returning to focus did not check.");
                other.Activate(); await Task.Delay(500); ui.Activate(); await Task.Delay(500);
                if (fixture.Checks.Count != 2) throw new Exception("Focus cooldown failed.");
                if (!ui.UpdateProgressIsIdle) throw new Exception("A skipped focus check left stale update progress.");
                await Task.Delay(183000);
                if(fixture.Checks.Count!=3 || (fixture.Checks[2]-fixture.Checks[0]).TotalSeconds < 294) throw new Exception("Five-minute WinForms timer failed.");
                await ui.CheckUpdateButton();
                if(fixture.Checks.Count!=4) throw new Exception("The manual update button did not request a fresh check.");
                File.WriteAllText(result,"Native window, local editor, startup, focus, cooldown and five-minute timer passed."); exit=0;
            } catch(Exception e){File.WriteAllText(result,e.ToString());} finally{ui.Close();}
        };
        Application.Run(ui); return exit;
    }
}

internal sealed partial class Studio
{
    readonly List<string> editorStartupEvents=[];
    readonly List<CoreWebView2DevToolsProtocolEventReceiver> editorStartupReceivers=[];
    void RecordEditorStartup(string message)
    {
        if(editorStartupEvents.Count>=24)return;
        var entry=DateTimeOffset.UtcNow.ToString("O")+" "+message[..Math.Min(message.Length,2500)];
        editorStartupEvents.Add(entry);
        try{var path=Environment.GetEnvironmentVariable("NDS_TEST_ERROR_LOG");if(!string.IsNullOrEmpty(path))File.AppendAllText(path,entry+Environment.NewLine);}catch{ }
    }
    async Task CaptureEditorStartupDiagnostics(CoreWebView2 core)
    {
        try{
            foreach(var name in new[]{"Runtime.exceptionThrown","Log.entryAdded"}){var receiver=core.GetDevToolsProtocolEventReceiver(name);editorStartupReceivers.Add(receiver);receiver.DevToolsProtocolEventReceived+=(_,e)=>RecordEditorStartup(name+" "+e.ParameterObjectAsJson);}
            core.NavigationCompleted+=(_,e)=>RecordEditorStartup($"Navigation completed: success={e.IsSuccess}, error={e.WebErrorStatus}, source={core.Source}");
            core.ProcessFailed+=(_,e)=>RecordEditorStartup("WebView process failed: "+e.ProcessFailedKind);
            core.WebResourceResponseReceived+=(_,e)=>{try{if(e.Response.StatusCode>=400)RecordEditorStartup($"Resource failed: {e.Response.StatusCode} {e.Request.Uri}");}catch(Exception error){RecordEditorStartup("Resource diagnostic: "+error.Message);}};
            foreach(var method in new[]{"Runtime.enable","Log.enable"})try{await core.CallDevToolsProtocolMethodAsync(method,"{}").WaitAsync(TimeSpan.FromSeconds(3));}catch(Exception error){RecordEditorStartup(method+": "+error.Message);}
        }catch(Exception error){RecordEditorStartup("Startup diagnostic setup: "+error.Message);}
    }
    internal async Task<string> EditorStartupDiagnostics()
    {
        var report=new List<string>{$"Host: status={status.Text}, loaded={loaded}, ready={ready}, healthy={healthy}, visible={Visible}, window={WindowState}"};
        try{report.Add("Source: "+browser.Source);var core=browser.CoreWebView2;if(core==null)report.Add("CoreWebView2: unavailable");else{report.Add("Runtime: "+core.Environment.BrowserVersionString);report.Add("DOM: "+await core.ExecuteScriptAsync("JSON.stringify({state:document.readyState,url:location.href,bridge:!!window.NDSDesktop,readyFunction:typeof window.NDSDesktop?.ready,scripts:[...document.scripts].map(s=>s.src).filter(Boolean),resources:performance.getEntriesByType('resource').slice(0,100).map(r=>({url:r.name.slice(0,220),type:r.initiatorType,status:r.responseStatus}))})").WaitAsync(TimeSpan.FromSeconds(3)));}}
        catch(Exception error){report.Add("DOM/runtime diagnostic: "+error.Message);}
        report.AddRange(editorStartupEvents);return string.Join(Environment.NewLine,report);
    }
    internal bool UpdateProgressIsIdle => !checking && check.Enabled && !status.Text.StartsWith("Checking for updates",StringComparison.Ordinal);
    internal async Task CheckUpdateButton()
    {
        check.PerformClick();
        for(int i=0;i<100&&checking;i++)await Task.Delay(50);
        if(checking||!check.Enabled||!status.Text.Contains("No newer release"))throw new Exception("Manual update progress or result was not displayed.");
    }
    internal string? TestOutputFolder;
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr FindWindow(string cls,string caption);
    [DllImport("user32.dll")] static extern bool PostMessage(IntPtr hwnd,uint msg,IntPtr w,IntPtr l);
    async Task ClickEditorButton(string id)
    {
        var key=JsonSerializer.Serialize(id);
        var raw=await browser.CoreWebView2.ExecuteScriptAsync($"(() => {{ const b=document.getElementById({key}); if(!b || b.disabled) return null; const r=b.getBoundingClientRect(); return {{x:r.x+r.width/2,y:r.y+r.height/2}}; }})()");
        using var doc=JsonDocument.Parse(raw);
        if(doc.RootElement.ValueKind!=JsonValueKind.Object)throw new Exception("Native export button is unavailable: "+id);
        var x=doc.RootElement.GetProperty("x").GetDouble();var y=doc.RootElement.GetProperty("y").GetDouble();
        // Real input supplies the user gesture required for repeated downloads.
        foreach(var type in new[]{"mousePressed","mouseReleased"})await browser.CoreWebView2.CallDevToolsProtocolMethodAsync("Input.dispatchMouseEvent",JsonSerializer.Serialize(new{type,x,y,button="left",buttons=type=="mousePressed"?1:0,clickCount=1}));
    }
    async Task ClickEditorTarget(string selector,int clicks=1)
    {
        var query=JsonSerializer.Serialize(selector);
        var raw=await browser.CoreWebView2.ExecuteScriptAsync($"(() => {{ const n=document.querySelector({query}); if(!n) return null; n.scrollIntoView({{block:'center',inline:'center'}}); const r=n.getBoundingClientRect(); return {{x:r.x+r.width/2,y:r.y+r.height/2}}; }})()");
        using var doc=JsonDocument.Parse(raw);
        if(doc.RootElement.ValueKind!=JsonValueKind.Object)throw new Exception("Native edit target is unavailable: "+selector);
        var x=doc.RootElement.GetProperty("x").GetDouble();var y=doc.RootElement.GetProperty("y").GetDouble();
        for(int click=1;click<=clicks;click++)foreach(var type in new[]{"mousePressed","mouseReleased"})
            await browser.CoreWebView2.CallDevToolsProtocolMethodAsync("Input.dispatchMouseEvent",JsonSerializer.Serialize(new{type,x,y,button="left",buttons=type=="mousePressed"?1:0,clickCount=click}));
    }
    async Task EditorKey(string key,int code)
    {
        foreach(var type in new[]{"keyDown","keyUp"})await browser.CoreWebView2.CallDevToolsProtocolMethodAsync("Input.dispatchKeyEvent",JsonSerializer.Serialize(new{type,key,windowsVirtualKeyCode=code,nativeVirtualKeyCode=code}));
    }
    async Task RequireEditor(string code,string stage)
    {
        var result=await browser.CoreWebView2.ExecuteScriptAsync("(() => { try { "+code+"; return 'ok'; } catch(e) { return e.message; } })()");
        if(result!="\"ok\"")throw new Exception("Native edit recovery ("+stage+"): "+result);
    }
    async Task CheckEditRecovery()
    {
        const string edge="#canvas text[data-drawing-key=\"Core Network|title|edge\"]",sw="#canvas text[data-drawing-key=\"Core Network|title|sw-1\"]";
        await ClickEditorTarget(edge,2);
        await RequireEditor("const t=document.querySelector('[data-inline-editor] textarea'); if(!t) throw Error('Inline editor missing'); t.value='W'.repeat(600)","enter invalid title");
        await EditorKey("Enter",13);
        await RequireEditor("const t=document.querySelector('[data-inline-editor] textarea'),e=document.querySelector('.inline-text-error'); if(!t?.isConnected||!e?.textContent.trim()||!e.getClientRects().length) throw Error('Rejected edit lost its attached editor or visible error'); const outer=t.closest('[data-inline-editor]').getBoundingClientRect(),inner=e.getBoundingClientRect(); if(inner.top<outer.top-1||inner.bottom>outer.bottom+1) throw Error('Validation error is clipped outside the editor'); t.value='Native repaired title'","reject and correct");
        await EditorKey("Enter",13);
        await RequireEditor("if(document.querySelector('[data-inline-editor]')) throw Error('Corrected editor did not close'); const t=document.querySelector('text[data-drawing-key=\"Core Network|title|edge\"]'); if(!t?.textContent.includes('Native repaired title')) throw Error('Corrected title was not saved')","save corrected title");
        await ClickEditorTarget(sw,2);
        await RequireEditor("const t=document.querySelector('[data-inline-editor] textarea'); if(t?.value!=='SW-1') throw Error('Another item could not be selected and edited'); t.value='Do not keep this'","select another item");
        await EditorKey("Escape",27);
        await RequireEditor("if(document.querySelector('[data-inline-editor]')) throw Error('Cancel did not close the editor'); const t=document.querySelector('text[data-drawing-key=\"Core Network|title|sw-1\"]'); if(!t?.textContent.includes('SW-1')) throw Error('Cancel replaced the original title')","cancel draft");
        await ClickEditorTarget(sw,2);
        await RequireEditor("document.querySelector('[data-inline-editor] textarea').value='W'.repeat(600)","second invalid title");
        await EditorKey("Enter",13);
        await RequireEditor("if(!document.querySelector('[data-inline-editor] textarea')?.isConnected) throw Error('Second rejected editor detached'); document.getElementById('canvas').focus()","focus outside rejected editor");
        await EditorKey("Escape",27);
        await RequireEditor("if(document.querySelector('[data-inline-editor]')) throw Error('Escape outside the editor did not cancel')","outside Escape recovery");
        await ClickEditorTarget("#page-options");
        await RequireEditor("if(!document.getElementById('dialog').open||document.getElementById('dialog-title').textContent!=='Page options') throw Error('Page options remained blocked')","page options after rejection");
        await ClickEditorTarget("#close");
        await ClickEditorTarget(edge,2);
        await RequireEditor("const f=document.querySelector('[data-inline-editor]'); if(!f) throw Error('Detached-session fixture missing'); f.remove()","detach stale editor");
        await ClickEditorTarget("#page-options");
        await RequireEditor("if(!document.getElementById('dialog').open||document.getElementById('dialog-title').textContent!=='Page options') throw Error('A stale detached session blocked page options')","detached session recovery");
        await ClickEditorTarget("#close");
    }
    async Task CheckAddDevice()
    {
        await ClickEditorTarget("#add-device");
        await RequireEditor("const field=title=>[...document.querySelectorAll('#dialog-body label')].find(label=>label.textContent===title)?.control; const name=field('Device name'),kind=field('Device type'),model=field('Model'),platform=field('Platform / technology'); if(!name||!kind||!model||!platform) throw Error('Add device fields missing'); name.value='LAB-HYPERVISOR-NODE-01'; kind.value='hypervisor'; kind.dispatchEvent(new Event('change')); model.value='Dell PowerEdge R750'; model.dispatchEvent(new Event('change')); platform.value='Proxmox VE'; if(kind.value!=='hypervisor') throw Error('Model lookup replaced the selected device type'); const save=[...document.querySelectorAll('#dialog button')].find(button=>button.textContent==='Save device'); if(!save) throw Error('Save device missing'); save.dataset.nativeAddDevice='save'; save.scrollIntoView({block:'center'})","prepare explicit hypervisor");
        await RequireEditor("const field=title=>[...document.querySelectorAll('#dialog-body label')].find(label=>label.textContent===title)?.control; field('Core page').value='new'; const detail=[...document.querySelectorAll('#dialog details')].find(node=>node.querySelector('summary')?.textContent==='Edit ports'); if(!detail) throw Error('Port form missing'); detail.open=true; [...detail.querySelectorAll('button')].find(button=>button.textContent==='Add port').click()","add human-readable port");
        await RequireEditor("const field=title=>[...document.querySelectorAll('#dialog-body label')].find(label=>label.textContent===title)?.control; field('Port name').value='eth0'; field('Description').value='Management'; field('Native VLAN').value='8'; field('Tagged VLANs').value='20, 34'; document.querySelector('[data-native-add-device=save]').scrollIntoView({block:'center'})","fill port form and dedicated page");
        await ClickEditorTarget("[data-native-add-device='save']");
        await RequireEditor("if(document.getElementById('dialog').open) throw Error('Add device did not close'); const row=[...document.querySelectorAll('#devices .device-row')].find(row=>row.textContent.includes('LAB-HYPERVISOR-NODE-01')); if(!row?.textContent.includes('Hypervisor host')||!row.textContent.includes('Dell PowerEdge R750')||!row.querySelector('input[type=checkbox]')?.checked) throw Error('Added hypervisor lost its type, model or scope'); if(!document.querySelector('#canvas>svg')||!document.querySelector('#tabs button')||document.querySelector('#welcome')) throw Error('Add device lost the diagram'); row.querySelector('button[title]').dataset.nativeAddDevice='open'","save added hypervisor");
        await ClickEditorTarget("[data-native-add-device='open']");
        await RequireEditor("if(!document.getElementById('dialog').open||document.getElementById('dialog-title').textContent!=='Device details') throw Error('Device editor did not reopen'); const field=title=>[...document.querySelectorAll('#dialog-body label')].find(label=>label.textContent===title)?.control; if(field('Device type')?.value!=='hypervisor'||field('Model')?.value!=='Dell PowerEdge R750'||field('Platform / technology')?.value!=='Proxmox VE') throw Error('Added device details were not retained')","reopen added hypervisor");
        await RequireEditor("const field=title=>[...document.querySelectorAll('#dialog-body label')].find(label=>label.textContent===title)?.control; if(field('Core page')?.selectedOptions[0]?.textContent!=='LAB-HYPERVISOR-NODE-01') throw Error('Dedicated page was not retained'); if(field('Port name')?.value!=='eth0'||field('Description')?.value!=='Management'||field('Native VLAN')?.value!=='8'||field('Tagged VLANs')?.value!=='20, 34') throw Error('Port form values were not retained')","retained ports and dedicated page");
        await ClickEditorTarget("#close");
        await ClickEditorTarget("#drawing-undo");
        await RequireEditor("if(document.getElementById('devices').textContent.includes('LAB-HYPERVISOR-NODE-01')) throw Error('Undo retained the added device'); if(!document.querySelector('#canvas>svg')||!document.querySelector('#tabs button')||document.querySelector('#welcome')) throw Error('Undo lost the diagram')","undo added hypervisor");
        await ClickEditorTarget("#drawing-redo");
        await RequireEditor("const row=[...document.querySelectorAll('#devices .device-row')].find(row=>row.textContent.includes('LAB-HYPERVISOR-NODE-01')); if(!row?.textContent.includes('Hypervisor host')||!row.querySelector('input[type=checkbox]')?.checked) throw Error('Redo did not restore the scoped hypervisor'); if(!document.querySelector('#canvas>svg')||!document.querySelector('#tabs button')||document.querySelector('#welcome')) throw Error('Redo lost the diagram')","redo added hypervisor");
    }
    internal async Task ExportAndPrint(string folder)
    {
        TestOutputFolder=folder;
        Task ChooseExport(string format) => Task.Run(async()=>{
            for(int attempt=0; attempt<100; attempt++) {
                var hwnd=FindWindow("#32770","Save exported file");
                if(hwnd!=IntPtr.Zero) { await Task.Delay(400); PostMessage(hwnd,0x0111,(IntPtr)1,IntPtr.Zero); return; }
                await Task.Delay(100);
            }
            throw new Exception("The real Save As dialog was not displayed for "+format+".");
        });
        var chooser=ChooseExport("SVG");
        await browser.CoreWebView2.ExecuteScriptAsync("document.getElementById('sample').click()");
        await ClickEditorButton("svg");
        await chooser;
        string? saved=null;
        for(int i=0;i<80;i++) { saved=Directory.EnumerateFiles(folder,"*.svg").FirstOrDefault(); if(saved!=null) break; await Task.Delay(125); }
        if(saved==null || !File.ReadAllText(saved).Contains("<svg")) throw new Exception("The selected sample SVG page was not saved.");
        chooser=ChooseExport("Visio");
        await ClickEditorButton("export");
        await chooser;
        string? drawing=null;
        for(int i=0;i<80;i++){drawing=Directory.EnumerateFiles(folder,"*.vsdx").FirstOrDefault();if(drawing!=null)break;await Task.Delay(125);}
        if(drawing==null)throw new Exception("The native Visio export was not saved.");
        using(var package=ZipFile.OpenRead(drawing)){
            foreach(var required in new[]{"[Content_Types].xml","visio/document.xml","visio/pages/pages.xml","visio/windows.xml"})if(package.GetEntry(required)==null)throw new Exception("Native Visio export is missing "+required);
            foreach(var part in package.Entries.Where(p=>p.FullName.EndsWith(".xml")||p.FullName.EndsWith(".rels"))){using var stream=part.Open();XDocument.Load(stream);}
        }
        await CheckEditRecovery();
        await CheckAddDevice();
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
                    target.value=[...target.options].find(option=>option.textContent==='Native test rack').value;target.dispatchEvent(new Event('change'));
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
