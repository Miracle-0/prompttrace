import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseSessionFile } from '../../src/adapters/claude-code.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, '../../fixtures/claude-code/minimal.jsonl');

test('parseSessionFile produces internal Session from minimal fixture', async () => {
  const raw = await readFile(fixturePath, 'utf8');
  const { session, parseErrors } = parseSessionFile(raw, 'minimal-session-id');
  assert.equal(parseErrors.length, 0);
  assert.equal(session.meta.sourceSessionId, 'minimal-session-id');
  assert.equal(session.meta.messageCount, 3);
  assert.equal(session.meta.cwd, '/Users/andy/proj/blog');
  assert.equal(session.messages[0].role, 'user');
  assert.equal(session.messages[0].parentUuid, null);
  assert.equal(session.messages[1].parentUuid, 'u1');
  assert.deepEqual(session.messages[0].content, [
    { type: 'text', text: 'Hello from /Users/andy/proj/blog' },
  ]);
});

test('parseSessionFile normalizes assistant content arrays', async () => {
  const raw = await readFile(fixturePath, 'utf8');
  const { session } = parseSessionFile(raw, 'x');
  const assistant = session.messages[1];
  assert.equal(assistant.role, 'assistant');
  assert.deepEqual(assistant.content, [{ type: 'text', text: 'Hi!' }]);
});
