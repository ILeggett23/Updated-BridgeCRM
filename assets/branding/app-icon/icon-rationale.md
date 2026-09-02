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

## Construction

- 1024 × 1024 source grid.
- Two editable filled paths; no external fonts or raster content.
- Broad, rounded arch with unequal support lengths.
- One forward support aligned below and to the right of the interrupted span.
- Optical bounds x 236–914 and y 130–878.
- No essential detail is located near a platform-mask corner.

## Color system

| Role | Value | Purpose |
| --- | --- | --- |
| Deep forest | `#073E36` | Durable launcher field |
| Warm paper | `#F7F1E6` | Human, editorial span |
| Amber | `#E1A64A` | Memorable next-step support |
| Brand forest | `#0A4F44` | Transparent in-app mark |
| Ink | `#1B1913` | Monochrome master |

## File roles

- `final/icon-master.svg`: canonical deep-forest app tile.
- `final/icon-monochrome.svg`: transparent one-color geometry.
- `final/icon-light.svg`: warm-paper appearance.
- `final/icon-dark.svg`: deep-forest appearance.
- `final/icon-symbol.svg`: transparent full-color in-app mark.
- `platform/apple/`: Default, Dark, and Mono source appearances.
- `platform/android/`: separate foreground, background, and monochrome vectors.
- `platform/web/`: favicon and PWA raster outputs.
- `archive/pre-1.3.44/`: exact previous production assets and checksums.

The repository is a web/PWA target, not a native Xcode or Android project, so
no native asset catalog or adaptive-icon XML was invented. The prepared source
layers can be imported if native targets are added later.
