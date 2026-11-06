# Development handoff

## Layout and supplemental-data candidate

The feature branch feat/layout-evidence-controls prepares 0.1.0-preview.2. The last published baseline for this work was v0.1.0-preview.1 at main commit 14390bb17036093c00d0ce084b78f6a3854b3010. Do not describe preview.2 as published until its merged workflow, tag and assets have been verified. This change does not authorize a future contributor to merge or publish it without the user's scope for that action.

New controls include Up/Down and drag/drop ordering, named core-page assignments, automatic AP inclusion, per-device core exclusion and scale, visible/numeric jack mapping, and reversible per-file/category import selection. Core packing measures the actual faceplate plus cable tracks. Links to another sheet use native continuation markers and page references. Old schema-1 projects open without conversion; new layout and evidence records are optional schema-1 fields.

layout.mjs owns ordering and validated page settings. diagram/core.mjs packs and routes the core. evidence.mjs keeps the pre-existing model as its base, normalized imported sources, and property/keyed-row patches for subsequent manual changes. Compose sources with configuration intent first, then apply current operational state/speed/media and the manual edits. No raw CLI or configuration text is retained. app.mjs captures changes against evidenceSnapshot before recomposition, and refreshes the snapshot after scope and hardware matching. Do not diff a newly recomposed model against its previous source selection or it will turn removed observations into manual changes.

imports/operational.mjs detects prompted CLI output, separates different host prompts, and parses supported interface, LLDP/CDP, transceiver, VLAN and IPv4 route formats. Captures without a useful hostname can be assigned to the intended device under Imported data. Coverage is documented in HARDWARE_SUPPORT.md. Unknown command syntax is not universal support for a platform.

visio-art.mjs renders supported cached vector geometry and pictures into a local image. Both artwork and child/root jacks use the same inches-based transform before normalization. Geometry that cannot be rendered is rejected with the desktop conversion path. Vector rendering is a supported subset, not an implementation of the entire ShapeSheet language.

Local validation for this candidate passed 34 Node tests and direct browser checks of ordering, drag/drop, page assignments, save/reopen, source/category toggles, six exported stencil masters and a private site fixture. A synthetic vector-only master verified rotated/mirrored artwork against the rendered pixel at its mapped socket. Private core geometry had no unrelated-device crossings or shared parallel segments. Private files and screenshots remain outside the public repository. README screenshots contain only the fictional sample.

The local SDK could not build Windows in the current process environment because .NET process inspection failed before compilation. Hosted Windows validation must build the candidate, exercise export/print and the real timer/update/rollback checks, and supply the tested binary. An offline HTML build alone does not establish Windows results. Desktop Microsoft Visio remains untested.

## Initial preview

NetworkDiagramStudio 0.1.0-preview.1 is a local network-documentation editor for Windows x64 and current desktop browsers. The public source, release feed, and preview distribution are in the same repository. [Repository](https://github.com/TechSavage1989/NetworkDiagramStudio) · [Public releases](https://github.com/TechSavage1989/NetworkDiagramStudio/releases)

The incoming main baseline was cc32345d4ee75769883074773cf5ef67c78b64dc, containing a README only. The implementation branch is feat/site-diagram-studio. The release workflow records the merged main SHA under v0.1.0-preview.1 and verifies all published asset digests. Consult the PR, its checks and the release record for final integration status. [Release intent](docs/releases/intent.json) · [Release notes](docs/releases/0.1.0-preview.1.md)

## Development and tests

Run commands from the checkout or extracted source root. The browser build is dependency-free except for the included reviewed JavaScript renderer. Use Node.js 22 or newer. The output is dist/NetworkDiagramStudio.html and opens directly from disk.

```sh
node scripts/check-repo.mjs
node --test
node scripts/build-web.mjs
```

The Windows build uses .NET 8 and the pinned WebView2 SDK. On Windows, build and verify the application, then package it alongside the offline HTML and release hashes.

```powershell
./scripts/build-windows.ps1
python scripts/package-release.py
```

The published executable path is dist/windows/NetworkDiagramStudio.exe. The release directory is dist/release. Verify both assets against SHA256SUMS.txt. The Windows validation job tests the GUI using a test-only fixture feed, a temporary custom launch filename and synthetic data. It exercises blob export with a native save dialog, print-to-PDF, the real five-minute window timer, return to focus, upgrade, failed-health rollback and settings preservation. Its lifecycle script deliberately requires a disposable GitHub Actions Windows runner. [Native checks](tests/desktop/native-check.ps1)

Initial local validation included browser/Node tests, the offline HTML build, the Windows update-policy test executable under .NET, and cross-publishing the stable-named Windows GUI executable. Native Windows interaction and previous-to-next release testing are checked separately by the hosted Windows job. A cross-published executable alone does not establish those outcomes.

## Project and equipment workflow

**New project** resets the current project after the discard check. **Site scope** selects configured devices and directly linked access points. Review scope overrides before exporting. Model associations in a saved hardware pack can assign a front or optic without embedding a vendor stencil collection in the app. **Hardware**, **Manage**, **Export Visio stencil** exports the hardware used in the active drawing. The core layout can show documented WAN handoffs, and the trunk matrix is calculated from the active site’s configured port groups.

For vector-only or legacy Visio artwork on a Windows machine with desktop Visio installed, list master names, then render selected masters to a hardware pack. The pack contains flattened local PNGs. Map the required jacks in the editor afterward.

```powershell
./scripts/convert-stencil.ps1 -Path ./equipment.vss -List
./scripts/convert-stencil.ps1 -Path ./equipment.vss -HardwarePack -MasterNames 'Switch front','SFP module' -Destination ./selected-hardware.json
```

## Runtime behavior

The browser processes selected local files in memory. **Save project** writes a project JSON file, including active site data and locally imported artwork. There is no background site sync. Windows serves embedded web assets to WebView2 from an internal origin. The window injects a small bridge for readiness, busy state and printing. Keep the ready notification after editor initialization. An active operation must disable **Install and restart**.

The desktop checks GitHub's public releases API with an unauthenticated, conditional GET. The preview channel sees newer preview and stable releases. A stable build filters previews. The client fetches a single x64 executable only after **Download**, verifies the release API digest, file length, PE architecture, GUI subsystem, product, company and version, then waits for an independent install decision. The executable is unsigned. The hash verifies the advertised artifact and does not authenticate a code-signing publisher.

Per-user app state is under **%LOCALAPPDATA%\NetworkDiagramStudio**. WebView2 keeps its profile there. The update cache and staged candidate remain outside the portable folder. During installation, the helper stages on the target volume, replaces the executable in place and preserves a custom launch filename. Successful health confirmation retains one previous executable under updates/previous.exe. A failed replacement restores the previous executable. User-selected project files remain separate.

## Release and organization

Validation runs on pull requests and on a release request. An intentional change to docs/releases/intent.json on main triggers a preview release. Publishing checks for a merged PR to main, the exact main commit, a matching tag and verified assets. A tag or asset with conflicting contents is an error. Ordinary code and documentation pushes do not trigger release publication without a changed intent. No website deployment is configured.

Approved for the initial task only were publication of the new source, tests, build assets and documentation in TechSavage1989/NetworkDiagramStudio, a ready PR, merge after required checks/reviews, and publication of the tagged preview and its assets. These recorded permissions do not carry forward. A later contributor should verify the repository visibility, target commit, required hosted checks, release tag and asset checksums before describing a release as published.

See the contributor guide for the tracked-root exceptions and source map. Supported import syntax and physical layout limits are documented separately. [Contributor guide](AGENTS.md) · [Hardware support](docs/HARDWARE_SUPPORT.md) · [Diagram engine](src/web/diagram/README.md) · [Third-party notices](docs/THIRD_PARTY_NOTICES.md)
