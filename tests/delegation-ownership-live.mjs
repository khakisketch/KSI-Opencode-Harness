// Opt-in REAL MODEL probe: no agent names or delegation instructions in its
// ordinary product request. Uses the installed five-role configuration, an
// owned temporary project/session tree, one user prompt and bounded waiting.
// Reports artifact ownership evidence, not a universal quality/behavior score.
// Run explicitly: node tests/delegation-ownership-live.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

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
  return { rootProductWrites: rows.filter(r => r.depth === 0), delegatedProductWrites: rows.filter(r => r.depth > 0),
    limit: 'Completed direct file tools only; shell mutations, intention, edit size and parallel timing are not inferred.' };
}

export function behaviorEvidence(records, expectedModel) {
  const root = records.find(r => r.depth === 0);
  const model = root?.model;
  const tools = records.flatMap(r => (r.messages ?? []).filter(m => m.type === 'assistant').flatMap(m => m.content ?? []));
  return {
    rootFinished: root?.messages?.some(m => m.type === 'assistant' && m.finish === 'stop') === true,
    modelIdentityMatches: !!model && ['providerID', 'id', 'variant'].every(k => model[k] === expectedModel[k]),
    roleIdentitiesValid: root?.agent === 'build' && records.every(r => r.depth === 0 || ['lead', 'general', 'plan', 'explore'].includes(r.agent)),
    modelRanSuccessfulCheck: tools.some(p => p.type === 'tool' && p.name === 'shell' && p.state?.status === 'completed'
      && ['python3 check.py', 'python3 ./check.py'].includes(p.state.input?.command)
      && JSON.stringify(p.state.content ?? p.state.output ?? '').includes('incident-report: all checks passed')),
  };
}

async function run() {
  const root = fs.mkdtempSync('/tmp/opencode/ksi-delegation-ownership-live-');
  const directory = path.join(root, 'project'); fs.mkdirSync(directory);
  const productFiles = ['event_io.py', 'reporting.py', 'report.py'];
  const product = `# Incident report CLI\nA local operator needs counts from a CSV export, without external services.\n\nImplement this existing three-module tool with Python standard library only.\n- event_io.read_events(text): parse CSV with required id,status,severity headers. Trim values. Nonempty id; status open/closed; severity low/high. Invalid data raises ValueError. Return a list of dictionaries.\n- reporting.summarize(events): return integer counts total, open, closed, high_open. Empty input returns zeros. Do not mutate events.\n- report.py <csv-path>: print that summary as JSON to stdout and exit 0. Missing argument, unreadable file or invalid CSV: exit 2 with a readable stderr message.\n- check.py is the acceptance check; keep its contents unchanged.\nDo not add packages, network access or global configuration.\n`;
  const checker = `import json, subprocess, sys\nfrom event_io import read_events\nfrom reporting import summarize\nsample='id,status,severity\\n a , open ,high\\nb,closed,low\\nc,open,low\\n'\nrows=read_events(sample)\nassert rows[0]=={'id':'a','status':'open','severity':'high'}\nbefore=[dict(r) for r in rows]\nassert summarize(rows)=={'total':3,'open':2,'closed':1,'high_open':1}\nassert rows==before\nassert summarize([])=={'total':0,'open':0,'closed':0,'high_open':0}\nfor bad in ['id,status\\na,open\\n','id,status,severity\\n,open,high\\n','id,status,severity\\na,pending,high\\n','id,status,severity\\na,open,urgent\\n']:\n try: read_events(bad)\n except ValueError: pass\n else: raise AssertionError('invalid CSV accepted')\nr=subprocess.run([sys.executable,'report.py','sample.csv'],capture_output=True,text=True)\nassert r.returncode==0,(r.returncode,r.stderr)\nassert json.loads(r.stdout)=={'total':3,'open':2,'closed':1,'high_open':1}\nfor args in [[],['missing.csv'],['invalid.csv']]:\n r=subprocess.run([sys.executable,'report.py',*args],capture_output=True,text=True)\n assert r.returncode==2,(args,r.returncode)\n assert r.stderr.strip(),args\nprint('incident-report: all checks passed')\n`;
  fs.writeFileSync(path.join(directory, 'PRODUCT.md'), product);
  fs.writeFileSync(path.join(directory, 'AGENTS.md'), '# Fixture map\nPurpose and interfaces: PRODUCT.md. Implementation: event_io.py, reporting.py, report.py. Only this temporary project is in scope.\n\nVerification shell permission allows exactly `python3 check.py` or `python3 ./check.py`, with no suffix, redirection or extra commands. Other shell commands and external paths are denied. The checker, requirements and input examples are edit-protected. Additional verification that needs unavailable commands should be reported as unverified; do not search for a bypass of a denied action.\n');
  fs.writeFileSync(path.join(directory, 'check.py'), checker);
  fs.writeFileSync(path.join(directory, 'sample.csv'), 'id,status,severity\na,open,high\nb,closed,low\nc,open,low\n');
  fs.writeFileSync(path.join(directory, 'invalid.csv'), 'id,status,severity\na,pending,high\n');
  fs.writeFileSync(path.join(directory, 'event_io.py'), 'def read_events(text):\n    raise NotImplementedError\n');
  fs.writeFileSync(path.join(directory, 'reporting.py'), 'def summarize(events):\n    raise NotImplementedError\n');
  fs.writeFileSync(path.join(directory, 'report.py'), 'if __name__ == "__main__":\n    raise NotImplementedError\n');
  const digest = text => createHash('sha256').update(text).digest('hex');
  const protectedFiles = ['PRODUCT.md', 'AGENTS.md', 'check.py', 'sample.csv', 'invalid.csv'];
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
    return response.data;
  }
  const permissions = [
    { action: 'shell', resource: '*', effect: 'deny' },
    { action: 'shell', resource: 'python3 check.py', effect: 'allow' },
    { action: 'shell', resource: 'python3 ./check.py', effect: 'allow' },
    ...protectedFiles.map(f => ({ action: 'edit', resource: `*${f}`, effect: 'deny' })),
    { action: 'external_directory', resource: '*', effect: 'deny' },
    { action: 'webfetch', resource: '*', effect: 'deny' },
    { action: 'websearch', resource: '*', effect: 'deny' },
    { action: 'question', resource: '*', effect: 'deny' },
  ];
  const model = { providerID: 'opencode-go', id: 'deepseek-v4.1-flash', variant: 'max' };
  const session = api('session.create', [], { title: 'KSI bounded delegation ownership probe', location: { directory }, agent: 'build', model, permissions });
  const prompt = '이 폴더의 사고 현황 집계 CLI를 완성해줘. PRODUCT.md에 목적과 기존 세 모듈의 인터페이스가 있어. CSV 입력 검증, 상태별 집계, 명령행 오류 처리를 함께 구현하고 python3 check.py로 실제 결과를 확인해줘. 외부 패키지·네트워크·전역 설정 변경 없이 이 임시 프로젝트 안에서만 작업하고, check.py와 제품 요구사항·입력 예시는 바꾸지 마. 구현과 검증을 마친 뒤 결과와 남은 한계를 간단히 알려줘.';
  let settled = false, error;
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
      const messages = api('session.message.list', [`sessionID=${node.id}`, 'limit=200', 'order=asc']);
      if (!Array.isArray(messages)) throw new Error('Unexpected Native messages');
      records.push({ ...node, agent: info.agent, model: info.model, parentID: info.parentID, outcome: info.outcome, messages });
      const children = api('session.list', [`parentID=${node.id}`, 'limit=100']);
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
        const children = api('session.list', [`parentID=${id}`, 'limit=100']);
        if (!Array.isArray(children)) throw new Error('Unexpected cleanup child list');
        for (const child of children) if (child.parentID === id) { owned.add(child.id); pending.push(child.id); }
      } catch (e) { cleanup.push({ id, discoveryError: e.message }); }
    }
    for (const id of owned) if (!stopped.has(id)) {
      try { cleanup.push({ id, interrupt: api('session.interrupt', [`sessionID=${id}`, 'resume=false']) }); }
      catch (e) { cleanup.push({ id, error: e.message }); }
    }
    fs.writeFileSync(path.join(root, 'messages.json'), JSON.stringify(records, null, 2), { mode: 0o600 });
    fs.writeFileSync(path.join(root, 'cleanup.json'), JSON.stringify({ cleanup, discoveryBudgetExhausted: pending.length > 0 }, null, 2), { mode: 0o600 });
  }
  const check = spawnSync('python3', ['check.py'], { cwd: directory, encoding: 'utf8', timeout: 30_000 });
  const evidence = ownershipEvidence(records, directory, productFiles);
  const behavior = behaviorEvidence(records, model);
  const delegatedFiles = new Set(evidence.delegatedProductWrites.filter(r => ['lead', 'general'].includes(r.agent)).map(r => r.file));
  const directFiles = new Set(evidence.rootProductWrites.map(r => r.file));
  const coreImplementationDelegated = ['event_io.py', 'reporting.py'].every(f => delegatedFiles.has(f) && !directFiles.has(f));
  const rootMessages = records.find(r => r.depth === 0).messages;
  const user = rootMessages.filter(m => m.type === 'user');
  const final = rootMessages.filter(m => m.type === 'assistant' && m.finish === 'stop').at(-1);
  const result = { root, directory, rootSessionID: session.id, model, settled, error,
    userPromptCount: user.length, originalPromptPreserved: user[0]?.text === prompt,
    protectedFilesUnchanged: protectedFiles.every(f => before[f] === digest(fs.readFileSync(path.join(directory, f)))),
    functionalCheck: { passed: check.status === 0, stdout: check.stdout, stderr: check.stderr },
    coreImplementationDelegated,
    tree: records.map(({ messages, ...info }) => info), ...evidence, ...behavior,
    finalText: final?.content?.filter(p => p.type === 'text').map(p => p.text).join('\n'),
    limits: 'One ordinary-request real-model sample. No forced delegation, child model rewrites, retries or continuation prompts. Ownership evidence is not general compliance, design quality or user acceptance.' };
  fs.writeFileSync(path.join(root, 'messages.json'), JSON.stringify(records, null, 2), { mode: 0o600 });
  fs.writeFileSync(path.join(root, 'result.json'), JSON.stringify(result, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(result, null, 2));
  if (!settled || !coreImplementationDelegated || !Object.values(behavior).every(Boolean) || !result.protectedFilesUnchanged || !result.functionalCheck.passed || !result.originalPromptPreserved || user.length !== 1) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  run().catch(error => { console.error(error.message); process.exitCode = 1; });
}
