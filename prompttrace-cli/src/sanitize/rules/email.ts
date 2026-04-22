// src/sanitize/rules/email.ts
import type { SanitizeRule } from '../types.js';

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export const emailRule: SanitizeRule = {
  id: 'email',
  description: 'Redact email addresses',
  apply(input) {
    let hits = 0;
    const output = input.replace(EMAIL, () => {
      hits++;
      return '<REDACTED:EMAIL>';
    });
    return { output, hits };
  },
};
