// test/sanitize/engine.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyRules } from '../../src/sanitize/engine.js';
import type { SanitizeRule } from '../../src/sanitize/types.js';
import type { Session } from '../../src/lib/session.js';

const upperRule: SanitizeRule = {
  id: 'upper',
  description: 'shout',
  apply(input) {
    const output = input.toUpperCase();
    return { output, hits: input === output ? 0 : 1 };
  },
};

const session: Session = {
  meta: { sourceSessionId: 's', cwd: null, firstMessagePreview: '', messageCount: 1, startedAt: '', endedAt: '' },
  messages: [
    { uuid: 'u1', parentUuid: null, role: 'user', timestamp: '', content: [{ type: 'text', text: 'hi' }] },
  ],
};

test('applyRules mutates text blocks and reports per-rule hits', () => {
  const { session: out, stats } = applyRules(session, [upperRule]);
  assert.equal((out.messages[0].content[0] as any).text, 'HI');
  assert.equal(stats.perRule.upper, 1);
  assert.equal(stats.total, 1);
});

test('applyRules leaves session untouched when no rules match', () => {
  const noop: SanitizeRule = { id: 'noop', description: '', apply: (i) => ({ output: i, hits: 0 }) };
  const { stats } = applyRules(session, [noop]);
  assert.equal(stats.total, 0);
});
