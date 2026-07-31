# Colophon

A Chrome extension that turns a raw markdown page into a designed reader
and design system visualizer, with a source/render split view.

Colophon also ships as a CLI, which is the primary way to use it: it works
on local and private files, not just public URLs. The extension remains the
right tool for a public markdown URL you're already browsing in a tab.

## Screenshots

| Read | Split | Split (dark) |
| --- | --- | --- |
| ![Read view](docs/screenshots/read.png) | ![Split view](docs/screenshots/split.png) | ![Split view, dark](docs/screenshots/split-dark.png) |

## CLI (primary)

Design systems mostly live in private repos and local working trees, not at
public URLs. The CLI reads a markdown file straight off disk (or a URL you
give it), renders it, and serves it on localhost:

```
npx colophon-cli design.md
```

or, installed globally for the short command:

```
npm install -g colophon-cli
colophon design.md
```

Either way it prints the URL, renders the document, and opens your default
browser at that URL.

### Flags

| Flag | Description |
| --- | --- |
| `--port <n>` | Port to serve on. Default: an available port is chosen automatically. |
| `--css <path>` | Explicit stylesheet to arm the Design Lens with. Repeatable. Highest priority; always used. |
| `--no-open` | Serve and print the URL only. Does not launch a browser. |
| `-h`, `--help` | Show usage. |
| `-v`, `--version` | Print the installed version. |

### Using it inside Ghostties, Claude desktop, or any embedded browser

`--no-open` plus the printed URL is the pattern for any tool with an
embedded browser pane rather than a full Chrome tab: agent terminals
(Ghostties), Claude desktop, Cursor, Conductor, Codex. Run
`colophon design.md --no-open`, copy the printed `http://127.0.0.1:PORT/...`
URL, and open it in the pane yourself. Colophon always serves on localhost
over HTTP rather than a `file://` page for exactly this reason: embedded
browser panes commonly restrict which URL schemes they'll load, and
`file://` is the one most likely to be blocked. `http://localhost` works
everywhere a `file://` link wouldn't.

### Sibling stylesheet discovery

This is the thing the CLI can do that the extension fundamentally can't. The
extension only sees whatever a document links, and browsers block `file://`
fetches for anything a document doesn't already link. Design systems written
as private markdown specs routinely don't link their own CSS at all, so the
extension shows nothing.

The CLI reads the filesystem directly, so it can look. Resolution order,
first candidate that actually defines CSS custom properties wins:

1. Any `--css` path(s) given explicitly. Always used, no further checks.
2. A relative-path stylesheet link inside the markdown, resolved against the
   markdown file's own directory.
3. An absolute-URL stylesheet link inside the markdown, fetched over the
   network (this is how `vercel.com/design.md` arms the extension).
4. Conventional file locations relative to the markdown file, walking up
   toward the repo root: `globals.css`, `styles/globals.css`,
   `src/app/globals.css`, `app/globals.css`, `src/styles/*.css`. The walk
   stops at a `.git` directory or the filesystem root, and it's capped.

The CLI prints which file armed the lens and by which rule, so a missing
lens is diagnosable, not mysterious. If nothing usable is found, the reader
still renders; it just doesn't arm the lens, and says so.

## Chrome extension (for public URLs)

For a public markdown URL you're already browsing, the extension turns the
page into the same reader in place, no terminal required.

**Route A: download the release (recommended for most people)**

1. Go to the [latest release](https://github.com/seansmithworks/colophon/releases/latest)
   and download `colophon-v0.4.0.zip`.
2. Unzip it. This gives you a folder (e.g. `colophon-v0.4.0/`) with
   `manifest.json` sitting directly at its root, no subfolder to drill
   into.
3. Open `chrome://extensions`.
4. Turn on **Developer mode** (top-right toggle).
5. Click **Load unpacked** and select that unzipped folder itself, the
   one containing `manifest.json` directly.
6. Pin the Colophon action to the toolbar if you want quick access.

**Route B: clone the repo (for development)**

1. Clone the repo: `git clone https://github.com/seansmithworks/colophon.git`
2. Open `chrome://extensions`.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `extension/` subfolder inside
   the cloned repo, not the repo root. In the repo, `manifest.json` lives
   one level down, inside `extension/`.
5. Pin the Colophon action to the toolbar if you want quick access.

Selecting the wrong folder is the single most likely failure here (Chrome's
error message for it isn't helpful): the unzipped release folder has
`manifest.json` at its root, the cloned repo has `manifest.json` inside
`extension/`. Pick the folder that actually contains `manifest.json`.

To use Colophon on local `.md` files, Chrome needs an extra permission
(it blocks extensions from `file://` URLs by default):

1. Go back to `chrome://extensions`, find Colophon, click **Details**.
2. Turn on **Allow access to file URLs**.
3. Open a local markdown file directly in a tab, e.g.
   `file:///Users/you/notes.md`.

**Chrome Web Store:** coming soon.

Colophon is a standard Manifest V3 extension with no Chrome-only APIs, so
it loads the same way in any Chromium-based browser that exposes
`chrome://extensions` with a Developer mode / Load unpacked flow. It is
confirmed working in [Dia](https://www.diabrowser.com/).

### Try it

Fastest way to see what Colophon does: after installing, open
[vercel.com/design.md](https://vercel.com/design.md) and click the toolbar
icon. That page links a stylesheet, so it arms the Design Lens too. A
plain GitHub raw README also works, but since it links no stylesheet, it
won't show a lens; that's expected, not a bug.

### Usage

- Navigate to a page serving raw markdown (a `.md`/`.markdown` URL, a
  GitHub raw link, or a local file with file-URL access allowed).
- Click the Colophon toolbar icon to transform the page. Click again (or
  the `x` in the reader's top bar) to restore the original page instantly.
  On a page that isn't markdown, clicking the icon does nothing at all;
  this is a quiet, by-design no-op, not an error.
- **Read / Split**: Split shows the raw source beside the render with
  hover/click line correspondence, available above 1000px wide. Press `v`
  to cycle views (does nothing while typing in a field, or below 1000px).
- **Lens**: if the document links a `.css` file, Colophon renders a
  collapsible Design Lens showing the palette, type scale, and spacing
  extracted from that stylesheet's custom properties. It arms
  automatically whenever tokens are found and simply doesn't appear when
  none are.

## How it works

Colophon is a deterministic markdown parser. There is no AI, no LLM call,
and no summarization step. Every word rendered in the reader is verbatim
from the source document; the parser only restructures and escapes it. The
one exception is the Design Lens, which is derived content computed from a
resolved stylesheet's tokens, and it is always labeled as a lens, not as
part of the document.

The CLI and the extension share the exact same parser, token extractor, and
reader code (`extension/content/md-parser.js`, `lens.js`, `reader.js`, and
`extension/styles/reader.css`). The CLI serves those files unmodified as
static assets alongside an HTML shell that embeds the raw markdown (and any
resolved CSS) as data; the browser does the actual parsing and rendering,
same as it always has. Nothing about markdown parsing or token extraction
is duplicated between the two contexts.

## Privacy

- Runs entirely locally. No LLM, no account, no API key, no telemetry.
- Works offline for any document already loaded in the tab or already on
  disk.
- The only network requests Colophon ever makes are fetching an absolute-URL
  stylesheet/asset a document itself links (extension), or a Node-side fetch
  for an absolute-URL stylesheet link during discovery (CLI). If a document
  links nothing and no stylesheet is found nearby, Colophon makes no
  requests at all.

## Development

```
bin/colophon.mjs        CLI entry point (arg parsing, orchestration)
lib/
  discover-css.mjs        sibling/linked stylesheet resolution
  shared-code.mjs          loads md-parser.js/lens.js into Node via vm, unmodified
  render-shell.mjs         builds the HTML page the CLI serves
  server.mjs               plain node:http static/HTML server
  open-browser.mjs         shells out to the OS default-browser opener
extension/
  manifest.json         MV3 manifest
  background.js         toolbar action handler + fetch relay for content scripts
  content/
    detect.js            lightweight detector for markdown pages, stashes raw source
    md-parser.js          markdown -> HTML, tracks source line ranges per block
    lens.js               Design Lens: extracts tokens from resolved CSS text
    reader.js              builds the reader DOM, wires toggles/TOC/sync
  styles/reader.css     all reader chrome, scoped under #colophon-root
  icons/                toolbar/store icons (16/32/48/128)
demo/                   original concept demo and its build pipeline
scripts/package.mjs     release packaging (version sync + zip)
```

After editing any file under `extension/`, reload the extension from
`chrome://extensions` (the reload icon on the Colophon card) to pick up
the change. There is no build step for the extension itself, and none for
the CLI either; it runs directly on Node's built-in `http`/`fs`/`path`/`url`/
`child_process` modules with zero runtime dependencies.

To produce a release zip for the extension:

```
npm run package
```

This syncs `package.json`'s version into `extension/manifest.json`, then
writes `dist/colophon-v<version>.zip` with `manifest.json` at the zip
root, ready for a Chrome Web Store submission or a GitHub Release.

## Known limitations

- `raw.githubusercontent.com` sends a `default-src 'none'` Content Security
  Policy, which blocks badge/shield images from rendering inside the
  reader (extension only). This is the host's CSP, not a bug in Colophon.
- Extension `host_permissions` is currently `["<all_urls>"]`, which is
  broader than the extension needs at rest (it exists only so the
  background worker can fetch document-linked stylesheets past a host
  page's CSP). This must be narrowed to `optional_host_permissions` with
  per-origin requests before any Chrome Web Store submission. See
  `background.js:13`.
- The CLI has not been published to npm yet; `npx colophon-cli` requires
  the package to exist on the registry first (tracked in `BACKLOG.md`).

## License

MIT. See [LICENSE](LICENSE).
