// src/sanitize/rules/api-key.ts
import type { SanitizeRule } from '../types.js';

const PATTERNS: RegExp[] = [
  /sk-ant-[A-Za-z0-9_-]{20,}/g,
  /ghp_[A-Za-z0-9]{36,}/g,
  /AKIA[A-Z0-9]{16}/g,
];

export const apiKeyRule: SanitizeRule = {
  id: 'api-key',
  description: 'Redact common API key prefixes (sk-ant, ghp_, AKIA…)',
  apply(input) {
    let hits = 0;
    let output = input;
    for (const p of PATTERNS) {
      output = output.replace(p, () => {
        hits++;
        return '<REDACTED:API_KEY>';
      });
    }
    return { output, hits };
  },
};
