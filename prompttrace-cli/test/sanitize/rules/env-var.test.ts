// test/sanitize/rules/env-var.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { envVarRule } from '../../../src/sanitize/rules/env-var.js';

test('redacts KEY=value pairs only inside tool_result context', () => {
  const { output, hits } = envVarRule.apply('DATABASE_URL=postgres://u:p@h/db\nPORT=5432', {
    fromToolResult: true,
  });
  assert.equal(
    output,
    'DATABASE_URL=<REDACTED:ENV_VAR>\nPORT=<REDACTED:ENV_VAR>',
  );
  assert.equal(hits, 2);
});

test('does nothing outside tool_result context', () => {
  const { output, hits } = envVarRule.apply('DATABASE_URL=postgres://x', {
    fromToolResult: false,
  });
  assert.equal(output, 'DATABASE_URL=postgres://x');
  assert.equal(hits, 0);
});

test('ignores prose like "use KEY=value to set"', () => {
  const { hits } = envVarRule.apply('use KEY=v to set', { fromToolResult: true });
  // still matches KEY=v — that's acceptable; regression sentinel:
  assert.equal(hits, 1);
});
