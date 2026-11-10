# Preview.48 integration

Baseline is published preview.47 main/tag 797f580f4ee9a177df6f34bb7a1b57ccad7bf0b2. Its final 20 browser suites, native validation and release gates passed; downloaded assets, SHA256SUMS and updater feed were verified. Earlier pending .47 entries below are historical. Preview.48 combines calibrated settings navigation and wireless automatic-frame/side-space fixes. Final combined local and hosted verification remains pending; do not describe it as published before release verification.

# Preview controls and calibrated settings view (follow-on candidate)

Settings live preview now retains its user choice, adapting debounce after slow rebuilds instead of automatically unchecking itself. Controls width uses one bounded slider and persists across layout scope rerenders. Transform-based pan supports fitted pages, left/middle dragging and pointer-centred wheel zoom; navigation is separate from draft settings. Preview Actual size/Calibrate screen share the main drawing calibration and actualSizePaper classification. Physical scale remains fixed through pane resize; zoom/Fit leaves 1:1 mode. Calibration listeners dispose when settings dialogs close/rebuild, and same-window calibration changes propagate to the main drawing.

Focused queue/scale/calibration/guide tests pass. Local Chromium still cannot start because socket() is denied, including the permitted escalated attempt; hosted settings/actual-size and native verification plus genuine updated screenshots remain required. No release or version change is included in this handoff.
# Wireless side-space follow-up (preview.48 candidate)

Explicit AP size/side-placement changes in Pages & layout now refit automatic
wireless frames without unlocking paper. Re-applying Use side space repairs an
old automatic row frame; authored object geometry and unrelated pages stay
untouched. Side-space compares measured lateral columns and mixed surrounding
rows, balancing crossings against cable travel rather than silently vetoing
all shorter side arrangements. Saved side/mixed plans carry a validated
wirelessPlan marker so reopening or moving an AP cannot revert the base to rows.

A fictional eight-member/32-uplink stack at150% AP size now uses side space plus
top/bottom rows. On Letter, physical AP detail text improves from4.17pt to4.71pt
and crossings fall from22 to14 at that scale; all hardware/caption/route checks
remain clear. This is an improvement, not readable8pt on an impossibly dense
single sheet. Larger paper or the existing readable-continuation mode remains
necessary. Actual generated SVG output was rendered and visually inspected.
Hosted tests add actual side placement, saving/reopening and a current capture;
full aggregate/native/browser gates remain required before publication.

# Hosted connection-key click readiness correction

Run218 passed the new empty-panel placement drag suite. Its connection-label
suite hovered the legend successfully, then force-clicked immediately after
Edit drawing expanded the toolbar; the capture showed zero selection and no
browser error. Forced input skipped target stability while ResizeObserver
refitted the canvas. The test now uses normal stable pointer input and records
the actual pointerdown drawing key, requiring one selected item as well as the
existing bidirectional highlight assertions. No selection/collision code is
changed. Local Chromium remains socket-blocked; the exact-head hosted rerun is
required before claiming the click has passed.

# Preview.47 combined regression validation

At source2fa05f7, all678 Node tests passed with zero failures or skips, along with all9 independent Visio packages, offline build, repository guard and whitespace checks. This includes complete automatic Letter fit, locked adaptive port-map edge fill and valid placement under a short information panel. Hosted run218 passed18/20 browser suites, including the new live-preview, locked-map and drag-preview/commit regressions; legend pointer selection and project-load timing require final rechecks. Current genuine synthetic split-dialog, paper-control, locked-map and placement captures were downloaded, artifact hash verified and visually inspected. Final exact-head browser/native gates and immutable release verification remain mandatory.

# Hosted paper fixture load synchronization correction

Run218 observed the preceding two-wireless-page fixture immediately after requesting the dense one-page fixture. The test previously accepted stale “Project opened” feedback while File.text() was still pending. Its open helper now waits for matching parsed project name in both project field and heading, idle file controls, a ready drawing/export, and completed feedback. All one-whole-wireless-page, Letter containment, continuation, Undo/redo and save/reopen assertions remain unchanged. Local exact dense fixture produces one Dynamic wireless page and one whole Letter wireless page. Hosted rerun remains required.

# Hosted settings-preview resize assertion

Run217 passed19 of20 browser suites. The new settings suite passed draft isolation, Apply/Undo, invalid settings, pan/zoom and narrow dialog containment, then compared canvas HTML after resizing the browser against its pre-resize screen transform. The final cancellation assertion now ignores only the root SVG screen style; all page attributes and diagram shapes remain exact. Earlier cancellation assertions still compare full canvas HTML. Fresh hosted verification required.

# Manual placement below information panels (preview.47 candidate)

Direct drag/nudge and Place beside protect actual occupied panel item bounds,
not an invisible full-height sidebar column. Empty space below/around a short
key is available; decorative dividers and hidden/empty panels do not block it.
A collision correction keeps the whole selected translation rigid and the drag
preview uses the same correction as commit. Existing link-label/router validation
remains enabled. Real sample movement, saved reopening, undo/redo and socket glue
are covered by focused tests. Hosted direct-transforms adds actual drag preview /
commit / saved-coordinate coverage; local Chromium cannot start because socket()
is blocked, so that hosted gate remains required.

# Preview.47 rebased local validation

All666 Node tests pass with zero failures/skips on the source rebased to published .46; all9 independently checked Visio packages, offline build, repository guard and whitespace checks pass. Hosted20-suite browser/native verification and current split-dialog captures remain required. Newly reported Letter auto-fit and port-map-margin corrections are being developed separately; do not publish before their integration decision.

# Preview.47 release preparation on verified preview.46

Published baseline main/tag is 91ec4a5b1814c8afbb2310e2d342d41a359bf4f4. Preview.46 final PR and merged-main release gates passed all19 browser suites and native Windows checks; all3 public release assets were downloaded and matched API digests, sizes and SHA256SUMS, updater feed verified and merged branch removed. This follow-on preserves its source fixes and current documentation captures. Older pending notes below are historical.

# Preview.47: transactional settings previews (not yet published)

Targets Global text styles, Pages & layout, and Page options only. Resizable split controls and read-only preview use cloned candidates; Apply commits once, cancellation discards. Zoom/pan persist across repeated changes, invalid drafts retain the last valid drawing, and stale results cannot paint after close/replacement. Live preview can be paused. The preview is explicitly not calibrated Actual size.

Focused local helper/control tests pass; final aggregate and hosted browser/native checks, screenshot review and immutable release verification remain required. Do not publish or merge this follow-on until preview.46 is published and verified.

# Follow-on settings preview (local, not published)

Based on the final preview.46 source bd9a1c9. Global text styles, Pages & layout and Page options now offer isolated live previews beside resizable controls. Read-only preview pan/zoom persists through setting changes, automatic updates can be paused, invalid drafts retain the last valid view, and cancellation never changes project/history. Apply remains one history entry. The original editor stays inert during these dialogs; individual object, link-style and other property dialogs retain their previous save workflow. SVG IDs are namespaced to prevent masks resolving against the original canvas.

Six scheduler/isolation and five real page-layout editor closure regressions pass locally. Tentative preview collection clones/restores both layout and captured page definition, preserving automatic device membership and manual geometry when reverted. Automatic preview pauses after a rebuild of 750 ms or longer; manual refresh and explicit re-enable remain available. This bounds repeated typing freezes, not the cost of the first synchronous rebuild. Syntax, build and repository guard pass locally. Actual browser launch is blocked by sandbox socket() permission, so the new hosted browser-settings-preview gate and its three synthetic captures remain required. It covers repeated changes, invalid Apply, last-valid retention, Cancel/Escape, Undo/redo, pan/zoom, scope rerender and narrow layout. No version bump or remote publication has been performed by this work.

# Integrated Letter fit documentation verified

Regenerated paper-fit.png and wireless-paper.png through the actual PDF exporter from integrated preview.47 source 6ad9218 and visually inspected both. The fictional core fits Letter with 10.25 pt minimum editable text; explicit wireless continuation remains four sheets, first sheet members 7/8 and eight uplinks at 8.59 pt. These are actual exported output, not UI mockups. Default dense one-sheet fitting can still require smaller text, with truthful warnings.

# Letter/A4 complete paper fit correction (pending integration)

Both reported core/wireless screenshots showed the preview.46 readable-size floor enlarging models beyond selected Letter. Auto-fit now caps the common transform to available paper space and reports the actual text size when the target is impossible. Headers and docked keys retain independent physical typography; source positions and cable glue remain proportional. Saved frames/manual off-page transforms remain unchanged. Presented narrow labels scale their text-fit floor with the page transform. Fresh locked adaptive port maps avoid a second margin wrapper.

Synthetic dense wireless/core containment, portrait/landscape, lock/reopen and manual-frame cases added. Final aggregate/browser/native verification and documentation capture remain required. No user screenshots or customer data enter source.

# Preview.46 hosted browser corrections verified

Run 215 at a0bf4c7 passes all 19 browser suites, including guide Escape, real pan navigation between offscreen objects, retained legacy refit guidance, and visible text/panel controls. Genuine synthetic guide (wide/narrow), text sizing and panel-width captures were downloaded, artifact SHA-256 verified and visually inspected before inclusion. Source is unchanged by this documentation commit. The original run 214 native Windows build, report media boxes, package and window/timer/update/rollback checks passed; exact final-head hosted gates and merged-main publication verification still remain required.

# Preview.46 hosted guide Escape correction

Hosted run 214 stopped when Chromium consumed Escape in a populated search input instead of dismissing the guide dialog. The guide search now handles Escape locally through the shared close action. Other key editing, native clear controls and composing-IME cancellation are unchanged; no listener survives on the shared dialog body. The hosted test retains its single-Escape requirement and additionally checks launcher focus and normal search Select All/Backspace. Five guide unit tests, syntax, offline build, repository guard and whitespace checks pass locally. Final hosted validation remains required. No preview.47 changes are included.
# Hosted narrow-canvas direct-edit navigation correction

Run 214 direct-transforms failed at line 75 selecting SW-1, not while revealing the accepted edge title. Both repeated edge-title save/reveal and unchanged-zoom assertions had passed. The 1024×720 capture showed 245 px of canvas with the selected edge title/handles visible and the unrelated lower SW-1 below the viewport. The test now navigates between distinct objects using bounded real middle-button drag panning; exact glyph hit-testing, genuine double-clicks, selected-title visibility, cancellation and zoom preservation assertions stay intact. No viewport or project geometry behavior is changed. Hosted rerun remains required.

# Preview.46 integrated validation ready for hosted gates

All 649 Node tests pass, zero failures or skips, on the combined empty-section/readability/help/optical/wireless source. Offline build, repository guard and whitespace checks pass. All nine independent synthetic Visio packages validate. Narrow/wrapped final text metrics, large-frame save/reopen, stock Letter inventories/wireless, source glue, side-placement constraints and manual/frozen preservation are covered. Current paper output was visually inspected. No release has been published by this local validation; exact-head hosted browser/native gates and immutable release/feed/asset verification remain required. Live preview for settings dialogs is separate follow-on work, not part of this release.

# Inventory title-band correction

Synthetic PDF inspection found the generated dark booklet title band classified as ordinary diagram content while its white headings were fitted as paper furniture. This left white headings on white paper and a detached empty dark bar in the diagram area. The band is now header-background furniture, shares the paper header geometry, and preserves custom fill and geometric offsets with its stable key. Seventeen focused text/frame tests passed; the corrected Letter inventory PDF was rendered and visually checked.

# Readability fit review corrections

Final-box text metrics now refine the uniform model factor to meet the selected minimum even when fixed padding changes wrapping. Saved lock/edit frames retain valid fit scales above 4x (up to 10000x); tested with minimum 18 pt and Text scale 400%, preserving exact transforms after JSON reopen. Near-fit automatic pages reclaim outside whitespace down to 2 physical-paper pixels while retaining header/panel bands; the two sample Letter inventory pages now fit at 8 pt without clipping. Frozen transforms remain unchanged. Physical printers may require larger non-printable margins; check the printer before 100% printing.

The stock wireless switch body is itself about 1064.5 physical pixels wide at 8 pt versus 1056 px Letter, so reclaiming margins alone cannot honestly make that topology fit. Such remaining cases retain a readable clipping warning and require planner changes/larger paper. Dense 28-AP cases are not claimed to fit Letter.

# Preview.46: hide empty information-panel sections (in development)

Published baseline: preview.45, main/tag commit 4aa704dc1ae94f3b3a0d5d83cb1fb79f5fcfa961. Release workflow 42740894590 passed all hosted browser and native Windows gates; release assets and feed were independently verified. Older pending notes below are historical.

Empty automatic sections now omit both placeholders and headings by default, including Port modules / GBICs. Legacy explain values migrate to hide because older versions wrote them as the default. Users can deliberately select Show an explanation again; the distinct explain-opt-in value survives reopening. Custom section bodies, notes and manual body edits remain content, while title-only edits do not. Blank route records no longer create a fake row. Empty panels omit their separator.

Node coverage checks all categories, legacy migration, manual content, data scope and exports. Hosted panel browser coverage checks the actual drawing and new default; refresh docs/images/panel-content.png from its synthetic capture before publication. Final source-head native/browser checks and merged-main publication remain required.
# Offline in-app guide (unreleased)

The new always-visible User guide is separate from desktop update Help. It provides searchable task-oriented steps for setup, paper/text sizing, screen calibration, panel contents, page locks, transforms and exports. Settings shortcuts reuse existing dialogs; help is read-only and works before opening a project. Browser coverage checks search/empty results, close/reopen, no mutation, settings cancellation and narrow layout. Hosted synthetic user-guide.png and user-guide-narrow.png require review before publication.
# Readable physical-paper controls (pending integrated release)

Pages & layout now offers Minimum paper text (pt), default 8 and 0 to disable, in Drawing defaults or individual pages. Text scale also scales that minimum; explicit individual font-size edits remain authoritative. Auto-fit applies the measured minimum as one uniform model transform, preserving relative positions and cable glue rather than enlarging isolated text over neighbouring geometry. If the readable drawing cannot fit, it stays readable and warns about print/export clipping. Saved lock/edit frames and Preserve mode do not silently reflow; they expose small-text notices. Decorative/native faceplate text and standalone native report typography retain original proportions and are not covered by the editable-label floor.

Docked panels now trim unused row width automatically. Panel width (% of paper; 0 = automatic) accepts 0 or 10–60 percent of available paper width; it rewraps complete rows while retaining text size. Existing source-unit width remains available for Dynamic pages. Custom width does not shrink to conceal dense content. Wireless APs and details (%) schema/UI is ready for the parallel wireless planner implementation.

Focused physical-text/panel/page-frame tests and offline build/guard pass locally. Synthetic compact-panel Letter PDF and PNG were generated and visually inspected; model labels measure 9.9 pt and sparse panel uses about one tenth of page. Hosted browser controls/capture and final combined full suite remain required.
# Optical schematic proportions (unreleased)

Corrected flattened generic SFP face aspect using SFP MSA front dimensions; QSFP aspect is separately sourced. Connector widths/centers and RJ45 stay unchanged. Installed generic optics and their legend now share one aspect; manufacturer artwork retains its own. Four focused geometry/export tests, existing flexible-layout tests including >9000 catalog sockets, build/guard and rendered PDF comparison pass locally. Actual PDF before/after inspected; the after image is docs/images/optical-proportions.png. Full combined suite and hosted/native checks remain required. See docs/OPTICAL_GEOMETRY.md for reference URLs and the schematic limitations.

# Hosted HTML focus and batching follow-up

Run 212 verifies keyboard focus, cable/device details, pin/clear, search and
ordinary viewer interactions after using the focusin listener. The synthetic
batching test originally alternated 100 opposite zoom events and returned to
the starting transform, producing zero DOM mutations in Chromium. It now uses
101 alternating events, requires a changed final transform, and still requires
exactly one style mutation. This is a non-zero fixture correction, not a weaker
batching assertion. All other 17 browser suites passed. Fresh final CI remains
required; preview.45 has not been published by this change.

# Preview.45 integrated validation

The combined calibration, multi-selection resize, readable paper-panel/key,
interactive HTML and upper wireless routing source passed all 621 Node tests
with no failures or skipped cases. Offline build, repository guard, whitespace
checks and all nine independently validated Visio packages pass. Use
`node --test --test-concurrency=1 tests/*.test.mjs` when several checkouts share
the constrained cloud workspace; simultaneous full suites caused resource
failures, not an accepted substitute for this clean combined pass.

PR #44 source head e508a885 passed 17 of 18 hosted browser suites, including
large resize, paper panels/key and legacy refit. The HTML keyboard inspection
check exposed an ineffective onfocusin property assignment; use a delegated
focusin event listener and ignore stage-only focus so search results persist.
This correction retains the real keyboard assertion and needs fresh hosted CI.
The current generated Letter wireless image was re-rendered from this combined
source with synthetic data. Final-head hosted checks and immutable release
verification remain required before claiming preview.45 published.

# Preview.45: multi-selection resize caption regression

Bulk resizing previously wrote absolute positions for every selected generated
link caption, then rerouted connected cables. The caption planner interpreted
those incidental positions as hard pins, and the final collision validator
rejected the transform with “This change overlaps a link label.”

Generated captions now retain automatic placement/orientation during model and
group resizing with equipment. Explicit user positions and cable attachments,
caption values/styles, physical socket glue and selection history remain intact.
Synthetic Letter tests reproduce the old 50%/140% group and 200% model failures;
the real browser gate adds large resizing, Undo/redo and save/reopen checks.
No customer screenshot or project data is included in the repository.
Existing genuine manual caption positions remain constraints; this does not
weaken collision validation or promise arbitrary impossible model overlaps.
All 613 Node tests pass, as do the offline build, repository/whitespace checks
and nine standard independent Visio packages plus a 50%-scaled full-selection
package. Local Chromium remains blocked by socket restrictions. Final-head
hosted browser/native gates remain required before publication.
# Interactive HTML inspection follow-up (unreleased)

Exported SVG cables carry normalized endpoint device/port identifiers, not source
records. The offline viewer lazily sanitizes pages, indexes device/port associations,
and uses delegated hover/focus and pinned click/Enter inspection with Escape clear.
Related devices, cables and automatic port labels highlight together. Empty pages
remain valid. Transform writes are coalesced once per animation frame rather than
once per pointer/wheel event; repeated hover on the same object performs no work.
Hosted browser coverage adds endpoint inspection, keyboard pin/clear, empty and
repeated page navigation and a 600-device fixture asserting that 101 synchronous
wheel events yield one transform write. Runtime timing and screenshot review must
come from hosted Edge: local Chromium launch fails at socket() (Operation not
permitted). Do not claim measured latency gains or Windows UI validation locally.
# Preview.45 follow-up: readable paper information panels

Wireless Link colors also use paper-sized text and packed measured entries rather than shrinking with AP banks. Docked panels now use independent paper sizing rather than the model fit, reserving a side rail before fitting the diagram. Default text targets its source paper size (typically 9pt body), with an 8pt floor when fitting dense content. Excess content remains readable with the existing clipping warning instead of silent compression. Left/right/top dock, explicit panel scale, frozen diagram frames and export scene transforms share the same geometry. Free panels, manually positioned/resized panel objects and Preserve mode keep existing behavior. New fitting frames carry panelFit:1. Legacy locked/editing frames retain their exact transform and show an explicit Page options / Save page options refit prompt rather than silently moving saved diagrams. This does not paginate overflowing panel sections; use a larger paper or fewer sections.

All six focused paper-panel tests, offline build, repository guard and whitespace checks pass. The concurrent full suite was stopped to avoid resource contention; the final integrated head still requires a complete pass. Genuine synthetic Letter core and wireless SVG rasters were inspected locally with Inkscape; browser/native/print UI gates remain required on the final integrated head. No physical Windows print or Visio UI test is claimed locally.

# Preview.45: calibrated actual-size screen view (unreleased)

Release intent and desktop version are 0.1.0-preview.45. This follows preview.44
which has now been published. Actual size uses local physical-reference calibration (100 mm ruler,
85.60 mm standard card, or A4/Letter paper short edge), with persistence/reset and
measurable display/zoom change invalidation. Dynamic canvases require physical
paper first. Physical sheets retain scale when the viewport is too small and can
be panned; Fit/manual zoom leave 1:1 mode. Projects and export dimensions are
unchanged. Resolution alone cannot establish real size; recheck each monitor.

All 604 Node tests, offline build, repository guard and whitespace checks pass.
All 18 hosted Edge browser suites passed in run 42729400539, including
tests/browser-actual-size.mjs. Genuine synthetic screenshots from that run refresh
the affected documentation views; docs/images/screen-calibration.png shows the
paper-reference calibration dialog. Local Chromium cannot launch because socket
creation is blocked, including an approved elevated launch; no local UI capture
or physical monitor verification is claimed. Final-head native/browser gates
remain required before merge. Physical matching must be checked on the user's
own monitor with the selected reference.
Run node --test tests/*.test.mjs, node scripts/build-web.mjs,
node scripts/check-repo.mjs, and the hosted native/browser gates before release.

# Preview.44: page fit, selection and off-page transforms

Release intent is 0.1.0-preview.44. New visible wireless paper choices fit the
complete dynamic arrangement proportionally by default. Page options offers
explicit readable continuation for minimum 8pt AP details. The 32-uplink lab
fits one Letter sheet in default mode or four readable continuation sheets
(previously six). New wireless lock frames record their layout mode; unmarked
legacy continuation frames retain their old planner until Page options resets
frames. Preserve mode and manual coordinates remain authoritative.

Auto-fit now measures actual painted body bounds and keeps generated site/title/
brand text in physical paper units. New contentFit:1 frames preserve this mode;
legacy locks retain their old transform. Explicit drawing edits snapshot the
active unlocked presentationFrame into visible.editFrames, so a deliberate
scale changes its size relative to the page instead of being fitted away. Page
options clears the accepted editing frame and recomputes the fit.

Unlocked Auto-fit uses 12-unit gutters. Adaptive port maps enlarge hardware to
available width instead of stopping at reference socket size. Fictional Letter
exports show 17% larger five-member sockets, 25% larger chassis sockets and 3%
larger eight-member sockets. Generated output images are genuine SVG rasters.

Physical locks retain sheet size and the saved presentation frame, but allow
intentional off-page scaling/moving. pageOverflow drives a visible clipping
warning; only the editor exposes off-sheet content. Choosing physical paper no
longer enables its lock automatically. Native report print margins are unchanged.

Ctrl/Meta+A selects diagram content without panel/frame items; text inputs keep
native Select All. Chrome/canvas gestures prevent incidental browser selection.
Full-selection scale/rotation/move browser checks cover Undo/redo, reopen,
explicit locks and off-page transforms.

Bounded right-hand AP return-track swaps lower the regression's right crossings
from 11 to 7 (total 34 to 30), without changing the left side or paired switch
departure rows. Candidate improvements must preserve obstruction, merged-stroke,
per-side crossing, manual-position and endpoint constraints. Some crossings
remain; blanket reversal was rejected because it worsens other routes.

All 598 Node tests pass (no failures or skips), as do the offline build,
repository guard, whitespace checks and all nine independent Visio packages. Chromium cannot launch under runtime socket restrictions,
including the permitted elevated attempt. Both hosted browser/native jobs on
the final source head and merged-main publication must pass before announcing
release. No Windows/WebView2 or Microsoft Visio UI verification is claimed locally.

# Accepted inline titles stay visible after re-layout

Run 201 passed all 17 browser suites and the native build, report, paper and
packaging checks. Native lifecycle diagnostics then established why the second
title edit failed: every painted glyph of the successfully saved title was
obstructed by an HTML span after the new scene moved that title under editor
controls. The accepted-save path now reveals the currently selected rebuilt
text after toolbar layout, preserving the current zoom. Rejected edits still
keep their existing scene and editor without panning.

The browser recovery sequence now also checks a 1024 × 720 viewport, unchanged
zoom and title visibility after each save. Native failures include obstruction
ancestry and viewport/canvas bounds. Twelve focused Node checks, syntax, build
and repository checks pass locally. The next hosted run must confirm native
recovery and all remaining timer, install and rollback stages.

# Native repeated-title recovery targeting

Hosted run 200 passed all 17 browser suites but the native lifecycle check
stopped when reopening a title after its first successful save. The old native
click helper trusted the overall SVG text center and reused it across both
clicks. That does not establish that either click reaches the text after
selection or viewport callbacks. The helper now measures each real CDP click,
requires an actual text glyph hit, and reports its chosen glyph or obstructing
target. Every title revision, Escape and detached-session assertion remains.

The hosted direct-transform suite repeats the native title recovery flow using
the exact same target expression. Four Node checks execute that expression
against synthetic hit-test contexts, including blank-center and obstruction
cases. Local JavaScript syntax, focused checks, build and repository guard pass;
.NET/WebView2 and local Chromium remain unavailable. Native recovery is not yet
claimed fixed at runtime: the next hosted browser/native run must confirm it.

# Interactive HTML viewer gesture and label polish

Run 200 passed all browser gates but visual review found native text selection
after panning, and duplicated inspection text from title + painted tspans. The
viewer now disables native selection only on its pan surface and cancels the
pointer default before starting pan. Search reads the full SVG title when
present, so wrapped/painted text is not concatenated with that title. The hosted
gate asserts one full label per result, the exact inspection label, and no native
selection after dragging from actual SVG text or fitting the page. Run 201
passed the viewer gate. Its genuine capture in artifact 13713080937 was visually
reviewed and confirmed clean: no selected text after panning and no duplicated
inspection label. It has not been uploaded into the repository. The final
source head still requires both validation jobs.
# Hosted browser validation: all 17 suites passed

[Run 200](https://github.com/TechSavage1989/NetworkDiagramStudio/actions/runs/42701077407)
passed all 17 browser suites on head `284eb7e` (local `68e9866`, tree `7a93ef7f`).
Edge 156.0.4314.58 and Playwright 1.62.1 exercised the actual offline build.
The artifact `editor-browser-checks` (13711472971) confirms model-size/spacing,
group membership and transforms, locked A4 overflow/retry, socket glue,
port/VLAN drafts, save/reopen and Undo/redo. Sidebar reset/reload and white/
transparent backing controls also pass. No browser errors were reported.

Four inspected, unchanged captures now document device rotation, grouped
models, locked-page rejection and backing options. The viewer issues found
in run 200 were corrected, and the run 201 viewer capture was visually checked
clean in artifact 13713080937 without a repository image upload. Native Windows
verification is tracked separately, and any later source head still needs
both required jobs.

# Reviewed hosted editor captures

The current hero, port map, connection/style dialogs, organization preview,
wireless page and direct text tools were refreshed from actual hosted Edge
captures in [run 199](https://github.com/TechSavage1989/NetworkDiagramStudio/actions/runs/42698535059),
artifact `editor-browser-checks` (13710691710), source head `75714ff`.
New README links show separate page navigation at 1366, 1024 and 620 px, the
existing-device stack dialog, port/VLAN controls and configured panel output.
The PNGs were inspected and copied unchanged; all use fictional data and are
under 400 KiB. The port capture intentionally shows the scrolled Edit ports
section rather than the top of the device dialog.

Documentation, panel-content and device-stacks passed run 199. Navigation and
port editing reached these captures before later failures; run 200 subsequently
passed all 17 suites, as recorded above.

# Hosted sample reload checks

Run 199 reached the real editor and found two test setup errors: page-navigation
looked for the initial-only `#sample` ID after New project, and page-layout-defaults
looked for that welcome-only button while a drawing was still open. Both now use
the visible Open sample site action; the latter first opens New project. Reset,
sidebar restoration, backing controls, history and persistence assertions remain
mandatory. Page-layout-defaults now captures any failure. Syntax and repository
checks pass locally. Both suites subsequently passed hosted run 200.
# Interactive HTML hosted selector follow-up

Hosted run 199 stopped before downloading the viewer because the unscoped
Drawing pages label matched both a sidebar landmark and the export selector.
The browser gate now scopes its named combobox and download button to the
Export documentation dialog. It also lets initial/mobile ResizeObserver layout
settle before viewport assertions and counts only nonlocal resource requests
(data images are embedded resources, not network calls). The viewer behavior
and security assertions remain unchanged; hosted run 200 subsequently passed.
# Filled native artwork hit-testing

Hosted Edge run 199 exposed a real editor interaction bug: the generic
stroke-only path rule also applied to filled native device artwork, so clicking
inside a visible body selected the background. Device artwork now restores
visible-painted hit-testing while cables retain their existing stroke behavior.
Both hosted rotation and port/sizing suites retain real interior pointer clicks;
rotation now checks the exact hit target and both tests capture useful failure
evidence. Save/reopen checks wait for the actual scene replacement, not stale
feedback or matching device keys. Geometry, socket glue, history and persistence
assertions remain strict.
Local syntax, focused tests, offline build and repository guard pass. Local
Chromium remains blocked by socket/IPC restrictions. Both corrected suites
subsequently passed hosted Edge run 200.

# Hosted port, sizing, group and page-lock regression

`tests/browser-port-sizing-controls.mjs` is registered in the hosted Edge job.
It uses fictional linked models to exercise keyboard/pointer port suggestions,
manual and selected VLANs, visible rejected-save feedback, cancellation,
project downloads/reopen, model-size versus layout-spacing geometry, socket
glue, grouped movement/scaling and ungrouping, physical A4 locking, overflow
rejection/retry, and Undo/redo. Its screenshots and results stay in the CI QA
artifact. Existing native smoke field labels are unchanged.

Local verification: JavaScript syntax, 14 focused Node tests, offline build,
repository guard and whitespace check pass. The browser launch was attempted
but Chromium aborted on prohibited socket/IPC operations before any UI test
ran. Hosted run 200 subsequently passed the complete suite and produced
reviewed UI captures; no local browser pass is claimed. The integration fix gives generic dialog errors their own
visible `.dialog-task-error`, rather than reusing a hidden VLAN picker error.
# Grouped optics and module categories

Group transforms treat optics attached to a selected chassis as implicit children, including a group containing only one chassis and its optics. They follow the chassis once instead of receiving independent pinned geometry. Module legend categories now ignore placement-only optic edits while retaining original reach/media categories and separately edited native artwork. Focused group, locked-page and module-artwork regressions cover a saved A3 top-panel group shrink without legend expansion or lost endpoint glue.

# Tight, configurable port/link label backings

Pages & layout → Drawing defaults exposes Port/link label backing (White or
Transparent) and per-side padding from 0–20 drawing pixels (default 0.5).
`layout.labelBacking` survives clean/save/reopen and ordinary history. Transparent
emits no backing geometry or label cutout; cable jumps keep their existing masks.
White backing follows each rendered line's ink bounds, not the roomy selection
box, so manually widened captions no longer hide long cable runs. Text values,
positions, alignment, rotation and saved dimensions remain untouched.

SVG/editor, vector PDF, PNG and native Visio use the same settings and selective
unrelated-cable clearance. Native fragments stay in their editable text shape.
Drawing/paper scaling scales the padding. A compact Latin glyph metric table is
derived from the already bundled DejaVu report fonts; regenerate it with
`python3 scripts/generate-caption-font-metrics.py` (maintenance-only fontTools
dependency). Unsupported glyphs use conservative bounds rather than clipping.
The default font families and existing text layout have not changed.

Local checks: 539 Node tests pass without skips, seven Python package tests and
nine independent Visio package checks pass; offline build, root guard and
whitespace checks pass. Actual SVG/PDF pixels cover tight, roomy and transparent
backings, while synthetic sample white/transparent renders were inspected.
`tests/browser-page-layout-defaults.mjs` now covers the settings, cancel,
Undo/redo and save/reopen; local Chromium aborts on sandbox IPC/ptrace restrictions
before launch. Hosted run 200 passed the full backing UI sequence and its
capture was inspected. Installed desktop Visio
interaction is still untested. No version bump or remote publication included.
# Interactive HTML drawing export

Export documentation now offers Interactive HTML for the existing current-page,
page-group and all-pages scopes. The standalone offline viewer includes only
page names and rendered SVG snapshots, with navigation, full-set label search,
object-label inspection, zoom/pan, keyboard controls and a responsive sidebar.
It is explicitly read-only. Passive SVG filtering and a no-network CSP reject
script/event/external-resource markup while retaining embedded raster images,
rotated geometry, physical ports and cable masks. No project/evidence records
are serialized. Preserve the scene font stack when stripping SVG inline styles.

`node --test tests/interactive-html.test.mjs`, offline build and repository guard
pass locally. Local Chromium aborts because socket() is prohibited, so actual
browser verification uses the hosted
`tests/browser-interactive-html.mjs` gate, which passed run 200. That gate exercises the real Export
menu/download, viewer navigation/search/zoom/pan, mobile width, hostile markup,
embedded image retention and zero network requests. It captures
`interactive-html.png`; the visual-review follow-up above must finish before
adding the run 201 visually verified capture to docs if separately approved.
No publication or release-version changes are included in this work.
# Configurable model sizing and panel docking

Size changes now offers Model size (default, preserves existing core positions) and Layout spacing (moves selected objects without changing dimensions). The setting is saved in layout.sizeMode and participates in history. scaleDrawingItems pins visible core bodies before dimension edits; direct corner handles always resize models. Layout spacing requires at least two top-level objects and anchors their upper-left selection bounds. Ports remain glued after scene rebuilds.

Information panels receive a final docking pass after text styling and labels, using rotated bounds and cable extents to stay on the selected left/right/top side without collisions. Free positioning remains manual. Docking precedes uniform page scaling, so SVG/PDF/Visio share the same final scene.

Focused checks: node --test tests/size-panel.test.mjs tests/editor-placement.test.mjs tests/transform-controls.test.mjs tests/presentation.test.mjs. Hosted run 200 passed the sizing and panel suites; focused control captures were reviewed. Native Windows verification remains separate.
# Persistent visual groups and locked physical paper

`drawing-groups.mjs` stores stable edit-key membership under layout.drawingGroups. Group/Ungroup and expanded selection retain individual objects, artwork and history. Shared-pivot transforms pin existing core geometry and clear saved attached bends for socket-based rerouting. Native-detail rotation is rejected atomically; internal alignment/spacing requires ungrouping.

Explicit new physical paper choices default to locked; existing settings remain compatible. The initial fit records visible.lockFrames per page. Later manual edits freeze that presentation and reject overflow, rather than resizing the sheet or silently refitting every object. Page-option changes clear/recompute frames. Focused regression coverage is in drawing-groups.test.mjs and page-lock.test.mjs. Hosted run 200 passed the grouping/page-lock suite, and its reviewed captures are included. Native Windows verification remains separate.
# Explicit existing-device stack associations

Device details and the device context menu now offer Configure device stack. Named associations assign existing device IDs to explicit member numbers. Member removal, dissolve, Cancel and project Undo/Redo retain individual devices, ports, links, source evidence and positions. This is separate from imported single-record hardware stackMembers and freeform drawing groups. Stack/member captions are measured with device details in core and port-map scenes and therefore travel with SVG/PDF/Visio scene exports. Associations survive project cleaning/save/reopen and accepted identity aliases. No physical stack cables, hardware compatibility or chassis merging is inferred.

Run node --test tests/device-stacks.test.mjs and the full node --test suite, then node scripts/build-web.mjs. tests/browser-device-stacks.mjs is added to hosted Edge validation for real UI, cancellation, history, duplicate-member validation and save/reopen; hosted run 200 passed, and its synthetic stack screenshot has been inspected and added to docs. Native Windows checks remain separate.

# Device rotation candidate (after preview.42)

Devices now expose manual angle entry/reset and direct rotation handles, with 15-degree Shift snapping. The unrotated physical dimensions and normalized artwork are retained, while world sockets, selection bounds and cable departures use the saved center rotation. Native text/detail drags invert the parent rotation. Rotating pins existing core positions as one undoable edit; insufficient room or overlapping hardware rejects the change. SVG, PNG/print, vector PDF and native Visio carry the same artwork/socket rotation, including port decorations and glued endpoints. Reopening retains angles and recomputes routes.

Local tests cover arbitrary and quarter-turn socket glue, conservative routing, modular departure constraints, inverse native-text dragging, history, saved-project rebuilds, vector/raster PDF pixels and native Visio ports/master inheritance. Hosted tests/browser-device-rotation.mjs covers UI controls, physical glue, cancellation and save/reopen; the suite passed hosted run 200, and its rotation screenshot has been inspected and added to docs. Hosted Windows lifecycle verification remains separate. No installed Microsoft Visio application is available for interactive verification.
# Separate drawing-pages sidebar

Drawing set navigation now has its own sibling `aside#page-navigation` immediately right of `.project-sidebar`. The project sidebar retains site/import/inventory controls. Page groups scroll independently over the available height; existing IDs, keyboard navigation, page rename and scope menus are unchanged. At widths below 1000 px the bounded project/pages panels sit above the full-width canvas; phone widths stack them. A new project hides the empty pages rail and reclaims its space.

`tests/browser-page-navigation.mjs` covers separate landmarks, six viewport widths (390–1366 px), canvas space, no horizontal document overflow, keyboard/scroll/rename/context menu behavior, and new-project/reload restoration. Local browser execution remains unavailable in this sandbox. Hosted run 200 passed the navigation suite; current 1366, 1024 and 620 px captures are included.

# Native device-drag smoke target

The native smoke gesture previously started 5 screen pixels inside a device corner, which is now the resize handle hit area. It now selects a verified interior artwork point and rejects text, ports and editor overlays; the SW-1 identity, Shift axis lock, scaling, undo and selection assertions remain mandatory. Hosted browser coverage also moves a two-device Shift selection and checks unchanged widths and locked vertical positions. This is a test-target correction, not a production interaction change.

# Direct transform follow-up

Hosted Edge exposed a real accessibility issue: full-width alignment controls expanded the text toolbar, clipping the selected title and its handles above the canvas. The toolbar now uses bounded field widths, and selection/font changes reveal the selected text after layout at the existing zoom. Active gestures are never rebased. The browser regression checks the actual pointer hit target, compact toolbar height, committed resize status and persisted dimensions rather than dragging clipped coordinates.

# Preview.42 candidate: unified requested improvements

The owner explicitly authorized pushing and publishing this requested update on
2026-11-09. Draft PR #41 combines page layout/readability, sidebar navigation,
centered/default inline labels, direct editing and Switchport integration fixes.
Version/release intent is now 0.1.0-preview.42. Do not announce availability until
the final combined browser/native Windows jobs, merged-main release workflow,
public tag/feed and all three asset digests are verified. Prior notes below
record implementation stages, not the current authorization state.

The remote review source is created through the authenticated GitHub connector
because shell GitHub credentials are unavailable. Every uploaded Git tree must
match the locally tested tree exactly. Remote commit hashes differ from local
cherry-pick hashes; verify tree identity and the exact remote head's CI.

Local interactive Chromium is blocked by IPC restrictions even after escalation.
Actual synthetic SVG/PDF renders were inspected. Hosted run 42674168964 supplied real current editor captures for the hero,
port map, wireless sheet, connection legend and organization preview. Run 42675679821 passed all hosted Edge browser suites, including strict direct
transform hit-testing and saved-width checks. Its direct transform capture is
now included in docs/images/direct-transforms.png. No customer data or supplied
customer screenshots are included in this repository.
# Unreleased: inline port defaults and cable-safe caption backings

Port labels now prefer centered placement over their associated cable, including
aligned banks and individual departures. Beside-line placement remains a clear
fallback. Pinned positions and saved cable-side attachments win over automatic
banking; captions retain their endpoint association and readable measured size.

`diagram/label-backings.mjs` subtracts unrelated visible cable stroke envelopes
from white backings, including jump arcs and rotated captions, without changing
cable paint order, jump masks or underlying artwork. SVG and PDF use matching
vector fragments. Native Visio keeps those fragments in the editable text shape
so native movement/rotation/resizing carries the backing. Exports use the current
scene snapshot; desktop Visio interaction remains untested locally.

Synthetic tests cover horizontal, vertical and oblique text, either cable paint
order, hops, hidden paths, missing associations, link ID zero, negative-origin
normalization, saved label placements, actual SVG/PDF pixel renders and native
Visio geometry. The inline-port-labels image is actual generated fictional sample output,
not an interactive browser capture. The editor hero is unchanged. Run `node --test`, `node scripts/build-web.mjs`,
`node scripts/check-repo.mjs`, `node scripts/export-test-fixtures.mjs` and
`python3 scripts/check-visio-package.py .artifacts/visio`. No version bump or
remote publication is included in this local change. Local validation: all 464
Node tests passed with no skips, plus seven Python package tests, nine independent
Visio package checks, the offline build, repository guard and whitespace check.

# Unreleased: Switchport 1.18.6 parity reconciliation

Native report layout and workspace migration incorporate upstream 1.18.6 fixes while retaining NDS six-point reference-scene number text and normalized-data persistence. Browser parsing/report projection now covers management/mirror notes, configured speed/SVI data, IOS all/except edits and tagged-native state. See docs/SWITCHPORT_INTEGRATION.md for exact remaining browser-only gaps; do not call this exhaustive browser parser parity.

Fresh native source imports now hydrate uniquely matched configuration ports before manual edits/evidence replay, retaining names/topology/observations and warning about unresolved route equivalence. Source disable/re-enable and later edits are covered by synthetic regression.

Category selection now masks retained native report data and supplementary observations as well as visible editor records; exact hardware geometry remains. Ports-off, VLAN/route ownership, source immutability, manual replay and reopen are covered by regression tests.

Native workspace, geometry, mixed-scale, raster-fit and paper regression tests are added to the existing build gates. Local .NET is unavailable, so native execution and hosted Windows/browser validation remain pending. No version bump, release intent, merge or publication is included.
# Direct editing controls (pending hosted verification)

Single selected objects now expose proportional corner resize handles; text also exposes a rotation handle (Shift snaps to 15 degrees). Text can be selected directly, including native device text, with a compact content/style/angle toolbar. Changes use the existing validated project history and saved edit pipeline. This earlier text-only limitation is superseded by the device rotation candidate above. Transform overlays are editor-only. Escape cancels a gesture. The size buttons remain the keyboard-accessible resize alternative.

Verification: transform geometry, presentation coordinates, saved/rebuilt text angles and SVG/Visio export tests are in tests/transform-controls.test.mjs. Local Chromium cannot start because socket() is prohibited even with escalation; hosted browser interactions and a current screenshot remain required before release.

# Unreleased: readable paper layouts and wireless row alignment

Working from preview.41 main `43d9752b697aa044e8083ae35af959e4a0be2034` on
`fix/wireless-alignment-footer`. No new release, version bump or publication
intent is authorized by this change. The existing preview.41 remains published.

- Page groups are persistent expandable lists in the project sidebar, with
  current-page highlighting, keyboard navigation, double-click/context rename,
  internal scrolling and the existing page picker/controls retained. Top page
  tabs are removed. The active family retains the native-test `#tabs` contract.
- Cable labels and port numbers default to centered text in their measured
  boxes, including banked/inline/multiline labels and physical map numbers.
  Explicit saved alignment still wins. SVG/PDF/Visio alignment and ordinary/
  stacked map regressions pass; actual synthetic output was rendered/reviewed.
- Footer and page numbers are independent, opt-in Page options. Explicit saved
  settings and formats survive; unspecified old/new projects start with both off.
  Dynamic content and fixed-paper tables reuse the unused footer band. Main
  drawing-set builder maps obey these settings; standalone Switchport Reports
  retain their separate native behavior.
- All port map sheets precede the port inventory sheets, retaining relative
  device/page order and edit identities. The editor and exports share that order.
- Wireless alignment now operates on final, actual route directions, including
  bounded stack-gap rows that the initial rank pass cannot align. Disjoint
  opposite runs can share a row only if full route scoring and painted-lead
  clearance checks accept it. Same-side/overlapping routes remain separated;
  manual bend restoration is unchanged. The synthetic 8-member/32-AP regression
  reduces crossings from 106 to 34 with zero obstruction/merged-segment costs.
- Explicit physical paper in Auto-fit mode constrains wireless planning before
  whole-page fitting, avoiding unreadably shrunken large dynamic canvases.
  Dynamic pages and Preserve existing layout retain their existing geometry.
  Auto-fit regenerates the same paper-aware base before applying manual edits,
  so the first edit cannot collapse its continued sheets. Continuation retains every AP/link and
  complete physical members; no source observations are removed. Saved numbered
  paper overrides conservatively constrain the shared plan to the smallest
  applicable physical width/height, while each final sheet retains its own paper.
  The fictional 8-member/32-AP Letter fixture improves minimum AP detail from
  3.54pt to 8.47pt; A4, A3, A5 and Letter portrait also exceed 8pt. Larger paper
  needs fewer sheets. First-edit/reopen and explicit font overrides are tested.

Validation is synthetic only. Current local Chromium cannot launch because its
required IPC socket is blocked, including an escalated launch. Do not call this
an interactive browser pass. Inspect actual renderer output locally and require
both hosted browser and native Windows checks on the final source before merge.
Normal checks: `node scripts/check-repo.mjs`, `node --test`,
`node scripts/build-web.mjs`, `node scripts/export-test-fixtures.mjs`,
`python3 scripts/check-visio-package.py .artifacts/visio`, and
`python3 -m unittest discover -s tests -p 'test_*.py'`. Export fixtures must be
generated before the Python package tests. Local aggregate validation: 446 JavaScript tests pass with zero skips; the
offline build, repository/whitespace guards, nine independent Visio packages
and seven Python package checks pass. Draft PR validation is authorized;
merging and release publication remain pending explicit approval.

# Preview.41: measured paper-aware port-map reflow

Requested correction: use the measured layout approach of Switchport Diagram Builder rather than shrinking a forced horizontal member arrangement. src/web/reports/adaptive-port-map.mjs compares complete ordered banks, bounded number/heading styles and side/below key positions on the selected physical paper. It maximizes shared socket width, favors readable type near a size tie and retains all VLAN memberships, ports and member order. Chassis module pairs are never rewrapped as independent members. Standalone native and browser Switchport Reports retain their existing behavior.

portMapSheets resolves actual final page names, including repeated workspace names, before applying individual/group/default visible-paper settings. Dynamic pages, Preserve existing layout and independent print paper retain their previous semantics. The adaptive scene uses exact 96-dpi paper geometry and fitVisiblePage must not add another shrink-to-fit margin. Its original report role/name and member/socket edit keys remain stable. Explicit edits are applied after the same deterministic base layout on every rebuild; the first moved item must not revert the rest of the page to the legacy layout.

Regression coverage: tests/adaptive-port-map.test.mjs and tests/fixtures/adaptive-port-maps.mjs cover five/eight-member stacks, all 260/416 ports, A4/Letter portrait/landscape, other presets, member order, one complete key, actual physical dimensions, per-page precedence, save/reopen, independent print paper and first-edit stability. tests/browser-adaptive-port-map.mjs exercises the built offline editor's real page controls, Undo/redo and synthetic captures. The reusable validation workflow includes that browser test. The old landscape test now asserts measured single-column placement for its fixture instead of hard-coding the faulty two-column result.

Local Chromium navigation is blocked by the environment's administrator policy for both file and loopback HTTP URLs. Do not claim a local interactive browser pass. The built offline HTML passed actual local DOM-loaded Chromium checks for A4/Letter reflow and Undo/redo. This does not test file navigation; hosted Edge must cover that boundary. The README image is captured from the actual synthetic editor fixture on the Windows candidate-preparation runner. The Windows-hosted Edge, native exports, updater, rollback and timer gates must pass on the exact final head, and the merged-main release plus all three public assets must be verified before announcing availability. Local validation: 435 JavaScript checks, seven Python checks and nine independent Visio packages passed before the final semantic edit-key regression was added. No supplied customer files or derived customer captures may enter the repository.

# Preview.40: compact inventory, editing, label placement and configurable sidebar

The main Text styles toolbar button opens project-wide defaults for ten text categories; src/web/global-text-styles.mjs validates per-category scale (40% to 250%), optional color, bold and alignment, while preserving explicit drawingEdits. The settings survive project save/open through cleanLayout and are applied to editor scene items before the final page fit and print/export step; physical switchport engine pages are kept at their verified native geometry. tests/global-text-styles.test.mjs covers category detection, validation and edit precedence.

The editor's connection-type-highlights.mjs establishes a bidirectional association between cable and connection-type legend labels/samples using data-link-type metadata on the live SVG. Cable proximity notifies this highlighter about pointer hover, while selected edit keys identify matching linkType entries. CSS effects apply only under #canvas, never to saved SVG/PDF/Visio scene source. tests/connection-type-highlights.test.mjs covers type attribution and scene metadata.

The selected-object Spacing... dialog operates on the existing drawingSelection and uses arrangeBoxesAtGap (src/web/arrange.mjs) for an exact edge-to-edge horizontal/vertical gap. It moves selected edit keys and leaves the first object in spatial order anchored; even distribution still uses arrangeBoxes. Both paths use validated moveDrawingItems, reroute attached endpoints, preserve other objects and create one Undo operation. tests/selected-object-spacing.test.mjs covers existing positions and both axes.

Connection-label alignment stores a validated cableFraction (0 to 1) and cableSide ('above', 'on' or 'below') in drawingEdits, with rotationMode ('auto' or 'fixed'). src/web/connection-selection.mjs computes offsets from the rotated label footprint. The on-line setting creates a centered white line break; above/below keep the link intact, with left/right equivalents for vertical segments. Both percentage and click-to-place flows use the same positioning function. PlaceCableLabels reapplies the saved side and rotation after a cable reroute, retaining backward-compatible on-line placement when cableSide is absent. tests/cable-label-placement.test.mjs verifies offsets, manual rotation, saved settings and rerouting.

The configurable sidebar keeps existing printed section headings and full device/address/MAC details. src/web/diagram/panel-content.mjs builds normalized rows; information-panel.mjs lays them out in saved section order. Existing generated module legends default to per-type summaries but full assignments remain selectable through modulesMode='full'. The legacy text-layout test explicitly selects full mode. Opposite-direction wireless paths may share a departure level, while same-side paths keep separate ranks; tests/wireless-departure-levels.test.mjs validates the symmetric requirement.

Port Inventory pages created by the main drawing-set port-map builder now use 10-unit text instead of 12, with a 12-unit line pitch, smaller row and header padding, and more of the available vertical page. This change is limited to Port Inventory tables generated by bookletInventory in src/web/diagram/index.mjs. It does not shrink the actual switch/stack faceplates, physical port numbers, VLAN/LAG key, normal topology labels, or standalone switchport report artwork. Port identity, per-interface configuration, description, tagged/native/voice VLANs, LAGs, connected peers, link state and individually editable table cells must be retained. Existing manual table edits use the same stable edit keys. A 96-port synthetic two-member stack regression checks the reduced page count, the complete record set, compact fonts and non-overlapping labels. Ensure the native Visio and PDF exporters preserve all pages and records. Full Windows, browser, updater and rollback checks, followed by merged-main publication checks, are required before announcing preview.40.

# Preview.39: responsive page fit, rulers, persistent connected labels and safe page navigation

The new preview adds an explicit Auto-fit and optimize content versus Preserve existing layout choice to Page options. Auto-fit scales the completed scene uniformly into the selected visible page proportions, while the core compact arranger and wireless bank chooser prefer shapes closer to that ratio. Saved device and label edits remain in original scene coordinates and map back through presentation transforms. Preserve mode retains the previous behavior of changing only the white boundary. The editable page and print paper remain separately configured; logical pagination, port mappings and source devices are unchanged. The builder-style switchport workspace can combine up to eight member faceplates into two columns on landscape pages, with one VLAN/LAG legend and all ports present.

A Word-style ruler overlay on the top and left of the editor uses inch or millimeter tick marks calculated from the selected physical paper dimensions and the current zoom. Click its corner-unit button to toggle units. These controls are DOM overlays, excluded from SVG, PNG, Visio and printed output.

Cable/port/label selection associates actual source-link identities rather than spatial proximity, highlights the cable and related labels, and marks both physical port endpoints. The Snap label to line action aligns an individual label by percentage or by clicking an exact point on its visible cable. A pinned manual text-label edit is kept exactly during subsequent regenerations instead of being reflowed. Other cables are not obscured by persistent in-line labels; validation rejects unsafe overlaps. Core device movements are clamped clear of the information sidebar, including after page fitting. Page group dropdowns close on outside pointer clicks, Escape, selection and opening another group.

Use synthetic regression tests for proportions and retained glue, all stack sizes, two-column stack placement, ruler positions, association identities, label pinning/snap and sidebar safe moves. Hosted Edge checks verify actual page navigation and ruler behavior. Run the full Windows build, browser checks, native export and report suite, five-minute timer, updater/rollback tests on the exact PR head; merge only on green. The merged-main release workflow must publish and validate preview.39 before announcement. Never commit user or client configurations or secrets.

# Preview.38: visible page proportions, individual overrides and consistent wireless departures

Preview.37 accidentally removed the editor's page-level paper controls. The correction restores Page options with a visible page proportion selector for a drawing default, a page group, or any individual generated page. Values are stored in layout.pageSetup.visible, separate from the legacy canvas geometry (default/overrides) and independent layout.pageSetup.printPaper. A4, A3, Letter and custom ratios change the actual editor page viewBox, maintaining the whole drawing and its original item coordinates; the presentation boundary expands and centers to fit the contents without repositioning equipment or splitting logical pages. Dynamic / Fit all is available at every scope. An explicit Dynamic override cancels an inherited group setting; Inherit clears an individual/group override. Print paper can optionally differ from the visible page.

Physical port-map sheets remain single logical pages for stacks from one through eight physical members, including tagged VLANs, port numbers and one VLAN/LAG key. The wireless planner passes directionNeutralLevels=true to coreRoutes so switch-edge departure ranks follow physical socket x order instead of jumping in response to whether the external rail goes left or right. Collision avoidance, module escape channels, painted-line spacing and native port anchors remain enforced by the existing router.

Synthetic tests verify paper aspect ratios, all/group/page precedence, unchanged drawing edits and counts, print output separation, eight-member stacks, and direction-neutral wireless departures. Hosted Edge tests cover changing the visible sheet and group/page settings. Native smoke tests cover visible A4 and independent print paper. Full Windows browser, native reports, app startup, five-minute timer, updater and rollback validation must pass on the final branch and merged main before publication. Only fictional fixtures are permitted. Existing projects and all user edits remain compatible.

# Preview.37: dynamic full-stack port maps and scrollable page navigation

The next preview keeps a large VSF stack on one logical builder-style port map instead of dividing member rows among paper-sized map tabs and repeating its VLAN/LAG legend. Print paper is selected separately from the editable canvas; changing paper sizes or orientation does not reflow objects, create logical continuation pages or change port coordinates. The Page options dialog now presents print settings and page numbering without changing saved legacy canvas settings. Fixed Letter/A4/A3 print outputs scale the complete logical drawing proportionally. Very large prints may be too small to read at standard paper sizes.

The page tabs scroll horizontally with mouse wheel/trackpad or scrollbar. Selecting a top-level group opens a styled, vertically scrollable list of its pages; the active page is marked, and clicking one navigates directly. Keep the old page picker. Fictional eight-member VSF and real Edge interaction tests cover the one-map layout, paper independence, group selection and scrolling. Validate the final PR head in both Windows jobs before merging. The merged release workflow must pass and publish preview.37, after which the public release assets and updater feed must be verified. No client configuration may enter the repository.

## Preview.36: clearer controls and consolidated connection properties

Prepared from published preview.35 at babdb16cbec4333a00a471a343066eeeede5d646 on feat/editor-controls-and-line-styles. The existing switch-compatibility checkout has separate unfinished work and is not included. Standing source, PR, merge and release authorization continues for this requested UI change. Require both exact-head validation jobs, merged-main publication, then public tag/feed/asset verification before announcing availability. Do not restart or replace the user's running application.

Editable text, search, number and multiline inputs have clear controls that preserve focus, native labels, values and input/change behavior. Read-only and disabled fields have no active clear action. Datalist-backed model/platform fields use an app-colored accessible popup with full wrapped descriptions, keyboard selection and custom input. Native selects retain their existing IDs and value API.

Double-click enters Edit drawing for devices, cables, legend samples and other objects; text keeps inline editing. The view freezes before toolbar reflow. Legend samples share cached proximity highlighting and keyboard selection with cables, while editor halos stay out of exports. General object properties omit Left/Top coordinates.

The properties dialog keeps type, speed, color, opacity, width and expandable caption fields in one draft with Save and Cancel. The duplicate Configure link type, speed and captions navigation is removed. A selected cable keeps its own metadata/width scope, while legend edits update the associated class. Width previews use actual non-scaling SVG strokes at 100%. A legend's thickness is its sampleWeight, independent of its unused rectangle border. Shared weight is saved in linkStyles and used by the route planner; explicit per-line overrides survive unrelated edits. Type/width migration retains moved, named, hidden and wrapped legend edits. Custom line titles/descriptions remain visible when automatic cable captions are off.

SVG hops use bounded cable-only masks. Clearance removes nearby other strokes and reveals underlying colors or artwork without a white patch. Geometry, hit targets and native Visio arc/glue behavior remain intact. Synthetic rendering over distinct backgrounds checks the actual pixels.

Normal checks remain node scripts/check-repo.mjs, node --test, node scripts/build-web.mjs, node scripts/export-test-fixtures.mjs, python scripts/check-visio-package.py .artifacts/visio and python -m unittest discover -s tests -p test_*.py. The reusable Windows workflow also runs separate actual Edge checks for form controls, exact line-preview thickness, transparent SVG pixels and PDF capture for inspection, cable targeting and consolidated properties/Undo/reopen. It preserves the existing native build, report, export, timer, consent, update-health and rollback gates. Browser captures use fictional data only. The local environment lacks a browser and its official browser download returned an unavailable-site page. Hosted Edge 156 with Playwright 1.62.1 passed all six browser scripts on 57b80c4cb1c848de1ac872c7ec68bd3124baa0c8, including exact preview pixels, cleared field events, styled suggestion selection, hover/double-click, Save/Cancel, Undo/reopen and default dialog bounds at 1366 by 768. Eight reviewed synthetic captures were copied into docs/images, each below 165 KB. The generated Chromium PDF was independently rendered with Poppler at 384 dpi; all six background/cable sample colors matched exactly. The separate Vector PDF renderer uses per-cable outside clips around adaptive cubic stroke outlines, with overlapping convex pieces for tight or flat curves. Seven actual exported PDF pages cover native and raster artwork, early-drawn hop owners, flat bundles, tiny thick hops, overlapping clearance and invisible owners; 47 exact comparisons matched untouched same-PDF background/stroke pixels. Root reviewed the rendered standard, raster, tight and flat cases. The final local Node suite passed 401 tests with zero skips, including six PDF regressions rendered with Poppler. The prior 57b80c4 candidate also passed the complete native Windows build, 72 native report/import/file checks, 38 report-paper assertions, actual exports, five-minute timer, verified upgrade and unhealthy-update rollback. The final source must pass both hosted jobs before merge. Direct desktop Microsoft Visio inspection remains unverified.

## Preview.35: port maps in device colors with larger, centered VLAN dots

Version 0.1.0-preview.35 (PR #34) makes the Switchport builder sheet the default port map, painted in each device's core-diagram artwork colors, and grows jacks and tagged dots to fill the sheet (one centered dot size per map, set by its busiest port). The realistic faceplate remains a Port map style option. Publish only after the merged-main release workflow passes and the GitHub release, updater feed and asset checksums are verified.

## Preview.34: configurable report paper, outside port numbering and compact network sheets

Version 0.1.0-preview.34 combines the fully validated paper-size implementation from PR #33 with the active port-map/network-layout changes in PR #32. The former PR was merged into the latter, then the version and release intent were updated on the combined branch. Merge only after the exact version commit passes all Windows/browser/native tests. The final merged-main release workflow must pass, publish an immutable preview.34 prerelease, and have its public GitHub release, updater feed and asset checksums verified before announcing publication.

The Switchport Reports dialog supports Letter, Legal, Tabloid/Ledger, A5, A4, A3 and A2, landscape or portrait; layout.switchport.paper saves the independent choice with A4 landscape as the backwards-compatible default. Browser report scenes and tables use chosen sheet geometry and paginate. The native report exporter preserves the existing A4 scene and fits it uniformly to the PDF/PNG media selected, without stretching or cropping ports; small sizes can reduce printed readability. Explicit non-default output names identify size and orientation, and validation/manifest metadata records the choice. Port maps in the drawing set retain their own page-family paper choice.

The integrated port-map work keeps VLAN fills/markers, numbered sockets and port inventory data together, while the drawing route/caption planner reserves outside port-label space and organizes cables into clear, even lanes. Preserve edit identities, PDF/PNG/Visio exports and actual host-port geometry.

Tests: node --test, Windows executable build, portable packaging, the real native GUI/update lifecycle smoke and tests/report-paper-native (Skia PDF media boxes), plus report-paper.test.mjs (real jsPDF Letter/A3 media boxes, settings/save and archives). All fixtures synthetic. Interactive Microsoft Visio inspection remains unverified. Never include any actual customer data.

## Configurable switchport report paper (feature under review, after preview.33)

The Switchport Reports options dialog now offers Letter, Legal, Tabloid/Ledger, A5, A4, A3, and A2 with portrait/landscape orientation. Saved as layout.switchport.paper independently from drawing layout.pageSetup, with A4 landscape as the backwards-compatible default. The browser engine reflows report diagrams, legends and inventory tables and paginates at the chosen physical size, using embedded vector PDF and 300dpi PNG exports. The Windows native engine retains the established A4 scene for internal drawing and fits it proportionally into the chosen PDF/PNG media size without crop (which may make small-paper text less readable); dimensions/format are reported accurately. The file naming uses an 'a4' stem for the unchanged default and a size-orientation stem for other presets. Port-map drawing sheets continue using their own page family sizes and dense faceplate styles; do not override those with report settings.

Synthetic regressions: tests/report-paper.test.mjs for settings persistence, real jsPDF media boxes, preview page sizing and browser archive filenames; tests/report-paper-native for Skia native PDF media boxes and 300dpi dimensions. Run node --test, the native report test, npm repo checks, Windows build and native app smoke on the exact final branch before merge. Only fictional data is used. A stale report-options screenshot must not be represented as updated; capture from a real built app if available before release.

## Compact network page arrangements (unreleased, after preview.33)

Owner request: by default, network devices should take the least space possible. There should be an option to arrange them in a particular way, for example a vertical stack or a compact square, while the existing orientation and alignment tools stay. Placement follows the order configured with the existing tools. It must work for any device that configurations are provided for.

Layout (compact-layout.mjs, core.mjs, layout.mjs, core-arrangement.mjs):
- columnLayouts partitions the saved order into balanced columns, reading down each column and then across. Bodies share their column's left edge.
- Compact scores the finished sheet's estimated area, including the legend column, heading, left rail reserve, column gaps and exterior rails. Strips wider than about 3:1 are penalized, and cable length is a small extra term.
- Fixed choices are Vertical stack and 2, 3 or 4 columns.
- On a capacity error, Compact tries its next two ranked arrangements at the standard rail pitch before widening rails. A fixed choice that cannot be routed falls back to Compact, then to one column, and sets arrangementFallback.
- Multi-column pages reserve left rails only for the first column. Dynamic headings shrink to their text after labels are placed, so sheets end at their content.

Routing (routing.mjs, labels.mjs):
- Cross-column cables start in the gap between their columns.
- A final repair separates rows and rails left closer than the visible gap, or rails too close to equipment. It may trade one crossing for a merged segment.
- A cable's rows and rail stay outside its own modular chassis, even through empty slots.
- Interior collinear spikes are collapsed.
- Center-corridor tracks with overlapping channels are spread together.
- Media captions gain a stacked two-line inline candidate after the existing callouts.

Editor:
- Edit drawing has an Arrange selector, and Pages & layout has Network page arrangement (Drawing defaults) and Device arrangement (named pages).
- Changing an arrangement clears device, caption, label and bend positions on the affected pages, keeping sizes, text and styles, as one Undo step.
- tests/browser-core-arrangement.mjs covers the toolbar, Undo/Redo and the dialog.

Measured on fictional fixtures (page size; previous default → Compact):

| Fixture | Previous default | Compact |
| --- | --- | --- |
| Sample | 1200×897 | 1200×897, one column |
| Modular lab | 1608×2148 | 2008×1369, two columns |
| Campus lab | 2208×2393 | 2832×1041, three columns |
| 16-device lab | 3196×2767 | 3012×1581, three columns |

On the 16-device lab:
- hop arcs fall from 134 to 72;
- close parallels fall from 2 to 0;
- cable length falls by about a third.

Owner review of the first build (Visio export and a real MDF import, reproduced with tests/fixtures/mdf-lookalike.mjs):
- Inline connector captions now paint their white background in Visio. The text geometry is filled and has no line.
- Cables no longer thread through the gaps between another stack's members; unrelated equipment is solid.
- Socket leads of vertically stacked devices no longer overlap.
- Module turns stay off the socket edges. The preferred module pitch is the standard separation (10).
- Overlapping module bands and corridor channels are no longer re-spread separately.
- Generic symbols give each unmatched port its own attachment point.
- The left reserve for multi-column pages counts every cable on the first column.

Owner follow-up (editing, snapping, speed and spacing):
- Edits were being refused with "This change overlaps a link label" on pages with connector text on its own cable. Edit validation and Organize analysis now exempt that text, except where its own cable jumps, and allow a host's own leads through empty bays.
- Snapping is a one-click on/off button; Snap options... holds the grid and alignment settings.
- Dragging a bend near a neighboring bend's line merges the points, and interior collinear spikes collapse. Exact keyboard and dialog moves keep their coordinates.
- Faster rebuilds:
  - coreRoutes is memoized on its exact inputs;
  - identical device measurements are reused within a build;
  - faceplates are memoized.
  - On a large fictional project, a core cable edit rebuild went from about 1.0 s to 0.5 s, and a browser bend commit from 0.93 s to 0.63 s. A warm rebuild is byte-identical to a cold one.
- Organize connections has Even line spacing with a spacing value, saved per page in layout.lineSpacing and also used by wireless pages.

Owner follow-up (captions and remaining overlaps):
- Cable type and speed text on lines is off by default (layout.cableCaptions); Pages & layout has the option. Explicitly edited captions stay.
- Collinear runs of different cables (for example vertically aligned ports on stacked devices) keep at least the standard clearance between their ends.
- The final repair counts runs hugging equipment, so no repair adds one.

Owner suggestion: a socket under the empty MM2 bay's caption now rises into the bay and turns under the caption, rather than running between the module's port rows. Its lane stays clear of neighboring socket columns.

Owner follow-up: device captions no longer show MAC addresses or counts ("417 MAC addresses"); the address panel and device editor keep the full list. The MM2 bay caption slides clear of rising cables, and port labels prefer a spot clearly nearest their own cable near the port.

Owner follow-up (crowding, highlight, lag):
- A cable crossing a tight bundle draws one bridge instead of stacked jumps.
- Cables highlight under the pointer outside Edit drawing too.
- Snapping, arrangement, cable text and line spacing no longer invalidate unrelated page families.
- Arrange, Pages & layout and Page options validate through the page cache and reuse that build.
- The Arrange control re-enables after busy work.
- On a large fictional project: a snapping toggle takes 0.3 s and Arrange 0.3-0.4 s (it was 1.3 s); a device move or undo still re-plans the core page (about 0.6 s).

Owner follow-up (Visio jumps, WAN cards, labels, off-page links, editor space):
- Native Visio connectors carry the planner's jumps as EllipticalArcTo rows, so hops show as soon as the file opens. Before this, Visio drew them only after it rerouted an edited line.
- WAN/ISP/egress cards stay above their firewall or router by default and move with it when it is dragged, nudged, aligned or placed beside something (movementOffsets in drawing-edits.mjs). A card can still be moved or placed on its own, keeps that offset from its owner afterwards, and can be the moving item or the reference in Place beside, alone or in a Shift selection. A cable with saved bends whose two ends move together is translated whole.
- A port label stays on the half of the visible cable nearer its own port, measured from where the cable leaves its equipment to where it enters the far equipment. When that half is crowded, the name sits on its own cable with a white background. Only after that may it take any clear spot. This keeps a far end's port name (5/50) from sitting next to the near end's port (E8).
- Off-page connections end in one aligned column of white tags reading "far device and port, then page", with no L-numbers. All tags on a page share one width and sit left of every rail and every other off-page lane. Dynamic pages reserve the measured tag width. On fixed paper a tag wraps between words, up to three lines, and stacks without overlapping while still touching its own cable; past three lines it shows only the page.
- Editor chrome: a slimmer header; page groups on the title row; page tabs, status text, page picker and import notes on one row; and edit, placement and cable tools in one wrapping bar. With fictional data at 1920x1080 the canvas starts at 185 px instead of 362 px; at 1366x768 it is 499 px tall instead of 336 px.

Owner follow-up (Visio alignment, hops, labels, sidebar, port map dots):
- Visio: on a page drawn above its origin (WAN cards above a firewall), connector paths were written 20 units higher than the device shapes. Cables then missed their ports, and stack leads looked as if they ran through the members. normalizedPage now translates cable commands and hops, and scripts/check-visio-package.py checks every connector's path against its Begin and End points. A LibreOffice render of the fictional MDF lookalike shows the leads leaving below each member into the gap.
- Line jumps default to one hop per crossed line, Visio's usual look. Pages & layout > Line jumps can switch back to one bridge over close lines (layout.hopStyle 'bundle').
- Port names of leads leaving the same side of a device sit in one row: beside their leads, or on their own line where there is no room. This includes leads leaving a left or right side (A1, A3 and C2 on the fictional MDF).
- Device order, Connections, Add, Reports and Hardware moved to the header, so the device list is the sidebar's only scrolling area.
- Port maps now follow the Switchport Diagram Builder:
  - The AOS-Switch parser joins port lists that a backup wraps onto the next line, even inside a port name. This was the main reason chassis ports were missing: 104 of 184 on the owner's MDF.
  - The parser applies 'no untagged' and 'no tagged', gives trunk members the trunk's VLANs, and marks the voice VLAN only when exactly one applies.
  - Sockets are white for "No native VLAN" and gray for "Native not supplied", including sockets with no configuration record.
  - Tagged dots keep a minimum radius of 1.5. Dynamic pages widen the whole port-map family until every dot fits. Fixed paper shows a "+" marker and lists the full VLAN set.

Owner follow-up (printable port maps, port names and off-page tags):
- Owner decision (latest): port maps use the Switchport builder sheet by default, painted in each device's core-diagram artwork colors. This gives the most room and the builder's exact jack, number and key proportions.
  - Slot panels take the device's plate color; a chassis shows its frame color around and between module-bay-colored slots. Numbers and slot captions turn white on dark plates.
  - Tagged dots grow to fill the jacks: each map uses one dot size, the largest at which its most filled port still holds every dot, drawn as a centered grid that grows outward from the middle of the face. A shared size across all maps was tried and rejected by the owner because a dense device shrank every other map's dots.
  - The jacks themselves grow until the map and key fill the sheet; the number style (8 px minimum) is the one that gives the largest dots, keeping larger numbers on near ties. SFP+ cages on port maps are a little taller (19.6/25.2 of their width) but stay rectangular.
  - Port map options > Port map style > "Realistic device faceplate artwork" (layout.portMap.mapStyle 'faceplate') keeps the faceplate sheet described next. Its chassis slot line now moves to the next sheet instead of running into the footer key.
- Realistic faceplate style (now optional):
  - Uses the faceplate artwork on a US Letter sheet.
  - Jack faces on built-in plates take the Switchport builder's shapes: copper 25.2 x 23.2 and optical 25.2 x 16.2. Each media type shares one width, and faces grow away from their port numbers until rows meet edge to edge. Where a plate has no room for that shape (tight rows on a 48-port stack member), copper keeps its own proportions. The plate keeps its shape.
  - Module, bay and model captions on the plate grow to a readable size (up to 11 px) after the port numbers and faces are placed, so they never push a map off Letter.
  - The VLAN key moves under the hardware when that leaves fewer '+' markers.
- Builder sheet details (the default):
  - Fitted to US Letter landscape (or a fixed port-map paper choice).
  - Jacks, dots and numbers grow to fill the sheet.
  - Undeclared slots are slim bands, and the VLAN key uses the builder's dense one-line, five-column layout.
  - A fictional 9-module 5412R-style chassis with 28 VLANs fits on one sheet.
  - Port map options > Port map style can switch back to the device faceplate artwork.
  - Port Inventory tables are unchanged.
- Port names take the spot nearest their own port (C2), on the line when the nearest clear spot beside it is farther away.
- Off-page cables from one side of a device trade rows so they reach the tag column without crossing each other.

Known limits:
- With many leads from one chassis module, explicit Vertical or 2-column choices can still carry the module band's tighter pitch a short way outside the chassis. This was pre-existing.
- Fixed paper keeps the existing column pagination.

## Even cable rhythm and switchport-style port sheets (unreleased, after preview.33)

Owner request: core connections were too close in horizontal parallel, ran tight against devices (especially on the left), were unevenly and often widely spaced, and could leave through the empty top module or split between sides. Port maps should drop the color blocks behind port numbers and follow the Switchport Diagram Builder sheets as Configuration Inspector draws them.

Routing (routing.mjs, scene.mjs, faceplate.mjs, labels.mjs, index.mjs wireless lanes):
- ROUTE_STYLE sets a 24-unit device clearance, a 6-unit visible gap between parallels, an 18-unit rail pitch and a 20-unit row pitch. Wireless lanes use the same rhythm.
- Scoring adds a soft penalty for crowded parallels and device-hugging rails.
- neatChannels redistributes rows, rails and chassis exterior lanes on even tracks, and untangle reorders tracks when that removes crossings (see AGENTS.md for the rules).
- Chassis center tracks keep the visible gap and spread evenly, and module turns balance between the bands above and below the sockets. Empty slots and the optional MM2 bay pass leads toward their peer; the bay caption is now a short right-aligned "Optional MM2 bay".
- Media captions fall back to inline connector text with a white background, which is also written as a filled Visio text shape.

Port maps (index.mjs):
- Port numbers are plain black or white text.
- Booklet maps carry device bars and builder VLAN marks from the shared report palette, then a VLAN key, Trunks / LAGs, port descriptions and a symbol key.
- Port Inventory pages are builder-style tables, one per device.
- The Automatic layout from preview.33 compares page counts against a merged builder sheet instead of the role matrix: faceplates, VLAN key and the start of each inventory table share a page when they fit.
- An explicitly chosen Combined presentation and the expanded tables are unchanged apart from the number text.

Measured on fictional fixtures (sample, modular routing lab, campus lab), original code → this change:
- Exterior runs within 20 units of a device: 2/6/12 → 0/0/0.
- Minimum parallel spacing: 21/4.25/4.25 → 20/14.5/5.5. The 5.5 is inside a chassis module band, where module height is the limit.
- Hops: 0/23/15 → 0/17/19.

Merged with preview.33 (#31):
- Wireless pages now use coreRoutes, so they inherit the clearance and neat channels. On the 8-member/28-AP fixture, wireless runs within 20 units of the stack drop from 12 to 0 and parallels under 12 units from 16 to 9; the remaining 7-unit pairs are stack-gap tracks.
- wireless-number-leads.mjs reads the number text items (numberSide, numberBox, socketBounds) because number boxes no longer exist.
- The Automatic merged sheet is measured at the initial hardware width only, preserving the rule that text scale never changes hardware size.
- The inventory shows every interface address under its mode.
- hero.png, port-map.png and organize-connections.png were recaptured; compact-wireless.png was re-rendered from the fixture.

After owner review of Configuration Inspector's sheets, booklet port maps became Configuration Inspector builder sheets:
- one device per sheet with a dark header block;
- stack members drawn individually under member bars;
- every socket numbered, and chassis modules numbered 1..n under a slot caption;
- a right-hand VLAN key column, with Trunks / LAGs and descriptions beside or under the hardware;
- a footer symbol key.

Whole devices are drawn once (no planner member ranges), and members continue onto another sheet at the common width. Visio exports gain one master per drawn stack member.

New tests: tests/route-rhythm.test.mjs and tests/portmap-sheets.test.mjs. Tests that asserted the old tight geometry or number boxes were updated to the new rules: modular center/exterior counts, empty-bay crossing, local corridor bound, inline caption exemption, grouped inventory rows and the VLAN key heading.

Local validation: all Node tests, the seven Python package tests, node scripts/check-repo.mjs, node scripts/build-web.mjs, and the nine fictional Visio packages from scripts/export-test-fixtures.mjs checked with scripts/check-visio-package.py. Rendered SVG pages and the offline app were inspected in Chromium. hero.png and port-map.png were recaptured from the built offline app with the fictional sample. Still required: Windows build, native checks on the hosted runner, and opening an export in desktop Visio. Release intent and version are unchanged.

## Preview.33 candidate: compact organization, concise documentation and cable selection

Prepared from published preview.32 at 8e2e066152990141a171da4326eac573b75703eb. The native export follow-up in PR #30 passed exact-head Windows validation 42449689029 and merged-main publication 42450293968; its public tag, feed, checksums, downloaded executable version and offline package were verified. Standing authorization covers this implementation and release. Preview.33 still requires green exact-head Windows/native validation and merged-main publication, followed by anonymous feed/tag/download verification before announcing availability. Do not restart or replace the user's running application.

Organize connections analyzes one core or wireless page and exposes Current/Proposed previews plus length, bend, crossing and footprint measurements. Its deterministic bounded candidates preserve device dimensions, normalized port coordinates, styles, manual bends by default and all other page scenes. Hard constraints cover host-port attachment, equipment/module clearance, captions and painted parallel strokes. The candidate budget reserves an ordinary saved-layout replay; a proposal that relies on temporary candidate clearance, fails replay or stops improving the baseline is discarded. Apply is one validated history action, and cancellation or closing the dialog leaves the project unchanged. This is a bounded local search, not a proof of a global shortest layout. Its small route/footprint tradeoffs are shown in the comparison table.

Automatic core packing compares measured compact shelves while preserving saved reading order. It uses actual link widths, label reserves and the busiest local banks; explicit body edits prevent automatic repacking. Place beside defaults to Automatic with a bounded local retry. Only cables leaving the two facing sides contribute to the requested gap. Fixed Compact, Standard and Extra room choices remain. The first positional body/detail edit pins untouched core bodies and generated handoffs before disabling the automatic grid, without changing the selection hierarchy or drawing-scale inverse. The family cache excludes irrelevant candidate flags and reuses unrelated planners during movement and organization.

Native stack memberGaps reserve only busy physical gaps and participate in measurements, rendered anchors and Visio master identity. Individual chassis retain their hardware aspect ratios. Dynamic wireless pages compare measured upper/lower AP banks around a complete stack, including native mapped AP anchors and full model/MAC captions. Fixed paper uses measured member/AP continuations. Ordinary leads take a short dogleg beside outside port-number boxes, and modular leads reserve those boxes when selecting escape bands. Wireless numbers measure text scale before routing, and narrow or thick-cable cases expand their number-row corridor instead of covering or omitting labels. Captions follow their exact AP uplink instance while explicit text patches remain authoritative. Full/custom/edited wireless sheets retain empty placeholders; concise automatic output omits empty placeholders.

Concise documentation is the default. Physical inventory owns port membership; full identical logical definitions share an explicit device scope. Unique logical interface details, addresses, route metrics/context/evidence and logical membership remain represented. Shared physical memberships use referenced profiles; the interface inventory uses compact measured columns and repeated headings. Custom matrices, full reference detail and existing edited references remain available. Automatic port-map presentation compares combined and separate layouts at readable scales, prioritizing saved edit identities. Saving a first port-map edit freezes the accepted presentation so reopening cannot move the edited panel to a different scope. Shared device locks add only grouping-sensitive edit-key presence to both ports/logical cache signatures, keeping cached edits, Undo and fresh reopening consistent. Dynamic-only media caption widths avoid needless narrow wrapping while fixed-paper capacity remains unchanged.

Cable proximity is measured within 12 screen pixels beyond the painted edge, including jump arcs. Hover, click, Shift selection, dragging and double-click share the nearest eligible cable; hardware, text and bend controls retain priority. Geometry is cached and hover is limited to one animation frame. Halo thickness compensates for both the SVG transform and CSS scale. Keyboard cable/bend selection retains focus. Editor halos, hit geometry and interaction attributes never enter SVG, print/PDF or Visio exports. Existing delayed toolbar-resize freezing remains intact.

The repository contains only fictional captures. Private comparisons and customer inputs remain outside git. The supplied project retains both complete wireless stacks and all 60 mapped AP links on two wireless pages, compared with five in preview.32; the scoped wireless audit found no blocked/shared strokes, number/caption crossings, caption overlaps or body overlaps. The full document audit retained all 762 physical ports and all 340 checked device-scoped logical/interface facts; total pages fell from 22 to 21 while adding 103 previously unprinted interface records. Data text remained at least 12 scene pixels without shrinking boxes. A corrected cached 12-pixel stack move took about 495 ms, left all eight untouched bodies and other pages unchanged, and retained clear glued routes. Local verification passed all 341 Node tests, 72 native Switchport report checks, nine independently validated Visio drawing/stencil packages, seven damaged-package rejection tests, repository guard, offline build, and real-browser cable targeting and organizer workflows. Browser checks cover five zoom levels, keyboard editing, cancellation, Apply, Undo/Redo, save/reopen and responsive previews. Exact-head Windows/native and merged-main publication results are recorded with the release PR. The normal commands remain node scripts/check-repo.mjs, node --test, node scripts/build-web.mjs, the native Switchport report runner, scripts/export-test-fixtures.mjs and the independent Visio package checker. Browser regressions live in tests/browser-cable-proximity.mjs and tests/browser-organize-connections.mjs. NativeSmoke must retain its real save-dialog/download completion, print-page, five-minute timer, update consent, health and rollback checks. Direct desktop Microsoft Visio rendering remains unverified.

## Preview.32 publication follow-up: observed native export completion

PR #29 passed exact-head Windows validation 42447977076 and merged as d394210a5ba80fa0a1bfe51dc81f0cd0a6222748. Merged-main publication 42448584320 passed the engine tests, native report checks, production build and packaging, but its native lifecycle job failed at the initial SVG save before the new report smoke ran. Neither the preview.32 tag nor release was published. The failure exposed two gaps in the existing harness: it posted Save after a fixed 400 ms delay without confirming dialog readiness/acceptance, then read the first matching file before observing download completion.

This test-only follow-up observes the actual WebView download, accepts the owned visible/enabled native Save dialog, verifies closure and requires a completed download at the expected destination before validating the SVG or Visio contents. Bounded failures include dialog, operation state, interrupt reason, byte and destination diagnostics. It retains the real dialog, export-content assertions, production download bridge, timer cadence, health predicates and update/rollback gates. Release intent revision 2 requests a fresh publication of the same still-unpublished preview.32 after exact-head PR validation and merge. Require successful merged-main validation plus anonymous feed, tag and downloaded-asset verification before announcing availability.

## Preview.32 candidate: integrated switchport workspace and short local routes

Prepared from published preview.31 at 2a49a7b03e2a76e1ebab2309a6815546e1007c44. That baseline passed PR validation 42440144664 and main publication 42440723348, and its public tag/assets/feed were verified. Standing build/release authorization continues. Preview.32 must pass exact-head Windows/native validation and merged-main publication, followed by anonymous feed and downloaded asset verification, before it is described as published. Do not restart or replace the user's running application.

The reusable Switchport Diagram Builder 1.18.5 engine is pinned to 2327083bcd4301db1cc7c162a764540190c5d7ad under desktop/SwitchportReports. It retains all source parsers, verified hardware/modules, palette rules, report layouts and standard outputs. The browser uses the generated catalog and matching report model, palette and measured scene modules. The common interface adds report options, per-device/member/module details, shared VLAN/LAG colors, logo normalization, selected supplementary evidence, grouped page navigation and one export menu. A report request pins the browser's resolved palette before native export. Both output paths operate on normalized inventories; raw source configuration and command files remain transient. The integration matrix documents exact source coverage and the deliberate use of the existing NDS project/update workflow.

Switchport sheets reserve their own headers, symbols, keys and footers. buildPages applies ordinary edits and uniform drawing scale without adding another footer or changing font sizes after packing. Port numbers are outside sockets, at least 8 scene pixels (6 printed points); dense stacks may compact geometry while retaining marker and text limits. Generic port maps and wireless sheets likewise reserve external number bands, with a vertical fallback and bounded width retries. Failed formats retain inventory/validation files and other successful devices. Native cancellation or all-failed exports retain the previous successful export paths.

Automatic routing prioritizes physical clearance and separate painted strokes, then short viable distance, with crossings and bends as secondary preferences. Search rails are local to endpoint pairs. Up to eight additional candidates come from actual gaps between occupied rails, so saturated fixed samples do not force an opposite-side detour. Endpoint orientation follows the moved peer, modular leads choose available center or outside corridors, and cable gaps include actual saved stroke widths. Caption reserve is measured before layout so retries do not move untouched equipment. Draft-page caching reuses unrelated planners, and device-edit validation passes its accepted scene into the redraw instead of rebuilding twice. Changing tabs uses accepted pages directly.

Import identity reconciliation joins a configured short hostname with one unambiguous FQDN observation while preserving explicit configured identities and separate domains. The two supplied firewall data uplinks are retained; alternate HA-interface observations stay in review but do not draw duplicate data cables. Supplementary sources remain independently selected and are merged/patched by source identity, so toggling one does not discard a later import.

Local verification passed 287 Node tests and 72 native report checks. It includes offline HTML operation, project save/reopen, responsive page/report controls, the eight per-device report outputs and shared files, rendered PDF/PNG inspection, explicit 300 dpi PNG metadata, selectable embedded-font A4 PDF text, and a real browser request rendered by the native engine. Nine fictional Visio packages include the new editable switchport booklets and pass the independent relationships/units/geometry checks; the seven damaged-package rejection tests pass. Native library tests cover parser/catalog/workspace/RouterOS and export contracts. The Windows build and single-EXE lifecycle harness must additionally verify bundled Skia, font and catalog extraction, the report bridge, and the existing update/rollback/health behavior on disposable CI. The three-run private moved-layout median improved from 1493 ms to 355 ms and total cable length fell 27.2%; scoped and adjacent medians improved from 3130/1335 ms to 325/123 ms. All three current 15-cable scenes had no endpoint, orthogonality, unrelated chassis/module, or painted parallel-overlap errors. Perpendicular crossings can increase rather than force large detours. Browser package directory suffixes are allocated case-insensitively until unique, preserving all files even for colliding names. Customer inputs, generated private pages and benchmark artifacts remain outside git. Direct opening in desktop Microsoft Visio remains unverified.

Useful commands in addition to the normal gates: run the tests/switchport-native project in Release with a scratch output directory; its --catalog option regenerates src/web/reports/catalog-data.mjs. scripts/build-windows.ps1 includes the native report gate before publication. The offline build rewrites static and literal dynamic module imports, so the local PDF fonts load without a server.

## Preview.31 candidate: visible placement tools and modular routes

Prepared from published preview.30 at 4b991017c05365570a55937043247399cd290b41. Preview.30 passed PR validation 42434627316 and publication 42435297179. Standing build/release authorization continues. Require green exact-head Windows/native validation, merged-main publication, and verification of the public feed and downloaded assets before announcing this candidate.

Place beside is an always-visible row in Edit drawing. Direction controls work with an existing selection or a two-click moving-device/reference workflow. Escape and Cancel leave geometry unchanged. Fixed body gaps replace incident-link-dependent padding. A bounded search considers both outward and perpendicular adjustments, tests individual selected bodies rather than their union, and rejects a blocked local placement. Every other non-plug device, including inferred handoffs, receives a zero-delta position patch before routing so retries cannot repack the reference. Presentation inverses, one-step undo and current zoom are retained; viewport transforms compensate changes to the dynamic SVG origin.

The modular renderer exposes the actual two-dimensional bay boundaries and management obstructions for supported six/twelve-slot HPE chassis. Known socket leads turn within their own module and use bounded center rails; exposed edge sockets leave directly, and center overflow uses a verified clear outer side. Track reservations avoid merging strokes, with a capacity error when a resized module cannot fit separate leads. Internal text obstacles use painted bounds. Core and wireless share endpointLead/planModuleEscapes; custom artwork, unconfirmed modules, native stack gaps and explicit saved cable edits retain their behavior. Exterior fans share actual inter-device gaps, with early capacity checks independent of page bounds and a clear straight-facing exception. A blocked route may use the connected pair's exterior when a wider neighboring device would otherwise create a body intersection.

Local gates passed 233 Node tests, eight independently checked Visio drawing/stencil packages including the twelve-page modular fixture, seven damaged-package rejection tests, the repository guard and offline web build. Focused checks cover the eight-link A/C/E/F example, five distinct center rails, direct E7/E8/F8 exits, both chassis columns, modern/classic six/twelve-slot models, scaling, center overflow, unknown/custom hardware, wireless routing, glued endpoints, saved manual bends and negative-coordinate compact gaps. All twelve actual-browser cases passed with zero runtime errors: persistent controls with no selection, selection-first placement, all directions, spacing and presentation scale, rigid groups, unchanged devices/handoffs, preserved reference screen coordinates and zoom across negative origins, blocked rejection without history changes, undo/redo and save/reopen. The browser-downloaded twelve-page Visio drawing independently passed relationships, stroke units and port-glue checks. The dense two-move Below case safely rejects Compact when readable port labels cannot fit and succeeds at Extra room; do not remove text/collision checks to force the smaller gap. Fictional README screenshots were refreshed and inspected. Final exact-head Windows/native validation and public release verification remain required before announcement. Customer screenshots and configuration data remain outside the repository. Direct rendering in desktop Microsoft Visio remains unverified.

The first preview.31 PR run (42438880652) passed build/package checks but failed the native Shift-drag screen-position assertion before placement. A controlled regression exposed delayed toolbar ResizeObserver callbacks refitting or rebasing a gesture after pointerdown; editable pointerdown now freezes the visible view and refreshes its canvas rectangle. Two focused regressions retain exact screen movement and zoom with observer delivery before/after first movement. The native gesture starts at a bounded point inside its intended body and verifies the hit target, because a fit-to-page faceplate can be shorter than the old fixed five-pixel offset. Its axis thresholds remain unchanged, and failures include position, viewport, scroll and feedback diagnostics. A fast-input browser reproduction additionally found native scroll offsets inside the transform-controlled canvas. Active diagram overflow now clips without creating a scroll container; focused A/B runs remove the screen-axis jump while keeping scene geometry unchanged. Native target measurement waits for two animation frames after scroll/layout, preserving real pointer input and the original assertions. Final-head native validation remains required.

## Preview.28 candidate: direct placement, scaling and physical connection cleanup

Prepared from published preview.27 at d35ced3dcfe8806b8bdddc0c8b0b036c9aa40f90 (PR #24; exact-head run 42427063798, publication 42427690643, public downloads verified). Standing build/release authorization continues. Require exact-head Windows/native checks and merged-main public asset verification before announcement.

The native run exposed an automatic refit when the move feedback changed height in a narrow window; object dragging now preserves the current zoom and compensates viewport offsets for toolbar/status reflow. The native input regression retains strict screen-coordinate assertions after the resize observer settles. Shift-drag now locks every object, and modified clicks cannot open the native double-click editor. The editing toolbar exposes Place beside, Move to page, quick +/- sizing and a scope-aware percentage dialog; alignment buttons are grouped. Placement keeps selected devices together and avoids other device envelopes with cable clearance. Page moves retain off-page references and stable identities; all changes use validated history. Transparent 16-pixel SVG cable targets improve picking without changing export thickness. Native lifecycle coverage now exercises real Shift input, resizing, placement, page moves and Undo on the disposable runner.

The customer screenshot also exposed two data-presentation defects. Large MAC lists were being printed literally; default captions now show counts, while Device details and the optional full-list panel retain all addresses. Logical VLAN/aggregate/subinterface neighbors were also drawn as physical cables and counted as conflicting port occupants. Shared physical-link classification excludes these observations from core/wireless routing and physical occupancy conflicts while retaining evidence, data tables and connection review. Unknown physical interface names still receive boundary anchors. Generated handoffs allocate indexes above every retained observation index after filtering; port-module selections do not enable whole-device placement. Routing penalizes parallel gaps below six scene units. Config Inspector already bundles the five NDS faceplate modules through scripts/sync-nds-faceplates.py (its inspected bundle references dee1004); those module sources are unchanged by this update.

Validation: 217 Node checks, seven damaged-package checks and independent fictional/private Visio package/glue checks passed locally. Actual Edge input verified Shift selection, both drag axes, a cable picked six screen pixels from its line at multiple zooms, scaling/Undo, side placement, all-page resizing, named-page moves, off-page labels and reopen. The nine supplied files produce 75 inventory devices / 129 observations, initial scope 35 devices / 84 observations, 22 pages and one core. Its core routes improve from 29 cables / 21 shared segments / 106 crossings / 120 bends to 13 physical cables / zero shared segments / six crossings / 48 bends, with zero unrelated chassis intersections and overlapping labels. There are 51 import notes after removing false logical-port occupancy conflicts. Customer inputs/captures remain outside git. Local native test-host compilation passes; lifecycle tests must run only on disposable Windows CI.

## Preview.27 candidate: complete dense imports on a dynamic canvas

Prepared from published preview.26 at 520333000334d95ba7f60024ae5cab33a0c843b3. Preview.26 passed PR run 42423733842 and main publication run 42424372050; its public feed and downloaded assets were verified before announcement. Standing build/release authorization continues. Require exact-head Windows/native validation, merged-main publication and anonymous feed/download verification before announcing preview.27.

A reported nine-file import parsed successfully but failed during core media-label placement. Dynamic retries increased vertical spacing while keeping parallel cable rails only 12 units apart. Cable placement now reports its measured caption clearance; dynamic core retries reserve that rail pitch and the horizontal space it needs. The retry cache includes the new clearance, and existing fixed-paper fitting remains unchanged. Full-batch validation also exposed a wireless caption check that still imposed a fixed height on dynamic pages; dynamic bounds now include those complete captions.

Local reproduction used the supplied files without adding customer records to git. All nine files produced 75 inventory devices and 129 links, with 35 devices and 84 links in the initial site scope. The reported input order built 42 pages, with one core page; alphabetical input order built 43 pages because grouping/order differs. Actual browser import, enabled export and save/reopen passed. Public regression fixtures use fictional parallel stack uplinks and long wireless captions. All 209 Node tests pass, including readable complete captions at 100%, 150% and 200% text scale, collision checks, stable save/reopen and attached endpoints. The private 42-page Visio export and new fictional exports receive the independent package/glue check. The native lifecycle harness stays on the disposable Windows runner, not the user's live profile.

## Preview.26 final report-panel scope correction

PR #22 passed exact-head Windows/native validation (run 42422595633) and merged as dee1004f1edf13a06379a278a6c906535c66d771. Its publication run 42423183546 was cancelled before publishing after final review found that automatic report information panels could include devices from other sheets. This follow-up carries page device identities through port maps, wireless/unlinked tables, logical sections and trunk matrices. Custom report selections remain explicit. Explicit network-page selection also clears a prior core-only exclusion; editing other page settings retains membership of globally hidden devices. Browser coverage verifies both behaviors. Page aliases also preserve an explicit manual drawing-heading text override. All 207 Node tests and the browser workflow pass. The preview.26 intent revision is now 2 to request a fresh publication of this corrected, still-unpublished version. After exact-head validation and merge, the intent change triggers release.yml on main; verify the final merged tag and public assets. No preview.26 release has been announced or installed.

## Preview.26 candidate: flexible pages and connector geometry

Prepared from published preview.25 (1dd74473109a6db88f3f285c5d373777e66e76a5) on feat/flexible-diagram-layout. The new Pages & layout editor separates display names from edit identities, adds selected-device custom reports, page visibility, drawing/device/text scales and selectable/scalable information panels. Source report keys include their report ID; shared styles and cable anchors remain intact. Global drawing and panel transforms carry inverse edit coordinates. Table-only sheets expand spacing with text. Imported artwork and manual port maps remain authoritative.

The user also reported the dynamic-canvas device-title capacity error while changing included devices. Increasing page dimensions alone could not free a blocked title's nearby candidate positions. Dynamic title placement now searches obstacle edges and can reserve an outside column; final canvas bounds expand without splitting the assigned devices. Fixed-paper continuation remains unchanged. Dynamic module descriptions also remain on the growing page.

Connector artwork uses common type-specific envelopes after chassis/module/stack assembly. Centers, numbering, aliases and orientation stay fixed; three-row QSFP records no longer collapse rows 1 and 2. Catalog tests cover 321 profiles and over 9,800 sockets, including no overlaps. See docs/FLEXIBLE_LAYOUT.md for primary model references and the limits of illustrative geometry.

Local validation passed 206 Node tests, seven package rejection tests, the Windows build and release policy/cache checks, actual browser save/reopen/resize/export and sidebar interactions, and independent validation of scaled and browser-exported Visio glue. Validation includes new scene, save/reopen, alias, custom report, scaled text, panel and inverse-edit regression tests; browser interaction checks; native Pages & layout/Undo coverage; and a scaled Visio package with independently checked glue. Require exact-head hosted Windows/native validation, merged-main publication and anonymous release/feed/hash verification before announcing preview.26. Standing build/release authorization continues. Do not restart the user's running app or claim unsaved diagrams survive installation.

## Preview.25 candidate: restore sidebar device ordering

Prepared from published preview.24 at f717ca6df0f2a6cc2fb90ce70e155b4007137903 on fix/sidebar-device-order. Preview.24 accidentally stopped calling addOrderControls for sidebar device rows while adding Delete. Restore that shared handler, keep the drag cursor, and put Up/Down on a second row so all controls and device details fit the sidebar. The arrangement dialog continues to use the same behavior. Dynamic canvas, deletion and printing are unchanged.

Browser validation exercises real mouse dragging, Up/Down, Undo/Redo, save/reopen, filtering, excluded devices, Delete/Undo, Clear all/Undo and arrangement-dialog ordering. Native regression coverage now checks the sidebar buttons, drag/drop event flow and Undo before the existing arrangement checks. Keep dialog selectors scoped now that both lists have ordering controls. README screenshots use the fictional sample site. Run node scripts/check-repo.mjs, node --test and node scripts/build-web.mjs; require exact-head hosted Windows validation, merged-main publication and public download verification before announcing preview.25. Standing build/release authorization continues; the app still asks the user to install and restart.

## Preview.24 release candidate: dynamic canvas and device inventory

Prepares preview.24 from published preview.23 on feat/dynamic-canvas-devices. The user requested availability in the app updater. Publish through the existing intent-gated PR and main workflow; require the exact-head Windows validation and merged-main publication to succeed, then verify the public feed and downloaded assets before announcing availability. The Windows updater continues to use the existing release feed.

The drawing preset now defaults to dynamic, while explicit saved paper sizes retain their old behavior. Core packing keeps a named or automatic group on one page, measures complete devices and connections, and expands route clearance without reducing device width. Final bounds include nested objects and manual negative positions. SVG uses the actual viewBox origin; native Visio normalizes an export-only copy. Print paper is separate, with whole-page fitting in CSS and Visio. Other documentation views retain their semantic grouping.

Device list rows show identity, type/model, IP and direct Delete. Clear all confirms the total inventory, independent of filtering. Undo and evidence tombstones restore/preserve the expected inventory. Explicit WAN handoff deletion suppresses the corresponding inferred handoff. Fixed-paper tests now explicitly select the original paper preset.

Validation commands remain node scripts/check-repo.mjs, node --test, node scripts/build-web.mjs, scripts/export-test-fixtures.mjs and scripts/check-visio-package.py. Added coverage includes 100 devices on one named page, a 24-link hub, negative/outside object bounds, print-size independence, Visio fit settings, delete/clear history, evidence recomposition and handoff suppression. Browser checks cover deletion, filtered clear/cancel/undo, default canvas and saved print settings. Final local validation passed all 195 Node tests, seven independent package rejection tests, five Visio drawing/stencil package checks including negative canvas coordinates, Windows release policy/cache/binary checks, and the actual browser workflows. Chromium PDF output was verified as six Letter pages and one full-size dynamic page. Direct desktop Visio rendering was not exercised. Hosted native install/rollback validation must pass before publication. The native page-setup check now verifies the dynamic default and independent print paper, then exercises the retained fixed-page mode; ordering is tested through Device order / Core pages.

## Preview.23 polished update review

Prepares 0.1.0-preview.23 / file version 0.1.0.23 from published preview.22 at 30867b32f8b95952091185b3756ad72671266588. Preview.22 passed PR #18 Windows run 42408150968 and merged-main publication run 42408769625; the public feed, tag, downloaded checksums, Windows version/icon and 62 offline modules were verified. Standing build/release authorization continues. Require exact-head Windows success, merged-main publication and verification of public downloads before announcing preview.23.

The update review follows the supplied Configuration Inspector example: a clean white header, compact version labels, a softly tinted release card, formatted headings/bullets/emphasis, recovery statements and a pinned action footer. Only the central content scrolls in small windows or for long notes. Native progress does not rebuild the notes or replace focused buttons. Remote release text stays inert, including HTML-looking content and links. The shared dialog close target stays visible; other dialogs reset the scoped styling. The existing native final save/restart confirmation, busy guards, update cadence, feed, verified binary handling and rollback remain unchanged. Unsaved diagrams are explicitly not claimed to be restored.

Validation passed all 188 Node tests and direct browser tests for available/checking/error/downloading/verifying/ready states, downloads and install actions, busy guards, safe remote notes, fixed-footer geometry at 1366x900, 1366x768, 720x520 and 390x640, long-note scroll/focus retention, close/Escape, and opening other dialogs afterward. The README uses an actual application capture with fictional release data. Final Windows and publication checks remain required.

# Development handoff

## Preview.22 configuration recognition and physical layouts

Prepares 0.1.0-preview.22 / file version 0.1.0.22 from published preview.21 at 02fdc97b8b0b354b968841061680e25c6addb574. Preview.21 passed PR #17 exact-head Windows run 42405022809 and merged-main release run 42405681501 after isolating the rollback fixture's feed cache. Its public assets, PE version/icon and offline modules were verified and both existing downloads refreshed. Standing build/release authorization continues. Require green exact-head Windows validation, merged-main publication and public asset/feed verification before announcing preview.22.

completeConfigHardware separates family inference from exact identity. Full interface signatures plus platform evidence produce family-layout metadata and a visible Model hint; declared identities supersede family records regardless of import order. A partial or conflicting signature does not assign a layout. researched-layouts.mjs refines geometry without rewriting inherited source snapshots. PL-family optical cages do not claim an SFP speed. Confirm 2920 rear cards and Cisco X2/TwinGig adapters before assigning their exact sockets.

Corrected compact Aruba and full-size bank spacing, 6200F management placement, FortiGate 201G top/bottom orientation, 5400R proportions and module anchor namespaces. Unknown members use an editable labeled role symbol and retain panel boundaries. Chassis/module details remain native geometry in SVG/Visio. Native data-port drawings do not claim calibrated rear management, modem or USB anchors where unavailable. Family inference does not upgrade existing saved sources until reimported; selecting a known model manually also resolves it.

All 32 readable private configurations built and rendered. A README and a renamed MikroTik binary backup were rejected with guidance. Raw inputs and private captures are outside git. Public screenshots and regression tests are fictional. Local checks cover 187 Node tests, seven Python tests, five independently checked Visio packages and actual-browser import/edit/undo/redo/save/reopen/export. Direct Microsoft Visio rendering remains unavailable. See docs/HARDWARE_RESEARCH_22.md for manufacturer references and remaining model/module limits.


## Preview.21 shared hardware scale and measured port-map pages

PR #16 passed Windows run 42403548422 and merged at 2b63304b7d6933a360e7b0a64c67935d7f6e0419. Its main release run 42404254805 passed native UI/print/timer checks and unhealthy-update rollback, then failed before the final simulated install obtained an offer. The restored real window can save a live-feed retry/rate-limit pause into the disposable profile, which the deterministic fixture then reused. Run-Install now removes only that unrelated feed cache. The final test deliberately seeds a future rate-limit pause first, proving isolation; NativeSmoke requires exactly one fixture check and reports full diagnostics if no offer exists. Settings, release policy, real automatic timings, verified download, readiness and rollback remain unchanged. No preview.21 tag or release was published. This follow-up renews the same unpublished intent and still requires exact-head PR and merged-main Windows success before publication.

Prepares 0.1.0-preview.21 / file version 0.1.0.21 from published preview.20 at 6bce02b63e1afb9c684984a12cd4d6b6d9f61a05. Preview.20 passed PR #15 Windows run 42400472883 and merged-main publication run 42401174729. Its public feed, actual asset hashes, PE version/icon and offline modules were verified, and both existing downloads were refreshed. Standing build/release authorization continues. Require green exact-head Windows checks, merge, merged-main publication and public feed/asset verification before announcing this release.

Port maps and wireless still fitted hardware into fixed-height boxes after core pages had adopted a shared width. equipment-layout.mjs measures complete artwork at a common width and produces member-range views for native stacks. Port maps try three bounded shared scales, select the fewest pages and prefer larger hardware on ties. Measured captions, bodies and keys precede table packing. Oversized keys and detail records continue; grouped, expanded, individual-row and repeated-panel options follow the same rules. Original inventory identity is retained, while continuation edit scopes and Visio masters identify their member range. Native physical ports plus actual panel anchors assign wireless links to members, including LLDP-only interfaces. Generic compact core symbols now follow the same paper-dependent scale as the stack.

Explicit saved geometry remains authoritative. Single imported-image stacks cannot be divided into members. Table fonts keep existing readable limits; port-number overlays below eight scene units remain omitted with complete table records retained. The private reported chassis/five-member/eight-member example now uses a common 720-unit port-map width with six port-map sheets and all 397 supplied physical port records retained. Customer fixtures and captures remain outside git. Public screenshots use fictional equipment only.

Local coverage: 180 Node tests, seven Python damaged-package tests, synthetic VSDX/VSSX packages, actual browser editing, undo/redo, save/reopen and a five-page downloaded VSDX. Mixed-size print PDF page boxes match requested paper within one point. Regression tests cover chassis/stack aspect ratios, shared widths through all port-table modes, reorder, Letter/A3 paper, member-local wireless endpoints, LLDP-only ports, complete records, bounded text and isolated saved edits. README screenshots were refreshed and inspected. Hosted Windows checks remain required on the final head. Direct Microsoft Visio rendering and physical custom printer forms remain unverified.

## Preview.20 paper-aware layout, stack continuation and update review

Prepares 0.1.0-preview.20 / file version 0.1.0.20 from published preview.19 at 31671881d45c0b0f035023b313569cbbcc54c235. Standing authorization covers build and release. Require green exact-head hosted Windows checks, merge, merged-main publication, public feed/asset verification and refreshing both existing downloads before announcing publication.

The reported failure contained an eight-member imported stack. Core packing previously treated it as indivisible at default member spacing. Bounded padding retries now tighten only gaps; larger native stacks can continue by member range at a common paper-dependent hardware width. Member-local endpoint filtering and remote reference lookup retain the original inventory identity. Master keys include member subsets and gap geometry to avoid conflicting Visio masters. Imported single-image stacks remain indivisible and can require larger paper.

Page options stores default paper and per-family overrides in layout.pageSetup. Presets cover Letter, Legal, Tabloid and A5-A1, plus custom 148-1500 mm dimensions. Scene units remain 96 dpi, not a final bitmap scaling operation. Core/sidebar/label bounds, tables, wireless banks, trunk matrices, headers and footers use page geometry. Text wraps before pagination. SVG viewBox and size, named print pages and native Visio drawing dimensions agree. Standard PaperKind and PrintPageOrientation cells follow Microsoft documentation; custom printer forms remain printer-dependent. Existing explicit edits and original-size projects are retained. Small faceplate overlays below eight scene units are omitted; complete table records remain.

Updater review uses safe DOM text for remote release notes, version cards, progress, verification and ready-to-install states. A compact conditional editor banner replaces the old native strip. New bridge commands call guarded native download/install methods. Existing final save/restart confirmation, automatic check cadence, readiness predicate, checksum/PE verification and rollback are unchanged. Reference implementations reviewed: Configuration-Inspector webview/updates.js and network-toolkit web/assets/app-updater.js.

Local checks: 176 Node tests, seven Python tests, four synthetic VSDX/VSSX package checks, real browser paper selection, mixed page families, invalid-input rejection, save/reopen, undo/redo, 1366x768 dialog fitting, updater actions/progress/busy guard and the private reported stack import. A seven-sheet mixed-size PDF was measured: A3 landscape plus Letter portrait sheets match requested dimensions within one PDF point. README screenshots contain fictional sample/release data. NativeSmoke checks paper setting round trips and conditional HTML updater notices on Windows. Final-head hosted Windows validation remains required. Direct Microsoft Visio rendering and physical custom printer forms remain unverified.

Microsoft print references: https://learn.microsoft.com/en-us/office/client-developer/visio/printpageorientation-cell-print-properties-section and https://learn.microsoft.com/en-us/office/client-developer/visio/paperkind-cell-print-properties-section .

## Preview.19 device identity, consistent scale and local search feedback

Prepares 0.1.0-preview.19 / file version 0.1.0.19 from verified published preview.18 at 86d54dfe3851b2b14a5546db4b3c9158afa156cf. Standing authorization covers the build and publication. Require green exact-head hosted Windows validation, merge, merged-main publication and verified public feed/assets before reporting release completion. Publication and required-input notices must be bold and obvious.

The shared device-details module formats manufacturer/model, platform, IP and normalized known MAC addresses. Wireless model/MAC captions have bounded stable keys and measured full text; core and port-map summaries share the details. Device/interface forms validate readable address input and support clearing legacy aliases. Report imports retain device/interface addresses; operational parsing distinguishes local system/interface identities and LLDP chassis addresses from learned ARP/forwarding entries. No hardware identity is fabricated. Caption edits and manual data corrections survive reload and evidence recomposition.

Core drawing now preserves a common 700-unit faceplate width and profile/artwork aspect ratio. It no longer fits tall devices into a fixed-height box or scales a whole sheet down to fit. Bounded padding/sidebar/rail attempts precede continuation. Explicit saved geometry remains authoritative. Named groups can continue, keep their corePageId and off-page preferences, and any rendered sheet can be a placement target. Four- and five-member stacks and a modular chassis retain equal widths on separate sheets. A device too large for a single page at its chosen size can still require an explicit user size edit.

WebView2 disables its default context menus and the browser app suppresses contextmenu events. Local stencil discovery now names its selected-vendor-file scope and explains empty folders, filename filters and missing masters. No internet stencil search was added.

Validation: 171 Node tests and seven Python damaged-package tests pass. Four synthetic export packages and the actual five-page browser export pass the independent Visio validator. Actual offline browser UI checks cover eight APs with model/MAC captions on one page, malformed/normalized MAC input, inline editing, undo/redo, save/reopen, Visio download, a printer with identity details, existing/new page assignment, full-size chassis pagination, context-menu suppression and local stencil feedback, with no page errors. README screenshots use fictional fixtures only. NativeSmoke adds a device-address round trip and WebView2/DOM context-menu assertions. Final-head hosted Windows checks remain required; direct Microsoft Visio rendering is unverified.

## Preview.18 adaptive keys, grouped routing and preserved stencil points

Prepares 0.1.0-preview.18 / file version 0.1.0.18 from verified published preview.17 at 925cdd59fe07615d16326daf68a9974c6c25eed6. Preview.17 passed PR #12 and merged-main Windows validation; its feed, actual asset hashes and both existing downloads were verified. Standing authorization covers this build and release. Require green exact-head Windows validation, merge, merged-main publication and public feed/assets verification before claiming preview.18 is published. Make publication, waiting-on-user and required-input notices bold and prominent; the user now allows emojis for emphasis.

Core layout adds narrower sidebar profiles after the original spacing attempts. Shared sidebar geometry supplies body/title/route boundaries, wrapping and bounded legend/module scaling. Caption font floors and cable/legend weights are preserved; explicit sidebar geometry retains full width. A dense synthetic eight-device case fits four devices on its first page instead of three, keeping all connections and labels clear. Existing six-order and capacity regressions remain green.

VLAN/routing records now form measured device sections. Whole sections stay together when they fit a fresh page; oversized sections repeat their device/column headings. Long individual records continue without ellipses. Stable bounded device/record edit keys survive page/order changes, and legacy table caption/style edits are read without changing project data.

Visio connection rows are extracted before normalization. The shared world transform and bounds cover named/unnamed points, grouped rotation/mirroring, zero-height wrappers and points outside the artwork. Distinct duplicate names get separate neutral suffixes rather than averaging coordinates or choosing an arbitrary alias. Generic Row names defer to useful prompts. Manufacturer naming maps retain unused rows too; imported point positions now come from the stencil rather than a hard-coded FortiGate x3 coordinate override. Built-in physical hardware profiles are unchanged. Legacy XML preserves deleted-row flags, and the picture-only binary reader includes child points. Missing coordinate caches fail visibly; inherited/formula-only or unsupported binary/vector masters may still need conversion in installed Visio. The optional PowerShell raster hardware-pack path still requires manual mapping; normal app conversion uses VSSX and retains connection rows.

Local validation: 162 Node tests, seven Python damaged-package tests, four synthetic VSDX/VSSX packages, the actual nine-page browser export, source/offline app loading, inline edit/save/reopen, modern and legacy stencil imports, mapper persistence and native stencil export/reimport all passed. Imported normalized coordinates agree through the native round trip within 0.00001. Actual UI screenshots show three device sections sharing a page. Final hosted Windows validation remains required. Direct Microsoft Visio rendering and arbitrary third-party collections are not verified.

## Preview.17 core page fitting across device orders

Prepares 0.1.0-preview.17 / file version 0.1.0.17 from published preview.16 at 8bcb7cd809dfe66ff825e505c64085b5359eedd8. Preview.16 passed PR #11 and merged-main Windows checks, and its public release/feed/asset hashes and both existing downloads were verified. Standing build/release authorization continues. Require green exact-head Windows checks, merge, merged-main checks and public asset/feed verification before claiming preview.17 is published.

A synthetic reproduction of the reported FortiGate/two-switch/two-WAN topology split only when the downstream switches were reversed: a media label was trapped between parallel rails, although the equipment fit. Core layout now tries normal and wider rails at three bounded padding levels, including the existing compact/spread handoff alternatives, before automatic continuation. Text sizes, saved order, manual geometry and explicit page assignments remain authoritative. Coarse packing uses an optimistic minimum-body/padding bound; actual body, route and caption validation decides capacity. Overflow owner/handoff groups prepend to the next compatible automatic sheet. Successful sheets are reused only while all layout/reference inputs remain unchanged. Continuation badges now sit beyond passing rails, with existing behavior retained for deliberate off-page edits.

Tests cover all six device orders on one page, denser chains, grouped continuation with all connections preserved, collision/orthogonality checks, named pages, saved edits and native Visio connections. Browser QA loads the reversed topology, verifies one core tab, edits a title, saves/reopens and exports the actual VSDX. The independent package validator accepts that five-page export; offline loading also passes. The fictional README hero is refreshed. Existing extreme-anchor memory/time protection remains tested. Direct Microsoft Visio rendering remains unverified.

## Preview.16 Configuration Inspector-style port modules

Prepares 0.1.0-preview.16 / file version 0.1.0.16 from published preview.15 at 5166bf1d2c7dfc41b95eb810efd1be5d4fedcb32. Preview.15 passed PR #10 and merged-main Windows validation, and its public release/feed/asset hashes and both download replacements were verified. The user's standing build/release authorization continues. Require green exact-head Windows checks, merge, merged-main checks and published asset/feed verification before claiming preview.16 is published.

Compared the supplied module-key screenshot with the current Configuration-Inspector webview/diagram.js drawing primitives. Built-in optic faces now use gray metal, two dark receptacles and a border matching the configured media color. DAC ends use a dark face and a horizontal insert. The legend adds a light framed surround while the physical port overlay keeps the unframed face. Both remain native editable groups. Framed legend and unframed port masters are distinct, as are optical reaches and DAC variants. Local selected artwork remains authoritative. This is a visual change, with no new hardware/media inference.

Child editSlot retains the previous body/receptacle indices when the key inserts its frame. Legacy shared SFP key edits are applied as read-only aliases to the remaining relevant category. Tests cover retained edits, custom artwork/anchors, media color separation, native Visio children and glued endpoints. Browser QA double-clicks the frame, changes its name, edits text, saves/reopens and exports a native Visio file; offline loading and full captions also pass. The fictional README hero was refreshed and inspected. Windows validation is required on the final head. Direct Microsoft Visio rendering remains unverified.

## Preview.15 compact WAN/circuit layout

Prepares 0.1.0-preview.15 / file version 0.1.0.15 from published preview.14 at cf51ed1f6524463b9d373519c85fb5f2cce2d8a4. Preview.14 PR #9 and merged-main Windows validation passed; the public tag, feed, EXE/ZIP hashes and embedded version/icon/source were verified. Its two existing download files were updated. The user authorized building and releasing this additional layout change. Require green exact-head Windows checks, merge, merged-main checks and public asset/feed verification before describing preview.15 as published.

WAN cards measure complete provider/port/gateway captions, with font-substitution allowance, and use their owner's actual body width. Compact rows stay inside the stack span; narrow bodies use extra rows. A lone card aligns with a known top-facing physical port when possible. Page measurement uses the same body width and scale as rendering. Routing considers internal card corridors and tight actual-body exterior bounds while retaining collision, shared-segment, crossing, bend and length priorities. If compact rows cannot accommodate cable labels, a bounded retry spreads the same narrow cards within the available stack width before automatic continuation. Deliberate position/size edits remain authoritative.

Local coverage includes one through seven WAN circuits on one core page, full wrapped captions, label/body/path clearance, single straight routes, internal corridors, narrow panels and explicit card edits. Browser checks load two/four/long-name cases, edit provider text, save/reopen, download Visio and open the offline build. The fictional main screenshot is refreshed. Windows validation remains required. Eight tightly packed circuits can still exceed readable label capacity, as in preview.14; do not claim unlimited density. Direct Microsoft Visio rendering remains unverified.

## Preview.14 conditional update bar

Prepares 0.1.0-preview.14 / file version 0.1.0.14 from published preview.13 at 1ba5419937d5fa503a146cb7fe2a35a4adafbc60. Preview.13 passed PR and merged-main Windows checks and its public tag, feed and asset hashes were verified. The user authorized building and publishing this UI adjustment. Require green final-head Windows checks, merge, merged-main checks and public asset/feed verification before describing preview.14 as published.

The native update strip starts hidden and is visible only when Updater.Offered contains a detected newer release. WinForms docking returns the space to WebView2. Help in the existing web header opens the installed version, check progress/result, manual Check updates, Update details and Notices. These controls are desktop-only; the offline browser edition and its documented screenshots remain unchanged. A host update-state message refreshes this dialog without replacing the project or drawing. Automatic lookup cadence, retry rules, verified downloads and separate installation consent are preserved. A transient lookup failure retains an existing offer; a successful check with no newer release hides the strip.

NativeSmoke checks full editor bounds with no offer, Help progress/results, offline failure, a newer release, failure with an existing offer, and offer removal. It still exercises real timer/focus checks, exports, update installation and rollback. Browser checks use the production injected bridge with a synthetic host to verify Help actions and desktop-only visibility. Direct Microsoft Visio rendering remains outside this change and untested here.

## Preview.13 shared connection editing, hardware and trunk density

Prepares 0.1.0-preview.13 / file version 0.1.0.13 from published preview.12 at 0d69e2bc82845524ea9459a85573252c1ae020a3. The user authorized building and publishing without another confirmation. Preview.12 PR #7 and its merged release validation completed successfully. This candidate still requires green exact-head Windows validation, merge, merged-main validation and feed/asset verification before describing it as published. Preserve the existing public source/feed, update cadence and separate download/install actions.

Shift constrains cable and bend drags to the dominant axis for each Shift hold. Snapping honors the locked coordinate. legend-connections.mjs prepares atomic shared cable-type/speed edits, including preset/custom values, mixed-field retention, inferred handoff materialization and patch migration. Metadata updates refresh direct cable-detail overrides while retaining their geometry/text appearance. Destination-class links keep their own metadata. Legends summarize actual used speeds after configuration. The swatch geometry controls use four compact columns so default and custom-value controls fit at 1366 by 768.

The physical catalog now contains 426 identity/interface records and 314 verified bank profiles covering 423 identifiers. Added eight UniFi switch models, Netgate 2100/4200 and PA-455, with manufacturer references and measured port positions. PA-415 management and ethernet1/1 are distinct combo pairs. Unknown switches/firewalls and arbitrary device roles have editable base symbols, no fabricated anchors. Other role symbols and custom stencil precedence are retained.

Trunk matrices measure heading heights and VLAN row heights, then choose column batches by minimum page count and vertical continuation cost. Short headings can exceed six columns; readable fonts and full values remain intact. The synthetic eight-group, 22-VLAN case fits one sheet; long labels wrap and spill when required.

Local validation covers 139 Node tests, seven Python package rejection tests, four synthetic VSDX/VSSX packages and the actual browser-downloaded VSDX. Browser checks exercise legend preset/custom edits, mixed values, undo/redo, project reopening, the swatch editor, all four Shift bend directions and whole-cable dragging with attached endpoints. Fictional legend, trunk and hardware screenshots were refreshed and inspected. NativeSmoke additionally checks mixed legend values and saved shared type/speed metadata. Direct rendering/editing in Microsoft Visio remains untested here.

## Preview.12 core page and Visio line improvements

This branch prepares 0.1.0-preview.12 / file version 0.1.0.12 on the published preview.11 main/tag commit 5b06d3833b65da96889ee4349b71ab8e347d596a. The user explicitly authorized building and publishing this update. Require green final-head Windows validation before merging, followed by merged-main validation and public feed/asset verification. Preserve the existing public repository, update cadence and separate download/install decisions. Device details exposes a port form and core-page assignment. A current automatic page can be made explicit with its existing device group. Named pages store reference visibility and per-connection exclusions independently of the link inventory. Automatic core pages reserve space around handoffs, try denser packing and move only the last owner group when capacity is exceeded. Labels prefer a parallel segment of their own cable. Rotated text uses its rendered bounds for collision checks and selection. Clear leaders identify displaced captions, and off-page markers repeat the reference label's link number.

Visio exports legend samples using the same 1D shape writer as cables. Matching samples and cables share a line style, with cable stroke cells following the matching legend line on the same sheet. The default line weight is 3 pt. The package validator checks the style references and cached stroke values. Verify rendering and direct legend editing in desktop Visio before claiming interactive Visio validation.

Local checks pass 128 Node tests, seven Python damaged-package tests, four synthetic packages and the actual browser-downloaded VSDX. Browser actions cover invalid VLAN correction, retained imported fields, adding ports and a device, dedicated/existing page placement, and saved project contents. The dedicated-page check found that projects without layout arrays could reject assignment; initialize those arrays on assignment. NativeSmoke now exercises saved port fields and dedicated placement, and selects named pages by label rather than option position. Fictional screenshots were refreshed and visually inspected. The first Windows run exposed a test target outside the scrolled inventory viewport; native target clicks now scroll into view and reopened-device checks require an open Device details dialog, preventing stale closed-form values from passing. The following run passed port/page retention and exposed a legacy test issuing multiple page mutations in one JavaScript task; separate the awaited actions so the UI can complete each save, and select the newly added page by its own name. Require a green rerun on the amended head.

## Preview.11 connection choices, complete text and resilient inventory layouts

This branch prepares 0.1.0-preview.11 / file version 0.1.0.11. The verified published baseline is preview.10 at main/tag c714c8d3172afee22346e05961fe839d0f09cd7b after PR #5, PR run 42278357886 and main publication run 42279593211 both passed. Its actual feed was tested against installed previews .2/.6/.7/.8/.9 and did not offer itself. Both official assets passed API/SHA256SUMS checks, x64 GUI/version/icon/source validation and replaced the two existing download files as version 8. The public source/feed and settings/consent boundaries remain unchanged. The current user requests cover cable/speed selectors, full diagram text, duplicate port wording, expanded endpoint/hypervisor/storage recognition and the disappeared drawing after Add device. Continue the existing authorized PR/merge/publication workflow; final-head Windows validation and actual feed/asset verification are required before completion.

connection-types.mjs exposes independent media/speed presets, custom fields, retained imported values and a bounded single-line metadata validator. Existing link.media/link.speed fields remain the storage format. connectionMediaInfo owns caption/color grouping; new media families do not infer new optic form factors. app.connectionFields is reused by line properties and Configure connection. Changing type adopts its current configured style, while speed-only edits retain manually selected colors. colorPicker's validated setters update the existing controls without losing unsaved name/width fields. saveConnection prepares immutable endpoint/link arrays, migrates drawing patches, preserves same-endpoint manual bends and commits metadata/style/history atomically. prepareConnection checks occupied physical aliases and materializes a selected inferred handoff once. New handoff clones get scopeOverride=true; evidence capture/recompose plus JSON reopening retains their inclusion and manual metadata.

Device roles are shared in device-types.mjs, with friendly UI labels and explicit Auvik Type classification. device-symbols.mjs provides editable generic endpoint geometry without socket anchors. imports/endpoint-hardware.mjs recognizes 43 server/storage/HCI/platform families using bounded label-first matching after existing exact network profiles. The 25 first-party source pages and coverage limits are in docs/ENDPOINT_HARDWARE.md. Concrete model strings, imported NIC records and explicit role choices are retained. Hardware identity is separate from installed NIC/HBA layout and from software platform. The device form offers researched model suggestions, an editable Platform / technology value, family guidance and custom values. Explicitly selected hypervisor/VM roles are not replaced by a physical model's default. Distinct platform text appears in measured core device details.

scene.textLayout retains each complete editable caption value and supplies the same measured lines/fitted size to SVG tspans and Visio newline text. Generated module descriptions use the full sidebar width, measured row heights and additional module sheets if necessary. Project/handoff/wireless/logical/trunk text allocates its complete header/row space. Impossible manual boxes raise a readable error, with no ellipsis fallback. A caption keeps one stable edit key and opens the full value inline. displayPortCaption avoids Port port1 while preserving interface names and existing non-port prefixes. Source cable metadata now includes media/speed/status for generated handoff editing.

The disappearing diagram had two causes: wrapped title boxes were inflated back to the complete unwrapped string width in collision checks, and draw() cleared all pages on any build failure. Title placement now uses measured boxes and emits typed CORE_LAYOUT_CAPACITY errors. Automatic core packing splits owner groups, retains attached handoffs and recalculates continuation references. Read-only aliases retain old unsuffixed edits after automatic repagination. Explicit page assignments report a capacity error instead of moving equipment silently. Device saves validate a cloned candidate before accepting history/model changes. draw() builds before replacing tabs/SVG and preserves the accepted same-project scene on failure; drawingReady keeps stale exports disabled through task cleanup. Undo restores valid layout/settings and export controls. Initial load failures show a layout error rather than an unrelated welcome screen.

Current local validation passes 126 Node tests, seven Python damaged-package tests, four complete VSDX/VSSX packages, actual browser downloads and native test-host compilation. Browser suites verify connection presets/custom values, shared type styles, exact manual-bend retention, peer isolation, generated handoffs, evidence reload, new device creation/role/platform persistence, custom interfaces, undo/redo, save/reopen and failed-edit rollback with no page errors. All-custom line/endpoint forms fit 1366 by 768 without scrollbars. Complete module captions were rendered and edited/reopened in the browser. NativeSmoke now adds a real WebView2 Add device/save/details/Undo/Redo case after existing rejected-text recovery, with no additional timer delay. Both protocols pass the extracted Chromium CDP replay. Hosted Windows execution remains required for the final source head. Direct Microsoft Visio rendering remains unverified.

The first preview.11 PR run 42287506126 at be4147f1aec66c21efd9fe9f9e8eec5ca5dfdc53 passed the browser/build/package steps but timed out waiting for WebView readiness before any native diagram interaction. Test-only startup diagnostics now record host/navigation/bridge state, resource failures and JavaScript exceptions without relaxing health requirements or changing production behavior. Require a green final-head Windows run; the earlier failure is not evidence that device editing passed on Windows.

Use the existing checks: node scripts/check-repo.mjs; node --test; node scripts/build-web.mjs; node scripts/export-test-fixtures.mjs; python scripts/check-visio-package.py .artifacts/visio; python -m unittest discover -s tests -p test_*.py; hosted scripts/build-windows.ps1 and tests/desktop/native-check.ps1. Only fictional screenshots and synthetic fixtures belong in git. User-provided diagrams/configurations remain private outside the repository. Published releases remain immutable.

## Preview.10 editing recovery and reference port maps

The current branch prepares 0.1.0-preview.10 / file version 0.1.0.10. The verified published baseline is preview.9 at main/tag 682057e30ae1ce08a8b0e3ec3a8f222880329350, published after PR #4 and green main run 42270641511. The existing public feed and release destination are unchanged. The active scope fixes the reported unresponsive editor, simplifies color controls, and follows the supplied port-map reference with uniform port-number boxes. Continue the existing user-authorized source/PR/merge/release workflow; require a green hosted Windows check for the exact final PR head, then verify the merged-main release, public feed and immutable assets before reporting publication complete.

Preview.9 could redraw the SVG after rejecting an inline title, detach its foreignObject, and leave inlineSession blocking every subsequent pointer interaction. Validation rollback now restores model state without replacing the valid displayed scene. The draft/error remain attached and visible; Escape cancels regardless of focus; detached sessions are cleared before another interaction. NativeSmoke.CheckEditRecovery uses WebView2 CDP input to reject, correct, cancel and independently edit another object, tests outside-focus Escape and detached-session cleanup, then opens Page options. For users stuck in an older window, keyboard Tab/Shift+Tab to Save project followed by Enter was verified to preserve accepted edits before restarting.

labels.mjs bounds candidate enumeration to visible page coordinates before allocating positions, retaining the previous search order/grid phase. An accepted 12000-unit panel width plus 12000-unit socket offset previously tried to allocate tens of millions of candidates. A bounded 96 MB child-process regression now exercises that case, wholly off-page segments and extreme title widths. Ordinary sample pages were compared against the baseline before the independent port-map changes.

The user subsequently reported thin exported Visio links. The app had three different widths: automatic scene cables 2.2 page units, legend bars 3 and the Edit drawing CSS override 4. Automatic cables now share the 3-unit legend standard, and Edit drawing preserves the actual scene weight. Manual weights remain unchanged. visio.mjs writes every LineWeight with cached inches, U=PT and an explicit point-valued formula, retaining native editability. Do not change cached V to point values: the Microsoft MS-VSDX example confirms V remains internal inches. Independent package checks validate formula/cache agreement. LibreOffice read the old unitless width correctly and shows the new standard width correctly; this does not prove the root cause of the user's Microsoft Visio rendering. Direct Microsoft Visio rendering is still unverified without that viewer and the affected exported file.

Color controls use the native visual chooser, HEX and eleven standard swatches, plus opacity for lines. Spectrum/hue, RGB/HSL numeric fields, named/recent/drawing palettes and screen sampling have been removed in response to the simpler requested UI. Conversion exports remain available to existing code/tests. Picker API value/opacity/remember remains compatible. The outer dialog class and grouped fields keep Link styles, cable, legend-swatch and text properties within a 1366 by 768 window with no default dialog/body scrollbar; verify at 1600 by 900 too. Shared cable/legend updates, naming and independent text colors remain intact.

Compact grouped port maps now place pairs of wide faceplates over a shared assignment matrix, matching the reference hierarchy. Device titles sit near their bodies; summaries show model/address/up-count. The role/state key precedes the navy matrix header and alternating rows. Each switch has its own numeric port-range column. Per-port details, filter behavior, continuation pages and expanded/individual-row options are retained. Keep private input/output outside git. Only fictional screenshots belong in docs/images. Number-box sizing is computed once per panel from all displayed suffixes and available pitch, shared by RJ45 and optical jacks and reused on wireless sheets. Full interface identities remain metadata; panels retain their prior device edit scopes. Scene keys must remain unique when multiple panels share a sheet so Visio master/bitmap lookup stays correct.

Local validation passes 92 Node tests, seven Python damaged-package tests, four complete synthetic Visio packages and the actual browser-downloaded six-page VSDX. The editor-recovery CDP sequence and native test-host compilation pass locally; integrated browser suites pass selection, history, alignment, snapping, cable/endpoint editing, mapper tools, shared styles, colors, page numbers and save/reopen with no page errors. The private reference retains all 104 physical port records in two compact matrix sheets.

Current validation and release commands are unchanged: node scripts/check-repo.mjs; node --test; node scripts/build-web.mjs; node scripts/export-test-fixtures.mjs; python scripts/check-visio-package.py .artifacts/visio; python -m unittest discover -s tests -p test_*.py; and the hosted scripts/build-windows.ps1 plus tests/desktop/native-check.ps1. Direct Microsoft Visio opening remains unverified. Preserve distinct download/install decisions, settings paths and update cadence.

## Preview.9 configuration and physical hardware compatibility

The current branch prepares 0.1.0-preview.9 / file version 0.1.0.9 in response to the additional uploaded configurations and requested port-position/orientation support. Preview.8 is now published through the existing feed at main/tag commit 96a488de50d033438e6ef8c442e4850e37edfb09. Both jobs of main run 42264336480 passed. The final preview.8 PR run 42263200281 passed before merging PR #3. The actual public feed offers preview.8 to installed preview.2, .6 and .7, with no self-offer to .8. Released assets were downloaded and verified against both API digests and SHA256SUMS. The two existing user download files were replaced with official preview.8 bytes. The feature branch was deleted by the release job. Published assets remain immutable.

config.mjs now expands full-prefix and short-prefix ranges in individual interface blocks, classic tagged/untagged statements and classic Trk declarations. Unsupported cross-member, descending and oversized ranges generate warnings instead of range-named ports. firewalls.mjs recognizes the manufacturer-documented Base64 SonicWall EXP envelope, validates its decoded settings markers and imports only existing topology fields. shortProdName supplies the declared model; zero static addresses cannot mask an actual LAN address. Opaque backups remain unsupported.

Native layouts add TZ600 rear connectors and further 3560-E 48-port aliases. The 90G/91G front is calibrated against Fortinet data-sheet hardware page 7; x1/x2 physical names select revision 2, wan1/wan2 select revision 1. Explicit configured copper/fiber selects the mirrored shared connector and moves its editable anchor metadata. Shared capabilities never infer copper on their own. RJ45 paired rows retain opposite latch orientations, and combo primary sockets remain mapped. hardware-composition.mjs validates member numbers and member/slot/card uniqueness. Device details supplies GUI rows for stack members and installed modules. 2920 cards J9731A/J9732A map rear A/B bays; unsupported cards remain placeholders. 3560-E X2-1/X2-2 slots accept explicit X2-10GB variants or CVR-X2-SFP, with distinct Te and Gi attachments. A two-part Te0/1 no longer resolves to access port 1.

Stack panels expose unused canonical classic/CX jacks. Member regions retain proportional height, separate front/rear regions, and larger inter-member cable gaps. Core leads escape through the relevant gap with distinct lanes, rather than crossing another member. Wireless internal leads use an exterior rail. Core packing allocates greater height to stacks. The physical-port filter excludes logical groups, FortiOS virtual types, VLAN children and Trk aggregates.

Private checks cover the uploaded configurations outside the repository, including duplicates. Browser import yields 31 normalized devices with 14 review notes for the distinct local inputs. Files without a declared exact SKU retain schematic/boundary behavior until the user confirms the Model or a mapped stencil. One supplied binary RouterOS-style backup remains opaque and needs text export. No raw configs, client identities, credentials or user artwork are in tracked fixtures/screenshots. New tests are synthetic.

Local checks pass 80 Node tests, three Python damaged-package tests, four full synthetic Visio packages and the actual browser-downloaded hardware VSDX. Native-test-host compilation passes. Browser checks pass hardware composition, history/save/reopen, private imports, shared styles/colors/page numbering and the existing cable/mapper/selection/snapping/offline interactions. The hardware browser checks exercise member/module confirmation, undo/redo, project round trips, actual VSDX download and private file import. New geometry checks verify that core/wireless leads avoid other member panels and that labels remain clear. Require a green hosted Windows run for the final PR head before merging and publishing preview.9. Direct Microsoft Visio opening remains unverified. Release feed, cadence, visibility and separate download/install decisions are unchanged.


## Linked styles, reference presentation and export validation

The preview.8 scope now also includes the user's subsequent requests for bidirectional cable/legend colors, dedicated link titles/descriptions, configurable page numbering, removal of "observed" from connection captions, a repair for Visio opening error 271, and explicit use of the supplied Visio drawing as the style/layout reference. These changes remain part of the same authorized publication. PR #3 is open at the public repository. Its first source head 07e813261d418356742e2a383d3c7aeb83055ebc passed hosted Windows run 42254817323, including real export/print, timer/focus, installation and rollback. That check does not validate the later changes described here. Require a green run for the final PR head before merging, then verify the main release run and public assets.

link-styles.mjs validates layout.linkStyles and applies type-level color/opacity after individual drawing patches, so a cable edit, legend swatch edit and Link styles configuration share one style across pages. Legend titles/descriptions and line titles/descriptions are separate. Inline legend naming writes the shared title; ordinary text color remains an independent object edit. Moving from older per-line custom colors migrates applicable legend-position/text-color patches to the shared key. Wrapped legend text opens its complete title/description for editing. history.mjs records the style and patch migration as one action. Media captions now look up the current page.items array after routing; the previous stale local array could leave labels in their original color.

page-options.mjs cleans layout.pageNumbers (show, start 0-9999, pad 1-5, format up to 100 characters) and expands {page}, {last} and {total}. The Page options UI exposes visibility, first number, digit padding, format and preview. Page-number items have explicit stable edit keys. The default is two digits. Wireless captions retain port and speed without evidence-status wording; connection/evidence records are unchanged.

The reference profile uses 1200 by 975 page units, Calibri with Carlito/Arial fallbacks, navy #16364A, teal #166574, muted #536779 and rules #CEDCE0. Core pages place the connection key and available port-module examples left of a vertical divider. Associated handoff cards share rows above their owner. Equipment titles and model/address details sit near the faceplate and fit independently around cables. Core packing keeps attached handoffs with their owner. Continuation markers leave a clear label lane. Wireless note/legend text wraps and reduces bank density when long captions need more space. The private project retains one core sheet, all 104 port records in three port-map sheets, five cables with bends [2,2,4,4,4], and zero label/title overlaps with text, paths or hops. Private reference artwork/configuration stays outside the repository.

Viewport fit now uses each SVG's viewBox dimensions; fixed 920-unit sizing would distort pointer movement with the reference aspect ratio. Cable controls reserve their row while Edit drawing is active. Otherwise switching from a cable to text could resize/refit the canvas between the two clicks and prevent inline editing.

The VSDX writer includes explicit default style references, Calibri/Arial font declarations, conventional window settings/relationship, recalculation metadata and content types first in the ZIP. A rotated ordinary text shape has only one Angle cell. scripts/export-test-fixtures.mjs creates four fictional drawing/stencil packages. scripts/check-visio-package.py independently checks ZIP integrity, XML, every content type/relationship, shape/master IDs and inheritance, fonts and glued physical port rows. Three damaged-package tests cover missing pictures, unbound references and missing inherited shapes. scripts/build-windows.ps1 runs these checks before publishing the binary. The native test saves both SVG and VSDX through the real file dialog and validates the actual VSDX bytes. No installed Microsoft Visio is available in this environment; native Visio opening/rendering remains unverified and must not be reported as confirmed.

Current local checks pass 71 Node tests, three Python rejection tests, four complete packages, reference geometry and browser checks for shared styles in both directions, text colors, naming, page numbering, history and save/reopen. The existing cable/endpoint/mapper/offline browser regressions pass. Distinct unspecified-media categories retain independent legend keys even when their colors match. Final Windows checks are still required for the current head. Release version and file version remain 0.1.0-preview.8 / 0.1.0.8. Public feed, automatic cadence, separate download/install decisions and published-asset immutability are unchanged.

Windows run 42262105875 passed build/package verification but stopped at the new second-download check: the Save As dialog for the consecutive Visio export did not appear. The test now clicks SVG/Visio buttons using real WebView2 mouse input instead of script .click(), so repeated downloads carry a user gesture. Production permissions are unchanged. The harness names the export stage in any dialog error. Require a new complete Windows run after this correction; do not reuse the earlier head's green run.

## Preview.8 publication and compact port maps

Current release intent is 0.1.0-preview.8 / file version 0.1.0.8 on fix/simple-routing-legend-port-tools. On November 6, 2026 the user explicitly requested: "I want the feed published and updatable." This authorizes pushing the prepared source, creating its PR, merging after passing hosted checks, and publishing this preview through the existing public feed. The older unapproved-publication statements below are historical and are superseded for this release. It does not authorize changing repository visibility, release destination, automatic cadence or download/install consent. The last verified feed before this publication attempt contained preview.1 and preview.2. Verify the merged main SHA, workflow, tag and all three release assets before reporting publication complete.

Port maps now default to compact four-column tables, combined connection/description and status fields, measured-width wrapping and first-sheet-only faceplates. Continuation sheets start their table near the page header. layout.portMap persists density (compact/expanded), repeatFaceplate, detailFilter and groupConsecutive. Expanded tables and repeated faceplates remain optional. Oversized moved faceplates that leave no room for a row cannot cause an endless repeated-overview loop. The private reference's port-map section decreased from nine sheets to three with all 104 physical port records retained. Its overall drawing decreased from seventeen sheets to eleven. Never commit that reference or its screenshots.

color-picker.mjs is shared by lines and text. Text properties include the spectrum/hue, system chooser, HEX/RGB/HSL, drawing/recent/named palettes and a live text preview. The inline editor includes a quick native color chooser and Text options for full properties. Saving changes both content and color atomically; cancel retains the original values. Native artwork text, ordinary titles, legend text and port labels retain color through project round trips, SVG and native Visio Character/Color cells. Text mode omits line opacity.

Local Node validation passes 65 tests, including compact-versus-expanded pagination, complete port coverage, wrapping without truncation, oversized overview handling and native/ordinary export colors. Browser checks pass inline/native text color changes, cancel, Ctrl+Z/Ctrl+Shift+Z, full visual picker and named palettes, save/reopen, compact/expanded table settings and continuation sheets. Earlier drawing, snapping, history, endpoint, line color, bend and port-mapper interaction regressions also pass on this version, including the offline build. Hosted Windows publication results must be checked against this final version. The release notes for preview.8 roll up unpublished previews.3 through .7. Direct desktop Visio opening remains unverified.

## Inline editing, selection, snapping and undo candidate

The previous local candidate was 0.1.0-preview.7 / file version 0.1.0.7. It contained all earlier unpublished candidates. Publication was unapproved at that stage; the preview.8 authorization above supersedes that restriction for the current release. The public feed at that stage ended at preview.2.

Double-click resolves the original pointer target retained before canvas pointer capture. Text receives an inline foreignObject editor, including native panel text without Alt. Enter saves, Escape cancels, and capture-phase pointer handling commits valid text before Save/export or another action. A normal device click still opens stencil search after a short double-click delay. Box selection uses page coordinates, Shift-add/Ctrl-toggle, and top-level objects by default; Alt includes native details. Space/middle-button pan remains available.

snapping.mjs cleans per-project layout.snapping, computes point/group snaps and enclosed selection, with transient visible guides. Snapping starts disabled. Grid spacing, guide distance, target classes and arrow step are configurable. Pressing Alt during a drag bypasses snapping. Arrows nudge every selected object or group, Shift by ten times and Ctrl by one tenth. Bends retain their endpoints.

history.mjs records changed JSON values rather than repeated complete raster/stencil snapshots. Project history includes drawing edits, inventory endpoints, port mappings, import/evidence controls and settings. Undo/Redo shortcuts are document-wide outside typing fields. Undo all keeps redo ordering, and port mapping scopes its controls to consecutive mapping edits for that stencil. History is bounded to 200 actions, tracks saved revisions and resets on project load/new/sample. A history restore validates before changing its stacks, updates evidenceSnapshot, and refreshes an open port mapper against the current project shape. Undo history is not serialized into projects.

Local checks passed 63 Node tests and browser interactions for inline save/cancel and save-before-download, native-device double-click, marquee replace/add/toggle, group arrow modifiers, keyboard Undo/Redo/Undo all, grid snapping, visible alignment guides, saved settings and project round trips. Existing cable/color/port-map tests also passed, including endpoint Undo/Redo and mapper Ctrl+Shift+Z. Production and native-test-host compilation and Windows x64 cross-publishing passed. The final executable has preview.7 / FileVersion 0.1.0.7, seven icon frames, all 49 current embedded editor files and no test-host entry points. EXE SHA-256: 1cf622552316427f7a07f8da54e0efd59e97d05c207b9be764861ff095e42bf6. Web ZIP SHA-256: bcaa0bbd7c997ec06e057a4b866966f521a2686217411c3cc7482e08470879db. The reference core remains one sheet with bends [2,4,4,4,4] and no label/title collisions with text, paths or hop envelopes. Hosted native installation/rollback and direct Visio inspection remain unconfirmed.

## Direct cable editing, port mapper and icon candidate

The active branch fix/simple-routing-legend-port-tools now prepares 0.1.0-preview.6 / file version 0.1.0.6, including the earlier unpublished candidates. The public feed was read successfully during this task and still contained only v0.1.0-preview.1 and v0.1.0-preview.2. Nothing in this work authorizes public push, PR, merge or release. The prior automatic approval rejection remains applicable. Obtain explicit scope for the concrete public source/PR/merge/release before attempting that write.

New cable controls provide segment add buttons, draggable/removable bends, numeric point editing and modified arrow-key nudges. cable-edit.mjs retains orthogonal geometry and glued endpoints. The line color picker supports HSV spectrum/hue, system picker, HEX/RGB/HSL, opacity, diagram colors, recent/named swatches and optional browser screen sampling. Opacity persists in scene patches and both exports. Only used link styles enter each sheet's legend. Media labels follow edited cable colors, with dark labels for pale lines.

Connect endpoints uses physical port choices, including unused known-model/mapped jacks, and checks occupied physical aliases. Scene paths retain sourceLink metadata for both core and wireless cables. Saving endpoints transactionally rebuilds the route and migrates color/style patches while dropping obsolete bend points. A saved edit of an inferred handoff materializes that handoff in the project; its old inferred connection is then suppressed. Semantic connection edits use the connection editor; drawing Undo/Redo covers drawing patches and does not revert network inventory/endpoint changes.

Crossing hops are larger and have local white clearance. Core title and label placement considers hop envelopes. SVG uses generated arcs; Visio exports orthogonal bend geometry plus page/display-order arc-jump settings and connector defaults so native editing does not retain obsolete baked hop positions. Direct Visio rendering still must be inspected on Windows.

The mapper has rectangle selection, Shift-add/Ctrl-toggle, group drag, normalized movement, zoom, Fit device, wheel zoom and Space/middle-button pan. Arrow keys move one screen pixel at the current scale, Shift ten and Ctrl one tenth; group clamps retain spacing. Place port is explicit, so a selection gesture cannot accidentally remap a socket. Port-map tables use whole-row pagination, numeric ordering, consecutive grouping, actual peer details and persisted detail filters in layout.portMap. Table filters preserve physical faceplates.

The authored flat icon is src/web/assets/app-icon.svg. The Windows compiler consumes desktop/Assets/app.ico (16, 24, 32, 48, 64, 128 and 256 pixel images). The web header and favicon use the SVG, embedded as a data URL in the offline build. Production icon changes are compile-time resources; do not patch the EXE afterward.

Update checks now show progress for both automatic/manual lookup, report installed/latest published versions, identify a build ahead of the feed, and use a 25-second lookup deadline. Update details exposes a copyable last-check report, also saved as last-update-check.txt under the existing per-user state directory. Cache, ETag, rate-limit behavior, cadence, destination and separate download/install actions remain intact.

Local validation passed 57 Node tests, policy/cache tests and browser interactions for all new controls, including endpoint conflict rejection and style preservation, numeric bend save, project round trip, modified nudges, mapper zoom/pan, filter persistence and the standalone offline icon. The private core reference remains one sheet with bends [2,4,4,4,4] and no title/label collisions with text, paths or hop envelopes. Only synthetic screenshots are tracked. Production/native test-host compilation and Windows x64 cross-publishing passed. The packaged EXE has the correct preview.6/FileVersion 0.1.0.6 identity, seven icon frames matching the authored resource, all 46 current embedded editor files and no test-host entry points. EXE SHA-256 is 10fa349d8ab4de5b8c40aaed3ed92f3ddc8690db6abd39ec50117e16c9bd26d5; web ZIP SHA-256 is ca055720786ff7d94da5b1eaa41b1e3e8e2cfc87571b919682683e49471f5447. Hosted native update/rollback and direct Visio inspection remain unconfirmed here. See the preview.6 release notes for the current scope.

## Simple routing and direct editing candidate

Branch fix/simple-routing-legend-port-tools prepares 0.1.0-preview.5. It rolls up unpublished preview.3/preview.4 work. The verified public baseline remains v0.1.0-preview.2, main 0dd2698cb7fe9383c9a9182694981647a3865bab. A prior public push was rejected by automatic approval review because implementation/testing did not explicitly authorize publication. No preview.3, preview.4 or preview.5 public release is confirmed. Obtain explicit scope for public push, PR, merge after Windows checks and publication before retrying a public write. Published assets remain immutable.

The router compares blocked geometry, shared cable segments, crossings, bend count and then length. Facing ports can connect directly or with two bends; same-side ports normally use four-bend exterior routes. Additional departure offsets are limited to genuinely aligned socket conflicts or fixed text obstacles. Simplification removes duplicate/collinear points without collapsing a reversal through a chassis. Automatic titles fit close to the device around actual cables. Explicitly positioned titles remain obstacles. Internal handoff captions no longer introduce a false padded collision at their own boundary. The private core fixture retained one sheet and reduced five cables from 48 total bends to 18, with no title/link-label intersections. Header legends use the same SR, LR, DAC, copper, AP-copper and unspecified-media colors as the cables.

Edit drawing now supports direct item dragging, Shift/Ctrl selection, six edge/center alignment modes, equal-gap horizontal/vertical distribution, Undo and Redo. Hold Space to pan. Double-click or Edit selected opens text/name/style controls. Devices move as groups; Alt selects a native panel detail. Cable dragging changes its bends while preserving glued endpoints. Native path/text edits retain geometry, names, weight and alignment in the appropriate exports. Text moved outside a panel participates in link-label collision placement. Continued port/wireless sheets use distinct device edit scopes, with compatibility fallback for older saved keys. Raster artwork remains one movable/resizable image rather than editable pixels.

Map ports has multi-selection, reference-port row/column alignment, equal spacing, marker dragging and its own undo history. Unselected mappings stay unchanged. Select one row or column when distributing sockets. The master picker searches model/SKU/name tokens and retains selected masters across filters. The device-local stencil search, recursive folder discovery, bounded lazy archive reader and eligible binary picture-master reader are retained. Unsupported binary artwork still requires installed desktop Visio. No macro execution or source-file modification is permitted.

The physical catalog contains 406 exact identity/interface records and 302 confirmed bank profiles covering 403 identifiers, with manufacturer references. Declared mixed stack members and module SKUs are preserved. Unknown or identity-only layouts use perimeter attachments. Existing adjacency reconciliation retains the original reported endpoint and warning when an unambiguous configuration description supplies the known far-end interface. Manual updater checks show progress, bypass automatic cooldown/transient backoff and respect GitHub rate-limit pauses. Feed, automatic cadence, download verification and installation consent are unchanged.

Workspace maintenance removed the prior external checkout and unpublished local Git objects. The fresh checkout starts at the confirmed public preview.2. Current web modules, styles, HTML and conversion script were recovered from the verified preview.4 offline ZIP (SHA-256 ba56c8479ae28d2a1780a0961ca4be6218832f0b4fffdf6feae6b27f76f58c92). The legacy Windows converter and bridge were recovered from the matching owner-built executable (SHA-256 7b903209bc85a757ab2627655d00569a681a8e31c854535089be776cab636b22); updater changes were reapplied against published source. Recovery tools, runtime dependencies, private examples and captures stay outside the repository. The active checkout now lives inside the current workspace. This explains the larger public-baseline diff without implying a feature rollback.

Local verification passed 50 Node tests, update-policy logic tests and browser interaction checks for dragging, multiple selection, alignment/distribution, undo/redo, master filtering, port mapping, save/reopen and private geometry. Fictional sample screenshots were refreshed and inspected. Production and NativeSmoke C# compilation and Windows x64 cross-publishing passed. The packaged executable must retain version 0.1.0-preview.5 / file version 0.1.0.5, x64 GUI identity and no test-host entry points. Hosted native Windows export/print, real timers, install and rollback still must pass before merge/publication. Successful conversion through installed desktop Visio and direct Visio opening remain untested here.

The local .NET SDK can fail before compilation while inspecting its own process under a pipe. Direct MSBuild.dll execution with a PTY completed the builds; run Restore and Build as separate invocations in a fresh checkout so package imports are reevaluated. The pinned WebView2 package retains the existing WindowsBase reference warning. Normal PowerShell builds and native lifecycle tests belong on the hosted Windows runner. Linux FileVersionInfo cannot validate the bundled native EXE; inspect its PE RT_VERSION resource, not the first global fixed-version signature.

## Layout and supplemental-data candidate

The feature branch feat/layout-evidence-controls prepares 0.1.0-preview.2. The last published baseline for this work was v0.1.0-preview.1 at main commit 14390bb17036093c00d0ce084b78f6a3854b3010. Do not describe preview.2 as published until its merged workflow, tag and assets have been verified. This change does not authorize a future contributor to merge or publish it without the user's scope for that action.

New controls include Up/Down and drag/drop ordering, named core-page assignments, automatic AP inclusion, per-device core exclusion and scale, visible/numeric jack mapping, and reversible per-file/category import selection. Core packing measures the actual faceplate plus cable tracks. Links to another sheet use native continuation markers and page references. Old schema-1 projects open without conversion; new layout and evidence records are optional schema-1 fields.

layout.mjs owns ordering and validated page settings. diagram/core.mjs packs and routes the core. evidence.mjs keeps the pre-existing model as its base, normalized imported sources, and property/keyed-row patches for subsequent manual changes. Compose sources with configuration intent first, then apply current operational state/speed/media and the manual edits. No raw CLI or configuration text is retained. app.mjs captures changes against evidenceSnapshot before recomposition, and refreshes the snapshot after scope and hardware matching. Do not diff a newly recomposed model against its previous source selection or it will turn removed observations into manual changes.

imports/operational.mjs detects prompted CLI output, separates different host prompts, and parses supported interface, LLDP/CDP, transceiver, VLAN and IPv4 route formats. Captures without a useful hostname can be assigned to the intended device under Imported data. Coverage is documented in HARDWARE_SUPPORT.md. Unknown command syntax is not universal support for a platform.

visio-art.mjs renders supported cached vector geometry and pictures into a local image. Both artwork and child/root jacks use the same inches-based transform before normalization. Geometry that cannot be rendered is rejected with the desktop conversion path. Vector rendering is a supported subset, not an implementation of the entire ShapeSheet language.

Local validation for this candidate passed 36 Node tests and direct browser checks of ordering, drag/drop, page assignments, save/reopen, source/category toggles, six exported stencil masters and a private site fixture. A synthetic vector-only master verified rotated/mirrored artwork against the rendered pixel at its mapped socket. The original six-model hardware stencil also loads, including near-zero-height manufacturer wrappers; their visible child bounds normalize both artwork and jacks. Elliptical arcs use their on-curve control point, rotation and aspect ratio. Private core geometry had no unrelated-device crossings or shared parallel segments. Private files and screenshots remain outside the public repository. README screenshots contain only the fictional sample.

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


## Pending browser parser and port-map follow-up

Based on preview.42 main 813e454. Browser Comware, RouterOS and IOS saved-switching semantics, conservative route equivalence, multi-address report projection and standardized stacked/chassis/fixed port-map socket geometry are under validation. See docs/SWITCHPORT_INTEGRATION.md for coverage and remaining limits. This entry does not claim a published build or completed native/real-browser gate. Keep renderer and parser regression results with the final integration/release record.

# Information panel content and Apply feedback

Information panels default to one row per VLAN ID in the page's device scope,
retaining distinct recorded names and addresses. Device-grouped VLANs remain
available. Address type and port-detail filters, text row limits with explicit
remaining-item notices, and show/hide missing-data explanations are persisted
in cleanPanel. Enabled empty automatic sections and their headings are hidden by
default. Legacy explain values migrate to hide; deliberate explain-opt-in choices
retain missing-record explanations. Custom bodies, notes and manual body content
remain visible; an edited heading alone does not create section content.
No inventory/configuration data is invented or changed by these filters.

Apply layout catches failures beside its footer, keeps the dialog and current
edits open, and focuses the explanation. Inherited/disabled position inputs do
not prevent saving unrelated settings. tests/panel-content.test.mjs covers
scope, deduplication, filters, empty data, bounds, reopen, undo/redo, edited rows,
SVG and native Visio. tests/browser-panel-content.mjs covers actual dialog
failure/retry, history and save/reopen; run it in hosted browser validation.
Local Chromium launch is blocked by socket/IPC permissions, so no interactive
browser pass or browser screenshot is claimed here.

## Preview.45 upper wireless fan regression

The five-member stack with 28 APs on member three now exchanges compatible upper
departure rows within the existing member gap. The synthetic case improves from
42 to 16 crossings (upper 32 to 10, lower 10 to 6), without increasing route length
or changing hardware positions. Some crossings remain. The stricter candidate
retains merged-stroke and socket-lead guards rather than the more aggressive
prototype. Existing manual bends and opposite-direction row sharing remain
covered by the wireless suites. Actual generated SVG output was visually checked;
this is not native Windows or browser UI verification.

## Preview.46 wireless AP size and side-space controls

Pages & layout has Wireless APs and details (%) (25–400) and Wireless AP placement: Preserve rows (default) / Use side space. Defaults and individual pages are supported. AP artwork and automatic details grow together relative to the switch; fitted paper can still constrain final physical size. Explicit object size/text edits and frozen frames stay authoritative. Side space is a measured request, not a promise: the planner retains rows for authored/frozen layouts or when a side candidate is unsafe or more crossed. Synthetic 3-member/8-AP and 5-member/28-AP cases at 150% select side columns with 0 and 8 crossings respectively, no collisions or merged strokes, and shorter cable travel. Dense whole-topology Letter output can still overflow at the new physical text floor; use larger paper or readable continuation rather than claiming it fits.

The ordinary sample's Letter wireless pages now plan numeric label room before routing: both fit with at least 8.264pt actual text and no page overflow (switch width about 1031 physical px on a 1056px sheet). This removes a default 7.5pt-number-induced whole-switch enlargement, not all dense topology limits. New frame marker wirelessNumberScale preserves that plan across save/reopen; old frames remain compatible. Six focused AP tests and a synthetic side-column Visio package pass; full wireless aggregate and hosted browser validation are required on the combined head.

Preview.46 documentation images were regenerated from the integrated source with synthetic inputs and visually inspected. paper-fit.png uses sampleSite on Letter; page-fill.png uses adaptiveProject('letter','landscape',5). wireless-paper.png now honestly shows the first of four explicit readable Letter continuations of the fictional eight-member/32-uplink fixture, not a tiny whole-topology fit. General text metrics measured 10.25pt on the core and 8.59pt on that wireless continuation; adaptive report typography remains preserved. The render helper is temporary, not a repository source dependency. Final hosted screenshots and full CI remain required.

## Preview.47 adaptive port-map edge fill

Fresh Auto-fit port maps use a 4 px chassis-safe gutter and a full-bleed header rather than a second locked-sheet border. Page lock no longer imposes the old reference socket-size ceiling; bank and complete key geometry still bound growth, preserving all members and socket proportions. Saved lock/edit frames without portMapFit:1 retain their legacy base so old manual coordinates do not jump. Fresh frames record the marker through the shared paper-fitting layer. Standalone report margins and Preserve mode are unchanged. Four-sided PDF printer hardware margins remain printer-dependent.

Fictional five/eight-member and chassis Letter output was rendered through the actual PDF exporter and visually inspected; docs/images/page-fill.png is the current five-member output. Focused fresh-lock/save-reopen tests require the companion paper-fit correction. Hosted browser and native gates remain required before release.
