// src/sanitize/types.ts
export interface SanitizeRule {
  id: string;
  description: string;
  /** Returns the sanitized string, or null if no change. hitsOut is incremented once per replacement. */
  apply(input: string, ctx: RuleContext): { output: string; hits: number };
}

export interface RuleContext {
  /** true when the string came from a tool_result block (long-tool-result rule only fires here). */
  fromToolResult: boolean;
}
