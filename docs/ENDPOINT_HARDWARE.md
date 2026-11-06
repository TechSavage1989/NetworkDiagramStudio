# Server, storage and virtualization recognition

NetworkDiagramStudio includes a recognition catalogue for common server, storage, HCI and virtualization families. It supplies inventory roles, vendor/family names, technology labels and manufacturer references. It does not supply a universal hardware database or an exact faceplate for every configuration.

The catalogue is in [endpoint-hardware.mjs](../src/web/imports/endpoint-hardware.mjs). Entries expose id, family, vendor, kind, technology, aliases, officialSource, moduleGuidance and portLayout. The exported endpointHardwareCatalog is immutable. The matchEndpointHardware function checks a model label first, then a description if the label has no match. Each input is limited to 4096 characters, and the matcher uses a fixed collection of family patterns and bounded word aliases. An unmatched model returns null.

The normal identify function retains existing exact switch/firewall recognition before checking these endpoint families. Concrete imported model text is retained. Family, technology and hardwareFamily are additional inventory metadata. Auvik's declared Type takes priority when it supplies a recognized device role. A physical PowerEdge model can therefore remain a Hypervisor host, and a Windows Server guest can remain a Virtual machine. Manual device-role choices remain authoritative. Windows Server recognition alone does not imply that Hyper-V is installed or enabled.

## Recognition coverage

| Category | Families and common model aliases | Default inventory role |
| --- | --- | --- |
| Dell servers | PowerEdge R rack, T tower, M blade, MX modular, XE accelerated and general PowerEdge; examples R740, R750xd, T550, M640, MX750c, XE9680 | Server |
| HPE servers | ProLiant DL/ML/BL and MicroServer; Synergy compute/frame families; Apollo | Server |
| Lenovo servers | ThinkSystem SR/ST/SD/SE/SN/SC and related server family labels | Server |
| Cisco servers | UCS C/B/X/S server families, including common UCSB blade identifiers | Server |
| Supermicro servers | SuperServer, SuperBlade, MicroBlade, MicroCloud and common SYS/AS/SBI/SBE identifiers | Server |
| Dell storage | PowerStore, PowerVault ME/MD, Unity / Unity XT, PowerScale / Isilon | Storage |
| NetApp storage | AFF A/C, ASA / ASA r2, FAS | Storage |
| Pure Storage | FlashArray, FlashBlade | Storage |
| HPE storage | Nimble CS/AF/HF, Alletra, MSA, 3PAR / StoreServ | Storage |
| IBM / Lenovo storage | IBM FlashSystem; Lenovo ThinkSystem DM and DE | Storage |
| NAS and storage platforms | Synology DiskStation / RackStation and SA/FS/UC/HD/PAS families; QNAP TS/TVS/TES/TBS/ES/HS NAS; TrueNAS / FreeNAS | Storage |
| HCI | Dell VxRail, Lenovo ThinkAgile, Scale Computing HyperCore / HC3, Nutanix HCI / NX | Hyperconverged node |
| Hypervisors | VMware ESXi / vSphere, Microsoft Hyper-V, Proxmox VE, Nutanix AHV, XCP-ng, XenServer / Citrix Hypervisor, Linux KVM | Hypervisor host |
| Server software | Microsoft Windows Server | Server |

These are family matches. They are not model-by-model hardware qualification or a guarantee of support for every product suffix. Bare model aliases are deliberately limited. Generic vendor names do not turn all QNAP devices into NAS systems, all Synology devices into storage, or all Cisco UCS equipment into servers. KVM switches/consoles are excluded from Linux KVM platform matching. Some short model identifiers remain ambiguous in real inventories, so the device-role control and custom model/stencil path are available for corrections.

## Physical port accuracy

No endpoint family entry creates a fixed list of physical interfaces or asserts an installed NIC/HBA capability. Server and array connectivity depends on chassis generation, motherboard/LOM, OCP/FlexibleLOM/mezzanine cards, PCIe risers, HBA/NIC selections, storage controllers and expansion modules. The [Dell R750 NIC specifications](https://www.dell.com/support/manuals/en-uk/poweredge-r750/per750_ts_pub_ism/nic-port-specifications?guid=guid-dabcb721-3b21-4dd8-aaf2-a2dec4444806&lang=en-us), for example, document multiple optional OCP configurations. That supports treating a family match as identity metadata rather than inventing one socket layout.

Use imported interface records, the actual installed adapter inventory and a matching manufacturer stencil to locate ports. Map and verify those sockets in the port mapper. An unmatched or custom model remains editable and can use a local stencil. Existing switch/firewall profiles continue to provide their separately researched fixed interfaces.

A hypervisor name identifies software, not a chassis. Physical uplinks must be mapped to the host's actual NICs. Virtual NICs, bridges, bonds, VMkernel interfaces and virtual switches are logical objects and do not identify a physical socket by themselves. No automatic physical-to-virtual topology or controller/HA relationship is inferred by this catalogue.

## Official references

Reviewed 2026-11-06. These first-party portfolio and documentation pages establish the family names and the distinction between hardware and software platforms. They are not a statement that every listed product is currently sold or supported. Older deployed families are intentionally recognized.

| Reference | Catalogue coverage / implementation implication |
| --- | --- |
| [Dell PowerEdge portfolio and documentation](https://www.dell.com/support/kbdoc/en-us/000203855/poweredge-rack-and-tower-servers-hardware-and-software-portfolio-documentation-videos) | Rack, tower, modular and XE server families |
| [Dell enterprise storage portfolio](https://www.dell.com/en-us/shop/scc/sc/storage-products) | PowerStore, PowerVault, Unity XT and PowerScale |
| [Dell VxRail architecture](https://www.dell.com/support/manuals/en-ai/vxrail-p-series-nodes/vxrail_architecture_guide_8/array-based-storage?guid=guid-df9ace6e-97a5-498b-889f-6b96de17f2d5&lang=en-us) | VxRail nodes and the distinction between nodes and external arrays |
| [HPE compute portfolio](https://www.hpe.com/us/en/products/compute.html) | ProLiant and Synergy compute families |
| [HPE Synergy networking adapter QuickSpecs](https://www.hpe.com/psnow/doc/a00043968enw) | ProLiant, Synergy and Apollo references; adapter options depend on the installed system |
| [HPE Apollo chassis guide](https://support.hpe.com/hpesc/public/docDisplay?docId=sd00004590en_us) | Modular chassis, nodes, orientation and optional components |
| [HPE storage portfolio](https://developer.hpe.com/platform/hpe-storage/home/) | Alletra, Nimble, MSA and legacy 3PAR families |
| [Lenovo servers and storage portfolio](https://lenovopress.lenovo.com/lp1553-lenovo-servers-and-storage-portfolio-guide) | ThinkSystem servers, DM/DE arrays and ThinkAgile HCI |
| [Cisco UCS product-line documentation](https://www.cisco.com/c/en/us/support/servers-unified-computing/category.html) | C/B/X/S server families, separate from fabric interconnects |
| [Supermicro SuperBlade portfolio](https://www.supermicro.com/en/products/superblade) | Blade/server naming and configurable networking |
| [NetApp ONTAP hardware documentation](https://docs.netapp.com/us-en/ontap-systems/) | AFF, ASA and FAS systems |
| [Pure Storage architecture portfolio](https://support-be.purestorage.com/bundle/AB-220301-v04-StorageArchitectureForAI/raw/resource/enus/AB-220301-v04-StorageArchitectureForAI.pdf) | FlashArray and FlashBlade families |
| [IBM FlashSystem resources](https://www.ibm.com/products/flashsystem/resources) | FlashSystem family and model-dependent I/O |
| [Synology product catalogue](https://www.synology.com/en-us/products) | NAS/SAN families, built-in versus optional networking |
| [QNAP NAS product catalogue](https://www.qnap.com/en/product/) | NAS model prefixes and optional network adapters |
| [TrueNAS hardware documentation and stencils](https://www.truenas.com/docs/hardware/) | Model-specific hardware documentation and manufacturer stencil availability |
| [Scale Computing HyperCore](https://docs.scalecomputing.com/articles/sc-hypercore-user-guide/registration/) | Integrated HCI software/platform identity |
| [Nutanix NX platforms](https://www.nutanix.com/products/nx-platforms) and [AHV](https://www.nutanix.com/products/ahv) | Hardware/node families and AHV software are separate records |
| [Broadcom VMware ESXi network links](https://knowledge.broadcom.com/external/article/343872/verifying-network-links-for-esxi-hosts.html) | Host NIC inventory and physical network-link verification |
| [Microsoft Hyper-V overview](https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/overview) | Hyper-V role versus Windows Server operating system |
| [Proxmox VE features](https://proxmox.com/en/products/proxmox-virtual-environment/features) | KVM/LXC software platform, bridges and flexible networking |
| [XCP-ng documentation](https://docs.xcp-ng.org/) and [XenServer technical overview](https://docs.xenserver.com/us/en/xenserver/9/technical-overview.html) | Distinct virtualization products built around Xen |
| [Linux KVM project](https://www.linux-kvm.org/page/Main_Page) | Kernel virtualization technology, not a fixed host model |

## Verification

The endpoint-hardware tests cover common aliases across each category, family matching bounds, ambiguous vendor/product exclusions, unchanged switch/firewall recognition, Auvik role precedence, imported NIC metadata and the absence of fabricated family-level interfaces. Manufacturer faceplates and installed port positions need separate model/configuration evidence.
