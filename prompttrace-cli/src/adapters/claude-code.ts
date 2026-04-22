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
      if (entry.type === 'system') continue;
      if (!entry.message || entry.uuid == null) {
        parseErrors.push({ line: -1, message: `record ${i}: missing message or uuid` });
        continue;
      }
      if (entry.cwd && !cwd) cwd = entry.cwd;
      const content = normalizeContent(entry.message.content);
      messages.push({
        uuid: entry.uuid,
        parentUuid: entry.parentUuid ?? null,
        role: entry.type === 'user' ? 'user' : 'assistant',
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
