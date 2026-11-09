using System.Buffers.Binary;
using System.IO.Compression;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using NetworkDiagramStudio.SwitchportReports;
using SwitchportGenerator;

static class Program
{
    static int checks;
    static void Check(bool condition, string message) { checks++; if (!condition) throw new InvalidOperationException(message); }
    static JsonObject Object(string json) => JsonNode.Parse(json)!.AsObject();
    static void Reject(Action action, string message)
    { bool rejected = false; try { action(); } catch (InvalidOperationException) { rejected = true; } Check(rejected, message); }
    const string Aruba = "; JL256A Configuration Editor\nhostname LAB-ACCESS\ntrunk 49-50 trk1 lacp\nvlan 10\n name Data\n untagged 1-48\n tagged trk1\n exit\nvlan 150\n name Voice\n tagged 1-48,trk1\n voice\n exit\n";
    static int Main(string[] args)
    {
        if (args.Length == 2 && args[0] == "--catalog")
        {
            string json = SwitchportReportService.CatalogJson();
            var data = JsonNode.Parse(json)!;
            void Compact(JsonNode? value)
            {
                if (value is JsonArray rows) { foreach (var row in rows) Compact(row); return; }
                if (value is not JsonObject item) return;
                foreach (var pair in item.ToArray())
                {
                    bool emptyText = pair.Value is JsonValue scalar && scalar.TryGetValue<string>(out string? text) && text is "" or "Unknown" or "Not specified" or "Unknown/Confirm before use";
                    bool emptyArray = pair.Value is JsonArray array && array.Count == 0 && pair.Key is not ("groups" or "ports" or "devices");
                    bool falseFlag = pair.Value is JsonValue flag && flag.TryGetValue<bool>(out bool boolean) && !boolean;
                    if (pair.Value == null || emptyText || emptyArray || falseFlag) item.Remove(pair.Key); else Compact(pair.Value);
                }
                if (item.ContainsKey("layoutKey")) foreach (string duplicate in new[] { "source", "layoutSource", "notes" }) item.Remove(duplicate);
            }
            Compact(data);
            string compact = data.ToJsonString();
            Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(args[1]))!);
            File.WriteAllText(args[1], "// Generated from SwitchPort_Diagram_Builder " + SwitchportReportService.SourceCommit + ", version " + SwitchportReportService.SourceVersion + ".\n// Regenerate with tests/switchport-native --catalog. Exact verified geometry, no customer data.\nexport const switchportCatalog=" + compact + ";\n", new UTF8Encoding(false));
            Console.WriteLine("Generated reusable browser catalog: " + args[1]); return 0;
        }
        string output = args.Length > 0 ? Path.GetFullPath(args[0]) : Path.Combine(Path.GetTempPath(), "nds-switchport-tests-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(output);
        try { Run(output); Console.WriteLine("PASS " + checks + " native Switchport import, normalized adapter, report, palette and file checks. Output: " + output); return 0; }
        catch (Exception error) { Console.Error.WriteLine(error); return 1; }
        finally { if (args.Length == 0) Directory.Delete(output, true); }
    }
    static void Run(string output)
    {
        var catalog = Object(SwitchportReportService.CatalogJson());
        Check(catalog["models"]!.AsArray().Count >= 281, "Full model/chassis choices are exposed.");
        Check(catalog["additionalModels"]!.AsArray().Count == 10, "All directly supported Instant On 1930 imports are retained.");
        Check(catalog["modules"]!.AsArray().Count == 75 && catalog["research"]!.AsArray().Count == 97, "Verified module choices remain distinct from pending research.");
        Check(catalog["models"]!.AsArray().Where(model => model!["kind"]!.GetValue<string>() != "Chassis").All(model => model!["inventory"]!["groups"]!.AsArray().All(group => group!["socketLayout"]!.AsArray().Count > 0)), "Browser catalog materializes exact geometry even for legacy bank and combo layouts.");
        var imported = Object(SwitchportReportService.ImportJson("lab.cfg", Encoding.UTF8.GetBytes(Aruba)));
        var first = imported["items"]![0]!.DeepClone().AsObject();
        Check(first["inventory"]!["ports"]!.AsArray().Count == 52, "The complete physical inventory survives import.");
        Check(first["inventory"]!["blockers"]!.AsArray().Count == 0, "Supported fixture imports without blockers.");
        Check(first["inventory"]!["ports"]![0]!["untaggedVlan"]!.GetValue<int>() == 10 && first["inventory"]!["vlans"]!.AsArray().Any(vlan => vlan!["voice"]!.GetValue<bool>()), "Native and voice VLAN evidence is retained.");
        Check(!imported.ToJsonString().Contains("Configuration Editor", StringComparison.Ordinal) && first["text"] == null && first["sourcePath"] == null, "Import returns normalized fields without the raw configuration or source path.");
        var workspace = new ConfigurationWorkspace();
        var workspaceItem = workspace.AddText(Aruba, "fictional.cfg");
        workspace.SetDevices(workspaceItem.Id, new[] { new DeviceIdentity { Id = "1", Name = "LAB-REPORT", SerialNumber = "LAB-SERIAL", AssetTag = "LAB-ASSET", Notes = "Fictional inventory record" } });
        workspace.OutputLabel = "Fictional reports"; workspace.ShowWorkspaceTitle = true; workspace.Paper = ReportPaper.Parse("letter", "portrait");
        workspace.AddSupplementary(workspaceItem.Id, SupplementaryData.FromText("LAB-ACCESS# show interfaces\n1 is down, line protocol is down\n", "Fictional observation", "LAB-ACCESS"));
        var restoredWorkspace = ConfigurationWorkspace.Deserialize(workspace.Serialize());
        Check(restoredWorkspace.Paper.Preset == "letter" && restoredWorkspace.Paper.Orientation == "portrait", "Workspace paper survives native save/reopen.");
        restoredWorkspace.Clear(); restoredWorkspace.UndoRemoval();
        Check(restoredWorkspace.Paper.Preset == "letter" && restoredWorkspace.Paper.Orientation == "portrait", "Workspace paper survives clear/undo.");
        var migrated = Object(SwitchportReportService.ImportJson("Fictional workspace.spworkspace.json", Encoding.UTF8.GetBytes(workspace.Serialize())));
        Check(migrated["paper"]!["preset"]!.GetValue<string>() == "letter" && migrated["paper"]!["orientation"]!.GetValue<string>() == "portrait", "Native migration returns independent report paper.");
        Check(migrated["items"]![0]!["details"]![0]!["assetTag"]!.GetValue<string>() == "LAB-ASSET", "Saved workspace device details are migrated.");
        Check(migrated["showWorkspaceTitle"]!.GetValue<bool>() && migrated["title"]!.GetValue<string>() == "Fictional workspace", "Workspace title and independent output naming are migrated.");
        Check(migrated["items"]![0]!["inventory"]!["ports"]![0]!["liveState"]!.GetValue<string>() == "Unknown/Confirm before use", "Migrated primary inventory does not permanently absorb supplementary state.");
        var observedRequest = new JsonObject { ["items"] = new JsonArray(migrated["items"]![0]!.DeepClone()), ["combined"] = false };
        var observed = Object(SwitchportReportService.PreviewJson(observedRequest.ToJsonString()));
        Check(observed["items"]![0]!["inventory"]!["ports"]![0]!["liveState"]!.GetValue<string>() == "Observed: down", "Selected supplementary evidence appears in its report.");
        observedRequest["items"]![0]!["supplementary"] = new JsonArray();
        var unobserved = Object(SwitchportReportService.PreviewJson(observedRequest.ToJsonString()));
        Check(unobserved["items"]![0]!["inventory"]!["ports"]![0]!["liveState"]!.GetValue<string>() == "Unknown/Confirm before use", "Disabling supplementary evidence removes stale observed report values.");
        var observations = Object(SwitchportReportService.SupplementaryJson("fictional.xlsx", Workbook("LAB-ACCESS.example.test"), new[] { "LAB-ACCESS" }));
        Check(observations["sources"]!.AsObject().Count == 1 && !observations.ToJsonString().Contains("NEVER-IMPORT-SECRET", StringComparison.Ordinal), "Auvik short/FQDN observations are normalized with sensitive values redacted.");
        var domains = Object(SwitchportReportService.SupplementaryJson("domains.xlsx", Workbook("EDGE.east.example", "EDGE.west.example"), new[] { "EDGE.east.example", "EDGE.west.example" }));
        Check(domains["sources"]!.AsObject().Count == 2 && domains["sources"]!.AsObject().All(pair => pair.Value!["observations"]!.AsArray().Count == 2), "Exact FQDN ownership does not combine separate sites.");
        Reject(() => SwitchportReportService.SupplementaryJson("ambiguous.xlsx", Workbook("EDGE.east.example", "EDGE.west.example"), new[] { "EDGE" }), "Ambiguous short workbook ownership requires an exact device name.");
        var longField = SupplementaryData.FromText("LAB# show interfaces " + new string('x', 100) + "\n1 is up, line protocol is up", "long.log", "LAB");
        SupplementaryData.Validate(new[] { longField }); Check(longField.Observations.All(row => row.Field.Length <= 80), "Long operational command labels respect the persisted field limit.");
        var promptOwner = Object(SwitchportReportService.SupplementaryJson("capture.log", Encoding.UTF8.GetBytes("EDGE.east.example# show interfaces\n1 is up, line protocol is up"), new[] { "EDGE.east.example", "EDGE.west.example" }));
        Check(promptOwner["sources"]!.AsObject().Single().Value!["device"]!.GetValue<string>() == "EDGE.east.example", "Exact command-prompt ownership wins before short-host matching.");
        Reject(() => SwitchportReportService.ImportJson("encrypted.backup", new byte[] { 0xef, 0xa8, 0x91, 0x73, 0, 0, 0, 0 }), "Encrypted RouterOS backups must fail with the existing format guard.");
        var binary = Object(SwitchportReportService.ImportJson("fictional.backup", Backup()));
        Check(binary["items"]![0]!["inventory"]!["ports"]!.AsArray().Count == 9, "Unencrypted RouterOS backup reconstructs the verified nine-port physical profile.");
        Check(!binary.ToJsonString().Contains("NEVER-IMPORT-SECRET", StringComparison.Ordinal), "The RouterOS decoder ignores credential and script tables.");
        var request = new JsonObject { ["items"] = new JsonArray(first), ["combined"] = true, ["outputLabel"] = "Native integration", ["title"] = "Fictional site" };
        var preview = Object(SwitchportReportService.PreviewJson(request.ToJsonString()));
        Check(preview["items"]![0]!["success"]!.GetValue<bool>(), "The imported normalized inventory renders successfully: " + preview["items"]![0]!["error"]);
        Check(preview["pages"]!.AsArray().Count >= 2 && preview["pages"]![0]!["role"]!.GetValue<string>() == "diagram", "Preview exposes shared sheets and full inventory pages.");
        Check(preview["pages"]![0]!["shapes"]![0]!["points"]![0]!.AsArray().Count == 2, "Scene JSON exports explicit x/y polygon coordinates.");
        Check(preview["pages"]!.AsArray().SelectMany(page => page!["dots"]!.AsArray()).Any(dot => dot!["voice"]!.GetValue<bool>()), "Voice diamonds survive the native preview scene.");
        var result = Object(SwitchportReportService.ExportJson(request.ToJsonString(), output));
        Check(result["items"]![0]!["success"]!.GetValue<bool>(), "Per-device native report export succeeds.");
        string directory = result["items"]![0]!["outputDirectory"]!.GetValue<string>();
        string[] expected = { "wall-chart.png", "a4-one-page.png", "a4-one-page.pdf", "a4-booklet.pdf", "inventory.json", "port-map.csv", "technician-summary.txt", "validation-report.txt" };
        Check(Directory.GetFiles(directory).Select(Path.GetFileName).Order().SequenceEqual(expected.Order()), "A complete report creates all eight standard deliverables.");
        foreach (string file in expected) Check(new FileInfo(Path.Combine(directory, file)).Length > 50, "Report is nonempty: " + file);
        byte[] png = File.ReadAllBytes(Path.Combine(directory, "wall-chart.png"));
        Check(BinaryPrimitives.ReadInt32BigEndian(png.AsSpan(16, 4)) == 3508 && BinaryPrimitives.ReadInt32BigEndian(png.AsSpan(20, 4)) == 2480, "PNG output retains the exact 300-DPI A4 raster dimensions.");
        Check(File.ReadAllText(Path.Combine(directory, "validation-report.txt")).Contains("RENDER_BLOCKED=FALSE", StringComparison.Ordinal), "Report validation confirms successful readable geometry.");
        Check(File.ReadAllText(Path.Combine(directory, "port-map.csv")).Contains("Logical interfaces,Inventory basis", StringComparison.Ordinal), "CSV retains full logical/physical inventory qualification.");
        Check(File.Exists(result["combinedDiagramsPath"]!.GetValue<string>()) && File.Exists(result["combinedBookletPath"]!.GetValue<string>()) && result["combinedImages"]!.AsArray().Count > 0, "Shared PDF and PNG output uses the same solved pages.");
        var repeat = Object(SwitchportReportService.ExportJson(request.ToJsonString(), output));
        Check(repeat["outputDirectory"]!.GetValue<string>() != result["outputDirectory"]!.GetValue<string>(), "Repeated exports never overwrite an existing package.");
        foreach (var fixture in new[] { ("JL256A", "HPE Aruba"), ("CRS309-1G-8S+IN", "MikroTik"), ("FortiGate 200G", "Fortinet"), ("WS-C3650-24PS", "Cisco"), ("JG926A", "HPE"), ("JL680A", "Instant On") })
        {
            var normalized = new JsonObject { ["id"] = "device", ["name"] = "LAB-NORMALIZED", ["model"] = fixture.Item1, ["vendor"] = fixture.Item2,
                ["ports"] = new JsonArray(), ["vlans"] = new JsonArray() };
            var native = Object(SwitchportReportService.PreviewJson(new JsonObject { ["items"] = new JsonArray(new JsonObject { ["id"] = fixture.Item1, ["device"] = normalized }), ["combined"] = false }.ToJsonString()));
            Check(native["items"]![0]!["success"]!.GetValue<bool>(), "Normalized model adapter renders " + fixture.Item1 + ": " + native["items"]![0]!["error"]);
            Check(native["items"]![0]!["inventory"]!["ports"]!.AsArray().All(port => port!["untaggedVlan"] == null && port["disabled"] == null), "Normalized hardware description does not invent configuration defaults for " + fixture.Item1);
        }
        var stack = new JsonObject { ["name"] = "LAB-STACK", ["model"] = "JL256A", ["stackMembers"] = new JsonArray(new JsonObject { ["id"] = "1", ["model"] = "JL256A" }, new JsonObject { ["id"] = "2", ["model"] = "JL256A" }), ["ports"] = new JsonArray() };
        var stackResult = Object(SwitchportReportService.PreviewJson(new JsonObject { ["items"] = new JsonArray(new JsonObject { ["id"] = "stack", ["device"] = stack }), ["combined"] = false }.ToJsonString()));
        Check(stackResult["items"]![0]!["success"]!.GetValue<bool>() && stackResult["items"]![0]!["inventory"]!["ports"]!.AsArray().Count == 104, "Direct NDS stackMembers preserve both complete member inventories.");
        var moduleDevice = new JsonObject { ["name"] = "LAB-CHASSIS", ["model"] = "J9850A", ["modules"] = new JsonArray(new JsonObject { ["member"] = "1", ["slot"] = "A", ["model"] = "J9993A" }, new JsonObject { ["member"] = "1", ["slot"] = "C", ["model"] = "J9993A" }), ["ports"] = new JsonArray() };
        var moduleResult = Object(SwitchportReportService.PreviewJson(new JsonObject { ["items"] = new JsonArray(new JsonObject { ["id"] = "chassis", ["device"] = moduleDevice }), ["combined"] = false }.ToJsonString()));
        Check(moduleResult["items"]![0]!["success"]!.GetValue<bool>() && moduleResult["items"]![0]!["inventory"]!["ports"]!.AsArray().Count == 16, "Direct NDS modules preserve only the confirmed chassis slots.");
        string snapshot = ConfigInput.Decode(Backup())[MikroTikBackup.Prefix.Length..];
        var snapshotDevice = new JsonObject { ["name"] = "LAB-SNAPSHOT", ["routerosSnapshot"] = JsonNode.Parse(snapshot), ["ports"] = new JsonArray() };
        var snapshotResult = Object(SwitchportReportService.PreviewJson(new JsonObject { ["items"] = new JsonArray(new JsonObject { ["id"] = "snapshot", ["device"] = snapshotDevice }), ["combined"] = false }.ToJsonString()));
        Check(snapshotResult["items"]![0]!["success"]!.GetValue<bool>() && snapshotResult["items"]![0]!["inventory"]!["ports"]!.AsArray().Count == 9, "Browser-decoded RouterOS snapshots feed the exact native physical adapter.");
        var semantics = new JsonObject { ["name"] = "LAB-SEMANTICS", ["model"] = "JL256A", ["ports"] = new JsonArray(
            new JsonObject { ["name"] = "1", ["native"] = 10, ["nativeTagged"] = true, ["tagged"] = new JsonArray(20), ["admin"] = "down", ["state"] = "up", ["ingressPvid"] = 10 },
            new JsonObject { ["name"] = "2", ["state"] = "down" }, new JsonObject { ["name"] = "3", ["admin"] = "disable" }, new JsonObject { ["name"] = "4", ["admin"] = "enable" }) };
        var semanticResult = Object(SwitchportReportService.PreviewJson(new JsonObject { ["items"] = new JsonArray(new JsonObject { ["id"] = "semantics", ["device"] = semantics }), ["combined"] = false }.ToJsonString()));
        Check(semanticResult["items"]![0]!["success"]!.GetValue<bool>(), "Normalized configuration semantics render successfully.");
        var semanticPorts = semanticResult["items"]![0]!["inventory"]!["ports"]!.AsArray();
        Check(semanticPorts[0]!["untaggedVlan"] == null && semanticPorts[0]!["untaggedState"]!.GetValue<string>() == "None" && semanticPorts[0]!["taggedVlans"]!.AsArray().Any(id => id!.GetValue<int>() == 10), "Tagged native VLAN is not painted as an untagged fill.");
        Check(semanticPorts[0]!["disabled"]!.GetValue<bool>() && semanticPorts[1]!["disabled"] == null, "Configured admin state remains independent of observed link state.");
        Check(semanticPorts[2]!["disabled"]!.GetValue<bool>() && !semanticPorts[3]!["disabled"]!.GetValue<bool>(), "FortiOS enable/disable administrative spellings remain explicit configured states.");
        Check(semanticPorts[0]!["notes"]!.AsArray().Any(note => note!.GetValue<string>() == "Configured ingress PVID: 10"), "Configured ingress PVID is retained for complete CSV export.");
        var voiceItem = imported["items"]![0]!.DeepClone().AsObject();
        voiceItem["device"]!["vlans"]![1]!.AsObject().Remove("voice");
        var voiceRequest = new JsonObject { ["items"] = new JsonArray(voiceItem), ["combined"] = false };
        var retainedVoice = Object(SwitchportReportService.PreviewJson(voiceRequest.ToJsonString()));
        Check(retainedVoice["items"]![0]!["inventory"]!["vlans"]![1]!["voice"]!.GetValue<bool>(), "An omitted optional voice field does not erase retained primary configuration evidence.");
        voiceItem["device"]!["vlans"]![1]!["voice"] = false;
        var clearedVoice = Object(SwitchportReportService.PreviewJson(voiceRequest.ToJsonString()));
        Check(!clearedVoice["items"]![0]!["inventory"]!["vlans"]![1]!["voice"]!.GetValue<bool>(), "An explicit voice change still overrides retained configuration evidence.");
        var maskedInventory = migrated["items"]![0]!["inventory"]!.DeepClone().AsObject();
        var physicalFields = new HashSet<string>(new[] { "id", "group", "number", "displayNumber", "relatedInterfaces", "media" }, StringComparer.OrdinalIgnoreCase);
        foreach(string collection in new[] { "ports", "logicalInterfaces" })
            foreach(var port in maskedInventory[collection]!.AsArray())
                foreach(string field in port!.AsObject().Select(pair=>pair.Key).ToArray())if(!physicalFields.Contains(field))port.AsObject().Remove(field);
        var maskedRequest = new JsonObject { ["items"] = new JsonArray(new JsonObject { ["id"] = "masked", ["device"] = new JsonObject { ["name"] = "LAB-MASKED", ["switchportInventory"] = maskedInventory, ["ports"] = new JsonArray() } }), ["combined"] = false };
        var maskedResult = Object(SwitchportReportService.PreviewJson(maskedRequest.ToJsonString()));
        Check(maskedResult["items"]![0]!["success"]!.GetValue<bool>(), "Geometry-only retained ports satisfy native validation and render.");
        var maskedPorts = maskedResult["items"]![0]!["inventory"]!["ports"]!.AsArray();
        Check(maskedPorts.Count == maskedInventory["ports"]!.AsArray().Count && maskedPorts.All(port => port!["untaggedVlan"] == null && port["taggedVlans"]!.AsArray().Count == 0 && port["disabled"] == null), "Category-masked native reports retain socket count without stale configured state.");
        var taggedRequest = new JsonObject { ["items"] = new JsonArray(new JsonObject { ["id"] = "tagged", ["device"] = new JsonObject { ["name"] = "LAB-TAGGED", ["model"] = "JL256A", ["ports"] = new JsonArray(new JsonObject { ["name"] = "1", ["native"] = 27, ["nativeTagged"] = true, ["tagged"] = new JsonArray(57), ["configuredSpeed"] = "1000", ["speed"] = "Observed: 10 Gbps" }) } }), ["combined"] = false };
        var taggedResult = Object(SwitchportReportService.PreviewJson(taggedRequest.ToJsonString()));
        Check(taggedResult["items"]![0]!["success"]!.GetValue<bool>(), "Tagged-native normalized fixture renders.");
        var taggedPort = taggedResult["items"]![0]!["inventory"]!["ports"]!.AsArray().Single(port => port!["id"]!.GetValue<string>() == "1")!;
        Check(taggedPort["untaggedVlan"] == null && taggedPort["untaggedState"]!.GetValue<string>() == "None" && taggedPort["taggedVlans"]!.AsArray().Select(value => value!.GetValue<int>()).SequenceEqual(new[] {57}), "Explicit allowed membership does not invent an excluded tagged-native VLAN.");
        Check(taggedPort["speed"]!.GetValue<string>() == "1000", "Native report configured speed wins over observed speed.");
        var largeStack = new JsonObject { ["name"] = "LAB-EIGHT-MEMBERS", ["model"] = "JL256A", ["stackMembers"] = new JsonArray(Enumerable.Range(1, 8).Select(member => (JsonNode)new JsonObject { ["id"] = member.ToString(), ["model"] = "JL256A" }).ToArray()), ["ports"] = new JsonArray() };
        var largeResult = Object(SwitchportReportService.PreviewJson(new JsonObject { ["items"] = new JsonArray(new JsonObject { ["id"] = "large", ["device"] = largeStack }), ["combined"] = false }.ToJsonString()));
        Check(largeResult["items"]![0]!["success"]!.GetValue<bool>(), "An eight-member complete stack retains readable external labels: " + largeResult["items"]![0]!["error"]);
        var stackInventory = JsonSerializer.Deserialize<Inventory>(largeResult["items"]![0]!["inventory"]!.ToJsonString(), new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
        var smallInventory = Parser.Parse(Aruba);
        var sharedScales = WorkspaceSheet.Build(new[] { new WorkspaceSheetItem("small", "LAB-SMALL", smallInventory), new WorkspaceSheetItem("stack", "LAB-STACK", stackInventory) });
        foreach(var placement in sharedScales.Placements)
        {
            var scene = sharedScales.Pages[placement.PageNumber - 1];
            var faces = scene.Shapes.Where(shape => shape.Owner.StartsWith(placement.Id + ":", StringComparison.Ordinal) && shape.Fill.Length > 0).ToArray();
            Check(faces.Length > 0 && faces.All(face => Math.Abs((face.Points.Max(point => point.X) - face.Points.Min(point => point.X)) / QuickSheet.PortWidth - placement.GeometryScale) < .001), "Shared placement scale matches measured physical faces.");
            Check(Math.Abs(scene.DiagramScale-placement.GeometryScale)<.001,"Shared page scale agrees with its components.");
        }
        Check(sharedScales.Placements.Count == 2, "Shared sheets retain both complete configuration blocks.");
        Check(sharedScales.Placements.GroupBy(p => p.PageNumber).All(page => page.Select(p => Math.Round(p.GeometryScale, 5)).Distinct().Count() == 1), "Shared sheets never silently mix compact and full-scale physical sockets.");
        foreach (string model in new[] { "JL256A", "JL479A" })
        {
            var geometry = catalog["models"]!.AsArray().Single(row => row!["sku"]!.GetValue<string>() == model)!["inventory"]!;
            var inventory = JsonSerializer.Deserialize<Inventory>(geometry.ToJsonString(), new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
            inventory.Hostname = "LAB-DENSE-" + model;
            inventory.Vlans = Enumerable.Range(10, 20).Select(id => new Vlan { Id = id, Name = "Lab VLAN " + id, Voice = id == 29 }).ToList();
            foreach (var port in inventory.Ports) { port.UntaggedVlan = 10; port.UntaggedState = "Known"; port.TaggedVlans = Enumerable.Range(11, 19).ToList(); port.VoiceVlan = 29; }
            var chart = QuickSheet.Build(inventory, Charts.Layout(inventory), "fictional");
            Check(chart.Sockets.All(socket => socket.NumberBounds.Y + socket.NumberBounds.H < socket.Tile.Y || socket.NumberBounds.Y > socket.Tile.Y + socket.Tile.H), "All dense " + model + " port numbers are outside socket interiors.");
            Check(chart.Scene.Labels.Where(label => label.Owner.Length > 0 && label.InkBox).All(label => label.Size >= 6 - 1e-6), "All dense " + model + " numbers retain the six-point printed text floor.");
            foreach (var socket in chart.Sockets)
            {
                var port = inventory.Ports.Single(p => p.Id == socket.Port);
                var group = inventory.Groups.Single(g => g.Id == port.Group);
                var position = group.SocketLayout.FirstOrDefault(p => p.Number == port.Number && p.Suffix == socket.Suffix);
                if (position != null) Check(position.Row % 2 == 0 ? socket.NumberBounds.Y + socket.NumberBounds.H < socket.Tile.Y : socket.NumberBounds.Y > socket.Tile.Y + socket.Tile.H, "Every physical row pair has exterior top/bottom labels.");
                Check(Math.Abs(socket.NumberBounds.X + socket.NumberBounds.W / 2 - socket.Tile.X - socket.Tile.W / 2) < .001, "Port number ink is centered on its socket.");
                Check(Math.Abs(socket.Tile.W / QuickSheet.PortWidth - chart.GeometryScale) < .001, "Recorded geometry includes actual socket compaction.");
            }
            Check(Charts.ValidateScene(chart.Scene).Count == 0, "Dense " + model + " copper/optical labels and markers do not collide.");
            Check(chart.Scene.Dots.Count >= inventory.Ports.Count * 19, "Dense " + model + " diagrams retain every VLAN marker.");
            Png.Save(chart.Scene, Path.Combine(output, model + "-external-numbers.png"), 3508, 2480, true);
            Pdf.Save(new() { chart.Scene }, Path.Combine(output, model + "-external-numbers.pdf"));
        }
        var invalid = request.DeepClone().AsObject(); invalid["items"]!.AsArray().Add(new JsonObject { ["id"] = "unsupported", ["device"] = new JsonObject { ["name"] = "LAB-UNKNOWN", ["model"] = "UNVERIFIED-MODEL" } });
        var partial = Object(SwitchportReportService.PreviewJson(invalid.ToJsonString()));
        Check(partial["items"]!.AsArray().Count(item => item!["success"]!.GetValue<bool>()) == 1, "One invalid hardware profile does not discard other valid reports.");
    }
    static byte[] Workbook(params string[] owners)
    {
        using var output = new MemoryStream();
        using (var archive = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true))
        {
            void Write(string name, string value) { using var writer = new StreamWriter(archive.CreateEntry(name).Open()); writer.Write(value); }
            Write("xl/workbook.xml", "<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets><sheet name=\"Interfaces\" r:id=\"r1\"/></sheets></workbook>");
            Write("xl/_rels/workbook.xml.rels", "<Relationships><Relationship Id=\"r1\" Target=\"worksheets/observations.xml\"/></Relationships>");
            var rows = new List<string[]> { new[] { "Fictional observations" }, new[] { "Parent Device", "Interface Name", "Oper Status", "Configuration Details" } };
            rows.AddRange(owners.Select(owner => new[] { owner, "1", "Down", "password NEVER-IMPORT-SECRET" }));
            string cells = string.Concat(rows.Select((row, index) => "<row>" + string.Concat(row.Select((value, column) => "<c r=\"" + (char)('A' + column) + (index + 1) + "\" t=\"inlineStr\"><is><t>" + System.Security.SecurityElement.Escape(value) + "</t></is></c>")) + "</row>"));
            Write("xl/worksheets/observations.xml", "<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData>" + cells + "</sheetData></worksheet>");
        }
        return output.ToArray();
    }
    static byte[] Backup()
    {
        byte[] Message(Action<BinaryWriter> write)
        { using var stream = new MemoryStream(); using var writer = new BinaryWriter(stream); writer.Write(new byte[] { 77, 50 }); write(writer); return stream.ToArray(); }
        void StringField(BinaryWriter writer, uint key, string value)
        { byte[] bytes = Encoding.UTF8.GetBytes(value); writer.Write(0x20000000u | key); writer.Write((ushort)bytes.Length); writer.Write(bytes); }
        void Number(BinaryWriter writer, uint key, uint value) { writer.Write(0x08000000u | key); writer.Write(value); }
        var tables = new Dictionary<string, List<byte[]>>
        {
            ["system"] = new() { Message(writer => StringField(writer, 12, "LAB-ROUTEROS")) },
            ["net/devices"] = new(), ["user"] = new() { Encoding.UTF8.GetBytes("NEVER-IMPORT-SECRET") }
        };
        foreach (var (name, index) in new[] { "ether1" }.Concat(Enumerable.Range(1, 8).Select(number => "sfp-sfpplus" + number)).Select((name, index) => (name, index)))
            tables["net/devices"].Add(Message(writer => { Number(writer, 0x010001, 1); Number(writer, 0xfe0001, (uint)(index + 1)); StringField(writer, 0x010006, name); }));
        using var output = new MemoryStream(); using var binary = new BinaryWriter(output); binary.Write(0xb1a1ac88u); binary.Write(0u);
        foreach (var table in tables)
        {
            byte[] name = Encoding.UTF8.GetBytes(table.Key); binary.Write(name.Length); binary.Write(name);
            binary.Write(table.Value.Count * 12);
            for (int index = 0; index < table.Value.Count; index++) { binary.Write((uint)index + 1); binary.Write((uint)table.Value[index].Length + 2); binary.Write(0u); }
            binary.Write(table.Value.Sum(record => record.Length + 2));
            foreach (byte[] record in table.Value) { binary.Write((ushort)(record.Length + 2)); binary.Write(record); }
        }
        byte[] result = output.ToArray(); BinaryPrimitives.WriteUInt32LittleEndian(result.AsSpan(4, 4), (uint)result.Length); return result;
    }
}
