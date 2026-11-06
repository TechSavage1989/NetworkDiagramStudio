# NetworkDiagramStudio contributor guide

Read this file, the current development handoff, and the shared standards before editing. [Development handoff](DEVELOPMENT_HANDOFF.md) · [Repository standards](docs/REPOSITORY_STANDARDS.md)

## Source map

| Path | Responsibility |
| --- | --- |
| src/web | Local browser editor, projects, fictional sample and offline HTML entry point. |
| src/web/evidence.mjs, src/web/layout.mjs | Reversible import selection and manual-edit patches; persisted order and core-page assignments. |
| src/web/imports | Configuration and Auvik parsers, inventory merging, model facts and associated notices. |
| src/web/diagram | Bend-aware orthogonal routing, collision-aware text, physical panels, legends, SVG and native Visio packaging. |
| src/web/drawing-edits.mjs, src/web/arrange.mjs, src/web/viewport.mjs, src/web/cable-edit.mjs | Persisted object edits, normalized drag geometry, alignment/distribution and zoom/pan. |
| src/web/stencil-files.mjs, src/web/stencil-search.mjs, src/web/visio-binary.mjs | Recursive discovery, filtered master selection and bounded legacy picture import. |
| src/web/vendor | Pinned local EMF renderer and its license. |
| src/web/history.mjs, src/web/inline-text.mjs, src/web/snapping.mjs | Project deltas, atomic undo/redo, direct text editing, selection geometry and configurable snapping. |
| src/web/link-styles.mjs, src/web/page-options.mjs | Shared cable/legend styling and captions, validated page-number settings and format tokens. |
| src/web/connection-types.mjs, src/web/device-types.mjs, src/web/device-symbols.mjs | Cable/speed presets and validation, inventory roles and editable generic endpoint symbols. |
| src/web/imports/endpoint-hardware.mjs | Sourced server/storage/HCI/platform family recognition without invented sockets; see docs/ENDPOINT_HARDWARE.md. |
| src/web/connection-edit.mjs, src/web/point-tools.mjs, src/web/color-picker.mjs, src/web/port-table.mjs | Port selection/conflicts, normalized box/group movement, solid-color formats/palettes and port table rules. |
| src/web/hardware-composition.mjs | Validated user confirmation of stack members and installed chassis/rear/uplink modules. |
| src/web/assets/app-icon.svg, desktop/Assets/app.ico | Authored editable vector icon and its multi-size Windows build resource. |
| desktop | Windows Forms/WebView2 host, release policy, verified download and rollback helper. |
| scripts | Browser and Windows builds, release packaging, publishing, root guard and optional Visio conversion. |
| scripts/export-test-fixtures.mjs, scripts/check-visio-package.py | Fictional export fixtures and independent OPC, shape-inheritance and port-glue checks, including the native downloaded file. |
| tests | Synthetic parser/layout fixtures and browser engine tests. Windows policy and lifecycle checks live in tests/desktop. |
| docs | Shared standards, hardware support, release intent and notes, dependency notices, and synthetic screenshots. |
| .github/workflows | Pull-request validation and intent-gated preview publication. |

## Working rules

Use synthetic inputs in tests, screenshots and releases. Real customer configs, reports, diagrams, credentials and unrestricted third-party stencil collections must stay outside this repository. The preview works locally. Keep import processing and layout independent of the update feed.

A site scope is based on configured devices and their linked APs, with explicit inclusion overrides. Hardware packs retain model assignments and optic choices. Keep hardware-stencil export tied to the active drawing. Device identities and SFP form factors are separate from physical proof. Preserve provenance and warnings when two records disagree. For artwork without a mapped jack, retain the schematic or boundary behavior and provide a manual mapping path.

Expand full-prefix ranges into individual ports before storing interface/VLAN state. Never turn unsupported ranges into fictional jacks. SonicWall EXP decoding is bounded and requires its settings header; only normalized topology fields are retained. Shared-media capabilities alone must not infer copper. For 90G/91G, explicit x1/x2 physical names select revision 2. Combo sockets retain one logical interface at the selected connector. Confirm 2920 rear cards and Cisco 3560-E X2/TwinGig adapters before assigning exact module jacks. Two-part Te uplinks must never alias copper access ports. Stack panel regions and escape lanes prevent leads from traversing another member; keep lane assignments separate within the available gap.

Preserve file and category selection when importing supplemental observations. Store normalized network records only, never raw command captures or configurations. Capture manual changes before recomposing evidence, and refresh the comparison snapshot after scope and hardware matching. Disabled sources must not leave stale observed fields, links or ghost peers. Preserve their known layout IDs across save/reopen. Configuration intent and current operational state remain distinct.

Artwork and port points must share the same master bounds and nested transform. Reject unsupported vector geometry rather than silently drawing partial hardware. Keep core devices in the saved order, allocate route clearance before packing, and preserve both endpoints through cross-page references. Cable geometry must stay orthogonal, avoid unrelated chassis, avoid shared parallel segments, and retain jumps at crossings. Changes to routing require geometric checks plus rendered inspection. Compare chassis intersections, shared segments, crossings, bend count and then length. Prefer straight and two-bend facing-port routes; same-side ports normally use four bends. Remove redundant collinear points without collapsing a reversal through a chassis. Fit automatic titles around cables; explicitly placed text remains an obstacle. Internal handoff captions must not create a padded collision at their own port departure. Keep core and wireless link legends accurate and independently editable.

Edit drawing uses direct dragging and Shift selection, with alignment, equal spacing and undo/redo. Devices move as groups; Alt selects native details. Preserve glued endpoints when moving a cable or its bends. Bend operations must remain orthogonal; removal can straighten adjacent elbows but cannot detach ports. Endpoint selectors validate physical aliases as well as interface names, reroute on save and retain styling. Generated handoffs become explicit only on a saved endpoint edit. A materialized handoff must suppress its former inferred connection. SVG hops include white clearance; native Visio uses orthogonal points with page arc-jump settings, avoiding baked arcs plus duplicate automatic jumps. Include hop envelopes when placing core labels/titles. Legends derive only from styles used on their own sheet. Preserve port mapper coordinates through zoom and clamp selected groups together at the panel edge. Keep display filtering independent of the faceplate inventory. Imported native text retains weight/alignment in both exports. Include text moved outside a panel in label obstacles. Repeated hardware on different continued sheets needs distinct edit scopes, with compatibility fallback for older keys. A port mapping operation changes only the selected sockets and can be undone. History records project deltas so endpoint/inventory changes, settings and port edits can be restored together; keep unchanged stencil image strings out of repeated snapshots. Undo all retains redo order and loading starts a new session history. Native text-input undo must not trigger project undo. Commit inline text before file saving or another pointer action. Pointer capture retargets the native double-click to the canvas; retain the original pointer target to resolve the actual editable element. Double-clicking text bypasses its parent group and opens inline editing. Box selection uses page coordinates and selects top-level groups unless Alt requests details. Snapping starts disabled, is persisted per project and preserves attached ports. Arrow nudges use exact configured/modifier steps even when snapping is enabled. Master filtering must retain hidden selections.

Rejected inline edits must retain the connected editor, draft and visible error. Do not redraw the SVG on validation rollback when the existing scene already represents the valid state. Escape and detached-session cleanup must restore input. Bound label/title candidate generation to the visible page before allocating candidates, even when edited panel dimensions or anchors are extreme. Compact grouped port maps combine assignments across switches without dropping per-port peers, states or configured details; keep numeric range ordering and expanded/individual-row options. Port-number overlays share one measured box and font size across the panel, independent of jack form factor or digit count, and retain full interface names in metadata.

Automatic cables and legend bars share the scene standard width; Edit drawing must not override painted thickness with CSS. Visio LineWeight caches V in internal inches, even when U=PT. Write a point-valued F formula for explicit recalculation and check its agreement with V in the independent package validator. Preserve manual widths and native editability. The Microsoft MS-VSDX Document XML example documents the internal-inch cache: https://learn.microsoft.com/en-us/openspecs/sharepoint_protocols/ms-vsdx/ee70cff4-a87c-49d6-9957-39492dcc0c93 .

Cable type and speed remain link.media/link.speed metadata, independent of connector capacity. Preserve unknown imported values and explicit custom text; never persist selection sentinels. Changing cable class uses that class's style; same-endpoint metadata edits retain bend/name/width patches and are one project-history action. A newly materialized handoff needs scopeOverride=true so imported-site scope cannot hide it after save/reopen. Endpoint family identity and a hypervisor platform are separate from installed NIC/HBA port proof. Keep explicit inventory roles authoritative and generic symbols without fabricated socket anchors.

Diagram captions retain complete values. Shared textLayout measures SVG tspans and native Visio line breaks, preserving edit keys/full-value inline editing and rejecting impossible boxes below a readable minimum. Allocate module/table/header heights before packing, not after painting. Device-title placement uses measured wrapped bounds, never the unwrapped full-string width. Typed CORE_LAYOUT_CAPACITY errors let automatic core groups split while keeping handoffs with their owner; explicit page assignments retain a clear error. Retain prior unsuffixed core edits as read-only aliases on automatic continuation. Build a new scene before replacing tabs/SVG; failed same-project rebuilds retain the accepted scene and block stale exports. Device changes validate before history/model acceptance and restore their state on failure.

Retain bounded lazy modern archive loading and eligible picture-only legacy CFB masters; unsupported visible artwork requires installed Visio instead of partial rendering. The converter runs a copied file in a separate STA process before the UI mutex. Disable macros, events, refresh and workspace restoration. Keep client data and OEM collections outside the repository.

Do not change the release destination, automatic check cadence, or consent boundaries as an incidental refactor. Manual checks bypass automatic cooldown, show progress and a result, and can retry transient failures while respecting persisted GitHub rate-limit pauses. A lookup, a download, and an install are different operations. The desktop must see the initialized editor and a visible window before confirming an installed update. The test-only update feed and failure injector must remain absent from production builds.

## Build and verify

```sh
node scripts/check-repo.mjs
node --test
node scripts/build-web.mjs
```

```powershell
./scripts/build-windows.ps1
python scripts/package-release.py
```

The icon resource is a checked-in source asset needed by the Windows compiler, derived from the authored SVG. Do not replace it with a post-build EXE modification.

The root guard allows the four project guides, .gitignore, .github, desktop, docs, scripts, src and tests. Builds go under untracked dist, bin or obj directories. A new tracked root entry requires an explicit change to the guard and project guide. The dedicated root-guard test also exercises the filesystem fallback without a Git checkout.

Work on short-lived branches and use a pull request into main. The normal release is an intentional change to docs/releases/intent.json. Its version, tag and notes path must agree with the desktop project. Published assets are immutable. Future pushes, PRs, merges and releases need authorization for their own scope.
