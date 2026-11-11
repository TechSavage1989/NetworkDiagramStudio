// Compiled into the test host only. Release binaries cannot redirect their feed.
using System.Diagnostics;
using System.Net;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.IO.Compression;
using System.Xml.Linq;
using Microsoft.Web.WebView2.Core;
using NetworkDiagramStudio.SwitchportReports;

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
        // Corner handles intentionally own their 10px hit area. A move gesture
        // must start on verified device artwork, not a resize handle or text.
        var raw=await browser.CoreWebView2.ExecuteScriptAsync("(()=>{const group=document.querySelector(\""+sw+"\"),b=group.getBoundingClientRect(),svg=document.querySelector('#canvas svg'),bb=group.getBBox(),m=svg.getCTM().inverse().multiply(group.getCTM()),c=document.getElementById('canvas').getBoundingClientRect();window.__gestureBefore={x:b.x,y:b.y,w:b.width,h:b.height,drawingX:m.a*bb.x+m.c*bb.y+m.e,drawingY:m.b*bb.x+m.d*bb.y+m.f,zoom:new DOMMatrix(getComputedStyle(svg).transform).a,canvasY:c.y,scrollY:window.scrollY};for(const fx of [.12,.2,.35,.65,.8,.9])for(const fy of [.15,.35,.5,.7,.85]){const x=b.x+b.width*fx,y=b.y+b.height*fy,target=document.elementFromPoint(x,y);if(target&&group.contains(target)&&!target.closest('text,[data-port-name],.transform-controls,.cable-controls')&&target.closest('[data-device-id]')===group)return {x,y,device:group.getAttribute('data-device-id')};}return {error:'No unobstructed device body point',bounds:window.__gestureBefore};})()");
        using(var point=JsonDocument.Parse(raw)){
            if(!point.RootElement.TryGetProperty("device",out var hit)||hit.GetString()!="sw-1")throw new Exception("Shift drag must start inside SW-1: "+raw);
            var x=point.RootElement.GetProperty("x").GetDouble();var y=point.RootElement.GetProperty("y").GetDouble();
            foreach(var (type,dx,dy) in new[]{("mousePressed",0,0),("mouseMoved",30,4),("mouseMoved",60,25),("mouseReleased",60,25)})
                await browser.CoreWebView2.CallDevToolsProtocolMethodAsync("Input.dispatchMouseEvent",JsonSerializer.Serialize(new{type,x=x+dx,y=y+dy,button="left",buttons=type=="mouseReleased"?0:1,modifiers=8,clickCount=1}));
        }
        await Task.Delay(100);
        // Shift locks the drawing axis. Chrome above the canvas can reflow after
        // the commit (status text), moving the canvas with or without the
        // viewport's resize compensation, so the screen rectangle alone cannot
        // tell. Measure the device in drawing coordinates: y unchanged and x
        // moved by exactly the 60 px drag at the gesture's zoom.
        await EditorFrames();
        await RequireEditor("const group=document.querySelector(\""+sw+"\"),b=group.getBoundingClientRect(),a=window.__gestureBefore,svg=document.querySelector('#canvas svg'),bb=group.getBBox(),m=svg.getCTM().inverse().multiply(group.getCTM()),drawingX=m.a*bb.x+m.c*bb.y+m.e,drawingY=m.b*bb.x+m.d*bb.y+m.f,c=document.getElementById('canvas').getBoundingClientRect();if(Math.abs(drawingY-a.drawingY)>.5/a.zoom||Math.abs(drawingX-a.drawingX-60/a.zoom)>2/a.zoom)throw Error('Shift did not hold the initial horizontal axis: '+JSON.stringify({before:a,after:{x:b.x,y:b.y,w:b.width,drawingX,drawingY,canvasY:c.y,scrollY:window.scrollY},viewport:{width:innerWidth,height:innerHeight,ratio:devicePixelRatio},canvas:{x:document.getElementById('canvas').getBoundingClientRect().x,y:document.getElementById('canvas').getBoundingClientRect().y,scrollLeft:document.getElementById('canvas').scrollLeft,scrollTop:document.getElementById('canvas').scrollTop},viewBox:document.querySelector('#canvas svg').getAttribute('viewBox'),transform:document.querySelector('#canvas svg').style.transform,feedback:document.getElementById('feedback').textContent}))","Shift drag axis");
        await ClickEditorTarget("#drawing-undo");
        await ClickEditorTarget("#drawing-smaller");
        await RequireEditor("const b=document.querySelector(\""+sw+"\").getBoundingClientRect();if(Math.abs(b.width/window.__gestureBefore.w-.9)>.001)throw Error('Quick scale failed')","quick item scale");
        await ClickEditorTarget("#drawing-undo");
        await ClickEditorTarget("#drawing-clear");
        await RequireEditor("const tools=document.getElementById('drawing-beside');if(tools.hidden||tools.querySelector('[data-place=right]').disabled)throw Error('Placement must be visible and usable without a selection')","persistent placement tools");
        await ClickEditorTarget("#drawing-beside [data-place='right']");
        await ClickEditorTarget(sw);
        await RequireEditor("if(document.getElementById('dialog').open||!document.getElementById('canvas').classList.contains('picking-reference')||!document.getElementById('placement-status').textContent.includes('reference device'))throw Error('Reference picking did not start')","choose moving device without a dialog");
        await ClickEditorTarget("#canvas g[data-device-id='sw-2'][data-drawing-key$='|body']");
        await RequireEditor("if(!document.getElementById('feedback').textContent.includes('placed right SW-2'))throw Error('Place beside failed')","pick reference device on drawing");
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
        await RequireEditor("const field=name=>[...document.querySelectorAll('#dialog-body label')].find(l=>l.textContent===name)?.control;if(field('Canvas size'))throw Error('Page options should not resize the editable drawing');const box=document.querySelector('#canvas svg').viewBox.baseVal;window.__nativeDynamicBounds=[box.width,box.height];const paper=field('Print paper'),orientation=field('Print orientation');if(!paper||!orientation)throw Error('Print paper controls are missing');paper.value='letter';paper.dispatchEvent(new Event('change'));orientation.value='portrait';orientation.dispatchEvent(new Event('change'));[...document.querySelectorAll('#dialog button')].find(b=>b.textContent==='Save page options').click()","independent print paper");
        await RequireEditor("const box=document.querySelector('#canvas svg').viewBox.baseVal;if(box.width!==window.__nativeDynamicBounds[0]||box.height!==window.__nativeDynamicBounds[1])throw Error('Print paper resized the editable drawing')","print preserves dynamic canvas");
        await ClickEditorTarget("#page-options");
        await RequireEditor("const field=name=>[...document.querySelectorAll('#dialog-body label')].find(l=>l.textContent===name)?.control;if(field('Print paper')?.value!=='letter'||field('Print orientation')?.value!=='portrait')throw Error('Print setup was not retained');field('Print paper').value='a3';field('Print paper').dispatchEvent(new Event('change'));[...document.querySelectorAll('#dialog button')].find(b=>b.textContent==='Save page options').click()","A3 print paper setup");
        await RequireEditor("const box=document.querySelector('#canvas svg').viewBox.baseVal;if(box.width!==window.__nativeDynamicBounds[0]||box.height!==window.__nativeDynamicBounds[1])throw Error('A3 print paper changed the drawing bounds')","A3 preserves drawing bounds");
        await ClickEditorTarget("#page-options");
        await RequireEditor("const field=name=>[...document.querySelectorAll('#dialog-body label')].find(l=>l.textContent===name)?.control;if(field('Print paper')?.value!=='a3')throw Error('A3 paper was not retained');field('Print paper').value='drawing';field('Print paper').dispatchEvent(new Event('change'));[...document.querySelectorAll('#dialog button')].find(b=>b.textContent==='Save page options').click()","restore original print paper");
        await RequireEditor("const box=document.querySelector('#canvas svg').viewBox.baseVal;if(box.width!==window.__nativeDynamicBounds[0]||box.height!==window.__nativeDynamicBounds[1])throw Error('Original print selection changed the editable canvas');delete window.__nativeDynamicBounds","original scene preserved");
        await ClickEditorTarget("#page-options");
        await RequireEditor("const field=name=>[...document.querySelectorAll('#dialog-body label')].find(l=>l.textContent===name)?.control;if(field('Apply visible page proportions to')?.value!=='page'||!field('Individual page')||!field('Page group'))throw Error('Page-specific and group settings are missing');const paper=field('Visible page proportions');if(!paper)throw Error('Visible paper control missing');paper.value='a4';paper.dispatchEvent(new Event('input'));const orientation=field('Page orientation');orientation.value='portrait';orientation.dispatchEvent(new Event('input'));[...document.querySelectorAll('#dialog button')].find(b=>b.textContent==='Save page options').click()","apply visible A4 portrait");
        await RequireEditor("const view=document.querySelector('#canvas svg').viewBox.baseVal;if(Math.abs(view.width/view.height-210/297)>1e-6)throw Error('A4 portrait is not visible on the editor page');","visible page proportions");
        await ClickEditorTarget("#page-options");
        await RequireEditor("const field=name=>[...document.querySelectorAll('#dialog-body label')].find(l=>l.textContent===name)?.control;if(field('Visible page proportions')?.value!=='a4')throw Error('Per-page paper was not retained');field('Visible page proportions').value='dynamic';field('Visible page proportions').dispatchEvent(new Event('input'));[...document.querySelectorAll('#dialog button')].find(b=>b.textContent==='Save page options').click()","restore dynamic visible page");

    }
    internal string? TestOutputFolder;
    delegate bool EnumWindowCallback(IntPtr hwnd,IntPtr parameter);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowCallback callback,IntPtr parameter);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd,out uint processId);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd,StringBuilder name,int count);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr hwnd,StringBuilder text,int count);
    [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr hwnd,uint command);
    [DllImport("user32.dll")] static extern IntPtr GetDlgItem(IntPtr hwnd,int id);
    [DllImport("user32.dll")] static extern bool IsWindow(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool IsWindowEnabled(IntPtr hwnd);
    [DllImport("user32.dll",SetLastError=true)] static extern bool PostMessage(IntPtr hwnd,uint msg,IntPtr w,IntPtr l);
    static async Task AcceptExportDialog(IntPtr owner,Action<string> report,CancellationToken cancel)
    {
        IntPtr dialog=IntPtr.Zero,saveButton=IntPtr.Zero;
        while(saveButton==IntPtr.Zero)
        {
            cancel.ThrowIfCancellationRequested();
            EnumWindows((hwnd,_)=>{
                GetWindowThreadProcessId(hwnd,out var processId);
                if(processId!=Environment.ProcessId)return true;
                var text=new StringBuilder(256);GetClassName(hwnd,text,text.Capacity);
                if(text.ToString()!="#32770")return true;
                text.Clear();GetWindowText(hwnd,text,text.Capacity);
                if(text.ToString()!="Save exported file")return true;
                var parent=hwnd;bool owned=false;
                for(int depth=0;depth<16 && parent!=IntPtr.Zero;depth++)
                {
                    parent=GetWindow(parent,4); // GW_OWNER, including an intermediate modal owner.
                    if(parent==owner){owned=true;break;}
                }
                if(!owned)return true;
                var button=GetDlgItem(hwnd,1); // IDOK is the native Save control.
                bool ready=IsWindowVisible(hwnd)&&IsWindowEnabled(hwnd)&&button!=IntPtr.Zero&&IsWindowVisible(button)&&IsWindowEnabled(button);
                report($"owned Save dialog=0x{hwnd.ToInt64():x}, Save control=0x{button.ToInt64():x}, ready={ready}");
                if(!ready)return true;
                dialog=hwnd;saveButton=button;return false;
            },IntPtr.Zero);
            if(saveButton==IntPtr.Zero)await Task.Delay(100,cancel);
        }
        cancel.ThrowIfCancellationRequested();
        // Send exactly one real button command, after native dialog readiness.
        if(!PostMessage(dialog,0x0111,(IntPtr)1,saveButton))
            throw new Exception("The Save command could not be posted. Win32 error: "+Marshal.GetLastWin32Error());
        report($"Save accepted command posted to 0x{dialog.ToInt64():x}; awaiting dialog closure");
        while(IsWindow(dialog)&&IsWindowVisible(dialog))await Task.Delay(100,cancel);
        report("owned Save dialog closed after one Save command");
    }
    async Task<string> SaveNativeExport(string buttonId,string extension,string folder)
    {
        var core=browser.CoreWebView2;
        var owner=Handle;
        var completed=new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        CoreWebView2DownloadOperation? operation=null;
        string downloadState="DownloadStarting not observed",dialogState="waiting for an owned visible/enabled Save dialog";
        using var deadline=new CancellationTokenSource(TimeSpan.FromSeconds(30));
        void ObserveDownload()
        {
            if(operation==null)return;
            try
            {
                var state=operation.State;
                downloadState=$"state={state}, interrupt={operation.InterruptReason}, received={operation.BytesReceived}, total={operation.TotalBytesToReceive}, path={operation.ResultFilePath}";
                if(state==CoreWebView2DownloadState.Interrupted)
                    completed.TrySetException(new Exception("The native download was interrupted: "+downloadState));
                else if(state==CoreWebView2DownloadState.Completed)
                    completed.TrySetResult(operation.ResultFilePath);
            }
            catch(Exception error){completed.TrySetException(error);}
        }
        EventHandler<object> changed=(_,_)=>ObserveDownload();
        EventHandler<CoreWebView2DownloadStartingEventArgs> starting=(_,e)=>{
            if(operation!=null){completed.TrySetException(new Exception("More than one download started for "+extension));return;}
            operation=e.DownloadOperation;
            operation.StateChanged+=changed;operation.BytesReceivedChanged+=changed;
            if(!operation.Uri.StartsWith("blob:"+Origin+"/",StringComparison.Ordinal)||!string.Equals(Path.GetExtension(e.ResultFilePath),extension,StringComparison.OrdinalIgnoreCase))
                completed.TrySetException(new Exception("Unexpected native download: "+operation.Uri+" -> "+e.ResultFilePath));
            RecordEditorStartup("Native export DownloadStarting: "+extension+", suggested path="+e.ResultFilePath);
            ObserveDownload();
        };
        core.DownloadStarting+=starting;
        // Only HWND polling runs off-thread. WebView properties and event handlers
        // stay on the UI thread, including the host-updated final result path.
        var chooser=Task.Run(()=>AcceptExportDialog(owner,value=>Volatile.Write(ref dialogState,value),deadline.Token));
        try
        {
            await ClickEditorButton(buttonId).WaitAsync(deadline.Token);
            await Task.WhenAll(chooser,completed.Task).WaitAsync(deadline.Token);
            string saved=Path.GetFullPath(await completed.Task);
            if(!string.Equals(Path.GetDirectoryName(saved),Path.TrimEndingDirectorySeparator(Path.GetFullPath(folder)),StringComparison.OrdinalIgnoreCase)||!string.Equals(Path.GetExtension(saved),extension,StringComparison.OrdinalIgnoreCase))
                throw new Exception("The completed export has an unexpected destination: "+saved);
            var file=new FileInfo(saved);
            if(!file.Exists||file.Length==0||file.Length!=operation!.BytesReceived)
                throw new Exception("The completed export is missing, empty or has a different byte count: "+saved);
            RecordEditorStartup("Native export completed: "+downloadState+"; "+Volatile.Read(ref dialogState));
            return saved;
        }
        catch(Exception error)
        {
            ObserveDownload();
            throw new Exception($"Native {extension} export failed: {downloadState}; dialog={Volatile.Read(ref dialogState)}; dialog error={chooser.Exception?.GetBaseException().Message ?? "none"}",error);
        }
        finally
        {
            deadline.Cancel();
            try{await chooser;}catch{ /* Preserve the export failure and its dialog diagnostics. */ }
            core.DownloadStarting-=starting;
            if(operation!=null){operation.StateChanged-=changed;operation.BytesReceivedChanged-=changed;}
        }
    }
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
        // Re-measure each click after selection/reveal and resize callbacks.
        // SVG text bounds can contain blank space; require a painted glyph hit.
        for(int click=1;click<=clicks;click++)
        {
            var raw=await browser.CoreWebView2.CallDevToolsProtocolMethodAsync("Runtime.evaluate",JsonSerializer.Serialize(new{
                expression=$$"""
                (async () => {
                    const n=document.querySelector({{query}});if(!n)return {error:'Target missing'};
                    n.scrollIntoView({block:'center',inline:'center'});
                    await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
                    const r=n.getBoundingClientRect(),center={x:r.x+r.width/2,y:r.y+r.height/2};
                    if(!n.matches('svg text'))return center;
                    const describe=node=>{const chain=[];for(let at=node;at&&chain.length<5;at=at.parentElement)chain.push({tag:at.localName,id:at.id,class:at.getAttribute?.('class')});return chain;};
                    const count=n.getNumberOfChars(),matrix=n.getScreenCTM(),hits=[];
                    for(let step=0;step<count;step++){
                        const index=(Math.floor(count/2)+step)%count,b=n.getExtentOfChar(index);
                        if(!b.width||!b.height)continue;
                        const point=new DOMPoint(b.x+b.width/2,b.y+b.height/2).matrixTransform(matrix),hit=document.elementFromPoint(point.x,point.y);
                        if(hit?.closest('text')===n)return {x:point.x,y:point.y,glyph:index,key:n.dataset.drawingKey};
                        if(hits.length<8)hits.push({glyph:index,x:point.x,y:point.y,hit:hit?.localName,key:hit?.closest('[data-drawing-key]')?.dataset.drawingKey,ancestors:describe(hit)});
                    }
                    const hit=document.elementFromPoint(center.x,center.y);
                    return {error:'No visible text glyph hit',bounds:{x:r.x,y:r.y,w:r.width,h:r.height},count,centerHit:hit?.localName,centerAncestors:describe(hit),viewport:{width:innerWidth,height:innerHeight},canvas:document.querySelector('#canvas')?.getBoundingClientRect().toJSON(),centerKey:hit?.closest('[data-drawing-key]')?.dataset.drawingKey,hits,feedback:document.getElementById('feedback')?.textContent};
                })()
                """,
                awaitPromise=true,returnByValue=true}));
            using var doc=JsonDocument.Parse(raw);
            var result=doc.RootElement.GetProperty("result");
            if(!result.TryGetProperty("value",out var point)||point.ValueKind!=JsonValueKind.Object||point.TryGetProperty("error",out _))throw new Exception("Native edit target is unavailable: "+selector+" "+raw);
            var x=point.GetProperty("x").GetDouble();var y=point.GetProperty("y").GetDouble();
            if(point.TryGetProperty("glyph",out _))RecordEditorStartup("Native text click "+click+"/"+clicks+": "+point.GetRawText());
            foreach(var type in new[]{"mousePressed","mouseReleased"})
                await browser.CoreWebView2.CallDevToolsProtocolMethodAsync("Input.dispatchMouseEvent",JsonSerializer.Serialize(new{type,x,y,button="left",buttons=type=="mousePressed"?1:0,clickCount=click,modifiers}));
        }
    }
    // A different, unselected title may be off-screen after the selected title
    // was revealed. Navigate through real middle-button input, never by changing
    // SVG geometry, bypassing hit tests or fitting away the user's current zoom.
    async Task PanEditorTargetIntoView(string selector)
    {
        var query=JsonSerializer.Serialize(selector);
        var scale=await browser.CoreWebView2.ExecuteScriptAsync("new DOMMatrix(getComputedStyle(document.querySelector('#canvas svg')).transform).a");
        for(int attempt=0;attempt<8;attempt++)
        {
            var raw=await browser.CoreWebView2.CallDevToolsProtocolMethodAsync("Runtime.evaluate",JsonSerializer.Serialize(new{
                expression=$$"""
                (async () => {
                    await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
                    const n=document.querySelector({{query}}),canvas=document.querySelector('#canvas');
                    if(!n||!canvas)return {error:'Navigation target missing'};
                    const b=n.getBoundingClientRect(),c=canvas.getBoundingClientRect(),left=Math.max(0,c.left)+30,right=Math.min(innerWidth,c.right)-30,top=Math.max(0,c.top)+30,bottom=Math.min(innerHeight,c.bottom)-30;
                    if(right<=left||bottom<=top)return {error:'Canvas has no pointer navigation area'};
                    if(b.left>=left&&b.right<=right&&b.top>=top&&b.bottom<=bottom)return {visible:true};
                    const x=(left+right)/2,y=(top+bottom)/2,dx=Math.max(-(right-left)/2,Math.min((right-left)/2,x-(b.left+b.right)/2)),dy=Math.max(-(bottom-top)/2,Math.min((bottom-top)/2,y-(b.top+b.bottom)/2));
                    return {x,y,dx,dy};
                })()
                """,
                awaitPromise=true,returnByValue=true}));
            using var doc=JsonDocument.Parse(raw);
            var result=doc.RootElement.GetProperty("result");
            if(!result.TryGetProperty("value",out var step)||step.ValueKind!=JsonValueKind.Object||step.TryGetProperty("error",out _))throw new Exception("Native pan target unavailable: "+selector+" "+raw);
            if(step.TryGetProperty("visible",out _))
            {
                var after=await browser.CoreWebView2.ExecuteScriptAsync("new DOMMatrix(getComputedStyle(document.querySelector('#canvas svg')).transform).a");
                if(after!=scale)throw new Exception("Native title navigation changed zoom: "+scale+" -> "+after);
                return;
            }
            var x=step.GetProperty("x").GetDouble();var y=step.GetProperty("y").GetDouble();
            var endX=x+step.GetProperty("dx").GetDouble();var endY=y+step.GetProperty("dy").GetDouble();
            await browser.CoreWebView2.CallDevToolsProtocolMethodAsync("Input.dispatchMouseEvent",JsonSerializer.Serialize(new{type="mousePressed",x,y,button="middle",buttons=4,clickCount=1}));
            await browser.CoreWebView2.CallDevToolsProtocolMethodAsync("Input.dispatchMouseEvent",JsonSerializer.Serialize(new{type="mouseMoved",x=endX,y=endY,button="middle",buttons=4}));
            await browser.CoreWebView2.CallDevToolsProtocolMethodAsync("Input.dispatchMouseEvent",JsonSerializer.Serialize(new{type="mouseReleased",x=endX,y=endY,button="middle",buttons=0,clickCount=1}));
        }
        throw new Exception("Native title navigation exceeded eight gestures: "+selector);
    }
    async Task EditorKey(string key,int code)
    {
        foreach(var type in new[]{"keyDown","keyUp"})await browser.CoreWebView2.CallDevToolsProtocolMethodAsync("Input.dispatchKeyEvent",JsonSerializer.Serialize(new{type,key,windowsVirtualKeyCode=code,nativeVirtualKeyCode=code}));
    }
    // Two animation frames guarantee one complete rendering update, including
    // ResizeObserver delivery, even when a busy runner delays frames.
    async Task EditorFrames()=>await browser.CoreWebView2.CallDevToolsProtocolMethodAsync("Runtime.evaluate",JsonSerializer.Serialize(new{expression="new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done(true))))",awaitPromise=true,returnByValue=true}));
    async Task RequireEditor(string code,string stage)
    {
        var result=await browser.CoreWebView2.ExecuteScriptAsync("(() => { try { "+code+"; return 'ok'; } catch(e) { return e.message; } })()");
        if(result!="\"ok\"")throw new Exception("Native edit recovery ("+stage+"): "+result);
    }
    async Task CheckEditRecovery()
    {
        const string edge="#canvas text[data-drawing-key=\"Core Network|title|edge\"]",sw="#canvas text[data-drawing-key=\"Core Network|title|sw-1\"]";
        await ClickEditorTarget(edge,2);
        await RequireEditor("const t=document.querySelector('[data-inline-editor] textarea');if(!t?.isConnected)throw Error('Inline editor missing');t.value='Native growing-canvas title'","start inline title edit");
        await EditorKey("Enter",13);
        await RequireEditor("if(document.querySelector('[data-inline-editor]'))throw Error('Saved title editor did not close');if(!document.querySelector('text[data-drawing-key=\"Core Network|title|edge\"]')?.textContent.includes('Native growing-canvas title'))throw Error('Dynamic title was not saved')","save title on dynamic page");
        await ClickEditorTarget(edge,2);
        await RequireEditor("const t=document.querySelector('[data-inline-editor] textarea');if(!t?.isConnected)throw Error('Edited title cannot be reopened: '+JSON.stringify({selection:document.getElementById('drawing-selection')?.textContent,feedback:document.getElementById('feedback')?.textContent,dialog:document.getElementById('dialog')?.open,active:document.activeElement?.id,viewport:document.querySelector('#canvas svg')?.style.transform}));t.value='Native repaired title'","revise saved title");
        await EditorKey("Enter",13);
        await RequireEditor("if(document.querySelector('[data-inline-editor]')) throw Error('Corrected editor did not close'); const t=document.querySelector('text[data-drawing-key=\"Core Network|title|edge\"]'); if(!t?.textContent.includes('Native repaired title')) throw Error('Corrected title was not saved')","save corrected title");
        await PanEditorTargetIntoView(sw);
        await ClickEditorTarget(sw,2);
        await RequireEditor("const t=document.querySelector('[data-inline-editor] textarea'); if(t?.value!=='SW-1') throw Error('Another item could not be selected and edited'); t.value='Do not keep this'","select another item");
        await EditorKey("Escape",27);
        await RequireEditor("if(document.querySelector('[data-inline-editor]')) throw Error('Cancel did not close the editor'); const t=document.querySelector('text[data-drawing-key=\"Core Network|title|sw-1\"]'); if(!t?.textContent.includes('SW-1')) throw Error('Cancel replaced the original title')","cancel draft");
        await PanEditorTargetIntoView(sw);
        await ClickEditorTarget(sw,2);
        await RequireEditor("const t=document.querySelector('[data-inline-editor] textarea');if(!t?.isConnected)throw Error('Second editor did not attach');t.value='Temporary draft to cancel'","start another draft");
        await EditorKey("Escape",27);
        await RequireEditor("if(document.querySelector('[data-inline-editor]'))throw Error('Escape did not clear the second draft')","second Escape recovery");
        await ClickEditorTarget("#page-options");
        await RequireEditor("if(!document.getElementById('dialog').open||document.getElementById('dialog-title').textContent!=='Page options') throw Error('Page options remained blocked')","page options after Escape");
        await ClickEditorTarget("#close");
        await PanEditorTargetIntoView(edge);
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
        await browser.CoreWebView2.ExecuteScriptAsync("document.getElementById('sample').click()");
        string saved=await SaveNativeExport("svg",".svg",folder);
        if(!File.ReadAllText(saved).Contains("<svg")||XDocument.Load(saved).Root?.Name!=XName.Get("svg","http://www.w3.org/2000/svg"))
            throw new Exception("The selected sample SVG page was not saved as a valid SVG document.");
        string drawing=await SaveNativeExport("export",".vsdx",folder);
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
        await CheckSwitchportReports(folder);
        await browser.CoreWebView2.ExecuteScriptAsync("document.getElementById('print').click()");
        await Printed.Task.WaitAsync(TimeSpan.FromSeconds(30));
    }
    async Task CheckSwitchportReports(string folder)
    {
        await ClickEditorTarget("#switchport-reports");
        await RequireEditor("if(!document.getElementById('dialog').open||document.getElementById('dialog-title').textContent!=='Switchport reports')throw Error('Report options did not open');const field=name=>[...document.querySelectorAll('#dialog-body label')].find(label=>label.textContent===name)?.control;field('Preview').value='booklet';field('Report title').value='Native switchport smoke';field('Export folder / file name').value='Native switchport package';for(const row of document.querySelectorAll('.report-device-row')){const check=row.querySelector('input[type=checkbox]');check.checked=row.textContent.includes('SW-1 |');check.dispatchEvent(new Event('change'));}if([...document.querySelectorAll('.report-device-row input')].filter(input=>input.checked).length!==1)throw Error('Report selection did not retain one device');const build=[...document.querySelectorAll('#dialog button')].find(button=>button.textContent==='Build reports');if(!build)throw Error('Build reports action missing');build.dataset.nativeReport='build'","report options and selected device");
        await ClickEditorTarget("[data-native-report='build']");
        await RequireEditor("if(document.getElementById('dialog').open||!document.querySelector('#canvas svg')||!document.getElementById('feedback').textContent.includes('Switchport reports built')||![...document.querySelectorAll('#tabs button')].some(button=>button.textContent.includes('SW-1')))throw Error('Selected report did not build in the common page workspace')","built report page");
        const string configuration="; JL256A Configuration Editor\nhostname LAB-NATIVE-REPORT\nvlan 10\n name Data\n untagged 1-48\n tagged 49-52\n exit\nvlan 150\n name Voice\n tagged 1-52\n voice\n exit\n";
        string start="window.__nativeSwitchport={pending:true};(async()=>{const catalog=await NDSDesktop.report('catalog');if(catalog.models.length<281||catalog.modules.length!==75||catalog.additionalModels.length!==10)throw Error('Embedded catalog incomplete');const imported=await NDSDesktop.report('import',{name:'fictional-native.cfg',data:btoa("+JsonSerializer.Serialize(configuration)+")});if(imported.items[0].inventory.ports.length!==52)throw Error('Native import incomplete');const request={items:imported.items,combined:true,title:'Native switchport smoke',outputLabel:'Native switchport package'};const preview=await NDSDesktop.report('preview',{request});if(!preview.items[0].success||preview.pages.length<2)throw Error(preview.items[0].error||'Native preview incomplete');window.__nativeSwitchport={done:true,request,pages:preview.pages.length};})().catch(error=>window.__nativeSwitchport={done:true,error:error.message})";
        await RequireEditor(start,"start native report bridge");
        JsonElement request=default;bool complete=false;
        for(int attempt=0;attempt<300;attempt++)
        {
            using var state=JsonDocument.Parse(await browser.CoreWebView2.ExecuteScriptAsync("window.__nativeSwitchport"));
            if(state.RootElement.TryGetProperty("done",out var done)&&done.GetBoolean())
            {
                if(state.RootElement.TryGetProperty("error",out var error))throw new Exception("Packaged report bridge: "+error.GetString());
                request=state.RootElement.GetProperty("request").Clone();complete=true;break;
            }
            await Task.Delay(100);
        }
        if(!complete)throw new Exception("Packaged report bridge timed out.");
        // Windows CI runs this host copied as one EXE. Real rendering here proves
        // its embedded catalog/fonts/native Skia assets work after extraction.
        if(File.Exists(Path.Combine(Path.GetDirectoryName(Environment.ProcessPath!)!,"libSkiaSharp.dll")))throw new Exception("The report smoke requires the single-EXE copy, without a Skia sidecar.");
        string exported=await Task.Run(()=>SwitchportReportService.ExportJson(request.GetRawText(),folder));
        using var result=JsonDocument.Parse(exported);var item=result.RootElement.GetProperty("items")[0];
        if(!item.GetProperty("success").GetBoolean())throw new Exception("Packaged report export: "+item.GetProperty("error").GetString());
        string output=item.GetProperty("outputDirectory").GetString()!;
        foreach(string name in new[]{"wall-chart.png","a4-one-page.png","a4-one-page.pdf","a4-booklet.pdf","inventory.json","port-map.csv","technician-summary.txt","validation-report.txt"})
            if(!File.Exists(Path.Combine(output,name))||new FileInfo(Path.Combine(output,name)).Length<50)throw new Exception("Packaged report missing "+name);
        if(!File.ReadAllText(Path.Combine(output,"validation-report.txt")).Contains("RENDER_BLOCKED=FALSE",StringComparison.Ordinal))throw new Exception("Packaged report failed readable geometry validation.");
        byte[] png=File.ReadAllBytes(Path.Combine(output,"wall-chart.png"));
        if(System.Buffers.Binary.BinaryPrimitives.ReadInt32BigEndian(png.AsSpan(16,4))!=3508||System.Buffers.Binary.BinaryPrimitives.ReadInt32BigEndian(png.AsSpan(20,4))!=2480)throw new Exception("Packaged report lost its 300-DPI A4 dimensions.");
        foreach(string name in new[]{"a4-one-page.pdf","a4-booklet.pdf"})if(!System.Text.Encoding.ASCII.GetString(File.ReadAllBytes(Path.Combine(output,name)),0,5).StartsWith("%PDF-",StringComparison.Ordinal))throw new Exception("Packaged report PDF is invalid.");
        if(!File.Exists(result.RootElement.GetProperty("combinedDiagramsPath").GetString())||!File.Exists(result.RootElement.GetProperty("combinedBookletPath").GetString()))throw new Exception("Packaged shared reports were not written.");
        await RequireEditor("delete window.__nativeSwitchport;document.querySelector('#tabs button').click()","finish packaged report checks");
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
