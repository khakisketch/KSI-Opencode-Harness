// session-audit.mjs — thin CLI + re-export over the single shared audit core.
// The canonical logic lives in global/plugins/ksi-session-evidence/core.mjs
// (shared with the managed Native session-evidence plugin); this file keeps
// the historical import path, public exports, and CLI behavior. Default input
// order is oldest-first; pass --newest-first when the audited array is newest
// first (operator-observed for the Native V2 /api/session/{id}/message
// surface). A wrong declaration flips after-last-change results; when array
// order is unconfirmed, treat the result as unknown instead of guessing.
import { auditMessages, summarizeAudits, auditPath } from '../global/plugins/ksi-session-evidence/core.mjs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export { auditMessages, summarizeAudits, auditPath };

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    process.stdout.write('Usage: node scripts/session-audit.mjs <session-json-file-or-directory> [--newest-first]\n');
    return;
  }
  const flags = args.filter((a) => a.startsWith('--'));
  const positionals = args.filter((a) => !a.startsWith('--'));
  const unknownFlag = flags.find((f) => f !== '--newest-first');
  if (unknownFlag || positionals.length !== 1) {
    process.stderr.write('Usage: node scripts/session-audit.mjs <session-json-file-or-directory> [--newest-first]\n');
    process.exit(1);
  }
  const order = flags.includes('--newest-first') ? 'newest-first' : 'oldest-first';
  try {
    const report = await auditPath(positionals[0], { order });
    // Summary fields plus inventory; the full per-file sessions payload is
    // intentionally omitted to keep CLI output small.
    process.stdout.write(`${JSON.stringify({ ...report.summary, inventory: report.inventory }, null, 2)}\n`);
  } catch {
    process.stdout.write('{"validSessions":0,"auditedSnapshots":0,"error":"targetUnavailable"}\n');
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
