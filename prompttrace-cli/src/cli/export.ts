// src/cli/export.ts
import { homedir } from 'node:os';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { confirm } from '@inquirer/prompts';
import { join } from 'node:path';
import { discoverSessions, parseSessionFile } from '../adapters/claude-code.js';
import { applyRules, applyRulesToString } from '../sanitize/engine.js';
import { ALL_RULES } from '../sanitize/rules/index.js';
import { findGitRoot } from '../lib/git.js';
import { slugify, resolveSlug } from '../writer/slug.js';
import { writePromptTrace } from '../writer/prompttrace.js';
import { askSanitizeChoice, askMetaInputs, pagerDiff } from './interactive.js';
import pkg from '../../package.json' with { type: 'json' };

export interface ExportOptions {
  sessionId?: string;
  latest: boolean;
  fromHook: boolean;
  yes: boolean;
}

export async function runExport(opts: ExportOptions): Promise<number> {
  const sessions = await discoverSessions(homedir());
  if (sessions.length === 0) {
    if (opts.fromHook) return 0;
    console.error('No Claude Code sessions found at ~/.claude/projects/.');
    return 1;
  }
  const ref = opts.sessionId
    ? sessions.find((s) => s.id === opts.sessionId)
    : sessions[0];
  if (!ref) {
    console.error(`Session ${opts.sessionId} not found.`);
    return 1;
  }

  const raw = await readFile(ref.filePath, 'utf8');
  const { session, parseErrors } = parseSessionFile(raw, ref.id);
  if (parseErrors.length) {
    console.warn(`Warning: ${parseErrors.length} lines could not be parsed and were skipped.`);
  }

  const gitRootStart = opts.fromHook ? (session.meta.cwd ?? process.cwd()) : process.cwd();
  const gitRoot = await findGitRoot(gitRootStart);
  if (!gitRoot) {
    if (opts.fromHook) return 0;
    if (!opts.yes) {
      const ok = await confirm({
        message: 'Current directory is not inside a git repo. Write anyway?',
        default: false,
      });
      if (!ok) return 0;
    }
  }

  if (opts.fromHook) {
    const proceed = await confirm({ message: 'Export this Claude Code session?', default: false });
    if (!proceed) return 0;
  }

  const defaults = {
    title: session.meta.firstMessagePreview.slice(0, 60) || 'session',
    summary: '',
    tags: [] as string[],
  };
  const meta = opts.yes ? defaults : await askMetaInputs(defaults);

  const { stats: preStats } = applyRules(session, ALL_RULES);

  const choice = opts.yes
    ? { rules: ALL_RULES, proceed: true }
    : await askSanitizeChoice(ALL_RULES, preStats, async () => {
        const { session: afterAll } = applyRules(session, ALL_RULES);
        const before = JSON.stringify(session, null, 2);
        const after = JSON.stringify(afterAll, null, 2);
        await pagerDiff(before, after);
      });
  if (!choice.proceed) return 0;

  const { session: sanitized, stats } = applyRules(session, choice.rules);

  const safeTitle = applyRulesToString(meta.title, choice.rules);
  const safeSummary = applyRulesToString(meta.summary, choice.rules);

  const targetDir = join(gitRoot ?? process.cwd(), '.prompttrace');
  await mkdir(targetDir, { recursive: true });
  const base = slugify(safeTitle);
  const entropy = randomBytes(4).toString('hex');
  const name = resolveSlug(base, entropy, (n) => existsSync(join(targetDir, n)));
  const out = writePromptTrace(sanitized, {
    title: safeTitle,
    summary: safeSummary,
    tags: meta.tags,
    rulesApplied: choice.rules.map((r) => r.id),
    redactionCount: stats.total,
    exportedBy: `prompttrace-cli/${(pkg as { version: string }).version}`,
    exportedAt: new Date().toISOString(),
  });
  await writeFile(join(targetDir, name), out);

  console.log(`\n✓ written to .prompttrace/${name}`);
  console.log('  Next: git diff to verify sanitization, then git add && git commit.');
  return 0;
}

function existsSync(path: string): boolean {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}
