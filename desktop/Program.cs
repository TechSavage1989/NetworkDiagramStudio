using System.Diagnostics;
using System.Net.NetworkInformation;
using System.Reflection;
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
    readonly FlowLayoutPanel strip = new() { Dock = DockStyle.Top, AutoSize = true, Padding = new Padding(6), BackColor = Color.WhiteSmoke, WrapContents = true };
    readonly Label summary = new() { AutoSize = true, Margin = new Padding(4,8,4,0) };
    readonly Label status = new() { AutoSize = true, Margin = new Padding(4, 8, 9, 0), Text = "Windows preview" };
    readonly Button check = ButtonOf("Check updates"), download = ButtonOf("Download"), install = ButtonOf("Install and restart"), notes = ButtonOf("Read more");
    readonly System.Windows.Forms.Timer timer = new() { Interval = 300_000 };
    readonly Updater updater;
    readonly string? token;
    bool loaded, busy, fetching, ready, healthy;
    internal bool IsEditorHealthy => healthy;
    static Button ButtonOf(string text) => new() { Text = text, AutoSize = true, FlatStyle = FlatStyle.System };
    public Studio(string? nonce, Updater? client = null)
    {
        updater = client ?? new Updater();
        token = nonce; Text = "NetworkDiagramStudio"; Width = 1380; Height = 900; MinimumSize = new Size(720, 520);
        Controls.Add(browser); Controls.Add(strip); strip.Controls.AddRange([status, check, summary, notes, download, install]);
        var notices = ButtonOf("Notices"); strip.Controls.Add(notices);
        notices.Click += (_,_) => {
            var assembly=typeof(Studio).Assembly;
            var names=assembly.GetManifestResourceNames().Where(n=>n.StartsWith("notices/") || n.StartsWith("web/") && (n.EndsWith("LICENSE.txt",StringComparison.OrdinalIgnoreCase) || n.EndsWith("NOTICE.txt",StringComparison.OrdinalIgnoreCase)));
            var sections=names.Order().Select(n=>{using var reader=new StreamReader(assembly.GetManifestResourceStream(n)!);return n+"\r\n\r\n"+reader.ReadToEnd();});
            using var view=new Form {Text="Third-party notices", Width=820, Height=580,StartPosition=FormStartPosition.CenterParent};
            view.Controls.Add(new TextBox {Dock=DockStyle.Fill,ReadOnly=true,Multiline=true,ScrollBars=ScrollBars.Vertical,Text=string.Join("\r\n\r\n",sections)}); view.ShowDialog(this);
        };
        RefreshButtons();
        Shown += async (_, _) => { timer.Start(); _ = Check(TimeSpan.Zero); await InitializeBrowser(); };
        Activated += async (_, _) => { if (loaded && NetworkInterface.GetIsNetworkAvailable()) await Check(TimeSpan.FromMinutes(2)); };
        timer.Tick += async (_, _) => { if (NetworkInterface.GetIsNetworkAvailable()) await Check(TimeSpan.FromSeconds(30)); };
        check.Click += async (_, _) => await Check(TimeSpan.FromSeconds(30));
        download.Click += async (_, _) => { fetching = true; RefreshButtons(); try { await updater.Download(new Progress<int>(p => status.Text = $"Downloading {p}%")); status.Text = "Verified and ready to install."; } catch (Exception e) { status.Text = e.Message; } finally { fetching = false; RefreshButtons(); } };
        install.Click += (_, _) => { if (busy || fetching || !updater.Downloaded || updater.Offered == null) return;
            if (MessageBox.Show(this, "Save your project before restarting. Install the downloaded update?", Text, MessageBoxButtons.OKCancel) != DialogResult.OK) return;
            try { Installer.Begin(updater.Offered); Close(); } catch (Exception e) { status.Text = "Install failed. " + e.Message; } };
        notes.Click += (_, _) => { var release = updater.Offered; if (release != null) MessageBox.Show(this, string.IsNullOrWhiteSpace(release.Notes) ? "No release notes were provided." : release.Notes[..Math.Min(4000,release.Notes.Length)], "What's new in " + release.Tag); };
    }
    async Task Check(TimeSpan cooldown)
    {
        if (fetching || IsDisposed) return;
        try { var message = await updater.Check(cooldown); if (message != null && !IsDisposed) { status.Text = message; RefreshButtons(); } }
        catch (Exception e) { if (!IsDisposed) status.Text = "Could not check. " + e.Message; }
    }
    void RefreshButtons()
    {
        download.Visible = updater.Offered != null && !updater.Downloaded; install.Visible = updater.Downloaded;
        install.Enabled = !busy && ready && !fetching; check.Enabled = download.Enabled = !fetching;
        var lines = (updater.Offered?.Notes ?? "").Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(line => !line.StartsWith('#')).Select(line => line.TrimStart('-', '*', ' ')).Where(line => line.Length > 0).ToArray();
        var first = lines.FirstOrDefault() ?? "";
        summary.Visible = first.Length > 0;
        summary.Text = first.Length > 86 ? first[..83] + "..." : first;
        notes.Visible = lines.Length > 1 || first.Length > 86;
    }
    async Task InitializeBrowser()
    {
        try
        {
            var assemblyDir=Path.GetDirectoryName(typeof(Studio).Assembly.Location);
            if (!string.IsNullOrEmpty(assemblyDir)) {
                var loaders=Path.Combine(assemblyDir,"runtimes","win-x64","native");
                if (File.Exists(Path.Combine(loaders,"WebView2Loader.dll"))) CoreWebView2Environment.SetLoaderDllFolderPath(loaders);
            }
            var environment = await CoreWebView2Environment.CreateAsync(null, Path.Combine(Policy.Home, "WebView2"));
            await browser.EnsureCoreWebView2Async(environment);
            var core = browser.CoreWebView2; core.Settings.AreHostObjectsAllowed = false;
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
            core.WebMessageReceived += (_,e) => {
                if (!e.Source.StartsWith(Origin+"/",StringComparison.Ordinal)) return;
                string msg; try { msg=e.TryGetWebMessageAsString(); } catch (ArgumentException) { return; }
                switch(msg) { case "ready": ready=true; ConfirmHealth(); break; case "busy": busy=true; break; case "idle": busy=false; break; case "print":
#if NDS_TEST_HOST
                    if (TestOutputFolder != null) { _ = PrintTestPages(); break; }
#endif
                    BeginInvoke((Action)(() => core.ShowPrintUI())); break; }
                RefreshButtons();
            };
            core.NavigationCompleted += (_, e) => { loaded=e.IsSuccess; ConfirmHealth(); };
            await core.AddScriptToExecuteOnDocumentCreatedAsync("Object.defineProperty(window,'NDSDesktop',{value:Object.freeze({ready:()=>chrome.webview.postMessage('ready'),setBusy:b=>chrome.webview.postMessage(b?'busy':'idle'),print:()=>chrome.webview.postMessage('print')})});");
            core.Navigate(Origin+"/index.html");
        }
        catch (Exception e) { status.Text = "Could not open the editor."; MessageBox.Show(this, "The desktop editor needs the Microsoft Edge WebView2 Runtime. The portable web ZIP also opens in a browser.\n\n"+e.Message,Text); }
    }
    void ConfirmHealth() { if (!healthy && loaded && ready && Visible) { healthy=true; Installer.Healthy(token); Installer.CleanupHelper(); } }
    protected override void Dispose(bool disposing) { if (disposing) { timer.Dispose(); updater.Dispose(); } base.Dispose(disposing); }
}
