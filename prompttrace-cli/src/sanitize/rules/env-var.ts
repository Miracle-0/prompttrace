// src/sanitize/rules/env-var.ts
import type { SanitizeRule } from '../types.js';

// UPPER_SNAKE_CASE=<non-whitespace value>
const PATTERN = /([A-Z][A-Z0-9_]{2,})=([^\s#]+)/g;

export const envVarRule: SanitizeRule = {
  id: 'env-var',
  description: 'Redact KEY=value pairs (only inside tool_result)',
  apply(input, ctx) {
    if (!ctx.fromToolResult) return { output: input, hits: 0 };
    let hits = 0;
    const output = input.replace(PATTERN, (_m, key) => {
      hits++;
      return `${key}=<REDACTED:ENV_VAR>`;
    });
    return { output, hits };
  },
};
