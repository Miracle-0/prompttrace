// test/writer/prompttrace.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writePromptTrace } from '../../src/writer/prompttrace.js';
import type { Session } from '../../src/lib/session.js';

const session: Session = {
  meta: {
    sourceSessionId: 'sess-1',
    cwd: '/tmp',
    firstMessagePreview: 'hi',
    messageCount: 1,
    startedAt: '2026-04-22T10:00:00Z',
    endedAt: '2026-04-22T10:00:00Z',
  },
  messages: [
    {
      uuid: 'u1',
      parentUuid: null,
      role: 'user',
      timestamp: '2026-04-22T10:00:00Z',
      content: [{ type: 'text', text: 'hi' }],
    },
  ],
};

test('first line is meta record with schema_version 1 and source claude-code', () => {
  const out = writePromptTrace(session, {
    title: 'Demo',
    summary: '',
    tags: ['demo'],
    rulesApplied: ['abs-path'],
    redactionCount: 0,
    exportedBy: 'prompttrace-cli/0.1.0',
    exportedAt: '2026-04-22T11:00:00Z',
  });
  const lines = out.trimEnd().split('\n');
  const meta = JSON.parse(lines[0]);
  assert.equal(meta.type, 'meta');
  assert.equal(meta.schema_version, 1);
  assert.equal(meta.source, 'claude-code');
  assert.equal(meta.title, 'Demo');
  assert.deepEqual(meta.tags, ['demo']);
  assert.deepEqual(meta.sanitization, { rules_applied: ['abs-path'], redaction_count: 0 });
});

test('subsequent lines are message records preserving parent_uuid', () => {
  const out = writePromptTrace(session, {
    title: 'Demo',
    summary: '',
    tags: [],
    rulesApplied: [],
    redactionCount: 0,
    exportedBy: 'prompttrace-cli/0.1.0',
    exportedAt: '2026-04-22T11:00:00Z',
  });
  const lines = out.trimEnd().split('\n');
  assert.equal(lines.length, 2);
  const msg = JSON.parse(lines[1]);
  assert.equal(msg.type, 'message');
  assert.equal(msg.uuid, 'u1');
  assert.equal(msg.parent_uuid, null);
  assert.equal(msg.role, 'user');
  assert.deepEqual(msg.content, [{ type: 'text', text: 'hi' }]);
});

test('output ends with a trailing newline', () => {
  const out = writePromptTrace(session, {
    title: 'Demo',
    summary: '',
    tags: [],
    rulesApplied: [],
    redactionCount: 0,
    exportedBy: 'prompttrace-cli/0.1.0',
    exportedAt: '2026-04-22T11:00:00Z',
  });
  assert.ok(out.endsWith('\n'));
});
