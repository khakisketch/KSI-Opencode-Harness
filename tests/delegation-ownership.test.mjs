import { it } from 'node:test';
import assert from 'node:assert/strict';
import { mutationPaths, ownershipEvidence, behaviorEvidence } from './delegation-ownership-live.mjs';

const part = (name, input, status = 'completed') => ({ type: 'tool', name, state: { status, input } });
it('counts completed direct mutation tools, not reads, failed tools or shell intent', () => {
  assert.deepEqual(mutationPaths(part('edit', { path: 'event_io.py' }), '/project'), ['/project/event_io.py']);
  assert.deepEqual(mutationPaths(part('write', { filePath: '/project/reporting.py' }), '/project'), ['/project/reporting.py']);
  assert.deepEqual(mutationPaths(part('patch', { patchText: '*** Begin Patch\n*** Update File: event_io.py\n*** Add File: reporting.py\n*** End Patch' }), '/project'), ['/project/event_io.py', '/project/reporting.py']);
  for (const p of [part('read', { path: 'event_io.py' }), part('edit', { path: 'event_io.py' }, 'error'), part('shell', { command: 'touch event_io.py' })]) assert.deepEqual(mutationPaths(p, '/project'), []);
});
it('distinguishes actual parent and descendant product edits without crediting delegated investigation', () => {
  const records = [
    { id: 'root', depth: 0, agent: 'build', messages: [{ type: 'assistant', content: [part('write', { path: 'report.py' }), part('write', { path: 'notes.md' })] }] },
    { id: 'child', depth: 1, agent: 'lead', messages: [{ type: 'assistant', content: [part('read', { path: 'event_io.py' })] }] },
    { id: 'worker', depth: 2, agent: 'general', messages: [{ type: 'assistant', content: [part('edit', { path: 'event_io.py' })] }] },
  ];
  const result = ownershipEvidence(records, '/project', ['event_io.py', 'report.py']);
  assert.deepEqual(result.rootProductWrites.map(r => r.file), ['report.py']);
  assert.deepEqual(result.delegatedProductWrites.map(r => r.sessionID), ['worker']);
  assert.match(result.limit, /edit size.*parallel timing/);
});
it('requires actual model identity, a final stop and a model-run successful check separately', () => {
  const model = { providerID: 'fixture', id: 'same', variant: 'test' };
  const shell = part('shell', { command: 'python3 check.py' });
  shell.state.content = [{ type: 'text', text: 'incident-report: all checks passed' }];
  const records = [{ id: 'root', depth: 0, agent: 'build', model, messages: [{ type: 'assistant', finish: 'stop', content: [shell] }] }];
  assert.ok(Object.values(behaviorEvidence(records, model)).every(Boolean));
  assert.equal(behaviorEvidence(records, { ...model, id: 'other' }).modelIdentityMatches, false);
  records[0].messages[0].finish = 'tool-calls';
  assert.equal(behaviorEvidence(records, model).rootFinished, false);
  shell.state.content = [{ type: 'text', text: 'failed' }];
  assert.equal(behaviorEvidence(records, model).modelRanSuccessfulCheck, false);
});
it('does not credit an unexpected actor as one of the installed operating roles', () => {
  assert.equal(behaviorEvidence([{ depth: 0, agent: 'build', messages: [] }, { depth: 1, agent: 'build', messages: [] }], {}).roleIdentitiesValid, false);
});
