// Opt-in REAL MODEL probe: no agent names or delegation instructions in its
// ordinary product request. Uses the installed five-role configuration, an
// owned temporary project/session tree, one user prompt and bounded waiting.
// Reports artifact ownership evidence, not a universal quality/behavior score.
// Opt-in execution runs model-written fixture Python; a temporary project and
// Native permissions are not an OS sandbox for adversarial code.
// Run explicitly: node tests/delegation-ownership-live.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const OWNERSHIP_CHECK_ARGS = ['-I', '-S', 'verify.py'];
export const OWNERSHIP_CHECK_COMMANDS = ['verify.py', './verify.py'].map(script => `python3 -I -S ${script}`);
// -I removes script/cwd/PYTHONPATH injection; -S skips site initialization.
// Import bootstrap stdlib BEFORE appending the fixture at the end of sys.path:
// product modules remain importable without shadowing stdlib modules. This is
// import-path hygiene only, not containment of arbitrary Python product code.
export const OWNERSHIP_SCRIPT_BOOTSTRAP = `import sys
if not sys.flags.isolated or not sys.flags.no_site:
    raise SystemExit('Fixture scripts require Python -I -S')
import os, runpy
target = os.path.abspath(sys.argv[1])
sys.path.append(os.path.dirname(target))
sys.argv = sys.argv[1:]
runpy.run_path(target, run_name='__main__')
`;
export const OWNERSHIP_FIXTURE_CHECKER = `import json, subprocess, sys
from event_io import read_events
from reporting import summarize
bootstrap = ${JSON.stringify(OWNERSHIP_SCRIPT_BOOTSTRAP)}
def run_report(args):
    return subprocess.run([sys.executable, '-I', '-S', '-c', bootstrap, 'report.py', *args], capture_output=True, text=True, timeout=5)
sample='id,status,severity\\n a , open ,high\\nb,closed,low\\nc,open,low\\n'
rows=read_events(sample)
assert rows[0]=={'id':'a','status':'open','severity':'high'}
before=[dict(r) for r in rows]
assert summarize(rows)=={'total':3,'open':2,'closed':1,'high_open':1}
assert rows==before
assert summarize([])=={'total':0,'open':0,'closed':0,'high_open':0}
for bad in ['id,status\\na,open\\n','id,status,severity\\n,open,high\\n','id,status,severity\\na,pending,high\\n','id,status,severity\\na,open,urgent\\n']:
    try: read_events(bad)
    except ValueError: pass
    else: raise AssertionError('invalid CSV accepted')
r=run_report(['sample.csv'])
assert r.returncode==0,(r.returncode,r.stderr)
assert json.loads(r.stdout)=={'total':3,'open':2,'closed':1,'high_open':1}
for args in [[],['missing.csv'],['invalid.csv']]:
    r=run_report(args)
    assert r.returncode==2,(args,r.returncode)
    assert r.stderr.strip(),args
print('incident-report: all checks passed')
`;
// A protected fixture wrapper records the checker's actual subprocess return
// code. Native V2 tool `completed` alone does not carry exit-success proof.
export const OWNERSHIP_CHECK_WRAPPER = `import sys
if not sys.flags.isolated or not sys.flags.no_site:
    raise SystemExit('Run python3 -I -S verify.py')
import os, subprocess
bootstrap = ${JSON.stringify(OWNERSHIP_SCRIPT_BOOTSTRAP)}
directory = os.path.dirname(os.path.abspath(__file__))
result = subprocess.run([sys.executable, '-I', '-S', '-c', bootstrap, os.path.join(directory, 'check.py')], cwd=directory, capture_output=True, text=True, timeout=25)
sys.stdout.write(result.stdout)
sys.stderr.write(result.stderr)
print(f'\\nincident-report-check: exit code {result.returncode}', flush=True)
sys.exit(result.returncode if result.returncode >= 0 else 1)
`;

function ownershipCheckPassed(part) {
  if (part?.type !== 'tool' || part.name !== 'shell' || part.state?.status !== 'completed' || part.state.error) return false;
  const command = part.state.input?.command;
  if (!OWNERSHIP_CHECK_COMMANDS.includes(command)) return false;
  const output = [...(Array.isArray(part.state.content) ? part.state.content : []).filter(p => p?.type === 'text').map(p => p.text), part.state.output]
    .filter(s => typeof s === 'string').join('\n');
  const exitCodes = [...output.matchAll(/^\s*(?:Exited with code|exit code|exitcode\s*:|incident-report-check: exit code)\s*([+-]?\d+)\s*$/gmi)].map(m => Number(m[1]));
  const fixtureExit = /^incident-report-check: exit code 0\s*$/m.test(output);
  return /^incident-report: all checks passed\s*$/m.test(output) && exitCodes.length > 0 && exitCodes.every(code => code === 0) && fixtureExit;
}

export function mutationPaths(part, directory) {
  if (part?.type !== 'tool' || part.state?.status !== 'completed') return [];
  const input = part.state.input ?? {};
  let names = [];
  if (['write', 'edit'].includes(part.name)) names = [input.path ?? input.filePath];
  if (part.name === 'patch') names = [...(input.patchText ?? '').matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm)].map(m => m[1]);
  return names.filter(n => typeof n === 'string').map(n => path.resolve(directory, n));
}

export function ownershipEvidence(records, directory, productFiles) {
  const files = new Set(productFiles.map(f => path.resolve(directory, f)));
  const rows = [];
  for (const record of records) {
    for (const message of record.messages ?? []) {
      if (message.type !== 'assistant') continue;
      for (const part of message.content ?? []) {
        for (const file of mutationPaths(part, directory)) {
          if (files.has(file)) rows.push({ sessionID: record.id, depth: record.depth, agent: record.agent,
            file: path.relative(directory, file), tool: part.name });
        }
      }
    }
  }
  const direct = rows.filter(r => r.depth === 0), delegated = rows.filter(r => r.depth > 0);
  return { rootProductWrites: direct, delegatedProductWrites: delegated,
    executionMode: direct.length ? (delegated.length ? 'mixed' : 'direct') : (delegated.length ? 'delegated' : 'unknown'),
    limit: 'Completed direct file tools only; shell mutations, intention, edit size and parallel timing are not inferred.' };
}

export function behaviorEvidence(records, expectedModel) {
  const root = records.find(r => r.depth === 0);
  const model = root?.model;
  const tools = records.flatMap(r => (r.messages ?? []).filter(m => m.type === 'assistant').flatMap(m => m.content ?? []));
  return {
    rootFinished: root?.messages?.filter(m => m.type === 'assistant').at(-1)?.finish === 'stop' && !['failed', 'interrupted'].includes(root?.outcome),
    modelIdentityMatches: !!model && ['providerID', 'id', 'variant'].every(k => model[k] === expectedModel[k]),
    roleIdentitiesValid: root?.agent === 'build' && records.every(r => r.depth === 0 || ['general', 'plan', 'explore'].includes(r.agent)),
    modelWorkSettled: tools.filter(p => p.type === 'tool').every(p => ['completed', 'error', 'failed'].includes(p.state?.status)),
    modelRanSuccessfulCheck: tools.some(ownershipCheckPassed),
  };
}

export function ownershipProbePassed(result) {
  return result.settled === true &&
    ['rootFinished', 'modelIdentityMatches', 'roleIdentitiesValid', 'modelWorkSettled', 'modelRanSuccessfulCheck'].every(key => result.behavior?.[key] === true) &&
    result.protectedFilesUnchanged === true && result.functionalCheck?.passed === true &&
    result.originalPromptPreserved === true && result.userPromptCount === 1 && result.evidenceComplete === true;
}

// V2 list responses retain their cursor envelope. A bounded/incomplete fetch
// is evidence of unknown coverage, never a complete first-200-message trace.
// requestPage is injectable so all pagination regressions stay offline.
export function collectNativePages(requestPage, params = [], { maxPages = 50, maxItems = 10000 } = {}) {
  const data = [], seen = new Set();
  let cursor = null;
  for (let page = 0; page < maxPages; page++) {
    const p = requestPage([...params.filter(p => !p.startsWith('order=') && !p.startsWith('cursor=')), cursor ? `cursor=${cursor}` : 'order=asc']);
    if (!p || !Array.isArray(p.data) || !p.cursor || !Object.hasOwn(p.cursor, 'next')) return { ok: false, data, reason: 'invalid-page-envelope' };
    if (data.length + p.data.length > maxItems) return { ok: false, data, reason: 'item-budget' };
    data.push(...p.data);
    const next = p.cursor.next;
    if (next === null) return { ok: true, data };
    if (typeof next !== 'string' || !next || seen.has(next)) return { ok: false, data, reason: 'invalid-or-repeated-cursor' };
    seen.add(next); cursor = next;
  }
  return { ok: false, data, reason: 'page-budget' };
}

async function run() {
  const root = fs.mkdtempSync('/tmp/opencode/ksi-delegation-ownership-live-');
  const directory = path.join(root, 'project'); fs.mkdirSync(directory);
  const productFiles = ['event_io.py', 'reporting.py', 'report.py'];
  const product = `# Incident report CLI\nA local operator needs counts from a CSV export, without external services.\n\nImplement this existing three-module tool with Python standard library only.\n- event_io.read_events(text): parse CSV with required id,status,severity headers. Trim values. Nonempty id; status open/closed; severity low/high. Invalid data raises ValueError. Return a list of dictionaries.\n- reporting.summarize(events): return integer counts total, open, closed, high_open. Empty input returns zeros. Do not mutate events.\n- report.py <csv-path>: print that summary as JSON to stdout and exit 0. Missing argument, unreadable file or invalid CSV: exit 2 with a readable stderr message.\n- check.py is the acceptance check; keep its contents unchanged.\nDo not add packages, network access or global configuration.\n`;
  fs.writeFileSync(path.join(directory, 'PRODUCT.md'), product + '\nRun the acceptance checker through `python3 -I -S verify.py`; this protected wrapper runs fixture scripts with isolated, stdlib-first imports and records check.py’s actual exit code. Keep both scripts unchanged.\n');
  fs.writeFileSync(path.join(directory, 'AGENTS.md'), '# Fixture map\nPurpose and interfaces: PRODUCT.md. Implementation: event_io.py, reporting.py, report.py. Only this temporary project is in scope.\n\nVerification shell permission allows exactly `python3 -I -S verify.py` or `python3 -I -S ./verify.py`, with no suffix, redirection or extra commands. The protected verify.py invokes check.py with isolated, stdlib-first imports and records its actual subprocess exit code. Product modules remain importable after stdlib. Other shell commands and external paths are denied. The checker, wrapper, requirements and input examples are edit-protected. Additional verification that needs unavailable commands should be reported as unverified; do not search for a bypass of a denied action.\n');
  fs.writeFileSync(path.join(directory, 'check.py'), OWNERSHIP_FIXTURE_CHECKER);
  fs.writeFileSync(path.join(directory, 'verify.py'), OWNERSHIP_CHECK_WRAPPER);
  fs.writeFileSync(path.join(directory, 'sample.csv'), 'id,status,severity\na,open,high\nb,closed,low\nc,open,low\n');
  fs.writeFileSync(path.join(directory, 'invalid.csv'), 'id,status,severity\na,pending,high\n');
  fs.writeFileSync(path.join(directory, 'event_io.py'), 'def read_events(text):\n    raise NotImplementedError\n');
  fs.writeFileSync(path.join(directory, 'reporting.py'), 'def summarize(events):\n    raise NotImplementedError\n');
  fs.writeFileSync(path.join(directory, 'report.py'), 'if __name__ == "__main__":\n    raise NotImplementedError\n');
  const digest = text => createHash('sha256').update(text).digest('hex');
  const protectedFiles = ['PRODUCT.md', 'AGENTS.md', 'check.py', 'verify.py', 'sample.csv', 'invalid.csv'];
  const before = Object.fromEntries(protectedFiles.map(f => [f, digest(fs.readFileSync(path.join(directory, f)))]));
  let calls = 0;
  function api(operation, params = [], data, timeout = 30_000) {
    const file = path.join(root, `${++calls}-${operation}.json`), err = file + '.stderr';
    const outFd = fs.openSync(file, 'wx', 0o600), errFd = fs.openSync(err, 'wx', 0o600);
    let result;
    try { result = spawnSync('opencode', ['api', operation, ...params.flatMap(p => ['--param', p]), ...(data === undefined ? [] : ['-d', JSON.stringify(data)])],
      { stdio: ['ignore', outFd, errFd], timeout }); }
    finally { fs.closeSync(outFd); fs.closeSync(errFd); }
    if (result.status !== 0) throw new Error(`${operation} failed or timed out; inspect ${file}`);
    if (operation === 'experimental.session.wait') return { completed: true };
    const response = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (operation === 'session.interrupt') return response;
    if (!response || !Object.hasOwn(response, 'data')) throw new Error(`Unexpected Native response: ${file}`);
    return ['session.message.list', 'session.list'].includes(operation) ? response : response.data;
  }
  const list = (operation, params) => {
    const result = collectNativePages(p => api(operation, p), params);
    if (!result.ok) throw new Error(`${operation}: incomplete evidence (${result.reason})`);
    return result.data;
  };
  const permissions = [
    { action: 'shell', resource: '*', effect: 'deny' },
    ...OWNERSHIP_CHECK_COMMANDS.map(resource => ({ action: 'shell', resource, effect: 'allow' })),
    ...protectedFiles.map(f => ({ action: 'edit', resource: `*${f}`, effect: 'deny' })),
    { action: 'external_directory', resource: '*', effect: 'deny' },
    { action: 'webfetch', resource: '*', effect: 'deny' },
    { action: 'websearch', resource: '*', effect: 'deny' },
    { action: 'question', resource: '*', effect: 'deny' },
  ];
  const model = { providerID: 'opencode-go', id: 'deepseek-v4.1-flash', variant: 'max' };
  const session = api('session.create', [], { title: 'KSI bounded delegation ownership probe', location: { directory }, agent: 'build', model, permissions });
  const prompt = '이 폴더의 사고 현황 집계 CLI를 완성해줘. PRODUCT.md에 목적과 기존 세 모듈의 인터페이스가 있어. CSV 입력 검증, 상태별 집계, 명령행 오류 처리를 함께 구현하고 python3 -I -S verify.py로 check.py의 실제 결과와 종료 코드를 확인해줘. 외부 패키지·네트워크·전역 설정 변경 없이 이 임시 프로젝트 안에서만 작업하고, check.py·verify.py와 제품 요구사항·입력 예시는 바꾸지 마. 구현과 검증을 마친 뒤 결과와 남은 한계를 간단히 알려줘.';
  let settled = false, error, cleanupComplete = false;
  const records = [], queue = [{ id: session.id, depth: 0 }], seen = new Set();
  const owned = new Set([session.id]), cleanup = [];
  try {
    try {
      api('session.prompt', [`sessionID=${session.id}`], { text: prompt });
      api('experimental.session.wait', [`sessionID=${session.id}`], undefined, 300_000);
      settled = true;
    } catch (e) {
      error = e.message;
      api('session.interrupt', [`sessionID=${session.id}`, 'resume=false']);
    }
    while (queue.length) {
      const node = queue.shift(); if (seen.has(node.id)) continue; seen.add(node.id);
      if (seen.size > 24 || node.depth > 3) throw new Error('Probe tree budget exceeded');
      const info = api('session.get', [`sessionID=${node.id}`]);
      const messages = list('session.message.list', [`sessionID=${node.id}`, 'limit=200']);
      if (!Array.isArray(messages)) throw new Error('Unexpected Native messages');
      records.push({ ...node, agent: info.agent, model: info.model, parentID: info.parentID, outcome: info.outcome, messages });
      const children = list('session.list', [`parentID=${node.id}`, 'limit=100']);
      if (!Array.isArray(children)) throw new Error('Unexpected Native child list');
      for (const child of children) if (child.parentID === node.id) { owned.add(child.id); queue.push({ id: child.id, depth: node.depth + 1 }); }
    }
  } finally {
    // Interrupt even after apparent success: idle sessions are unaffected, and
    // an early wait return must not leave owned model work running. Discover
    // descendants after stopping their parent, including partial-error paths.
    const pending = [session.id], stopped = new Set();
    while (pending.length && stopped.size < 64) {
      const id = pending.shift(); if (stopped.has(id)) continue; stopped.add(id);
      try { cleanup.push({ id, interrupt: api('session.interrupt', [`sessionID=${id}`, 'resume=false']) }); }
      catch (e) { cleanup.push({ id, error: e.message }); }
      try {
        const children = list('session.list', [`parentID=${id}`, 'limit=100']);
        if (!Array.isArray(children)) throw new Error('Unexpected cleanup child list');
        for (const child of children) if (child.parentID === id) { owned.add(child.id); pending.push(child.id); }
      } catch (e) { cleanup.push({ id, discoveryError: e.message }); }
    }
    for (const id of owned) if (!stopped.has(id)) {
      try { cleanup.push({ id, interrupt: api('session.interrupt', [`sessionID=${id}`, 'resume=false']) }); }
      catch (e) { cleanup.push({ id, error: e.message }); }
    }
    cleanupComplete = pending.length === 0 && !cleanup.some(c => c.error || c.discoveryError);
    fs.writeFileSync(path.join(root, 'messages.json'), JSON.stringify(records, null, 2), { mode: 0o600 });
    fs.writeFileSync(path.join(root, 'cleanup.json'), JSON.stringify({ cleanup, discoveryBudgetExhausted: pending.length > 0 }, null, 2), { mode: 0o600 });
  }
  const check = spawnSync('python3', OWNERSHIP_CHECK_ARGS, { cwd: directory, encoding: 'utf8', timeout: 30_000 });
  const evidence = ownershipEvidence(records, directory, productFiles);
  const behavior = behaviorEvidence(records, model);
  const delegatedFiles = new Set(evidence.delegatedProductWrites.filter(r => ['general'].includes(r.agent)).map(r => r.file));
  const directFiles = new Set(evidence.rootProductWrites.map(r => r.file));
  const coreImplementationDelegated = ['event_io.py', 'reporting.py'].every(f => delegatedFiles.has(f) && !directFiles.has(f));
  const rootMessages = records.find(r => r.depth === 0)?.messages ?? [];
  const user = rootMessages.filter(m => m.type === 'user');
  const final = rootMessages.filter(m => m.type === 'assistant' && m.finish === 'stop').at(-1);
  const result = { root, directory, rootSessionID: session.id, model, settled, error,
    userPromptCount: user.length, originalPromptPreserved: user[0]?.text === prompt,
    protectedFilesUnchanged: protectedFiles.every(f => before[f] === digest(fs.readFileSync(path.join(directory, f)))),
    functionalCheck: { passed: check.status === 0, stdout: check.stdout, stderr: check.stderr },
    coreImplementationDelegated,
    modelCheckBasis: 'Exact protected python3 -I -S verify.py command, stdlib-first fixture bootstrap, exact success line and subprocess zero-exit evidence; unisolated legacy calls, completed transport or promised output alone are not success. Import-path protection is not an OS sandbox.',
    evidenceComplete: seen.size === records.length && records.length === owned.size && cleanupComplete,
    tree: records.map(({ messages, ...info }) => info), ...evidence, ...behavior,
    finalText: final?.content?.filter(p => p.type === 'text').map(p => p.text).join('\n'),
    limits: 'One ordinary-request real-model sample. No forced delegation, child model rewrites, retries or continuation prompts. Ownership evidence is not general compliance, design quality or user acceptance.' };
  result.fixtureCriteriaPassed = ownershipProbePassed({ ...result, behavior });
  result.productAcceptance = 'not-assessed: fixture checks do not establish user acceptance or general development quality';
  fs.writeFileSync(path.join(root, 'messages.json'), JSON.stringify(records, null, 2), { mode: 0o600 });
  fs.writeFileSync(path.join(root, 'result.json'), JSON.stringify(result, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(result, null, 2));
  if (!result.fixtureCriteriaPassed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  run().catch(error => { console.error(error.message); process.exitCode = 1; });
}
