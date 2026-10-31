import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const indexPath = join(repoRoot, 'dist', 'index.html');

test('dist/index.html exists and contains <title>', () => {
  assert.equal(existsSync(indexPath), true, `missing ${indexPath}`);
  const content = readFileSync(indexPath, 'utf8');
  assert.match(content, /<title>/);
});
