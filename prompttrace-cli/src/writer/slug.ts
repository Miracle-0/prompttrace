// src/writer/slug.ts
export function slugify(title: string): string {
  const ascii = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x00-\x7F]/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return ascii.length ? ascii : 'session';
}

export function resolveSlug(
  base: string,
  entropyHex: string,
  exists: (name: string) => boolean,
): string {
  const cleanName = `${base}.prompttrace.jsonl`;
  if (!exists(cleanName)) return cleanName;
  const suffix = entropyHex.slice(0, 7);
  return `${base}-${suffix}.prompttrace.jsonl`;
}
