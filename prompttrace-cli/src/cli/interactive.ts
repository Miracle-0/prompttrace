// src/cli/interactive.ts
import { select, input, confirm } from '@inquirer/prompts';
import { createTwoFilesPatch } from 'diff';
import { spawn } from 'node:child_process';
import type { ApplyStats } from '../sanitize/engine.js';
import type { SanitizeRule } from '../sanitize/types.js';

export interface SanitizeChoice {
  rules: SanitizeRule[];
  proceed: boolean;
}

export async function askSanitizeChoice(
  all: SanitizeRule[],
  stats: ApplyStats,
  showDiff: () => Promise<void>,
): Promise<SanitizeChoice> {
  while (true) {
    const answer = await select({
      message: `Sanitize summary: ${stats.total} redactions across ${countNonZero(stats)} rules. Apply which?`,
      choices: [
        { name: 'Apply all rules', value: 'all' },
        { name: 'Apply none (dangerous)', value: 'none' },
        { name: 'Pick rules one by one', value: 'pick' },
        { name: 'Show diff preview', value: 'diff' },
        { name: 'Cancel export', value: 'cancel' },
      ],
    });
    if (answer === 'all') return { rules: all, proceed: true };
    if (answer === 'none') {
      const sure = await confirm({ message: 'Export without any redaction. Are you sure?', default: false });
      if (sure) return { rules: [], proceed: true };
      continue;
    }
    if (answer === 'pick') {
      const kept: SanitizeRule[] = [];
      for (const r of all) {
        const ok = await confirm({ message: `Apply ${r.id}? (${stats.perRule[r.id] ?? 0} hits)`, default: true });
        if (ok) kept.push(r);
      }
      return { rules: kept, proceed: true };
    }
    if (answer === 'diff') {
      await showDiff();
      continue;
    }
    return { rules: [], proceed: false };
  }
}

function countNonZero(stats: ApplyStats): number {
  return Object.values(stats.perRule).filter((n) => n > 0).length;
}

export async function pagerDiff(before: string, after: string): Promise<void> {
  const patch = createTwoFilesPatch('before', 'after', before, after);
  const pager = process.env.PAGER || 'less';
  await new Promise<void>((resolve) => {
    const child = spawn(pager, ['-R'], { stdio: ['pipe', 'inherit', 'inherit'] });
    child.stdin.end(patch);
    child.on('exit', () => resolve());
    child.on('error', () => {
      console.log(patch);
      resolve();
    });
  });
}

export async function askMetaInputs(defaults: {
  title: string;
  summary: string;
  tags: string[];
}): Promise<{ title: string; summary: string; tags: string[] }> {
  const title = await input({ message: 'Title:', default: defaults.title });
  const summary = await input({ message: 'Summary (optional):', default: defaults.summary });
  const tagsRaw = await input({ message: 'Tags (comma-separated, optional):', default: defaults.tags.join(', ') });
  const tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);
  return { title, summary, tags };
}
