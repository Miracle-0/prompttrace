// src/cli/list.ts
import { homedir } from 'node:os';
import { readFile } from 'node:fs/promises';
import { discoverSessions, parseSessionFile } from '../adapters/claude-code.js';

export async function runList(): Promise<number> {
  const sessions = await discoverSessions(homedir());
  if (sessions.length === 0) {
    console.log('No Claude Code sessions found at ~/.claude/projects/.');
    console.log('If you have used Claude Code recently, make sure at least one session has ended.');
    return 0;
  }
  for (const s of sessions) {
    let preview = '';
    try {
      const raw = await readFile(s.filePath, 'utf8');
      const { session } = parseSessionFile(raw, s.id);
      preview = session.meta.firstMessagePreview;
    } catch {
      preview = '(could not parse)';
    }
    const ago = friendlyAgo(Date.now() - s.mtimeMs);
    console.log(`${s.id}  ${ago.padEnd(10)}  ${preview}`);
  }
  return 0;
}

function friendlyAgo(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
