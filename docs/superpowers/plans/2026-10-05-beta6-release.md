# Beta.6 delivery (source-direct flow release)

## Authorization and target

User approved ("그렇게 해줘") the proposed three-step release: update version pins to
0.5.0-beta.6, push GitHub main, and publish npm with tags next + latest. This delivers
the accumulated local improvements — design completion notifier, finish-and-report
default, work-report, guidance alignment, product-aware design flow, source-direct
frontend flow and the README alignment — through the existing GitHub main and public
npm. Keep all previous versions, the beta designation, the lightweight three-role
installer boundary and the host setup. Not another product deployment, service
restart, runtime/tool installation or replacement of the user-customized roles.

## Workspace and baseline

- Primary works in the clean canonical checkout
  /home/ksi/Desktop/KSI-Projects/KSI-Opencode-Harness; base HEAD 13ad872, one writer.
  Remote origin/main at c35a57a (beta.5 era), 25 local commits ahead at start.
- Registry preflight: dist-tags latest/next = 0.5.0-beta.5; 0.5.0-beta.6 unused (E404).
  The npm CLI session needs fresh standard browser approval (whoami E401); use the
  established pty + `--browser=false` path with user approval; no credential
  collection, CLI/auth-policy mutation or approval bypass.
- Four unrelated worktrees preserved; no product/mount/security change in this task.

## Checklist

- [x] Reconcile main/remote/registry/auth; confirm beta.6 unused.
- [x] Advance version guards and observe the expected RED against beta.5.
- [x] Bump manifest + paired README/INSTALL pins to beta.6; no runtime/role/installer
  behavior change.
- [x] Source/packed/isolated checks pass; tarball reviewed (18 files, integrity,
  byte-identical README/INSTALL/docs, pinned beta.6).
- [x] Commit release content; commit records; push main without force; verify remote
  HEAD.
- [x] Publish the reviewed tarball to npm next with standard browser approval; verify
  public bytes/integrity.
- [x] Promote latest with standard browser approval; verify next/latest and a fresh
  consumer.
- [x] Record delivery evidence; final verification.

## Evidence

- RED: guards advanced to beta.6 first — `npm run check` exit 1 (native installer
  version test) and `npm run check:package` exit 1 (actual beta.5 / expected beta.6).
  Logs /tmp/opencode/ksi-beta6-{version,package}-red.log.
- GREEN: `npm run check` exit 0 (112 tests / 111 pass / 0 fail / 1 opt-in skip),
  `npm run check:package` exit 0, `node scripts/verify-native-v2-isolated.mjs` exit 0.
  Logs /tmp/opencode/ksi-beta6-{check,package,isolated}.log.
- Tarball /tmp/opencode/ksi-opencode-harness-0.5.0-beta.6.tgz: 18 files; integrity
  `sha512-+IRDbChjCa9B/NyWgqFvo7rt48dkiTxBNyABfapCBJM+Fu7JDzaiIlfHiugjkATaA4O0MuuYYt7RV04b72chZA==`,
  shasum `44964fcd9f60fd18fb9545ec0c3e851b7b0f6b2c`, sha256
  `50c0e65198aa1b22d5905c25cfdb1e65ff925c25a63738554878ae0cb352b4d2`. README/INSTALL/
  opendesign.md/execution.md byte-identical to source; pins at beta.6. Pack record
  /tmp/opencode/ksi-beta6-pack.json.

## Delivery evidence

- Push: release content `7db2c46` + preparation record `a600480`; GitHub main
  advanced `c35a57a..a600480` and the verified remote HEAD matches local. No force
  push; four unrelated worktrees untouched.
- Registry: login completed via standard browser approval (identity `ksi-corp`);
  `0.5.0-beta.6` published with tag `next` (exact reviewed tarball), then promoted to
  `latest` via the same standard approval path. Public state: `latest` and `next`
  both `0.5.0-beta.6`; all previous versions retained; published integrity
  `sha512-+IRDbChj…t7RV04b72chZA==` and shasum `44964fcd…` match the reviewed tarball.
  No republish, no auth bypass, no credential collection.
- Fresh public consumer checks at beta.6: exact-version preview wrote nothing →
  apply created exactly the three role files → repeat returned `changes: []`;
  unversioned default install followed the same flow and wrote only `agents/`.
  Logs under /tmp/opencode/ksi-beta6-consumer.* and ksi-beta6-default.* dirs.
- Note: initial `npm exec` verification attempts returned 127 because the local
  packument cache predated the publish; `npm view --prefer-online` revalidation
  resolved it (a local cache effect, not a package defect — plain install and the
  revalidated exec both succeed). One long verification command was interrupted
  mid-run earlier; it was re-run bounded (`timeout`) and completed.
- This release carries documentation, guidance and installer content only; it is not
  evidence of live product design quality or user design acceptance.
