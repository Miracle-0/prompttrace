// src/cli/rules.ts
import { ALL_RULES } from '../sanitize/rules/index.js';

export function runRules(): number {
  console.log('Built-in sanitization rules:\n');
  for (const r of ALL_RULES) {
    console.log(`  ${r.id.padEnd(20)} ${r.description}`);
  }
  return 0;
}
