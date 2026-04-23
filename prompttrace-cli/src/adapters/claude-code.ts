import { parseJsonl } from '../lib/jsonl.js';
import type { ContentBlock, Message, Session, SessionMeta } from '../lib/session.js';
import { readdir, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';

interface RawEntry {
  type: string;
  uuid: string;
  parentUuid: string | null;
  timestamp: string;
  cwd?: string;
  message: { role: string; content: string | RawBlock[] };
}

export interface ParseSessionResult {
  session: Session;
  parseErrors: { line: number; message: string }[];
}

export function parseSessionFile(raw: string, sourceSessionId: string): ParseSessionResult {
  const { records, errors } = parseJsonl(raw);
  const messages: Message[] = [];
  const parseErrors: { line: number; message: string }[] = errors.map((e) => ({
    line: e.line,
    message: e.message,
  }));
  let cwd: string | null = null;
  for (let i = 0; i < records.length; i++) {
    try {
      const entry = records[i] as RawEntry;
      if (!entry || typeof entry !== 'object') {
        parseErrors.push({ line: -1, message: `record ${i}: not an object` });
        continue;
      }
      const role = inferRole(entry);
      if (role === null) continue;
      if (!entry.message || entry.uuid == null) {
        parseErrors.push({ line: -1, message: `record ${i}: missing message or uuid` });
        continue;
      }
      if (entry.cwd && !cwd) cwd = entry.cwd;
      const content = normalizeContent(entry.message.content);
      messages.push({
        uuid: entry.uuid,
        parentUuid: entry.parentUuid ?? null,
        role,
        timestamp: entry.timestamp,
        content,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      parseErrors.push({ line: -1, message: `record ${i}: ${message}` });
    }
  }
  const meta: SessionMeta = {
    sourceSessionId,
    cwd,
    firstMessagePreview: firstText(messages).slice(0, 120),
    messageCount: messages.length,
    startedAt: messages[0]?.timestamp ?? '',
    endedAt: messages[messages.length - 1]?.timestamp ?? '',
  };
  return {
    session: { meta, messages },
    parseErrors,
  };
}

function normalizeContent(raw: string | ContentBlock[] | RawBlock[]): ContentBlock[] {
  if (typeof raw === 'string') return [{ type: 'text', text: raw }];
  if (!Array.isArray(raw)) return [];
  const out: ContentBlock[] = [];
  for (const b of raw) {
    if (!b || typeof b !== 'object') continue;
    if (b.type === 'text' && typeof b.text === 'string') {
      out.push({ type: 'text', text: b.text });
    } else if (b.type === 'tool_use' && typeof b.id === 'string' && typeof b.name === 'string') {
      out.push({ type: 'tool_use', id: b.id, name: b.name, input: b.input });
    } else if (b.type === 'tool_result' && typeof b.tool_use_id === 'string') {
      const content = (b as { content?: unknown; output?: unknown }).content ?? (b as { output?: unknown }).output;
      const output =
        typeof content === 'string'
          ? content
          : content == null
            ? ''
            : JSON.stringify(content);
      out.push({ type: 'tool_result', tool_use_id: b.tool_use_id, output });
    }
  }
  return out;
}

type InferredRole = 'user' | 'assistant' | 'tool' | null;

function inferRole(entry: RawEntry): InferredRole {
  if (entry.type === 'assistant') return 'assistant';
  if (entry.type !== 'user') return null;
  const content = entry.message?.content;

  if (typeof content === 'string') {
    return isLocalCommandText(content) ? null : 'user';
  }

  if (Array.isArray(content)) {
    if (
      content.some(
        (b) => !!b && typeof b === 'object' && (b as RawBlock).type === 'tool_result',
      )
    ) {
      return 'tool';
    }
    const texts = content.filter(
      (b): b is { type: 'text'; text: string } =>
        !!b &&
        typeof b === 'object' &&
        (b as RawBlock).type === 'text' &&
        typeof (b as RawBlock).text === 'string',
    );
    if (texts.length > 0 && texts.every((b) => isLocalCommandText(b.text))) return null;
    return 'user';
  }
  return 'user';
}

function isLocalCommandText(s: string): boolean {
  return /<local-command-(caveat|stdout|stderr)>|<command-name>\//.test(s);
}

interface RawBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: unknown;
  output?: unknown;
}

function firstText(messages: Message[]): string {
  for (const m of messages) {
    for (const c of m.content) {
      if (c.type === 'text') return c.text;
    }
  }
  return '';
}

export interface SessionRef {
  id: string;
  filePath: string;
  projectDir: string;
  mtimeMs: number;
}

export async function discoverSessions(homeDir: string): Promise<SessionRef[]> {
  const root = join(homeDir, '.claude', 'projects');
  let projects: string[];
  try {
    projects = await readdir(root);
  } catch {
    return [];
  }
  const refs: SessionRef[] = [];
  for (const p of projects) {
    const projectDir = join(root, p);
    let files: string[];
    try {
      files = await readdir(projectDir);
    } catch {
      continue;
    }
    for (const f of files) {
      if (!f.endsWith('.jsonl')) continue;
      const filePath = join(projectDir, f);
      const st = await stat(filePath);
      refs.push({
        id: basename(f, '.jsonl'),
        filePath,
        projectDir,
        mtimeMs: st.mtimeMs,
      });
    }
  }
  refs.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return refs;
}
