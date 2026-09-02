# Open Span validation report

## Status

**Automated and visual production checks: complete.**

**Human recall and recognition testing: not yet conducted.** No automated score
in this project is presented as proof of memorability.

## Automated asset checks

- SVG sources parse and render through Sharp.
- Canonical PNG dimensions: 1024, 512, 192, and 180 px.
- Launcher, maskable, Apple-touch, and favicon PNGs are opaque RGB files with
  no alpha channel; only the in-app mark retains RGBA transparency.
- Dedicated maskable PNG: 512 px.
- Favicons: 32 and 48 px plus SVG.
- Transparent in-app mark: 192 px RGBA.
- Final master contains two filled paths and no gradients, filters, fonts,
  embedded raster images, or external references.
- Monochrome master preserves the same two paths and one negative-space gap.
- Manifest declares `any`, `maskable`, and `monochrome` purposes.
- Build, local preview, Cloudflare worker bundle, service-worker shell, and
  static `dist/` output include the new icon set.
- Previous production files are archived with SHA-256 checksums.

## Visual boards reviewed

- `previews/icon-home-screen-test.png`: unlabeled Bridge icon among 29 unrelated
  synthetic app icons.
- `previews/icon-small-size-test.png`: 160, 96, 64, 48, 32, 24, and 16 px plus
  black/white, grayscale, inverted, blur, and low-contrast states.
- `previews/icon-mask-test.png`: circle, squircle, rounded-square, and square.
- `previews/icon-validation-board.png`: all 18 requested automated conditions.
- `previews/icon-concept-board.png`: all five territories and six structural
  refinements.

Synthetic surrounding icons are used on the committed boards so no third-party
trademarks become application assets. The category labels identify the audited
comparison set; original competitor artwork was reviewed only through the
linked research sources.

## Observations

- At 32 px the amber support remains distinct from the paper span.
- At 24 px the support becomes a clear dot-like step, while the arch remains
  stable.
- At 16 px the broad `arch + gap + step` contour survives, although the amber
  support no longer reads as a pillar.
- In monochrome the icon loses the color-based future/present distinction but
  retains its most ownable feature: the interrupted, offset support.
- The circle mask approaches the amber support most aggressively but does not
  remove its recognizability.
- Heavy blur preserves an arch-and-beat gestalt rather than collapsing into a
  centered blob.

## Human test still required

Use the protocol in `docs/brand/icon-strategy.md` with at least 8 participants
who have not seen the design work. Record:

- Description after five seconds.
- Sketch fidelity for arch, break, and offset support.
- Selection time among unrelated icons.
- Selection time among actual CRM icons.
- Emotional associations.
- Spontaneous alternate readings.

Recommended success gates:

- At least 6 of 8 participants describe or sketch the interrupted support.
- Median unlabeled selection time below three seconds after a ten-minute delay.
- Calm, thoughtful, human, prepared, or forward associations outnumber cold,
  technical, warning, or childish associations.
- No more than 2 of 8 participants recall only a generic letter n.

## Remaining risks

- The broad form can be read as a lowercase `n.` even though no letter was used
  in construction.
- Doorway, hook, pin, or bridge-architecture marks outside the CRM category may
  share a broad arch silhouette.
- Amber can imply warning in some interfaces; here it is isolated to brand
  artwork and does not replace Bridge's semantic status colors.
- A formal global trademark search has not been performed.
