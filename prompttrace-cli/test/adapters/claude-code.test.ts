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

test('parseSessionFile surfaces shape-broken records without losing good ones', async () => {
  const raw = await readFile(
    join(here, '../../fixtures/claude-code/malformed.jsonl'),
    'utf8',
  );
  const { session, parseErrors } = parseSessionFile(raw, 'malformed-s');
  assert.equal(session.messages.length, 2);
  assert.equal(session.messages[0].uuid, 'u1');
  assert.equal(session.messages[1].uuid, 'u3');
  assert.equal(parseErrors.length, 1);
  assert.match(parseErrors[0].message, /missing message/);
});

test('parseSessionFile silently skips non-message record types', () => {
  const lines = [
    { type: 'system', uuid: 's1', parentUuid: null, timestamp: '', message: {} },
    { type: 'attachment', uuid: 'a1', parentUuid: null, timestamp: '', message: {} },
    { type: 'file-history-snapshot', uuid: 'f1', parentUuid: null, timestamp: '', message: {} },
    { type: 'last-prompt', uuid: 'l1', parentUuid: null, timestamp: '', message: {} },
    { type: 'permission-mode', uuid: 'p1', parentUuid: null, timestamp: '', message: {} },
    {
      type: 'user',
      uuid: 'u1',
      parentUuid: null,
      timestamp: '2026-04-22T10:00:00Z',
      message: { role: 'user', content: 'hi' },
    },
  ];
  const raw = lines.map((l) => JSON.stringify(l)).join('\n');
  const { session, parseErrors } = parseSessionFile(raw, 's');
  assert.equal(parseErrors.length, 0);
  assert.equal(session.messages.length, 1);
  assert.equal(session.messages[0].uuid, 'u1');
});

test('parseSessionFile remaps tool_result.content to internal output field', () => {
  const entry = {
    type: 'assistant',
    uuid: 'u1',
    parentUuid: null,
    timestamp: '2026-04-22T10:00:00Z',
    message: {
      role: 'assistant',
      content: [
        { type: 'text', text: 'ran it' },
        { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: '/a' } },
        { type: 'tool_result', tool_use_id: 't1', content: 'file body from /Users/andy/x' },
      ],
    },
  };
  const raw = JSON.stringify(entry);
  const { session } = parseSessionFile(raw, 's');
  const blocks = session.messages[0].content;
  assert.equal(blocks.length, 3);
  assert.equal(blocks[2].type, 'tool_result');
  if (blocks[2].type === 'tool_result') {
    assert.equal(blocks[2].output, 'file body from /Users/andy/x');
  }
});

test('parseSessionFile stringifies structured tool_result content', () => {
  const entry = {
    type: 'assistant',
    uuid: 'u1',
    parentUuid: null,
    timestamp: '',
    message: {
      role: 'assistant',
      content: [
        { type: 'tool_result', tool_use_id: 't1', content: [{ type: 'text', text: 'nested' }] },
      ],
    },
  };
  const { session } = parseSessionFile(JSON.stringify(entry), 's');
  const block = session.messages[0].content[0];
  assert.equal(block.type, 'tool_result');
  if (block.type === 'tool_result') {
    assert.match(block.output, /nested/);
  }
});
