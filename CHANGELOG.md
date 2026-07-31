# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
