// src/sanitize/engine.ts
import type { Session, ContentBlock } from '../lib/session.js';
import type { SanitizeRule, RuleContext } from './types.js';

export interface ApplyStats {
  total: number;
  perRule: Record<string, number>;
}

export interface ApplyResult {
  session: Session;
  stats: ApplyStats;
}

export function applyRules(session: Session, rules: SanitizeRule[]): ApplyResult {
  const stats: ApplyStats = { total: 0, perRule: {} };
  for (const r of rules) stats.perRule[r.id] = 0;

  const runOn = (text: string, ctx: RuleContext): string => {
    let current = text;
    for (const rule of rules) {
      try {
        const { output, hits } = rule.apply(current, ctx);
        if (hits > 0) {
          stats.perRule[rule.id] += hits;
          stats.total += hits;
        }
        current = output;
      } catch {
        // spec §6.1: regex failure skips this rule, does not abort
      }
    }
    return current;
  };

  const messages = session.messages.map((m) => ({
    ...m,
    content: m.content.map((block) => rewriteBlock(block, runOn)),
  }));
  return { session: { ...session, messages }, stats };
}

function rewriteBlock(
  block: ContentBlock,
  runOn: (text: string, ctx: RuleContext) => string,
): ContentBlock {
  if (block.type === 'text') {
    return { type: 'text', text: runOn(block.text, { fromToolResult: false }) };
  }
  if (block.type === 'tool_use') {
    const rewritten = JSON.parse(runOn(JSON.stringify(block.input), { fromToolResult: false }));
    return { ...block, input: rewritten };
  }
  if (block.type === 'tool_result') {
    return { ...block, output: runOn(block.output, { fromToolResult: true }) };
  }
  return block;
}
