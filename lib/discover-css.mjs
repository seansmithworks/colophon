// Stylesheet discovery for the CLI. Resolution order (first entry that
// actually defines usable CSS custom properties wins, per
// shared-code.mjs's extractTokens — never guessed, never silently assumed):
//
//   1. --css path(s) given explicitly on the command line (always used,
//      regardless of whether they carry a lens; if a caller names it, we
//      use it).
//   2. Relative-path stylesheet links inside the markdown, resolved against
//      the markdown file's own directory.
//   3. Absolute-URL stylesheet links inside the markdown, fetched over the
//      network.
//   4. Common conventional file locations relative to the markdown file,
//      walking up toward the repo root: globals.css, styles/globals.css,
//      src/app/globals.css, app/globals.css, src/styles/*.css. Stops at a
//      .git directory or the filesystem root, and caps how far it walks.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { loadSharedCode } from "./shared-code.mjs";

const CONVENTIONAL_FILES = [
  "globals.css",
  "styles/globals.css",
  "src/app/globals.css",
  "app/globals.css",
];
const MAX_WALK_LEVELS = 6;

function tokenCountOf(cssText) {
  const { extractTokens } = loadSharedCode();
  return extractTokens(cssText).length;
}

function findCssLinks(mdRaw) {
  // Reuses the real markdown parser (unmodified) to get the exact same
  // rendered anchor hrefs the browser's Lens would scan, instead of
  // reimplementing link extraction against the raw markdown text.
  const { parse } = loadSharedCode();
  const parsed = parse(mdRaw);
  const hrefs = [];
  const re = /<a href="([^"]+)"/g;
  let m;
  while ((m = re.exec(parsed.bodyHtml))) hrefs.push(m[1]);
  return hrefs.filter((href) => /\.css(\?.*)?$/i.test(href));
}

function isAbsoluteUrl(href) {
  return /^https?:\/\//i.test(href);
}

async function tryExplicit(explicitCssPaths, mdDir) {
  if (!explicitCssPaths || !explicitCssPaths.length) return null;
  const parts = [];
  const labels = [];
  for (const rawPath of explicitCssPaths) {
    const resolved = path.resolve(mdDir, rawPath);
    if (!existsSync(resolved) || statSync(resolved).isDirectory()) {
      throw new Error(`--css path not found: ${rawPath}`);
    }
    parts.push(readFileSync(resolved, "utf8"));
    labels.push(path.basename(resolved));
  }
  const text = parts.join("\n\n");
  return {
    text,
    label: labels.join(", "),
    rule: "--css flag",
    tokenCount: tokenCountOf(text),
  };
}

async function tryMarkdownLinks(mdRaw, mdDir) {
  const links = findCssLinks(mdRaw);
  for (const href of links) {
    try {
      if (isAbsoluteUrl(href)) {
        const res = await fetch(href);
        if (!res.ok) continue;
        const text = await res.text();
        const tokenCount = tokenCountOf(text);
        if (tokenCount > 0) {
          return {
            text,
            label: href,
            rule: "absolute link in markdown (fetched)",
            tokenCount,
          };
        }
      } else {
        const resolved = path.resolve(mdDir, href.replace(/^\.\//, ""));
        if (!existsSync(resolved) || statSync(resolved).isDirectory()) continue;
        const text = readFileSync(resolved, "utf8");
        const tokenCount = tokenCountOf(text);
        if (tokenCount > 0) {
          return {
            text,
            label: path.relative(mdDir, resolved) || path.basename(resolved),
            rule: "relative link in markdown",
            tokenCount,
          };
        }
      }
    } catch {
      // Unreachable/unreadable candidate: try the next one, never throw.
      continue;
    }
  }
  return null;
}

function conventionalCandidates(dir) {
  const candidates = CONVENTIONAL_FILES.map((rel) => path.join(dir, rel));
  const srcStylesDir = path.join(dir, "src/styles");
  if (existsSync(srcStylesDir) && statSync(srcStylesDir).isDirectory()) {
    const cssFiles = readdirSync(srcStylesDir)
      .filter((f) => f.toLowerCase().endsWith(".css"))
      .sort();
    for (const f of cssFiles) candidates.push(path.join(srcStylesDir, f));
  }
  return candidates;
}

function trySiblingWalk(mdDir) {
  let dir = mdDir;
  for (let level = 0; level < MAX_WALK_LEVELS; level++) {
    for (const candidate of conventionalCandidates(dir)) {
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        const text = readFileSync(candidate, "utf8");
        const tokenCount = tokenCountOf(text);
        if (tokenCount > 0) {
          return {
            text,
            label: path.relative(mdDir, candidate) || path.basename(candidate),
            rule: `sibling discovery (walked ${level === 0 ? "start dir" : level + " level(s) up"})`,
            tokenCount,
          };
        }
      }
    }
    if (existsSync(path.join(dir, ".git"))) break;
    const parent = path.dirname(dir);
    if (parent === dir) break; // filesystem root
    dir = parent;
  }
  return null;
}

export async function discoverStylesheets({ mdPath, mdRaw, explicitCssPaths }) {
  const mdDir = path.dirname(mdPath);

  const explicit = await tryExplicit(explicitCssPaths, mdDir);
  if (explicit) return explicit;

  const fromLinks = await tryMarkdownLinks(mdRaw, mdDir);
  if (fromLinks) return fromLinks;

  const fromSiblings = trySiblingWalk(mdDir);
  if (fromSiblings) return fromSiblings;

  return null;
}
