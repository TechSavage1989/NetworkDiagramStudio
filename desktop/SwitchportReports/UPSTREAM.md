# Switchport report engine provenance

The Engine directory, Data/hardware-catalog.json and Fonts files originate from TechSavage1989/SwitchPort_Diagram_Builder, commit 2327083bcd4301db1cc7c162a764540190c5d7ad, version 1.18.5. They are incorporated at the project owner's request. The original repository does not contain a separate repository license; this notice does not grant rights beyond the owner's authorization.

Source: https://github.com/TechSavage1989/SwitchPort_Diagram_Builder/tree/2327083bcd4301db1cc7c162a764540190c5d7ad/Source/SwitchportGenerator

The reusable engine retains the source parsers, verified hardware catalog, compatible module selectors, palette solver, report geometry, inventory tables, supplementary evidence handling and eight standard outputs. It is built as a library inside the existing NetworkDiagramStudio desktop application. The separate Switchport application interface and updater are not included.

NetworkDiagramStudio additions are kept outside Engine where possible. The generator entry point is split to expose rendering from a normalized Inventory. QuickSheet reserves external port-number bands, keeps numbers at least six printed points, and permits uniformly smaller socket geometry for dense stacks while preserving text and marker limits. Its body transform handles those layouts without moving the fixed report footer. Raw configurations are accepted transiently only by explicit import methods. Report exports operate on normalized typed inventories and never write a raw configuration to disk.

Supplementary workbook ownership now prioritizes exact full hostnames and rejects ambiguous short-name matches across separate sites. Bounded observation labels include their truncation suffix within the persisted field limit. The normalized facade clears previously applied observation decoration before applying the selected sources, so disabling one source removes only its report observations. The browser supplementary reader ports the same six Auvik sheets, operational extraction, limits, source attribution and redaction rules; it also accepts equivalent Auvik CSV columns through the existing import workflow.

The embedded DejaVu fonts retain their complete upstream license in Fonts/LICENSE.txt. The engine depends on SkiaSharp 3.119.4 and its matching native assets. Their package notices must accompany the desktop release through the existing NetworkDiagramStudio notices mechanism.

Integration behavior and verification status are tracked in docs/SWITCHPORT_INTEGRATION.md at the repository root.
