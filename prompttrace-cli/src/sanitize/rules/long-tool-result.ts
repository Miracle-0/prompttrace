// src/sanitize/rules/long-tool-result.ts
import type { SanitizeRule } from '../types.js';

const THRESHOLD = 64 * 1024; // 64 KB
const KEEP = 4 * 1024;       // 4 KB head + 4 KB tail

export const longToolResultRule: SanitizeRule = {
  id: 'long-tool-result',
  description: 'Truncate tool_result blocks larger than 64 KB',
  apply(input, ctx) {
    if (!ctx.fromToolResult) return { output: input, hits: 0 };
    if (input.length <= THRESHOLD) return { output: input, hits: 0 };
    const head = input.slice(0, KEEP);
    const tail = input.slice(-KEEP);
    const omitted = input.length - head.length - tail.length;
    return {
      output: `${head}\n<TRUNCATED: ${omitted} bytes>\n${tail}`,
      hits: 1,
    };
  },
};
