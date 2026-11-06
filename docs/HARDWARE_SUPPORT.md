# Hardware and configuration imports

Import Auvik XLSX or CSV device, interface and route reports with saved configurations from the same site. A configuration supplies intended settings. Auvik supplies the port state, negotiated speed and reported neighbor at collection time. Check warnings and correct uncertain connections before exporting.

## Input coverage

| Input | Supported evidence |
| --- | --- |
| Auvik site or per-device XLSX | Devices, Interfaces and Routes worksheets. The importer follows workbook relationships and supports shared strings, inline strings and sparse rows. |
| Auvik CSV | A Devices, Interfaces or Routes table with its original column headers. Quoted and multiline fields are supported. |
| Operational CLI captures | Prompted show/get/diagnose/display captures are detected separately from configurations. Common IOS/AOS-CX interface-status rows, Junos physical state, PAN-OS interface-state rows, FortiOS NIC state/speed, detailed LLDP/CDP and supported summary tables, explicit transceiver media, VLAN brief names, and common IOS/FortiOS/AOS-CX/Junos IPv4 route rows supply observations. Preserve command headings and prompts. Multiple device prompts are separated. Other output formats require review. |
| Aruba AOS-CX text | Hostname, VSF model declaration, VLAN IDs and names, access and trunk membership, native VLAN, allowed list, LAG assignments, VLAN interfaces, addresses and IPv4 static routes. |
| ArubaOS-Switch / ProCurve text | Hostname, VLAN blocks, tagged and untagged numeric port ranges, VLAN interface addresses and explicit static routes. |
| Cisco IOS / IOS-XE / NX-OS-style text | Hostname, model declarations, individual interfaces and same-prefix numeric ranges, access/voice/native VLANs, trunk lists, channel groups, SVIs, interface addresses and IPv4 static routes. Arista EOS can use the common switchport syntax. |
| Huawei VRP / HPE Comware-style text | Sysname, VLAN and interface blocks, access/trunk commands, PVIDs, bridge or Ethernet aggregation memberships and IPv4 static routes. Coverage depends on the exported syntax. |
| FortiOS text | Hostname and model, logical and physical interfaces, explicit speed/media settings, IPv4 addresses, VLAN subinterfaces and their parents, interface group members, virtual-wire pairs, WAN interface role, SD-WAN members, configured member gateways and zones, and IPv4 static routes. |
| PAN-OS XML / set format | Device hostname and management address, Ethernet and aggregate interfaces, explicit subinterface VLAN tags and addresses, virtual wires, and IPv4 static routes with their virtual-router context. Device-level configurations are supported. Panorama template stacks and policy hierarchies require manual review. |
| SonicOS text | Decoded settings in key/value form, including interface IPs, VLANs and named or scoped routing policies. E-CLI interface blocks support IP assignment, zones and VLAN identifiers. Encrypted or opaque binary bundles require a clear-text export. |
| pfSense / OPNsense XML | Hostname, interface assignments, static IPv4 addresses, VLAN parent and ID, named gateways, static routes and bridge members. OPNsense gateway UUID references and current MVC gateways are supported. |
| Cisco ASA CLI | Version- or syntax-identified firewall, physical interfaces, nameif aliases, VLAN subinterfaces, primary IPv4 address, channel groups, shutdown state and ASA static routes. |
| Junos set-format text | Hostname, interface descriptions, switching modes, named VLAN memberships, aggregation parent, IRB unit addresses and explicit static next hops. |
| MikroTik RouterOS text export | Identity, explicit model comment, bridge members, PVIDs, tagged/untagged bridge VLANs, VLAN interfaces, IPv4 addresses and static gateways. |

Supply Junos configurations in set format and RouterOS configurations as text exports. Unsupported files return a warning. You can enter a device manually or add its missing ports, links and media in the project. The parser covers the commands above. For VRF or routing-instance scoped routes, dynamic routing, full policy interpretation, complex interface-range expressions, mixed-model stacks, or CLI syntax outside these subsets, review the source before documenting the result. An explicit VLAN allow-list containing “all” stays a wildcard. An import cannot establish which optics are installed from an SFP cage inventory alone.

Readable exports are required. DTD declarations, external entities, malformed or unrecognized XML, and opaque firewall backup files yield warnings. They do not generate a topology. Use a supported clear-text export, Auvik report or manual device instead. Exported security policy, passwords, certificate data, VPN secrets and raw configuration text are outside the imported model.

## Matching and conflicts

Device IDs retain the hostname punctuation and use lowercase for comparison. Auvik interface rows provide both local and remote ports when the Connected To column names a remote interface and device. A devices-only inventory provides identities and addresses. If several addresses are present, the importer can select the only address unique to that inventory. The complete reported list remains available on the device.

Configuration settings take priority over report metadata in a single import. Links reported from both directions are merged using both device names and both port names. Multiple peers at the same endpoint and a down port with a reported peer are flagged for review. An SD-WAN member gateway is stored on its configured interface. A missing explicit zone remains unspecified. A configured port description is a label. It does not create a physical link. An empty port state or media field means the source did not establish its value.

On the switch port map, a reported AP peer is separate from a matching AP profile. The latter requires an available trunk with the same native and tagged settings as at least two connected APs on that switch. Aggregates, configured handoffs, and ports with a reported peer are excluded from this inference.

## Hardware identities

The offline lookup includes 249 HPE switch SKU identities and 84 exact device profiles with network-interface names and capabilities. Six Aruba 6100 profiles belong to both sets. The 84 profiles cover 11 manufacturers, including HPE Aruba, Cisco, Fortinet, Juniper, Arista, MikroTik, Palo Alto Networks, Sophos, SonicWall, Netgate and Deciso. A model outside the profiles can still be imported with the ports supplied by the configuration or report. Hostnames, family names and port counts alone do not select an exact chassis model.

Each exact profile retains its source path in the NetBox Community Device Type Library. The snapshot uses commit 7530643cb38decaa1cba31e901892b9131315239, under CC0 1.0 Universal. Only model identity, SKU, manufacturer and interface facts are included. The CC0 notice ships alongside the data. [Source profiles](https://github.com/netbox-community/devicetype-library/tree/7530643cb38decaa1cba31e901892b9131315239/device-types) · [CC0 notice](../src/web/imports/NETBOX-LICENSE.txt)

The additional HPE SKU and family identifiers were checked against the public Switchport Diagram Builder hardware catalog. The SKU list excludes removable modules. Its original catalog and its vendor references distinguish identification from verified physical layout. [Hardware catalog](https://github.com/TechSavage1989/Switchport_Diagram_Builder/blob/main/Source/SwitchportGenerator/Data/hardware-catalog.json) · [Catalog coverage](https://github.com/TechSavage1989/Switchport_Diagram_Builder/blob/main/docs/CATALOG_REFRESH.md)

Configuration Inspector informed the handling of exact model identifiers, community capabilities and supplementary operational reports. NetworkDiagramStudio implements its own importers. Product photos, vendor stencils and third-party parser implementations are outside the bundled catalog. [Configuration Inspector](https://github.com/TechSavage1989/Configuration-Inspector) · [Hardware reference sources](https://github.com/TechSavage1989/Configuration-Inspector/blob/main/webview/PORT_HARDWARE_SOURCES.txt)

## Local verification

Run the importer tests with Node.js 22 or later from the repository root.

    node --test tests/imports.test.mjs tests/imports-firewalls.test.mjs

The tests exercise fictional configurations, cross-source matching, contradictory port observations, configuration-only admin state, and a generated compressed XLSX workbook. Report data stays in memory. Importers do not issue network requests or run configuration commands.
