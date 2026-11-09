import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const WORKFLOW = path.join(REPO, '.github', 'workflows', 'opencode-review.yml');

test('on-demand review is comment-triggered, author-gated and comment-only', () => {
  const yml = readFileSync(WORKFLOW, 'utf8');

  assert.match(yml, /issue_comment:/);
  assert.match(yml, /author_association/);
  for (const role of ['OWNER', 'MEMBER', 'COLLABORATOR']) {
    assert.match(yml, new RegExp(role));
  }
  assert.match(yml, /contains\(github\.event\.comment\.body, '\/oc'\)/);
  assert.match(yml, /share: false/);
  assert.match(yml, /OPENCODE_API_KEY/);
  assert.doesNotMatch(yml, /contents:\s*write/);
  assert.doesNotMatch(yml, /pull-requests:\s*write/);
});
