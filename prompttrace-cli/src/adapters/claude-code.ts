import { parseJsonl } from '../lib/jsonl.js';
import type { ContentBlock, Message, Session, SessionMeta } from '../lib/session.js';

interface RawEntry {
  type: 'user' | 'assistant' | 'system';
  uuid: string;
  parentUuid: string | null;
  timestamp: string;
  cwd?: string;
  message: { role: string; content: string | ContentBlock[] };
}

export interface ParseSessionResult {
  session: Session;
  parseErrors: { line: number; message: string }[];
}

export function parseSessionFile(raw: string, sourceSessionId: string): ParseSessionResult {
  const { records, errors } = parseJsonl(raw);
  const messages: Message[] = [];
  let cwd: string | null = null;
  for (const record of records) {
    const entry = record as RawEntry;
    if (entry.type === 'system') continue;
    if (entry.cwd && !cwd) cwd = entry.cwd;
    const content = normalizeContent(entry.message.content);
    messages.push({
      uuid: entry.uuid,
      parentUuid: entry.parentUuid ?? null,
      role: entry.type === 'user' ? 'user' : 'assistant',
      timestamp: entry.timestamp,
      content,
    });
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
    parseErrors: errors.map((e) => ({ line: e.line, message: e.message })),
  };
}

function normalizeContent(raw: string | ContentBlock[]): ContentBlock[] {
  if (typeof raw === 'string') return [{ type: 'text', text: raw }];
  return raw;
}

function firstText(messages: Message[]): string {
  for (const m of messages) {
    for (const c of m.content) {
      if (c.type === 'text') return c.text;
    }
  }
  return '';
}
