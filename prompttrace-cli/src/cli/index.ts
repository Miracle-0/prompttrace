#!/usr/bin/env node
// src/cli/index.ts
import { homedir } from 'node:os';
import { Command } from 'commander';
import { runList } from './list.js';
import { runRules } from './rules.js';
import { runExport } from './export.js';
import { installHook, uninstallHook } from './install-hook.js';
import pkg from '../../package.json' with { type: 'json' };

const program = new Command();
program
  .name('prompttrace')
  .description('Share your AI coding sessions on GitHub')
  .version((pkg as { version: string }).version);

program
  .command('list')
  .description('List Claude Code sessions')
  .action(async () => {
    process.exit(await runList());
  });

program
  .command('rules')
  .description('List built-in sanitization rules')
  .action(() => {
    process.exit(runRules());
  });

program
  .command('export')
  .description('Export a Claude Code session as .prompttrace.jsonl')
  .option('-s, --session <id>', 'Session id to export (defaults to latest)')
  .option('--latest', 'Export the most recent session', false)
  .option('--from-hook', 'Invoked from Claude Code Stop hook', false)
  .option('-y, --yes', 'Apply all sanitization rules without prompting', false)
  .action(async (opts: { session?: string; latest: boolean; fromHook: boolean; yes: boolean }) => {
    process.exit(
      await runExport({
        sessionId: opts.session,
        latest: opts.latest,
        fromHook: opts.fromHook,
        yes: opts.yes,
      }),
    );
  });

program
  .command('install-hook')
  .description('Install Claude Code Stop hook to auto-export sessions')
  .action(async () => {
    await installHook(homedir());
    console.log('✓ Installed Stop hook in ~/.claude/settings.json');
  });

program
  .command('uninstall-hook')
  .description('Remove prompttrace Stop hook from Claude Code settings')
  .action(async () => {
    await uninstallHook(homedir());
    console.log('✓ Removed Stop hook from ~/.claude/settings.json');
  });

program.parseAsync().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
