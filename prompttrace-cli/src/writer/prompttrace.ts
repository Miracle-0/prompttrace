// src/writer/prompttrace.ts
import { stringifyJsonl } from '../lib/jsonl.js';
import type { Session } from '../lib/session.js';

export interface WriteOptions {
  title: string;
  summary: string;
  tags: string[];
  rulesApplied: string[];
  redactionCount: number;
  exportedBy: string;
  exportedAt: string;
  includeSourceSessionId?: boolean;
}

export function writePromptTrace(session: Session, opts: WriteOptions): string {
  const meta = {
    type: 'meta',
    schema_version: 1,
    source: 'claude-code',
    source_session_id: opts.includeSourceSessionId === false ? undefined : session.meta.sourceSessionId,
    exported_at: opts.exportedAt,
    exported_by: opts.exportedBy,
    title: opts.title,
    summary: opts.summary || undefined,
    tags: opts.tags.length ? opts.tags : undefined,
    sanitization: {
      rules_applied: opts.rulesApplied,
      redaction_count: opts.redactionCount,
    },
  };

  const messages = session.messages.map((m) => ({
    type: 'message',
    role: m.role,
    uuid: m.uuid,
    parent_uuid: m.parentUuid,
    timestamp: m.timestamp,
    content: m.content,
  }));

  return stringifyJsonl([stripUndefined(meta), ...messages]);
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}
