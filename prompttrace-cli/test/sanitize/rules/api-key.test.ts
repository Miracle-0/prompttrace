// test/sanitize/rules/api-key.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiKeyRule } from '../../../src/sanitize/rules/api-key.js';

const ctx = { fromToolResult: false };

test('redacts Anthropic sk-ant keys', () => {
  const { output, hits } = apiKeyRule.apply('key=sk-ant-api03-ABCdef_ghijklmnOPQrstu12345', ctx);
  assert.equal(output, 'key=<REDACTED:API_KEY>');
  assert.equal(hits, 1);
});

test('redacts GitHub ghp_ tokens', () => {
  const { output, hits } = apiKeyRule.apply('token ghp_1234567890abcdefghijklmnopqrstuv0001', ctx);
  assert.equal(output, 'token <REDACTED:API_KEY>');
  assert.equal(hits, 1);
});

test('redacts AWS AKIA access key ids', () => {
  const { output, hits } = apiKeyRule.apply('aws AKIAIOSFODNN7EXAMPLE here', ctx);
  assert.equal(output, 'aws <REDACTED:API_KEY> here');
  assert.equal(hits, 1);
});

test('does not redact short strings that merely share a prefix', () => {
  const { output, hits } = apiKeyRule.apply('sk-ant-short', ctx);
  assert.equal(output, 'sk-ant-short');
  assert.equal(hits, 0);
});
