// Operator-configured, project-bound PNG evidence only. Not an OS sandbox.
import { constants } from 'node:fs';
import { open, realpath, lstat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';

const fail = message => { throw new Error(`visual-workflow: ${message}`); };
const same = (a, b) => a.dev === b.dev && a.ino === b.ino;
const configFile = () => path.join(os.homedir(), '.config/opencode/ksi-visual-evidence.json');

// This fixed operator-owned file is deliberately independent of project config,
// XDG overrides and all model-supplied tool inputs. Never return its contents.
async function trustedConfiguration(project, directory) {
  const file = configFile(), uid = process.getuid?.();
  if (uid === undefined) fail('external evidence disabled: current-user ownership cannot be verified');
  try {
    for (let parent = path.dirname(file); ; parent = path.dirname(parent)) {
      const stat = await lstat(parent);
      if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.uid !== uid && stat.uid !== 0) || (stat.mode & 0o022)) fail('external evidence disabled: trusted configuration parent is insecure');
      if (parent === path.dirname(parent)) break;
    }
    if (await realpath(file) !== file) fail('external evidence disabled: trusted configuration path is not canonical');
    const fd = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
    try {
      const stat = await fd.stat(), named = await lstat(file);
      if (!stat.isFile() || stat.nlink !== 1 || named.isSymbolicLink() || !same(stat, named) || stat.uid !== uid || (stat.mode & 0o7777) !== 0o600 || stat.size > 65536) fail('external evidence disabled: trusted configuration must be an owner-only 0600 regular file with no hard links');
      const buffer = Buffer.alloc(65537); let count = 0;
      while (count < buffer.length) { const result = await fd.read(buffer, count, buffer.length - count, count); if (!result.bytesRead) break; count += result.bytesRead; }
      const end = await fd.stat();
      if (count > 65536 || end.nlink !== 1 || !same(stat, await lstat(file)) || !same(stat, end) || stat.size !== end.size || stat.mtimeMs !== end.mtimeMs || stat.ctimeMs !== end.ctimeMs || await realpath(file) !== file) fail('external evidence disabled: trusted configuration changed while reading');
      const bytes = buffer.subarray(0, count);
      let config;
      try { config = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { fail('external evidence disabled: malformed trusted configuration'); }
      if (!config || config.version !== 1 || !Array.isArray(config.externalEvidence) || config.externalEvidence.length > 128 || config.externalEvidence.some(entry => !entry || typeof entry !== 'object' || typeof entry.project !== 'string' || typeof entry.directory !== 'string' || !path.isAbsolute(entry.project) || !path.isAbsolute(entry.directory) || path.normalize(entry.project) !== entry.project || path.normalize(entry.directory) !== entry.directory)) fail('external evidence disabled: invalid trusted configuration');
      const directories = Array.isArray(directory) ? directory : [directory];
      if (directories.some(dir => !config.externalEvidence.some(entry => entry.project === project && entry.directory === dir))) fail('external PNG is not in the configured directory for this project');
      return `${stat.dev}:${stat.ino}:${createHash('sha256').update(bytes).digest('hex')}`;
    } finally { await fd.close(); }
  } catch (error) {
    if (error.code === 'ENOENT') fail('external evidence disabled: operator must create the fixed private ksi-visual-evidence.json; plugin options do not grant access');
    throw error;
  }
}

// One final fixed-file snapshot validates every external grant used by a tool
// call. It does not perform or replace the per-file Native permission checks.
export async function assertEvidenceConfiguration(project, checks, checkLive = () => {}) {
  if (!checks.length) return;
  checkLive();
  const identity = await trustedConfiguration(project, checks.map(check => path.dirname(check.file)));
  checkLive();
  if (checks.some(check => check.configIdentity !== identity)) fail('external evidence configuration changed before publication');
}

// Each entry binds one exact canonical project directory to one exact private
// evidence directory. No tool argument can create or extend this allowlist.
export async function externalEvidence(ctx, tc, project, name, maxBytes, checkLive = () => {}) {
  checkLive();
  if (typeof name !== 'string' || !path.isAbsolute(name) || !/\.png$/i.test(name)) fail('external PNG requires an absolute PNG path and the fixed operator-owned configuration; plugin options do not grant access');
  const directory = path.dirname(name);
  const configIdentity = await trustedConfiguration(project, directory);
  const temp = await realpath(os.tmpdir());
  if (directory === path.parse(directory).root || ['/tmp', '/private/tmp', '/tmp/opencode', '/private/tmp/opencode', temp].includes(directory) || path.normalize(directory) !== directory || path.normalize(name) !== name) fail('invalid external evidence directory');
  const checkDirectory = async () => {
    if (await realpath(directory) !== directory) fail('external evidence directory must be canonical and not a symlink');
    const stat = await lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o777) !== 0o700 || (typeof process.getuid === 'function' && stat.uid !== process.getuid())) fail('external evidence directory must be owner-only 0700');
    return stat;
  };
  const dir = await checkDirectory();
  if (await realpath(name) !== name) fail('external PNG path must be canonical and not a symlink');
  const assert = (action, resource) => ctx.permission.assert({ sessionID: tc.sessionID, agent: tc.agent, source: { type: 'tool', messageID: tc.messageID, id: tc.id }, action, resources: [resource] });
  await assert('external_directory', `${directory}/*`);
  await assert('read', name);
  checkLive();
  if (await trustedConfiguration(project, directory) !== configIdentity) fail('external evidence configuration changed');
  // Permission prompts can pause arbitrarily: repeat checks before and after
  // opening, compare the opened inode with the directory entry, and read only
  // from that descriptor. This narrows races; JS path APIs are not openat(2).
  if (!same(dir, await checkDirectory()) || await realpath(name) !== name) fail('external PNG path changed during permission check');
  const fd = await open(name, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    const stat = await fd.stat(), named = await lstat(name);
    if (!same(stat, named) || !same(dir, await checkDirectory()) || await realpath(name) !== name || !stat.isFile() || stat.nlink !== 1 || named.isSymbolicLink() || (stat.mode & 0o777) !== 0o600 || (typeof process.getuid === 'function' && stat.uid !== process.getuid()) || stat.size > maxBytes) fail('external PNG must be an unchanged owner-only 0600 regular file with no hard links');
    const bytes = Buffer.alloc(maxBytes + 1); let count = 0;
    while (count < bytes.length) { const result = await fd.read(bytes, count, bytes.length - count, count); if (!result.bytesRead) break; count += result.bytesRead; }
    const final = await fd.stat();
    if (count > maxBytes || final.nlink !== 1 || !same(stat, final) || final.size !== stat.size || final.mtimeMs !== stat.mtimeMs || final.ctimeMs !== stat.ctimeMs || !same(stat, await lstat(name)) || !same(dir, await checkDirectory()) || await realpath(name) !== name) fail('external PNG changed or exceeded budget');
    checkLive();
    if (await trustedConfiguration(project, directory) !== configIdentity) fail('external evidence configuration changed');
    return { file: name, bytes: bytes.subarray(0, count), configIdentity };
  } finally { await fd.close(); }
}
