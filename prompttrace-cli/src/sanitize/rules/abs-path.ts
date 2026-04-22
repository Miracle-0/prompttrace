// src/sanitize/rules/abs-path.ts
import type { SanitizeRule } from '../types.js';

const UNIX = /\/(?:Users|home)\/[^/\s]+/g;
const WINDOWS = /[A-Za-z]:\\Users\\[^\\/\s]+/g;

export const absPathRule: SanitizeRule = {
  id: 'abs-path',
  description: 'Redact absolute home directories (/Users/<name>, /home/<name>, C:\\Users\\<name>)',
  apply(input) {
    let hits = 0;
    let output = input.replace(UNIX, () => {
      hits++;
      return '<REDACTED:ABS_PATH>';
    });
    output = output.replace(WINDOWS, () => {
      hits++;
      return '<REDACTED:ABS_PATH>';
    });
    return { output, hits };
  },
};
