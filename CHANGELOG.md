# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.3.0] - 2026-07-30

### Removed

- Voiceover: cut the player bar, its transport controls, the voice and
  speed pickers, and all `speechSynthesis` logic (block-by-block reading,
  reading-highlight, and the source-pane mirror it drove in Split view).
  Colophon is a markdown reader and design system visualizer; audio
  playback diluted that focus. The document now runs to the bottom of the
  viewport with no fixed footer reserving space for it.

## [0.2.0] - 2026-07-30

### Changed

- Renamed the product from MD Reader to Colophon: manifest, package
  metadata, README/BACKLOG copy, the reader's visible brand string, the
  release zip name, and every internal DOM id/class/global namespace
  (`mdreader-*` -> `colophon-*`, `window.MDReader*` -> `window.Colophon*`).
- Removed the System type variant. Editorial is now the only body
  treatment; the variant toggle, its CSS, and its localStorage handling
  are gone.
- The Design Lens is always on. Removed the Lens toggle button and the
  off state; the Lens simply doesn't render when the document links no
  usable tokens. Its own collapse/expand affordance is unaffected.
- Grid alignment: masthead, rules, body copy, headings, lists, code
  blocks, and the Lens now share one left/right edge in both Read and
  Split view, driven by a single `--content-max` value instead of
  independently-centered elements with mismatched widths.
- Voice picker: filtered to English voices, excludes confirmed novelty
  voices (Bad News, Bubbles, Zarvox, Trinoids, Bells, Wobble), and groups
  the remainder into "High quality" (Premium/Enhanced) and "Standard"
  optgroups. Removed the dead Siri-name match — Siri voices are never
  exposed to the Web Speech API. Shows a one-time inline hint pointing at
  System Settings -> Accessibility -> Spoken Content -> System Voice ->
  Manage Voices when no Premium/Enhanced voice is installed.

### Added

- Keyboard shortcut `v` cycles Read <-> Split, built as a cycler over an
  ordered view list so a third view can be added later without rework.
  No-ops while typing in a form field or below the 1000px split
  threshold.

### Fixed

- Design Lens: validates a resolved token's color value against the
  existing color regex before interpolating it into a swatch's `style`
  attribute, dropping the swatch if it doesn't match. Closes a gap left
  by quote-stripping alone now that document-derived (not just
  stylesheet-derived) values are on the roadmap.
- README voice guidance no longer tells users to pick a Siri voice
  (unreachable from the Web Speech API); names specific downloadable
  Enhanced/Premium voices instead.

## [0.1.0] - 2026-07-30

Initial release.

### Added

- Reader: transforms a raw markdown page into a designed reading view with a
  masthead built from frontmatter, a table of contents, and Editorial/System
  type variants (light/dark).
- Design Lens: scans the document for linked `.css`/`.svg` files, fetches
  them, and renders a collapsible palette/type-scale/spacing view derived
  from the stylesheet's custom properties. Always labeled as derived, never
  presented as part of the source document.
- Split view: raw source beside the render with hover/click line
  correspondence, available above 1000px wide.
- Voiceover: reads the document aloud via the browser's built-in
  `speechSynthesis`, highlighting the active block (and matching source
  lines in Split view) as it goes. Skips fenced code blocks and the Design
  Lens.
- Manifest V3 Chrome extension: toolbar action toggles the reader on/off on
  any tab serving raw markdown (`.md`/`.markdown` over HTTP(S) or `file://`).
