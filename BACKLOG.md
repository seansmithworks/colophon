# Backlog

Open items for Colophon, seeded from release prep. Append one line per item
under the relevant section as you find things. No process beyond that.

## Design

- Still open: final icon design is Sean's call. The current
  `extension/icons/*.png` set is a functional placeholder derived from the
  existing brand mark (`content/reader.js:131`), not a finished identity.
- Still open: README tagline/pitch copy needs Sean's voice pass before the
  repo goes public (drafted plainly/factually for now, deliberately not
  marketing copy).
- Masthead title provenance rule: currently prettifies frontmatter `name`.
  Proposed rule: frontmatter title -> H1 -> prettified name. Needs a
  decision and an implementation pass.
- Decide Design Lens placement: in-flow block vs. right rail vs. a third
  view tab. (The on/off toggle question is resolved as of 0.2.0: the Lens
  is always on and simply doesn't render when no tokens are found.)

## Security / submission readiness

- Narrow `host_permissions` from `["<all_urls>"]` to
  `optional_host_permissions` + per-origin `chrome.permissions.request()`
  before any Chrome Web Store submission. TODO already left at
  `background.js:13`.

## Verification

- Confirm Design Lens behavior when a local `file://` document links a
  local `.css` file. Unverified as of 0.1.0.

## Distribution

- Firefox/AMO port as a possible free second channel (MV3 support in
  Firefox is not identical to Chrome's; needs a compatibility pass before
  committing to this).
- Watch mode with live reload for the edit-and-preview loop (CLI currently
  requires a manual browser refresh after editing the markdown or CSS).
- Decide whether to publish `colophon-cli` to npm. The package is ready
  (`bin`, `engines`, `files` allowlist all in place) but publishing is
  Sean's call, not yet made.

## Design Lens

- Multi-source token extraction so the Lens arms on YAML frontmatter and
  markdown tables, not just linked stylesheets. Next major wave, planned.
- "Source" theme mode: the reader body wears the document's declared
  palette and font stack instead of the reader's own type system.
- Token specimen ramps for radius, shadow, motion, and grid, alongside the
  existing palette/type/spacing sections.

## Known bugs

- `content/md-parser.js` around line 80 stashes code spans as
  `" C" + idx + " "` placeholder tokens. A document containing the literal
  text ` C0 ` (or any ` C<n> `) outside backticks would collide with this
  placeholder and get corrupted on restore. Not yet fixed.
