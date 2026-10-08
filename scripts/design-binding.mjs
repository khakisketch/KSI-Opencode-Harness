#!/usr/bin/env node
// Bounded advisory snapshot validation for the representative OpenDesign project.
//
// Compares the recorded Product binding identity/source against a caller-supplied
// design-projects snapshot (actual MCP `{projects:[...]}` list or a plain array
// fixture). It never creates/rebinds projects, never executes recorded
// commands/URLs and never performs network fetches. A snapshot match is captured
// metadata evidence only, not tool/permission/auth/render readiness, and lookup
// failure never authorizes creating a fresh project.
import { resolve, sep, isAbsolute } from "node:path";
import { realpathSync, readFileSync } from "node:fs";

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonical(root, candidate) {
  const absolute = resolve(root, candidate);
  try {
    return realpathSync(absolute);
  } catch {
    return absolute;
  }
}

function normalizeProjects(projects) {
  if (projects === undefined) return { absent: true };
  const list = Array.isArray(projects) ? projects : (isRecord(projects) && Array.isArray(projects.projects) ? projects.projects : null);
  if (list === null) {
    return { error: "Design projects snapshot container is malformed; expected an array or an MCP list shaped as {projects:[...]}." };
  }
  const seen = new Set();
  for (let index = 0; index < list.length; index += 1) {
    const record = list[index];
    if (!isRecord(record)) return { error: `Design projects snapshot record ${index} is malformed; expected an object.` };
    if (typeof record.id !== "string" || !record.id.trim()) {
      return { error: `Design projects snapshot record ${index} has a missing or wrong-type id; expected a non-empty string.` };
    }
    if (seen.has(record.id)) return { error: `Design projects snapshot has a duplicate id '${record.id}'; refusing to guess.` };
    seen.add(record.id);
    const metadata = record.metadata;
    if (metadata !== undefined && metadata !== null && !isRecord(metadata)) {
      return { error: `Design projects snapshot record '${record.id}' has malformed metadata; expected an object.` };
    }
    for (const [label, value] of [
      [`${record.id}.metadata.baseDir`, metadata?.baseDir],
      [`${record.id}.metadata.resolvedDir`, metadata?.resolvedDir],
      [`${record.id}.baseDir`, record.baseDir],
      [`${record.id}.resolvedDir`, record.resolvedDir],
    ]) {
      if (value !== undefined && value !== null && (typeof value !== "string" || !value.trim() || !isAbsolute(value))) {
        return { error: `Design projects snapshot directory '${label}' is malformed; expected a nonempty absolute path.` };
      }
    }
  }
  return { records: list };
}

// Inspect a recorded binding against a caller snapshot. States:
// matched (exact id plus agreeing source), unknown (identity not established and
// no guess is made), mismatch (identity found but source contradicts, or an
// explicit snapshot contradicts nothing matchable), ambiguous (several
// candidates, exact identity required), invalid (malformed input).
export function inspectDesignBinding({ repo = process.cwd(), binding = {}, projects } = {}) {
  let root;
  try {
    root = resolve(repo);
  } catch {
    return { state: "invalid", reasons: ["Requested repository path is malformed."], selectedId: null, expectedRoot: null };
  }
  if (!isRecord(binding)) {
    return { state: "invalid", reasons: ["Product binding is unavailable or malformed; refusing to infer identity."], selectedId: null, expectedRoot: null };
  }
  const recorded = binding["Design project"];
  if (recorded !== undefined && recorded !== null && recorded !== "" && (typeof recorded !== "string" || !recorded.trim())) {
    return { state: "invalid", reasons: ["Recorded Design project identity has the wrong type; expected a string."], selectedId: null, expectedRoot: null };
  }
  const sourceField = binding["Source workspace"] ?? binding.Repository ?? ".";
  if (sourceField !== undefined && sourceField !== null && (typeof sourceField !== "string" || !sourceField.trim())) {
    return { state: "invalid", reasons: ["Recorded source workspace has the wrong type; expected a string."], selectedId: null, expectedRoot: null };
  }
  const normalized = normalizeProjects(projects);
  if (normalized.error) {
    return { state: "invalid", reasons: [normalized.error], selectedId: null, expectedRoot: null };
  }
  const expectedRoot = canonical(root, sourceField ?? ".");
  const storage = binding["Design storage"];
  if (storage !== undefined && storage !== null) {
    if (typeof storage !== "string" || !storage.trim()) {
      return { state: "invalid", reasons: ["Recorded Design storage is malformed; expected a nonempty path."], selectedId: null, expectedRoot };
    }
    if (canonical(root, storage) !== expectedRoot) {
      return { state: "mismatch", reasons: ["Recorded Design storage contradicts the intended source workspace; reconcile the binding before selecting a project."], selectedId: null, expectedRoot };
    }
  }
  if (normalized.absent) {
    if (!recorded) {
      return { state: "unknown", reasons: ["No recorded Design project and no caller snapshot supplied; live project state is unverified."], selectedId: null, expectedRoot };
    }
    return { state: "unknown", reasons: [`No caller snapshot supplied; the recorded Design project '${recorded}' stays live-unverified. Lookup failure never creates a project.`], selectedId: null, expectedRoot };
  }
  const records = normalized.records;
  if (!recorded) {
    if (records.length === 0) {
      return { state: "unknown", reasons: ["No recorded Design project and the caller snapshot is empty; nothing to select."], selectedId: null, expectedRoot };
    }
    if (records.length === 1) {
      return { state: "unknown", reasons: [`No recorded Design project; refusing to select the only snapshot project '${records[0].id}' automatically.`], selectedId: null, expectedRoot };
    }
    return { state: "ambiguous", reasons: [`No recorded Design project and ${records.length} snapshot projects; exact recorded identity is required.`], selectedId: null, expectedRoot };
  }
  const exact = records.find((record) => record.id === recorded);
  if (!exact) {
    const named = records.filter((record) => record.name === recorded || record.title === recorded);
    if (named.length === 1) {
      return { state: "unknown", reasons: [`Snapshot project '${named[0].id}' matches by name-only; exact recorded id '${recorded}' is required, not a name.`], selectedId: null, expectedRoot };
    }
    if (named.length > 1) {
      return { state: "ambiguous", reasons: [`${named.length} snapshot projects share the name '${recorded}'; exact recorded id is required.`], selectedId: null, expectedRoot };
    }
    const partial = records.filter((record) => [record.id, record.name, record.title].some((value) => typeof value === "string" && value.includes(recorded)));
    if (partial.length === 1) {
      return { state: "unknown", reasons: [`Single substring candidate '${partial[0].id}' for '${recorded}'; refusing to guess by substring, exact id required.`], selectedId: null, expectedRoot };
    }
    if (partial.length > 1) {
      return { state: "ambiguous", reasons: [`${partial.length} snapshot projects contain '${recorded}'; exact recorded id is required, not a substring.`], selectedId: null, expectedRoot };
    }
    return { state: "unknown", reasons: [`Recorded Design project '${recorded}' is not in the caller snapshot (stale record or partial snapshot); lookup failure never creates a project.`], selectedId: null, expectedRoot };
  }
  const metadata = isRecord(exact.metadata) ? exact.metadata : {};
  const dirs = [metadata.baseDir, metadata.resolvedDir, exact.baseDir, exact.resolvedDir].filter((value) => value !== undefined && value !== null);
  if (dirs.length === 0) {
    return { state: "unknown", reasons: [`Exact recorded project id '${recorded}' is present, but source directories are unavailable; identity alone cannot establish source correspondence.`], selectedId: recorded, expectedRoot };
  }
  const canonicalDirs = dirs.map(value => canonical(root, value));
  if (new Set(canonicalDirs).size !== 1) {
    return { state: "mismatch", reasons: ["Snapshot source directories contradict each other; refusing to hide conflicting paths behind fallback precedence."], selectedId: recorded, expectedRoot };
  }
  const actual = canonicalDirs[0];
  if (actual === expectedRoot) {
    return { state: "matched", reasons: [`Exact recorded project id '${recorded}' matched and snapshot directories agree with the expected source root '${expectedRoot}' (metadata evidence only, not tool/permission/auth/render readiness).`], selectedId: recorded, expectedRoot };
  }
  if (expectedRoot.startsWith(actual + sep)) {
    return { state: "mismatch", reasons: [`Snapshot directory '${actual}' is an ancestor of the expected source root '${expectedRoot}', not the exact root; refusing to retarget silently.`], selectedId: recorded, expectedRoot };
  }
  if (actual.startsWith(expectedRoot + sep)) {
    return { state: "mismatch", reasons: [`Snapshot directory '${actual}' is nested inside the expected source root '${expectedRoot}', not the exact root.`], selectedId: recorded, expectedRoot };
  }
  return { state: "mismatch", reasons: [`Snapshot directories point at '${actual}', not the expected source root '${expectedRoot}'.`], selectedId: recorded, expectedRoot };
}

// Read a caller snapshot file for CLI parity. Throws a plain Error when the
// file is absent or unparsable; the caller reports it as unavailable/invalid.
export function readDesignSnapshotFile(path) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new Error(`Design projects snapshot file is unavailable: ${path}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Design projects snapshot file is malformed JSON: ${path}`);
  }
}
