const BLOB_RE =
  /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+?\.prompttrace\.jsonl)(\?[^#]*)?(#.*)?$/;

export interface BlobParts {
  owner: string;
  repo: string;
  ref: string;
  path: string;
}

export function parseBlobUrl(url: string): BlobParts | null {
  const m = BLOB_RE.exec(url);
  if (!m) return null;
  return { owner: m[1]!, repo: m[2]!, ref: m[3]!, path: m[4]! };
}

export function isPrompttraceBlobUrl(url: string): boolean {
  return parseBlobUrl(url) !== null;
}

export function blobToRawUrl(url: string): string | null {
  const p = parseBlobUrl(url);
  if (!p) return null;
  return `https://raw.githubusercontent.com/${p.owner}/${p.repo}/${p.ref}/${p.path}`;
}
