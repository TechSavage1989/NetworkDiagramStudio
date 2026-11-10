# Optical connector proportions

The built-in faceplates are schematic illustrations with standardized connector
widths. They are not engineering-scale chassis drawings. Port centers, aliases,
row orientation and connection glue remain tied to the researched device layout.
Imported manufacturer artwork keeps its own aspect ratio and mapped anchors.

## Reference and application

- [SFP MSA / INF-8074i, Table 1, page 6](https://members.snia.org/document/dl/26184)
  gives the front nosepiece width and height as 13.7 mm and 8.6 mm. The generic
  SFP/SFP+/SFP28 face uses that approximately 1.59:1 front-view aspect instead of
  the previous flattened 2:1 rectangle.
- [SFF-8661, QSFP+ 4X module, basic views](https://www.gigalight.com/downloads/standards/sff-8661.pdf)
  gives the housing width and height as 18.35 mm and 8.5 mm. The generic QSFP face
  uses that approximately 2.16:1 aspect. The schematic width is retained so dense
  researched port-center layouts do not acquire overlapping cages.
- RJ45 envelopes are unchanged. These references constrain the optical front
  aspect, not the exact cage/bezel dimensions, tolerances, latch detail, or
  relative millimetre scale of every connector on a device.

Installed generic optics follow the host socket's form factor when it is known,
otherwise the existing generic SFP illustration is used. The module legend keeps
the same aspect rather than stretching its body into a fixed-height icon. Native
artwork, custom size edits and imported module assets remain authoritative.

The editor, SVG, print/PDF and Visio use the shared scene geometry. Tests verify
SFP/QSFP aspects, unchanged centers, all catalog socket collision checks, cable
endpoint glue, and PDF rectangle proportions. This is a correction to schematic
proportions, not a claim of precise hardware manufacture or exhaustive module
support.

## Rendered synthetic example

The image below is an unedited rendering of the application's PDF output using
its fictional sample site. It shows the SFP socket and installed-module shapes
alongside unchanged copper connectors, and the matching module legend.

![Schematic optical sockets and module legend](images/optical-proportions.png)
