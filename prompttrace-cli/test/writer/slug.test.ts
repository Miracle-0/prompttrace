// test/writer/slug.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, resolveSlug } from '../../src/writer/slug.js';

test('slugify lowercases, spaces → dashes, strips punctuation', () => {
  assert.equal(slugify('用 Claude Code 搭建博客'), 'claude-code');
  assert.equal(slugify('Add Astro Support!'), 'add-astro-support');
  assert.equal(slugify('   already--clean  '), 'already-clean');
});

test('slugify falls back to "session" for empty result', () => {
  assert.equal(slugify('***'), 'session');
  assert.equal(slugify(''), 'session');
});

test('resolveSlug appends short hash on collision', () => {
  const exists = (name: string) => name === 'astro-migration.prompttrace.jsonl';
  const out = resolveSlug('astro-migration', 'abcdef1234', exists);
  assert.equal(out, 'astro-migration-abcdef1.prompttrace.jsonl');
});

test('resolveSlug returns clean name when no collision', () => {
  const out = resolveSlug('astro-migration', 'abcdef', () => false);
  assert.equal(out, 'astro-migration.prompttrace.jsonl');
});
