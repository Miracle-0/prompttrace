// src/lib/session.ts
export type Role = 'user' | 'assistant' | 'tool';

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; output: string };

export interface Message {
  uuid: string;
  parentUuid: string | null;
  role: Role;
  timestamp: string; // ISO 8601
  content: ContentBlock[];
}

export interface SessionMeta {
  sourceSessionId: string;
  cwd: string | null;
  firstMessagePreview: string;
  messageCount: number;
  startedAt: string;
  endedAt: string;
}

export interface Session {
  meta: SessionMeta;
  messages: Message[];
}
