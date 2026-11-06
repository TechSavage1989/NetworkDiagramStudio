# NetworkDiagramStudio contributor guide

Read this file, the current development handoff, and the shared standards before editing. [Development handoff](DEVELOPMENT_HANDOFF.md) · [Repository standards](docs/REPOSITORY_STANDARDS.md)

## Source map

| Path | Responsibility |
| --- | --- |
| src/web | Local browser editor, projects, fictional sample and offline HTML entry point. |
| src/web/imports | Configuration and Auvik parsers, inventory merging, model facts and associated notices. |
| src/web/diagram | Sheet layout, SVG and native Visio packaging. |
| src/web/vendor | Pinned local EMF renderer and its license. |
| desktop | Windows Forms/WebView2 host, release policy, verified download and rollback helper. |
| scripts | Browser and Windows builds, release packaging, publishing, root guard and optional Visio conversion. |
| tests | Synthetic parser/layout fixtures and browser engine tests. Windows policy and lifecycle checks live in tests/desktop. |
| docs | Shared standards, hardware support, release intent and notes, dependency notices, and synthetic screenshots. |
| .github/workflows | Pull-request validation and intent-gated preview publication. |

## Working rules

Use synthetic inputs in tests, screenshots and releases. Real customer configs, reports, diagrams, credentials and unrestricted third-party stencil collections must stay outside this repository. The preview works locally. Keep import processing and layout independent of the update feed.

A site scope is based on configured devices and their linked APs, with explicit inclusion overrides. Hardware packs retain model assignments and optic choices. Keep hardware-stencil export tied to the active drawing. Device identities and SFP form factors are separate from physical proof. Preserve provenance and warnings when two records disagree. For artwork without a mapped jack, retain the schematic or boundary behavior and provide a manual mapping path.

Do not change the release destination, automatic check cadence, or consent boundaries as an incidental refactor. A lookup, a download, and an install are different operations. The desktop must see the initialized editor and a visible window before confirming an installed update. The test-only update feed and failure injector must remain absent from production builds.

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

The root guard allows the four project guides, .gitignore, .github, desktop, docs, scripts, src and tests. Builds go under untracked dist, bin or obj directories. A new tracked root entry requires an explicit change to the guard and project guide. The dedicated root-guard test also exercises the filesystem fallback without a Git checkout.

Work on short-lived branches and use a pull request into main. The normal release is an intentional change to docs/releases/intent.json. Its version, tag and notes path must agree with the desktop project. Published assets are immutable. Future pushes, PRs, merges and releases need authorization for their own scope.
