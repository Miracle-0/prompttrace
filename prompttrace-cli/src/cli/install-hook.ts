// src/cli/install-hook.ts
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const HOOK_CMD = 'prompttrace export --latest --from-hook';

type HookEntry = { type: 'command'; command: string };
type HookBlock = { matcher?: string; hooks: HookEntry[] };
type Settings = { hooks?: { Stop?: HookBlock[]; [k: string]: unknown } };

async function loadSettings(homeDir: string): Promise<Settings> {
  try {
    return JSON.parse(await readFile(join(homeDir, '.claude', 'settings.json'), 'utf8'));
  } catch {
    return {};
  }
}

async function saveSettings(homeDir: string, settings: Settings): Promise<void> {
  await mkdir(join(homeDir, '.claude'), { recursive: true });
  await writeFile(join(homeDir, '.claude', 'settings.json'), JSON.stringify(settings, null, 2) + '\n');
}

export async function installHook(homeDir: string): Promise<void> {
  const settings = await loadSettings(homeDir);
  settings.hooks ??= {};
  settings.hooks.Stop ??= [];
  const alreadyInstalled = settings.hooks.Stop.some((b) =>
    b.hooks?.some((h) => h.command === HOOK_CMD),
  );
  if (alreadyInstalled) return;
  settings.hooks.Stop.push({
    matcher: '',
    hooks: [{ type: 'command', command: HOOK_CMD }],
  });
  await saveSettings(homeDir, settings);
}

export async function uninstallHook(homeDir: string): Promise<void> {
  const settings = await loadSettings(homeDir);
  if (!settings.hooks?.Stop) return;
  settings.hooks.Stop = settings.hooks.Stop
    .map((b) => ({ ...b, hooks: b.hooks.filter((h) => h.command !== HOOK_CMD) }))
    .filter((b) => b.hooks.length > 0);
  await saveSettings(homeDir, settings);
}
