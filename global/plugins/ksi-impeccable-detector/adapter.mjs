import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import * as core from './core.mjs';

const launcher = fileURLToPath(new URL('../../skills/impeccable/scripts/impeccable', import.meta.url));
const quote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`;

// Preserve the native tool's output, metadata and content; add only an observation.
export function annotate(event, reports) {
  if (!reports.length) return;
  const result = event.result;
  if (!result || typeof result !== 'object') return;
  const note = '\n\n[Impeccable source-only; non-blocking, not rendered UX verification]\n' + reports.map((report) => {
    const path = report.path ?? 'changed files';
    const state = report.status ?? 'unavailable';
    const findings = Array.isArray(report.findings) ? report.findings : [];
    const details = findings.slice(0, 5).map((finding) => `${finding.antipattern ?? finding.rule ?? finding.name ?? 'finding'}${finding.line ? `:${finding.line}` : ''}`).join(', ');
    return `${path}: ${state}${report.cached ? ' (cached)' : ''}${details ? ` — ${details}` : ''}${report.reason ? ` (${report.reason})` : ''}`;
  }).join('\n');
  const original = result.content ?? (typeof result.output === 'string' ? result.output : undefined);
  const content = typeof original === 'string'
    ? original + note
    : Array.isArray(original)
      ? [...original, { type: 'text', text: note }]
      : [{ type: 'text', text: note }];
  event.result = {
    ...result,
    content,
    // The Native host requires JSON-safe metadata; undefined-valued keys lose tool completion.
    metadata: { ...result.metadata, ksiImpeccable: JSON.parse(JSON.stringify(reports)) },
  };
}

export async function setup(ctx, dependencies = {}) {
  const extractPaths = dependencies.extractPaths ?? core.extractPaths;
  const selectTargets = dependencies.selectTargets;
  const scanTarget = dependencies.scanTarget ?? core.scanTarget;
  const engineLauncher = dependencies.launcher ?? launcher;
  const contextTimeoutMs = dependencies.contextTimeoutMs ?? 750;
  let busy = false;
  const registration = await ctx.tool.hook('execute.after', async (event) => {
    if (event.status !== 'completed') return;
    const paths = extractPaths(event);
    if (!paths.length) return;
    // A failed session lookup must not accidentally scan another session's checkout.
    let session;
    const controller = new AbortController();
    let timer;
    try {
      session = await Promise.race([
        ctx.session.get({ sessionID: event.sessionID }, { signal: controller.signal }),
        new Promise((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new Error('context timeout')); }, contextTimeoutMs);
        }),
      ]);
    }
    catch { annotate(event, [{ status: 'skipped', reason: 'session location unavailable' }]); return; }
    finally { clearTimeout(timer); }
    const directory = session?.location?.directory;
    if (!directory) { annotate(event, [{ status: 'skipped', reason: 'session location unavailable' }]); return; }
    let targets;
    const selectionReports = [];
    try {
      if (selectTargets) targets = await selectTargets(paths.slice(0, 64), directory);
      else {
        const verdicts = await core.selectTargetsDetailed(paths.slice(0, 64), directory);
        targets = verdicts.filter((verdict) => verdict.ok).map((verdict) => verdict.path);
        for (const verdict of verdicts.filter((verdict) => verdict.reason === 'too-large').slice(0, 8)) {
          selectionReports.push({ path: verdict.original, status: 'skipped', reason: 'file size limit' });
        }
      }
    }
    catch { annotate(event, [{ status: 'unavailable', reason: 'target selection failed' }]); return; }
    if (!targets.length) { annotate(event, selectionReports); return; }
    if (busy) { annotate(event, [{ status: 'skipped', reason: 'another source scan is running' }]); return; }
    busy = true;
    const reports = [...selectionReports];
    const start = performance.now();
    try {
      for (const target of targets.slice(0, 8)) {
        const path = typeof target === 'string' ? target : target.path;
        const remaining = 6000 - (performance.now() - start);
        if (remaining <= 0) { reports.push({ path, status: 'skipped', reason: 'event time limit' }); break; }
        const permission = { sessionID: event.sessionID, agent: event.agent, source: { type: 'tool', messageID: event.messageID, id: event.id }, metadata: { sourcePath: path, purpose: 'Impeccable source-only scan' } };
        // Native cancellation/denial must propagate, never be converted into a successful tool result.
        await ctx.permission.assert({ ...permission, action: 'read', resources: [path] });
        let denied;
        try {
          const report = await scanTarget(target, {
            launcher: engineLauncher,
            projectDir: directory,
            cacheKeyExtra: `${event.sessionID}:${event.agent}`,
            timeoutMs: Math.min(1500, remaining),
            maxOutputBytes: 65536,
            async authorizeRun({ executable, args }) {
              try {
                await ctx.permission.assert({ ...permission, action: 'shell', resources: [[executable, ...args].map(quote).join(' ')] });
              } catch (error) { denied = error; throw error; }
            },
          });
          reports.push({
            path,
            status: ({ pass: 'clean', issues: 'findings', error: 'unavailable' })[report.status] ?? report.status,
            exitCode: report.exitCode,
            cached: report.cached === true,
            reason: ['pass', 'issues'].includes(report.status) ? undefined : report.reason,
            findings: (report.findings ?? []).slice(0, 5).map(({ antipattern, rule, name, line, severity }) => ({ antipattern, rule, name, line, severity })),
          });
        } catch (error) {
          if (error === denied) throw error;
          reports.push({ path, status: 'unavailable', reason: 'detector could not scan this source' });
        }
      }
      if (targets.length > 8) reports.push({ status: 'skipped', reason: `${targets.length - 8} files exceed the event file limit` });
      if (paths.length > 64) reports.push({ status: 'skipped', reason: 'candidate path limit' });
      annotate(event, reports);
    } finally { busy = false; }
  });
  return () => registration.dispose();
}
