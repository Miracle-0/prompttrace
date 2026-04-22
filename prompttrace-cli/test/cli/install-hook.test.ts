// test/cli/install-hook.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installHook, uninstallHook } from '../../src/cli/install-hook.js';

const HOOK_CMD = 'prompttrace export --latest --from-hook';

test('installHook creates settings.json with Stop hook when none exists', async () => {
  const home = await mkdtemp(join(tmpdir(), 'pt-hook-'));
  await installHook(home);
  const settings = JSON.parse(await readFile(join(home, '.claude', 'settings.json'), 'utf8'));
  assert.deepEqual(settings.hooks.Stop[0].hooks[0], { type: 'command', command: HOOK_CMD });
});

test('installHook is idempotent — second call does not duplicate', async () => {
  const home = await mkdtemp(join(tmpdir(), 'pt-hook2-'));
  await installHook(home);
  await installHook(home);
  const settings = JSON.parse(await readFile(join(home, '.claude', 'settings.json'), 'utf8'));
  const flat = settings.hooks.Stop.flatMap((h: any) => h.hooks);
  const matches = flat.filter((h: any) => h.command === HOOK_CMD);
  assert.equal(matches.length, 1);
});

test('installHook preserves unrelated Stop hooks', async () => {
  const home = await mkdtemp(join(tmpdir(), 'pt-hook3-'));
  await mkdir(join(home, '.claude'), { recursive: true });
  await writeFile(
    join(home, '.claude', 'settings.json'),
    JSON.stringify({ hooks: { Stop: [{ matcher: '', hooks: [{ type: 'command', command: 'other' }] }] } }),
  );
  await installHook(home);
  const settings = JSON.parse(await readFile(join(home, '.claude', 'settings.json'), 'utf8'));
  const flat = settings.hooks.Stop.flatMap((h: any) => h.hooks);
  assert.ok(flat.some((h: any) => h.command === 'other'));
  assert.ok(flat.some((h: any) => h.command === HOOK_CMD));
});

test('uninstallHook removes only our command', async () => {
  const home = await mkdtemp(join(tmpdir(), 'pt-hook4-'));
  await installHook(home);
  await uninstallHook(home);
  const settings = JSON.parse(await readFile(join(home, '.claude', 'settings.json'), 'utf8'));
  const flat = (settings.hooks?.Stop ?? []).flatMap((h: any) => h.hooks ?? []);
  assert.equal(flat.filter((h: any) => h.command === HOOK_CMD).length, 0);
});
