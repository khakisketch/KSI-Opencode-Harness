import path from 'node:path';
import { realpath, stat } from 'node:fs/promises';

const CREDENTIAL_ROOTS = ['.ssh', '.gnupg', '.codex', '.claude', '.gemini', '.config', '.local'];
export function workspaceError(message, status = 400, code = 'INVALID_WORKSPACE') {
  return Object.assign(new Error(message), { status, code });
}

function within(root, candidate) {
  const rel = path.relative(root, candidate);
  return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel));
}

export async function resolveWorkspacePath(input, { home, forSelection = false }) {
  if (typeof input !== 'string' || input.includes('\0') || input.length > 4096) throw workspaceError('Invalid directory path');
  const root = await realpath(home);
  const expanded = input === '~' ? root : input.startsWith('~/') ? path.join(root, input.slice(2)) : input;
  const lexical = path.resolve(root, expanded);
  if (!within(root, lexical)) throw workspaceError('Directory is outside the home browse root', 403);
  let canonical;
  try {
    canonical = await realpath(lexical);
    if (!(await stat(canonical)).isDirectory()) throw workspaceError('Select an existing directory');
  } catch (error) {
    if (error.status) throw error;
    throw workspaceError('Directory does not exist or is not accessible', error.code === 'EACCES' ? 403 : 404);
  }
  if (!within(root, canonical)) throw workspaceError('Symlink target is outside the home browse root', 403);
  if (forSelection) {
    if (canonical === root) throw workspaceError('Choose a project below home, not home itself', 403);
    for (const p of [lexical, canonical]) {
      if (CREDENTIAL_ROOTS.some(name => within(path.join(root, name), p))) throw workspaceError('Credential/configuration directory is not a project workspace', 403);
    }
  }
  return canonical;
}
