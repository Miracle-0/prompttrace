// src/sanitize/rules/index.ts
import type { SanitizeRule } from '../types.js';
import { absPathRule } from './abs-path.js';
import { apiKeyRule } from './api-key.js';
import { envVarRule } from './env-var.js';
import { emailRule } from './email.js';
import { longToolResultRule } from './long-tool-result.js';

export const ALL_RULES: SanitizeRule[] = [
  absPathRule,
  apiKeyRule,
  envVarRule,
  emailRule,
  longToolResultRule,
];

export function findRule(id: string): SanitizeRule | undefined {
  return ALL_RULES.find((r) => r.id === id);
}
