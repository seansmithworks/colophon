#!/usr/bin/env node
// Release packaging script. Plain Node, zero dependencies.
//
// Two jobs, run in sequence by `npm run package`:
// 1. sync-version: copy package.json's "version" into extension/manifest.json
//    so the two never drift (package.json is the single source of truth).
// 2. package: zip extension/ into dist/colophon-v<version>.zip, the exact
//    artifact a Chrome Web Store submission or a GitHub Release download
//    needs. manifest.json must sit at the ZIP ROOT, not nested inside an
//    "extension/" folder - that's the most common submission failure, so
//    this script verifies it before declaring success.

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const pkgPath = path.join(repoRoot, "package.json");
const manifestPath = path.join(repoRoot, "extension", "manifest.json");
const extensionDir = path.join(repoRoot, "extension");
const distDir = path.join(repoRoot, "dist");

function syncVersion() {
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  if (manifest.version === pkg.version) {
    console.log(`[sync-version] manifest.json already at ${pkg.version}`);
    return pkg.version;
  }

  manifest.version = pkg.version;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`[sync-version] manifest.json -> ${pkg.version}`);
  return pkg.version;
}

function buildZip(version) {
  mkdirSync(distDir, { recursive: true });
  const zipName = `colophon-v${version}.zip`;
  const zipPath = path.join(distDir, zipName);

  if (existsSync(zipPath)) rmSync(zipPath);

  // Run zip from inside extension/ so manifest.json lands at the zip root
  // (zipping the parent folder is the classic submission-breaking mistake).
  execFileSync(
    "zip",
    ["-r", "-X", zipPath, ".", "-x", "*.DS_Store", "-x", "__MACOSX/*"],
    { cwd: extensionDir, stdio: "inherit" },
  );

  // Verify manifest.json is unprefixed at the zip root.
  const listing = execFileSync("unzip", ["-l", zipPath], {
    encoding: "utf8",
  });
  const hasRootManifest = listing
    .split("\n")
    .some((line) => line.trim().endsWith("manifest.json") && !line.includes("/manifest.json"));

  if (!hasRootManifest) {
    throw new Error(
      `manifest.json is not at the zip root in ${zipPath}. Check the zip contents:\n${listing}`,
    );
  }

  console.log(`[package] wrote ${zipPath}`);
  return zipPath;
}

const syncOnly = process.argv.includes("--sync-only");
const version = syncVersion();
if (!syncOnly) buildZip(version);
