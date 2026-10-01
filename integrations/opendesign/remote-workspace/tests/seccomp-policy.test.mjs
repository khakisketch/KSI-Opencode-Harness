import test from 'node:test';
import assert from 'node:assert/strict';
import { createCodexSeccompProfile } from '../seccomp-policy.mjs';

test('preserves default-deny and every upstream rule; adds only nested namespace/mount rules', () => {
  const original = { defaultAction: 'SCMP_ACT_ERRNO', defaultErrnoRet: 1, archMap: [{ architecture: 'SCMP_ARCH_AARCH64', subArchitectures: ['SCMP_ARCH_ARM'] }], syscalls: [{ names: ['read'], action: 'SCMP_ACT_ALLOW', includes: { caps: ['CAP_AUDIT_READ'] } }] };
  const profile = createCodexSeccompProfile(original);
  assert.equal(profile.defaultAction, 'SCMP_ACT_ERRNO');
  assert.equal(profile.defaultErrnoRet, 1);
  assert.deepEqual(profile.archMap, original.archMap);
  assert.deepEqual(profile.syscalls[0], original.syscalls[0]);
  assert.equal(original.syscalls.length, 1);
  assert.deepEqual(profile.syscalls.flatMap(r => r.names), ['read', 'clone', 'unshare', 'mount', 'umount2', 'pivot_root']);
  const clone = profile.syscalls[1];
  assert.equal(clone.args[0].value, 0x10000000);
  assert.equal(clone.args[0].valueTwo, 0x10000000);
  assert.equal(clone.args[0].op, 'SCMP_CMP_MASKED_EQ');
  assert.deepEqual(clone.excludes.arches, ['s390', 's390x']);
  assert.equal(profile.syscalls[2].args[0].value, 0x81fdffff);
  assert.equal(profile.syscalls[2].args[0].valueTwo, 0);
});
test('refuses an allow-all base or unsupported architecture', () => {
  assert.throws(() => createCodexSeccompProfile({ defaultAction: 'SCMP_ACT_ALLOW', syscalls: [] }));
  assert.throws(() => createCodexSeccompProfile({ defaultAction: 'SCMP_ACT_ERRNO', syscalls: [] }, 's390x'));
});
