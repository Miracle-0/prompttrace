export interface JsonlParseError {
  line: number;
  raw: string;
  message: string;
}

export interface JsonlParseResult {
  records: unknown[];
  errors: JsonlParseError[];
}

export function parseJsonl(input: string): JsonlParseResult {
  const records: unknown[] = [];
  const errors: JsonlParseError[] = [];
  const lines = input.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.trim() === '') continue;
    try {
      records.push(JSON.parse(raw));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ line: i + 1, raw, message });
    }
  }
  return { records, errors };
}

export function stringifyJsonl(records: unknown[]): string {
  if (records.length === 0) return '';
  return records.map((r) => JSON.stringify(r)).join('\n') + '\n';
}
