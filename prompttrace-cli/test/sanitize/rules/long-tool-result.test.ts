// test/sanitize/rules/long-tool-result.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { longToolResultRule } from '../../../src/sanitize/rules/long-tool-result.js';

test('only fires inside tool_result context', () => {
  const big = 'x'.repeat(100_000);
  const { output, hits } = longToolResultRule.apply(big, { fromToolResult: false });
  assert.equal(output, big);
  assert.equal(hits, 0);
});

test('truncates oversized tool_result keeping head + tail and marker', () => {
  const big = 'A'.repeat(80_000) + 'MIDDLE' + 'B'.repeat(80_000);
  const { output, hits } = longToolResultRule.apply(big, { fromToolResult: true });
  assert.equal(hits, 1);
  assert.ok(output.startsWith('AAAA'));
  assert.ok(output.endsWith('BBBB'));
  assert.match(output, /<TRUNCATED: \d+ bytes>/);
  assert.ok(output.length < 20_000);
});

test('passes through small tool_result unchanged', () => {
  const small = 'ok\n';
  const { output, hits } = longToolResultRule.apply(small, { fromToolResult: true });
  assert.equal(output, small);
  assert.equal(hits, 0);
});
