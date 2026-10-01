import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

/** Explicit operator opt-in; never installed by KSI or selected by a browser request. */
export function createCodexSeccompProfile(base, architecture = process.arch) {
  if (!['arm64', 'x64'].includes(architecture)) throw new Error('Unsupported clone argument layout');
  if (base?.defaultAction !== 'SCMP_ACT_ERRNO' || !Array.isArray(base.syscalls)) throw new Error('Reviewed default-deny Docker profile required');
  const profile = structuredClone(base);
  profile.syscalls.push(
    { names: ['clone'], action: 'SCMP_ACT_ALLOW', args: [{ index: 0, value: 0x10000000, valueTwo: 0x10000000, op: 'SCMP_CMP_MASKED_EQ' }], excludes: { arches: ['s390', 's390x'] }, comment: 'Nested user namespace required; no host capabilities added' },
    { names: ['unshare'], action: 'SCMP_ACT_ALLOW', args: [{ index: 0, value: 0x81fdffff, valueTwo: 0, op: 'SCMP_CMP_MASKED_EQ' }], comment: 'Namespace flags only; kernel rejects flags above its 32-bit valid mask' },
    { names: ['mount', 'umount2', 'pivot_root'], action: 'SCMP_ACT_ALLOW', comment: 'Namespace-local CAP_SYS_ADMIN required by kernel; AppArmor mount filtering retained' },
  );
  return profile;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 4) throw new Error('Usage: node seccomp-policy.mjs <reviewed-default.json> <new-output.json>');
  const base = JSON.parse(await readFile(process.argv[2], 'utf8'));
  await writeFile(process.argv[3], JSON.stringify(createCodexSeccompProfile(base), null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}
