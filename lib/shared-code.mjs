// Loads the browser-side reader files into a Node vm context so the CLI can
// call their pure functions (markdown parsing, token extraction) directly,
// with zero forking or reimplementation. `extension/content/md-parser.js`
// and `extension/content/lens.js` are plain `window.X = (function(){...})()`
// closures with no browser-only APIs in the functions the CLI needs
// (md-parser's `parse()`, lens's `extractTokens()`), so running the exact
// same file text in a minimal `{ window: {} }` sandbox gives back the exact
// same behavior the browser gets, unmodified.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function runInSandbox(relativePath) {
  const source = readFileSync(path.join(repoRoot, relativePath), "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: relativePath });
  return sandbox.window;
}

let cached = null;

export function loadSharedCode() {
  if (cached) return cached;
  const parserWindow = runInSandbox("extension/content/md-parser.js");
  const lensWindow = runInSandbox("extension/content/lens.js");
  cached = {
    parse: parserWindow.ColophonParser.parse,
    extractTokens: lensWindow.ColophonLens.extractTokens,
  };
  return cached;
}
