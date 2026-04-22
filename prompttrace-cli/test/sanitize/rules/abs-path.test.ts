// test/sanitize/rules/abs-path.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { absPathRule } from '../../../src/sanitize/rules/abs-path.js';

const ctx = { fromToolResult: false };

test('redacts /Users/<name>/... preserving trailing path', () => {
  const { output, hits } = absPathRule.apply('open /Users/andy/proj/blog/posts/hello.md', ctx);
  assert.equal(output, 'open <REDACTED:ABS_PATH>/proj/blog/posts/hello.md');
  assert.equal(hits, 1);
});

test('redacts /home/<name>/...', () => {
  const { output, hits } = absPathRule.apply('cd /home/andy/src', ctx);
  assert.equal(output, 'cd <REDACTED:ABS_PATH>/src');
  assert.equal(hits, 1);
});

test('redacts Windows C:\\Users\\Name', () => {
  const { output, hits } = absPathRule.apply('at C:\\Users\\Andy\\docs\\a.txt', ctx);
  assert.equal(output, 'at <REDACTED:ABS_PATH>\\docs\\a.txt');
  assert.equal(hits, 1);
});

test('counts multiple hits independently', () => {
  const { hits } = absPathRule.apply('/Users/a/x and /Users/b/y', ctx);
  assert.equal(hits, 2);
});

test('does not touch relative paths', () => {
  const { output, hits } = absPathRule.apply('open ./src/index.ts', ctx);
  assert.equal(output, 'open ./src/index.ts');
  assert.equal(hits, 0);
});
