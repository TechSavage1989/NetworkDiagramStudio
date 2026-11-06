# Diagram renderer

The browser entry point is index.mjs. buildPages(project) returns page records with a sheet name, a self-contained SVG, and the scene used by the native exporter. exportVisio(project, pages) returns a VSDX Blob. printDocument(pages) produces a standalone HTML document with one printable vector page per section. The renderer uses local assets and makes no network requests.

The five views cover core equipment and links, physical switch port maps, switch-to-AP links, VLANs and routing, and trunk membership. Core sheets pack measured faceplates plus cable clearance; inventory views paginate by device and table size. Equal interface configurations collapse into port ranges. Long tables continue onto extra sheets. Headings and footers are date-free.

project.layout.order supplies the saved device order. corePages is an array of {id,name,devices} assignments; unassigned equipment uses automatic sheets. coreExclude omits specific IDs from the core only. includeAPs is opt-in for automatic sheets; explicit core-page assignments can include APs independently. Hand-offs follow their owner's page assignment. Overflow retains page references. Page assignment and order are independent of site-wide inclusion.

## Local front artwork

Assign device.stencilId to a key in project.stencils, or put the asset directly in device.stencil. Stencils may be an array or an object keyed by ID. Each entry supplies id, name, view, width, height, dataUrl and anchors. The image must be a local PNG or JPEG data URL. Anchors use exact interface names and normalized [x,y] coordinates measured from the top left. The stencil importer can recover named manufacturer points and the UI can bind additional points manually.

Front views appear at their natural aspect ratios. On a real front with no matched jack, the connector attaches to the perimeter rather than estimating its location. Missing artwork uses a labeled schematic; its port order is diagrammatic. AP front faces attach at the edge nearest the switch. Unknown peers are drawn only when named by link input. A port-map table or separate index retains unmatched and high-density ports.

project.optics may assign sr, fg_sr, lr and dac to local stencil IDs or inline assets. An optic can supply a cable anchor; otherwise the connection uses the face center. These symbols appear only on core links whose media supports the classification. A bare SFP form-factor hint does not prove a transceiver type. Symbol size is estimated from the chassis proportions; individual cage contours and OEM part numbers are not inferred.

## Native drawing

Every used front becomes a named, reusable Visio group master. The master and page instance include explicit local image relationships for a compatible imported front. Generic equipment uses native editable shapes. All equipment masters retain their mapped connection points. Connectors are native 1-D shapes with endpoint formulas and Connects records, including connections to mounted plug groups. An installed plug's position is tied to its chassis anchor. The export packages rendered artwork and mapped ports, not OEM automation, macros or unpublished source ShapeSheet programs. Text, rectangle badges, device groups and cables can be edited separately.

The core view uses exterior orthogonal rails, independent evenly spaced departures at equipment boundaries, and arc bridges at perpendicular crossings. Disjoint link intervals may reuse a rail without sharing a segment. Aligned jacks receive short socket doglegs before separate exit leads. Cross-page links end at native continuation markers with the remote sheet in the register. The layout does not automatically recalculate after editing a resulting drawing outside the application.

The stencil renderer preserves the master coordinate system, picture bounds, child transforms, rotation and mirroring. It supports line, relative line, ellipse, basic arc and relative Bezier geometry with cached coordinates and basic text. Named points receive the same transforms as artwork. Unsupported geometry is rejected with the conversion path rather than silently producing partial artwork. Legacy binary VSS, complex ShapeSheet programs, and unsupported geometry still require the desktop converter. Exported masters retain mapped jacks, not OEM automation.
