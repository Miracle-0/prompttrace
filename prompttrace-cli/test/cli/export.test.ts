// test/cli/export.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runExport } from '../../src/cli/export.js';

const SAMPLE_JSONL = [
  JSON.stringify({
    type: 'user',
    uuid: 'u1',
    parentUuid: null,
    timestamp: '2026-04-22T10:00:00Z',
    cwd: '/Users/andy/proj/blog',
    message: { role: 'user', content: 'Hello from /Users/andy/proj/blog' },
  }),
  JSON.stringify({
    type: 'assistant',
    uuid: 'a1',
    parentUuid: 'u1',
    timestamp: '2026-04-22T10:00:05Z',
    message: { role: 'assistant', content: [{ type: 'text', text: 'Hi!' }] },
  }),
].join('\n') + '\n';

async function setupFakeEnv(): Promise<{ home: string; cwd: string; sessionId: string }> {
  const home = await mkdtemp(join(tmpdir(), 'pt-e2e-home-'));
  const cwd = await mkdtemp(join(tmpdir(), 'pt-e2e-cwd-'));
  await mkdir(join(cwd, '.git'), { recursive: true });
  const proj = '-Users-andy-proj-blog';
  await mkdir(join(home, '.claude', 'projects', proj), { recursive: true });
  const sessionId = 'sess-e2e';
  await writeFile(join(home, '.claude', 'projects', proj, `${sessionId}.jsonl`), SAMPLE_JSONL);
  return { home, cwd, sessionId };
}

test('runExport --yes writes sanitized .prompttrace.jsonl without prompts', async () => {
  const { home, cwd } = await setupFakeEnv();
  const originalHome = process.env.HOME;
  const originalCwd = process.cwd();
  process.env.HOME = home;
  process.chdir(cwd);
  try {
    const code = await runExport({ latest: true, fromHook: false, yes: true });
    assert.equal(code, 0);
    const files = await readdir(join(cwd, '.prompttrace'));
    assert.equal(files.length, 1);
    assert.match(files[0], /\.prompttrace\.jsonl$/);
    const contents = await readFile(join(cwd, '.prompttrace', files[0]), 'utf8');
    const lines = contents.split('\n').filter(Boolean);
    assert.ok(lines.length >= 2, 'should have meta + at least one message');
    const meta = JSON.parse(lines[0]);
    assert.equal(meta.type, 'meta');
    assert.equal(meta.schema_version, 1);
    assert.equal(meta.source, 'claude-code');
    assert.ok(meta.sanitization.rules_applied.includes('abs-path'));
    assert.ok(meta.sanitization.redaction_count >= 1);
    assert.ok(!contents.includes('/Users/andy/proj/blog'), 'abs path should be redacted');
    assert.ok(contents.includes('<REDACTED:ABS_PATH>'));
  } finally {
    process.chdir(originalCwd);
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
  }
});

test('runExport --from-hook exits 0 silently when no sessions exist', async () => {
  const home = await mkdtemp(join(tmpdir(), 'pt-e2e-empty-'));
  const originalHome = process.env.HOME;
  process.env.HOME = home;
  try {
    const code = await runExport({ latest: true, fromHook: true, yes: true });
    assert.equal(code, 0);
  } finally {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
  }
});

test('runExport returns 1 when an unknown sessionId is requested', async () => {
  const { home, cwd } = await setupFakeEnv();
  const originalHome = process.env.HOME;
  const originalCwd = process.cwd();
  process.env.HOME = home;
  process.chdir(cwd);
  try {
    const code = await runExport({
      sessionId: 'does-not-exist',
      latest: false,
      fromHook: false,
      yes: true,
    });
    assert.equal(code, 1);
  } finally {
    process.chdir(originalCwd);
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
  }
});
