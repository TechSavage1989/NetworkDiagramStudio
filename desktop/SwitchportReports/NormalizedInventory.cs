using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using SwitchportGenerator;

namespace NetworkDiagramStudio.SwitchportReports;

/// <summary>Allowlisted conversion between the shared editor model and the report engine.</summary>
internal static class NormalizedInventory
{
    internal static readonly string[] InstantOn1930 = { "JL680A", "JL681A", "JL682A", "JL683A", "JL683B", "JL684A", "JL684B", "JL685A", "JL686A", "JL686B" };
    internal static bool Has(JsonElement value, string key) => value.ValueKind == JsonValueKind.Object && value.TryGetProperty(key, out _);
    internal static JsonElement Get(JsonElement value, string key) => value.ValueKind == JsonValueKind.Object && value.TryGetProperty(key, out var item) ? item : default;
    internal static string Text(JsonElement value, string key = "", int limit = 4096)
    {
        if (key.Length > 0) value = Get(value, key);
        string text = value.ValueKind is JsonValueKind.String ? value.GetString() ?? "" : value.ValueKind is JsonValueKind.Number ? value.GetRawText() : "";
        if (text.Length > limit) throw new InvalidOperationException("Report text exceeds its supported length.");
        return Parser.Safe(text);
    }
    internal static IEnumerable<JsonElement> Rows(JsonElement value) => value.ValueKind == JsonValueKind.Array ? value.EnumerateArray() : Array.Empty<JsonElement>();
    internal static List<T> Read<T>(JsonElement value) => value.ValueKind == JsonValueKind.Array ? JsonSerializer.Deserialize<List<T>>(value.GetRawText(), SwitchportReportService.Json) ?? new() : new();
    internal static bool? Boolean(JsonElement value) => value.ValueKind == JsonValueKind.True ? true : value.ValueKind == JsonValueKind.False ? false : null;
    static string Key(string name)
    {
        string value = SupplementaryData.InterfaceKey(name);
        value = Regex.Replace(value, @"^(?:twentyfivegigabitethernet|twentyfivegige|twe)(?=\d)", "twentyfiveg");
        value = Regex.Replace(value, @"^(?:fortygigabitethernet|fortygige|fo)(?=\d)", "fortyg");
        value = Regex.Replace(value, @"^(?:hundredgigabitethernet|hundredgige|hu)(?=\d)", "hundredg");
        return value;
    }
    static string CanonicalModel(string text)
    {
        var fortigate = Regex.Match(text.Trim(), @"^(?:FortiGate|FG)[\s-]*(20[01]G)$", RegexOptions.IgnoreCase);
        if (fortigate.Success) return "FG-" + fortigate.Groups[1].Value.ToUpperInvariant();
        var codes = DeviceModels.Choices.Select(model => model.Sku).Concat(InstantOn1930).Append(Parser.SharedPl48Profile).Append(CiscoHardware.Shared3560E48Profile)
            .Distinct(StringComparer.OrdinalIgnoreCase).OrderByDescending(code => code.Length);
        return codes.FirstOrDefault(code => text.Equals(code, StringComparison.OrdinalIgnoreCase) ||
            Regex.IsMatch(text, @"(?<![A-Z0-9])" + Regex.Escape(code) + @"(?![A-Z0-9])", RegexOptions.IgnoreCase)) ?? text.Trim();
    }
    internal static Inventory FromDevice(JsonElement device, bool useRetained = true)
    {
        if (device.ValueKind != JsonValueKind.Object) throw new InvalidOperationException("Choose a device with confirmed hardware for the report.");
        var saved = Get(device, "switchportInventory");
        if (useRetained && saved.ValueKind == JsonValueKind.Object)
        {
            var retained = JsonSerializer.Deserialize<Inventory>(saved.GetRawText(), SwitchportReportService.Json) ?? throw new InvalidOperationException("The retained report inventory is invalid.");
            Validate(retained); ClearSupplementary(retained); return Combine(retained, device);
        }
        var routeros = Get(device, "routerosSnapshot");
        if (routeros.ValueKind == JsonValueKind.Object)
        {
            var snapshot = JsonSerializer.Deserialize<MikroTikParser.Snapshot>(routeros.GetRawText(), SwitchportReportService.Json) ?? throw new InvalidOperationException("The RouterOS snapshot is invalid.");
            var parsed = MikroTikParser.Parse(MikroTikBackup.Prefix + JsonSerializer.Serialize(snapshot));
            DeviceIdentities.Apply(parsed, Array.Empty<DeviceIdentity>()); Overlay(parsed, device); Validate(parsed); return parsed;
        }
        string model = CanonicalModel(Text(device, "model", 200));
        JsonElement Composition(string key) => Has(device, key) ? Get(device, key) : Get(Get(device, "hardwareComposition"), key);
        var members = Rows(Composition("stackMembers"))
            .Select(member => (Id: Text(member, "id", 12), Model: CanonicalModel(Text(member, "model", 200)))).ToList();
        if (members.Count == 0) members.Add(("1", model));
        if (members.Count > 48 || members.Any(member => !Regex.IsMatch(member.Id, @"^[1-9]\d{0,2}$")))
            throw new InvalidOperationException("The report requires valid confirmed stack member identities.");
        var moduleRows = Rows(Composition("modules")).ToList();
        var details = members.Select(member => new DeviceIdentity
        {
            Id = member.Id, ModelSelection = member.Model,
            ModuleSelections = moduleRows.Where(module => (Text(module, "member", 12) is { Length: > 0 } id ? id : "1") == member.Id)
                .Select(module => new DeviceModuleSelection { Slot = Text(module, "slot", 24), Sku = Text(module, "model", 80) }).ToList()
        }).ToList();
        string choices = string.Join(',', members.Select(member => member.Id + "=" + member.Model));
        string source; Inventory inventory;
        // These strings describe only confirmed hardware metadata. No network
        // configuration is reconstructed; every generated default is cleared below.
        if (members.All(member => CiscoHardware.Find(member.Model) != null))
        {
            source = "version 17.1\nhostname Normalized\n" + string.Join('\n', members.Select(member => "switch " + member.Id + " provision " + member.Model)) + "\n";
            if (members.Count > 1 && members.All(member => member.Model.StartsWith("C9500-", StringComparison.OrdinalIgnoreCase))) source += "stackwise-virtual\n";
            inventory = CiscoParser.Parse(source, choices);
            CiscoModuleCatalog.Apply(inventory, details);
        }
        else if (members.Count == 1 && MikroTikParser.Models.Any(item => item.Code.Equals(model, StringComparison.OrdinalIgnoreCase)))
        {
            source = "# RouterOS 7.0\n# model = " + model + "\n/system identity\nset name=Normalized\n";
            inventory = MikroTikParser.Parse(source, model);
        }
        else if (members.Count == 1 && model is "FG-200G" or "FG-201G")
        {
            source = "#config-version=" + (model == "FG-201G" ? "FG2H1G" : "FG2H0G") + "-7.0\nconfig system global\n    set hostname Normalized\nend\nconfig system interface\nend\n";
            inventory = FortiOsParser.Parse(source);
        }
        else if (members.All(member => HardwareCatalog.Find(member.Model)?.OS == "Comware"))
        {
            source = "sysname Normalized\n";
            inventory = ComwareParser.Parse(source, choices);
        }
        else if (members.All(member => HardwareCatalog.Find(member.Model)?.OS == "Instant On 1960" || InstantOn1930.Contains(member.Model, StringComparer.OrdinalIgnoreCase)))
        {
            bool newer = HardwareCatalog.Find(members[0].Model)?.OS == "Instant On 1960";
            source = "vInstantOn_" + (newer ? "1960" : "1930") + "_1.0\nSKU Description " + members[0].Model + "\nhostname Normalized\n";
            if (members.Count > 1) source += string.Join('\n', members.Select(member => "unit-type unit " + member.Id + " network ge uplink te\ninterface " + member.Id + "/1")) + "\n";
            inventory = InstantOnParser.Parse(source, newer ? choices : null);
        }
        else
        {
            bool cx = members.Any(member => HardwareCatalog.Find(member.Model)?.OS == "AOS-CX") || Text(device, "os").Contains("CX", StringComparison.OrdinalIgnoreCase);
            source = cx ? "!Version ArubaOS-CX 10.0\n" : "; Configuration Editor\n";
            bool chassis = HardwareProfiles.ChassisModels.ContainsKey(model);
            if (chassis) source += "; model " + model + "\n";
            else source += string.Join('\n', members.Select(member => "module " + member.Id + " type " + member.Model)) + "\n";
            if (members.Count > 1) source += "stacking\n";
            foreach (var module in moduleRows)
            {
                string member = Text(module, "member", 12), slot = Text(module, "slot", 24), sku = Text(module, "model", 80);
                if (!Regex.IsMatch(slot, @"^[A-L]$", RegexOptions.IgnoreCase) || !Regex.IsMatch(sku, @"^[A-Z0-9-]+$", RegexOptions.IgnoreCase))
                    throw new InvalidOperationException("Choose a compatible installed module for each confirmed slot.");
                source += "module " + (members.Count > 1 ? member + "/" : "") + slot + " type " + sku + "\n";
            }
            inventory = Parser.Parse(source);
            if (inventory.Groups.Count == 0 && model == Parser.SharedPl48Profile)
                inventory = Parser.Parse("!Version ArubaOS-CX PL.10.0.0000\n" + string.Join('\n', Enumerable.Range(1, 52).Select(number => "interface 1/1/" + number)));
        }
        if (inventory.Groups.Count == 0)
            throw new InvalidOperationException("The selected hardware has no verified Switchport report profile. Confirm the exact model or supply a retained normalized report inventory.");
        inventory.Hostname = Text(device, "name", 200);
        inventory.Firmware = "Unknown";
        inventory.Vlans.Clear(); inventory.SVIs.Clear(); inventory.Routes.Clear(); inventory.Management.Clear(); inventory.Mirrors.Clear();
        foreach (var port in inventory.Ports.Concat(inventory.LogicalInterfaces)) ResetState(port);
        inventory.Assumptions.Add("Hardware geometry is selected from the confirmed NetworkDiagramStudio model/member/module inventory. Report configuration values come only from normalized editor fields; parser defaults are not imported.");
        DeviceIdentities.Apply(inventory, Array.Empty<DeviceIdentity>());
        Overlay(inventory, device); Validate(inventory); return inventory;
    }
    internal static Inventory Combine(Inventory inventory, JsonElement device)
    {
        if (device.ValueKind != JsonValueKind.Object) return inventory;
        JsonElement Composition(string key) => Has(device, key) ? Get(device, key) : Get(Get(device, "hardwareComposition"), key);
        string model = CanonicalModel(Text(device, "model", 200));
        bool knownModel = DeviceModels.Choices.Any(choice => choice.Sku.Equals(model, StringComparison.OrdinalIgnoreCase)) || InstantOn1930.Contains(model, StringComparer.OrdinalIgnoreCase);
        var oldModels = inventory.Groups.Where(group => group.Slot.Length == 0).Select(group => group.Product).Concat(inventory.Devices.Select(detail => detail.ModelSelection)).Append(inventory.ChassisModel).ToArray();
        bool changed = knownModel && !oldModels.Contains(model, StringComparer.OrdinalIgnoreCase) &&
            !(HardwareProfiles.ChassisModels.TryGetValue(model, out var chassis) && chassis.Name == inventory.ChassisModel);
        var members = Composition("stackMembers");
        if (members.ValueKind == JsonValueKind.Array && members.GetArrayLength() > 0)
        {
            var requested = Rows(members).Select(member => Text(member, "id", 12) + "=" + CanonicalModel(Text(member, "model", 200))).Order(StringComparer.OrdinalIgnoreCase);
            var existing = inventory.Groups.Where(group => group.Slot.Length == 0).Select(group => group.Device + "=" + group.Product).Distinct().Order(StringComparer.OrdinalIgnoreCase);
            changed |= !requested.SequenceEqual(existing, StringComparer.OrdinalIgnoreCase);
        }
        var modules = Composition("modules");
        if (modules.ValueKind == JsonValueKind.Array)
        {
            var requested = Rows(modules).Select(module => (Text(module, "member", 12) is { Length: > 0 } member ? member : "1") + "/" + Text(module, "slot", 24) + "=" + Text(module, "model", 80)).Order(StringComparer.OrdinalIgnoreCase);
            var existing = inventory.Groups.Where(group => group.Slot.Length > 0 && group.Product.Length > 0).Select(group => group.Device + "/" + group.Slot + "=" + group.Product)
                .Concat((inventory.ModuleInventory ?? new()).Select(module => module.Device + "/" + module.Slot + "=" + module.Sku)).Distinct(StringComparer.OrdinalIgnoreCase).Order(StringComparer.OrdinalIgnoreCase);
            changed |= !requested.SequenceEqual(existing, StringComparer.OrdinalIgnoreCase);
        }
        if (changed) return FromDevice(device, false);
        Overlay(inventory, device); return inventory;
    }
    static void ResetState(Port port)
    {
        port.Description = ""; port.Mode = "Unknown"; port.UntaggedVlan = null; port.UntaggedState = "Unknown";
        port.TaggedVlans.Clear(); port.VoiceVlan = null; port.TaggedVlanPolicy = null; port.Aggregate = "";
        port.Disabled = null; port.LiveState = "Unknown/Confirm before use"; port.StackLink = false; port.Speed = "Not specified";
        port.ConnectedDevice = "Unknown/Confirm before use"; port.Usage = "Unknown/Confirm before use";
        port.Notes = port.Notes.Where(note => note.Contains("socket", StringComparison.OrdinalIgnoreCase) || note.Contains("Dual-personality", StringComparison.OrdinalIgnoreCase)).ToList();
    }
    internal static void ClearSupplementary(Inventory inventory)
    {
        foreach (var port in inventory.Ports.Concat(inventory.LogicalInterfaces))
        {
            if (port.ConnectedDevice.StartsWith("Observed: ", StringComparison.Ordinal)) port.ConnectedDevice = "Unknown/Confirm before use";
            if (port.LiveState.StartsWith("Observed: ", StringComparison.Ordinal)) port.LiveState = "Unknown/Confirm before use";
            if (port.Speed.StartsWith("Observed: ", StringComparison.Ordinal)) port.Speed = "Not specified";
            port.Notes.RemoveAll(note => note.StartsWith("Supplementary (", StringComparison.Ordinal));
        }
        inventory.Assumptions.RemoveAll(note => note.StartsWith("Supplementary observations from ", StringComparison.Ordinal));
    }
    internal static void Overlay(Inventory inventory, JsonElement device)
    {
        if (device.ValueKind != JsonValueKind.Object) return;
        if (Text(device, "name", 200) is { Length: > 0 } name) inventory.Hostname = name;
        if (Text(device, "firmware", 100) is { Length: > 0 } firmware) inventory.Firmware = firmware;
        if (Text(device, "os", 100) is { Length: > 0 } os) inventory.OS = os;
        if (Text(device, "reportModel", 100) is { Length: > 0 } reportModel) inventory.ReportModel = reportModel;
        if (Has(device, "vlans"))
        {
            var voice = inventory.Vlans.Where(vlan => vlan.Voice).Select(vlan => vlan.Id).ToHashSet();
            inventory.Vlans = Rows(Get(device, "vlans")).Select(vlan => new Vlan
            { Id = Int(Get(vlan, "id")) ?? 0, Name = Text(vlan, "name", 400), Voice = Boolean(Get(vlan, "voice")) ?? voice.Contains(Int(Get(vlan, "id")) ?? 0) }).Where(vlan => vlan.Id > 0).ToList();
        }
        var targets = inventory.Ports.Concat(inventory.LogicalInterfaces).Distinct().ToList();
        foreach (var input in Rows(Get(device, "ports")))
        {
            string id = Text(input, "name", 200); if (id.Length == 0) id = Text(input, "id", 200);
            if (id.Length == 0) continue;
            var matching = targets.Where(port => Key(port.Id) == Key(id) || port.RelatedInterfaces.Any(alias => Key(alias) == Key(id))).ToList();
            if (matching.Count == 0)
            {
                var logical = new Port { Id = id, Group = "Logical interfaces" };
                inventory.LogicalInterfaces.Add(logical); targets.Add(logical); matching.Add(logical);
            }
            foreach (var port in matching)
            {
                if (Has(input, "description")) port.Description = Text(input, "description", 4000);
                if (Has(input, "role")) port.Mode = Text(input, "role", 100) is { Length: > 0 } mode ? mode : "Unknown";
                if (Has(input, "native"))
                {
                    port.UntaggedVlan = Int(Get(input, "native"));
                    string state = Text(input, "nativeState", 40);
                    port.UntaggedState = port.UntaggedVlan.HasValue ? "Known" : state.Equals("none", StringComparison.OrdinalIgnoreCase) || Text(input, "native", 40).Equals("none", StringComparison.OrdinalIgnoreCase) ? "None" : "Unknown";
                }
                if (Has(input, "nativeState") && !port.UntaggedVlan.HasValue)
                    port.UntaggedState = Text(input, "nativeState", 40).Equals("none", StringComparison.OrdinalIgnoreCase) ? "None" : "Unknown";
                if (Has(input, "tagged"))
                {
                    var tagged = Get(input, "tagged"); port.TaggedVlans = Vlans(tagged);
                    bool all = Rows(tagged).Any(value => Text(value).Equals("all", StringComparison.OrdinalIgnoreCase)) || Text(tagged).Equals("all", StringComparison.OrdinalIgnoreCase);
                    port.TaggedVlanPolicy = all ? "All" : null;
                    if (all) port.TaggedVlans = inventory.Vlans.Select(vlan => vlan.Id).Distinct().Order().ToList();
                }
                if (Has(input, "taggedVlanPolicy")) port.TaggedVlanPolicy = Text(input, "taggedVlanPolicy", 400) is { Length: > 0 } policy ? policy : null;
                var except = Vlans(Get(input, "allowedExcept"));
                if (except.Count > 0)
                { port.TaggedVlanPolicy = "All except " + QuickSheet.Ranges(except); port.TaggedVlans = inventory.Vlans.Select(vlan => vlan.Id).Except(except).Distinct().Order().ToList(); }
                if (Boolean(Get(input, "nativeTagged")) == true && Int(Get(input, "native")) is {} taggedNative)
                {
                    port.UntaggedVlan = null; port.UntaggedState = "None";
                    if (!Has(input, "tagged") && !Has(input, "allowedExcept") && !port.TaggedVlans.Contains(taggedNative)) { port.TaggedVlans.Add(taggedNative); port.TaggedVlans.Sort(); }
                    string note = "Configured native VLAN " + taggedNative + " is transmitted tagged.";
                    if (!port.Notes.Contains(note)) port.Notes.Add(note);
                }
                if (Has(input, "voice")) port.VoiceVlan = Int(Get(input, "voice"));
                if (Has(input, "lag")) port.Aggregate = Text(input, "lag", 160);
                if (Has(input, "disabled")) port.Disabled = Boolean(Get(input, "disabled"));
                else if ((Text(input, "adminState", 50) is { Length: > 0 } suppliedAdmin ? suppliedAdmin : Text(input, "admin", 50)) is { Length: > 0 } admin) port.Disabled = Regex.IsMatch(admin, "^(down|disable|disabled|shutdown)$", RegexOptions.IgnoreCase) ? true : Regex.IsMatch(admin, "^(up|enable|enabled)$", RegexOptions.IgnoreCase) ? false : null;
                if (Has(input, "state")) port.LiveState = Text(input, "state", 100) is { Length: > 0 } state ? state : "Unknown/Confirm before use";
                if (Text(input, "configuredSpeed", 100) is { Length: > 0 } configuredSpeed) port.Speed = configuredSpeed;
                else if (Has(input, "speed") && !Text(input, "speed", 100).StartsWith("Observed:", StringComparison.OrdinalIgnoreCase)) port.Speed = Text(input, "speed", 100) is { Length: > 0 } speed ? speed : "Not specified";
                if (Has(input, "stackLink")) port.StackLink = Boolean(Get(input, "stackLink")) == true;
                if (Has(input, "connectedDevice")) port.ConnectedDevice = Text(input, "connectedDevice", 400);
                if (Has(input, "usage")) port.Usage = Text(input, "usage", 400);
                foreach (string field in new[] { "ip", "address" })
                    if (Text(input, field, 200) is { Length: > 0 } address && !port.Notes.Contains("Address: " + address)) port.Notes.Add("Address: " + address);
                foreach (var address in Rows(Get(input, "addresses")).Select(value => Text(value, limit: 200)))
                    if (address.Length > 0 && !port.Notes.Contains("Address: " + address)) port.Notes.Add("Address: " + address);
                foreach (var field in new[] { (Key: "ingressPvid", Prefix: "Configured ingress PVID: "), (Key: "aggregationMode", Prefix: "Aggregation mode: ") })
                    if (Has(input, field.Key))
                    {
                        port.Notes.RemoveAll(note => note.StartsWith(field.Prefix, StringComparison.Ordinal));
                        if (Text(input, field.Key, 100) is { Length: > 0 } value) port.Notes.Add(field.Prefix + value);
                    }
            }
        }
        foreach (var port in inventory.Ports.Where(port => port.Aggregate.Length > 0))
        {
            string KeyLag(string value) => Regex.Replace(Key(value), @"^(lag|trk|portchannel|po|bond|bridgeaggregation|ae)", "");
            var leader = inventory.LogicalInterfaces.FirstOrDefault(candidate => KeyLag(candidate.Id) == KeyLag(port.Aggregate));
            if (leader == null) continue;
            if (!port.UntaggedVlan.HasValue && port.UntaggedState == "Unknown") { port.UntaggedVlan = leader.UntaggedVlan; port.UntaggedState = leader.UntaggedState; }
            if (port.TaggedVlans.Count == 0 && port.TaggedVlanPolicy == null) { port.TaggedVlans = leader.TaggedVlans.ToList(); port.TaggedVlanPolicy = leader.TaggedVlanPolicy; }
            port.VoiceVlan ??= leader.VoiceVlan;
        }
        if (Has(device, "routes")) inventory.Routes = Rows(Get(device, "routes")).Select(route =>
            route.ValueKind == JsonValueKind.String ? Text(route) : string.Join(" | ", new[] { Text(route, "destination"), Text(route, "nextHop"), Text(route, "interface"), Text(route, "metric") }.Where(value => value.Length > 0))).ToList();
        foreach (string blocker in Rows(Get(device, "reportBlockers")).Select(value => Text(value))) if (!inventory.Blockers.Contains(blocker)) inventory.Blockers.Add(blocker);
        foreach (string note in Rows(Get(device, "reportAssumptions")).Select(value => Text(value))) if (!inventory.Assumptions.Contains(note)) inventory.Assumptions.Add(note);
        if (Has(device, "reportDetails")) DeviceIdentities.Apply(inventory, Read<DeviceIdentity>(Get(device, "reportDetails")));
        else if (inventory.Devices.Count == 1)
        {
            var parent = inventory.Devices[0];
            if (Has(device, "serialNumber")) parent.SerialNumber = Text(device, "serialNumber", 80);
            if (Has(device, "assetTag")) parent.AssetTag = Text(device, "assetTag", 80);
            if (Has(device, "notes")) parent.Notes = Text(device, "notes", 400);
        }
    }
    static int? Int(JsonElement value)
    {
        string text = Text(value, limit: 12);
        return int.TryParse(text, NumberStyles.None, CultureInfo.InvariantCulture, out int number) && number is >= 1 and <= 4094 ? number : null;
    }
    static List<int> Vlans(JsonElement value)
    {
        var result = new HashSet<int>();
        foreach (var text in (value.ValueKind == JsonValueKind.Array ? Rows(value).Select(item => Text(item)) : new[] { Text(value) }))
        foreach (string token in text.Split(new[] { ',', ';', ' ' }, StringSplitOptions.RemoveEmptyEntries))
        {
            if (token.Equals("all", StringComparison.OrdinalIgnoreCase)) continue;
            var pair = token.Split('-');
            if (pair.Length > 2 || !int.TryParse(pair[0], out int first) || !int.TryParse(pair[^1], out int last) || first < 1 || last > 4094 || first > last)
                throw new InvalidOperationException("A report VLAN is outside the supported 1-4094 range.");
            for (int number = first; number <= last; number++) result.Add(number);
        }
        return result.Order().ToList();
    }
    internal static object ToDevice(Inventory inventory, string id)
    {
        var members = inventory.Groups.Where(group => group.Slot.Length == 0).GroupBy(group => group.Device).Select(group => new { id = group.Key, model = group.First().Product }).ToArray();
        if (!ReportText.IsStack(inventory)) members = members.Take(0).ToArray();
        var modules = inventory.Groups.Where(group => group.Slot.Length > 0 && group.Product.Length > 0).Select(group => new { member = group.Device, slot = group.Slot, model = group.Product })
            .Concat((inventory.ModuleInventory ?? new()).Select(module => new { member = module.Device, slot = module.Slot, model = module.Sku }))
            .DistinctBy(module => module.member + "/" + module.slot).ToArray();
        object PortRow(Port port) => new
        {
            name = port.Id, description = port.Description, role = port.Mode == "Unknown" ? "" : port.Mode.ToLowerInvariant(),
            native = port.UntaggedVlan, nativeState = port.UntaggedState.ToLowerInvariant(), tagged = port.TaggedVlans,
            taggedVlanPolicy = port.TaggedVlanPolicy, voice = port.VoiceVlan, lag = port.Aggregate, disabled = port.Disabled,
            state = port.LiveState.StartsWith("Unknown", StringComparison.OrdinalIgnoreCase) ? "" : port.LiveState,
            speed = port.Speed == "Not specified" ? "" : port.Speed, media = port.Media, stackLink = port.StackLink,
            connectedDevice = port.ConnectedDevice, usage = port.Usage, relatedInterfaces = port.RelatedInterfaces,
            notes = port.Notes, logical = !inventory.Ports.Contains(port)
        };
        return new
        {
            id, name = inventory.Hostname, kind = inventory.OS == "FortiOS" ? "firewall" : "switch", vendor = inventory.Vendor,
            model = inventory.Groups.Select(group => group.Product).FirstOrDefault(product => !HardwareCatalog.IsModule(product)) ?? inventory.ChassisModel,
            os = inventory.OS, firmware = inventory.Firmware, ports = inventory.Ports.Concat(inventory.LogicalInterfaces).GroupBy(port => Key(port.Id)).Select(group => PortRow(group.First())),
            vlans = inventory.Vlans.Select(vlan => new { id = vlan.Id, name = vlan.Name, voice = vlan.Voice }),
            routes = inventory.Routes.Select(route => new { destination = route }), reportDetails = inventory.Devices,
            switchportInventory = inventory,
            stackMembers = members,
            modules,
            hardwareComposition = new
            {
                stackMembers = members,
                modules
            }
        };
    }
    internal static void Validate(Inventory inventory)
    {
        if (inventory.Groups == null || inventory.Ports == null || inventory.LogicalInterfaces == null || inventory.Vlans == null || inventory.Devices == null || inventory.Assumptions == null || inventory.Blockers == null || inventory.SVIs == null || inventory.Routes == null || inventory.Management == null || inventory.Mirrors == null)
            throw new InvalidOperationException("The normalized report inventory is incomplete.");
        if (inventory.Groups.Count > 48 || inventory.Ports.Count > 2000 || inventory.LogicalInterfaces.Count > 10000 || inventory.Vlans.Count > 4094 || inventory.Assumptions.Count + inventory.Blockers.Count > 10000)
            throw new InvalidOperationException("The normalized report inventory exceeds report limits.");
        if (inventory.Groups.Any(group => group == null || string.IsNullOrWhiteSpace(group.Id) || group.SocketLayout == null || group.Expected < 0 || group.Expected > 2000 || group.SocketLayout.Count > 4000 ||
            group.SocketLayout.Any(socket => socket == null || socket.Number < 1 || socket.Number > group.Expected || socket.Row is < 0 or > 15 || !double.IsFinite(socket.Column) || socket.Column is < 0 or > 10000)) ||
            inventory.Groups.Select(group => group.Id).Distinct(StringComparer.Ordinal).Count() != inventory.Groups.Count)
            throw new InvalidOperationException("The normalized report hardware groups are invalid.");
        foreach (var group in inventory.Groups)
        {
            if (group.Device == null || group.Slot == null || group.Product == null || group.Prefix == null || group.OpticalSide == null || group.OpticalType == null) throw new InvalidOperationException("A report hardware identity is invalid.");
            if (group.SocketLayout.Count > 0 && (!group.SocketLayout.Select(socket => socket.Number).Distinct().Order().SequenceEqual(Enumerable.Range(1, group.Expected)) || group.SocketLayout.GroupBy(socket => (socket.Number, socket.Suffix)).Any(items => items.Count() > 1))) throw new InvalidOperationException("Physical socket identity is duplicated or incomplete.");
        }
        foreach (var port in inventory.Ports.Concat(inventory.LogicalInterfaces))
        {
            if (port == null || string.IsNullOrWhiteSpace(port.Id) || port.Id.Length > 200 || port.TaggedVlans == null || port.Notes == null || port.RelatedInterfaces == null || port.TaggedVlans.Count > 4094 || port.Notes.Count > 1000 || port.RelatedInterfaces.Count > 100 || port.UntaggedVlan is < 1 or > 4094 || port.VoiceVlan is < 1 or > 4094 || port.TaggedVlans.Any(id => id is < 1 or > 4094))
                throw new InvalidOperationException("The normalized report contains an invalid interface.");
            port.Description = Parser.Safe(port.Description ?? ""); port.Group ??= ""; port.DisplayNumber ??= ""; port.Media ??= "Unknown";
            port.Mode ??= "Unknown"; port.UntaggedState ??= "Unknown"; port.Aggregate = Parser.Safe(port.Aggregate ?? "");
            port.ConnectedDevice = Parser.Safe(port.ConnectedDevice ?? ""); port.Usage = Parser.Safe(port.Usage ?? ""); port.Speed = Parser.Safe(port.Speed ?? "Not specified"); port.LiveState = Parser.Safe(port.LiveState ?? "Unknown/Confirm before use");
            port.Notes = port.Notes.Select(note => Parser.Safe(note ?? "")).ToList();
        }
        if (inventory.Ports.GroupBy(port => port.Id, StringComparer.OrdinalIgnoreCase).Any(group => group.Count() > 1) || inventory.Ports.Any(port => !inventory.Groups.Any(group => group.Id == port.Group)))
            throw new InvalidOperationException("Physical interfaces must have unique identities and valid hardware groups.");
        foreach (var group in inventory.Groups)
            if (!inventory.Ports.Where(port => port.Group == group.Id).Select(port => port.Number).SequenceEqual(Enumerable.Range(1, group.Expected)))
                throw new InvalidOperationException("The report interface inventory does not match its confirmed hardware count and order.");
        if (inventory.Vlans.Any(vlan => vlan == null || vlan.Id is < 1 or > 4094)) throw new InvalidOperationException("The report contains an invalid VLAN identity.");
        inventory.Hostname = Parser.Safe(inventory.Hostname ?? "Unknown"); inventory.Vendor = Parser.Safe(inventory.Vendor ?? "Unknown"); inventory.OS = Parser.Safe(inventory.OS ?? "Unknown"); inventory.Firmware = Parser.Safe(inventory.Firmware ?? "Unknown");
        inventory.Topology = Parser.Safe(inventory.Topology ?? "Unknown"); inventory.ChassisModel = Parser.Safe(inventory.ChassisModel ?? ""); inventory.ReportModel = Parser.Safe(inventory.ReportModel ?? "");
        inventory.Assumptions = inventory.Assumptions.Select(text => Parser.Safe(text ?? "")).ToList(); inventory.Blockers = inventory.Blockers.Select(text => Parser.Safe(text ?? "")).Distinct().ToList();
        foreach (var vlan in inventory.Vlans) vlan.Name = Parser.Safe(vlan.Name ?? "");
        if (inventory.Devices.Count > 0) DeviceIdentities.Apply(inventory, inventory.Devices.ToList(), inventory.Devices);
    }
}
