// test/lib/git.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findGitRoot } from '../../src/lib/git.js';

test('returns the directory containing .git', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pt-git-'));
  await mkdir(join(root, '.git'));
  await mkdir(join(root, 'a', 'b'), { recursive: true });
  const found = await findGitRoot(join(root, 'a', 'b'));
  assert.equal(found, root);
});

test('returns null outside any git repo', async () => {
  const noGit = await mkdtemp(join(tmpdir(), 'pt-nogit-'));
  const found = await findGitRoot(noGit);
  assert.equal(found, null);
});

test('treats .git as file (worktree) the same as directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pt-wt-'));
  await writeFile(join(root, '.git'), 'gitdir: /elsewhere');
  const found = await findGitRoot(root);
  assert.equal(found, root);
});
