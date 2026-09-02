# Open Span rationale

## What the symbol means

The primary reading is a bridge span. The secondary reading is revealed by the
right side: the support has left the expected position and landed farther
forward. That is BridgeCRM's behavior in one gesture—hold the relationship,
then make the next step visible.

The gap is intentional. It keeps the mark from becoming a generic bridge,
doorway, or monogram and makes negative space part of the identity. The amber
support is a mnemonic accent, not a structural dependency; in monochrome the
gap and offset carry the same meaning.

## Why it won

Open Span C / Quiet achieved the highest weighted score (9.13/10). It was the
only territory that combined:

- A one-sentence redraw instruction: "an arch with its right support stepped
  forward."
- A silhouette that remains legible at 16–32 px.
- A direct relationship to both the Bridge name and the Capture-to-next-action
  behavior.
- Clear monochrome, tinted, circular, squircle, rounded-square, and square
  appearances.
- Low collision with CRM clouds, initials, sprockets, nodes, people, handshakes,
  and graphs.

## Canonical construction

- The supplied `bridge-app-icon-master.png` is the only canonical launcher
  source and is preserved byte-for-byte at SHA-256
  `baffea4921ad2709f33955dc4d823d8cbd8248f7499c1ba7d48be254bf75d46a`.
- 1024 × 1024 opaque RGB source grid with no baked corner radius.
- Broad, rounded arch with unequal support lengths.
- One forward support aligned below and to the right of the interrupted span.
- Optical bounds x 236–914 and y 130–878.
- Standard sizes are direct Lanczos resizes of the supplied image.
- Maskable files scale the complete supplied artwork uniformly to 84% over the
  same edge-to-edge green field; the two foreground pieces are never moved
  independently.
- The transparent UI mark is extracted from the source pixels and backed by an
  exact traced SVG whose rendered contours differ by no more than two channel
  levels from the extraction.

## Color system

| Role | Value | Purpose |
| --- | --- | --- |
| Deep forest | `#073E36` | Durable launcher field |
| Warm paper | `#F7F1E6` | Human, editorial span |
| Amber | `#E1A64A` | Memorable next-step support |
| Deep forest | `#073E36` | Transparent in-app bridge shape |

## File roles

- `final/bridge-app-icon-master.png`: exact supplied canonical artwork.
- `final/bridge-ui-mark.svg`: exact transparent vector trace for Today and
  other in-app brand placements.
- `final/bridge-ui-mark.png`: extracted full-resolution transparent fallback.
- `platform/web/`: favicon and PWA raster outputs.
- `archive/pre-1.3.44/`: exact previous production assets and checksums.

The repository is a web/PWA target, not a native Xcode or Android project, so
no native asset catalog or adaptive-icon XML was invented.
