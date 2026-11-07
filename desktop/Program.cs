using System.Diagnostics;
using System.Net.NetworkInformation;
using System.Reflection;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace NetworkDiagramStudio;

static class Program
{
    [STAThread]
    static int Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        try
        {
            if (args is ["--convert-stencil", var stencilNonce, var extension]) return StencilConversion.Run(stencilNonce, extension);
            if (args is ["--apply-update", var token])
            {
                try { return Installer.Apply(token); }
                catch (Exception error) { File.WriteAllText(Path.Combine(Policy.Home,"last-update-error.txt"),error.Message); return 1; }
            }
#if NDS_TEST_HOST
            if (args.Length > 0 && args[0].StartsWith("--test-", StringComparison.Ordinal)) return NativeSmoke.Run(args);
            if (args is ["--confirm-update", _] && Environment.GetEnvironmentVariable("NDS_SIMULATE_FAILED_HEALTH") == "1") return 9;
#endif
            using var single = new Mutex(true, "Local\\NetworkDiagramStudio-UI", out var first);
            if (!first) { MessageBox.Show("NetworkDiagramStudio is already open.", "NetworkDiagramStudio"); return 0; }
            using var window = new Studio(args is ["--confirm-update", var id] ? id : null);
            Application.Run(window); return 0;
        }
        catch (Exception e)
        {
#if NDS_TEST_HOST
            if ((args.Length > 0 && args[0].StartsWith("--test-",StringComparison.Ordinal)) || Environment.GetEnvironmentVariable("NDS_TEST_ERROR_LOG") != null)
            {
                var log=Environment.GetEnvironmentVariable("NDS_TEST_ERROR_LOG");
                if (!string.IsNullOrEmpty(log)) File.AppendAllText(log, e+Environment.NewLine);
                Console.Error.WriteLine(e); return 1;
            }
#endif
            MessageBox.Show(e.Message, "NetworkDiagramStudio", MessageBoxButtons.OK, MessageBoxIcon.Error); return 1;
        }
    }
}

internal sealed partial class Studio : Form
{
    const string Origin = "https://studio.networkdiagram.invalid";
    readonly WebView2 browser = new() { Dock = DockStyle.Fill };
    readonly FlowLayoutPanel strip = new() { Dock = DockStyle.Top, AutoSize = true, Padding = new Padding(6), BackColor = Color.WhiteSmoke, WrapContents = true, Visible = false };
    readonly Label summary = new() { AutoSize = true, Margin = new Padding(4,8,4,0) };
    readonly Label status = new() { AutoSize = true, MaximumSize = new Size(520,0), Margin = new Padding(4, 8, 9, 0), Text = "Windows preview" };
    readonly Button check = ButtonOf("Check updates"), download = ButtonOf("Download"), install = ButtonOf("Install and restart"), notes = ButtonOf("Read more");
    readonly System.Windows.Forms.Timer timer = new() { Interval = 300_000 };
    readonly Updater updater;
    readonly string? token;
    bool loaded, busy, fetching, checking, ready, healthy;
    int downloadProgress;
    internal bool IsEditorHealthy => healthy;
    static Button ButtonOf(string text) => new() { Text = text, AutoSize = true, FlatStyle = FlatStyle.System };
    public Studio(string? nonce, Updater? client = null)
    {
        updater = client ?? new Updater();
        token = nonce; Text = "NetworkDiagramStudio"; Width = 1380; Height = 900; MinimumSize = new Size(720, 520);
        Icon = System.Drawing.Icon.ExtractAssociatedIcon(Environment.ProcessPath!);
        Controls.Add(browser); Controls.Add(strip); strip.Controls.AddRange([status, check, summary, notes, download, install]);
        var updateDetails=ButtonOf("Update details");strip.Controls.Add(updateDetails);
        updateDetails.Click+=(_,_)=>ShowUpdateDetails();
        RefreshButtons();
        Shown += async (_, _) => { timer.Start(); _ = Check(TimeSpan.Zero); await InitializeBrowser(); };
        Activated += async (_, _) => { if (loaded && NetworkInterface.GetIsNetworkAvailable()) await Check(TimeSpan.FromMinutes(2)); };
        timer.Tick += async (_, _) => { if (NetworkInterface.GetIsNetworkAvailable()) await Check(TimeSpan.FromSeconds(30)); };
        check.Click += async (_, _) => await Check(TimeSpan.Zero, true);
        download.Click += async (_, _) => await DownloadUpdate();
        install.Click += (_, _) => InstallUpdate();
        notes.Click += (_, _) => { var release = updater.Offered; if (release != null) MessageBox.Show(this, string.IsNullOrWhiteSpace(release.Notes) ? "No release notes were provided." : release.Notes[..Math.Min(4000,release.Notes.Length)], "What's new in " + release.Tag); };
    }
    async Task DownloadUpdate()
    { if(fetching || checking || updater.Offered == null)return; fetching = true; downloadProgress=0; RefreshButtons(); try { await updater.Download(new Progress<int>(p => {downloadProgress=p; status.Text = p>=100?"Verifying download...":$"Downloading {p}%"; PublishUpdateState();})); status.Text = "Verified and ready to install."; } catch (Exception e) { status.Text = e.Message; } finally { fetching = false; RefreshButtons(); }
    }
    void InstallUpdate()
    { if (busy || fetching || !updater.Downloaded || updater.Offered == null) return;
            if (MessageBox.Show(this, "Save your project before restarting. Install the downloaded update?", Text, MessageBoxButtons.OKCancel) != DialogResult.OK) return;
            try { Installer.Begin(updater.Offered); Close(); } catch (Exception e) { status.Text = "Install failed. " + e.Message; PublishUpdateState(); }
    }
    void ShowUpdateDetails()
    {
        using var view=new Form {Text="Update details",Width=780,Height=450,StartPosition=FormStartPosition.CenterParent,Icon=Icon};
        var report=new TextBox {Dock=DockStyle.Fill,ReadOnly=true,Multiline=true,ScrollBars=ScrollBars.Vertical,Text=updater.Report};
        var copy=ButtonOf("Copy details");copy.Dock=DockStyle.Bottom;copy.Click+=(_,_)=>Clipboard.SetText(updater.Report);
        view.Controls.Add(report);view.Controls.Add(copy);view.ShowDialog(this);
    }
    void ShowNotices()
    {
        var assembly=typeof(Studio).Assembly;
        var names=assembly.GetManifestResourceNames().Where(n=>n.StartsWith("notices/") || n.StartsWith("web/") && (n.EndsWith("LICENSE.txt",StringComparison.OrdinalIgnoreCase) || n.EndsWith("NOTICE.txt",StringComparison.OrdinalIgnoreCase)));
        var sections=names.Order().Select(n=>{using var reader=new StreamReader(assembly.GetManifestResourceStream(n)!);return n+"\r\n\r\n"+reader.ReadToEnd();});
        using var view=new Form {Text="Third-party notices", Width=820, Height=580,StartPosition=FormStartPosition.CenterParent,Icon=Icon};
        view.Controls.Add(new TextBox {Dock=DockStyle.Fill,ReadOnly=true,Multiline=true,ScrollBars=ScrollBars.Vertical,Text=string.Join("\r\n\r\n",sections)});view.ShowDialog(this);
    }
    void PublishUpdateState()
    {
        if (!ready || IsDisposed || browser.CoreWebView2 == null) return;
        browser.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new {type="updateState",version=Policy.Current,message=status.Text,checking,fetching,available=updater.Offered!=null,releaseVersion=updater.Offered?.Tag,notes=updater.Offered?.Notes,size=updater.Offered?.Size??0,progress=downloadProgress,downloaded=updater.Downloaded,busy}));
    }
    async Task Check(TimeSpan cooldown, bool manual = false)
    {
        if (fetching || checking || IsDisposed) return;
        var previous=status.Text;
        checking = true;
        status.Text = "Checking for updates...";
        RefreshButtons();
        try { var message = await updater.Check(cooldown, manual); if (!IsDisposed) status.Text = message??previous; }
        catch (Exception e) { if (!IsDisposed) status.Text = "Could not check. " + e.Message; }
        finally { checking = false; if (!IsDisposed) RefreshButtons(); }
    }
    void RefreshButtons()
    {
        strip.Visible = false; // The editor hosts the compact update notice and details panel.
        download.Visible = updater.Offered != null && !updater.Downloaded; install.Visible = updater.Downloaded;
        install.Enabled = !busy && ready && !fetching && !checking; check.Enabled = download.Enabled = !fetching && !checking;
        check.Text = checking ? "Checking..." : "Check updates";
        var lines = (updater.Offered?.Notes ?? "").Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(line => !line.StartsWith('#')).Select(line => line.TrimStart('-', '*', ' ')).Where(line => line.Length > 0).ToArray();
        var first = lines.FirstOrDefault() ?? "";
        summary.Visible = first.Length > 0;
        summary.Text = first.Length > 86 ? first[..83] + "..." : first;
        notes.Visible = lines.Length > 1 || first.Length > 86;
        PublishUpdateState();
    }
    async Task InitializeBrowser()
    {
        try
        {
#if NDS_TEST_HOST
            RecordEditorStartup("InitializeBrowser started.");
#endif
            var assemblyDir=Path.GetDirectoryName(typeof(Studio).Assembly.Location);
            if (!string.IsNullOrEmpty(assemblyDir)) {
                var loaders=Path.Combine(assemblyDir,"runtimes","win-x64","native");
                if (File.Exists(Path.Combine(loaders,"WebView2Loader.dll"))) CoreWebView2Environment.SetLoaderDllFolderPath(loaders);
            }
            var environment = await CoreWebView2Environment.CreateAsync(null, Path.Combine(Policy.Home, "WebView2"));
#if NDS_TEST_HOST
            RecordEditorStartup("WebView environment created: "+environment.BrowserVersionString);
#endif
            await browser.EnsureCoreWebView2Async(environment);
            var core = browser.CoreWebView2; core.Settings.AreHostObjectsAllowed = false;
            core.Settings.AreDefaultContextMenusEnabled = false;
#if NDS_TEST_HOST
            RecordEditorStartup("CoreWebView2 initialized.");
            await CaptureEditorStartupDiagnostics(core);
#endif
            var assembly = Assembly.GetExecutingAssembly();
            var files = assembly.GetManifestResourceNames().Where(n => n.StartsWith("web/", StringComparison.Ordinal)).ToDictionary(n => n[4..].Replace('\\', '/'), n => n, StringComparer.Ordinal);
            core.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
            core.WebResourceRequested += (_, e) => {
                var uri = new Uri(e.Request.Uri);
                if (uri.Scheme is "data" or "blob") return;
                var name = uri.AbsolutePath.TrimStart('/');
                if (uri.GetLeftPart(UriPartial.Authority) != Origin || !files.TryGetValue(name, out var resource)) { e.Response = environment.CreateWebResourceResponse(null, 404, "Not found", ""); return; }
                var mime = Path.GetExtension(name).ToLowerInvariant() switch { ".html" => "text/html", ".css" => "text/css", ".js" or ".mjs" => "text/javascript", ".json" => "application/json", ".svg" => "image/svg+xml", ".png" => "image/png", ".wasm" => "application/wasm", _ => "application/octet-stream" };
                e.Response = environment.CreateWebResourceResponse(assembly.GetManifestResourceStream(resource),200,"OK","Content-Type: "+mime+"\r\nX-Content-Type-Options: nosniff");
            };
            core.DownloadStarting += (_, e) => {
                // Only the local editor can start a file export. Get off the WebView
                // callback stack before showing a native modal Save As dialog.
                if (!e.DownloadOperation.Uri.StartsWith("blob:"+Origin+"/", StringComparison.Ordinal)) { e.Cancel=true; return; }
                var deferral=e.GetDeferral(); e.Handled=true;
                BeginInvoke((Action)(() => { try {
                    using var save=new SaveFileDialog {FileName=Path.GetFileName(e.ResultFilePath),OverwritePrompt=true,AddExtension=false,Title="Save exported file"};
                    #if NDS_TEST_HOST
                    if (TestOutputFolder != null) save.InitialDirectory=TestOutputFolder;
#endif
                    if(save.ShowDialog(this)==DialogResult.OK) e.ResultFilePath=save.FileName; else e.Cancel=true;
                } finally { deferral.Complete(); } }));
            };
            core.NavigationStarting += (_, e) => { if (!e.Uri.StartsWith(Origin+"/",StringComparison.Ordinal)) e.Cancel = true; };
            core.NewWindowRequested += (_, e) => { e.Handled = true; };
            core.WebMessageReceived += async (_,e) => {
                if (!e.Source.StartsWith(Origin+"/",StringComparison.Ordinal)) return;
                string msg; try { msg=e.TryGetWebMessageAsString(); } catch (ArgumentException) { return; }
                if (msg.StartsWith("stencil:", StringComparison.Ordinal)) {
                    string? requestId = null;
                    try {
                        using var request = JsonDocument.Parse(msg[8..]);
                        requestId = request.RootElement.GetProperty("id").GetString();
                        if (requestId == null || requestId.Length > 64) return;
                        var converted = await StencilConversion.Convert(request.RootElement.GetProperty("name").GetString()!, request.RootElement.GetProperty("data").GetString()!);
                        if (!IsDisposed) core.PostWebMessageAsJson(JsonSerializer.Serialize(new { type="stencilConverted",id=requestId,name=converted.Name,data=converted.Data }));
                    } catch (Exception error) { if (!IsDisposed) core.PostWebMessageAsJson(JsonSerializer.Serialize(new {type="stencilConverted",id=requestId,error=error.Message})); }
                    return;
                }
                switch(msg) { case "ready": ready=true; ConfirmHealth(); break; case "busy": busy=true; break; case "idle": busy=false; break;
                    case "checkUpdates": await Check(TimeSpan.Zero,true); break;
                    case "downloadUpdate": if(!fetching&&!checking&&updater.Offered!=null)await DownloadUpdate(); break;
                    case "installUpdate": if(!busy&&!fetching&&!checking&&ready&&updater.Downloaded)InstallUpdate(); break;
                    case "updateDetails": BeginInvoke((Action)ShowUpdateDetails); break;
                    case "notices": BeginInvoke((Action)ShowNotices); break;
                    case "print":
#if NDS_TEST_HOST
                    if (TestOutputFolder != null) { _ = PrintTestPages(); break; }
#endif
                    BeginInvoke((Action)(() => core.ShowPrintUI())); break; }
                if (!IsDisposed) RefreshButtons();
            };
            core.NavigationCompleted += (_, e) => { loaded=e.IsSuccess; ConfirmHealth(); };
            await core.AddScriptToExecuteOnDocumentCreatedAsync("(()=>{\n    const pending=new Map();let updateState={};\n    chrome.webview.addEventListener('message',e=>{const m=e.data;if(m?.type==='updateState'){updateState=Object.freeze(m);window.dispatchEvent(new Event('nds-update-state'));return;}if(m?.type!=='stencilConverted')return;const entry=pending.get(m.id);if(!entry)return;pending.delete(m.id);clearTimeout(entry.timer);m.error?entry.reject(Error(m.error)):entry.resolve(m);});\n    Object.defineProperty(window,'NDSDesktop',{value:Object.freeze({\n        get updateState(){return updateState;},checkUpdates:()=>chrome.webview.postMessage('checkUpdates'),downloadUpdate:()=>chrome.webview.postMessage('downloadUpdate'),installUpdate:()=>chrome.webview.postMessage('installUpdate'),updateDetails:()=>chrome.webview.postMessage('updateDetails'),notices:()=>chrome.webview.postMessage('notices'),\n        ready:()=>chrome.webview.postMessage('ready'),setBusy:b=>chrome.webview.postMessage(b?'busy':'idle'),print:()=>chrome.webview.postMessage('print'),\n        convertStencil:async file=>{\n            if(file.size>160*1024*1024)throw Error('Stencil exceeds 160 MB.');\n            const data=await new Promise((yes,no)=>{const reader=new FileReader();reader.onload=()=>yes(reader.result.split(',')[1]);reader.onerror=()=>no(Error('Could not read stencil.'));reader.readAsDataURL(file);});\n            return new Promise((resolve,reject)=>{const id=crypto.randomUUID();const timer=setTimeout(()=>{pending.delete(id);reject(Error('Visio conversion timed out.'));},135000);pending.set(id,{resolve,reject,timer});chrome.webview.postMessage('stencil:'+JSON.stringify({id,name:file.name,data}));});\n        }\n    })});\n})();");
            core.Navigate(Origin+"/index.html");
        }
        catch (Exception e) {
#if NDS_TEST_HOST
            RecordEditorStartup("InitializeBrowser exception: "+e);
#endif
            status.Text = "Could not open the editor."; MessageBox.Show(this, "The desktop editor needs the Microsoft Edge WebView2 Runtime. The portable web ZIP also opens in a browser.\n\n"+e.Message,Text); }
    }
    void ConfirmHealth() { if (!healthy && loaded && ready && Visible) { healthy=true; Installer.Healthy(token); Installer.CleanupHelper(); } }
    protected override void Dispose(bool disposing) { if (disposing) { timer.Dispose(); updater.Dispose(); } base.Dispose(disposing); }
}
