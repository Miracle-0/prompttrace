export const SUPPORTED_SCHEMA_VERSIONS = [1] as const;
export type SupportedSchemaVersion = (typeof SUPPORTED_SCHEMA_VERSIONS)[number];

export interface SanitizationMeta {
  rules_applied: string[];
  redaction_count: number;
}

export interface MetaRecord {
  type: "meta";
  schema_version: number;
  source: string;
  source_session_id?: string;
  exported_at: string;
  exported_by: string;
  title: string;
  summary?: string;
  tags?: string[];
  sanitization: SanitizationMeta;
}

export type Role = "user" | "assistant" | "tool";

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}

export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  output: string;
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export interface MessageRecord {
  type: "message";
  role: Role;
  uuid: string;
  parent_uuid: string | null;
  timestamp: string;
  content: ContentBlock[];
}

export type PrompttraceRecord = MetaRecord | MessageRecord;

export function isSupportedSchemaVersion(v: unknown): v is SupportedSchemaVersion {
  return typeof v === "number" && (SUPPORTED_SCHEMA_VERSIONS as readonly number[]).includes(v);
}

export function isMetaRecord(x: unknown): x is MetaRecord {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return (
    r.type === "meta" &&
    typeof r.schema_version === "number" &&
    typeof r.source === "string" &&
    typeof r.exported_at === "string" &&
    typeof r.exported_by === "string" &&
    typeof r.title === "string" &&
    !!r.sanitization &&
    typeof r.sanitization === "object"
  );
}

export function isMessageRecord(x: unknown): x is MessageRecord {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return (
    r.type === "message" &&
    (r.role === "user" || r.role === "assistant" || r.role === "tool") &&
    typeof r.uuid === "string" &&
    (r.parent_uuid === null || typeof r.parent_uuid === "string") &&
    typeof r.timestamp === "string" &&
    Array.isArray(r.content)
  );
}
