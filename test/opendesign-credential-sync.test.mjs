import test from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const script = fileURLToPath(new URL("../integrations/opendesign/sync-opencode-credentials.sh", import.meta.url))

// External Docker/sqlite are replaced so no real provider store, service or DB is touched.
// Catch the old failure: secret-bearing SQL persisted in the container volume after DB apply failed.
for (const dbExit of [0, 42]) {
  test(`credential sync streams SQL without a container secret file when DB apply exits ${dbExit}`, async () => {
    const root = await mkdtemp(join(tmpdir(), "ksi-sync-test-"))
    try {
      const bin = join(root, "bin")
      const tmp = join(root, "tmp")
      const dbDir = join(root, ".local/share/opencode")
      await Promise.all([mkdir(bin), mkdir(tmp), mkdir(dbDir, { recursive: true })])
      await writeFile(join(dbDir, "opencode.db"), "fixture only")
      await writeFile(join(bin, "sqlite3"), "#!/bin/sh\nprintf '%s\\n' \"INSERT INTO credential VALUES ('test', 'API key', 'fixture-secret');\"\n", { mode: 0o755 })
      await writeFile(join(bin, "docker"), `#!/usr/bin/env node
const fs = require('node:fs');
const cp = require('node:child_process');
const path = require('node:path');
const args = process.argv.slice(2);
const root = process.env.TEST_ROOT;
const secretPath = path.join(root, 'container-secret.sql');
const log = event => fs.appendFileSync(path.join(root, 'events'), event + '\\n');
const ci = args.indexOf('-c');
const cmd = ci < 0 ? '' : args[ci + 1];
if (cmd.includes('cat >')) {
  log('container-secret-created');
  const mapped = cmd.replaceAll('/home/open-design/.local/share/opencode/credentials-sync.sql', secretPath);
  const result = cp.spawnSync('sh', ['-c', mapped], {input: fs.readFileSync(0), env: process.env});
  process.exit(result.status ?? 1);
} else if (cmd.includes('better-sqlite3')) {
  if (cmd.includes('readFileSync(0')) {
    const sql = fs.readFileSync(0, 'utf8');
    if (!sql.includes("INSERT INTO credential") || !sql.includes('fixture-secret')) process.exit(43);
    log('sql-stream-received');
  }
  process.exit(Number(process.env.TEST_DB_EXIT));
} else if (args.includes('rm')) {
  fs.rmSync(secretPath, { force: true });
} else if (cmd.includes('opencode service stop')) {
  log('service-stopped');
} else if (cmd.includes('opencode auth list')) {
  console.log('test provider');
} else {
  console.error('unexpected Docker invocation'); process.exit(44);
}
`, { mode: 0o755 })
      const result = spawnSync("bash", [script], {
        encoding: "utf8",
        env: { PATH: `${bin}:${process.env.PATH}`, HOME: root, TMPDIR: tmp, TEST_ROOT: root, TEST_DB_EXIT: String(dbExit) },
        timeout: 15000,
      })
      assert.equal(result.status, dbExit, result.stderr)
      const events = await readFile(join(root, "events"), "utf8")
      assert.doesNotMatch(events, /container-secret-created/)
      assert.match(events, /service-stopped/)
      assert.match(events, /sql-stream-received/)
      assert.deepEqual(await readdir(tmp), [], "host secret temp must be cleaned on success and failure")
      assert.ok(!(await readdir(root)).includes("container-secret.sql"), "no persisted container SQL")
      assert.doesNotMatch(result.stdout + result.stderr, /fixture-secret/)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
}
