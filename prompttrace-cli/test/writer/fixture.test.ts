// test/writer/fixture.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseSessionFile } from '../../src/adapters/claude-code.js';
import { applyRules } from '../../src/sanitize/engine.js';
import { absPathRule } from '../../src/sanitize/rules/abs-path.js';
import { writePromptTrace } from '../../src/writer/prompttrace.js';

const here = dirname(fileURLToPath(import.meta.url));

test('writer output matches schema-v1/minimal.prompttrace.jsonl', async () => {
  const raw = await readFile(join(here, '../../fixtures/claude-code/minimal.jsonl'), 'utf8');
  const { session } = parseSessionFile(raw, 'sess-1');
  const { session: sanitized, stats } = applyRules(session, [absPathRule]);
  const output = writePromptTrace(sanitized, {
    title: 'Minimal fixture',
    summary: '',
    tags: [],
    rulesApplied: ['abs-path'],
    redactionCount: stats.total,
    exportedBy: 'prompttrace-cli/0.1.0',
    exportedAt: '2026-04-22T11:00:00Z',
  });
  const expected = await readFile(
    join(here, '../../fixtures/schema-v1/minimal.prompttrace.jsonl'),
    'utf8',
  );
  assert.equal(output, expected);
});
