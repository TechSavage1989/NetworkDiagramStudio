using System.Text.Json;
using SwitchportGenerator;

namespace NetworkDiagramStudio.SwitchportReports;

/// <summary>Emit the same verified socket identities for the offline browser catalog.</summary>
internal static class CatalogGeometry
{
    internal static Inventory Model(string sku)
    {
        if (HardwareProfiles.ChassisModels.TryGetValue(sku, out var chassis))
            return new Inventory { Hostname = "", Vendor = "Aruba/HPE", OS = "AOS-Switch", Topology = "Modular", ChassisModel = chassis.Name, ChassisSlots = chassis.Slots,
                Devices = new() { new DeviceIdentity { Id = "1", Label = "Chassis", Kind = "Chassis", Model = chassis.Name, DetectedModel = chassis.Name, ModelSelection = sku } } };
        using var document = JsonDocument.Parse(JsonSerializer.Serialize(new { name = "", model = sku, ports = Array.Empty<object>(), vlans = Array.Empty<object>() }));
        var inventory = NormalizedInventory.FromDevice(document.RootElement);
        // Legacy verified profiles use the same explicit placements as the
        // native renderer. Materialize those positions for the browser so it
        // never has to recreate odd/even rows, combo sockets or bank gaps.
        var placements = Charts.Layout(inventory);
        foreach (var group in inventory.Groups.Where(group => group.SocketLayout.Count == 0))
        {
            var physical = placements.Where(placement => placement.Group == group.Id).ToArray();
            if (physical.Length == 0) continue;
            double left = physical.Min(placement => placement.Tile.X);
            var rows = physical.Select(placement => placement.Tile.Y).Distinct().Order().ToArray();
            double blank = group.BlankLeft ? inventory.FlexibleUplinks || group.Product == "J9573A" ? 12 : 4 : 0;
            foreach (var placement in physical)
            {
                var port = inventory.Ports.Single(port => port.Id == placement.Port);
                group.SocketLayout.Add(new HardwareSocket { Number = port.Number, Column = blank + (placement.Tile.X - left) / 48, Row = Array.IndexOf(rows, placement.Tile.Y), Media = placement.Socket == "M" ? "SFP" : port.Media, Suffix = placement.Socket });
            }
        }
        inventory.Assumptions.Clear(); inventory.Hostname = "";
        return inventory;
    }
    internal static object Module(string parent, string slot, string sku)
    {
        Inventory inventory;
        if (CiscoHardware.Find(parent) != null)
        {
            inventory = new Inventory { Hostname = "", Vendor = "Cisco", OS = "Cisco IOS XE", Topology = "Fixed", Groups = new() { new Group { Id = "Switch", Product = parent, Device = "1" } } };
            CiscoModuleCatalog.Apply(inventory, new() { new DeviceIdentity { Id = "1", ModuleSelections = new() { new DeviceModuleSelection { Slot = slot, Sku = sku } } } });
            inventory.Groups.RemoveAll(group => group.Slot.Length == 0);
        }
        else
        {
            var hardware = HardwareCatalog.Find(sku) ?? throw new InvalidOperationException("Missing verified module geometry for " + sku + ".");
            bool rear = HardwareProfiles.Is2920(parent);
            var group = new Group
            {
                Id = (rear ? "Rear " : "Module ") + slot, Device = "1", Slot = slot, Product = sku, Prefix = slot,
                Copper = hardware.Copper, Optical = hardware.Optical, OpticalSide = hardware.Side, OpticalType = hardware.OpticalType,
                OpticalOnly = hardware.SingleRow, BlankLeft = hardware.BlankLeft, Rear = rear,
                SocketLayout = JsonSerializer.Deserialize<List<HardwareSocket>>(JsonSerializer.Serialize(hardware.Sockets))!
            };
            inventory = new Inventory { Hostname = "", Vendor = "Aruba/HPE", OS = "AOS-Switch", Groups = new() { group } };
            for (int number = 1; number <= group.Expected; number++) inventory.Ports.Add(new Port { Id = slot + number, Group = group.Id, Number = number, Media = group.SocketLayout.First(socket => socket.Number == number).Media });
            inventory.ModuleInventory = new() { new InstalledModule { Device = "1", Slot = slot, Sku = sku, OperatorSupplied = true } };
        }
        DeviceIdentities.Apply(inventory, Array.Empty<DeviceIdentity>());
        foreach (var port in inventory.Ports) port.Notes.Clear();
        return new { inventory.Groups, inventory.Ports, devices = inventory.Devices.Where(device => device.Kind == "Module").ToArray(), inventory.ModuleInventory };
    }
}
