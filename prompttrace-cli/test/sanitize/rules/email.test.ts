// test/sanitize/rules/email.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emailRule } from '../../../src/sanitize/rules/email.js';

const ctx = { fromToolResult: false };

test('redacts a simple email', () => {
  const { output, hits } = emailRule.apply('ping me at andy@example.com', ctx);
  assert.equal(output, 'ping me at <REDACTED:EMAIL>');
  assert.equal(hits, 1);
});

test('redacts multiple emails', () => {
  const { hits } = emailRule.apply('a@x.io and b.c@y.co', ctx);
  assert.equal(hits, 2);
});

test('leaves non-emails alone', () => {
  const { hits } = emailRule.apply('price is $3@ea', ctx);
  assert.equal(hits, 0);
});
