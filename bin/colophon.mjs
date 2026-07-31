#!/usr/bin/env node
// Colophon CLI — primary entry point. `colophon <file.md>` reads a markdown
// file, discovers any stylesheet that should arm the Design Lens, serves
// both on localhost (never file://, see README), and opens the default
// browser at that URL. See lib/discover-css.mjs for the stylesheet
// resolution order and lib/render-shell.mjs / lib/server.mjs for how the
// page reuses the extension's reader code unmodified.
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { discoverStylesheets } from "../lib/discover-css.mjs";
import { renderShellHtml } from "../lib/render-shell.mjs";
import { createServer } from "../lib/server.mjs";
import { openBrowser } from "../lib/open-browser.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function readVersion() {
  const pkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  return pkg.version;
}

const HELP = `colophon <file.md> [options]

Renders a markdown file with the Colophon reader and serves it on
localhost, opening the default browser at that URL.

Options:
  --port <n>       Port to serve on (default: an available port is chosen)
  --css <path>     Stylesheet to arm the Design Lens with (repeatable,
                    highest priority, always used)
  --no-open        Serve and print the URL only; do not launch a browser
  -h, --help       Show this help
  -v, --version    Print the installed version

Examples:
  colophon design.md
  colophon design.md --no-open
  colophon design.md --css ./tokens.css --port 4500
`;

function parseArgs(argv) {
  const args = { file: null, port: null, open: true, css: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") {
      args.help = true;
    } else if (a === "-v" || a === "--version") {
      args.version = true;
    } else if (a === "--no-open") {
      args.open = false;
    } else if (a === "--port") {
      args.port = argv[++i];
    } else if (a.startsWith("--port=")) {
      args.port = a.slice("--port=".length);
    } else if (a === "--css") {
      args.css.push(argv[++i]);
    } else if (a.startsWith("--css=")) {
      args.css.push(a.slice("--css=".length));
    } else if (!args.file && !a.startsWith("-")) {
      args.file = a;
    } else {
      args.unknown = args.unknown || [];
      args.unknown.push(a);
    }
  }
  return args;
}

function fail(message) {
  console.error(`colophon: ${message}`);
  process.exit(1);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(HELP);
    return;
  }
  if (args.version) {
    console.log(readVersion());
    return;
  }
  if (args.unknown && args.unknown.length) {
    fail(`unrecognized argument(s): ${args.unknown.join(", ")}\n\n${HELP}`);
  }
  if (!args.file) {
    fail(`missing file argument\n\n${HELP}`);
  }

  const mdPath = path.resolve(process.cwd(), args.file);

  if (!existsSync(mdPath)) {
    fail(`no such file: ${args.file}`);
  }
  const stat = statSync(mdPath);
  if (stat.isDirectory()) {
    fail(`${args.file} is a directory, not a file`);
  }
  if (!/\.(md|markdown)$/i.test(mdPath)) {
    fail(`${args.file} is not a markdown file (expected a .md or .markdown extension)`);
  }

  if (args.port != null && (!/^\d+$/.test(args.port) || Number(args.port) < 1 || Number(args.port) > 65535)) {
    fail(`--port must be a number between 1 and 65535, got: ${args.port}`);
  }

  const mdRaw = readFileSync(mdPath, "utf8");
  const filename = path.basename(mdPath);

  let cssResult;
  try {
    cssResult = await discoverStylesheets({ mdPath, mdRaw, explicitCssPaths: args.css });
  } catch (err) {
    fail(`stylesheet discovery failed: ${err.message}`);
  }

  const html = renderShellHtml({ mdRaw, filename, cssResult });
  const { server, start } = createServer({ filename, html });

  let port;
  try {
    port = await start(args.port ? Number(args.port) : 0);
  } catch (err) {
    if (err.code === "EADDRINUSE") {
      fail(`port ${args.port} is already in use`);
    }
    fail(`failed to start server: ${err.message}`);
  }

  const url = `http://127.0.0.1:${port}/${encodeURIComponent(filename)}`;

  console.log("");
  console.log(`  ${url}`);
  console.log("");
  if (cssResult) {
    console.log(
      `  Design Lens armed from ${cssResult.label} (${cssResult.rule}, ${cssResult.tokenCount} tokens)`,
    );
  } else {
    console.log("  Design Lens: no stylesheet discovered, reader will render without it");
  }
  console.log("");

  if (args.open) {
    openBrowser(url);
  }

  process.on("SIGINT", () => {
    server.close(() => process.exit(0));
  });
  process.on("SIGTERM", () => {
    server.close(() => process.exit(0));
  });
}

main().catch((err) => {
  console.error(`colophon: unexpected error: ${err.stack || err}`);
  process.exit(1);
});
