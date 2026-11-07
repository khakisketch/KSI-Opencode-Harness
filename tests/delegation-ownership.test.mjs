import { it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { mutationPaths, ownershipEvidence, behaviorEvidence, ownershipProbePassed, collectNativePages, OWNERSHIP_CHECK_COMMANDS, OWNERSHIP_CHECK_WRAPPER, OWNERSHIP_CHECK_ARGS, OWNERSHIP_FIXTURE_CHECKER } from './delegation-ownership-live.mjs';

const part = (name, input, status = 'completed') => ({ type: 'tool', name, state: { status, input } });
const fakeSubprocess = `class Result:
    stdout = 'incident-report: all checks passed\\n'
    stderr = ''
    returncode = 0
def run(*args, **kwargs):
    return Result()
`;
const invokeWrapper = (directory, extra = {}) => {
  const [executable, ...args] = OWNERSHIP_CHECK_COMMANDS[0].split(' ');
  return spawnSync(executable, args, { cwd: directory, encoding: 'utf8', timeout: 10000, ...extra });
};
it('accepts direct, delegated and mixed completion under the same product criteria', () => {
  const result = { settled: true, coreImplementationDelegated: false,
    behavior: { rootFinished: true, modelIdentityMatches: true, roleIdentitiesValid: true, modelWorkSettled: true, modelRanSuccessfulCheck: true },
    protectedFilesUnchanged: true, functionalCheck: { passed: true }, originalPromptPreserved: true, userPromptCount: 1, evidenceComplete: true };
  for (const mode of ['direct', 'delegated', 'mixed']) assert.equal(ownershipProbePassed({ ...result, executionMode: mode }), true, mode);
  for (const key of ['protectedFilesUnchanged', 'originalPromptPreserved', 'settled']) assert.equal(ownershipProbePassed({ ...result, [key]: false }), false, key);
  assert.equal(ownershipProbePassed({ ...result, functionalCheck: { passed: false } }), false);
  assert.equal(ownershipProbePassed({ ...result, evidenceComplete: false }), false);
  assert.equal(ownershipProbePassed({ ...result, behavior: {} }), false);
});
it('follows V2 next cursors without order and never labels a truncated page complete', () => {
  const requests = [];
  const first = Array.from({ length: 200 }, (_, id) => ({ id }));
  const r = collectNativePages(params => {
    requests.push(params);
    return params.includes('cursor=tail') ? { data: [{ id: 200 }], cursor: { next: null } } : { data: first, cursor: { next: 'tail' } };
  }, ['sessionID=owned', 'limit=200']);
  assert.equal(r.ok, true);
  assert.equal(r.data.length, 201);
  assert.ok(requests[0].includes('order=asc'));
  assert.ok(!requests[1].some(p => p.startsWith('order=')));
  for (const response of [{ data: first }, { data: first, cursor: {} }, null]) assert.equal(collectNativePages(() => response).ok, false);
  assert.equal(collectNativePages(() => ({ data: [], cursor: { next: 'repeat' } })).ok, false);
  assert.equal(collectNativePages(() => ({ data: first, cursor: { next: 'more' } }), [], { maxPages: 1 }).ok, false);
});
it('counts completed direct mutation tools, not reads, failed tools or shell intent', () => {
  assert.deepEqual(mutationPaths(part('edit', { path: 'event_io.py' }), '/project'), ['/project/event_io.py']);
  assert.deepEqual(mutationPaths(part('write', { filePath: '/project/reporting.py' }), '/project'), ['/project/reporting.py']);
  assert.deepEqual(mutationPaths(part('patch', { patchText: '*** Begin Patch\n*** Update File: event_io.py\n*** Add File: reporting.py\n*** End Patch' }), '/project'), ['/project/event_io.py', '/project/reporting.py']);
  for (const p of [part('read', { path: 'event_io.py' }), part('edit', { path: 'event_io.py' }, 'error'), part('shell', { command: 'touch event_io.py' })]) assert.deepEqual(mutationPaths(p, '/project'), []);
});
it('distinguishes actual parent and descendant product edits without crediting delegated investigation', () => {
  const records = [
    { id: 'root', depth: 0, agent: 'build', messages: [{ type: 'assistant', content: [part('write', { path: 'report.py' }), part('write', { path: 'notes.md' })] }] },
    { id: 'child', depth: 1, agent: 'general', messages: [{ type: 'assistant', content: [part('read', { path: 'event_io.py' })] }] },
    { id: 'worker', depth: 1, agent: 'general', messages: [{ type: 'assistant', content: [part('edit', { path: 'event_io.py' })] }] },
  ];
  const result = ownershipEvidence(records, '/project', ['event_io.py', 'report.py']);
  assert.deepEqual(result.rootProductWrites.map(r => r.file), ['report.py']);
  assert.deepEqual(result.delegatedProductWrites.map(r => r.sessionID), ['worker']);
  assert.equal(result.executionMode, 'mixed');
  assert.match(result.limit, /edit size.*parallel timing/);
});
it('requires actual model identity, a final stop and a model-run successful check separately', () => {
  const model = { providerID: 'fixture', id: 'same', variant: 'test' };
  const shell = part('shell', { command: OWNERSHIP_CHECK_COMMANDS[0] });
  shell.state.content = [{ type: 'text', text: 'incident-report: all checks passed\nincident-report-check: exit code 0' }];
  const records = [{ id: 'root', depth: 0, agent: 'build', model, messages: [{ type: 'assistant', finish: 'stop', content: [shell] }] }];
  assert.ok(Object.values(behaviorEvidence(records, model)).every(Boolean));
  assert.equal(behaviorEvidence(records, { ...model, id: 'other' }).modelIdentityMatches, false);
  records[0].messages[0].finish = 'tool-calls';
  assert.equal(behaviorEvidence(records, model).rootFinished, false);
  shell.state.content = [{ type: 'text', text: 'failed' }];
  assert.equal(behaviorEvidence(records, model).modelRanSuccessfulCheck, false);
  shell.state.content = [{ type: 'text', text: 'incident-report: all checks passed\nExited with code 1' }];
  assert.equal(behaviorEvidence(records, model).modelRanSuccessfulCheck, false);
  shell.state.status = 'running';
  assert.equal(behaviorEvidence(records, model).modelWorkSettled, false);
});
it('requires an exact successful check result and explicit zero-exit evidence', () => {
  const model = { providerID: 'fixture', id: 'same', variant: 'test' };
  const shell = part('shell', { command: OWNERSHIP_CHECK_COMMANDS[0] });
  const records = [{ id: 'root', depth: 0, agent: 'build', model, messages: [{ type: 'assistant', finish: 'stop', content: [shell] }] }];
  for (const output of [
    'incident-report: all checks passed',
    'I will print incident-report: all checks passed after running the check.',
    'I will print incident-report: all checks passed\nExited with code 0',
    'incident-report: all checks passed\nTraceback: checker actually failed',
    'incident-report: all checks passed\nExited with code 1',
    'incident-report: all checks passed\nExited with code -9',
    'incident-report: all checks passed\nExited with code 0',
  ]) {
    shell.state.content = [{ type: 'text', text: output }];
    const behavior = behaviorEvidence(records, model);
    assert.equal(behavior.modelRanSuccessfulCheck, false, output);
    assert.equal(ownershipProbePassed({ settled: true, behavior, protectedFilesUnchanged: true, functionalCheck: { passed: true }, originalPromptPreserved: true, userPromptCount: 1, evidenceComplete: true }), false, output);
  }
  shell.state.content = [{ type: 'text', text: 'incident-report: all checks passed\nincident-report-check: exit code 0' }];
  assert.equal(behaviorEvidence(records, model).modelRanSuccessfulCheck, true);
  for (const command of ['python3 verify.py', 'python3 ./verify.py', 'python3 check.py', 'python3 -I verify.py']) {
    shell.state.input.command = command;
    assert.equal(behaviorEvidence(records, model).modelRanSuccessfulCheck, false, command);
  }
});
it('runs the protected check wrapper offline and grades its real child exit code', () => {
  const parent = path.join(os.tmpdir(), 'opencode');
  fs.mkdirSync(parent, { recursive: true });
  const directory = fs.mkdtempSync(path.join(parent, 'ownership-wrapper-offline-'));
  const model = { providerID: 'fixture', id: 'same', variant: 'test' };
  try {
    fs.writeFileSync(path.join(directory, 'verify.py'), OWNERSHIP_CHECK_WRAPPER);
    for (const sample of [
      { code: "print('incident-report: all checks passed')\n", status: 0, passed: true },
      { code: "print('incident-report: all checks passed')\nraise SystemExit(7)\n", status: 7, passed: false },
      { code: "print('I will print incident-report: all checks passed later')\n", status: 0, passed: false },
    ]) {
      fs.writeFileSync(path.join(directory, 'check.py'), sample.code);
      const result = invokeWrapper(directory);
      assert.equal(result.error, undefined);
      assert.equal(result.status, sample.status);
      assert.match(result.stdout, new RegExp(`^incident-report-check: exit code ${sample.status}$`, 'm'));
      for (const command of OWNERSHIP_CHECK_COMMANDS) {
        const shell = part('shell', { command });
        shell.state.content = [{ type: 'text', text: result.stdout + result.stderr }];
        const records = [{ depth: 0, agent: 'build', model, messages: [{ type: 'assistant', finish: 'stop', content: [shell] }] }];
        assert.equal(behaviorEvidence(records, model).modelRanSuccessfulCheck, sample.passed, sample.code);
      }
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
it('does not accept a skipped checker from project-local subprocess shadowing', () => {
  const parent = path.join(os.tmpdir(), 'opencode');
  fs.mkdirSync(parent, { recursive: true });
  const directory = fs.mkdtempSync(path.join(parent, 'ownership-shadow-offline-'));
  try {
    fs.writeFileSync(path.join(directory, 'verify.py'), OWNERSHIP_CHECK_WRAPPER);
    fs.writeFileSync(path.join(directory, 'subprocess.py'), fakeSubprocess);
    fs.writeFileSync(path.join(directory, 'check.py'), "open('checker-ran', 'w').write('actually executed')\nprint('incident-report: all checks passed')\nraise SystemExit(7)\n");
    const result = invokeWrapper(directory);
    assert.equal(result.error, undefined);
    const shell = part('shell', { command: OWNERSHIP_CHECK_COMMANDS[0] });
    shell.state.content = [{ type: 'text', text: result.stdout + result.stderr }];
    const records = [{ depth: 0, agent: 'build', messages: [{ type: 'assistant', finish: 'stop', content: [shell] }] }];
    assert.equal(behaviorEvidence(records, {}).modelRanSuccessfulCheck, false, `false-pass output: ${result.stdout}`);
    assert.equal(result.status, 7, result.stderr);
    assert.equal(fs.readFileSync(path.join(directory, 'checker-ran'), 'utf8'), 'actually executed');
    assert.match(result.stdout, /^incident-report-check: exit code 7$/m);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
it('keeps checker stdlib imports ahead of local and PYTHONPATH json/runpy/subprocess shadows', () => {
  const parent = path.join(os.tmpdir(), 'opencode');
  fs.mkdirSync(parent, { recursive: true });
  const directory = fs.mkdtempSync(path.join(parent, 'ownership-path-shadow-offline-'));
  try {
    for (const source of ['project', 'environment']) {
      const project = path.join(directory, source), shadows = source === 'project' ? project : path.join(directory, 'pythonpath');
      fs.mkdirSync(project, { recursive: true }); fs.mkdirSync(shadows, { recursive: true });
      fs.writeFileSync(path.join(project, 'verify.py'), OWNERSHIP_CHECK_WRAPPER);
      fs.writeFileSync(path.join(shadows, 'subprocess.py'), fakeSubprocess);
      for (const name of ['json', 'runpy']) fs.writeFileSync(path.join(shadows, `${name}.py`), `raise AssertionError('${name} shadow imported')\n`);
      fs.writeFileSync(path.join(project, 'check.py'), "import json, runpy, subprocess, sys\nopen('checker-ran', 'w').write(json.dumps({'ran': True, 'optimized': sys.flags.optimize, 'isolated': sys.flags.isolated, 'no_site': sys.flags.no_site}))\nprint('incident-report: all checks passed')\nraise SystemExit(7)\n");
      const result = invokeWrapper(project, { env: { ...process.env, PYTHONPATH: shadows, PYTHONHOME: shadows, PYTHONOPTIMIZE: '1' } });
      assert.equal(result.error, undefined);
      assert.equal(result.status, 7, `${source}: ${result.stdout} ${result.stderr}`);
      assert.deepEqual(JSON.parse(fs.readFileSync(path.join(project, 'checker-ran'), 'utf8')), { ran: true, optimized: 0, isolated: 1, no_site: 1 });
      assert.match(result.stdout, /^incident-report-check: exit code 7$/m);
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
it('passes the real checker with all three product modules and stdlib shadows present', () => {
  const parent = path.join(os.tmpdir(), 'opencode');
  fs.mkdirSync(parent, { recursive: true });
  const directory = fs.mkdtempSync(path.join(parent, 'ownership-product-offline-'));
  try {
    fs.writeFileSync(path.join(directory, 'verify.py'), OWNERSHIP_CHECK_WRAPPER);
    fs.writeFileSync(path.join(directory, 'check.py'), OWNERSHIP_FIXTURE_CHECKER);
    fs.writeFileSync(path.join(directory, 'event_io.py'), `import csv, io
def read_events(text):
    reader = csv.DictReader(io.StringIO(text))
    required = ['id', 'status', 'severity']
    if not set(required).issubset(reader.fieldnames or []):
        raise ValueError('missing headers')
    result = []
    for row in reader:
        value = {key: (row.get(key) or '').strip() for key in required}
        if not value['id'] or value['status'] not in ('open', 'closed') or value['severity'] not in ('low', 'high'):
            raise ValueError('invalid event')
        result.append(value)
    return result
`);
    fs.writeFileSync(path.join(directory, 'reporting.py'), `def summarize(events):
    return {'total': len(events), 'open': sum(e['status'] == 'open' for e in events), 'closed': sum(e['status'] == 'closed' for e in events), 'high_open': sum(e['status'] == 'open' and e['severity'] == 'high' for e in events)}
`);
    fs.writeFileSync(path.join(directory, 'report.py'), `import json, sys
from event_io import read_events
from reporting import summarize
def main():
    if len(sys.argv) != 2:
        print('usage: report.py csv-path', file=sys.stderr)
        return 2
    try:
        with open(sys.argv[1]) as source:
            summary = summarize(read_events(source.read()))
    except (OSError, ValueError) as error:
        print(str(error), file=sys.stderr)
        return 2
    print(json.dumps(summary))
    return 0
if __name__ == '__main__':
    raise SystemExit(main())
`);
    fs.writeFileSync(path.join(directory, 'sample.csv'), 'id,status,severity\na,open,high\nb,closed,low\nc,open,low\n');
    fs.writeFileSync(path.join(directory, 'invalid.csv'), 'id,status,severity\na,pending,high\n');
    for (const name of ['subprocess', 'json', 'runpy']) fs.writeFileSync(path.join(directory, `${name}.py`), `raise AssertionError('${name} shadow imported')\n`);
    assert.equal(['python3', ...OWNERSHIP_CHECK_ARGS].join(' '), OWNERSHIP_CHECK_COMMANDS[0]);
    for (const command of OWNERSHIP_CHECK_COMMANDS) {
      const [executable, ...args] = command.split(' ');
      const result = spawnSync(executable, args, { cwd: directory, encoding: 'utf8', timeout: 10000, env: { ...process.env, PYTHONPATH: directory, PYTHONHOME: directory, PYTHONOPTIMIZE: '1' } });
      assert.equal(result.error, undefined);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /^incident-report: all checks passed$/m);
      assert.match(result.stdout, /^incident-report-check: exit code 0$/m);
    }
    fs.writeFileSync(path.join(directory, 'reporting.py'), "def summarize(events):\n    return {'total': 999, 'open': 0, 'closed': 0, 'high_open': 0}\n");
    const invalid = invokeWrapper(directory, { env: { ...process.env, PYTHONPATH: directory, PYTHONHOME: directory, PYTHONOPTIMIZE: '1' } });
    assert.equal(invalid.status, 1, invalid.stderr);
    assert.match(invalid.stdout, /^incident-report-check: exit code 1$/m);
    assert.doesNotMatch(invalid.stdout, /^incident-report: all checks passed$/m);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
it('does not credit an unexpected actor as one of the installed operating roles', () => {
  assert.equal(behaviorEvidence([{ depth: 0, agent: 'build', messages: [] }, { depth: 1, agent: 'build', messages: [] }], {}).roleIdentitiesValid, false);
});
