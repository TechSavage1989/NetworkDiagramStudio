using System.Diagnostics;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using NetworkDiagramStudio.SwitchportReports;

namespace NetworkDiagramStudio;

internal sealed partial class Studio
{
    readonly HashSet<string> reportFiles = new(StringComparer.OrdinalIgnoreCase);
    string? reportFolder;
    bool reporting;
    static string ReportOutputPreference => Path.Combine(Policy.Home, "report-output-folder.txt");
    static string PreviousReportOutput()
    {
        try { var path = File.ReadAllText(ReportOutputPreference).Trim(); return Directory.Exists(path) ? path : ""; }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException) { return ""; }
    }
    static void RememberReportOutput(string path)
    {
        try { Directory.CreateDirectory(Policy.Home); File.WriteAllText(ReportOutputPreference, path); }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException) { }
    }

    async Task HandleReportRequest(CoreWebView2 core, string message)
    {
        string? id = null;
        try
        {
            if (message.Length > 150_000_000) throw new InvalidOperationException("Report request exceeds the local size limit.");
            using var document = JsonDocument.Parse(message);
            var request = document.RootElement;
            id = request.GetProperty("id").GetString();
            if (id is null || id.Length > 64) return;
            string action = request.GetProperty("action").GetString() ?? "";
            string result;
            if (action == "open")
            {
                string path = request.GetProperty("path").GetString() ?? "";
                if (path != reportFolder && !reportFiles.Contains(path)) throw new InvalidOperationException("Build the report before opening an exported file.");
                if (!File.Exists(path) && !Directory.Exists(path)) throw new FileNotFoundException("The exported report has been moved or removed.");
                Process.Start(new ProcessStartInfo(path) { UseShellExecute = true });
                result = "{\"opened\":true}";
            }
            else
            {
                if (reporting) throw new InvalidOperationException("A report is already being prepared.");
                reporting = true;
                try
                {
                    if (action == "catalog") result = await Task.Run(SwitchportReportService.CatalogJson);
                    else if (action == "import" || action == "supplementary")
                    {
                        string name = Path.GetFileName(request.GetProperty("name").GetString() ?? "input.cfg");
                        byte[] bytes = Convert.FromBase64String(request.GetProperty("data").GetString() ?? "");
                        if (bytes.Length > 100 * 1024 * 1024) throw new InvalidOperationException("Choose an input under 100 MB.");
                        result = action == "import"
                            ? await Task.Run(() => SwitchportReportService.ImportJson(name, bytes))
                            : await Task.Run(() => SwitchportReportService.SupplementaryJson(name, bytes,
                                request.GetProperty("deviceNames").EnumerateArray().Select(v => v.GetString() ?? "").ToArray()));
                    }
                    else if (action == "preview")
                    {
                        string json = request.GetProperty("request").GetRawText();
                        result = await Task.Run(() => SwitchportReportService.PreviewJson(json));
                    }
                    else if (action == "export")
                    {
                        string json = request.GetProperty("request").GetRawText();
                        using var folder = new FolderBrowserDialog { Description = "Choose where to save the switchport report package", UseDescriptionForTitle = true, ShowNewFolderButton = true, SelectedPath = PreviousReportOutput() };
                        if (folder.ShowDialog(this) != DialogResult.OK) result = "{\"cancelled\":true}";
                        else
                        {
                            RememberReportOutput(folder.SelectedPath);
                            result = await Task.Run(() => SwitchportReportService.ExportJson(json, folder.SelectedPath));
                            using var exported = JsonDocument.Parse(result);
                            var root = exported.RootElement;
                            bool succeeded = root.TryGetProperty("items", out var items) && items.EnumerateArray().Any(item => item.TryGetProperty("success", out var success) && success.ValueKind == JsonValueKind.True);
                            if (succeeded)
                            {
                            reportFiles.Clear();
                            reportFolder = root.TryGetProperty("outputDirectory", out var output) ? output.GetString() : null;
                            if (root.TryGetProperty("files", out var files)) foreach (var file in files.EnumerateArray())
                            {
                                string? path = file.ValueKind == JsonValueKind.String ? file.GetString() : file.TryGetProperty("path", out var value) ? value.GetString() : null;
                                if (path != null && reportFolder != null && Path.GetFullPath(path).StartsWith(Path.GetFullPath(reportFolder) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) reportFiles.Add(path);
                            }
                            }
                        }
                    }
                    else throw new InvalidOperationException("Unsupported report operation.");
                }
                finally { reporting = false; }
            }
            using var response = JsonDocument.Parse(result);
            if (!IsDisposed) core.PostWebMessageAsJson(JsonSerializer.Serialize(new { type = "reportResult", id, result = response.RootElement }));
        }
        catch (Exception error)
        {
            if (!IsDisposed) core.PostWebMessageAsJson(JsonSerializer.Serialize(new { type = "reportResult", id, error = error.Message }));
        }
    }
}
