#!/usr/bin/env node
// Release preflight for maintainers.
//
// Repository-only tooling: this file is NOT part of the npm tarball (see the
// `files` list in package.json). Publishing, tag pushing and channel changes
// remain separate, explicitly authorized steps (docs/releasing.md).
//
// Usage:
//   npm run release:check        # pins + git state + source/package checks
//
// Exit code 0 means the local preflight passed; it does not authorize or
// perform any registry write.

import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function extractVersionPins(text) {
  const source = String(text ?? "");
  const pins = [];
  for (const match of source.matchAll(/package=ksi-opencode-harness@([0-9][^\s`"]*)/g)) {
    pins.push(match[1]);
  }
  for (const match of source.matchAll(/Beta\s+`([0-9][^`]*)`/g)) {
    pins.push(match[1]);
  }
  return pins;
}

export function checkVersionPins({ version, readme, install }) {
  const pins = [...extractVersionPins(readme), ...extractVersionPins(install)];
  const problems = [];
  if (pins.length === 0) {
    problems.push("no version pins found in README/INSTALL");
    return { ok: false, problems, pins };
  }
  for (const pin of pins) {
    if (pin !== version) {
      problems.push(`pin ${pin} does not match package version ${version}`);
    }
  }
  return { ok: problems.length === 0, problems, pins };
}

function git(args) {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  return {
    ok: result.status === 0,
    out: (result.stdout ?? "").trim(),
    err: (result.stderr ?? "").trim(),
  };
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: "utf8" });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  const tail = output.split("\n").slice(-3).join("\n");
  return { ok: result.status === 0, tail };
}

async function main() {
  const problems = [];

  const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
  const version = pkg.version;
  const readme = await readFile(join(ROOT, "README.md"), "utf8");
  const install = await readFile(join(ROOT, "INSTALL.md"), "utf8");

  const pins = checkVersionPins({ version, readme, install });
  console.log(`version: ${version}  |  pins: ${pins.pins.length}`);
  for (const problem of pins.problems) problems.push(`pins: ${problem}`);

  const status = git(["status", "--porcelain"]);
  if (!status.ok) problems.push(`git status failed: ${status.err}`);
  else if (status.out) problems.push(`working tree not clean:\n${status.out}`);

  const branch = git(["status", "--branch", "--porcelain"]);
  console.log(`git: ${branch.out.split("\n")[0] ?? "(unknown branch)"}`);

  const check = run("npm", ["run", "check"]);
  console.log(`npm run check: ${check.ok ? "pass" : "FAIL"}`);
  if (!check.ok) problems.push(`npm run check failed:\n${check.tail}`);

  const packageCheck = run("npm", ["run", "check:package"]);
  console.log(`npm run check:package: ${packageCheck.ok ? "pass" : "FAIL"}`);
  if (!packageCheck.ok) problems.push(`npm run check:package failed:\n${packageCheck.tail}`);

  console.log("");
  if (problems.length > 0) {
    console.log("release preflight: FAIL");
    for (const problem of problems) console.log(`- ${problem}`);
    process.exitCode = 1;
    return;
  }

  console.log("release preflight: pass");
  console.log("remaining manual steps (see docs/releasing.md):");
  console.log("- node scripts/verify-native-v2-isolated.mjs");
  console.log("- npm pack --dry-run --json  (review the tarball inventory)");
  console.log("- publish only with explicit authorization, then verify the registry");
  console.log(`- tag the release commit (v${version}) and push the tag after verification`);
}

const isMain =
  typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((error) => {
    console.error(`release-check: ${error?.message ?? error}`);
    process.exitCode = 1;
  });
}
