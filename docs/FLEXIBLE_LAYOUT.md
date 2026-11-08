# Flexible layout and connector geometry

**Pages & layout** edits page display names separately from their stable internal identities, so renaming a tab does not discard object edits. Select **Drawing defaults** for common drawing, device and text scales, or choose a page and clear **Use drawing defaults** for a page override. Select a device in the inventory for its own scale. In **Edit drawing**, Shift-click to add or remove items from the selection. Hold Shift while dragging to lock movement to the first horizontal or vertical direction, measured from the starting position. **Size - / Size +** resize selected objects by 10%; **Size...** applies a percentage to selected items, this page, or all pages. Cables follow the resized device ports. Explicit object sizes and font sizes override the automatic defaults.

**Place beside...** lets you choose a reference device and click Left, Right, Above or Below. Automatic spacing reserves room for titles and connections and avoids other equipment; Compact and Extra room adjust the gap. Selected devices move together. **Move to page...** sends selected devices to an existing page or a new named page, with off-page device and port indicators. Both actions support Undo.

**Add a page** creates a named network or report page. Choose its devices using the search and checkboxes. Reports keep their own edit identities and device selection across continued sheets. Hide unwanted automatic tabs using **Show this page**; visible pages retain continuous numbering. Network pages can repeat devices and preserve off-page connection references.

Large imported MAC lists appear as a count in ordinary captions. Expand **MAC addresses** in Device details or select **Device addresses (full list)** in the information panel to inspect every value. Logical interface observations remain in data tables and Review links, separate from physical cables.

The information panel supports left, right, above and custom positions, width, scale and text scale. Select only useful sections: connection types, port modules/GBICs, VLANs, addresses, models, routes, port/VLAN details and notes. Its contents follow the page's devices. Individual panel objects remain editable. Dynamic canvas bounds include the panel and manually positioned objects. Extreme custom sizes or custom positions can deliberately overlap objects; adjust them in drawing edit mode or choose automatic placement.

The shared socket envelopes are drawing dimensions, not manufacturing specifications. RJ45, SFP-class, QSFP-class and larger module connectors use common artwork proportions at the shared hardware width; stack and module transforms no longer stretch connector height. The catalog audit checks 321 profiles and more than 9,800 sockets for common dimensions, unchanged mapped centers and non-overlap. The existing 8320 three-row QSFP records now retain three distinct rows. Manual port edits and imported raster/native stencil artwork remain authoritative.

Manufacturer references used for the relevant model layouts and body proportions:

- [HPE Aruba 2930F QuickSpecs](https://www.hpe.com/psnow/doc/c05052929) and [installation guide](https://arubanetworking.hpe.com/techdocs/hardware/switches/2930/IGSG/Aruba_2930_IGSG.pdf).
- [HPE Aruba 5400R QuickSpecs](https://www.hpe.com/psnow/doc/c04293383) and [5400R installation guide](https://support.hpe.com/hpesc/public/api/document/emr_na-c04655001?docLocale=en_US).
- [HPE Aruba 8320 installation guide, front-panel figures 1-3](https://www.arubanetworks.com/techdocs/hardware/switches/8320/IGSG/Aruba_8320_IGSG_en_us.pdf). Catalog row/column records, media and naming are retained; the renderer's former two-row assumption is removed.

Unknown hardware retains an editable generic symbol until a documented model or mapped stencil is supplied. These changes do not claim new evidence for unsupported models or manufacture missing port mappings.
