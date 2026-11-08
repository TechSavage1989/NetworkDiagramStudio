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
        internal string? FeedBody;
        internal bool FailCheck;
        internal int CheckDelay;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            if (request.RequestUri == Policy.Feed)
            {
                Checks.Add(DateTimeOffset.UtcNow);
                if(CheckDelay>0)await Task.Delay(CheckDelay,ct);
                if(FailCheck)throw new HttpRequestException("Fixture connection unavailable.");
                if (path == null) return new HttpResponseMessage(HttpStatusCode.OK){Content=new StringContent(FeedBody??"[]")};
                var ver=FileVersionInfo.GetVersionInfo(path).ProductVersion!.Split('+')[0];
                var tag="v"+ver;using var f=File.OpenRead(path);var digest=Convert.ToHexString(SHA256.HashData(f)).ToLowerInvariant();
                var json=JsonSerializer.Serialize(new[]{new {draft=false,tag_name=tag,body="Native test release",assets=new[]{new{name=Policy.Asset,browser_download_url=Policy.AssetUri(tag).AbsoluteUri,digest="sha256:"+digest,size=f.Length}}}});
                return new HttpResponseMessage(HttpStatusCode.OK){Content=new StringContent(json)};
            }
            if (path != null && request.RequestUri == Policy.AssetUri("v"+FileVersionInfo.GetVersionInfo(path).ProductVersion!.Split('+')[0]))
                return new HttpResponseMessage(HttpStatusCode.OK){Content=new StreamContent(File.OpenRead(path))};
            throw new InvalidOperationException("Unexpected test URL.");
        }
    }
    internal static int Run(string[] args)
    {
        if (args is ["--test-install", var path])
        {
            var installFixture = new ReleaseFixture(path);
            using var updater = new Updater(installFixture);
            updater.Check(TimeSpan.Zero).GetAwaiter().GetResult();
            if(installFixture.Checks.Count!=1 || updater.Offered==null)throw new Exception("The install fixture did not return an update offer.\n"+updater.Report);
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
                await ui.RequireUpdateBar(false);
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
                fixture.CheckDelay=1000;
                await ui.CheckUpdateFromHelp("No newer release",false);
                if(fixture.Checks.Count!=4) throw new Exception("The manual update button did not request a fresh check.");
                fixture.FailCheck=true;
                await ui.CheckUpdateFromHelp("Could not check",false);
                fixture.FailCheck=false;
                var tag="v99.0.0-preview.1";
                fixture.FeedBody=JsonSerializer.Serialize(new[]{new{draft=false,tag_name=tag,body="Fictional update for visibility checks",assets=new[]{new{name=Policy.Asset,browser_download_url=Policy.AssetUri(tag).AbsoluteUri,digest="sha256:"+new string('a',64),size=100}}}});
                await ui.CheckUpdateFromHelp("Available",true);
                fixture.FailCheck=true;
                await ui.CheckUpdateFromHelp("Could not check",true);
                fixture.FailCheck=false;fixture.FeedBody="[]";
                await ui.CheckUpdateFromHelp("No newer release",false);
                File.WriteAllText(result,"Native window, local editor, startup, focus, cooldown, five-minute timer, Help update checks and conditional update bar passed."); exit=0;
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
    internal async Task RequireUpdateBar(bool visible)
    {
        if(strip.Visible || browser.Top!=0 || browser.Height!=ClientSize.Height)throw new Exception("The native update strip must not consume editor space.");
        await RequireEditor("const banner=document.getElementById('desktop-update-banner');if(!banner||banner.hidden==="+(visible?"true":"false")+")throw Error('Update banner visibility is incorrect')","update banner");
    }
    internal async Task CheckUpdateFromHelp(string expected,bool available)
    {
        await ClickEditorTarget("#desktop-help");
        await RequireEditor("if(!document.getElementById('dialog').open||!document.getElementById('dialog').classList.contains('update-dialog')||!document.getElementById('dialog-title').textContent)throw Error('Help did not open');for(const name of ['Check updates','Update details','Notices'])if(![...document.querySelectorAll('#dialog button')].some(b=>b.textContent===name))throw Error('Missing Help action '+name)","Help actions");
        await ClickEditorTarget("#desktop-check-updates");
        for(int i=0;i<50&&!checking;i++)await Task.Delay(20);
        if(!checking)throw new Exception("Help did not start an update check.");
        await RequireUpdateBar(updater.Offered!=null);
        await Task.Delay(50);
        await RequireEditor("if(!document.getElementById('desktop-check-updates').disabled||!document.getElementById('desktop-update-status').textContent.includes('Checking for updates'))throw Error('Help update progress missing')","Help update progress");
        for(int i=0;i<100;i++){
            if(!checking&&status.Text.Contains(expected)&&browser.CoreWebView2!=null){
                var displayed=await browser.CoreWebView2.ExecuteScriptAsync("document.getElementById('desktop-update-status')?.textContent");
                if(displayed.Contains(expected))break;
            }
            await Task.Delay(50);
        }
        if(checking||!check.Enabled||!status.Text.Contains(expected))throw new Exception("Manual update progress did not finish: "+expected);
        await RequireEditor("if(document.getElementById('desktop-check-updates').disabled||!document.getElementById('desktop-update-status').textContent.includes("+JsonSerializer.Serialize(expected)+"))throw Error('Help update result missing')","Help update result");
        await RequireUpdateBar(available);
        await ClickEditorTarget("#close");
    }
    async Task CheckFlexibleLayout()
    {
        await ClickEditorTarget("#page-layout");
        await RequireEditor("const field=name=>[...document.querySelectorAll('#dialog-body label')].find(l=>l.textContent===name)?.control;field('Page name').value='Native campus';[...document.querySelectorAll('#dialog button')].find(b=>b.textContent==='Apply layout').click();if(document.getElementById('dialog').open||![...document.querySelectorAll('#tabs button')].some(b=>b.textContent==='Native campus'))throw Error('Page rename failed')","page rename");
        await ClickEditorTarget("#page-layout");
        await RequireEditor("const target=[...document.querySelectorAll('#dialog-body label')].find(l=>l.textContent==='Edit page').control;target.value='*';target.dispatchEvent(new Event('change'));const field=name=>[...document.querySelectorAll('#dialog-body label')].find(l=>l.textContent===name)?.control;field('Drawing scale (%)').value='120';field('Text scale (%)').value='110';[...document.querySelectorAll('#dialog button')].find(b=>b.textContent==='Apply layout').click();if(document.getElementById('dialog').open||document.getElementById('feedback').textContent.includes('could not'))throw Error('Layout scale failed')","drawing and text scale");
        await ClickEditorTarget("#undo-devices");
        await ClickEditorTarget("#undo-devices");
        await RequireEditor("if([...document.querySelectorAll('#tabs button')].some(b=>b.textContent==='Native campus'))throw Error('Layout undo failed')","page layout undo");
    }
    async Task CheckDrawingControls()
    {
        const string sw="#canvas g[data-device-id='sw-1'][data-drawing-key$='|body']";
        await ClickEditorTarget("#edit-drawing");
        await ClickEditorTarget(sw);
        await ClickEditorTarget("#canvas g[data-device-id='sw-2'][data-drawing-key$='|body']",1,8);
        await RequireEditor("if(document.getElementById('drawing-selection').textContent!=='2 selected'||document.getElementById('dialog').open)throw Error('Shift selection failed')","Shift multi-selection");
        await ClickEditorTarget("#drawing-clear");
        await ClickEditorTarget(sw);
        var raw=await browser.CoreWebView2.ExecuteScriptAsync("(()=>{const b=document.querySelector(\""+sw+"\").getBoundingClientRect();window.__gestureBefore={x:b.x,y:b.y,w:b.width};return {x:b.x+5,y:b.y+5};})()");
        using(var point=JsonDocument.Parse(raw)){
            var x=point.RootElement.GetProperty("x").GetDouble();var y=point.RootElement.GetProperty("y").GetDouble();
            foreach(var (type,dx,dy) in new[]{("mousePressed",0,0),("mouseMoved",30,4),("mouseMoved",60,25),("mouseReleased",60,25)})
                await browser.CoreWebView2.CallDevToolsProtocolMethodAsync("Input.dispatchMouseEvent",JsonSerializer.Serialize(new{type,x=x+dx,y=y+dy,button="left",buttons=type=="mouseReleased"?0:1,modifiers=8,clickCount=1}));
        }
        await RequireEditor("const b=document.querySelector(\""+sw+"\").getBoundingClientRect(),a=window.__gestureBefore;if(Math.abs(b.y-a.y)>.1||b.x<a.x+50)throw Error('Shift did not hold the initial horizontal axis')","Shift drag axis");
        await ClickEditorTarget("#drawing-undo");
        await ClickEditorTarget("#drawing-smaller");
        await RequireEditor("const b=document.querySelector(\""+sw+"\").getBoundingClientRect();if(Math.abs(b.width/window.__gestureBefore.w-.9)>.001)throw Error('Quick scale failed')","quick item scale");
        await ClickEditorTarget("#drawing-undo");
        await ClickEditorTarget("#drawing-beside");
        await RequireEditor("const field=name=>[...document.querySelectorAll('#dialog-body label')].find(l=>l.textContent===name)?.control;field('Reference device').value=document.querySelector(\"#canvas g[data-device-id='sw-2'][data-drawing-key$='|body']\").dataset.drawingKey;[...document.querySelectorAll('#dialog button')].find(b=>b.textContent==='Right →').click();if(document.getElementById('dialog').open)throw Error('Place beside failed')","place beside another device");
        await ClickEditorTarget("#drawing-undo");
        await ClickEditorTarget("#drawing-page");
        await RequireEditor("const field=name=>[...document.querySelectorAll('#dialog-body label')].find(l=>l.textContent===name)?.control;field('New page name').value='Native access wing';[...document.querySelectorAll('#dialog button')].find(b=>b.textContent==='Move devices').click();if(document.getElementById('dialog').open||!document.querySelector('#tabs .active').textContent.includes('Native access wing')||!document.querySelector('#canvas svg').textContent.includes('Core Network'))throw Error('Move to page or off-page indicator failed')","move with off-page references");
        await ClickEditorTarget("#drawing-undo");
        await RequireEditor("document.querySelector('#tabs button').click();delete window.__gestureBefore","restore original page");
        await ClickEditorTarget("#edit-drawing");
    }
    async Task CheckPageSetup()
    {
        await ClickEditorTarget("#page-options");
        await RequireEditor("const field=name=>[...document.querySelectorAll('#dialog-body label')].find(l=>l.textContent===name)?.control;if(field('Canvas size').value!=='dynamic')throw Error('New drawings must default to Dynamic / Fit all');const box=document.querySelector('#canvas svg').viewBox.baseVal;window.__nativeDynamicBounds=[box.width,box.height];field('Print paper').value='letter';field('Print orientation').value='portrait';[...document.querySelectorAll('#dialog button')].find(b=>b.textContent==='Save page options').click()","independent print paper");
        await RequireEditor("const box=document.querySelector('#canvas svg').viewBox.baseVal;if(box.width!==window.__nativeDynamicBounds[0]||box.height!==window.__nativeDynamicBounds[1])throw Error('Print paper resized the editable drawing');delete window.__nativeDynamicBounds","print preserves dynamic canvas");
        await ClickEditorTarget("#page-options");
        await RequireEditor("const field=name=>[...document.querySelectorAll('#dialog-body label')].find(l=>l.textContent===name)?.control;if(field('Print paper').value!=='letter'||field('Print orientation').value!=='portrait')throw Error('Print setup was not retained');field('Print paper').value='drawing'","print paper persistence");
        await RequireEditor("const field=name=>[...document.querySelectorAll('#dialog-body label')].find(l=>l.textContent===name)?.control;field('Canvas size').value='a3';field('Canvas size').dispatchEvent(new Event('input'));[...document.querySelectorAll('#dialog button')].find(b=>b.textContent==='Save page options').click()","A3 page setup");
        await RequireEditor("const box=document.querySelector('#canvas svg').viewBox.baseVal;if(Math.abs(box.width-1587.401575)>0.01||Math.abs(box.height-1122.519685)>0.01)throw Error('Paper setup did not change the drawing bounds')","A3 scene bounds");
        await ClickEditorTarget("#page-options");
        await RequireEditor("const field=name=>[...document.querySelectorAll('#dialog-body label')].find(l=>l.textContent===name)?.control;if(field('Canvas size').value!=='a3')throw Error('Paper setting was not retained');field('Canvas size').value='original';[...document.querySelectorAll('#dialog button')].find(b=>b.textContent==='Save page options').click()","restore original paper");
        await RequireEditor("if(document.querySelector('#canvas svg').viewBox.baseVal.width!==1200)throw Error('Original page dimensions were not restored')","original scene bounds");
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
    async Task ClickEditorTarget(string selector,int clicks=1,int modifiers=0)
    {
        var query=JsonSerializer.Serialize(selector);
        var raw=await browser.CoreWebView2.ExecuteScriptAsync($"(() => {{ const n=document.querySelector({query}); if(!n) return null; n.scrollIntoView({{block:'center',inline:'center'}}); const r=n.getBoundingClientRect(); return {{x:r.x+r.width/2,y:r.y+r.height/2}}; }})()");
        using var doc=JsonDocument.Parse(raw);
        if(doc.RootElement.ValueKind!=JsonValueKind.Object)throw new Exception("Native edit target is unavailable: "+selector);
        var x=doc.RootElement.GetProperty("x").GetDouble();var y=doc.RootElement.GetProperty("y").GetDouble();
        for(int click=1;click<=clicks;click++)foreach(var type in new[]{"mousePressed","mouseReleased"})
            await browser.CoreWebView2.CallDevToolsProtocolMethodAsync("Input.dispatchMouseEvent",JsonSerializer.Serialize(new{type,x,y,button="left",buttons=type=="mousePressed"?1:0,clickCount=click,modifiers}));
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
    async Task CheckLegendConnections()
    {
        await ClickEditorTarget("#link-styles");
        await RequireEditor("const field=title=>[...document.querySelectorAll('#dialog-body label')].find(label=>label.textContent===title)?.control; const type=field('Link type'); type.value='AP copper'; type.dispatchEvent(new Event('change'))","choose associated wireless connections");
        await RequireEditor("const field=title=>[...document.querySelectorAll('#dialog-body label')].find(label=>label.textContent===title)?.control; if(field('Link speed')?.value!=='__keep_connection_value__') throw Error('Mixed speeds were not preserved'); field('Cable type').value='AOC'; field('Cable type').dispatchEvent(new Event('change')); field('Link speed').value='25 Gbps'; field('Link speed').dispatchEvent(new Event('change')); const save=[...document.querySelectorAll('#dialog button')].find(b=>b.textContent==='Save link style'); save.dataset.nativeLegend='save'","set shared cable type and speed");
        await ClickEditorTarget("[data-native-legend='save']");
        await RequireEditor("if(document.getElementById('dialog').open) throw Error('Legend metadata was not saved')","save legend metadata");
        await ClickEditorTarget("#link-styles");
        await RequireEditor("const field=title=>[...document.querySelectorAll('#dialog-body label')].find(label=>label.textContent===title)?.control; const type=field('Link type'); const option=[...type.options].find(o=>o.value==='AOC'); if(!option) throw Error('Changed type missing'); type.value=option.value; type.dispatchEvent(new Event('change'))","reopen changed link class");
        await RequireEditor("const field=title=>[...document.querySelectorAll('#dialog-body label')].find(label=>label.textContent===title)?.control; if(field('Cable type')?.value!=='AOC'||field('Link speed')?.value!=='25 Gbps') throw Error('Associated connection metadata was not retained')","verify retained connection metadata");
        await ClickEditorTarget("#close");
    }
    async Task CheckAddDevice()
    {
        await ClickEditorTarget("#add-device");
        await RequireEditor("const field=title=>[...document.querySelectorAll('#dialog-body label')].find(label=>label.textContent===title)?.control; const name=field('Device name'),kind=field('Device type'),model=field('Model'),platform=field('Platform / technology'); if(!name||!kind||!model||!platform) throw Error('Add device fields missing'); name.value='LAB-HYPERVISOR-NODE-01'; kind.value='hypervisor'; kind.dispatchEvent(new Event('change')); model.value='Dell PowerEdge R750'; model.dispatchEvent(new Event('change')); platform.value='Proxmox VE'; field('MAC address(es)').value='0200.0000.0020'; if(kind.value!=='hypervisor') throw Error('Model lookup replaced the selected device type'); const save=[...document.querySelectorAll('#dialog button')].find(button=>button.textContent==='Save device'); if(!save) throw Error('Save device missing'); save.dataset.nativeAddDevice='save'; save.scrollIntoView({block:'center'})","prepare explicit hypervisor");
        await RequireEditor("const field=title=>[...document.querySelectorAll('#dialog-body label')].find(label=>label.textContent===title)?.control; field('Core page').value='new'; const detail=[...document.querySelectorAll('#dialog details')].find(node=>node.querySelector('summary')?.textContent==='Edit ports'); if(!detail) throw Error('Port form missing'); detail.open=true; [...detail.querySelectorAll('button')].find(button=>button.textContent==='Add port').click()","add human-readable port");
        await RequireEditor("const field=title=>[...document.querySelectorAll('#dialog-body label')].find(label=>label.textContent===title)?.control; field('Port name').value='eth0'; field('Description').value='Management'; field('Native VLAN').value='8'; field('Tagged VLANs').value='20, 34'; document.querySelector('[data-native-add-device=save]').scrollIntoView({block:'center'})","fill port form and dedicated page");
        await ClickEditorTarget("[data-native-add-device='save']");
        await RequireEditor("if(document.getElementById('dialog').open) throw Error('Add device did not close'); const row=[...document.querySelectorAll('#devices .device-row')].find(row=>row.textContent.includes('LAB-HYPERVISOR-NODE-01')); if(!row?.textContent.includes('Hypervisor host')||!row.textContent.includes('Dell PowerEdge R750')||!row.querySelector('input[type=checkbox]')?.checked) throw Error('Added hypervisor lost its type, model or scope'); if(!document.querySelector('#canvas>svg')||!document.querySelector('#tabs button')||document.querySelector('#welcome')) throw Error('Add device lost the diagram'); row.querySelector('button[title]').dataset.nativeAddDevice='open'","save added hypervisor");
        await ClickEditorTarget("[data-native-add-device='open']");
        await RequireEditor("if(!document.getElementById('dialog').open||document.getElementById('dialog-title').textContent!=='Device details') throw Error('Device editor did not reopen'); const field=title=>[...document.querySelectorAll('#dialog-body label')].find(label=>label.textContent===title)?.control; if(field('Device type')?.value!=='hypervisor'||field('Model')?.value!=='Dell PowerEdge R750'||field('Platform / technology')?.value!=='Proxmox VE'||field('MAC address(es)')?.value!=='02:00:00:00:00:20') throw Error('Added device details were not retained')","reopen added hypervisor");
        await RequireEditor("const field=title=>[...document.querySelectorAll('#dialog-body label')].find(label=>label.textContent===title)?.control; if(field('Core page')?.selectedOptions[0]?.textContent!=='LAB-HYPERVISOR-NODE-01') throw Error('Dedicated page was not retained'); if(field('Port name')?.value!=='eth0'||field('Description')?.value!=='Management'||field('Native VLAN')?.value!=='8'||field('Tagged VLANs')?.value!=='20, 34') throw Error('Port form values were not retained')","retained ports and dedicated page");
        await ClickEditorTarget("#close");
        await ClickEditorTarget("#drawing-undo");
        await RequireEditor("if(document.getElementById('devices').textContent.includes('LAB-HYPERVISOR-NODE-01')) throw Error('Undo retained the added device'); if(!document.querySelector('#canvas>svg')||!document.querySelector('#tabs button')||document.querySelector('#welcome')) throw Error('Undo lost the diagram')","undo added hypervisor");
        await ClickEditorTarget("#drawing-redo");
        await RequireEditor("const row=[...document.querySelectorAll('#devices .device-row')].find(row=>row.textContent.includes('LAB-HYPERVISOR-NODE-01')); if(!row?.textContent.includes('Hypervisor host')||!row.querySelector('input[type=checkbox]')?.checked) throw Error('Redo did not restore the scoped hypervisor'); if(!document.querySelector('#canvas>svg')||!document.querySelector('#tabs button')||document.querySelector('#welcome')) throw Error('Redo lost the diagram')","redo added hypervisor");
    }
    internal async Task ExportAndPrint(string folder)
    {
        if(browser.CoreWebView2.Settings.AreDefaultContextMenusEnabled)throw new Exception("Browser context menus must be disabled.");
        await RequireEditor("const e=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});document.getElementById('canvas').dispatchEvent(e);if(!e.defaultPrevented)throw Error('Browser context menu was not suppressed')","drawing context menu");
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
        await CheckDrawingControls();
        await CheckFlexibleLayout();
        await CheckPageSetup();
        await CheckEditRecovery();
        await CheckLegendConnections();
        await CheckAddDevice();
        await ClickEditorTarget("#devices [aria-label='Up SW-1']");
        await RequireEditor("if(document.querySelector('#devices .device-row').dataset.deviceId!=='sw-1') throw Error('Sidebar Up did not reorder devices')","sidebar move up");
        await ClickEditorTarget("#devices [aria-label='Down SW-1']");
        await RequireEditor("if(document.querySelector('#devices .device-row').dataset.deviceId!=='edge') throw Error('Sidebar Down did not restore device order')","sidebar move down");
        await RequireEditor("const source=document.querySelector('#devices [data-device-id=\"sw-1\"]'),target=document.querySelector('#devices [data-device-id=\"edge\"]'),data=new DataTransfer();if(!source.draggable)throw Error('Sidebar drag disabled');source.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:data}));target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:data}));target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data}));if(document.querySelector('#devices .device-row').dataset.deviceId!=='sw-1')throw Error('Sidebar drop did not reorder devices')","sidebar drop");
        await ClickEditorTarget("#undo-devices");
        await RequireEditor("if(document.querySelector('#devices .device-row').dataset.deviceId!=='edge'||!document.querySelector('#devices [aria-label=\"Delete SW-1\"]'))throw Error('Sidebar reorder Undo lost device order or Delete control')","sidebar reorder undo");
        await ClickEditorTarget("#arrange");
        await ClickEditorTarget("#dialog [aria-label='Up SW-1']");
        await RequireEditor("if(document.querySelector('#devices .device-row').dataset.deviceId!=='sw-1') throw Error('Device ordering failed')","device order");
        await RequireEditor("[...document.querySelectorAll('#dialog button')].find(button=>button.textContent==='Add core page').click()","add named page");
        await RequireEditor("const name=[...document.querySelectorAll('[aria-label=\"Core page name\"]')].at(-1); if(!name) throw Error('New page name field missing'); name.value='Native test rack'; name.dispatchEvent(new Event('change'))","rename core page");
        await RequireEditor("const target=document.querySelector('[aria-label=\"Core page for SW-1\"]'); const option=[...target.options].find(option=>option.textContent==='Native test rack'); if(!option) throw Error('Named page missing from choices'); target.value=option.value; target.dispatchEvent(new Event('change'))","assign named page");
        await RequireEditor("if(![...document.querySelectorAll('#tabs button')].some(button=>button.textContent==='Native test rack')) throw Error('Core assignment failed')","verify named page");
        await ClickEditorTarget("#close");
        await ClickEditorTarget("#evidence");
        await RequireEditor("if(!document.getElementById('dialog').open||document.getElementById('dialog-title').textContent!=='Imported data') throw Error('Import controls missing')","import controls");
        await ClickEditorTarget("#close");
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
