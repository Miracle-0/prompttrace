import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonl, stringifyJsonl } from '../../src/lib/jsonl.js';

test('parseJsonl yields one object per line, skipping empty lines', () => {
  const input = '{"a":1}\n{"b":2}\n\n{"c":3}\n';
  const { records, errors } = parseJsonl(input);
  assert.deepEqual(records, [{ a: 1 }, { b: 2 }, { c: 3 }]);
  assert.equal(errors.length, 0);
});

test('parseJsonl reports bad lines by 1-based line number', () => {
  const input = '{"a":1}\nnot-json\n{"b":2}\n';
  const { records, errors } = parseJsonl(input);
  assert.deepEqual(records, [{ a: 1 }, { b: 2 }]);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].line, 2);
});

test('stringifyJsonl writes one JSON per line with trailing newline', () => {
  const out = stringifyJsonl([{ a: 1 }, { b: 2 }]);
  assert.equal(out, '{"a":1}\n{"b":2}\n');
});

test('parseJsonl handles Windows CRLF line endings', () => {
  const input = '{"a":1}\r\n{"b":2}\r\n';
  const { records, errors } = parseJsonl(input);
  assert.deepEqual(records, [{ a: 1 }, { b: 2 }]);
  assert.equal(errors.length, 0);
});

test('parseJsonl returns empty result for empty input', () => {
  const { records, errors } = parseJsonl('');
  assert.deepEqual(records, []);
  assert.equal(errors.length, 0);
});

test('parseJsonl skips whitespace-only lines', () => {
  const input = '{"a":1}\n   \n\t\n{"b":2}\n';
  const { records, errors } = parseJsonl(input);
  assert.deepEqual(records, [{ a: 1 }, { b: 2 }]);
  assert.equal(errors.length, 0);
});

test('stringifyJsonl returns empty string for empty input', () => {
  assert.equal(stringifyJsonl([]), '');
});
