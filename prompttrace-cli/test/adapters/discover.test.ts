// test/adapters/discover.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverSessions } from '../../src/adapters/claude-code.js';

test('discoverSessions lists .jsonl files across project subdirs, newest first', async () => {
  const home = await mkdtemp(join(tmpdir(), 'pt-home-'));
  const projects = join(home, '.claude', 'projects');
  const p1 = join(projects, '-Users-andy-proj1');
  const p2 = join(projects, '-Users-andy-proj2');
  await mkdir(p1, { recursive: true });
  await mkdir(p2, { recursive: true });
  await writeFile(join(p1, 'old.jsonl'), '');
  // slight wait to get distinct mtimes
  await new Promise((r) => setTimeout(r, 10));
  await writeFile(join(p2, 'new.jsonl'), '');
  const sessions = await discoverSessions(home);
  assert.equal(sessions.length, 2);
  assert.equal(sessions[0].id, 'new');
  assert.equal(sessions[1].id, 'old');
});

test('discoverSessions returns [] when ~/.claude/projects does not exist', async () => {
  const empty = await mkdtemp(join(tmpdir(), 'pt-empty-'));
  const sessions = await discoverSessions(empty);
  assert.deepEqual(sessions, []);
});
