# MD Reader — Chrome extension (v0.1, unpacked)

Turns a raw markdown page into a design-grade reader: masthead from
frontmatter, Editorial/System type variants, light/dark, table of contents,
a voiceover player with source/render split view, and a Design Lens that
visualizes any stylesheet the document links.

This is a local, unpacked, dev-mode extension — not published, not signed.

## Load it (Chrome)

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select this `extension/` folder.
5. Pin the "MD Reader" action to the toolbar if you want quick access.

## Test on a local `.md` file

Chrome blocks extensions from `file://` URLs by default.

1. Go back to `chrome://extensions`.
2. Find MD Reader, click **Details**.
3. Turn on **Allow access to file URLs**.
4. Open a local markdown file directly in a tab, e.g.
   `file:///Users/you/some-notes.md`.
5. Click the MD Reader toolbar action.

## Using it

- Navigate to any URL that serves raw markdown as `text/markdown` or
  `text/plain` (a `.md`/`.markdown` URL, a GitHub raw link, a local file).
  Chrome will show its own plain-text viewer (just a `<pre>`).
- Click the MD Reader toolbar icon. The page becomes the reader.
- Click again (or the **×** in the reader's top bar) to restore the
  original page instantly — nothing is refetched or lost.
- **Read / Split**: Split shows the raw source beside the render with
  hover/click correspondence highlighting (DevTools-style), available above
  1000px wide.
- **Lens**: if the document links a `.css` file, MD Reader fetches it and
  renders a collapsible "Design Lens" — palette, type scale, and spacing
  extracted from that stylesheet's custom properties. No stylesheet link,
  no lens — the reader still works either way.
- **Editorial / System**: serif reading column vs. tighter docs-style sans.
- The bottom player reads the document aloud via the browser's built-in
  `speechSynthesis`, highlighting the active block (and, in Split view, the
  matching source lines) as it goes. It skips fenced code blocks and the
  Design Lens.

## Dia (or other Chromium-based browsers)

MD Reader is a standard MV3 unpacked extension, so it should load the same
way in any Chromium-based browser that exposes `chrome://extensions` with a
Developer mode / Load unpacked flow — Dia included. If you're on Dia,
confirm `chrome://extensions` exists and has a visible Developer Mode
toggle before assuming parity with Chrome; some Chromium forks relocate or
restrict that page.

## Permissions, honestly

- `activeTab` + `scripting`: inject the reader into the tab you click the
  action on.
- `storage`: reserved for future preference persistence (theme/lens
  choices); not required for v0.1 to function.
- `host_permissions: ["<all_urls>"]`: used only by the background service
  worker to fetch stylesheets/SVGs a *document itself links*, so the Design
  Lens works even when the host page's own CSP blocks `fetch()` from a
  content script (common on raw-content CDNs). **TODO before any Chrome Web
  Store submission:** replace this with `optional_host_permissions` and
  request the specific origin via `chrome.permissions.request()` the first
  time a document actually links an external asset, rather than holding
  blanket access at rest.

## Architecture

- `manifest.json` — MV3, no build step, plain JS files listed in dependency
  order for the content-script injection.
- `content/detect.js` — always-on lightweight detector (matches `*.md` /
  `*.markdown` / `file:///*.md` pages); stashes the raw source text from
  Chrome's own `<pre>` plain-text rendering. Never refetches the URL.
- `background.js` — toolbar action handler (injects the reader bundle) and
  a fetch relay for content scripts (bypasses page CSP for stylesheet/SVG
  fetches).
- `content/md-parser.js` — markdown → HTML, hardened for arbitrary
  documents (tables, blockquotes, images, nested lists, hr, links, inline
  code, fenced code with language, setext headings, bold/em). Tracks source
  line ranges (`data-lines`) on every rendered block. Every text node is
  verbatim from the source — this file restructures and escapes, it never
  rewrites or summarizes.
- `content/lens.js` — generalized Design Lens: scans the rendered doc for
  `.css`/`.svg` links, fetches them via the background worker, parses CSS
  custom properties, resolves `var()` chains and `light-dark()` pairs, and
  heuristically buckets them into a palette / type scale / spacing view.
- `content/reader.js` — builds the reader DOM, stashes the original page in
  a hidden sibling container, and wires theme/lens/view toggles, TOC, the
  voiceover player, and source↔render hover/click sync.
- `styles/reader.css` — all reader chrome, scoped under `#mdreader-root`
  and `html[data-mdreader-*]` attributes so it can never leak onto or
  collide with the host page's own styling.
