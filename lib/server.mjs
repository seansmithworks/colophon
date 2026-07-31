// Minimal static/HTML server for the CLI. Node's built-in http module only;
// no framework. Serves the rendered document at /<filename> and the shared
// reader files (unmodified from extension/) at fixed /__colophon/* paths.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createHttpServer } from "node:http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const STATIC_ASSETS = {
  "/__colophon/md-parser.js": {
    file: "extension/content/md-parser.js",
    type: "application/javascript; charset=utf-8",
  },
  "/__colophon/lens.js": {
    file: "extension/content/lens.js",
    type: "application/javascript; charset=utf-8",
  },
  "/__colophon/reader.js": {
    file: "extension/content/reader.js",
    type: "application/javascript; charset=utf-8",
  },
  "/__colophon/reader.css": {
    file: "extension/styles/reader.css",
    type: "text/css; charset=utf-8",
  },
};

export function createServer({ filename, html }) {
  const docPath = "/" + filename;

  const server = createHttpServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405).end("Method Not Allowed");
      return;
    }

    if (url.pathname === "/" || url.pathname === docPath) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(req.method === "HEAD" ? undefined : html);
      return;
    }

    const asset = STATIC_ASSETS[url.pathname];
    if (asset) {
      const body = readFileSync(path.join(repoRoot, asset.file));
      res.writeHead(200, { "Content-Type": asset.type });
      res.end(req.method === "HEAD" ? undefined : body);
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  });

  function start(port) {
    return new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", () => {
        server.removeListener("error", reject);
        resolve(server.address().port);
      });
    });
  }

  return { server, start };
}
