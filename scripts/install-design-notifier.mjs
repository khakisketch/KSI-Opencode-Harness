#!/usr/bin/env node
// Install, verify, or remove the pinned design-notifier plugin copy.
//
// The runtime should not load the live development tree: a pinned copy under
// the OpenCode config directory means repo edits no longer reload the running
// service. Run this script after verified changes:
//
//   node scripts/install-design-notifier.mjs           # install/update the copy
//   node scripts/install-design-notifier.mjs --verify  # compare copy to manifest
//   node scripts/install-design-notifier.mjs --uninstall
//
// The manifest (`installed.json`) records the source commit and a SHA256 per
// file so drift is detectable.

import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const PLUGIN_NAME = "ksi-design-notifier";

export function resolveTargetDir({ env = process.env, home = homedir() } = {}) {
  const configHome =
    typeof env.XDG_CONFIG_HOME === "string" && env.XDG_CONFIG_HOME.trim()
      ? env.XDG_CONFIG_HOME.trim()
      : join(home, ".config");
  return join(configHome, "opencode", "plugins", "design-notifier");
}

export function resolveSourceDir(scriptURL = import.meta.url) {
  const here = dirname(fileURLToPath(scriptURL));
  return resolve(join(here, "..", "plugins", "design-notifier"));
}

async function walkFiles(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(root, full)));
    } else if (entry.isFile()) {
      files.push(relative(root, full).split(sep).join("/"));
    }
  }
  return files.sort();
}

export async function hashTree(root) {
  const files = await walkFiles(root);
  const hashes = {};
  for (const file of files) {
    const data = await readFile(join(root, file));
    hashes[file] = createHash("sha256").update(data).digest("hex");
  }
  return hashes;
}

async function readPackageName(dir) {
  try {
    const pkg = JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
    return typeof pkg.name === "string" ? pkg.name : null;
  } catch {
    return null;
  }
}

async function assertOwnedTarget(targetDir) {
  let info = null;
  try {
    info = await stat(targetDir);
  } catch {
    return; // does not exist yet
  }
  if (!info.isDirectory()) throw new Error(`target exists and is not a directory: ${targetDir}`);
  const name = await readPackageName(targetDir);
  if (name !== PLUGIN_NAME) {
    throw new Error(
      `refusing to touch ${targetDir}: package name is ${JSON.stringify(name)}, expected ${PLUGIN_NAME}`,
    );
  }
}

export async function installDesignNotifier({
  sourceDir = resolveSourceDir(),
  targetDir = resolveTargetDir(),
  now = () => new Date(),
  commit = null,
} = {}) {
  await assertOwnedTarget(targetDir);
  await rm(targetDir, { recursive: true, force: true });
  await mkdir(dirname(targetDir), { recursive: true });
  await cp(sourceDir, targetDir, { recursive: true, force: true });
  const pkg = JSON.parse(await readFile(join(targetDir, "package.json"), "utf8"));
  const files = await hashTree(targetDir);
  const manifest = {
    plugin: PLUGIN_NAME,
    version: typeof pkg.version === "string" ? pkg.version : null,
    commit,
    sourceDir,
    installedAt: now().toISOString(),
    files,
  };
  await writeFile(join(targetDir, "installed.json"), `${JSON.stringify(manifest, null, 2)}\n`, {
    mode: 0o600,
  });
  return manifest;
}

export async function verifyInstall({ targetDir = resolveTargetDir() } = {}) {
  await assertOwnedTarget(targetDir);
  let manifest;
  try {
    manifest = JSON.parse(await readFile(join(targetDir, "installed.json"), "utf8"));
  } catch {
    return { ok: false, reason: "installed.json missing or unreadable" };
  }
  const expected = manifest.files && typeof manifest.files === "object" ? manifest.files : {};
  const actual = await hashTree(targetDir);
  const changed = [];
  const missing = [];
  for (const [file, hash] of Object.entries(expected)) {
    if (!(file in actual)) missing.push(file);
    else if (actual[file] !== hash) changed.push(file);
  }
  const extra = Object.keys(actual).filter(
    (file) => file !== "installed.json" && !(file in expected),
  );
  return {
    ok: changed.length === 0 && missing.length === 0 && extra.length === 0,
    version: manifest.version ?? null,
    commit: manifest.commit ?? null,
    installedAt: manifest.installedAt ?? null,
    changed,
    missing,
    extra,
  };
}

export async function uninstallDesignNotifier({ targetDir = resolveTargetDir() } = {}) {
  await assertOwnedTarget(targetDir);
  await rm(targetDir, { recursive: true, force: true });
  return { removed: targetDir };
}

function gitCommit(cwd) {
  try {
    const result = spawnSync("git", ["-C", cwd, "rev-parse", "HEAD"], { encoding: "utf8" });
    if (result.status === 0) return result.stdout.trim();
  } catch {}
  return null;
}

async function main(argv) {
  const args = argv.filter((arg) => arg !== "--");
  const uninstall = args.includes("--uninstall");
  const verify = args.includes("--verify");
  const targetArg = args.includes("--target") ? args[args.indexOf("--target") + 1] : undefined;
  const sourceArg = args.includes("--source") ? args[args.indexOf("--source") + 1] : undefined;

  const sourceDir = sourceArg ? resolve(sourceArg) : resolveSourceDir();
  const targetDir = targetArg ? resolve(targetArg) : resolveTargetDir();

  if (uninstall) {
    const result = await uninstallDesignNotifier({ targetDir });
    console.log(`removed ${result.removed}`);
    return;
  }
  if (verify) {
    const result = await verifyInstall({ targetDir });
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.ok ? 0 : 1;
    return;
  }
  const manifest = await installDesignNotifier({
    sourceDir,
    targetDir,
    commit: gitCommit(resolve(join(dirname(fileURLToPath(import.meta.url)), ".."))),
  });
  console.log(`installed ${manifest.plugin}@${manifest.version} -> ${targetDir}`);
  console.log(`commit ${manifest.commit ?? "(unknown)"}  files ${Object.keys(manifest.files).length}`);
  console.log("If a plugins config entry pointed at the development tree, remove it so only the pinned copy loads.");
}

const isMain =
  typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`install-design-notifier: ${error?.message ?? error}`);
    process.exitCode = 1;
  });
}
