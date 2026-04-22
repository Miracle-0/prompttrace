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

// tool_use input uses only string values so naive rules (like uppercase) keep
// JSON syntax valid. Real rules target specific patterns, not keywords.
function makeMixedSession(): Session {
  return {
    meta: { sourceSessionId: 's', cwd: null, firstMessagePreview: '', messageCount: 1, startedAt: '', endedAt: '' },
    messages: [
      {
        uuid: 'u1',
        parentUuid: null,
        role: 'assistant',
        timestamp: '',
        content: [
          { type: 'text', text: 'hello' },
          { type: 'tool_use', id: 't1', name: 'read', input: { path: 'file', tag: 'a' } },
          { type: 'tool_result', tool_use_id: 't1', output: 'stdout' },
        ],
      },
    ],
  };
}

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

test('applyRules visits text, tool_use, and tool_result blocks', () => {
  const input = makeMixedSession();
  const { session: out } = applyRules(input, [upperRule]);
  const blocks = out.messages[0].content;
  assert.equal((blocks[0] as any).text, 'HELLO');
  assert.deepEqual((blocks[1] as any).input, { PATH: 'FILE', TAG: 'A' });
  assert.equal((blocks[2] as any).output, 'STDOUT');
});

test('applyRules sets fromToolResult=true only for tool_result blocks', () => {
  const seen: Array<{ input: string; fromToolResult: boolean }> = [];
  const spyRule: SanitizeRule = {
    id: 'spy',
    description: '',
    apply(input, ctx) {
      seen.push({ input, fromToolResult: ctx.fromToolResult });
      return { output: input, hits: 0 };
    },
  };
  applyRules(makeMixedSession(), [spyRule]);
  const toolResultCalls = seen.filter((s) => s.fromToolResult);
  assert.equal(toolResultCalls.length, 1);
  assert.equal(toolResultCalls[0].input, 'stdout');
  assert.ok(seen.some((s) => !s.fromToolResult && s.input === 'hello'));
  assert.ok(seen.some((s) => !s.fromToolResult && s.input.includes('"file"')));
});

test('applyRules aggregates hits across multiple rules and blocks', () => {
  const countRule: SanitizeRule = {
    id: 'count',
    description: '',
    apply: (i) => ({ output: i, hits: 2 }),
  };
  const { stats } = applyRules(makeMixedSession(), [upperRule, countRule]);
  assert.equal(stats.perRule.upper, 3);
  assert.equal(stats.perRule.count, 6);
  assert.equal(stats.total, 9);
});

test('applyRules skips a throwing rule but still runs the others', () => {
  const throwing: SanitizeRule = {
    id: 'bad',
    description: '',
    apply() { throw new Error('boom'); },
  };
  const { session: out, stats } = applyRules(session, [throwing, upperRule]);
  assert.equal((out.messages[0].content[0] as any).text, 'HI');
  assert.equal(stats.perRule.bad, 0);
  assert.equal(stats.perRule.upper, 1);
  assert.equal(stats.total, 1);
});

test('applyRules does not mutate the input session', () => {
  const input = makeMixedSession();
  const snapshot = JSON.parse(JSON.stringify(input));
  const { session: out } = applyRules(input, [upperRule]);
  assert.deepEqual(input, snapshot);
  assert.notStrictEqual(out, input);
  assert.notStrictEqual(out.messages, input.messages);
  assert.notStrictEqual(out.messages[0].content, input.messages[0].content);
});
