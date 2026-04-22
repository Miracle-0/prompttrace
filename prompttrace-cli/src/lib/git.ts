// src/lib/git.ts
import { stat } from 'node:fs/promises';
import { dirname, join, parse } from 'node:path';

export async function findGitRoot(startDir: string): Promise<string | null> {
  let current = startDir;
  const { root } = parse(current);
  while (true) {
    try {
      await stat(join(current, '.git'));
      return current;
    } catch {
      // keep walking
    }
    if (current === root) return null;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}
