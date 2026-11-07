# Configuration-driven hardware coverage

The November 2026 upload batch was checked against manufacturer hardware guides. Thirty-two readable configuration files parse and render. This is a file count, including repeated captures, not a unique-device count. One RouterOS binary restore backup and one explanatory README are not text configurations. Private inputs and captures remain outside the repository.

## Recognition and evidence

| Evidence | Drawing behavior | Remaining confirmation |
| --- | --- | --- |
| Explicit model, member type, product ID or FortiOS header | Prefer the declared model and its documented layout | Installed removable cards and optics may still be unknown |
| C9500 family evidence, complete 24/48 TwentyFiveGigE ports and four following HundredGigE ports | Shared 24Y4C/48Y4C front data-port drawing | Exact SKU is not asserted; front management has no calibrated anchor in this profile |
| IOS 15 / 3560 family evidence, complete Gi0/1-52, Te0/1-2 and Fa0 signature | Shared 48-port copper access drawing; 3560-E family only with matching family evidence | Select the exact model before choosing modules; rear Fa0 is not placed on the front |
| AOS-CX PL header and complete 16/28/52 front interfaces | Shared 6000/6100 12G/24G/48G drawing | Exact SKU, PoE capabilities and SFP speed remain unconfirmed |
| Configured 2920 A/B interfaces without a card declaration | Retain the rear bay and a confirmation notice | Select J9731A SFP+ or J9732A 10GBASE-T in the member's bay |
| Partial command fragment without a model | Retain ports, VLANs and a generic branded device role | Select a verified model or map a local stencil |
| RouterOS binary backup, including renamed .txt | Report the unsupported binary and explain text export | In RouterOS run /export file=diagram and import diagram.rsc; leave sensitive-data export disabled |

A family drawing does not create an orderable SKU. Device details explains the evidence and lets the user select a model from the equipment label. Declared identities supersede inferred family layouts regardless of import order. Disabling a source still removes its inferred identity through normal evidence recomposition. User edits remain authoritative.

## Physical references and corrections

| Hardware | Geometry and mapping checked | Primary reference |
| --- | --- | --- |
| FortiGate 120G/121G | Fixed HA/management, copper, SFP+ and SFP banks remain distinct | [Fortinet quick-start guide](https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/f9fb064a-a672-11ee-8673-fa163e15d75b/FG-120G-SERIES-QSG.pdf) |
| FortiGate 200G/201G | 16 copper data ports, eight SFP+ ports, four SFP ports and HA/management; top and bottom connectors face opposite directions | [Fortinet quick-start guide](https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/ff9309bd-92ed-11ef-a705-1222899fa4e9/FG-200G-Series-QSG.pdf) |
| Aruba CX 6000/6100 | Compact 12G geometry, left optical bank, separate copper uplinks, 24/48-port banks, printed numbering and physical aspect ratios | [Installation guide, front panels and dimensions](https://arubanetworking.hpe.com/techdocs/hardware/switches/6100/IGSG/igsg_6000-6100.pdf) |
| Aruba 2930F JL256A/JL558A | Left 2-by-2 optical bank, four copper groups, paired orientation and 44.25/4.39 cm aspect ratio | [Installation guide](https://arubanetworking.hpe.com/techdocs/hardware/switches/2930/IGSG/Aruba_2930_IGSG.pdf) |
| Aruba CX 6200F JL727A | Four copper groups, right optical bank and separate front management jack | [Installation guide](https://arubanetworking.hpe.com/techdocs/hardware/switches/6200/IGSG/Aruba_6200_IGSG.pdf) |
| Aruba 2920 J9729A stacks | Front combo sockets and member-qualified rear bays; configured interfaces do not prove card type | [2920 hardware guide](https://support.hpe.com/hpesc/public/api/document/c03898362) |
| Aruba 5406R/5412R J9850A/J9851A | 44.45 cm width with 17.53/30.73 cm height, paired A-B through E-F/K-L slot order, management section and slot-qualified anchors | [Installation guide](https://support.hpe.com/hpesc/public/api/document/emr_na-c04655001?docLocale=en_US) and [QuickSpecs](https://www.hpe.com/psnow/doc/c04293383) |
| J9986A/J9987A/J9993A modules | Copper and optical forms, numbering, paired-row orientation and appropriate socket widths | [Switch-module guide](https://support.hpe.com/hpesc/public/api/document/c04654886) |
| Cisco C9500-24Y4C/48Y4C | SFP28 data and QSFP28 uplink banks; odd top/even bottom; 25-28 or 49-52 uplinks | [Cisco hardware guide](https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst9500/hardware/install/b_catalyst_9500_hig/9500_product-overview.html) |
| Cisco WS-C3650-48PD | Declared member identity, access/uplink namespaces, two 1G plus two 10G uplinks and shared stack width | [Cisco hardware guide](https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst3650/hardware/installation/guide/Cat3650hig_book/HIGOVERV.html) |
| Cisco 3560-E | 48 copper access ports and two X2 bays; TwinGig aliases are not simultaneously populated X2 jacks | Cisco-authored Catalyst 3750-E/3560-E Hardware Installation Guide OL-9774-03, chapter 1, [archived manufacturer text](https://manuals.plus/m/130810ae7794299b2d796cc3a8e0ad61bea8a393a7a8250eb4701b34a2546922) |
| SonicWall NSA 3600 | Existing management, copper and optical banks retained; USB U0/U1 remain outside the Ethernet faceplate map | [SonicWall getting-started guide](https://www.sonicwall.com/techdocs/pdf/guide-getting-started-nsa-2600-3600-4600-560.pdf) |

These are editable schematic drawings, not imported manufacturer artwork. They preserve documented port arrangements and approximate normalized jack centers. Small decorative labels, screw positions and LED artwork are simplified. Unknown hardware never receives fabricated physical anchors. A local calibrated stencil can replace the schematic at any time.

[MikroTik configuration export reference](https://help.mikrotik.com/docs/spaces/ROS/pages/328155/Configuration%2BManagement).
