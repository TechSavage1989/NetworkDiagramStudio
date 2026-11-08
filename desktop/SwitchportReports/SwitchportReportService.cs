using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using SwitchportGenerator;
using Group = SwitchportGenerator.Group;

namespace NetworkDiagramStudio.SwitchportReports;

/// <summary>
/// Native report API for the existing local editor. No method persists raw
/// configurations. Only explicit import calls accept configuration bytes.
/// </summary>
public static class SwitchportReportService
{
    public const string SourceVersion = "1.18.5";
    public const string SourceCommit = "2327083bcd4301db1cc7c162a764540190c5d7ad";
    internal static readonly JsonSerializerOptions Json = new()
    { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, PropertyNameCaseInsensitive = true, WriteIndented = true, MaxDepth = 64 };
    sealed class Item
    {
        public string Id { get; init; } = "";
        public string Name { get; init; } = "";
        public Inventory Inventory { get; init; } = new();
        public List<SupplementarySource> Supplementary { get; init; } = new();
        public string Error { get; init; } = "";
    }
    sealed class Request
    {
        public List<Item> Items { get; } = new();
        public string OutputLabel { get; init; } = "Switchport reports";
        public string? Title { get; init; }
        public bool Combined { get; init; } = true;
        public string LogoDataUrl { get; init; } = "";
        public WorkspacePaletteOverrides Palette { get; init; } = new();
    }
    public static string CatalogJson()
    {
        var moduleLayouts = new Dictionary<string, object>(StringComparer.Ordinal);
        var moduleKeys = new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);
        object SlotJson(ModuleSlotChoice slot, string parent) => new
        {
            slot.Slot, slot.Label, slot.DetectedSku, slot.SelectedSku,
            options = slot.Options.Select(option =>
            {
                object fragment = CatalogGeometry.Module(parent, slot.Slot, option.Sku);
                string key = option.Sku + ":" + Hash(JsonSerializer.SerializeToUtf8Bytes(fragment, Json))[..16];
                moduleLayouts.TryAdd(key, fragment);
                if (!moduleKeys.TryGetValue(option.Sku, out var keys)) moduleKeys[option.Sku] = keys = new(StringComparer.Ordinal);
                keys.Add(key);
                return new { option.Sku, option.Name, option.Source, option.LayoutSource, option.Notes, layoutKey = key };
            }).ToArray()
        };
        var models = DeviceModels.Choices.Select(choice =>
        {
            var hardware = HardwareCatalog.Find(choice.Sku); var cisco = CiscoHardware.Find(choice.Sku);
            var chassis = HardwareProfiles.ChassisModels.GetValueOrDefault(choice.Sku);
            return new
            {
                sku = choice.Sku, name = choice.Name, kind = choice.Kind,
                os = hardware?.OS ?? (cisco != null ? "Cisco IOS / IOS XE" : choice.Sku.StartsWith("CRS", StringComparison.Ordinal) ? "RouterOS" : choice.Kind == "Firewall" ? "FortiOS" : "AOS-Switch"),
                source = hardware?.Source ?? cisco?.Source ?? (choice.Sku.StartsWith("CRS", StringComparison.Ordinal) ? MikroTikParser.ModelSource(choice.Sku) : choice.Kind == "Firewall" ? FortiOsParser.HardwareReference : ""),
                layoutSource = hardware?.LayoutSource ?? cisco?.Source ?? "", notes = hardware?.Notes ?? "",
                chassisSlots = chassis.Slots, physicalInterfaces = hardware != null ? hardware.Copper + hardware.Optical : cisco?.Sockets.Count(socket => !socket.ConfiguredInterface) ?? 0,
                slots = SlotsFor(choice.Sku, choice.Kind, hardware?.OS ?? "AOS-Switch").Select(slot => SlotJson(slot, choice.Sku)).ToArray(),
                inventory = CatalogGeometry.Model(choice.Sku)
            };
        }).ToArray();
        var instantOn = NormalizedInventory.InstantOn1930.Select(sku => new { sku, name = "Instant On 1930 " + sku, kind = "Switch", os = "Instant On 1930", source = "https://arubanetworking.hpe.com/techdocs/InstantOn_1930_Switch/igsg/", status = "supported", inventory = CatalogGeometry.Model(sku) }).ToArray();
        return JsonSerializer.Serialize(new
        {
            version = SourceVersion, sourceCommit = SourceCommit, models, additionalModels = instantOn,
            modules = HardwareCatalog.Modules.Select(module => new ModuleChoice { Sku = module.Sku, Name = module.Name, Source = module.Source, LayoutSource = module.LayoutSource, Notes = module.Notes }).Concat(CiscoModuleCatalog.Choices)
                .Select(module => new { module.Sku, module.Name, module.Source, module.LayoutSource, module.Notes, layoutKeys = moduleKeys.GetValueOrDefault(module.Sku) ?? new HashSet<string>(), sockets = HardwareCatalog.Find(module.Sku)?.Sockets }),
            moduleLayouts,
            research = HardwareCatalog.All.Where(model => model.Status != "supported"),
            limits = new { items = 100, groups = 48, physicalInterfaces = 2000, supplementarySources = SupplementaryData.MaxSources, inputBytes = 20_000_000, workspaceBytes = 100_000_000 }
        }, Json);
    }
    static List<ModuleSlotChoice> SlotsFor(string sku, string kind, string os)
    {
        var chassis = HardwareProfiles.ChassisModels.GetValueOrDefault(sku);
        var inventory = new Inventory { OS = os, Vendor = CiscoHardware.Find(sku) != null ? "Cisco" : "Aruba/HPE", ChassisModel = chassis.Name ?? "", ChassisSlots = chassis.Slots, FlexibleUplinks = new[] { "JL071A", "JL072A", "JL073A", "JL074A", "JL075A", "JL076A" }.Contains(sku) };
        if (kind != "Chassis") inventory.Groups.Add(new Group { Id = "Switch", Device = "1", Product = sku });
        var parent = new DeviceIdentity { Id = "1", Label = kind, Kind = kind, Model = chassis.Name ?? sku, ModelSelection = sku };
        return DeviceModules.Slots(inventory, parent);
    }
    public static string ImportJson(string name, byte[] bytes)
    {
        name = SafeName(name); if (bytes == null || bytes.Length == 0) throw new InvalidOperationException("Choose a nonempty configuration or Switchport workspace.");
        var imported = new List<object>(); var warnings = new List<string>();
        string outputLabel = "", selectedId = ""; bool showWorkspaceTitle = false; var palette = new WorkspacePaletteOverrides();
        string prefix = Encoding.UTF8.GetString(bytes.AsSpan(0, Math.Min(bytes.Length, 256))).TrimStart('\uFEFF', ' ', '\t', '\r', '\n');
        bool workspaceFile = name.EndsWith(".spworkspace.json", StringComparison.OrdinalIgnoreCase);
        if (workspaceFile || prefix.StartsWith('{') && bytes.Length <= ConfigurationWorkspace.MaxWorkspaceBytes)
        {
            if (bytes.Length > ConfigurationWorkspace.MaxWorkspaceBytes) throw new InvalidOperationException("The saved workspace exceeds 100 MB.");
            string text = Encoding.UTF8.GetString(bytes).TrimStart('\uFEFF');
            using var document = JsonDocument.Parse(text);
            if (workspaceFile || document.RootElement.TryGetProperty("Format", out var format) && format.GetString() == ConfigurationWorkspace.FormatName)
            {
                var workspace = ConfigurationWorkspace.Deserialize(text);
                workspace.SavedWorkspaceName = WorkspaceNaming.FromFile(name);
                foreach (var item in workspace.Items) imported.Add(Imported(item.Id, item.Name, item.Inventory, item.SupplementarySources));
                warnings.AddRange(workspace.Items.SelectMany(item => item.Inventory.Blockers.Select(blocker => item.Name + ": " + blocker)));
                outputLabel = workspace.OutputLabel; selectedId = workspace.SelectedId ?? ""; showWorkspaceTitle = workspace.ShowWorkspaceTitle; palette = workspace.PaletteOverrides;
                return JsonSerializer.Serialize(new { items = imported, outputLabel, showWorkspaceTitle, title = WorkspaceNaming.DocumentTitle(workspace), selectedId, palette, warnings }, Json);
            }
            if (document.RootElement.TryGetProperty("Schema", out _) || document.RootElement.TryGetProperty("schema", out _))
            {
                var inventory = JsonSerializer.Deserialize<Inventory>(text, Json) ?? throw new InvalidOperationException("The normalized inventory is invalid.");
                NormalizedInventory.Validate(inventory); string id = Guid.NewGuid().ToString("N"); imported.Add(Imported(id, name, inventory, new()));
                return JsonSerializer.Serialize(new { items = imported, outputLabel, showWorkspaceTitle, selectedId = id, palette, warnings = inventory.Blockers }, Json);
            }
        }
        if (bytes.Length > 20_000_000) throw new InvalidOperationException("Configuration exceeds 20 MB.");
        string source = ConfigInput.Decode(bytes);
        if (SupplementaryData.LooksLikeCommandOutput(source)) throw new InvalidOperationException("This is supplementary command output. Attach it to the corresponding device through Imported data.");
        var parsed = DeviceModels.Parse(source, Array.Empty<DeviceIdentity>());
        NormalizedInventory.Validate(parsed); string itemId = Guid.NewGuid().ToString("N");
        imported.Add(Imported(itemId, name, parsed, new()));
        return JsonSerializer.Serialize(new { items = imported, outputLabel, showWorkspaceTitle, selectedId = itemId, palette, warnings = parsed.Blockers }, Json);
    }
    static object Imported(string id, string name, Inventory inventory, List<SupplementarySource> supplementary)
    {
        NormalizedInventory.Validate(inventory); SupplementaryData.Validate(supplementary);
        NormalizedInventory.ClearSupplementary(inventory);
        return new { id, name = SafeName(name), inventory, device = NormalizedInventory.ToDevice(inventory, id), details = inventory.Devices, supplementary };
    }
    public static string SupplementaryJson(string name, byte[] bytes, string[] deviceNames)
    {
        if (deviceNames.Length is < 1 or > 100) throw new InvalidOperationException("Select the device or devices to which this evidence belongs.");
        if (deviceNames.Any(host => string.IsNullOrWhiteSpace(host) || host.Equals("Unknown", StringComparison.OrdinalIgnoreCase)) ||
            deviceNames.Select(host => host.Trim().TrimEnd('.')).Distinct(StringComparer.OrdinalIgnoreCase).Count() != deviceNames.Length)
            throw new InvalidOperationException("Selected devices need unique identities and known names before importing evidence.");
        name = SafeName(name);
        if (name.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
            return JsonSerializer.Serialize(new { sources = SupplementaryData.FromAuvikBytes(bytes, name, deviceNames) }, Json);
        if (bytes.Length > SupplementaryData.MaxTextBytes) throw new InvalidOperationException("Supplementary input exceeds 20 MB.");
        string source = ConfigInput.Decode(bytes), prompt = SupplementaryData.PromptHostname(source);
        var matches = deviceNames.Where(host => host.Trim().TrimEnd('.').Equals(prompt.Trim().TrimEnd('.'), StringComparison.OrdinalIgnoreCase)).ToArray();
        if (matches.Length == 0) matches = deviceNames.Where(host => SupplementaryData.HostKey(host) == SupplementaryData.HostKey(prompt) && !(host.Contains('.') && prompt.Contains('.'))).ToArray();
        if (matches.Length != 1 && deviceNames.Length != 1) throw new InvalidOperationException("Select one device when the capture has no unambiguous command-prompt hostname.");
        string owner = matches.Length == 1 ? matches[0] : deviceNames[0];
        return JsonSerializer.Serialize(new { sources = new Dictionary<string, SupplementarySource> { [owner] = SupplementaryData.FromText(source, name, owner) } }, Json);
    }
    public static string PreviewJson(string requestJson)
    {
        var request = Parse(requestJson); var valid = request.Items.Where(item => item.Error.Length == 0).ToList();
        var palette = WorkspacePalette.Create(valid.Select(item => (item.Id, item.Inventory)).ToArray(), request.Palette);
        var pages = new List<object>(); var results = new List<object>(); var warnings = new List<string>(palette.Warnings);
        var combined = new List<WorkspaceSheetItem>(); var details = new List<(Item Item, Scene Page)>();
        WithLogo(request.LogoDataUrl, logo =>
        {
            foreach (var item in request.Items)
            {
                try
                {
                    if (item.Error.Length > 0) throw new InvalidOperationException(item.Error);
                    SupplementaryData.Apply(item.Inventory, item.Supplementary); palette.Apply(item.Id, item.Inventory);
                    var placements = Charts.Layout(item.Inventory); var errors = item.Inventory.Blockers.Concat(Charts.Validate(item.Inventory, placements)).Distinct().ToArray();
                    if (errors.Length > 0) throw new InvalidOperationException(string.Join("\n", errors));
                    string hash = Hash(JsonSerializer.SerializeToUtf8Bytes(item.Inventory, Json));
                    var chart = Charts.Create(item.Inventory, placements, hash); QuickSheet.FitToPage(chart);
                    var booklet = Charts.Booklet(item.Inventory, chart, hash);
                    if (logo != null) foreach (var page in booklet) logo.Apply(page);
                    var sceneErrors = booklet.SelectMany(Charts.ValidateScene).Distinct().ToArray();
                    if (sceneErrors.Length > 0) throw new InvalidOperationException(string.Join("; ", sceneErrors));
                    combined.Add(new WorkspaceSheetItem(item.Id, item.Name, item.Inventory, hash));
                    if (!request.Combined) pages.Add(SceneJson(chart, item.Id + ":diagram", item.Name, "diagram", new[] { item.Id }));
                    details.AddRange(booklet.Skip(1).Select(page => (item, page)));
                    results.Add(new { item.Id, item.Name, success = true, error = "", inventory = item.Inventory });
                }
                catch (Exception error) when (Recoverable(error)) { results.Add(new { item.Id, item.Name, success = false, error = CleanError(error) }); }
            }
            if (request.Combined && combined.Count > 0)
            {
                try
                {
                    var sheets = WorkspaceSheet.Build(combined, logo, request.Title); warnings.AddRange(sheets.Warnings);
                    pages.AddRange(sheets.Pages.Select((page, index) => SceneJson(page, "shared:" + (index + 1), "Switchport sheet " + (index + 1), "diagram", sheets.Placements.Where(placement => placement.PageNumber == index + 1).Select(placement => placement.Id).ToArray())));
                }
                catch (Exception error) when (Recoverable(error)) { warnings.Add("Shared sheets: " + CleanError(error)); }
            }
            int detail = 0;
            pages.AddRange(details.Select(item => SceneJson(item.Page, item.Item.Id + ":inventory:" + (++detail), item.Item.Name + " inventory", "inventory", new[] { item.Item.Id })));
            return true;
        });
        return JsonSerializer.Serialize(new { pages, items = results, warnings }, Json);
    }
    public static string ExportJson(string requestJson, string outputRoot)
    {
        var request = Parse(requestJson);
        var valid = request.Items.Where(item => item.Error.Length == 0).ToList();
        var palette = WorkspacePalette.Create(valid.Select(item => (item.Id, item.Inventory)).ToArray(), request.Palette);
        string directory = WorkspaceNaming.CreateOutputDirectory(outputRoot, request.OutputLabel);
        var results = new List<WorkspaceItemExport>(); var warnings = new List<string>(palette.Warnings); var images = new List<string>();
        string? diagramsPath = null, bookletPath = null; string combinedError = "";
        WithLogo(request.LogoDataUrl, logo =>
        {
            File.WriteAllText(Path.Combine(directory, "workspace-palette.json"), JsonSerializer.Serialize(new { palette.Items, palette.Warnings }, Json), new UTF8Encoding(false));
            for (int index = 0; index < request.Items.Count; index++)
            {
                var item = request.Items[index]; string output = Path.Combine(directory, (index + 1).ToString("D3") + "-" + ReportNaming.FolderName(item.Inventory));
                try
                {
                    if (item.Error.Length > 0) throw new InvalidOperationException(item.Error);
                    int code = GeneratorEntry.RunInventory(item.Inventory, output, logo, item.Supplementary, palette.ForItem(item.Id));
                    string error = code == 0 ? "" : File.Exists(Path.Combine(output, "validation-report.txt")) ? string.Join("\n", File.ReadLines(Path.Combine(output, "validation-report.txt")).Where(line => line.StartsWith("BLOCKER:", StringComparison.Ordinal))) : "Report generation was blocked.";
                    if (code != 0 && error.Length == 0) error = "Report generation was blocked. Review validation-report.txt.";
                    results.Add(new(item.Id, item.Name, output, code == 0, error));
                }
                catch (Exception error) when (Recoverable(error)) { results.Add(new(item.Id, item.Name, Directory.Exists(output) ? output : "", false, CleanError(error))); }
            }
            if (request.Combined && results.Any(item => item.Success))
            {
                try
                {
                    var inputs = new List<WorkspaceSheetItem>(); var details = new List<Scene>();
                    foreach (var result in results.Where(result => result.Success))
                    {
                        byte[] bytes = File.ReadAllBytes(Path.Combine(result.OutputDirectory, "inventory.json"));
                        var inventory = JsonSerializer.Deserialize<Inventory>(bytes, Json) ?? throw new InvalidOperationException("The generated inventory is invalid.");
                        var chart = Charts.Create(inventory, Charts.Layout(inventory), Hash(bytes));
                        var booklet = Charts.Booklet(inventory, chart, Hash(bytes));
                        if (logo != null) foreach (var page in booklet) logo.Apply(page);
                        inputs.Add(new(result.Id, result.Name, inventory, Hash(bytes))); details.AddRange(booklet.Skip(1));
                    }
                    var sheets = WorkspaceSheet.Build(inputs, logo, request.Title); warnings.AddRange(sheets.Warnings);
                    diagramsPath = Path.Combine(directory, "workspace-a4-diagrams.pdf"); bookletPath = Path.Combine(directory, "workspace-a4-booklets.pdf");
                    Pdf.Save(sheets.Pages, diagramsPath); Pdf.Save(sheets.Pages.Concat(details).ToList(), bookletPath);
                    for (int index = 0; index < sheets.Pages.Count; index++)
                    {
                        string path = Path.Combine(directory, $"workspace-sheet-{index + 1:D3}.png"); Png.Save(sheets.Pages[index], path, 3508, 2480, true); images.Add(path);
                    }
                    File.WriteAllText(Path.Combine(directory, "workspace-layout.json"), JsonSerializer.Serialize(new { pageCount = sheets.Pages.Count, sheets.GeometryScale, sheets.Placements, sheets.LegendEntries, sheets.Warnings }, Json), new UTF8Encoding(false));
                }
                catch (Exception error) when (Recoverable(error))
                {
                    combinedError = CleanError(error); warnings.Add("Shared sheets: " + combinedError);
                    if (diagramsPath != null) File.Delete(diagramsPath); if (bookletPath != null) File.Delete(bookletPath);
                    foreach (string image in images) File.Delete(image); images.Clear(); diagramsPath = null; bookletPath = null;
                }
            }
            return true;
        });
        string summary = results.Count(result => result.Success) + " of " + results.Count + " device report packages created." + (images.Count > 0 ? " Shared A4 sheets: " + images.Count + "." : "") + "\nOutput: " + directory;
        var response = new
        {
            outputDirectory = directory, items = results, combinedDiagramsPath = diagramsPath, combinedBookletPath = bookletPath,
            combinedImages = images, combinedError, warnings, summary,
            files = Directory.EnumerateFiles(directory, "*", SearchOption.AllDirectories).Select(path => Path.GetRelativePath(directory, path)).Order(StringComparer.Ordinal).Append("workspace-export.json").ToArray()
        };
        string json = JsonSerializer.Serialize(response, Json); File.WriteAllText(Path.Combine(directory, "workspace-export.json"), json, new UTF8Encoding(false)); return json;
    }
    static Request Parse(string requestJson)
    {
        if (string.IsNullOrWhiteSpace(requestJson) || Encoding.UTF8.GetByteCount(requestJson) > 100_000_000) throw new InvalidOperationException("The report request is empty or exceeds 100 MB.");
        using var document = JsonDocument.Parse(requestJson, new JsonDocumentOptions { MaxDepth = 64 }); var root = document.RootElement;
        var request = new Request
        {
            OutputLabel = NormalizedInventory.Text(root, "outputLabel", 100) is { Length: > 0 } label ? WorkspaceNaming.CleanLabel(label) : "Switchport reports",
            Title = NormalizedInventory.Text(root, "title", 500) is { Length: > 0 } title ? title : null,
            Combined = NormalizedInventory.Boolean(NormalizedInventory.Get(root, "combined")) != false,
            LogoDataUrl = NormalizedInventory.Get(root, "logoDataUrl").ValueKind == JsonValueKind.String ? NormalizedInventory.Get(root, "logoDataUrl").GetString() ?? "" : "",
            Palette = NormalizedInventory.Get(root, "palette").ValueKind == JsonValueKind.Object ? ReadPalette(NormalizedInventory.Get(root, "palette")) : new()
        };
        var items = NormalizedInventory.Rows(NormalizedInventory.Get(root, "items")).ToList();
        if (items.Count is < 1 or > 100) throw new InvalidOperationException("Choose between 1 and 100 devices for the report.");
        var ids = new HashSet<string>(StringComparer.Ordinal);
        foreach (var item in items)
        {
            string id = NormalizedInventory.Text(item, "id", 200), name = NormalizedInventory.Text(item, "name", 200);
            if (id.Length == 0 || !ids.Add(id)) throw new InvalidOperationException("Report items require unique, nonempty identifiers.");
            try
            {
                JsonElement source = NormalizedInventory.Get(item, "inventory"), device = NormalizedInventory.Get(item, "device");
                Inventory inventory;
                if (source.ValueKind == JsonValueKind.Object)
                { inventory = JsonSerializer.Deserialize<Inventory>(source.GetRawText(), Json) ?? throw new InvalidOperationException("The report inventory is invalid."); NormalizedInventory.Validate(inventory); NormalizedInventory.ClearSupplementary(inventory); inventory = NormalizedInventory.Combine(inventory, device); }
                else inventory = NormalizedInventory.FromDevice(device);
                var details = NormalizedInventory.Get(item, "details"); if (details.ValueKind == JsonValueKind.Array) DeviceIdentities.Apply(inventory, NormalizedInventory.Read<DeviceIdentity>(details));
                var supplementary = NormalizedInventory.Read<SupplementarySource>(NormalizedInventory.Get(item, "supplementary")); SupplementaryData.Validate(supplementary);
                NormalizedInventory.Validate(inventory);
                request.Items.Add(new Item { Id = id, Name = name.Length > 0 ? name : inventory.Hostname, Inventory = inventory, Supplementary = supplementary });
            }
            catch (Exception error) when (Recoverable(error)) { request.Items.Add(new Item { Id = id, Name = name, Inventory = new Inventory { Hostname = name }, Error = CleanError(error) }); }
        }
        return request;
    }
    static WorkspacePaletteOverrides ReadPalette(JsonElement element)
    {
        var palette = JsonSerializer.Deserialize<WorkspacePaletteOverrides>(element.GetRawText(), Json) ?? throw new InvalidOperationException("The report palette is invalid.");
        if (palette.Vlans == null || palette.Aggregates == null) throw new InvalidOperationException("The report palette is incomplete.");
        palette.Vlans = palette.Vlans.ToDictionary(pair => Regex.IsMatch(pair.Key, @"^\d+$") ? "vlan:" + pair.Key : pair.Key, pair => pair.Value, StringComparer.Ordinal);
        palette.Aggregates = palette.Aggregates.ToDictionary(pair => WorkspacePalette.AggregateKey(pair.Key), pair => pair.Value, StringComparer.Ordinal);
        return palette;
    }
    static object SceneJson(Scene page, string id, string name, string role, string[] sourceIds) => new
    {
        id, name, role, sourceIds, page.Width, page.Height, page.DiagramScale, page.MarkerRadius,
        boxes = page.Boxes, labels = page.Labels.Select(label =>
        {
            var measured = ReportRenderer.Measure(label);
            return new { label.X, label.Y, text = measured.Text, label.Size, label.Color, label.Bold, label.Width, label.Owner, label.InkBox, measuredWidth = measured.Width, measuredHeight = measured.Height };
        }), dots = page.Dots,
        shapes = page.Shapes.Select(shape => new { points = shape.Points.Select(point => new[] { point.X, point.Y }), shape.Fill, shape.Stroke, shape.StrokeWidth, shape.Owner, shape.ClipInside, shape.ClipBounds }),
        images = page.Images.Select(image => new { image.X, image.Y, image.W, image.H, image.Data })
    };
    static T WithLogo<T>(string data, Func<ReportLogo?, T> action)
    {
        if (data.Length == 0) return action(null);
        var match = Regex.Match(data, @"^data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/=\r\n]+)$", RegexOptions.CultureInvariant);
        if (!match.Success || data.Length > 14_000_000) throw new InvalidOperationException("Choose a PNG, JPG or WebP report logo under 10 MB.");
        byte[] bytes;
        try { bytes = Convert.FromBase64String(match.Groups[2].Value); } catch (FormatException) { throw new InvalidOperationException("The report logo is not valid image data."); }
        if (bytes.Length > 10_000_000) throw new InvalidOperationException("The report logo exceeds 10 MB.");
        string path = Path.Combine(Path.GetTempPath(), "nds-report-logo-" + Guid.NewGuid().ToString("N") + "." + match.Groups[1].Value);
        try { File.WriteAllBytes(path, bytes); return action(ReportLogo.Load(path)); }
        finally { File.Delete(path); }
    }
    static string SafeName(string name) => Parser.Safe(Path.GetFileName(name)).Length is > 0 and <= 200 ? Parser.Safe(Path.GetFileName(name)) : "Imported configuration";
    static string Hash(byte[] bytes) => Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
    static bool Recoverable(Exception error) => error is InvalidOperationException or ArgumentException or JsonException or IOException or UnauthorizedAccessException or OnePageCapacityException or FormatException;
    static string CleanError(Exception error) => error is JsonException ? "The report metadata is not valid JSON." : error is IOException or UnauthorizedAccessException ? "Could not read or write the report files. Check the selected folder and permissions." : Parser.Safe(error.Message);
}
